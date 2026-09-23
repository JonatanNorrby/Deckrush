# Deckrush asset pipeline

Character and enemy art is intentionally self-contained. Do not put character/enemy animation art in a separate global animation folder.

## Animation rule

Every animation is a folder containing sequential PNG files:

```
1.png
2.png
3.png
...
x.png
```

The runtime starts at `1.png`, plays upward numerically, and stops at the first missing frame. It checks up to 60 frames.

## Characters

All art for one character lives together:

```
assets/characters/<character-id>/
├── portrait.png
├── combat.png
├── idle/
│   └── 1.png ... x.png
├── magical/
│   └── 1.png ... x.png
├── melee/
│   └── 1.png ... x.png
├── defensive/
│   └── 1.png ... x.png
├── damage/
│   └── 1.png ... x.png
├── death/
│   └── 1.png ... x.png
└── effects/
    ├── magical/
    │   └── 1.png ... x.png
    ├── melee/
    │   └── 1.png ... x.png
    └── defensive/
        └── 1.png ... x.png
```

Examples:
- `assets/characters/viper/magical/1.png`
- `assets/characters/viper/damage/1.png`
- `assets/characters/viper/effects/magical/1.png`
- `assets/characters/bastion/defensive/1.png`

## Enemies

All art for one enemy also lives together:

```
assets/enemies/<enemy-id>/
├── combat.png
├── idle/
│   └── 1.png ... x.png
├── attack/
│   └── 1.png ... x.png
├── damage/
│   └── 1.png ... x.png
└── death/
    └── 1.png ... x.png
```

Examples:
- `assets/enemies/scrapper/combat.png`
- `assets/enemies/scrapper/attack/1.png`
- `assets/enemies/scrapper/damage/1.png`
- `assets/enemies/auditor/death/1.png`

If an animation has no `1.png`, Deckrush uses the built-in CSS fallback animation.

Other asset folders such as `cards/`, `backgrounds/`, `ui/`, `effects/`, and `audio/` are for non-character/non-enemy assets. Each contains its own README.
