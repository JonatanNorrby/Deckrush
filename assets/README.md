# Deckrush asset pipeline

Deckrush is prepared to load PNG art automatically. You can replace the current CSS/letter placeholders by uploading files with the names below; no gameplay code changes are required.

## Expected PNG paths

- `assets/cards/<card-id>.png` — card illustration shown in combat, rewards, and the Handbook.
- `assets/enemies/<enemy-id>.png` — full enemy combat art.
- `assets/characters/viper/combat.png` — Viper combat sprite/illustration.
- `assets/characters/viper/portrait.png` — Viper menu portrait.
- `assets/characters/bastion/combat.png` — Bastion combat sprite/illustration.
- `assets/characters/bastion/portrait.png` — Bastion menu portrait.
- `assets/backgrounds/combat.png` — battlefield background.
- `assets/effects/` — future hit, poison, block, score, and card-play effects.
- `assets/ui/` — future frames, icons, energy orb art, cursor/targeting art, logos.
- `assets/audio/` — music and sound effects.

## Naming examples

Card IDs are the stable names already used by the game, so examples include:

- `assets/cards/toxic-cut.png`
- `assets/cards/envenom.png`
- `assets/cards/shield-strike.png`
- `assets/cards/fortify.png`
- `assets/cards/jackpot.png`

Enemy IDs currently include:

- `assets/enemies/scrapper.png`
- `assets/enemies/bulwark.png`
- `assets/enemies/berserker.png`
- `assets/enemies/parasite.png`
- `assets/enemies/bomber.png`
- `assets/enemies/enforcer.png`
- `assets/enemies/collector.png`
- `assets/enemies/auditor.png`

Transparent PNGs are recommended for characters and enemies. Card art can be rectangular and is cropped to the card art window. If an expected PNG is missing, Deckrush automatically keeps the built-in placeholder instead of showing a broken image.
