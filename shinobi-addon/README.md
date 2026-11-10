# Naruto: Shinobi Way — a add-on for Minecraft Bedrock

A Naruto add-on: chakra, jutsu scrolls, kunai, shuriken, clones and more.
Uses the real Naruto names (Rasengan, Shadow Clone Jutsu, etc.) — personal use only.

## Install

1. Get `dist/ShinobiWay.mcaddon` (or run `./build.sh` to rebuild it).
2. Open the file on your device — Minecraft imports both packs automatically.
3. Create/edit a world → **Behavior Packs** → activate **Naruto: Shinobi Way (Behavior)**
   (the resource pack is applied automatically).
4. Requires Minecraft Bedrock **1.21.60+**. No experimental toggles needed.

## Chakra

- You have **100 chakra**, shown on the action bar while holding ninja gear.
- Regenerates 4/sec. **Sneak and stand still** to *focus* (3× regen).
- Wearing the **Hidden Leaf Headband** gives 1.5× regen. **Soldier Pills** restore 50 instantly.

## Jutsu (right-click the scroll to cast)

| Scroll | Chakra | Cooldown | Effect |
|---|---|---|---|
| Fire Style: Fireball Jutsu | 25 | 2s | Fireball flies forward and bursts: 9 fire damage in an area, sets mobs alight. No block damage. |
| Rasengan | 30 | 3s | Close-range (5 blocks) strike: 14 damage and a huge knockback. No cost if nothing is in reach. |
| Substitution Jutsu | 20 | 5s | For 8s, the next hit you take is undone and you reappear behind the attacker. |
| Shadow Clone Jutsu | 40 | 10s | Summons 2 clones (max 4) that fight hostile mobs for 30s. Hit your own clone to dispel it. |
| Body Flicker | 10 | 0.75s | Burst of speed where you're looking, with a moment of slow-falling. |
| Wind Style: Great Breakthrough | 15 | 1.5s | Cone of wind that blasts everything in front of you away. |

## Ninja tools

- **Kunai** — throwable, 6 damage. Drops back as an item when it hits a block.
- **Shuriken** — fast throwable, 4 damage, stacks to 64.

## Recipes (crafting table)

| Item | Recipe |
|---|---|
| Kunai ×4 | 2 iron ingots diagonally + stick in the bottom-left |
| Shuriken ×8 | iron ingot in the middle, 4 iron nuggets around it (plus shape) |
| Hidden Leaf Headband | blue wool, iron ingot, blue wool (one row) |
| Soldier Pill ×2 | sweet berries + glowstone dust + sugar (shapeless) |
| Blank Scroll | `P S P` / `P P P` (P = paper, S = stick) |
| Jutsu scrolls | Blank Scroll + lapis lazuli + catalyst (shapeless) |

Catalysts: Fireball = blaze powder · Rasengan = ender pearl · Substitution = oak log ·
Shadow Clone = armor stand · Body Flicker = sugar · Wind Style: Great Breakthrough = feather.

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
