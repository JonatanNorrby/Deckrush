import { RNG, dailySeed } from '../core/rng.js';
import { saveRunResult } from '../core/storage.js';
import { STARTING_DECK, REWARD_POOL, getCard } from '../data/cards.js';
import { ENEMIES, NORMAL_ENEMIES, ELITE_ENEMIES, BOSS_ID } from '../data/enemies.js';

const HAND_SIZE = 5;
const BOSS_INTERVAL = 8;

export class Game {
  constructor() {
    this.listeners = new Set();
    this.state = this.createMenuState();
  }

  createMenuState() {
    return { phase: 'menu' };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) listener(this.state);
  }

  startRun(mode = 'normal') {
    const daily = dailySeed();
    const seed = mode === 'daily' ? daily.seed : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.rng = new RNG(seed);
    this.state = {
      phase: 'route',
      mode,
      seed,
      dailyLabel: mode === 'daily' ? daily.label : null,
      startedAt: Date.now(),
      encounterIndex: 0,
      selectedHeat: 0,
      player: { hp: 50, maxHp: 50, block: 0, energy: 3, maxEnergy: 3 },
      deck: [...STARTING_DECK],
      drawPile: [],
      discardPile: [],
      hand: [],
      enemy: null,
      rewardOptions: [],
      score: { total: 0, combo: 0, multiplier: 1, maxCombo: 0, maxMultiplier: 1 },
      stats: { biggestHit: 0, cardsPlayed: 0, fightsPerfect: 0, damageTaken: 0, overkill: 0 },
      fight: { damageTaken: 0, turn: 1 },
      log: ['Run started. Build Combo, push the multiplier, and make every hit worth more.'],
      result: null,
    };
    this.emit();
  }

  getElapsedMs(now = Date.now()) {
    if (!this.state.startedAt) return 0;
    return Math.max(0, now - this.state.startedAt);
  }


  chooseHeat(heat) {
    if (this.state.phase !== 'route') return;
    this.state.selectedHeat = Number(heat);
    this.startEncounter();
  }

  startEncounter() {
    const s = this.state;
    const fightNumber = s.encounterIndex + 1;
    const isBoss = fightNumber % BOSS_INTERVAL === 0;
    const eliteChance = Math.min(0.18 + s.encounterIndex * 0.012, 0.42);
    const enemyId = isBoss
      ? BOSS_ID
      : this.rng.pick(this.rng.next() < eliteChance ? ELITE_ENEMIES : NORMAL_ENEMIES);
    const def = ENEMIES[enemyId];
    const heat = s.selectedHeat;
    const endlessHpScale = 1 + s.encounterIndex * 0.07;
    const endlessDamageBonus = Math.floor(s.encounterIndex / 4);
    const endlessRewardScale = 1 + s.encounterIndex * 0.05;
    const hp = Math.round(def.hp * endlessHpScale * (1 + heat * 0.16));

    s.enemy = {
      id: def.id,
      name: def.name,
      maxHp: hp,
      hp,
      baseDamage: def.damage + endlessDamageBonus,
      scaling: def.scaling,
      reward: Math.round(def.reward * endlessRewardScale),
      elite: def.elite,
      boss: def.boss,
      trait: def.trait,
      burstTurn: def.burstTurn,
      burstBonus: def.burstBonus,
      tagline: def.tagline,
      strength: 0,
      turn: 0,
    };
    s.fight = { damageTaken: 0, turn: 1 };
    s.player.block = 0;
    s.player.energy = s.player.maxEnergy;
    s.score.combo = 0;
    s.drawPile = this.rng.shuffle([...s.deck]);
    s.discardPile = [];
    s.hand = [];
    this.draw(HAND_SIZE);
    s.phase = 'combat';
    this.pushLog(`Fight ${fightNumber}: ${def.name} enters at Heat ${heat}.`);
    this.emit();
  }

  draw(amount) {
    const s = this.state;
    for (let i = 0; i < amount; i += 1) {
      if (!s.drawPile.length) {
        if (!s.discardPile.length) return;
        s.drawPile = this.rng.shuffle(s.discardPile);
        s.discardPile = [];
      }
      s.hand.push(s.drawPile.pop());
    }
  }

  playCard(index) {
    const s = this.state;
    if (s.phase !== 'combat' || !s.enemy) return;
    const cardId = s.hand[index];
    const card = getCard(cardId);
    if (!card || s.player.energy < card.cost) return;

    s.player.energy -= card.cost;
    s.hand.splice(index, 1);
    s.discardPile.push(cardId);
    s.stats.cardsPlayed += 1;

    if (card.comboGain) this.addCombo(card.comboGain);
    this.pushLog(`Played ${card.name}.`);

    for (const effect of card.effects) {
      if (s.phase !== 'combat') break;
      this.resolveEffect(effect);
    }

    this.emit();
  }

  resolveEffect(effect) {
    const s = this.state;
    switch (effect.type) {
      case 'damage': {
        const hits = effect.hits || 1;
        for (let i = 0; i < hits && s.enemy?.hp > 0; i += 1) {
          this.dealDamage(effect.amount, effect);
        }
        break;
      }
      case 'damagePerCombo':
        this.dealDamage(effect.base + s.score.combo * effect.amount, effect);
        break;
      case 'block': s.player.block += effect.amount; break;
      case 'draw': this.draw(effect.amount); break;
      case 'heal': s.player.hp = Math.min(s.player.maxHp, s.player.hp + effect.amount); break;
      case 'selfDamage': this.applySelfDamage(effect.amount); break;
      case 'multiplier': this.addMultiplier(effect.amount); break;
      case 'multiplierPerCombo': this.addMultiplier(effect.amount * s.score.combo); break;
      case 'energy': s.player.energy += effect.amount; break;
      case 'halveCombo': s.score.combo = Math.floor(s.score.combo / 2); break;
      case 'resetCombo': s.score.combo = 0; break;
      case 'score': this.addScore(effect.amount); break;
      case 'scorePerCombo': this.addScore(effect.amount * s.score.combo); break;
      case 'enemyStrength': s.enemy.strength += effect.amount; break;
      case 'conditionalScore': if (s.score.combo >= effect.comboAtLeast) this.addScore(effect.amount); break;
      default: break;
    }
  }

  addCombo(amount) {
    const score = this.state.score;
    score.combo += amount;
    score.maxCombo = Math.max(score.maxCombo, score.combo);
  }

  addMultiplier(amount) {
    const score = this.state.score;
    score.multiplier = Math.max(1, Math.round((score.multiplier + amount) * 100) / 100);
    score.maxMultiplier = Math.max(score.maxMultiplier, score.multiplier);
  }

  scoreFactor() {
    const { multiplier, combo } = this.state.score;
    const heatFactor = 1 + this.state.selectedHeat * 0.25;
    const comboFactor = 1 + combo * 0.08;
    return multiplier * heatFactor * comboFactor;
  }

  addScore(baseAmount) {
    const gained = Math.max(0, Math.round(baseAmount * this.scoreFactor()));
    this.state.score.total += gained;
    return gained;
  }

  dealDamage(amount, effect = {}) {
    const s = this.state;
    if (!s.enemy) return;
    s.enemy.hp -= amount;
    s.stats.biggestHit = Math.max(s.stats.biggestHit, amount);
    this.addScore(amount * 10);

    const overkill = Math.max(0, -s.enemy.hp);
    if (overkill > 0) {
      s.stats.overkill += overkill;
      const bonus = this.addScore(overkill * 28);
      this.pushLog(`OVERKILL +${bonus}`);
    }

    if (s.enemy.hp <= 0) {
      if (effect.killScore) this.addScore(effect.killScore);
      if (effect.perfectKillScore && s.fight.damageTaken === 0) this.addScore(effect.perfectKillScore);
      this.finishEncounter();
    } else if (effect.lowHpScore && s.enemy.hp <= effect.lowHpThreshold) {
      this.addScore(effect.lowHpScore);
    }
  }

  applySelfDamage(amount) {
    const s = this.state;
    s.player.hp = Math.max(1, s.player.hp - amount);
    this.pushLog(`Risk cost: ${amount} HP.`);
  }

  endTurn() {
    const s = this.state;
    if (s.phase !== 'combat' || !s.enemy) return;
    s.discardPile.push(...s.hand);
    s.hand = [];
    this.enemyTurn();
    if (s.phase !== 'combat') return;
    s.player.block = 0;
    s.player.energy = s.player.maxEnergy;
    s.fight.turn += 1;
    this.draw(HAND_SIZE);
    this.emit();
  }

  enemyTurn() {
    const s = this.state;
    const e = s.enemy;
    e.turn += 1;
    let incoming = e.baseDamage + e.strength + s.selectedHeat + e.scaling * Math.max(0, e.turn - 1);
    if (e.trait === 'burst' && e.turn === e.burstTurn) incoming += e.burstBonus || 0;

    const blocked = Math.min(s.player.block, incoming);
    const damage = Math.max(0, incoming - blocked);
    s.player.block -= blocked;

    if (damage > 0) {
      s.player.hp -= damage;
      s.fight.damageTaken += damage;
      s.stats.damageTaken += damage;
      s.score.combo = 0;
      s.score.multiplier = Math.max(1, Math.round((s.score.multiplier - 0.4) * 100) / 100);
      if (e.trait === 'drain') s.score.multiplier = Math.max(1, Math.round((s.score.multiplier - 0.2) * 100) / 100);
      this.pushLog(`${e.name} hits for ${damage}. Combo broken and multiplier reduced.`);
    } else {
      this.pushLog(`${e.name}'s attack is fully blocked.`);
    }

    if (s.player.hp <= 0) this.endRun(false, 'Knocked out');
  }

  finishEncounter() {
    const s = this.state;
    const e = s.enemy;
    this.addScore(e.reward);
    if (s.fight.damageTaken === 0) {
      const perfect = this.addScore(400 + s.encounterIndex * 50);
      s.stats.fightsPerfect += 1;
      this.pushLog(`PERFECT +${perfect}`);
    }
    if (e.boss) {
      this.pushLog('BOSS CLEARED — the run continues.');
    }

    s.rewardOptions = this.rollRewards(3);
    s.phase = 'reward';
    this.emit();
  }

  rollRewards(count) {
    return this.rng.shuffle(REWARD_POOL).slice(0, count);
  }

  chooseReward(cardId) {
    const s = this.state;
    if (s.phase !== 'reward' || !s.rewardOptions.includes(cardId)) return;
    s.deck.push(cardId);
    this.pushLog(`${getCard(cardId).name} added to deck.`);
    this.advanceEncounter();
  }

  skipReward() {
    if (this.state.phase !== 'reward') return;
    this.state.score.total += 250;
    this.pushLog('Skipped reward. +250 score.');
    this.advanceEncounter();
  }

  advanceEncounter() {
    const s = this.state;
    s.encounterIndex += 1;
    s.enemy = null;
    s.rewardOptions = [];
    s.phase = 'route';
    this.emit();
  }

  endRun(victory, reason) {
    const s = this.state;
    if (!s.startedAt || s.phase === 'gameover') return;
    const score = Math.round(s.score.total);
    s.result = {
      victory,
      reason,
      score,
      mode: s.mode,
      dailyLabel: s.dailyLabel,
      maxCombo: s.score.maxCombo,
      maxMultiplier: s.score.maxMultiplier,
      biggestHit: s.stats.biggestHit,
      cardsPlayed: s.stats.cardsPlayed,
      fightsPerfect: s.stats.fightsPerfect,
      damageTaken: s.stats.damageTaken,
      overkill: s.stats.overkill,
      fightsCleared: s.encounterIndex,
      elapsedMs: this.getElapsedMs(),
    };
    s.save = saveRunResult(s.result);
    s.phase = 'gameover';
    this.emit();
  }

  backToMenu() {
    this.state = this.createMenuState();
    this.emit();
  }

  pushLog(message) {
    const log = this.state.log;
    if (!log) return;
    log.unshift(message);
    if (log.length > 5) log.pop();
  }
}
