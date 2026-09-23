# Enemy assets

Every enemy owns all of its artwork inside its own folder.

Current enemy folders:
- `scrapper/`
- `bulwark/`
- `berserker/`
- `parasite/`
- `bomber/`
- `enforcer/`
- `collector/`
- `auditor/`

Expected structure for every enemy:

```
<enemy-id>/
├── combat.png
├── idle/1.png ... x.png
├── attack/1.png ... x.png
├── damage/1.png ... x.png
└── death/1.png ... x.png
```

`combat.png` is the static fallback. `damage/` plays whenever that enemy loses HP, including Poison damage.

Frames start at `1.png` and continue until the first missing number.
