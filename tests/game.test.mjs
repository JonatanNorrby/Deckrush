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
  assert.equal(mondaySeed.week, 39);

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

test('enemy HP damage reduces combo by post-block damage amount', () => {
  const game = new Game();
  game.startRun('weekly');
  game.chooseHeat(0);
  game.state.score.total = 1000;
  game.state.score.combo = 7;
  game.state.player.block = 2;

  const enemy = game.state.enemies[0];
  enemy.baseDamage = 4;
  enemy.strength = 0;
  enemy.scaling = 0;
  enemy.trait = null;
  enemy.turn = 0;

  game.enemyTurn();

  assert.equal(game.state.score.total, 1000);
  assert.equal(game.state.player.block, 0);
  assert.equal(game.state.fight.damageTaken, 2);
  assert.equal(game.state.score.combo, 5);
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


test('Viper, Bastion, and Rune start with distinct character decks', () => {
  const viper = new Game();
  viper.startRun('weekly', 'viper');

  const bastion = new Game();
  bastion.startRun('weekly', 'bastion');

  const rune = new Game();
  rune.startRun('weekly', 'rune');

  assert.equal(viper.state.characterId, 'viper');
  assert.equal(viper.state.player.maxHp, getCharacter('viper').maxHp);
  assert.ok(viper.state.deck.includes('toxic-cut'));
  assert.ok(!viper.state.deck.includes('shield-strike'));
  assert.ok(!viper.state.deck.includes('arcane-bolt'));

  assert.equal(bastion.state.characterId, 'bastion');
  assert.equal(bastion.state.player.maxHp, getCharacter('bastion').maxHp);
  assert.ok(bastion.state.deck.includes('shield-strike'));
  assert.ok(!bastion.state.deck.includes('toxic-cut'));
  assert.ok(!bastion.state.deck.includes('arcane-bolt'));

  assert.equal(rune.state.characterId, 'rune');
  assert.equal(rune.state.player.maxHp, getCharacter('rune').maxHp);
  assert.ok(rune.state.deck.includes('arcane-bolt'));
  assert.ok(rune.state.deck.includes('rune-ward'));
  assert.ok(!rune.state.deck.includes('toxic-cut'));
  assert.ok(!rune.state.deck.includes('shield-strike'));
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

  const rune = new Game();
  rune.startRun('weekly', 'rune');
  const runeRewards = rune.rollRewards(10);
  assert.ok(runeRewards.every((id) => getCharacter('rune').rewardPool.includes(id)));
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
  assert.equal(getCard('toxic-cut').animationClass, 'melee');
  assert.equal(getCard('shield-strike').animationClass, 'melee');
  assert.equal(getCard('shield-bash').animationClass, 'melee');
  assert.equal(getCard('uppercut').animationClass, 'melee');
  assert.equal(getCard('fortify').animationClass, 'defensive');
  assert.equal(getCard('counterweight').animationClass, 'defensive');
  assert.equal(getCard('all-in').animationClass, 'magical');
});

test('characters and enemies declare the required animation states', () => {
  for (const characterId of ['viper', 'bastion', 'rune']) {
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

test('reward cards match combat card dimensions', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.reward-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*215px\)\);[\s\S]*?justify-items:\s*center;/);
  assert.match(css, /\.reward-grid \.card\s*\{[\s\S]*?width:\s*min\(215px,\s*100%\);[\s\S]*?height:\s*310px;[\s\S]*?padding:\s*11px;/);
});


test('combat view has no log strip above the cards', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /combat-log-strip/);
  assert.doesNotMatch(css, /\.combat-log-strip/);
});


test('game over screen centers score and prioritizes retry action', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(renderSource, /class="result-screen"/);
  assert.match(renderSource, /class="result-screen__score-block"/);
  assert.match(renderSource, /class="button button--primary result-screen__retry"/);
  assert.match(renderSource, /class="result-screen__menu"/);

  assert.match(css, /\.result-screen\s*\{[\s\S]*?place-items:\s*center;/);
  assert.match(css, /\.result-screen__retry\s*\{[\s\S]*?min-height:\s*64px;/);
  assert.match(css, /\.result-screen__menu\s*\{[\s\S]*?background:\s*transparent;/);
});


test('character selection uses idle frame one instead of portrait art', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /portrait\.png/);
  const idleCharacterRefs = renderSource.match(/\.\/assets\/characters\/\$\{character\.id\}\/idle\/1\.png/g) || [];
  assert.ok(idleCharacterRefs.length >= 2);
});


