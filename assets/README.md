# Deckrush asset pipeline

The game currently ships with CSS placeholders so gameplay is never blocked by missing art.

Recommended asset layout:

- `assets/cards/<card-id>.webp` — card illustration, ideally 512x320 or similar landscape crop.
- `assets/enemies/<enemy-id>.webp` — enemy illustration, ideally 768x512 with transparent or dark-compatible background.
- `assets/ui/` — logos, frames, particles and interface sprites.
- `assets/audio/` — music and SFX. Prefer `.ogg` plus `.mp3` fallback if broad compatibility is needed.

Card and enemy data both expose an `art` field. Set it to a relative asset path when final art exists; the renderer can then be extended to prefer that image over the placeholder without changing gameplay logic.
