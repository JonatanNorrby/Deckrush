# Bulwark artwork

`idle/1.png` is the required fallback image for Bulwark. It is used anywhere the game needs a static enemy image and also serves as the first frame of the looping idle animation.

Expected fallback path:

```
assets/enemies/bulwark/idle/1.png
```

A separate `combat.png` fallback is no longer required.

The `idle/`, `attack/`, `damage/`, and `death/` folders contain their own READMEs explaining the exact numbered PNG sequences used by the animation system. The `dead/` folder contains the persistent `1.png` corpse pose shown after this enemy dies while other enemies remain.
