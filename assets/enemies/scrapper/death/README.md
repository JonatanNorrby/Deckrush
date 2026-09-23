# Scrapper — death animation

Plays when this enemy is defeated.

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
- The game plays them in numerical order and stops at the first missing number.
- Up to 60 frames are supported.
- Keep every frame on the same canvas size and keep Scrapper aligned consistently.
- If `1.png` is missing, the game uses its CSS fallback animation instead.

Expected path example:

`assets/enemies/scrapper/death/1.png`
