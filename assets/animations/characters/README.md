# Character animation PNGs

Create folders using:

`<character-id>/<state>/1.png ... x.png`

Current character IDs:
- `viper`
- `bastion`

Required/supported states for every character:
- `idle`
- `magical`
- `melee`
- `defensive`
- `damage`
- `death`

Examples:

```
viper/idle/1.png
viper/idle/2.png
viper/magical/1.png
viper/melee/1.png
viper/defensive/1.png
viper/damage/1.png
viper/death/1.png

bastion/idle/1.png
bastion/melee/1.png
bastion/defensive/1.png
bastion/damage/1.png
```

`damage` plays whenever the character loses HP, including self-damage cards. If `1.png` is absent, the CSS fallback animation is used.
