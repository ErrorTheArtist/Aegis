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

### Mangekyō Sharingan (Uchiha)

Kill things with your Sharingan **active** to grow it: mobs = 1 point, players = 10. At **100 points**
it awakens into the **Mangekyō Sharingan** (replaces your Sharingan item):

- 40% dodge chance (instead of 30%) and Strength while active (drains 3 chakra/sec)
- Cheaper, longer **Amaterasu** (sneak + right-click)
- **Susanoo** automatically manifests when you drop below 30% health while it's active:
  Resistance IV, extra hearts, Strength II, Regeneration (costs 30 chakra, 60s cooldown)

Check your progress with `/scriptevent aegis:clan info`.

### Clan jutsu discounts

| Clan | Cheaper jutsu |
|---|---|
| Uchiha | Fireball −40%, Chidori −30% |
| Uzumaki | Rasengan −30%, Shadow Clone −40% |
| Sarutobi | Fireball −30% |

### Bloodline Reroll Scroll

Craft: `D G D` / `G S G` / `D G D` (D = diamond, G = gold block, S = Blank Scroll).
Right-click, then right-click again within 5s to confirm. Rolls a **different** clan
(Mangekyō progress is lost).

Commands (cheats on) — handy for testing:

```
/scriptevent aegis:clan reroll
/scriptevent aegis:clan set uchiha
/scriptevent aegis:clan info
/scriptevent aegis:clan mangekyo
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
| Chidori | 35 | 4s | Charge up lightning, then lunge forward: the first thing you hit takes 13 damage. |

## Tailed Beasts (bosses)

Nine boss mobs with a boss bar, their own models and animations, a chakra aura, and a full move set:

- **Tailed Beast Bomb**: a charged orb fired from the mouth
- **Elemental special** (see table)
- **Tail Swipe** when you get close, **Leap Slam** when you run away, and a knock-back **Roar**
- Natural Resistance; at **half health** they become **enraged**: Strength III, Speed II, Resistance II,
  a burst of regeneration and much faster attacks

Attacks come every ~2–4.5 seconds (faster with more tails, ~40% faster when enraged), and damage scales with tails.

| Beast | Health | Melee | Special |
|---|---|---|---|
| Shukaku (1) | 750 | 12 | Sand Coffin: traps you in sand, then crushes |
| Matatabi (2) | 1000 | 14 | Blue fire breath (cone) |
| Isobu (3) | 1250 | 16 | Coral shockwave rings, slows |
| Son Goku (4) | 1500 | 18 | Lava rain around you |
| Kokuo (5) | 1750 | 20 | Steam-powered charge |
| Saiken (6) | 2000 | 22 | Acid mist: poison + weakness |
| Chomei (7) | 2250 | 24 | Flies up and showers blinding scale powder |
| Gyuki (8) | 2500 | 26 | Ink spray: blindness + slowness |
| Kurama (9) | 2750 | 28 | Chakra roar: huge knockback, fire, weakness |

Bring good armor, Soldier Pills and friends.

**Summon:** craft a **Tailed Beast Summoning Scroll** (`E D E` / `D S D` / `E D E`: E = eye of ender,
D = diamond, S = Blank Scroll) and use it. A random beast is released 8 blocks in front of you after a short ritual
(fewer tails = more common). Only one beast can be summoned within 64 blocks at a time. Spawn eggs are in the
creative inventory too.

**Drops:** diamonds, golden apples, Soldier Pills, a chance at a Bloodline Reroll Scroll, and lots of XP.

### Jinchūriki & Tailed Beast Mode

Land the **killing blow** and the beast is sealed inside you (a new one replaces the old):

- +50 max chakra, plus 10 per tail (Kurama: +140), and 1.3× chakra regen
- You get that beast's **Tailed Beast Cloak**, a wearable (chest slot) item. **Wear it to transform**:
  your body is wrapped in a glowing chakra shell in the beast's colour, with chakra ears and the
  beast's tails swaying behind you.
- While transformed: Strength II, Speed II, Resistance II, Jump Boost II, plus a beast perk
  (e.g. Kurama: Regeneration II + Strength III; Shukaku: Resistance III; Chomei: high jumps + slow falling;
  Matatabi/Son Goku: fire resistance; Isobu/Saiken/Gyuki: water breathing).
  Drains 3 chakra/sec (Uzumaki: 1.5) and natural chakra regen stops. When chakra runs out the cloak
  comes off by itself.
- **Hold sneak for 1.5s** while transformed to charge and fire a **Tailed Beast Bomb** (80 chakra, 20s cooldown).
- Only the beast's own Jinchūriki can wear its cloak.

```
/scriptevent aegis:bijuu summon kurama
/scriptevent aegis:bijuu seal kurama
/scriptevent aegis:bijuu release
/scriptevent aegis:bijuu info
```

Models/textures are generated by `tools/gen_bijuu.py`; boss AI lives in `behavior_pack/scripts/bijuu.js`.

## Legendary Swords

Eight swords with **3D models held in your hand**, a **passive** on every hit (plus a coloured slash mark),
and a **right-click special** with its own attack animation and slash-arc effects.

| Sword | Dmg | Passive (on hit) | Special (right-click) | Chakra / CD |
|---|---|---|---|---|
| **Kusanagi** (Sasuke) | 9 | 30%: +3 lightning | **Chidori Nagashi**: lightning dash that cuts through and paralyses everything in your path | 25 / 3s |
| **Samehada** (Kisame) | 11 | Steals chakra | **Chakra Feast**: overhead slam that drains everyone nearby — you gain chakra and health | 0 / 6s |
| **Kubikiribōchō** (Zabuza) | 12 | Heals you and repairs the blade | **Silent Killing**: 360° spinning cut, then vanish into the mist (invisibility + speed) | 20 / 5s |
| **Hiramekarei** | 10 | 25%: chakra burst | **Chakra Hammer**: giant chakra slam that launches enemies | 30 / 5s |
| **Kiba** | 9 | +3 lightning, crackles while held | **Lightning Fang**: raise the blade and call a bolt onto your target that chains to 3 more | 30 / 4s |
| **Nuibari** | 8 | Slows | **Thread Stitch**: pierce every enemy in a line, bind them and pull them together | 20 / 4s |
| **Shibuki** | 10 | 25%: mini explosion | **Explosive Tag Chain**: three blasts marching forward | 25 / 4s |
| **Chakra Blades** (Asuma) | 8 | +2 wind, wind aura while held | **Flying Wind Blade**: launch a cutting wind slash | 15 / 1.5s |

Attack animations: wide slash, overhead slam, lunge thrust, full spin and sky raise.

Recipes (crafting table):

| Sword | Pattern | Key |
|---|---|---|
| Kusanagi | ` LD` / ` DL` / `S  ` | L lightning rod, D diamond, S stick |
| Samehada | `PDP` / `PDP` / `PSP` | P prismarine shard |
| Kubikiribōchō | `III` / `IDI` / ` S ` | I iron block |
| Hiramekarei | `LDL` / `LDL` / `SLS` | L lapis block |
| Kiba | ` D ` / `LDL` / ` S ` | L lightning rod |
| Nuibari | `  I` / ` D ` / `S W` | I iron ingot, W string |
| Shibuki | `TDT` / `TDT` / ` S ` | T TNT |
| Chakra Blades | ` I ` / `FIF` / ` S ` | I iron ingot, F feather |

All swords repair with diamonds and take sword enchantments. Models are generated by `tools/gen_swords.py`;
abilities live in `behavior_pack/scripts/swords.js`.

## Visuals

- **Player animations** (played on your character, third person): hand signs before casting
  (Fireball, Shadow Clone, Substitution, clan jutsu), holding out the Rasengan, the Chidori
  charge pose, palm thrusts (Rasengan/Chidori strike, Gale Palm, Rinnegan), and a **ninja run**
  with arms swept back while sprinting.
- **3D models**: a spinning glowing **Rasengan** orb in your hand, a **fireball** that flies with
  a fire trail, and a purple **Susanoo** ribcage that wraps around you.
- **Custom particles**: Rasengan swirl, Chidori lightning crackle and burst, black Amaterasu flames,
  fire trails and explosions, smoke puffs (Substitution / Shadow Clones / Body Flicker),
  chakra aura while focusing, Byakugan markers, Nara shadows, Susanoo flames, wind gusts.

Animations: `resource_pack/animations/aegis.animation.json` · particles: `resource_pack/particles/` ·
models: `resource_pack/models/entity/`.

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
