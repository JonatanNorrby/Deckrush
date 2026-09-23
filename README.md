# Deckrush

Deckrush is a fast, browser-only score-attack deckbuilder roguelite. A complete run is capped at 10 minutes and is built around greed: increase Combo and Score Multiplier, expose points to risk, then bank them before enemies hit back.

## Current prototype

- 8-encounter runs ending in a boss.
- Heat 0–3 selected before every encounter.
- Banked vs exposed score: taking damage destroys 25% of exposed score.
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