test('menu close buttons are unboxed and turn red on hover', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.handbook__close\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/);
  assert.match(css, /\.handbook__close:hover\s*\{[\s\S]*?color:\s*var\(--danger\);/);
  assert.match(css, /\.character-picker__close\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/);
  assert.match(css, /\.character-picker__close:hover\s*\{[\s\S]*?color:\s*var\(--danger\);/);
});


test('main menu left nav only shows handbook and settings without icons', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  const navMatch = renderSource.match(/<nav class="fantasy-menu__nav"[\s\S]*?<\/nav>/);
  assert.ok(navMatch);
  const nav = navMatch[0];

  assert.match(nav, /data-action="open-handbook"/);
  assert.match(nav, /data-action="settings"/);
  assert.doesNotMatch(nav, /data-action="start-normal"/);
  assert.doesNotMatch(nav, /data-action="start-weekly"/);
  assert.doesNotMatch(nav, /data-action="open-character-select"/);
  assert.doesNotMatch(nav, /fantasy-menu__rune/);

  assert.match(renderSource, /class="fantasy-menu__begin" data-action="start-normal"/);
  assert.match(renderSource, /class="fantasy-menu__hero-card[^"]*" data-action="open-character-select"/);
  assert.doesNotMatch(css, /\.fantasy-menu__rune/);
});


