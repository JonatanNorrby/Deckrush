# Bastion — idle animation

Looping combat idle. Plays while the character is waiting for input. The first frame, `1.png`, is also used as Bastion's main-menu and character-selection artwork.

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
- Keep every frame on the same canvas size and keep Bastion aligned consistently.
- If `1.png` is missing, the game uses its CSS fallback animation instead.

Expected path example:

`assets/characters/bastion/idle/1.png`
