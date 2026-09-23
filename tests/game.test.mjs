import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { dailySeed } from '../src/core/rng.js';

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

test('taking enemy damage burns exposed score and breaks combo', () => {
  const game = new Game();
  game.startRun('daily');
  game.chooseHeat(0);
  game.state.score.pending = 1000;
  game.state.score.combo = 5;
  game.state.player.block = 0;

  game.endTurn();

  assert.ok(game.state.score.pending <= 750);
  assert.equal(game.state.score.combo, 0);
});

test('defeating an enemy banks score and opens a reward', () => {
  const game = new Game();
  game.startRun('daily');
  game.chooseHeat(0);
  game.state.enemy.hp = 1;
  game.state.hand = ['strike'];
  game.state.player.energy = 3;

  game.playCard(0);

  assert.equal(game.state.phase, 'reward');
  assert.ok(game.state.score.banked > 0);
  assert.equal(game.state.rewardOptions.length, 3);
});
