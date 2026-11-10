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

- You have **100 chakra** (more depending on your clan), shown on the action bar while holding ninja gear.
- Regenerates 4/sec. **Sneak and stand still** to *focus* (3× regen).
- Wearing the **Hidden Leaf Headband** gives 1.5× regen. **Soldier Pills** restore 50 instantly.

## Clans

The first time a player joins, they **roll a clan** (slot-machine animation, then a big reveal).
Each clan has a rarity, bonus chakra, permanent passives and a **clan-only ability item**
(can't be dropped, kept on death, re-given if lost). Epic/Legendary rolls are announced to everyone.
Your clan shows above your head, e.g. `[Uchiha] Steve`.

| Clan | Rarity | Chance | Max chakra | Passives | Ability item (right-click / **sneak** + right-click) |
|---|---|---|---|---|---|
| Otsutsuki | Legendary | 1% | 250 | Strength, Speed, Resistance, 2× regen | **Rinnegan**: Almighty Push / **Universal Pull** |
| Senju | Legendary | 3% | 180 | Regeneration, +4 hearts | **Wood Style**: Wood Wall (10s) / **Healing Jutsu** (you + nearby players) |
| Uchiha | Epic | 6% | 140 | Fire Resistance | **Sharingan**: toggle (night vision, 30% dodge, drains chakra) / **Amaterasu** (needs Sharingan on) |
| Uzumaki | Epic | 7% | 200 | +2 hearts, 1.5× regen | Adamantine Sealing Chains (freeze everything nearby) |
| Hyuga | Epic | 8% | 130 | — | **Byakugan**: toggle (see all life within 40 blocks, Gentle Fist bonus damage) / **Palm Rotation** |
| Sarutobi | Rare | 9% | 120 | Fire Resistance | Fire Style: Flame Bullet (3 fireballs) |
| Nara | Rare | 11% | 110 | — | Shadow Possession Jutsu (freeze a target for 6s) |
| Akimichi | Rare | 11% | 120 | +2 hearts | Expansion Jutsu (Strength II, Resistance II, extra hearts) |
| Aburame | Rare | 10% | 110 | — | Parasitic Insect Swarm (poison, steals chakra) |
| Inuzuka | Common | 17% | 100 | Speed, Night Vision | Fang Over Fang dash / **Summon Ninja Hound** (tamed wolf) |
| Yamanaka | Common | 17% | 100 | — | Mind Body Disturbance (nausea, blindness, slow) |

Commands (cheats on) — handy for testing:

```
/scriptevent aegis:clan reroll
/scriptevent aegis:clan set uchiha
/scriptevent aegis:clan info
```

Clan odds, stats and abilities are all in `behavior_pack/scripts/clans.js`.

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
Shadow Clone = armor stand · Body Flicker = sugar · Wind Style: Great Breakthrough = feather · Chidori = lightning rod.

All items are also in the creative inventory.

## Project layout

```
behavior_pack/   items, entities, recipes, scripts/main.js (jutsu) + scripts/clans.js (clans)
resource_pack/   textures, client entities, headband attachable
tools/gen_textures.py   regenerates the placeholder pixel art (needs Pillow)
build.sh         packages dist/ShinobiWay.mcaddon
```

Tuning (chakra costs, cooldowns, damage) lives at the top of `behavior_pack/scripts/main.js`.
The add-on uses the stable `@minecraft/server` 1.16.0 Script API.
