# Animation assets

Animations are folder-based PNG sequences.

Each animation folder must contain:

```
1.png
2.png
3.png
...
x.png
```

Frames play in numerical order starting at `1.png` and stop at the first missing number. The runtime checks up to 60 frames.

Subfolders:
- `characters/` — character idle, card-play, damage, and death animations.
- `enemies/` — enemy idle, attack, damage, and death animations.
- `card-effects/` — shared magical, melee, and defensive effects.
