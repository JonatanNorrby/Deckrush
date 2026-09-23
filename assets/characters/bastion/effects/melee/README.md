# Bastion — melee card effect

Character-specific melee card effect. Plays with the character's melee animation.

## Required PNG files

Put the effect frames directly in this folder:

```
1.png
2.png
3.png
...
x.png
```

- `1.png` is the first required frame.
- Use consecutive numbers with no gaps.
- The effect stops at the first missing frame.
- Up to 60 frames are supported.
- Transparent PNGs are recommended.
- Keep all frames on the same canvas size.
- If `1.png` is missing, the game uses the built-in CSS effect instead.

Expected path example:

`assets/characters/bastion/effects/melee/1.png`
