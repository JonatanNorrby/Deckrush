import { CARD_LIBRARY, getCard, cardNeedsEnemyTarget } from '../data/cards.js';
import { loadSave } from '../core/storage.js';
import { weeklySeed } from '../core/rng.js';
import { CHARACTERS, getCharacter } from '../data/characters.js';
import { AnimationDirector } from './animations.js';

const fmt = new Intl.NumberFormat('en-US');

export function shouldIgnoreBackdropAction(eventTarget, actionTarget) {
  const isBackdrop = actionTarget?.classList?.contains('character-picker-backdrop')
    || actionTarget?.classList?.contains('handbook-backdrop');
  return Boolean(isBackdrop && eventTarget !== actionTarget);
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function artMarkup(path, alt, extraClass = '') {
  return `
    <img class="art-image ${extraClass}" src="${path}" alt="${alt}" draggable="false"
      onerror="this.hidden=true">`;
}

function animatedSpriteMarkup(staticPath, alt) {
  return `
    <span class="sprite-static-art">${artMarkup(staticPath, alt)}</span>
    <img class="sprite-animation-frame" data-animation-frame alt="" draggable="false" hidden>
  `;
}

function cardArtMarkup(card) {
  return artMarkup(`./assets/cards/art/${card.id}.png`, '', 'card-art-image');
}

function cardMarkup(card, index = null, action = null) {
  const attrs = action ? `data-action="${action}" ${index !== null ? `data-index="${index}"` : ''} data-card="${card.id}"` : '';
  const rarity = card.rarity || 'common';
  return `
    <button class="card card--${rarity}" ${attrs} ${action ? '' : 'disabled'}>
      <div class="card__top"><span class="card__cost">${card.cost}</span><span class="card__rarity">${rarity}</span></div>
      <div class="card__art" aria-hidden="true">${cardArtMarkup(card)}</div>
      <strong class="card__name">${card.name}</strong>
      <p>${card.description}</p>
    </button>`;
}

function combatCardMarkup(card, index, energy, handSize) {
  const rarity = card.rarity || 'common';
  const center = (handSize - 1) / 2;
  const distance = index - center;
  const rotation = distance * 4.5;
  const fanY = Math.abs(distance) * 5;
  const unaffordable = card.cost > energy;

  return `
    <article
      class="combat-card card--${rarity} ${unaffordable ? 'is-unaffordable' : ''}"
      data-drag-card
      data-index="${index}"
      data-card="${card.id}"
      style="--fan-rotation:${rotation}deg;--fan-y:${fanY}px;--fan-order:${index}"
      role="button"
      tabindex="0"
      aria-label="${card.name}, costs ${card.cost} energy">
      <div class="card__top">
        <span class="card__cost">${card.cost}</span>
        <span class="card__rarity">${rarity}</span>
      </div>
      <div class="card__art" aria-hidden="true">${cardArtMarkup(card)}</div>
      <strong class="card__name">${card.name}</strong>
      <p>${card.description}</p>
    </article>`;
}

export class Renderer {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.handbookOpen = false;
    this.handbookTab = 'rules';
    this.characterSelectOpen = false;
    this.selectedCharacterId = 'viper';
    this.drag = null;
    this.pendingTarget = null;
    this.targetArrow = null;
    this.cardPlayLocked = false;
    this.animations = new AnimationDirector(root);

    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('input', (event) => this.handleInput(event));
    this.root.addEventListener('pointerdown', (event) => this.handlePointerDown(event));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.drag) this.cancelCardDrag();
      if (event.key === 'Escape' && this.pendingTarget) this.cancelPendingTarget();
      if (event.key === 'Escape' && this.characterSelectOpen) {
        this.characterSelectOpen = false;
        this.renderMenu();
        return;
      }
      if (event.key === 'Escape' && this.handbookOpen) {
        this.handbookOpen = false;
        this.renderMenu();
      }
    });
  }

  handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    if (shouldIgnoreBackdropAction(event.target, target)) return;
    const action = target.dataset.action;
    if (action === 'start-normal') this.game.startRun('normal', target.dataset.character || this.selectedCharacterId);
    if (action === 'start-weekly') this.game.startRun('weekly', target.dataset.character || this.selectedCharacterId);
    if (action === 'heat') {
      const slider = this.root.querySelector('[data-heat-slider]');
      this.game.chooseHeat(Number(slider?.value ?? target.dataset.heat ?? 0));
    }
    if (action === 'end-turn') {
      if (this.pendingTarget) this.cancelPendingTarget();
      this.game.endTurn();
    }
    if (action === 'reward') this.game.chooseReward(target.dataset.card);
    if (action === 'skip-reward') this.game.skipReward();
    if (action === 'menu') this.game.backToMenu();
    if (action === 'open-character-select') {
      this.characterSelectOpen = true;
      this.renderMenu();
    }
    if (action === 'close-character-select') {
      this.characterSelectOpen = false;
      this.renderMenu();
    }
    if (action === 'choose-character') {
      const characterId = target.dataset.character;
      if (CHARACTERS[characterId]) this.selectedCharacterId = characterId;
      this.characterSelectOpen = false;
      this.renderMenu();
    }
    if (action === 'open-handbook') {
      this.handbookOpen = true;
      this.handbookTab = 'rules';
      this.renderMenu();
    }
    if (action === 'close-handbook') {
      this.handbookOpen = false;
      this.renderMenu();
    }
    if (action === 'handbook-tab') {
      this.handbookTab = target.dataset.tab || 'rules';
      this.renderMenu();
    }
  }

  handleInput(event) {
    const slider = event.target.closest?.('[data-heat-slider]');
    if (!slider) return;

    const heat = Math.max(0, Math.min(3, Number(slider.value)));
    const selector = slider.closest('.heat-selector');
    if (!selector) return;

    selector.dataset.heat = String(heat);
    selector.style.setProperty('--heat-level', String(heat));
    selector.style.setProperty('--heat-pct', `${(heat / 3) * 100}%`);
    slider.setAttribute('aria-valuetext', `Heat ${heat}`);

    const value = selector.querySelector('[data-heat-value]');
    const score = selector.querySelector('[data-heat-score]');
    const hp = selector.querySelector('[data-heat-hp]');
    const damage = selector.querySelector('[data-heat-damage]');
    const confirm = selector.querySelector('[data-heat-confirm]');

    if (value) value.textContent = String(heat);
    if (score) score.textContent = `x${(1 + heat * 0.25).toFixed(2)} score`;
    if (hp) hp.textContent = `+${heat * 16}% enemy HP`;
    if (damage) damage.textContent = `+${heat} enemy damage`;
    if (confirm) confirm.textContent = `Enter Fight — Heat ${heat}`;
  }

  handlePointerDown(event) {
    if (this.game.state.phase !== 'combat' || this.cardPlayLocked) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const pendingCard = event.target.closest('[data-pending-target-card]');
    if (pendingCard && this.pendingTarget) {
      this.beginTargetArrow(event, pendingCard);
      return;
    }

    const cardEl = event.target.closest('[data-drag-card]');
    if (!cardEl || this.drag || this.pendingTarget) return;

    const index = Number(cardEl.dataset.index);
    const card = getCard(this.game.state.hand[index]);
    if (!card || card.cost > this.game.state.player.energy) {
      cardEl.classList.remove('card-shake');
      void cardEl.offsetWidth;
      cardEl.classList.add('card-shake');
      return;
    }

    event.preventDefault();
    const ghost = cardEl.cloneNode(true);
    ghost.removeAttribute('data-drag-card');
    ghost.classList.add('combat-card--dragging');
    ghost.classList.remove('card-shake');
    document.body.appendChild(ghost);
    cardEl.classList.add('combat-card--source');

    this.drag = {
      pointerId: event.pointerId,
      index,
      card,
      source: cardEl,
      ghost,
      targeted: cardNeedsEnemyTarget(card),
    };

    document.body.classList.add('is-dragging-card');
    this.positionDragGhost(event.clientX, event.clientY);
    this.updateDragTargets(event.clientX, event.clientY);

    this.onPointerMove = (moveEvent) => {
      if (!this.drag || moveEvent.pointerId !== this.drag.pointerId) return;
      moveEvent.preventDefault();
      this.positionDragGhost(moveEvent.clientX, moveEvent.clientY);
      this.updateDragTargets(moveEvent.clientX, moveEvent.clientY);
    };

    this.onPointerUp = (upEvent) => {
      if (!this.drag || upEvent.pointerId !== this.drag.pointerId) return;
      upEvent.preventDefault();
      this.finishCardDrag(upEvent.clientX, upEvent.clientY);
    };

    document.addEventListener('pointermove', this.onPointerMove, { passive: false });
    document.addEventListener('pointerup', this.onPointerUp, { passive: false });
    document.addEventListener('pointercancel', this.onPointerUp, { passive: false });
  }

  positionDragGhost(x, y) {
    if (!this.drag) return;
    this.drag.ghost.style.left = `${x}px`;
    this.drag.ghost.style.top = `${y}px`;
  }

  getDropContext(x, y) {
    const element = document.elementFromPoint(x, y);
    const enemyEl = element?.closest?.('[data-enemy-index]') || null;
    const battlefield = element?.closest?.('[data-battlefield]') || null;
    return { element, enemyEl, battlefield };
  }

  updateDragTargets(x, y) {
    if (!this.drag) return;
    const battlefield = this.root.querySelector('[data-battlefield]');
    const { battlefield: hoveredBattlefield } = this.getDropContext(x, y);

    battlefield?.classList.add('is-drag-active');
    battlefield?.classList.toggle('is-valid-drop', Boolean(hoveredBattlefield));
  }

  finishCardDrag(x, y) {
    if (!this.drag) return;
    const { battlefield } = this.getDropContext(x, y);
    const { index, card, source, targeted } = this.drag;
    const aliveIndexes = this.game.state.enemies
      .map((enemy, enemyIndex) => (enemy.hp > 0 ? enemyIndex : -1))
      .filter((enemyIndex) => enemyIndex >= 0);

    if (!battlefield) {
      this.cleanupCardDrag();
      return;
    }

    const landingCard = source.cloneNode(true);
    landingCard.removeAttribute('data-drag-card');
    landingCard.removeAttribute('data-index');

    this.cleanupCardDrag();

    if (targeted && aliveIndexes.length > 1) {
      this.stagePendingTarget(index, card, source, landingCard, x, y);
      return;
    }

    const targetIndex = targeted && aliveIndexes.length === 1 ? aliveIndexes[0] : null;
    this.playCardWithDropAnimation(index, targetIndex, landingCard, x, y);
  }

  playCardWithDropAnimation(index, targetIndex, landingCard, x, y) {
    this.cardPlayLocked = true;
    landingCard.classList.add('card-drop-play');
    landingCard.style.left = `${x}px`;
    landingCard.style.top = `${y}px`;
    document.body.appendChild(landingCard);

    window.setTimeout(() => {
      landingCard.remove();
      this.cardPlayLocked = false;
      this.game.playCard(index, targetIndex);
    }, 140);
  }

  stagePendingTarget(index, card, source, landingCard, x, y) {
    const battlefield = this.root.querySelector('[data-battlefield]');
    if (!battlefield) return;

    const rect = battlefield.getBoundingClientRect();
    const left = Math.min(Math.max(x - rect.left, 95), Math.max(95, rect.width - 95));
    const top = Math.min(Math.max(y - rect.top, 115), Math.max(115, rect.height - 115));

    landingCard.classList.add('pending-target-card');
    landingCard.setAttribute('data-pending-target-card', '');
    landingCard.setAttribute('aria-label', `${card.name}, drag target arrow to an enemy`);
    landingCard.style.left = `${left}px`;
    landingCard.style.top = `${top}px`;
    battlefield.appendChild(landingCard);

    source.classList.add('combat-card--pending-source');
    battlefield.classList.add('is-targeting-card');
    const instruction = battlefield.querySelector('.drag-instruction');
    if (instruction) instruction.textContent = 'Drag the arrow from the played card to an enemy';

    this.pendingTarget = { index, card, source, element: landingCard };
  }

  beginTargetArrow(event, pendingCard) {
    if (!this.pendingTarget || this.targetArrow) return;
    event.preventDefault();

    const battlefield = this.root.querySelector('[data-battlefield]');
    if (!battlefield) return;
    const battlefieldRect = battlefield.getBoundingClientRect();
    const cardRect = pendingCard.getBoundingClientRect();
    const originX = cardRect.left - battlefieldRect.left + cardRect.width / 2;
    const originY = cardRect.top - battlefieldRect.top + cardRect.height / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('targeting-arrow-layer');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <marker id="deckrush-target-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z"></path>
        </marker>
      </defs>
      <line x1="${originX}" y1="${originY}" x2="${originX}" y2="${originY}" marker-end="url(#deckrush-target-arrow)"></line>
    `;
    battlefield.appendChild(svg);

    this.targetArrow = {
      pointerId: event.pointerId,
      battlefield,
      svg,
      line: svg.querySelector('line'),
    };
    document.body.classList.add('is-targeting-enemy');
    this.updateTargetArrow(event.clientX, event.clientY);

    this.onTargetPointerMove = (moveEvent) => {
      if (!this.targetArrow || moveEvent.pointerId !== this.targetArrow.pointerId) return;
      moveEvent.preventDefault();
      this.updateTargetArrow(moveEvent.clientX, moveEvent.clientY);
    };
    this.onTargetPointerUp = (upEvent) => {
      if (!this.targetArrow || upEvent.pointerId !== this.targetArrow.pointerId) return;
      upEvent.preventDefault();
      this.finishTargetArrow(upEvent.clientX, upEvent.clientY);
    };

    document.addEventListener('pointermove', this.onTargetPointerMove, { passive: false });
    document.addEventListener('pointerup', this.onTargetPointerUp, { passive: false });
    document.addEventListener('pointercancel', this.onTargetPointerUp, { passive: false });
  }

  updateTargetArrow(x, y) {
    if (!this.targetArrow) return;
    const rect = this.targetArrow.battlefield.getBoundingClientRect();
    this.targetArrow.line?.setAttribute('x2', String(x - rect.left));
    this.targetArrow.line?.setAttribute('y2', String(y - rect.top));

    const { enemyEl } = this.getDropContext(x, y);
    this.root.querySelectorAll('[data-enemy-index]').forEach((enemy) => enemy.classList.remove('is-drop-target'));
    if (enemyEl) enemyEl.classList.add('is-drop-target');
  }

  finishTargetArrow(x, y) {
    if (!this.targetArrow || !this.pendingTarget) return;
    const { enemyEl } = this.getDropContext(x, y);
    const targetIndex = enemyEl ? Number(enemyEl.dataset.enemyIndex) : null;
    const valid = Number.isInteger(targetIndex) && this.game.state.enemies[targetIndex]?.hp > 0;

    this.cleanupTargetArrow();
    if (!valid) return;

    const { index, element, source } = this.pendingTarget;
    element.classList.add('is-resolved');
    source?.classList.remove('combat-card--pending-source');
    this.pendingTarget = null;
    this.cardPlayLocked = true;

    window.setTimeout(() => {
      element.remove();
      this.cardPlayLocked = false;
      this.game.playCard(index, targetIndex);
    }, 100);
  }

  cleanupTargetArrow() {
    this.targetArrow?.svg?.remove();
    this.root.querySelectorAll('[data-enemy-index]').forEach((enemy) => enemy.classList.remove('is-drop-target'));
    document.body.classList.remove('is-targeting-enemy');

    if (this.onTargetPointerMove) document.removeEventListener('pointermove', this.onTargetPointerMove);
    if (this.onTargetPointerUp) {
      document.removeEventListener('pointerup', this.onTargetPointerUp);
      document.removeEventListener('pointercancel', this.onTargetPointerUp);
    }

    this.targetArrow = null;
    this.onTargetPointerMove = null;
    this.onTargetPointerUp = null;
  }

  cancelPendingTarget() {
    this.cleanupTargetArrow();
    if (!this.pendingTarget) return;

    this.pendingTarget.source?.classList.remove('combat-card--pending-source');
    this.pendingTarget.element?.remove();
    const battlefield = this.root.querySelector('[data-battlefield]');
    battlefield?.classList.remove('is-targeting-card');

    const instruction = battlefield?.querySelector('.drag-instruction');
    if (instruction) {
      const aliveEnemies = this.game.getAliveEnemies();
      instruction.textContent = aliveEnemies.length > 1
        ? 'Drop a card on the battlefield, then aim at an enemy'
        : 'Drag a card onto the battlefield';
    }

    this.pendingTarget = null;
  }

  cancelCardDrag() {
    this.cleanupCardDrag();
  }

  cleanupCardDrag() {
    if (!this.drag) return;
    this.drag.source?.classList.remove('combat-card--source');
    this.drag.ghost?.remove();
    this.root.querySelector('[data-battlefield]')?.classList.remove('is-drag-active', 'is-valid-drop');
    document.body.classList.remove('is-dragging-card');

    if (this.onPointerMove) document.removeEventListener('pointermove', this.onPointerMove);
    if (this.onPointerUp) {
      document.removeEventListener('pointerup', this.onPointerUp);
      document.removeEventListener('pointercancel', this.onPointerUp);
    }

    this.drag = null;
    this.onPointerMove = null;
    this.onPointerUp = null;
  }

  render(state) {
    if (this.drag) this.cleanupCardDrag();
    if (this.pendingTarget) this.cancelPendingTarget();
    this.animations.reset();

    if (state.phase === 'menu') {
      this.game.consumeAnimationEvents?.();
      this.renderMenu();
      return;
    }

    const hud = this.hud(state);
    if (state.phase === 'route') this.root.innerHTML = hud + this.route(state);
    if (state.phase === 'combat') this.root.innerHTML = hud + this.combat(state);
    if (state.phase === 'reward') this.root.innerHTML = hud + this.reward(state);
    if (state.phase === 'gameover') this.root.innerHTML = this.gameOver(state);

    const events = this.game.consumeAnimationEvents?.() || [];
    if (state.phase === 'combat') {
      requestAnimationFrame(() => {
        this.animations.bindCombatSprites();
        this.animations.playEvents(events);
      });
    }
  }

  renderMenu() {
    const save = loadSave();
    const weekly = weeklySeed();
    const weeklyBest = save.weeklyBest[weekly.label] || 0;
    const character = getCharacter(this.selectedCharacterId);

    this.root.innerHTML = `
      <section class="fantasy-menu">
        <div class="fantasy-menu__veil"></div>

        <header class="fantasy-menu__masthead">
          <div class="fantasy-menu__identity" aria-label="Deckrush">
            <img class="fantasy-menu__logo" src="./assets/logo/logo.png?v=20260924-assets2" alt="" draggable="false" onerror="this.hidden=true">
          </div>
        </header>

        <div class="fantasy-menu__body">
          <nav class="fantasy-menu__nav" aria-label="Main menu">
            <button class="fantasy-menu__action" data-action="open-handbook">
              <span><strong>Handbook</strong><small>Rules & cards</small></span>
            </button>
            <button class="fantasy-menu__action" data-action="settings">
              <span><strong>Settings</strong><small>Coming later</small></span>
            </button>
          </nav>

          <section class="fantasy-menu__hero-stage" aria-label="Selected hero">
            <button class="fantasy-menu__hero-card fantasy-menu__hero-card--${character.id}" data-action="open-character-select" aria-label="Change selected hero">
              <div class="fantasy-menu__halo" aria-hidden="true"></div>
              <div class="fantasy-menu__portrait">
                ${artMarkup(`./assets/characters/${character.id}/idle/1.png`, character.name)}
              </div>
              <div class="fantasy-menu__hero-info">
                <span>${character.archetype}</span>
                <strong>${character.name}</strong>
                <p>${character.description}</p>
                <div class="fantasy-menu__hero-stats">
                  <span><b>${character.maxHp}</b> HP</span>
                  <span><b>${character.startingDeck.length}</b> Starting Cards</span>
                </div>
              </div>
            </button>
            <button class="fantasy-menu__begin" data-action="start-normal">Begin Run — ${character.name}</button>
          </section>

          <aside class="fantasy-menu__brief" aria-label="Records">
            <div class="fantasy-menu__brief-block fantasy-menu__brief-block--records">
              <span>Records</span>
              <div class="fantasy-menu__seed">
                <small>Week ${weekly.week} Seed</small>
                <strong>${weekly.seed}</strong>
                <em>Same seed all week</em>
              </div>
              <div class="fantasy-menu__records">
                <div><small>Weekly Best</small><b>${fmt.format(weeklyBest)}</b></div>
                <div><small>All-Time Best</small><b>${fmt.format(save.bestScore)}</b></div>
                <div><small>Runs</small><b>${save.stats.runs}</b></div>
              </div>
            </div>
          </aside>
        </div>

      </section>
      ${this.characterSelectOpen ? this.characterSelector() : ''}
      ${this.handbookOpen ? this.handbook() : ''}`;
  }

  characterSelector() {
    return `
      <div class="character-picker-backdrop" data-action="close-character-select">
        <section class="character-picker" role="dialog" aria-modal="true" aria-label="Choose hero">
          <header class="character-picker__header">
            <div>
              <p class="eyebrow">CHOOSE YOUR WANDERER</p>
              <h2>Select Hero</h2>
              <p>Each hero begins with a different deck and rewards a different style of play.</p>
            </div>
            <button class="character-picker__close" data-action="close-character-select" aria-label="Close hero selection">×</button>
          </header>

          <div class="character-picker__grid">
            ${Object.values(CHARACTERS).map((character) => {
              const selected = character.id === this.selectedCharacterId;
              return `
                <button class="character-choice character-choice--${character.id} ${selected ? 'is-selected' : ''}" data-action="choose-character" data-character="${character.id}" aria-pressed="${selected}">
                  <span class="character-choice__state">${selected ? '✓ CHOSEN' : 'CHOOSE'}</span>
                  <div class="character-choice__portrait">
                    ${artMarkup(`./assets/characters/${character.id}/idle/1.png`, character.name)}
                  </div>
                  <div class="character-choice__content">
                    <span class="eyebrow">${character.archetype.toUpperCase()}</span>
                    <strong>${character.name}</strong>
                    <p>${character.description}</p>
                    <div class="character-choice__stats">
                      <span><b>${character.maxHp}</b> HP</span>
                      <span><b>${character.startingDeck.length}</b> Cards</span>
                    </div>
                  </div>
                </button>`;
            }).join('')}
          </div>
        </section>
      </div>`;
  }

  handbook() {
    const cards = Object.values(CARD_LIBRARY);
    return `
      <div class="handbook-backdrop" data-action="close-handbook">
        <section class="handbook" role="dialog" aria-modal="true" aria-label="Deckrush Handbook">
          <header class="handbook__header">
            <div><p class="eyebrow">REFERENCE</p><h2>Handbook</h2></div>
            <button class="handbook__close" data-action="close-handbook" aria-label="Close handbook">×</button>
          </header>
          <nav class="handbook__tabs" aria-label="Handbook tabs">
            <button class="${this.handbookTab === 'rules' ? 'is-active' : ''}" data-action="handbook-tab" data-tab="rules">How to Play</button>
            <button class="${this.handbookTab === 'cards' ? 'is-active' : ''}" data-action="handbook-tab" data-tab="cards">Cards <span>${cards.length}</span></button>
          </nav>
          <div class="handbook__content">
            ${this.handbookTab === 'cards' ? this.handbookCards(cards) : this.handbookRules()}
          </div>
        </section>
      </div>`;
  }

  handbookRules() {
    return `
      <div class="handbook-rules">
        <section class="rule-hero">
          <p class="eyebrow">THE GOAL</p>
          <h3>Score as high as you can before you die.</h3>
          <p>Runs are endless. Every victory makes later fights tougher, bosses return every 8 fights, and some encounters contain multiple enemies.</p>
        </section>
        <div class="rule-grid">
          <article><span class="rule-number">01</span><h3>Choose Heat</h3><p>Before every fight, choose Heat 0–3. Higher Heat gives enemies more HP and damage, but increases every point you earn.</p></article>
          <article><span class="rule-number">02</span><h3>Drag Cards</h3><p>Draw 5 cards and start with 3 Energy. Drag a card from your hand onto the battlefield to play it.</p></article>
          <article><span class="rule-number">03</span><h3>Choose Targets</h3><p>When several enemies are alive, drop a targeted card onto the battlefield, then drag its aiming arrow onto the enemy you want to hit.</p></article>
          <article><span class="rule-number">04</span><h3>Build Score</h3><p>Damage, kills, overkill, perfect fights and score cards award points. Combo, Multiplier and Heat make those points worth more.</p></article>
          <article><span class="rule-number">05</span><h3>Avoid Damage</h3><p>Enemy damage costs HP, reduces Combo by the HP damage taken after Block, and lowers your Multiplier. Your accumulated score is never lost.</p></article>
          <article><span class="rule-number">06</span><h3>Keep Climbing</h3><p>Choose a card after each victory, face recurring bosses, and keep going until your HP reaches zero.</p></article>
        </div>
        <div class="mechanic-grid">
          <article class="mechanic-card"><strong>Combo</strong><p>Built by many attacks. Higher Combo increases score value. HP damage after Block reduces Combo by the same amount.</p></article>
          <article class="mechanic-card"><strong>Multiplier</strong><p>Raised by special cards and preserved across fights. Taking damage reduces it.</p></article>
          <article class="mechanic-card"><strong>Block</strong><p>Absorbs attacks during the enemy turn. Remaining Block clears after all enemies have acted.</p></article>
          <article class="mechanic-card"><strong>Poison</strong><p>Ticks on every poisoned enemy before enemies attack, then loses 1 stack on surviving targets.</p></article>
          <article class="mechanic-card"><strong>Bosses</strong><p>Every 8th fight is a boss. Beat it to claim another reward and continue the same run.</p></article>
          <article class="mechanic-card"><strong>Weekly Run</strong><p>The Weekly Run uses a deterministic seed that changes every Monday, making encounters repeatable for score comparison.</p></article>
        </div>
        <div class="handbook-characters">
          ${Object.values(CHARACTERS).map((character) => `
            <article class="handbook-character handbook-character--${character.id}">
              <div><p class="eyebrow">${character.archetype.toUpperCase()}</p><h3>${character.name} · ${character.maxHp} HP</h3><p>${character.description}</p></div>
            </article>`).join('')}
        </div>
      </div>`;
  }

  handbookCards(cards) {
    return `
      <div class="handbook-card-view">
        <div class="handbook-card-summary">
          <div><span>Total Cards</span><strong>${cards.length}</strong></div>
          <div><span>Common</span><strong>${cards.filter((card) => card.rarity === 'common').length}</strong></div>
          <div><span>Uncommon</span><strong>${cards.filter((card) => card.rarity === 'uncommon').length}</strong></div>
          <div><span>Rare</span><strong>${cards.filter((card) => card.rarity === 'rare').length}</strong></div>
        </div>
        <div class="handbook-card-grid">
          ${cards.slice().sort((a, b) => a.name.localeCompare(b.name)).map((card) => `
            <article class="handbook-card handbook-card--${card.rarity}">
                      <div class="handbook-card__top"><span class="card__cost">${card.cost}</span><span class="card__rarity">${card.rarity}</span></div>
                      <div class="handbook-card__art" aria-hidden="true">${cardArtMarkup(card)}</div>
              <h3>${card.name}</h3>
              <p>${card.description}</p>
              <div class="handbook-card__tags">${card.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
            </article>`).join('')}
        </div>
      </div>`;
  }

  hud(s) {
    return `
      <header class="hud">
        <div class="hud__brand" aria-label="Deckrush"><img class="hud__logo" src="./assets/logo/logo.png?v=20260924-assets2" alt="" draggable="false" onerror="this.hidden=true"></div>
        <div class="hud__stat"><span>Score</span><strong>${fmt.format(s.score.total)}</strong><small>keep pushing</small></div>
        <div class="hud__stat"><span>Combo</span><strong>x${s.score.combo}</strong><small>best ${s.score.maxCombo}</small></div>
        <div class="hud__stat"><span>Multiplier</span><strong>x${s.score.multiplier.toFixed(2)}</strong><small>Heat ${s.selectedHeat}</small></div>
        <div class="hud__stat hud__timer"><span>Elapsed</span><strong data-timer>${formatTime(this.game.getElapsedMs())}</strong><small>fight ${s.encounterIndex + 1}</small></div>
      </header>`;
  }

  route(s) {
    const fightNumber = s.encounterIndex + 1;
    const bossFight = fightNumber % 8 === 0;
    const heat = Math.max(0, Math.min(3, Number(s.selectedHeat) || 0));
    const heatPct = (heat / 3) * 100;
    return `
      <section class="shell route">
        <div class="route__content">
          <p class="eyebrow">${bossFight ? `BOSS FIGHT ${fightNumber}` : `FIGHT ${fightNumber}`}</p>
          <h2>${bossFight ? 'The Auditor is waiting.' : 'How greedy are you feeling?'}</h2>
          <p>Raise the Heat for tougher enemies and a stronger score multiplier.</p>

          <div class="heat-selector" data-heat="${heat}" style="--heat-level:${heat}; --heat-pct:${heatPct}%;">
            <div class="heat-flames" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>

            <div class="heat-readout">
              <span>HEAT</span>
              <strong data-heat-value>${heat}</strong>
              <em data-heat-score>x${(1 + heat * 0.25).toFixed(2)} score</em>
            </div>

            <label class="heat-slider-wrap">
              <span class="heat-slider-label">Choose intensity</span>
              <input
                class="heat-slider"
                type="range"
                min="0"
                max="3"
                step="1"
                value="${heat}"
                data-heat-slider
                aria-label="Heat level"
                aria-valuetext="Heat ${heat}"
              >
              <span class="heat-slider-ticks" aria-hidden="true">
                <b>0</b><b>1</b><b>2</b><b>3</b>
              </span>
            </label>

            <div class="heat-effects" aria-live="polite">
              <span data-heat-hp>+${heat * 16}% enemy HP</span>
              <span data-heat-damage>+${heat} enemy damage</span>
            </div>

            <button class="button button--primary heat-confirm" data-action="heat" data-heat-confirm>
              Enter Fight — Heat ${heat}
            </button>
          </div>
        </div>
      </section>`;
  }

  enemyMarkup(enemy, index) {
    if (enemy.hp <= 0) {
      return `
        <article class="enemy-unit enemy-unit--dead ${enemy.elite ? 'enemy-unit--elite' : ''} ${enemy.boss ? 'enemy-unit--boss' : ''}" data-enemy-instance="${enemy.instanceId}" aria-label="${enemy.name}, defeated">
          <div class="enemy-sprite enemy-sprite--dead">
            ${artMarkup(`./assets/enemies/${enemy.id}/dead/1.png`, `${enemy.name} defeated`)}
          </div>
          <div class="enemy-name">${enemy.name}</div>
        </article>`;
    }

    const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    const intent = this.game.getEnemyIntent(enemy);
    const intentText = enemy.trait === 'burst' && enemy.turn + 1 === enemy.burstTurn ? `${intent} BURST` : String(intent);

    return `
      <article class="enemy-unit ${enemy.elite ? 'enemy-unit--elite' : ''} ${enemy.boss ? 'enemy-unit--boss' : ''}" data-enemy-index="${index}" data-enemy-instance="${enemy.instanceId}">
        <div class="enemy-intent" title="Next attack">
          <span>⚔</span><strong>${intentText}</strong>
        </div>
        <div class="enemy-sprite" data-enemy-sprite="${enemy.id}">
          ${animatedSpriteMarkup(`./assets/enemies/${enemy.id}/idle/1.png`, enemy.name)}
        </div>
        <div class="enemy-name">${enemy.name}</div>
        <div class="enemy-hp-row"><span>${Math.max(0, enemy.hp)} / ${enemy.maxHp}</span></div>
        <div class="enemy-hp-bar"><i style="width:${hpPct}%"></i></div>
        <div class="enemy-status-row">
          ${enemy.poison > 0 ? `<span class="status-pill status-pill--poison">☠ ${enemy.poison}</span>` : ''}
          ${enemy.strength > 0 ? `<span class="status-pill">↑ ${enemy.strength}</span>` : ''}
        </div>
      </article>`;
  }

  combat(s) {
    const character = getCharacter(s.characterId);
    const aliveEnemies = s.enemies.filter((enemy) => enemy.hp > 0);

    return `
      <section class="combat-screen">
        <div class="combat-stage" data-battlefield style="--battlefield-bg:url(./assets/backgrounds/battlefields/${s.fight.background || 1}.png)">
          <div class="combat-stage__overlay"></div>
          <div class="card-effect-layer" data-card-effect-layer aria-hidden="true"></div>

          <div class="player-side">
            <div class="player-actor">
              <div class="player-sprite player-sprite--${character.id}" data-character-sprite="${character.id}">
                ${animatedSpriteMarkup(`./assets/characters/${character.id}/idle/1.png`, character.name)}
              </div>
              <div class="player-hp-row"><span>${Math.max(0, s.player.hp)} / ${s.player.maxHp}</span></div>
              <div class="player-hp-bar"><i style="width:${Math.max(0, (s.player.hp / s.player.maxHp) * 100)}%"></i></div>
              <div class="player-block-row">◆ ${s.player.block} Block</div>
            </div>
          </div>

          <div class="enemy-side enemy-side--${aliveEnemies.length}">
            ${s.enemies.map((enemy, index) => this.enemyMarkup(enemy, index)).join('')}
          </div>

          <div class="drag-instruction">
            ${aliveEnemies.length > 1 ? 'Drop a card on the battlefield, then aim at an enemy' : 'Drag a card onto the battlefield'}
          </div>
        </div>

        <div class="combat-tray">
          <div class="pile pile--draw"><strong>${s.drawPile.length}</strong><span>Draw</span></div>
          <div class="energy-orb"><strong>${s.player.energy}</strong><span>Energy</span></div>

          <div class="combat-hand" aria-label="Your hand">
            ${s.hand.map((id, index) => combatCardMarkup(getCard(id), index, s.player.energy, s.hand.length)).join('')}
          </div>

          <div class="pile pile--discard"><strong>${s.discardPile.length}</strong><span>Discard</span></div>
          <button class="end-turn-button" data-action="end-turn">End Turn</button>
        </div>
      </section>`;
  }

  reward(s) {
    return `
      <section class="shell reward">
        <p class="eyebrow">ENCOUNTER CLEARED</p>
        <h2>Choose one card.</h2>
        <p>Your deck currently has ${s.deck.length} cards. Keeping it lean makes your best cards appear more often.</p>
        <div class="reward-grid">
          ${s.rewardOptions.map((id) => cardMarkup(getCard(id), null, 'reward')).join('')}
        </div>
        <button class="button" data-action="skip-reward">Skip card · +250 score</button>
        ${this.log(s)}
      </section>`;
  }

  gameOver(s) {
    const r = s.result;
    const newBest = r.score >= s.save.bestScore && r.score > 0;
    return `
      <section class="result-screen">
        <div class="result-screen__inner">
          <p class="result-screen__eyebrow">RUN OVER</p>
          <div class="result-screen__score-block">
            <span>Final Score</span>
            <strong>${fmt.format(r.score)}</strong>
            <p>${r.reason}${newBest ? ' · PERSONAL BEST' : ''}</p>
          </div>

          <div class="result-grid">
            <div><span>Best Combo</span><strong>x${r.maxCombo}</strong></div>
            <div><span>Best Multiplier</span><strong>x${r.maxMultiplier.toFixed(2)}</strong></div>
            <div><span>Biggest Hit</span><strong>${r.biggestHit}</strong></div>
            <div><span>Overkill</span><strong>${r.overkill}</strong></div>
            <div><span>Perfect Fights</span><strong>${r.fightsPerfect}</strong></div>
            <div><span>Damage Taken</span><strong>${r.damageTaken}</strong></div>
            <div><span>Cards Played</span><strong>${r.cardsPlayed}</strong></div>
            <div><span>Fights Cleared</span><strong>${r.fightsCleared}</strong></div>
            <div><span>Time</span><strong>${formatTime(r.elapsedMs)}</strong></div>
          </div>

          <div class="result-screen__actions">
            <button class="button button--primary result-screen__retry" data-action="${s.mode === 'weekly' ? 'start-weekly' : 'start-normal'}" data-character="${s.characterId}">Run It Back</button>
            <button class="result-screen__menu" data-action="menu">Main Menu</button>
          </div>
        </div>
      </section>`;
  }

  log(s) {
    return `<aside class="log">${(s.log || []).map((line) => `<p>${line}</p>`).join('')}</aside>`;
  }

  updateTimer() {
    const el = this.root.querySelector('[data-timer]');
    if (el) el.textContent = formatTime(this.game.getElapsedMs());
  }
}
