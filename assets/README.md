# Deckrush assets

Asset documentation is colocated with the folder where the PNG belongs.

For character art, open the specific character folder:
- `assets/characters/viper/`
- `assets/characters/bastion/`
- `assets/characters/rune/`

For enemy art, open the specific enemy folder under `assets/enemies/<enemy-id>/`.

Every character/enemy root folder documents `idle/1.png` as the shared static fallback, and every animation/effect subfolder has its own README explaining the exact `1.png ... x.png` sequence required there.

Other asset categories such as `cards/`, `backgrounds/`, `ui/`, `effects/`, and `audio/` also contain their own README.


For enemies, `death/1.png ... x.png` is the death transition animation, while `dead/1.png` is the persistent corpse pose shown on the battlefield when other enemies are still alive.
