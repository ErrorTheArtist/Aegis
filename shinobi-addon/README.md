# Shinobi Way — a ninja add-on for Minecraft Bedrock

A Naruto-inspired ninja add-on: chakra, jutsu scrolls, kunai, shuriken, clones and more.
Names are kept original (no anime character/technique names), so it is safe to share.

## Install

1. Get `dist/ShinobiWay.mcaddon` (or run `./build.sh` to rebuild it).
2. Open the file on your device — Minecraft imports both packs automatically.
3. Create/edit a world → **Behavior Packs** → activate **Shinobi Way (Behavior)**
   (the resource pack is applied automatically).
4. Requires Minecraft Bedrock **1.21.60+**. No experimental toggles needed.

## Chakra

- You have **100 chakra**, shown on the action bar while holding ninja gear.
- Regenerates 4/sec. **Sneak and stand still** to *focus* (3× regen).
- Wearing the **Shinobi Headband** gives 1.5× regen. **Chakra Pills** restore 50 instantly.

## Jutsu (right-click the scroll to cast)

| Scroll | Chakra | Cooldown | Effect |
|---|---|---|---|
| Great Fireball | 25 | 2s | Fireball flies forward and bursts: 9 fire damage in an area, sets mobs alight. No block damage. |
| Spiral Chakra Sphere | 30 | 3s | Close-range (5 blocks) strike: 14 damage and a huge knockback. No cost if nothing is in reach. |
| Substitution | 20 | 5s | For 8s, the next hit you take is undone and you reappear behind the attacker. |
| Chakra Clones | 40 | 10s | Summons 2 clones (max 4) that fight hostile mobs for 30s. Hit your own clone to dispel it. |
| Flash Step | 10 | 0.75s | Burst of speed where you're looking, with a moment of slow-falling. |
| Gale Palm | 15 | 1.5s | Cone of wind that blasts everything in front of you away. |

## Ninja tools

- **Kunai** — throwable, 6 damage. Drops back as an item when it hits a block.
- **Shuriken** — fast throwable, 4 damage, stacks to 64.

## Recipes (crafting table)

| Item | Recipe |
|---|---|
| Kunai ×4 | 2 iron ingots diagonally + stick in the bottom-left |
| Shuriken ×8 | iron ingot in the middle, 4 iron nuggets around it (plus shape) |
| Shinobi Headband | blue wool, iron ingot, blue wool (one row) |
| Chakra Pill ×2 | sweet berries + glowstone dust + sugar (shapeless) |
| Blank Scroll | `P S P` / `P P P` (P = paper, S = stick) |
| Jutsu scrolls | Blank Scroll + lapis lazuli + catalyst (shapeless) |

Catalysts: Fireball = blaze powder · Sphere = ender pearl · Substitution = oak log ·
Clones = armor stand · Flash Step = sugar · Gale Palm = feather.

All items are also in the creative inventory.

## Project layout

```
behavior_pack/   items, entities, recipes, scripts/main.js (all jutsu logic)
resource_pack/   textures, client entities, headband attachable
tools/gen_textures.py   regenerates the placeholder pixel art (needs Pillow)
build.sh         packages dist/ShinobiWay.mcaddon
```

Tuning (chakra costs, cooldowns, damage) lives at the top of `behavior_pack/scripts/main.js`.
The add-on uses the stable `@minecraft/server` 1.16.0 Script API.
