# Enemy animation PNGs

Create folders using:

`<enemy-id>/<state>/1.png ... x.png`

Current enemy IDs:
- `scrapper`
- `bulwark`
- `berserker`
- `parasite`
- `bomber`
- `enforcer`
- `collector`
- `auditor`

Supported states for every enemy:
- `idle`
- `attack`
- `damage`
- `death`

Examples:

```
scrapper/idle/1.png
scrapper/attack/1.png
scrapper/damage/1.png
scrapper/death/1.png

auditor/idle/1.png
auditor/attack/1.png
auditor/damage/1.png
auditor/death/1.png
```

`damage` plays whenever that enemy loses HP, including Poison damage. If `1.png` is absent, the CSS fallback animation is used.
