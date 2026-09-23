# Deckrush asset pipeline

Every asset directory contains its own README with the exact filenames expected there.

## Core rule for animations

An animation is a folder containing sequential PNG files:

```
1.png
2.png
3.png
...
x.png
```

The runtime starts at `1.png` and plays upward in numerical order. It stops at the first missing frame, with a safety limit of 60 frames. There is no need to declare the frame count in code.

Examples:

```
assets/animations/characters/viper/melee/1.png
assets/animations/characters/viper/melee/2.png
assets/animations/characters/viper/melee/3.png

assets/animations/enemies/scrapper/damage/1.png
assets/animations/enemies/scrapper/damage/2.png

assets/animations/card-effects/magical/1.png
assets/animations/card-effects/magical/2.png
```

## Supported animation states

Characters:
- `idle`
- `magical`
- `melee`
- `defensive`
- `damage` — plays whenever the character takes HP damage, including self-damage.
- `death`

Enemies:
- `idle`
- `attack`
- `damage` — plays whenever that enemy takes damage.
- `death`

Shared card effects:
- `magical`
- `melee`
- `defensive`

If an animation folder has no `1.png`, Deckrush uses its built-in CSS fallback animation.

See the README inside each subfolder for the exact paths expected there.
