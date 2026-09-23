import { RNG, dailySeed } from '../core/rng.js';
import { getCard, cardNeedsEnemyTarget } from '../data/cards.js';
import { saveRunResult } from '../core/storage.js';
import { DEFAULT_CHARACTER_ID, getCharacter } from '../data/characters.js';
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

  startRun(mode = 'normal', characterId = DEFAULT_CHARACTER_ID) {
    const daily = dailySeed();
    const character = getCharacter(characterId);
    const seed = mode === 'daily' ? daily.seed : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.rng = new RNG(seed);
    this.state = {
      phase: 'route',
      mode,
      seed,
      dailyLabel: mode === 'daily' ? daily.label : null,
      startedAt: Date.now(),
      characterId: character.id,
      encounterIndex: 0,
      selectedHeat: 0,
      player: { hp: character.maxHp, maxHp: character.maxHp, block: 0, energy: 3, maxEnergy: 3 },
      deck: [...character.startingDeck],
      drawPile: [],
      discardPile: [],
      hand: [],
      enemies: [],
      rewardOptions: [],
      score: { total: 0, combo: 0, multiplier: 1, maxCombo: 0, maxMultiplier: 1 },
      stats: { biggestHit: 0, cardsPlayed: 0, fightsPerfect: 0, damageTaken: 0, overkill: 0 },
      fight: { damageTaken: 0, turn: 1 },
      log: [`${character.name} enters the run. Build Combo, push the multiplier, and make every hit worth more.`],
      result: null,
    };
    this.emit();
  }

  getElapsedMs(now = Date.now()) {
    if (!this.state.startedAt) return 0;
    return Math.max(0, now - this.state.startedAt);
  }

  getAliveEnemies() {
    return (this.state.enemies || []).filter((enemy) => enemy.hp > 0);
  }

  getEnemyIntent(enemy) {
    if (!enemy || enemy.hp <= 0) return 0;
    let incoming = enemy.baseDamage + enemy.strength + this.state.selectedHeat + enemy.scaling * Math.max(0, enemy.turn);
    if (enemy.trait === 'burst' && enemy.turn + 1 === enemy.burstTurn) incoming += enemy.burstBonus || 0;
    return incoming;
  }

  chooseHeat(heat) {
    if (this.state.phase !== 'route') return;
    this.state.selectedHeat = Number(heat);
    this.startEncounter();
  }

  encounterEnemyCount(fightNumber, isBoss) {
    if (isBoss) return 1;
    if (fightNumber >= 10 && fightNumber % 5 === 0) return 3;
    if (fightNumber >= 3 && fightNumber % 3 === 0) return 2;
    return 1;
  }

  createEnemy(def, slot, enemyCount) {
    const s = this.state;
    const heat = s.selectedHeat;
    const endlessHpScale = 1 + s.encounterIndex * 0.07;
    const endlessDamageBonus = Math.floor(s.encounterIndex / 4);
    const endlessRewardScale = 1 + s.encounterIndex * 0.05;
    const groupHpScale = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.78 : 0.64;
    const groupDamageScale = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.72 : 0.56;
    const groupRewardScale = enemyCount === 1 ? 1 : enemyCount === 2 ? 0.68 : 0.5;
    const hp = Math.max(1, Math.round(def.hp * endlessHpScale * groupHpScale * (1 + heat * 0.16)));

    return {
      instanceId: `${def.id}-${s.encounterIndex}-${slot}`,
      id: def.id,
      name: def.name,
      maxHp: hp,
      hp,
      baseDamage: Math.max(1, Math.round((def.damage + endlessDamageBonus) * groupDamageScale)),
      scaling: def.scaling,
      reward: Math.round(def.reward * endlessRewardScale * groupRewardScale),
      elite: def.elite,
      boss: def.boss,
      trait: def.trait,
      burstTurn: def.burstTurn,
      burstBonus: def.burstBonus,
      tagline: def.tagline,
      strength: 0,
      turn: 0,
      poison: 0,
      defeated: false,
    };
  }

  startEncounter() {
    const s = this.state;
    const fightNumber = s.encounterIndex + 1;
    const isBoss = fightNumber % BOSS_INTERVAL === 0;
    const enemyCount = this.encounterEnemyCount(fightNumber, isBoss);
    const eliteChance = s.encounterIndex < 2 ? 0 : Math.min(0.28 + (s.encounterIndex - 2) * 0.01, 0.45);

    s.enemies = Array.from({ length: enemyCount }, (_, slot) => {
      const enemyId = isBoss
        ? BOSS_ID
        : this.rng.pick(this.rng.next() < eliteChance ? ELITE_ENEMIES : NORMAL_ENEMIES);
      return this.createEnemy(ENEMIES[enemyId], slot, enemyCount);
    });

    s.fight = { damageTaken: 0, turn: 1 };
    s.player.block = 0;
    s.player.energy = s.player.maxEnergy;
    s.score.combo = 0;
    s.drawPile = this.rng.shuffle([...s.deck]);
    s.discardPile = [];
    s.hand = [];
    this.draw(HAND_SIZE);
    s.phase = 'combat';
    this.pushLog(`Fight ${fightNumber}: ${enemyCount > 1 ? `${enemyCount} enemies` : s.enemies[0].name} at Heat ${s.selectedHeat}.`);
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

  resolveTargetIndex(card, requestedTargetIndex) {
    const aliveIndexes = this.state.enemies
      .map((enemy, index) => (enemy.hp > 0 ? index : -1))
      .filter((index) => index >= 0);

    if (!cardNeedsEnemyTarget(card)) return null;
    if (Number.isInteger(requestedTargetIndex) && aliveIndexes.includes(requestedTargetIndex)) return requestedTargetIndex;
    if (aliveIndexes.length === 1) return aliveIndexes[0];
    return undefined;
  }

  playCard(index, targetIndex = null) {
    const s = this.state;
    if (s.phase !== 'combat' || !this.getAliveEnemies().length) return false;
    const cardId = s.hand[index];
    const card = getCard(cardId);
    if (!card || s.player.energy < card.cost) return false;

    const resolvedTarget = this.resolveTargetIndex(card, targetIndex);
    if (cardNeedsEnemyTarget(card) && resolvedTarget === undefined) return false;

    s.player.energy -= card.cost;
    s.hand.splice(index, 1);
    s.discardPile.push(cardId);
    s.stats.cardsPlayed += 1;

    if (card.comboGain) this.addCombo(card.comboGain);
    this.pushLog(`Played ${card.name}.`);

    for (const effect of card.effects) {
      if (s.phase !== 'combat') break;
      this.resolveEffect(effect, resolvedTarget);
    }

    this.emit();
    return true;
  }

  getTargetEnemy(targetIndex) {
    if (!Number.isInteger(targetIndex)) return null;
    const enemy = this.state.enemies[targetIndex];
    return enemy?.hp > 0 ? enemy : null;
  }

  resolveEffect(effect, targetIndex) {
    const s = this.state;
    switch (effect.type) {
      case 'damage': {
        const hits = effect.hits || 1;
        for (let i = 0; i < hits; i += 1) {
          const enemy = this.getTargetEnemy(targetIndex);
          if (!enemy) break;
          this.dealDamage(targetIndex, effect.amount, effect);
        }
        break;
      }
      case 'damagePerCombo':
        this.dealDamage(targetIndex, effect.base + s.score.combo * effect.amount, effect);
        break;
      case 'damageFromBlock':
        this.dealDamage(targetIndex, effect.base + Math.floor(s.player.block * effect.ratio), effect);
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
      case 'scorePerBlock': this.addScore(effect.amount * s.player.block); break;
      case 'scorePerPoison': {
        const enemy = this.getTargetEnemy(targetIndex);
        if (enemy) this.addScore(effect.amount * enemy.poison);
        break;
      }
      case 'poison': {
        const enemy = this.getTargetEnemy(targetIndex);
        if (enemy) enemy.poison += effect.amount;
        break;
      }
      case 'doublePoison': {
        const enemy = this.getTargetEnemy(targetIndex);
        if (enemy) enemy.poison *= 2;
        break;
      }
      case 'enemyStrength':
        for (const enemy of this.getAliveEnemies()) enemy.strength += effect.amount;
        break;
      case 'conditionalScore':
        if (s.score.combo >= effect.comboAtLeast) this.addScore(effect.amount);
        break;
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

  dealDamage(targetIndex, amount, effect = {}) {
    const s = this.state;
    const enemy = this.getTargetEnemy(targetIndex);
    if (!enemy) return;

    const previousHp = enemy.hp;
    enemy.hp -= amount;
    s.stats.biggestHit = Math.max(s.stats.biggestHit, amount);
    this.addScore(amount * 10);

    const overkill = Math.max(0, amount - previousHp);
    if (overkill > 0) {
      s.stats.overkill += overkill;
      const bonus = this.addScore(overkill * 28);
      this.pushLog(`OVERKILL +${bonus}`);
    }

    if (enemy.hp <= 0 && !enemy.defeated) {
      enemy.hp = Math.min(0, enemy.hp);
      enemy.defeated = true;
      if (effect.killScore) this.addScore(effect.killScore);
      if (effect.perfectKillScore && s.fight.damageTaken === 0) this.addScore(effect.perfectKillScore);
      this.addScore(enemy.reward);
      this.pushLog(`${enemy.name} defeated.`);

      if (!this.getAliveEnemies().length) this.finishEncounter();
    } else if (effect.lowHpScore && enemy.hp > 0 && enemy.hp <= effect.lowHpThreshold) {
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
    if (s.phase !== 'combat' || !this.getAliveEnemies().length) return;
    s.discardPile.push(...s.hand);
    s.hand = [];
    this.tickPoison();
    if (s.phase !== 'combat') return;
    this.enemyTurn();
    if (s.phase !== 'combat') return;
    s.player.block = 0;
    s.player.energy = s.player.maxEnergy;
    s.fight.turn += 1;
    this.draw(HAND_SIZE);
    this.emit();
  }

  tickPoison() {
    const s = this.state;
    const poisoned = s.enemies
      .map((enemy, index) => ({ enemy, index }))
      .filter(({ enemy }) => enemy.hp > 0 && enemy.poison > 0);

    for (const { enemy, index } of poisoned) {
      if (s.phase !== 'combat') break;
      const damage = enemy.poison;
      this.pushLog(`${enemy.name}: POISON ${damage}.`);
      this.dealDamage(index, damage, { source: 'poison' });
      if (s.phase === 'combat' && enemy.hp > 0) enemy.poison = Math.max(0, enemy.poison - 1);
    }
  }

  enemyTurn() {
    const s = this.state;
    for (const enemy of s.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.turn += 1;
      const incoming = this.getEnemyIntent({ ...enemy, turn: enemy.turn - 1 });
      const blocked = Math.min(s.player.block, incoming);
      const damage = Math.max(0, incoming - blocked);
      s.player.block -= blocked;

      if (damage > 0) {
        s.player.hp -= damage;
        s.fight.damageTaken += damage;
        s.stats.damageTaken += damage;
        s.score.combo = 0;
        s.score.multiplier = Math.max(1, Math.round((s.score.multiplier - 0.4) * 100) / 100);
        if (enemy.trait === 'drain') {
          s.score.multiplier = Math.max(1, Math.round((s.score.multiplier - 0.2) * 100) / 100);
        }
        this.pushLog(`${enemy.name} hits for ${damage}. Combo broken and multiplier reduced.`);
      } else {
        this.pushLog(`${enemy.name}'s attack is fully blocked.`);
      }

      if (s.player.hp <= 0) {
        s.player.hp = 0;
        this.endRun(false, 'Knocked out');
        return;
      }
    }
  }

  finishEncounter() {
    const s = this.state;
    if (s.fight.damageTaken === 0) {
      const perfect = this.addScore(400 + s.encounterIndex * 50);
      s.stats.fightsPerfect += 1;
      this.pushLog(`PERFECT +${perfect}`);
    }
    if (s.enemies.some((enemy) => enemy.boss)) {
      this.pushLog('BOSS CLEARED — the run continues.');
    }

    s.rewardOptions = this.rollRewards(3);
    s.phase = 'reward';
    this.emit();
  }

  rollRewards(count) {
    const character = getCharacter(this.state.characterId);
    return this.rng.shuffle(character.rewardPool).slice(0, count);
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
    s.enemies = [];
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
      characterId: s.characterId,
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
    if (log.length > 6) log.pop();
  }
}
