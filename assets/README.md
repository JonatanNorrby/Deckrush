# Deckrush asset pipeline

Deckrush automatically loads PNG artwork when it exists and keeps its built-in placeholders / CSS motion when it does not.

## Static art

- `assets/cards/<card-id>.png` — card illustration.
- `assets/enemies/<enemy-id>.png` — static enemy fallback art.
- `assets/characters/viper/combat.png` — Viper static combat art.
- `assets/characters/viper/portrait.png` — Viper menu portrait.
- `assets/characters/bastion/combat.png` — Bastion static combat art.
- `assets/characters/bastion/portrait.png` — Bastion menu portrait.
- `assets/backgrounds/combat.png` — battlefield background.
- `assets/backgrounds/menu.png` — dark-fantasy menu / character-select backdrop.

## Animation system

Animations use numbered PNG frames. Start at `01` and keep numbering consecutive. The runtime discovers up to 16 frames automatically and falls back to CSS animation if frame `01` is missing.

### Character animations

Path:

`assets/animations/characters/<character-id>-<state>-<frame>.png`

Supported character states:

- `idle` — looping combat idle.
- `magical` — played a magical-class card.
- `melee` — played a melee-class card.
- `defensive` — played a defensive-class card.
- `hit` — character took damage.
- `death` — character death state.

Examples:

- `assets/animations/characters/viper-idle-01.png`
- `assets/animations/characters/viper-magical-01.png`
- `assets/animations/characters/viper-melee-01.png`
- `assets/animations/characters/bastion-defensive-01.png`
- `assets/animations/characters/bastion-hit-01.png`

### Enemy animations

Path:

`assets/animations/enemies/<enemy-id>-<state>-<frame>.png`

Supported enemy states:

- `idle` — looping combat idle.
- `attack` — enemy performs its turn attack.
- `hit` — enemy takes damage.
- `death` — enemy is defeated.

Examples:

- `assets/animations/enemies/scrapper-idle-01.png`
- `assets/animations/enemies/scrapper-attack-01.png`
- `assets/animations/enemies/bulwark-hit-01.png`
- `assets/animations/enemies/auditor-death-01.png`

Every current and future enemy uses the same naming convention automatically.

### Card-class effect animations

Every card has one animation class:

- `magical`
- `melee`
- `defensive`

Path:

`assets/animations/card-effects/<class>-<frame>.png`

Examples:

- `assets/animations/card-effects/magical-01.png`
- `assets/animations/card-effects/melee-01.png`
- `assets/animations/card-effects/defensive-01.png`

When a card is played, two animation layers can run together:

1. The active character plays its matching character state, such as `viper-magical-01.png`.
2. The shared card-class effect plays at the target or player, such as `magical-01.png`.

This means a new character can have its own casting / striking / blocking motion while still reusing the common magical, melee, and defensive impact effects.

## Card animation-class rules

Cards are classified automatically unless a card explicitly overrides `animationClass` in its data:

- Poison cards → `magical`
- Block / healing cards → `defensive`
- Attack cards → `melee`
- Other skills → `defensive`
- Score / risk / utility cards → `magical`

The Handbook displays the animation class on each card.

## Frame recommendations

Use transparent PNGs for character, enemy, and effect frames. Keep every frame for one animation on the same canvas size and keep the subject anchored consistently so it does not visually jump between frames.

Suggested starting point:

- Characters: 256×256 or 512×512 transparent PNG.
- Enemies: 256×256 or 512×512 transparent PNG.
- Card-class effects: 256×256 transparent PNG.

You can use fewer than 16 frames. For example, uploading `viper-melee-01.png` through `viper-melee-06.png` is enough; the runtime stops discovery when frame 07 is absent.

## Current IDs

Card examples:

- `toxic-cut`
- `envenom`
- `shield-strike`
- `fortify`
- `jackpot`

Enemy IDs:

- `scrapper`
- `bulwark`
- `berserker`
- `parasite`
- `bomber`
- `enforcer`
- `collector`
- `auditor`

Other reserved folders:

- `assets/effects/` — non-card combat effects.
- `assets/ui/` — frames, icons, cursors, logos.
- `assets/audio/` — music and sound effects.
