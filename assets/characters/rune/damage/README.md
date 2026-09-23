# Rune — damage animation

Plays whenever this character loses HP, including self-damage cards.

## Required PNG files

Put sequential transparent PNG frames directly in this folder:

```
1.png
2.png
3.png
...
x.png
```

- The first required frame is `1.png`.
- Frames must be numbered consecutively with no gaps.
- The game plays frames in numerical order and stops at the first missing number.
- Up to 60 frames are supported.
- Keep every frame on the same canvas size and keep Rune aligned consistently.
- If `1.png` is missing, the game uses its CSS fallback animation instead.

Expected path example:

`assets/characters/rune/damage/1.png`
