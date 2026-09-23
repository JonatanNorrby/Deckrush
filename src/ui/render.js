import { CARD_LIBRARY, getCard } from '../data/cards.js';
import { loadSave } from '../core/storage.js';
import { dailySeed } from '../core/rng.js';
import { CHARACTERS, getCharacter } from '../data/characters.js';

const fmt = new Intl.NumberFormat('en-US');

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function cardMarkup(card, index = null, action = null) {
  const attrs = action ? `data-action="${action}" ${index !== null ? `data-index="${index}"` : ''} data-card="${card.id}"` : '';
  const rarity = card.rarity || 'common';
  return `
    <button class="card card--${rarity}" ${attrs} ${action ? '' : 'disabled'}>
      <div class="card__top"><span class="card__cost">${card.cost}</span><span class="card__rarity">${rarity}</span></div>
      <div class="card__art" aria-hidden="true"><span>${card.name.slice(0, 2).toUpperCase()}</span></div>
      <strong class="card__name">${card.name}</strong>
      <p>${card.description}</p>
    </button>`;
}

export class Renderer {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.handbookOpen = false;
    this.handbookTab = 'rules';
    this.root.addEventListener('click', (event) => this.handleClick(event));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.handbookOpen) {
        this.handbookOpen = false;
        this.renderMenu();
      }
    });
  }

  handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'start-normal') this.game.startRun('normal', target.dataset.character);
    if (action === 'start-daily') this.game.startRun('daily', target.dataset.character);
    if (action === 'heat') this.game.chooseHeat(Number(target.dataset.heat));
    if (action === 'play-card') this.game.playCard(Number(target.dataset.index));
    if (action === 'end-turn') this.game.endTurn();
    if (action === 'reward') this.game.chooseReward(target.dataset.card);
    if (action === 'skip-reward') this.game.skipReward();
    if (action === 'menu') this.game.backToMenu();
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

  render(state) {
    if (state.phase === 'menu') return this.renderMenu();
    const hud = this.hud(state);
    if (state.phase === 'route') this.root.innerHTML = hud + this.route(state);
    if (state.phase === 'combat') this.root.innerHTML = hud + this.combat(state);
    if (state.phase === 'reward') this.root.innerHTML = hud + this.reward(state);
    if (state.phase === 'gameover') this.root.innerHTML = this.gameOver(state);
  }

  renderMenu() {
    const save = loadSave();
    const daily = dailySeed();
    const dailyBest = save.dailyBest[daily.label] || 0;
    this.root.innerHTML = `
      <section class="menu shell menu--wide">
        <div class="logo-mark">DR</div>
        <p class="eyebrow">FAST SCORE ATTACK DECKBUILDER</p>
        <h1>DECKRUSH</h1>
        <p class="menu__pitch">Choose a character, build around their specialty, and push the run until you die.</p>
        <div class="menu__utility">
          <button class="button handbook-button" data-action="open-handbook">Handbook</button>
        </div>

        <div class="character-select">
          ${Object.values(CHARACTERS).map((character) => `
            <article class="character-card character-card--${character.id}">
              <div class="character-card__art" aria-hidden="true"><span>${character.name.slice(0, 2).toUpperCase()}</span></div>
              <div class="character-card__body">
                <p class="eyebrow">${character.archetype.toUpperCase()}</p>
                <h2>${character.name}</h2>
                <p>${character.description}</p>
                <div class="character-card__stats">
                  <span><strong>${character.maxHp}</strong> HP</span>
                  <span><strong>${character.startingDeck.length}</strong> cards</span>
                </div>
                <div class="character-card__actions">
                  <button class="button button--primary" data-action="start-normal" data-character="${character.id}">Start Run</button>
                  <button class="button" data-action="start-daily" data-character="${character.id}">Daily <small>${daily.label}</small></button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>

        <div class="records">
          <div><span>Personal Best</span><strong>${fmt.format(save.bestScore)}</strong></div>
          <div><span>Daily Best</span><strong>${fmt.format(dailyBest)}</strong></div>
          <div><span>Runs</span><strong>${save.stats.runs}</strong></div>
        </div>
        <p class="hint">Taking damage breaks your Combo and reduces your Multiplier, but your score is always safe.</p>
      </section>
      ${this.handbookOpen ? this.handbook() : ''}`;
  }

  handbook() {
    const cards = Object.values(CARD_LIBRARY);
    return `
      <div class="handbook-backdrop" data-action="close-handbook">
        <section class="handbook" role="dialog" aria-modal="true" aria-label="Deckrush Handbook" onclick="event.stopPropagation()">
          <header class="handbook__header">
            <div>
              <p class="eyebrow">REFERENCE</p>
              <h2>Handbook</h2>
            </div>
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
          <p>Runs are endless. Every victory makes later fights tougher, bosses return every 8 fights, and your final score is recorded when your HP reaches zero.</p>
        </section>

        <div class="rule-grid">
          <article>
            <span class="rule-number">01</span>
            <h3>Choose Heat</h3>
            <p>Before every fight, choose Heat 0–3. Higher Heat gives the enemy more HP and damage, but increases every point you earn.</p>
          </article>
          <article>
            <span class="rule-number">02</span>
            <h3>Play Your Hand</h3>
            <p>You normally draw 5 cards and start each turn with 3 Energy. Play as many cards as you can afford, then end your turn.</p>
          </article>
          <article>
            <span class="rule-number">03</span>
            <h3>Build Score</h3>
            <p>Damage, kills, overkill, perfect fights and score cards all award points. Combo, Multiplier and Heat make those points worth more.</p>
          </article>
          <article>
            <span class="rule-number">04</span>
            <h3>Avoid Damage</h3>
            <p>Enemy damage costs HP, breaks your Combo and lowers your Multiplier. Your accumulated score is never lost.</p>
          </article>
          <article>
            <span class="rule-number">05</span>
            <h3>Grow Your Deck</h3>
            <p>After a victory, choose 1 of 3 character-specific cards. You can skip the reward instead for +250 score.</p>
          </article>
          <article>
            <span class="rule-number">06</span>
            <h3>Keep Climbing</h3>
            <p>Enemies scale as the fight count rises. There is no finish line—survive, build a stronger deck, and keep pushing your score.</p>
          </article>
        </div>

        <div class="mechanic-grid">
          <article class="mechanic-card">
            <strong>Combo</strong>
            <p>Built by many attack cards. Higher Combo increases score value. Taking enemy damage resets it.</p>
          </article>
          <article class="mechanic-card">
            <strong>Multiplier</strong>
            <p>Raised by special cards and preserved across fights. Taking damage reduces it, so clean play compounds into much bigger scores.</p>
          </article>
          <article class="mechanic-card">
            <strong>Block</strong>
            <p>Absorbs enemy attack damage for the current turn. Remaining Block is cleared after the enemy attacks.</p>
          </article>
          <article class="mechanic-card">
            <strong>Poison</strong>
            <p>Ticks at the end of your turn before the enemy attacks, then loses 1 stack. Viper can stack and multiply it rapidly.</p>
          </article>
          <article class="mechanic-card">
            <strong>Bosses</strong>
            <p>Every 8th fight is a boss encounter. Beat it to take another reward and continue the same run.</p>
          </article>
          <article class="mechanic-card">
            <strong>Daily Run</strong>
            <p>The Daily uses a deterministic seed for that date, giving you a repeatable run for comparing scores.</p>
          </article>
        </div>

        <div class="handbook-characters">
          ${Object.values(CHARACTERS).map((character) => `
            <article class="handbook-character handbook-character--${character.id}">
              <div class="handbook-character__badge">${character.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <p class="eyebrow">${character.archetype.toUpperCase()}</p>
                <h3>${character.name} · ${character.maxHp} HP</h3>
                <p>${character.description}</p>
              </div>
            </article>
          `).join('')}
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
          ${cards
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((card) => `
              <article class="handbook-card handbook-card--${card.rarity}">
                <div class="handbook-card__top">
                  <span class="card__cost">${card.cost}</span>
                  <span class="card__rarity">${card.rarity}</span>
                </div>
                <div class="handbook-card__art" aria-hidden="true">${card.name.slice(0, 2).toUpperCase()}</div>
                <h3>${card.name}</h3>
                <p>${card.description}</p>
                <div class="handbook-card__tags">${card.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
              </article>
            `).join('')}
        </div>
      </div>`;
  }

  hud(s) {
    return `
      <header class="hud">
        <div class="hud__brand">DECKRUSH</div>
        <div class="hud__stat"><span>Score</span><strong>${fmt.format(s.score.total)}</strong><small>keep pushing</small></div>
        <div class="hud__stat"><span>Combo</span><strong>x${s.score.combo}</strong><small>best ${s.score.maxCombo}</small></div>
        <div class="hud__stat"><span>Multiplier</span><strong>x${s.score.multiplier.toFixed(2)}</strong><small>Heat ${s.selectedHeat}</small></div>
        <div class="hud__stat"><span>HP</span><strong>${Math.max(0, s.player.hp)}/${s.player.maxHp}</strong><small>${s.player.block} block</small></div>
        <div class="hud__stat hud__timer"><span>Elapsed</span><strong data-timer>${formatTime(this.game.getElapsedMs())}</strong><small>fight ${s.encounterIndex + 1}</small></div>
      </header>`;
  }

  route(s) {
    const fightNumber = s.encounterIndex + 1;
    const bossFight = fightNumber % 8 === 0;
    return `
      <section class="shell route">
        <p class="eyebrow">${bossFight ? `BOSS FIGHT ${fightNumber}` : `FIGHT ${fightNumber}`}</p>
        <h2>${bossFight ? 'The Auditor is waiting.' : 'How greedy are you feeling?'}</h2>
        <p>Higher Heat boosts enemy HP and damage, but multiplies every point you earn.</p>
        <div class="heat-grid">
          ${[0, 1, 2, 3].map((heat) => `
            <button class="heat-card" data-action="heat" data-heat="${heat}">
              <span>HEAT ${heat}</span>
              <strong>x${(1 + heat * 0.25).toFixed(2)} SCORE</strong>
              <small>+${heat * 16}% enemy HP · +${heat} damage</small>
            </button>`).join('')}
        </div>
        ${this.log(s)}
      </section>`;
  }

  combat(s) {
    const e = s.enemy;
    const character = getCharacter(s.characterId);
    const hpPct = Math.max(0, (e.hp / e.maxHp) * 100);
    const intent = e.baseDamage + e.strength + s.selectedHeat + e.scaling * Math.max(0, e.turn);
    return `
      <section class="combat shell combat--battle">
        <div class="battlefield">
          <div class="fighter fighter--player">
            <div class="player-health">
              <span>HP</span>
              <strong>${Math.max(0, s.player.hp)}<small>/${s.player.maxHp}</small></strong>
              <em>${s.player.block} Block</em>
            </div>
            <div class="character-art character-art--${character.id}" aria-label="${character.name}"><span>${character.name.slice(0, 2).toUpperCase()}</span></div>
            <div class="fighter-caption">
              <p class="eyebrow">${character.archetype.toUpperCase()}</p>
              <h2>${character.name}</h2>
            </div>
          </div>

          <div class="battle-center">
            <span>VS</span>
            <div class="intent">Next attack <strong>${intent}${e.trait === 'burst' && e.turn + 1 === e.burstTurn ? ' + BURST' : ''}</strong></div>
          </div>

          <div class="fighter fighter--enemy ${e.elite ? 'fighter--elite' : ''} ${e.boss ? 'fighter--boss' : ''}">
            <div class="fighter-caption fighter-caption--enemy">
              <p class="eyebrow">${e.boss ? 'BOSS' : e.elite ? 'ELITE' : 'ENEMY'}</p>
              <h2>${e.name}</h2>
              <p>${e.tagline}</p>
              ${e.poison > 0 ? `<div class="status-pill status-pill--poison">☠ ${e.poison} Poison</div>` : ''}
            </div>
            <div class="enemy-art"><span>${e.name.slice(0, 2).toUpperCase()}</span></div>
            <div class="enemy-health">
              <strong>${Math.max(0, e.hp)} / ${e.maxHp} HP</strong>
              <div class="bar"><i style="width:${hpPct}%"></i></div>
            </div>
          </div>
        </div>

        <div class="combat-meta">
          <div><span>Energy</span><strong>${s.player.energy}/${s.player.maxEnergy}</strong></div>
          <div><span>Draw</span><strong>${s.drawPile.length}</strong></div>
          <div><span>Discard</span><strong>${s.discardPile.length}</strong></div>
          <button class="button button--danger" data-action="end-turn">End Turn →</button>
        </div>

        <div class="hand hand--bottom">
          ${s.hand.map((id, index) => cardMarkup(getCard(id), index, 'play-card')).join('')}
        </div>
        ${this.log(s)}
      </section>`;
  }

  reward(s) {
    return `
      <section class="shell reward">
        <p class="eyebrow">TARGET DOWN</p>
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
      <section class="shell result">
        <p class="eyebrow">RUN OVER</p>
        <h1>${fmt.format(r.score)}</h1>
        <p class="result__reason">${r.reason}${newBest ? ' · PERSONAL BEST' : ''}</p>
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
        <div class="menu__buttons">
          <button class="button button--primary" data-action="${s.mode === 'daily' ? 'start-daily' : 'start-normal'}" data-character="${s.characterId}">Run It Back</button>
          <button class="button" data-action="menu">Main Menu</button>
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
