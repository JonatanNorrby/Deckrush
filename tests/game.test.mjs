import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { dailySeed } from '../src/core/rng.js';
import { getCharacter } from '../src/data/characters.js';
import { CARD_LIBRARY } from '../src/data/cards.js';

global.localStorage = {
  data: new Map(),
  getItem(key) { return this.data.get(key) ?? null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  clear() { this.data.clear(); },
};

test('daily seed is deterministic for the same UTC date', () => {
  const date = new Date('2026-09-23T12:00:00Z');
  assert.deepEqual(dailySeed(date), dailySeed(date));
});

test('run enters combat with a full opening hand', () => {
  const game = new Game();
  game.startRun('daily');
  game.chooseHeat(0);
  assert.equal(game.state.phase, 'combat');
  assert.equal(game.state.hand.length, 5);
  assert.equal(game.state.player.energy, 3);
});

test('heat increases enemy health', () => {
  const low = new Game();
  low.startRun('daily');
  low.chooseHeat(0);

  const high = new Game();
  high.startRun('daily');
  high.chooseHeat(3);

  assert.equal(low.state.enemy.id, high.state.enemy.id);
  assert.ok(high.state.enemy.maxHp > low.state.enemy.maxHp);
});

test('taking enemy damage keeps score safe but breaks combo', () => {
  const game = new Game();
  game.startRun('daily');
  game.chooseHeat(0);
  game.state.score.total = 1000;
  game.state.score.combo = 5;
  game.state.player.block = 0;

  game.endTurn();

  assert.equal(game.state.score.total, 1000);
  assert.equal(game.state.score.combo, 0);
});

test('defeating an enemy adds score and opens a reward', () => {
  const game = new Game();
  game.startRun('daily');
  game.chooseHeat(0);
  game.state.enemy.hp = 1;
  game.state.hand = ['strike'];
  game.state.player.energy = 3;

  game.playCard(0);

  assert.equal(game.state.phase, 'reward');
  assert.ok(game.state.score.total > 0);
  assert.equal(game.state.rewardOptions.length, 3);
});


test('runs do not expire after ten minutes', () => {
  const game = new Game();
  game.startRun('daily');
  game.state.startedAt = Date.now() - (20 * 60 * 1000);

  assert.ok(game.getElapsedMs() >= 20 * 60 * 1000);
  assert.equal(game.state.phase, 'route');
});


test('boss fights recur without ending the run', () => {
  const game = new Game();
  game.startRun('daily');
  game.state.encounterIndex = 7;
  game.chooseHeat(0);

  assert.equal(game.state.enemy.boss, true);
  game.state.enemy.hp = 1;
  game.state.hand = ['strike'];
  game.state.player.energy = 3;
  game.playCard(0);

  assert.equal(game.state.phase, 'reward');
  assert.equal(game.state.result, null);

  game.skipReward();
  assert.equal(game.state.phase, 'route');
  assert.equal(game.state.encounterIndex, 8);
});

test('endless difficulty scales with fight number while Heat remains selectable', () => {
  const early = new Game();
  early.startRun('daily');
  early.chooseHeat(0);
  const earlyDamage = early.state.enemy.baseDamage;

  const late = new Game();
  late.startRun('daily');
  late.state.encounterIndex = 12;
  late.chooseHeat(3);

  assert.equal(late.state.selectedHeat, 3);
  assert.ok(late.state.enemy.baseDamage >= earlyDamage + 3);
});


test('Viper and Bastion start with different character decks', () => {
  const viper = new Game();
  viper.startRun('daily', 'viper');

  const bastion = new Game();
  bastion.startRun('daily', 'bastion');

  assert.equal(viper.state.characterId, 'viper');
  assert.equal(viper.state.player.maxHp, getCharacter('viper').maxHp);
  assert.ok(viper.state.deck.includes('toxic-cut'));
  assert.ok(!viper.state.deck.includes('shield-strike'));

  assert.equal(bastion.state.characterId, 'bastion');
  assert.equal(bastion.state.player.maxHp, getCharacter('bastion').maxHp);
  assert.ok(bastion.state.deck.includes('shield-strike'));
  assert.ok(!bastion.state.deck.includes('toxic-cut'));
});

test('poison ticks before the enemy attacks and decays by one', () => {
  const game = new Game();
  game.startRun('daily', 'viper');
  game.chooseHeat(0);
  game.state.enemy.hp = 30;
  game.state.enemy.maxHp = 30;
  game.state.enemy.baseDamage = 0;
  game.state.enemy.scaling = 0;
  game.state.enemy.poison = 5;

  game.endTurn();

  assert.equal(game.state.enemy.hp, 25);
  assert.equal(game.state.enemy.poison, 4);
});

test('Bastion shield bash converts current Block into damage', () => {
  const game = new Game();
  game.startRun('daily', 'bastion');
  game.chooseHeat(0);
  game.state.enemy.hp = 40;
  game.state.enemy.maxHp = 40;
  game.state.hand = ['fortify', 'shield-bash'];
  game.state.player.energy = 3;

  game.playCard(0);
  assert.equal(game.state.player.block, 9);

  game.playCard(0);
  assert.equal(game.state.enemy.hp, 31);
});

test('reward pools are character-specific', () => {
  const viper = new Game();
  viper.startRun('daily', 'viper');
  const viperRewards = viper.rollRewards(10);
  assert.ok(viperRewards.every((id) => getCharacter('viper').rewardPool.includes(id)));

  const bastion = new Game();
  bastion.startRun('daily', 'bastion');
  const bastionRewards = bastion.rollRewards(10);
  assert.ok(bastionRewards.every((id) => getCharacter('bastion').rewardPool.includes(id)));
});


test('handbook data exposes every card with display metadata', async () => {
  await import('../src/ui/render.js');
  const cards = Object.values(CARD_LIBRARY);

  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => card.id && card.name && card.description));
  assert.ok(cards.every((card) => Array.isArray(card.tags) && card.tags.length > 0));
});
