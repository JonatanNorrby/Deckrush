# Deckrush

Deckrush is a fast, browser-only score-attack deckbuilder roguelite built around chaining cards, raising Combo and Score Multiplier, and squeezing as many points as possible from each fight.

## Current prototype

- Endless runs that continue until the player dies, with a boss every 8 fights.
- Three playable characters with distinct starting decks and reward pools: Viper (Poison), Bastion (Block), and Rune (Arcane).
- Heat 0–3 selected before every encounter.
- Single score total: score only goes up; taking damage instead breaks Combo and reduces Multiplier.
- Combo and multiplier systems designed around high-score routing.
- 40+ data-driven cards and several enemy archetypes.
- Deterministic Weekly Seed mode that resets every Monday.
- Local personal/weekly records via `localStorage`.
- Nightfall-inspired three-column main menu with a dark-fantasy hero showcase and dedicated character-selection overlay.
- Main-menu Handbook with current gameplay rules and a data-driven catalog of all available cards.
- Animation system with magical, melee and defensive card classes plus character/enemy idle, attack/cast, hit and death states. Numbered PNG frames are auto-discovered with CSS fallbacks.
- Responsive UI and zero runtime dependencies.

## Architecture

```text
index.html
styles.css
src/
  main.js
  core/
    rng.js
    storage.js
  data/
    cards.js
    characters.js
    enemies.js
  game/
    game.js
  ui/
    render.js
assets/
  cards/
  enemies/
  ui/
  audio/
```

Gameplay content is intentionally separated from the game state machine. New cards and enemies should mostly be additions to `src/data/`; new reusable mechanics belong in the effect resolver in `src/game/game.js`.

## Local development

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deployment

`main` deploys automatically to GitHub Pages through `.github/workflows/pages.yml`.
