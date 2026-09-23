# Deckrush

Deckrush is a fast, browser-only score-attack deckbuilder roguelite built around chaining cards, raising Combo and Score Multiplier, and squeezing as many points as possible from each fight.

## Current prototype

- Endless runs that continue until the player dies, with a boss every 8 fights.
- Two playable characters with distinct starting decks and reward pools: Viper (Poison) and Bastion (Block).
- Heat 0–3 selected before every encounter.
- Single score total: score only goes up; taking damage instead breaks Combo and reduces Multiplier.
- Combo and multiplier systems designed around high-score routing.
- 20+ data-driven cards and several enemy archetypes.
- Deterministic Daily Seed mode.
- Local personal/daily records via `localStorage`.
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
