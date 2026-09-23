# Rune artwork

`idle/1.png` is the required fallback image for Rune. It is used anywhere the game needs a static character image and also serves as the first frame of the looping idle animation.

Expected fallback path:

```
assets/characters/rune/idle/1.png
```

A separate `combat.png` fallback is no longer required.

The `idle/`, `magical/`, `melee/`, `defensive/`, `damage/`, `death/`, and `effects/` folders contain their own READMEs explaining the exact numbered PNG sequences used by the animation system.


## Canvas note

Rune's current source artwork uses a **1536 × 1024 landscape canvas**, unlike Viper and Bastion's square canvases. The UI applies Rune-specific display scaling so his visible character size stays consistent in the main menu, character picker, and battlefield. Keep future Rune frames aligned to the same 1536 × 1024 canvas unless the whole Rune animation set is migrated together.
