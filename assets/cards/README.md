# Card artwork

Deckrush cards use two separate artwork assets:

1. **Shared card base/frame** — one image used by every card:
   `assets/cards/base/card.png`
2. **Card-specific illustration** — the small artwork window unique to each card:
   `assets/cards/art/<card-id>.png`

The base image controls the common card shape, border, ornamentation, and overall visual frame. Do not duplicate that frame inside individual card illustrations.

The illustration filename must exactly match the card's stable `id` in `src/data/cards.js`.

Examples:

- `assets/cards/art/toxic-cut.png`
- `assets/cards/art/shield-strike.png`
- `assets/cards/art/arcane-bolt.png`
- `assets/cards/art/meteor.png`

Both layers are used in combat, reward choices, and the Handbook. If either image is missing, the existing CSS/fallback UI remains visible.