test('character picker artwork fits and is centered inside its information card', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.character-choice__portrait\s*\{[\s\S]*?place-items:\s*center;[\s\S]*?padding:\s*12px 20px;/,
  );
  assert.match(
    css,
    /\.character-choice__portrait \.art-image\s*\{[\s\S]*?width:\s*82%;[\s\S]*?height:\s*82%;[\s\S]*?object-position:\s*center;[\s\S]*?transform:\s*translateY\(-8px\);/,
  );
  assert.match(
    css,
    /\.fantasy-menu__portrait \.art-image\s*\{[\s\S]*?object-position:\s*center bottom;/,
  );
});


test('heat selection screen does not show the run log', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const routeMatch = renderSource.match(/route\(s\)\s*\{[\s\S]*?enemyMarkup\(enemy, index\)/);

  assert.ok(routeMatch);
  assert.doesNotMatch(routeMatch[0], /this\.log\(s\)/);
});

test('heat selection uses a centered 0-5 slider with asset flames and CSS fallback', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const flameReadme = readFileSync(new URL('../assets/heat/flames/README.md', import.meta.url), 'utf8');

  assert.match(renderSource, /class="heat-selector"/);
  assert.match(renderSource, /type="range"[\s\S]*?min="0"[\s\S]*?max="5"[\s\S]*?data-heat-slider/);
  assert.match(renderSource, /assets\/heat\/flames\/\$\{heat \+ 1\}\.png/);
  assert.match(renderSource, /data-heat-flame-fallback/);
  assert.match(renderSource, /onerror="this\.hidden=true;this\.nextElementSibling\.hidden=false"/);
  assert.doesNotMatch(renderSource, /data-heat-value/);
  assert.match(renderSource, /this\.root\.addEventListener\('input',[\s\S]*?handleInput/);
  assert.match(renderSource, /Math\.min\(5,/);
  assert.doesNotMatch(renderSource, /class="heat-grid"/);
  assert.doesNotMatch(renderSource, /class="heat-card"/);
  assert.match(css, /\.heat-selector\s*\{[\s\S]*?width:\s*min\(720px,\s*100%\);[\s\S]*?margin:\s*38px auto 0;/);
  assert.match(css, /\.heat-readout > span\s*\{[\s\S]*?font-size:\s*clamp\(1\.35rem,\s*3vw,\s*1\.9rem\)/);
  assert.match(css, /\.heat-selector\[data-heat="5"\] \.heat-flame-fallback span\s*\{[\s\S]*?opacity:\s*\.98;[\s\S]*?scale\(1\.08\)/);
  assert.match(flameReadme, /1\.png.*Heat 0/);
  assert.match(flameReadme, /6\.png.*Heat 5/);
  assert.match(flameReadme, /fallback/i);
});


test('gameplay surfaces use the unified dark-fantasy theme', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /Unified dark-fantasy theme/);
  assert.match(css, /\.combat-stage\s*\{[\s\S]*?rgba\(20,12,7,[\s\S]*?assets\/backgrounds\/combat\.png/);
  assert.match(css, /\.combat-card,[\s\S]*?\.handbook-card\s*\{[\s\S]*?#694722/);
  assert.match(css, /\.heat-selector\s*\{[\s\S]*?rgba\(183,126,58,.4\)/);
  assert.match(css, /\.handbook\s*\{[\s\S]*?#68451f/);
  assert.match(css, /\.combat-tray\s*\{[\s\S]*?#21150c/);
  assert.match(css, /\.result-screen\s*\{[\s\S]*?assets\/backgrounds\/menu\.png/);
});


test('main menu removes branding helper text and divider', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /ENDLESS FANTASY DECKBRAWLER/i);
  assert.doesNotMatch(renderSource, /Chosen Wanderer/i);
  assert.doesNotMatch(css, /\.fantasy-menu__hero-kicker\s*\{/);
  assert.match(css, /\.fantasy-menu__masthead\s*\{[\s\S]*?padding-top:\s*0;[\s\S]*?padding-bottom:\s*0;/);
  assert.doesNotMatch(css, /\.fantasy-menu__masthead::after\s*\{/);
  assert.match(css, /\.fantasy-menu__hero-stage\s*\{[\s\S]*?grid-template-rows:\s*1fr auto;/);
});


test('every card explicitly declares its animation class', () => {
  const source = readFileSync(new URL('../src/data/cards.js', import.meta.url), 'utf8');
  const definitions = [...source.matchAll(/id:\s*'([^']+)'[\s\S]*?animationClass:\s*'(magical|melee|defensive)'/g)];

  assert.equal(definitions.length, Object.values(CARD_LIBRARY).length);
  assert.doesNotMatch(source, /inferAnimationClass/);
});


test('enemy attack animations return to idle frames', () => {
  const source = readFileSync(new URL('../src/ui/animations.js', import.meta.url), 'utf8');

  assert.match(
    source,
    /event\.type === 'enemyAttack'[\s\S]*?playSprite\(enemy, 'enemies', event\.enemyId, 'attack', \{ resumeState: 'idle' \}\)/,
  );
  assert.match(
    source,
    /if \(resumeState && this\.spriteTokens\.get\(element\) === token\)[\s\S]*?playSprite\(element, group, id, resumeState, \{ loop: true \}\)/,
  );
  assert.equal(
    animationFramePath('enemies', 'scrapper', 'attack', 2),
    './assets/enemies/scrapper/attack/2.png',
  );
  assert.equal(
    animationFramePath('enemies', 'scrapper', 'idle', 1),
    './assets/enemies/scrapper/idle/1.png',
  );
});


test('all character and enemy static fallbacks use idle frame one', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /assets\/(characters|enemies)\/\$\{[^}]+\}\/combat\.png/);
  assert.match(renderSource, /assets\/characters\/\$\{character\.id\}\/idle\/1\.png/);
  assert.match(renderSource, /assets\/enemies\/\$\{enemy\.id\}\/idle\/1\.png/);
});


test('defeated enemies remain visible as non-targetable corpses', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(renderSource, /if \(enemy\.hp <= 0\)[\s\S]*?enemy-unit--dead[\s\S]*?assets\/enemies\/\$\{enemy\.id\}\/dead\/1\.png/);
  assert.match(renderSource, /\$\{s\.enemies\.map\(\(enemy, index\) => this\.enemyMarkup\(enemy, index\)\)\.join\(''\)\}/);
  const deadBranch = renderSource.slice(renderSource.indexOf('if (enemy.hp <= 0)'), renderSource.indexOf('const hpPct'));
  assert.ok(deadBranch.length > 0);
  assert.doesNotMatch(deadBranch, /data-enemy-index=/);
  assert.doesNotMatch(deadBranch, /data-enemy-sprite=/);
  assert.match(css, /\.enemy-unit--dead\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.enemy-sprite--dead\s*\{[\s\S]*?transform:\s*translateY\(22px\);/);
});


test('combat character no longer shows the under-sprite info box', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /class="actor-name"/);
  assert.doesNotMatch(css, /\.actor-name/);
  assert.match(renderSource, /\$\{s\.player\.block\} Block/);
});


test('Rune arcane cards support spell chaining', () => {
  const game = new Game();
  game.startRun('weekly', 'rune');
  game.chooseHeat(0);
  game.state.enemies[0].hp = 40;
  game.state.enemies[0].maxHp = 40;
  game.state.hand = ['spark', 'channel', 'arcane-bolt'];
  game.state.drawPile = ['rune-ward'];
  game.state.player.energy = 2;

  assert.equal(getCard('spark').animationClass, 'magical');
  assert.equal(getCard('rune-ward').animationClass, 'defensive');
  assert.equal(getCard('meteor').animationClass, 'magical');

  game.playCard(0, 0);
  assert.equal(game.state.enemies[0].hp, 38);
  assert.equal(game.state.score.combo, 1);

  const energyBeforeChannel = game.state.player.energy;
  const channelIndex = game.state.hand.indexOf('channel');
  game.playCard(channelIndex);
  assert.equal(game.state.player.energy, energyBeforeChannel);
  assert.ok(game.state.hand.includes('rune-ward'));
});

test('Rune appears in character selection and has dedicated visual accents', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(renderSource, /Object\.values\(CHARACTERS\)/);
  assert.match(css, /\.fantasy-menu__hero-card--rune\s*\{[\s\S]*?--hero-accent:/);
  assert.match(css, /\.character-choice--rune\s*\{[\s\S]*?--choice-accent:/);
  assert.match(css, /\.player-sprite--rune\s*\{/);
  assert.match(css, /\.character-picker__grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
});


test('multi-enemy targeted cards stage on battlefield before choosing an enemy', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    renderSource,
    /if \(targeted && aliveIndexes\.length > 1\)[\s\S]*?stagePendingTarget\(index, card, source, landingCard, x, y\)/,
  );
  assert.match(
    renderSource,
    /beginTargetArrow\(event, pendingCard\)[\s\S]*?targeting-arrow-layer/,
  );
  assert.match(
    renderSource,
    /finishTargetArrow\(x, y\)[\s\S]*?this\.game\.playCard\(index, targetIndex\)/,
  );
  assert.match(
    renderSource,
    /Drop a card on the battlefield, then aim at an enemy/,
  );
  assert.match(css, /\.combat-card\.pending-target-card\s*\{/);
  assert.match(css, /\.targeting-arrow-layer\s*\{/);
  assert.match(
    renderSource,
    /this\.pendingTarget = \{ index, card, source, element: landingCard \};[\s\S]*?requestAnimationFrame\([\s\S]*?startTargetArrow\(landingCard, x, y\)/,
  );
  assert.match(
    css,
    /\.enemy-unit\.is-drop-target \.enemy-sprite\s*\{[\s\S]*?drop-shadow\(2px 0 0 rgba\(255,255,255,\.62\)\)[\s\S]*?drop-shadow\(0 0 8px rgba\(255,255,255,\.38\)\)/,
  );
});

test('dropping a playable card uses a brief battlefield landing animation', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    renderSource,
    /playCardWithDropAnimation\(index, targetIndex, landingCard, x, y\)/,
  );
  assert.match(
    renderSource,
    /landingCard\.classList\.add\('card-drop-play'\)[\s\S]*?setTimeout\([\s\S]*?140/,
  );
  assert.match(css, /@keyframes card-drop-play/);
});


test('battlefield character and enemy artwork is moderately larger', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.player-sprite\s*\{[\s\S]*?width:\s*clamp\(200px,\s*22vw,\s*315px\);[\s\S]*?height:\s*clamp\(255px,\s*31vw,\s*420px\);/);
  assert.match(css, /\.enemy-sprite\s*\{[\s\S]*?width:\s*clamp\(170px,\s*19vw,\s*260px\);[\s\S]*?height:\s*clamp\(215px,\s*24vw,\s*335px\);/);
  assert.match(css, /\.enemy-unit--boss \.enemy-sprite\s*\{[\s\S]*?width:\s*clamp\(235px,\s*27vw,\s*365px\);[\s\S]*?height:\s*clamp\(280px,\s*32vw,\s*430px\);/);
});


test('main menu shows weekly seed and all-time best below weekly best', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(renderSource, /Week \$\{weekly\.week\} Seed/);
  assert.match(renderSource, /\$\{weekly\.seed\}/);
  assert.match(renderSource, /Same seed all week/);

  const weeklyIndex = renderSource.indexOf('<small>Weekly Best</small>');
  const allTimeIndex = renderSource.indexOf('<small>All-Time Best</small>');
  assert.ok(weeklyIndex >= 0);
  assert.ok(allTimeIndex > weeklyIndex);

  assert.match(css, /\.fantasy-menu__seed\s*\{/);
});


test('card animation classes stay backend-only', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const cardSource = readFileSync(new URL('../src/data/cards.js', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /card__animation-class/);
  assert.doesNotMatch(css, /\.card__animation-class/);
  assert.match(cardSource, /animationClass:\s*'(magical|melee|defensive)'/);
  assert.equal(getCard('envenom').animationClass, 'magical');
  assert.equal(getCard('shield-bash').animationClass, 'melee');
  assert.equal(getCard('rune-ward').animationClass, 'defensive');
});


test('cards use shared base artwork plus separate illustrations', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const baseBytes = readFileSync(new URL('../assets/cards/base/card.png', import.meta.url));

  assert.equal(baseBytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.match(renderSource, /const artId = card\.art \|\| card\.id;[\s\S]*?assets\/cards\/art\/\$\{artId\}\.png/);
  assert.doesNotMatch(renderSource, /cardBaseMarkup/);
  assert.doesNotMatch(renderSource, /assets\/cards\/\$\{card\.id\}\.png/);
  assert.match(
    css,
    /\.combat-card,[\s\S]*?\.card,[\s\S]*?\.handbook-card\s*\{[\s\S]*?background:\s*transparent url\('\.\/assets\/cards\/base\/card\.png\?v=20260924-card5'\) center \/ 100% 100% no-repeat/,
  );
  assert.doesNotMatch(css, /\.card-base-image/);
});


test('combat redesign uses inline player HP and larger bare enemy intents', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /class="player-vitals"/);
  assert.match(renderSource, /class="player-hp-row"/);
  assert.match(renderSource, /class="player-hp-bar"/);
  assert.match(renderSource, /class="player-block-row"/);

  assert.match(css, /\.player-hp-bar\s*\{[\s\S]*?height:\s*11px;/);
  assert.match(css, /\.enemy-hp-bar\s*\{[\s\S]*?height:\s*9px;/);
  assert.match(css, /\.enemy-intent\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(css, /\.enemy-intent span\s*\{[^}]*font-size:\s*2\.1rem;/);
  assert.match(css, /\.enemy-intent strong\s*\{[^}]*font-size:\s*1\.65rem;/);
});

test('each encounter chooses one numbered battlefield background', () => {
  const game = new Game();
  game.startRun('weekly', 'viper');
  game.chooseHeat(0);

  assert.ok(Number.isInteger(game.state.fight.background));
  assert.ok(game.state.fight.background >= 1 && game.state.fight.background <= 6);

  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(renderSource, /assets\/backgrounds\/battlefields\/\$\{s\.fight\.background \|\| 1\}\.png/);
  assert.match(css, /--battlefield-bg/);
  assert.match(css, /assets\/backgrounds\/combat\.png/);
});

test('combat tray controls are larger and end turn matches the fantasy tray', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.pile\s*\{[\s\S]*?width:\s*88px;[\s\S]*?height:\s*122px;/);
  assert.match(css, /\.energy-orb\s*\{[\s\S]*?width:\s*98px;[\s\S]*?height:\s*98px;/);
  assert.match(css, /\.end-turn-button\s*\{[\s\S]*?min-height:\s*60px;[\s\S]*?font-family:\s*Georgia/);
  assert.match(css, /\.end-turn-button\s*\{[\s\S]*?border:\s*1px solid rgba\(205,151,77,.52\)/);
});


test('branding uses shared logo asset instead of text', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const logoBytes = readFileSync(new URL('../assets/logo/logo.png', import.meta.url));

  assert.equal(logoBytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal((renderSource.match(/assets\/logo\/logo\.png\?v=20260924-assets2/g) || []).length, 2);
  assert.doesNotMatch(renderSource, /<h1>DECKRUSH<\/h1>/);
  assert.doesNotMatch(renderSource, /<div class="hud__brand">DECKRUSH<\/div>/);
  assert.match(renderSource, /class="fantasy-menu__identity" aria-label="Deckrush"/);
  assert.match(renderSource, /class="hud__brand" aria-label="Deckrush"/);
  assert.match(css, /\.fantasy-menu__logo\s*\{/);
  assert.match(css, /\.hud__logo\s*\{/);
});


test('main menu is vertically centered with tighter logo spacing', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.fantasy-menu\s*\{[\s\S]*?grid-template-rows:\s*auto auto;[\s\S]*?align-content:\s*center;[\s\S]*?padding:\s*12px clamp\(20px,\s*4vw,\s*68px\);/);
  assert.match(css, /\.fantasy-menu__body\s*\{[\s\S]*?padding:\s*4px 0 8px;/);
});

test('selected hero omits archetype label on the main menu', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const start = renderSource.indexOf('<div class="fantasy-menu__hero-info">');
  const end = renderSource.indexOf('</div>\n            </button>', start);
  const heroInfo = renderSource.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(heroInfo, /character\.archetype/);
  assert.match(heroInfo, /character\.name/);
});

test('reward screen labels the run log as Score Summary', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');

  assert.match(renderSource, /class="reward__score-summary">Score Summary<\/h3>[\s\S]*?\$\{this\.log\(s\)\}/);
});

test('handbook cards hide tags and match standard card dimensions', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const handbookStart = renderSource.indexOf('handbookCards(cards)');
  const handbookEnd = renderSource.indexOf('hud(s)', handbookStart);
  const handbookSource = renderSource.slice(handbookStart, handbookEnd);

  assert.doesNotMatch(handbookSource, /handbook-card__tags/);
  assert.doesNotMatch(handbookSource, /card\.tags\.map/);
  assert.match(css, /\.handbook-card-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit,\s*215px\);[\s\S]*?justify-content:\s*center;/);
  assert.match(css, /\.handbook-card\s*\{[\s\S]*?width:\s*215px;[\s\S]*?height:\s*310px;[\s\S]*?padding:\s*11px;/);
});

test('Quick Stab uses the uploaded quickstab artwork', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const quickstabBytes = readFileSync(new URL('../assets/cards/art/quickstab.png', import.meta.url));

  assert.equal(getCard('quick-stab').art, 'quickstab');
  assert.equal(quickstabBytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.match(renderSource, /const artId = card\.art \|\| card\.id/);
});

test('Heat 5 is accepted and clamped by game state', () => {
  const game = new Game();
  game.startRun('weekly');
  game.chooseHeat(5);

  assert.equal(game.state.selectedHeat, 5);

  const high = new Game();
  high.startRun('weekly');
  high.chooseHeat(99);
  assert.equal(high.state.selectedHeat, 5);
});


test('Rune landscape artwork is normalized across character surfaces', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const runeBytes = readFileSync(new URL('../assets/characters/rune/idle/1.png', import.meta.url));
  const viperBytes = readFileSync(new URL('../assets/characters/viper/idle/1.png', import.meta.url));

  const runeSize = [runeBytes.readUInt32BE(16), runeBytes.readUInt32BE(20)];
  const viperSize = [viperBytes.readUInt32BE(16), viperBytes.readUInt32BE(20)];

  assert.deepEqual(runeSize, [1536, 1024]);
  assert.deepEqual(viperSize, [1254, 1254]);
  assert.match(css, /\.fantasy-menu__hero-card--rune \.fantasy-menu__portrait \.art-image\s*\{[\s\S]*?scale\(1\.45\)/);
  assert.match(css, /\.character-choice--rune \.character-choice__portrait \.art-image\s*\{[\s\S]*?scale\(1\.45\)/);
  assert.match(css, /\.player-sprite--rune \.sprite-static-art > \.art-image,[\s\S]*?\.player-sprite--rune \.sprite-animation-frame\s*\{[\s\S]*?scale\(1\.45\)/);
});


test('artwork fallbacks never show two-letter initials', () => {
  const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(renderSource, /slice\(0,\s*2\)/);
  assert.doesNotMatch(renderSource, /art-fallback/);
  assert.doesNotMatch(renderSource, /handbook-character__badge/);
  assert.doesNotMatch(css, /\.art-fallback/);
  assert.doesNotMatch(css, /\.handbook-character__badge/);
  assert.match(
    renderSource,
    /function artMarkup\(path, alt, extraClass = ''\)[\s\S]*?onerror="this\.hidden=true"/,
  );
});


test('enemy damage cannot reduce combo below zero', () => {
  const game = new Game();
  game.startRun('weekly');
  game.chooseHeat(0);
  game.state.score.combo = 2;
  game.state.player.block = 0;

  const enemy = game.state.enemies[0];
  enemy.baseDamage = 5;
  enemy.strength = 0;
  enemy.scaling = 0;
  enemy.trait = null;
  enemy.turn = 0;

  game.enemyTurn();

  assert.equal(game.state.score.combo, 0);
});


test('asset entrypoints are cache-busted and Pages deploys latest push', () => {
  const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pagesWorkflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

  assert.match(indexSource, /styles\.css\?v=20260924-cardtext6/);
  assert.match(indexSource, /src\/main\.js\?v=20260924-assets2/);
  assert.match(pagesWorkflow, /concurrency:[\s\S]*?cancel-in-progress:\s*true/);
});


test('cards have no outer border', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\/\* Card presentation overrides \*\/[\s\S]*?\.combat-card,[\s\S]*?\.card,[\s\S]*?\.handbook-card\s*\{[\s\S]*?border:\s*0;/,
  );
});

test('all visible card text is black', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.combat-card,[\s\S]*?\.card,[\s\S]*?\.handbook-card,[\s\S]*?\.combat-card \*,[\s\S]*?\.card \*,[\s\S]*?\.handbook-card \*\s*\{[\s\S]*?color:\s*#000;/,
  );
});


test('logos use expanded menu and HUD space', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.fantasy-menu__masthead\s*\{[\s\S]*?justify-content:\s*center;/);
  assert.match(css, /\.fantasy-menu__identity\s*\{[\s\S]*?justify-items:\s*center;[\s\S]*?text-align:\s*center;/);
  assert.match(css, /\.fantasy-menu__logo\s*\{[\s\S]*?width:\s*clamp\(620px,\s*78vw,\s*1180px\);[\s\S]*?max-height:\s*270px;[\s\S]*?object-position:\s*center;/);
  assert.match(css, /\.hud__brand\s*\{[\s\S]*?align-items:\s*stretch;[\s\S]*?justify-content:\s*center;[\s\S]*?padding:\s*4px 8px;/);
  assert.match(css, /\.hud__logo\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?max-height:\s*58px;/);
});


test('Rune main-menu artwork is bottom-aligned without a vertical offset', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.fantasy-menu__hero-card--rune \.fantasy-menu__portrait \.art-image\s*\{[\s\S]*?object-position:\s*center bottom;[\s\S]*?transform:\s*scale\(1\.45\);[\s\S]*?transform-origin:\s*center bottom;/,
  );
  assert.doesNotMatch(
    css,
    /\.fantasy-menu__hero-card--rune \.fantasy-menu__portrait \.art-image\s*\{[^}]*translateY\(/,
  );
});


test('cards have no brown fallback fills', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.combat-card,[\s\S]*?\.card,[\s\S]*?\.handbook-card\s*\{[\s\S]*?background:\s*transparent url\('\.\/assets\/cards\/base\/card\.png\?v=20260924-card5'\)/,
  );
  assert.match(
    css,
    /\.card__art,[\s\S]*?\.handbook-card__art\s*\{[\s\S]*?background:\s*transparent;/,
  );
  assert.doesNotMatch(
    css.slice(css.indexOf('.combat-card,\n.card,\n.handbook-card {'), css.indexOf('.combat-card:hover')),
    /linear-gradient\(165deg,\s*rgba\(62,40,20/,
  );
});


test('card names and rules text are centered', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\/\* Center card title and rules text \*\/[\s\S]*?\.card__name,[\s\S]*?\.card > p,[\s\S]*?\.combat-card > p,[\s\S]*?\.handbook-card h3,[\s\S]*?\.handbook-card > p\s*\{[\s\S]*?width:\s*100%;[\s\S]*?text-align:\s*center;/,
  );
});
