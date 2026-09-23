import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/game.js';
import { weeklySeed } from '../src/core/rng.js';
import { getCharacter } from '../src/data/characters.js';
import { CARD_LIBRARY, CARD_ANIMATION_CLASSES, getCard } from '../src/data/cards.js';
import { ENEMIES } from '../src/data/enemies.js';
import { animationFramePath } from '../src/ui/animations.js';
import { shouldIgnoreBackdropAction } from '../src/ui/render.js';

global.localStorage = {
  data: new Map(),
  getItem(key) { return this.data.get(key) ?? null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  clear() { this.data.clear(); },
};

test('weekly seed stays the same from Monday through Sunday and resets on Monday', () => {
  const monday = new Date('2026-09-21T00:00:00Z');
  const wednesday = new Date('2026-09-23T12:00:00Z');
  const sunday = new Date('2026-09-27T23:59:59Z');
  const nextMonday = new Date('2026-09-28T00:00:00Z');

  const mondaySeed = weeklySeed(monday);
  assert.deepEqual(weeklySeed(wednesday), mondaySeed);
  assert.deepEqual(weeklySeed(sunday), mondaySeed);
  assert.equal(mondaySeed.label, '2026-09-21');

  const nextWeek = weeklySeed(nextMonday);
  assert.equal(nextWeek.label, '2026-09-28');
  assert.notEqual(nextWeek.seed, mondaySeed.seed);
});

test('run enters combat with a full opening hand', () => {
  const game = new Game();
  game.startRun('weekly');
  game.chooseHeat(0);
  assert.equal(game.state.phase, 'combat');
  assert.equal(game.state.hand.length, 5);
  assert.equal(game.state.player.energy, 3);
});

test('heat increases enemy health', () => {
  const low = new Game();
  low.startRun('weekly');
  low.chooseHeat(0);

  const high = new Game();
  high.startRun('weekly');
  high.chooseHeat(3);

  assert.equal(low.state.enemies[0].id, high.state.enemies[0].id);
  assert.ok(high.state.enemies[0].maxHp > low.state.enemies[0].maxHp);
});

test('taking enemy damage keeps score safe but breaks combo', () => {
  const game = new Game();
  game.startRun('weekly');
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
  game.startRun('weekly');
  game.chooseHeat(0);
  game.state.enemies[0].hp = 1;
  game.state.hand = ['strike'];
  game.state.player.energy = 3;

  game.playCard(0);

  assert.equal(game.state.phase, 'reward');
  assert.ok(game.state.score.total > 0);
  assert.equal(game.state.rewardOptions.length, 3);
});


test('runs do not expire after ten minutes', () => {
  const game = new Game();
  game.startRun('weekly');
  game.state.startedAt = Date.now() - (20 * 60 * 1000);

  assert.ok(game.getElapsedMs() >= 20 * 60 * 1000);
  assert.equal(game.state.phase, 'route');
});


test('boss fights recur without ending the run', () => {
  const game = new Game();
  game.startRun('weekly');
  game.state.encounterIndex = 7;
  game.chooseHeat(0);

  assert.equal(game.state.enemies[0].boss, true);
  game.state.enemies[0].hp = 1;
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
  early.startRun('weekly');
  early.chooseHeat(0);
  const earlyDamage = early.state.enemies[0].baseDamage;

  const late = new Game();
  late.startRun('weekly');
  late.state.encounterIndex = 12;
  late.chooseHeat(3);

  assert.equal(late.state.selectedHeat, 3);
  assert.ok(late.state.enemies[0].baseDamage >= earlyDamage + 3);
});


test('Viper and Bastion start with different character decks', () => {
  const viper = new Game();
  viper.startRun('weekly', 'viper');

  const bastion = new Game();
  bastion.startRun('weekly', 'bastion');

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
  game.startRun('weekly', 'viper');
  game.chooseHeat(0);
  game.state.enemies[0].hp = 30;
  game.state.enemies[0].maxHp = 30;
  game.state.enemies[0].baseDamage = 0;
  game.state.enemies[0].scaling = 0;
  game.state.enemies[0].poison = 5;

  game.endTurn();

  assert.equal(game.state.enemies[0].hp, 25);
  assert.equal(game.state.enemies[0].poison, 4);
});

test('Bastion shield bash converts current Block into damage', () => {
  const game = new Game();
  game.startRun('weekly', 'bastion');
  game.chooseHeat(0);
  game.state.enemies[0].hp = 40;
  game.state.enemies[0].maxHp = 40;
  game.state.hand = ['fortify', 'shield-bash'];
  game.state.player.energy = 3;

  game.playCard(0);
  assert.equal(game.state.player.block, 9);

  game.playCard(0);
  assert.equal(game.state.enemies[0].hp, 31);
});

test('reward pools are character-specific', () => {
  const viper = new Game();
  viper.startRun('weekly', 'viper');
  const viperRewards = viper.rollRewards(10);
  assert.ok(viperRewards.every((id) => getCharacter('viper').rewardPool.includes(id)));

  const bastion = new Game();
  bastion.startRun('weekly', 'bastion');
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


test('multi-enemy encounters require a target for attack cards', () => {
  const game = new Game();
  game.startRun('weekly', 'bastion');
  game.state.encounterIndex = 2;
  game.chooseHeat(0);

  assert.equal(game.state.enemies.length, 2);
  game.state.enemies.forEach((enemy) => {
    enemy.hp = 30;
    enemy.maxHp = 30;
  });
  game.state.hand = ['shield-strike'];
  game.state.player.energy = 3;

  assert.equal(game.playCard(0), false);
  assert.equal(game.state.hand.length, 1);

  assert.equal(game.playCard(0, 1), true);
  assert.equal(game.state.enemies[0].hp, 30);
  assert.equal(game.state.enemies[1].hp, 26);
});

test('non-targeted cards can be played during multi-enemy encounters', () => {
  const game = new Game();
  game.startRun('weekly', 'bastion');
  game.state.encounterIndex = 2;
  game.chooseHeat(0);
  game.state.hand = ['fortify'];
  game.state.player.energy = 3;

  assert.equal(game.playCard(0), true);
  assert.equal(game.state.player.block, 9);
});


test('every card maps to a supported animation class', () => {
  const supported = new Set(CARD_ANIMATION_CLASSES);
  for (const card of Object.values(CARD_LIBRARY)) {
    assert.ok(supported.has(card.animationClass), `${card.id} has invalid animation class ${card.animationClass}`);
  }

  assert.equal(getCard('envenom').animationClass, 'magical');
  assert.equal(getCard('uppercut').animationClass, 'melee');
  assert.equal(getCard('fortify').animationClass, 'defensive');
});

test('characters and enemies declare the required animation states', () => {
  for (const characterId of ['viper', 'bastion']) {
    const states = getCharacter(characterId).animations;
    for (const state of ['idle', 'magical', 'melee', 'defensive', 'damage', 'death']) {
      assert.ok(states[state], `${characterId} missing ${state} animation state`);
    }
  }

  for (const enemy of Object.values(ENEMIES)) {
    for (const state of ['idle', 'attack', 'damage', 'death']) {
      assert.ok(enemy.animations[state], `${enemy.id} missing ${state} animation state`);
    }
  }
});

test('playing a card emits its character and card-class animation event', () => {
  const game = new Game();
  game.startRun('weekly', 'viper');
  game.chooseHeat(0);
  game.consumeAnimationEvents();

  game.state.hand = ['envenom'];
  game.state.player.energy = 3;
  game.playCard(0, 0);

  const events = game.consumeAnimationEvents();
  const cardEvent = events.find((event) => event.type === 'cardPlay');
  assert.ok(cardEvent);
  assert.equal(cardEvent.characterId, 'viper');
  assert.equal(cardEvent.cardId, 'envenom');
  assert.equal(cardEvent.animationClass, 'magical');
  assert.equal(cardEvent.targetIndex, 0);
});

test('combat emits attack and damage animation events', () => {
  const game = new Game();
  game.startRun('weekly', 'bastion');
  game.chooseHeat(0);
  game.consumeAnimationEvents();

  game.state.hand = ['shield-strike'];
  game.state.player.energy = 3;
  game.playCard(0, 0);
  let events = game.consumeAnimationEvents();
  assert.ok(events.some((event) => event.type === 'enemyDamage'));

  game.state.enemies[0].baseDamage = 1;
  game.state.enemies[0].scaling = 0;
  game.state.player.block = 0;
  game.endTurn();
  events = game.consumeAnimationEvents();
  assert.ok(events.some((event) => event.type === 'enemyAttack'));
  assert.ok(events.some((event) => event.type === 'playerDamage'));
});

test('animation frame paths follow the documented PNG convention', () => {
  assert.equal(
    animationFramePath('characters', 'viper', 'melee', 3),
    './assets/characters/viper/melee/3.png',
  );
  assert.equal(
    animationFramePath('enemies', 'scrapper', 'attack', 1),
    './assets/enemies/scrapper/attack/1.png',
  );
  assert.equal(
    animationFramePath('character-effects', 'bastion', 'defensive', 12),
    './assets/characters/bastion/effects/defensive/12.png',
  );
});


test('modal backdrop delegation lets X buttons work without closing on panel clicks', () => {
  const backdrop = {
    classList: {
      contains(name) {
        return name === 'handbook-backdrop';
      },
    },
  };
  const panelChild = {};

  assert.equal(shouldIgnoreBackdropAction(panelChild, backdrop), true);
  assert.equal(shouldIgnoreBackdropAction(backdrop, backdrop), false);

  const closeButton = {
    classList: {
      contains() {
        return false;
      },
    },
  };
  assert.equal(shouldIgnoreBackdropAction(closeButton, closeButton), false);
});


test('combat cards stay large and do not clamp rules text', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.combat-card\s*\{[\s\S]*?height:\s*310px;/);
  assert.match(css, /\.combat-card p\s*\{[\s\S]*?overflow:\s*visible;[\s\S]*?display:\s*block;/);
});


test('combat view has no log strip above the cards', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /combat-log-strip/);
  assert.doesNotMatch(css, /\.combat-log-strip/);
});
