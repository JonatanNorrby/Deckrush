import { getCard } from '../data/cards.js';
import { loadSave } from '../core/storage.js';
import { dailySeed } from '../core/rng.js';

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
    this.root.addEventListener('click', (event) => this.handleClick(event));
  }

  handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'start-normal') this.game.startRun('normal');
    if (action === 'start-daily') this.game.startRun('daily');
    if (action === 'heat') this.game.chooseHeat(Number(target.dataset.heat));
    if (action === 'play-card') this.game.playCard(Number(target.dataset.index));
    if (action === 'end-turn') this.game.endTurn();
    if (action === 'reward') this.game.chooseReward(target.dataset.card);
    if (action === 'skip-reward') this.game.skipReward();
    if (action === 'menu') this.game.backToMenu();
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
      <section class="menu shell">
        <div class="logo-mark">DR</div>
        <p class="eyebrow">FAST SCORE ATTACK DECKBUILDER</p>
        <h1>DECKRUSH</h1>
        <p class="menu__pitch">Build a vicious little deck. Push the multiplier. Bank your score before the run punches back.</p>
        <div class="menu__buttons">
          <button class="button button--primary" data-action="start-normal">Start Run</button>
          <button class="button" data-action="start-daily">Daily Seed <small>${daily.label}</small></button>
        </div>
        <div class="records">
          <div><span>Personal Best</span><strong>${fmt.format(save.bestScore)}</strong></div>
          <div><span>Daily Best</span><strong>${fmt.format(dailyBest)}</strong></div>
          <div><span>Runs</span><strong>${save.stats.runs}</strong></div>
        </div>
        <p class="hint">Taking damage burns 25% of unbanked score and breaks your combo.</p>
      </section>`;
  }

  hud(s) {
    const total = s.score.banked + s.score.pending;
    return `
      <header class="hud">
        <div class="hud__brand">DECKRUSH</div>
        <div class="hud__stat"><span>Score</span><strong>${fmt.format(total)}</strong><small>+${fmt.format(s.score.pending)} exposed</small></div>
        <div class="hud__stat"><span>Combo</span><strong>x${s.score.combo}</strong><small>best ${s.score.maxCombo}</small></div>
        <div class="hud__stat"><span>Multiplier</span><strong>x${s.score.multiplier.toFixed(2)}</strong><small>Heat ${s.selectedHeat}</small></div>
        <div class="hud__stat"><span>HP</span><strong>${Math.max(0, s.player.hp)}/${s.player.maxHp}</strong><small>${s.player.block} block</small></div>
        <div class="hud__stat hud__timer"><span>Elapsed</span><strong data-timer>${formatTime(this.game.getElapsedMs())}</strong><small>fight ${Math.min(s.encounterIndex + 1, 8)}/8</small></div>
      </header>`;
  }

  route(s) {
    const final = s.encounterIndex === 7;
    return `
      <section class="shell route">
        <p class="eyebrow">${final ? 'FINAL ENCOUNTER' : `ENCOUNTER ${s.encounterIndex + 1} OF 8`}</p>
        <h2>${final ? 'The Auditor is waiting.' : 'How greedy are you feeling?'}</h2>
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
    const hpPct = Math.max(0, (e.hp / e.maxHp) * 100);
    const intent = e.baseDamage + e.strength + s.selectedHeat + e.scaling * Math.max(0, e.turn);
    return `
      <section class="combat shell">
        <div class="enemy-panel ${e.elite ? 'enemy-panel--elite' : ''} ${e.boss ? 'enemy-panel--boss' : ''}">
          <div class="enemy-art"><span>${e.name.slice(0, 2).toUpperCase()}</span></div>
          <div class="enemy-info">
            <div class="enemy-title"><div><p class="eyebrow">${e.boss ? 'BOSS' : e.elite ? 'ELITE' : 'TARGET'}</p><h2>${e.name}</h2></div><strong>${Math.max(0, e.hp)} / ${e.maxHp} HP</strong></div>
            <div class="bar"><i style="width:${hpPct}%"></i></div>
            <p>${e.tagline}</p>
            <div class="intent">Next attack: <strong>${intent}${e.trait === 'burst' && e.turn + 1 === e.burstTurn ? ' + BURST' : ''}</strong></div>
          </div>
        </div>

        <div class="combat-meta">
          <div><span>Energy</span><strong>${s.player.energy}/${s.player.maxEnergy}</strong></div>
          <div><span>Draw</span><strong>${s.drawPile.length}</strong></div>
          <div><span>Discard</span><strong>${s.discardPile.length}</strong></div>
          <button class="button button--danger" data-action="end-turn">End Turn →</button>
        </div>

        <div class="hand">
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
        <p class="eyebrow">${r.victory ? 'RUN CLEARED' : 'RUN OVER'}</p>
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
          <div><span>Time</span><strong>${formatTime(r.elapsedMs)}</strong></div>
        </div>
        <div class="menu__buttons">
          <button class="button button--primary" data-action="${s.mode === 'daily' ? 'start-daily' : 'start-normal'}">Run It Back</button>
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
