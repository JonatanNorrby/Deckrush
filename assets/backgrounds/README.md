# Background PNGs

Expected assets:

- `menu.png` — main menu and hero-selection background.
- `combat.png` — legacy/default combat fallback.
- `battlefields/1.png` through `battlefields/6.png` — encounter backgrounds randomly selected when a fight starts.

The selected battlefield background is stored for that fight, so it does not change when the combat UI re-renders after cards are played.

If a numbered battlefield PNG is missing, the existing `combat.png` layer remains available as the visual fallback. CSS backgrounds remain visible even when no PNG assets are present.
