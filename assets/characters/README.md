# Character assets

Every character owns all of its artwork inside one folder.

Current character folders:
- `viper/`
- `bastion/`

Expected structure for every character:

```
<character-id>/
├── portrait.png
├── combat.png
├── idle/1.png ... x.png
├── magical/1.png ... x.png
├── melee/1.png ... x.png
├── defensive/1.png ... x.png
├── damage/1.png ... x.png
├── death/1.png ... x.png
└── effects/
    ├── magical/1.png ... x.png
    ├── melee/1.png ... x.png
    └── defensive/1.png ... x.png
```

`portrait.png` is used on menus. `combat.png` is the static fallback in battle.

Character action animations and character-specific card effects are deliberately kept here rather than in a shared animation directory.
