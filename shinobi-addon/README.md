# Way of The Shinobi

*The Best Naruto Addon made by \_errorlegend*

A Naruto add-on: chakra, jutsu scrolls, kunai, shuriken, clones and more.
Uses the real Naruto names (Rasengan, Shadow Clone Jutsu, etc.) — personal use only.

## Install

1. Get `dist/WayOfTheShinobi.mcaddon` (or run `./build.sh` to rebuild it).
2. Open the file on your device — Minecraft imports both packs automatically.
3. Create/edit a world → **Behavior Packs** → activate **Way of The Shinobi**
   (the resource pack is applied automatically).
4. Requires Minecraft Bedrock **1.21.60+**. No experimental toggles needed.

## Chakra

- You have **100 chakra** (more depending on your clan, Tailed Beast and stats), shown on the chakra bar in the top-left.
- Regenerates 4/sec. **Sneak and stand still** to *focus* (3× regen).
- Wearing the **Hidden Leaf Headband** gives 1.5× regen. **Soldier Pills** restore 50 instantly.

## Levels & Stats

You start at **Level 1**; the max is **Level 200**. Each level gives **3 stat points**
(+3 bonus at level 200, so 600 total — enough to max every stat).

**XP sources**
- Kills: 3 XP per point of the victim's max health (zombie ≈ 60, Kurama ≈ 8,250)
- Player kills: 60 + 6 × their level
- Casting any jutsu, clan ability or sword special: 3 + half its chakra cost

XP needed per level grows: 52 XP for level 2, ~1,800 around level 60, ~12,400 for the last levels
(about 908,000 XP total from 1 to 200).

**Stats** (max 100 each) — spend points with the **Shinobi Record** (you get one on first join; craft another
from a book + Blank Scroll), or `/scriptevent aegis:stats`:

| Stat | Effect |
|---|---|
| Vitality | +2 hearts every 10 points (up to +20 hearts) |
| Chakra | +2 max chakra and +0.5% chakra regen per point (+200 chakra, +50% regen at 100) |
| Taijutsu | Strength I/II/III/IV at 25/50/75/100 (stacks with clan Strength) |
| Ninjutsu | +1% damage for jutsu, clan abilities and sword specials per point (+100% at 100) |
| Agility | Speed I–IV at 25/50/75/100 and −0.25% jutsu cooldowns per point (−25% at 100) |
| Endurance | Shrug off 0.3% of all damage taken per point (30% at 100) |

The menu shows your XP bar, unspent points and every stat; tap a stat and use the slider to add points.
**Reset stats** refunds everything. Your level shows above your head and on the chakra bar.

```
/scriptevent aegis:stats
/scriptevent aegis:level set 50
/scriptevent aegis:level xp 5000
```

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
| Uzumaki | Epic | 7% | 200 | +2 hearts, 1.5× regen | Adamantine Sealing Chains (freeze everything nearby) / **Four Symbols Seal** (seal Tailed Beasts alive, master your own) |
| Hyuga | Epic | 8% | 130 | — | **Byakugan**: toggle (see all life within 40 blocks, Gentle Fist bonus damage) / **Palm Rotation** |
| Yuki | Epic | 5% | 150 | Resistance | **Ice Release**: Demonic Mirroring Ice Crystals / **Ice Dome** (freeze everything nearby) |
| Terumi | Epic | 4% | 160 | Fire Resistance | **Lava Release**: Melting Apparition (lava cone) / **Boil Release: Skilled Mist** (acid cloud) |
| Hōzuki | Rare | 6% | 120 | Water breathing, fast swimming | Water Gun / **Hydrification** (attacks pass through you for 6s) |
| Sarutobi | Rare | 7% | 120 | Fire Resistance | Fire Style: Flame Bullet (3 fireballs) |
| Nara | Rare | 9% | 110 | — | Shadow Possession Jutsu (freeze a target for 6s) |
| Akimichi | Rare | 9% | 120 | +2 hearts | Expansion Jutsu (Strength II, Resistance II, extra hearts) |
| Aburame | Rare | 9% | 110 | — | Parasitic Insect Swarm (poison, steals chakra) |
| Inuzuka | Common | 13% | 100 | Speed, Night Vision | Fang Over Fang dash / **Summon Ninja Hound** (tamed wolf) |
| Yamanaka | Common | 13% | 100 | — | Mind Body Disturbance (nausea, blindness, slow) |

### Chakra natures (basic releases)

Everyone rolls a **chakra nature** a few seconds after their first join (older players get one on their next join):
🔥 **Fire**, 🌪️ **Wind**, ⚡ **Lightning**, 🪨 **Earth** or 🌊 **Water Release**. Jutsu of a release you have
**cost 25% less chakra** and **deal 25% more damage** (the action bar shows *(affinity)*). Anyone can still cast every
basic jutsu — affinity just makes them better.

| Release | Jutsu |
|---|---|
| Fire | Fireball, Phoenix Sage Fire, Great Fire Annihilation |
| Wind | Great Breakthrough, Vacuum Bullets, Rasenshuriken |
| Lightning | Chidori, Chidori Current, Chidori Sharp Spear, Kirin |
| Earth | Earth Wall, Earth Spikes |
| Water | Water Dragon Bullet, Water Prison |

Learn more releases at the **Jutsu Sensei** (*Chakra Nature Training*): 2nd release Lv 25 / 2,400 Ryō, 3rd Lv 50 / 4,000,
4th Lv 90 / 5,600, 5th Lv 140 / 6,400. `/scriptevent aegis:nature info|reroll|add <nature>|set <nature>` for testing.

### Kekkei genkai releases (clan-bound)

These scrolls can **only be cast by their clan** (anyone else gets *"Only the Senju Clan can use Wood Release"*).
They aren't craftable — a **Clan Elder** of that clan sells them to its members.

| Clan | Release scroll | Chakra / cd | Effect |
|---|---|---|---|
| Senju | **Wood Release: Deep Forest Emergence** | 50 / 15s | Trees and roots burst from the ground around you (for 12s); everything within 9 blocks takes 8 dmg and is bound in place for 3.5s |
| Senju | **Wood Release: Wood Dragon** | 60 / 18s | A wooden dragon snakes to your target: 14 dmg, binds it, and **drains 40 chakra** from players (heals you vs mobs) |
| Uchiha | **Blaze Release: Kagutsuchi Spears** | 45 / 8s | Three spears of black flame: 9 dmg each and long-burning fire |
| Uchiha | **Blaze Release: Black Flame Barrier** | 55 / 20s | A ring of black flames around you for 6s burns and pushes back anything inside it; you get Fire Resistance |
| Yuki | **Ice Release: Thousand Needles of Death** | 45 / 8s | A ring of ice needles closes in on the target: 16 dmg + slow |
| Yuki | **Ice Release: Black Dragon Blizzard** | 50 / 12s | An ice dragon crashes into the target: 18 dmg in a big area, Slowness IV, Mining Fatigue |
| Terumi | **Lava Release: Lava Globs** | 45 / 9s | Three globs of lava: 10 dmg each, sets on fire, weakens |
| Terumi | **Boil Release: Unrivalled Strength** | 40 / 30s | 15s of Strength II + Resistance; every punch bursts with steam (+3 burn dmg, big knockback) |

### Mangekyō Sharingan (Uchiha)

Kill things with your Sharingan **active** to grow it: mobs = 1 point, players = 10. At **100 points**
it awakens into the **Mangekyō Sharingan** (replaces your Sharingan item):

- 40% dodge chance (instead of 30%) and Strength while active (drains 3 chakra/sec)
- Cheaper, longer **Amaterasu** (sneak + right-click)
- **Susanoo** automatically manifests when you drop below 30% health while it's active:
  Resistance IV, extra hearts, Strength II, Regeneration (costs 30 chakra, 60s cooldown)

Check your progress with `/scriptevent aegis:clan info`.

### Eternal Mangekyō Sharingan (Uchiha)

Uchiha with the Mangekyō can awaken the **Eternal Mangekyō** at an **Uchiha Clan Elder** (Lv 100, 6,400 Ryō).
It replaces your Mangekyō item:

- half the chakra drain (1.5/sec), **50% dodge**, Strength II + Speed while active
- cheaper, stronger **Amaterasu** (30 chakra, 7s cooldown, 8 pulses)
- **Susanoo** every 30s instead of 60s, with longer Resistance IV

`/scriptevent aegis:clan eternal` awakens it instantly for testing.

### Sage Mode

Learn it from a **Jutsu Sensei** (Sage Training: Lv 60, 4,800 Ryō). Then **hold sneak and stand still for 5 seconds**
to gather natural energy (a green bar fills on the action bar) and enter **Sage Mode** for 60 seconds:

- **full chakra** on entering
- Strength II, Speed II, Resistance, Jump Boost II
- **+50% damage** for all jutsu, clan abilities and sword specials (stacks with Ninjutsu)
- you **sense hostile mobs** within 32 blocks (glowing markers)

2 minute cooldown after it ends. Can't be gathered while in Tailed Beast Mode.
`/scriptevent aegis:sage learn` teaches it instantly for testing.

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
| Fire Style: Phoenix Sage Fire | 30 | 3s | Breathe a fan of 5 fireballs (5 fire damage each). |
| Water Style: Water Dragon Bullet | 35 | 4s | Heavy water orb: 14 damage in a 4-block splash, big knockback, slows. |
| Earth Style: Earth Wall | 25 | 10s | Slam the ground: a 7×4 mud-brick wall erupts in front of you for 15s, launching enemies. |
| Lightning Style: Chidori Current | 30 | 6s | Lightning bursts from your whole body: 8 damage and a stun to everything within 5 blocks. |
| Wind Style: Rasenshuriken | 60 | 12s | Form the spinning shuriken overhead and hurl it: 22 damage, then a storm of wind blades keeps cutting (5 × 4). |
| Mystical Palm Technique | 25 | 5s | Heal the player/companion you're looking at (or yourself): +12 HP over 1s and Regeneration II. |
| Wind Style: Vacuum Bullets | 30 | 3s | Five compressed air bullets in quick succession: 6 damage + strong knockback each. |
| Earth Style: Earth Spikes | 35 | 5s | A 14-block line of stone spikes rips out of the ground: 10 damage, launches and slows (spikes crumble after 4s). |
| Water Style: Water Prison | 35 | 12s | Trap the target you look at (12 blocks) in a sphere of water for 5s (2s on bosses): can't move, 3 drowning damage per second. |
| Lightning Style: Chidori Sharp Spear | 40 | 5s | The Chidori stretches into a 16-block lightning blade that pierces everything in line: 12 damage + stun. |
| Fire Style: Great Fire Annihilation | 55 | 10s | A huge wall of fire that widens as it rolls forward: up to 3 × 6 fire damage and sets everything alight. |
| Eight Inner Gates Release | 50 | 60s | 20s of Strength III, Speed III, Haste, Jump Boost and Resistance; every punch blasts enemies away. Afterwards: exhaustion and −2 hearts. |
| Lightning Style: Kirin | 80 | 20s | Aim at a spot up to 48 blocks away: storm clouds gather, then a dragon of lightning crashes down — 28 damage in 5 blocks. |

Thousand Needles of Death is now a **Yuki-only Ice Release** (see Clans). Clan discounts on the new scrolls: **Uchiha** — Great Fire Annihilation, Kirin, Chidori Sharp Spear · **Sarutobi** — Great
Fire Annihilation · **Senju** — Earth Spikes · **Hyuga** — Vacuum Bullets. All of them are sold by the Jutsu Sensei
(unlocked from level 10 to 70) and are craftable.

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

### Uzumaki: Four Symbols Seal & mastering your beast

Only the **Uzumaki** can do this (sneak + use the **Sealing Chains**):

- **Seal a Tailed Beast alive** — needs **100 Chakra and 100 Vitality** stats, 150 chakra, and the beast weakened
  **below half health**. Look at it, choose who becomes the Jinchūriki (**yourself or any player within 16 blocks**),
  and golden chains bind it for a 3-second ritual. The beast isn't killed — it's sealed straight into that player.
  You get the XP. 60 s cooldown. Stay within 40 blocks or the seal breaks.
- **Open the seal** — an Uzumaki who carries a beast (sneak + use the chains with no beast in sight) can face the
  **dark half of their beast** (60% health, 4 minutes). Defeat it to **master** your beast, like Naruto with Kurama:
  - Tailed Beast Mode **no longer drains chakra** and chakra regen keeps working
  - Strength III, Resistance III and Regeneration while transformed (plus the beast's perk), golden aura
  - Tailed Beast Bomb costs **40** chakra, **10 s** cooldown, 45 damage with a bigger blast

  Sealing a different beast into you later resets mastery.

**The seal can break:** a Jinchūriki who **dies 3 times** loses their Tailed Beast — it breaks free as a boss where they
fell and all Jinchūriki powers (chakra bonus, cloak, mastery) are gone. Sealing a beast resets the count;
`/scriptevent aegis:bijuu info` shows how many lives the seal has left. If you fall in the trial, the seal closes and you can try again.

```
/scriptevent aegis:bijuu summon kurama
/scriptevent aegis:bijuu seal kurama
/scriptevent aegis:bijuu master
/scriptevent aegis:bijuu release
/scriptevent aegis:bijuu info
```

Models/textures are generated by `tools/gen_bijuu.py`; boss AI lives in `behavior_pack/scripts/bijuu.js`.

## Armor & clothing

3D wearable pieces (they follow your body when you move) with a **set bonus** when the whole set is worn:

| Set | Pieces | Set bonus |
|---|---|---|
| **Leaf Shinobi** | Hidden Leaf Headband, Leaf Flak Jacket, Shinobi Pants, Ninja Sandals | Speed, Resistance, +25% chakra regen |
| **Anbu** | Anbu Mask, Anbu Armor (+ Shinobi Pants, Ninja Sandals) | Speed II, night vision, **invisible while sneaking** |
| **Akatsuki** | Akatsuki Straw Hat, Akatsuki Cloak | +60 max chakra, +20% technique damage, fire resistance |
| **Samurai** | Kabuto, Dō, Haidate, Suneate | Resistance II, Strength |

Recipes (crafting table): Flak Jacket `L L`/`GLG`/`GGG` (leather, green wool) · Shinobi Pants `BBB`/`B B`/`B B` (blue wool) ·
Ninja Sandals `S S`/`B B` (string, blue wool) · Anbu Mask `BRB`/`BBB` (bone, red dye) · Anbu Armor `I I`/`IBI`/`III`
(iron, black wool) · Akatsuki Cloak `B B`/`BRB`/`BBB` (black wool, red dye) · Akatsuki Hat `WWW`/`WSW` (wheat, string) ·
Samurai: Kabuto `IGI`/`I I`, Dō `I I`/`IRI`/`III`, Haidate `III`/`R R`/`I I`, Suneate `R R`/`I I` (iron, gold, red wool).
The Weaponsmith sells the Leaf, Anbu and Samurai pieces; Akatsuki drop their gear.

### The Five Kage sets

Each Kage set is a white Kage **hat** (with the village crest and back cloth), **robe**, **pants** and **sandals** in the
village's colour. Wear all four for the set bonus:

| Set | Colour | Set bonus |
|---|---|---|
| 🔥 **Hokage** (Hidden Leaf) | Red | **Will of Fire**: +100 max chakra, +50% regen, Strength, Regeneration, Fire Resistance |
| 🏜️ **Kazekage** (Hidden Sand) | Green | **Sand Shield**: 30% chance a hit is blocked completely, +120 max chakra, Resistance II, Speed |
| 🌊 **Mizukage** (Hidden Mist) | Blue | **Hidden Mist**: invisible while sneaking, +15% technique damage, +100 max chakra, breathe underwater |
| ⚡ **Raikage** (Hidden Cloud) | Yellow | **Lightning Armor**: 35% of punches crackle (+4 lightning dmg, slow), Speed II, Strength II, Haste II, +15% damage |
| 🪨 **Tsuchikage** (Hidden Stone) | Brown | **Flight Jutsu**: float while sneaking in mid-air, Resistance III, Jump Boost II, +100 max chakra |

**Titles chosen by the server owner:** the exams stop at **Jōnin**. **Sannin** and **Kage** can only be given by the
server owner (Kage > Sannin > rank on the name tag):

```
/execute as PlayerName run scriptevent aegis:sannin jiraiya   (title + Jiraiya's set; also tsunade / orochimaru)
/execute as PlayerName run scriptevent aegis:sannin           (title only)
/execute as PlayerName run scriptevent aegis:sannin clear     (remove the title)
```

### The Legendary Sannin sets

Four 3D pieces each, given only with the Sannin command. Wear all four for the bonus:

| Set | Pieces | Set bonus |
|---|---|---|
| 🐸 **Jiraiya — Toad Sage** | Horned headband, red haori with the giant scroll, olive pants, wooden geta | +120 max chakra, +10% technique damage, Strength, Resistance, Jump Boost III |
| 🐌 **Tsunade — Slug Princess** | Byakugō seal with blonde pigtails, green haori with the gamble mark, navy pants, sandals | Regeneration II, Strength II, **25% of punches send enemies flying**, +100 max chakra |
| 🐍 **Orochimaru — Snake Sage** | Long black hair, pale robe with the purple rope bow, dark pants, sandals | **Immune to poison & wither**, **30% of hits poison**, Speed II, night vision, +15% damage, +120 max chakra |

**Becoming Kage:** Kage are **chosen by the server owner** — no NPC, exam, recipe or boss gives a Kage set or title.
When you appoint someone, they get that Kage's full set and their name tag shows the title
(e.g. `[Uchiha] Hokage Lv.120 Steve`).

Appoint a Kage (cheats on, or from a command block):

```
/execute as PlayerName run scriptevent aegis:kage hokage      (or kazekage / mizukage / raikage / tsuchikage)
/execute as PlayerName run scriptevent aegis:kage title raikage   (title only, no items)
/execute as PlayerName run scriptevent aegis:kage clear           (remove the title)
```

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

**Use the special:** right-click (hold use on mobile) with the sword, **or sneak + hit an enemy**.
All swords repair with diamonds and take sword enchantments. Models and icons are generated by `tools/gen_swords.py`
(held placement copies the vanilla trident's bound-bone setup);
abilities live in `behavior_pack/scripts/swords.js`.

## HUD

The vanilla hearts are replaced by a custom HUD in the **top-left corner**, in a slanted-bar style:
**HP bar** (red) and **Chakra bar** (blue) with their values, **Level**, the **XP bar** (yellow, `xp/needed XP`) and
**Points** (unspent stat points). Big titles (level up, clan reveal, Tailed Beasts…) show as normal Minecraft titles;
the HUD steps aside for those few seconds.

How it works: `behavior_pack/scripts/hud.js` sends the data in the title/subtitle text and
`resource_pack/ui/hud_screen.json` (generated by `tools/gen_hud.py`) reads it with only two reliable JSON UI
operations: comparing the *start* of the string (bar fills, two-letter codes) and showing the whole string (the
values — the leading codes are drawn black on each bar's black tab). Other add-ons or `/title` commands get
overwritten by the HUD.

## Cinematics & sound

Big moments play an anime-style **transformation cinematic** (≈4.5 s): the camera swings around you while lightning
pillars, shattered debris and anime flames erupt and you power up → the screen cuts to black → you're revealed in a
burst with a coloured sky, a spinning ground vortex and lightning streaks. Movement is locked during the sequence and
everything (camera, sky, controls) is restored afterwards.

| Triggers the cinematic | Colour |
|---|---|
| Entering Tailed Beast Mode (wearing your cloak) | your beast's colour (gold when mastered) |
| Mastering your Tailed Beast | gold |
| Sage Mode | green |
| Awakening the Mangekyō / Eternal Mangekyō | red / purple |

Other effects: Tailed Beasts **awaken** (summon / rage) with lightning pillars, a vortex, a red-tinted sky for nearby
players, screen shake and a roar; Tailed Beast Bombs, Rasengan, Chidori, Rasenshuriken, Fireball, Water Dragon, Earth
Wall, Chidori Current, Almighty Push, Susanoo, Sealing Chains and heavy sword specials hit with **shockwave rings,
debris and camera shake**. Tailed Beast Mode and Sage Mode keep a spinning vortex under you.

**Custom sound effects** (synthesized by `tools/gen_cinematic.py`): charge-up, boom, transformation, lightning
crackle, aura rumble, sword slash, Rasengan whirl, Chidori chirping, fire roar, impact, whoosh, sealing chime and beast
roar (`resource_pack/sounds/aegis/`).

## NPCs

### NPC Spawner (creative only)

The **NPC Spawner** block is only in the creative inventory (no recipe, drops nothing).

1. Place it — a settings form opens.
2. **Cover it** with any block(s). The NPC appears in the first free space above it.
3. Tap the block again in creative (or **sneak + talk** to one of its NPCs, or `/scriptevent aegis:spawner`
   while looking at it) to: **Configure**, **Respawn now**, **Remove NPCs**, or **Delete spawner**.

Settings: NPC type · name (colour codes work) · outfit (16) · clan (Clan Elder) · Akatsuki member ·
how many to keep spawned (1–6) · respawn on/off + delay (5–600 s) · stay in place / wander radius ·
invulnerable · shop prices / mission rewards % · greeting line · spawn height (0 = first free space).
Friendly NPCs are leashed to their spawner; breaking the spawner removes its NPCs.

### Ryō currency

**Ryō** is the shinobi money. Your wallet is shown on the HUD under your stat points.

- **Earn it:** enemy ninja, Akatsuki, Legends and Tailed Beasts drop **Ryō notes** (100 Ryō each) — picking them up puts
  them straight into your wallet. Missions and quests pay Ryō too.
- **Spend it:** every shop, the Clan Elder, Sage Training, nature training and recruiting Genin.
- **Pay a player / exchange emeralds:** open your **Shinobi Record → Ryō Wallet**. Old emeralds exchange for **100 Ryō
  each** (also at the Jutsu Sensei and Weaponsmith).
- Admin: `/scriptevent aegis:ryo give 5000` · `take 5000` · `set 0` (the player who runs it).

### Quest Givers (design your own quests)

Place an **NPC Spawner** and choose **Quest Giver**. Its name, outfit, greeting and count come from the normal spawner
settings; right after saving, the **Quest Settings** open (later: sneak-tap the spawner → *Quest settings*):

| Setting | |
|---|---|
| Quest title & story | what the NPC tells the player |
| Enemy to fight | any hostile mob, zombies, skeletons, spiders, creepers, any enemy ninja, Rogue / Sound / Anbu, any Akatsuki or Itachi / Kisame / Deidara, any Tailed Beast or a specific one (Shukaku … Kurama), or a Legend (Naruto, Sasuke, Tsunade, Hiruzen, Minato) |
| How many | 1–30 |
| Spawn them when the quest starts | on: they appear around the player (only those count) · off: hunt them anywhere in the world |
| Rewards | Ryō, XP, and an item — pick one from the list or use **the item in your hand** (any item, any amount) |
| Minimum level · Repeatable · Time limit | 1–200 · on/off · 0–30 minutes (0 = none) |

Players talk to the Quest Giver to accept, see their progress, claim the reward or abandon. One quest at a time
(missions from the Mission Desk are separate). `/scriptevent aegis:quest` shows your current quest, `… abandon` drops it.

### Friendly NPCs (talk to them)

| NPC | What they do |
|---|---|
| **Jutsu Sensei** | Sells jutsu scrolls (Fireball → Rasengan/Chidori), Summoning scrolls and **Sage Training** (Lv 60); level requirements apply |
| **Weaponsmith** | Kunai, shuriken, headbands, all 8 legendary swords (Lv 15–35), repairs the item in your hand |
| **Ramen Shop** | Ichiraku Ramen (heal + 60 chakra + regen), Miso Ramen (+30 chakra + speed), Soldier Pills |
| **Hokage (Mission Desk)** | D/C/B/A/S missions (kill mobs, ninja, a Tailed Beast, an Akatsuki member) for XP, Ryō and items |
| **Exam Proctor** | Rank exams: **Chūnin** (Lv 20, beat 4 rogue ninja in 90 s), **Jōnin** (Lv 60, 3 Anbu + 3 Sound in 2 min), nothing higher — exams stop at Jōnin. Ranks show on your name tag and give +5/+10 stat points |
| **Clan Elder** | For their clan: **Clan Mastery** 1–3 (+10% clan max chakra, −10% clan ability cooldowns each); the Uchiha Elder also awakens the **Eternal Mangekyō**. Others: **Bloodline transfer** into that clan (6,400 Ryō, Lv 30) |
| **Leaf Shinobi** | Chatter and tips |
| **Genin** | Recruit for 1,500 Ryō — follows you, fights, levels up to 10 (Strength, Resistance, hearts). Talk to toggle follow/stay or dismiss |

Shops use **Ryō** — see *Ryō currency* below.

### Enemies

- **Rogue ninja** (kunai, Fireball, Substitution), **Sound ninja** (sound-wave blast, nausea), **Rogue Anbu** (blink
  behind you and strike) **wander the overworld day and night** in groups of 1–3 (more in the dark/underground).
  Killing them gives XP (and levels), Ryō, kunai and pills.
- **Akatsuki bosses** with boss bars: **Itachi** (Amaterasu, Tsukuyomi, Fireball, crow Substitution),
  **Kisame** (Water Shark Bomb, Water Prison, Samehada chakra drain), **Deidara** (C1 clay birds, telegraphed C3
  blast, keeps his distance). They **rarely roam the world** (Normal/Hard difficulty — you get a "sighted nearby"
  warning), **hunt Jinchūriki** (every 5 min, 35% chance) and appear for S-rank missions. ~1,500 XP each.

### Legendary bosses (NPC Spawner only)

These five **never spawn on their own** — place an **NPC Spawner**, choose *Legend: …* as the NPC type, and they
appear (default respawn: 5 minutes). Each has a boss bar, its own moveset, and a **second phase at half health**
(+Strength, Speed, Resistance and a chakra aura). Defeating one announces it to the server, counts toward
S-rank missions and gives big XP.

| Boss | HP | Moves | Phase 2 | Signature drops |
|---|---|---|---|---|
| **Naruto Uzumaki** | 900 | Shadow Clones (vanish in one hit, no loot), Rasengan dash, Rasenshuriken | **Nine-Tails Chakra Mode** — Tailed Beast Bomb | Rasengan scroll, Rasenshuriken, Shadow Clone |
| **Sasuke Uchiha** | 850 | Chidori lunge, Fireball, Amaterasu | **Susanoo** wraps him, **Kirin** lightning (get out of the ring!) | Chidori scroll, Kusanagi, Chidori Current |
| **Tsunade** | 950 | Chakra-enhanced punch (huge knockback), heel-drop leap, Mystical Palm heal | **Creation Rebirth** — heals half her HP once | Mystical Palm, Slug summon, Earth Wall |
| **Hiruzen Sarutobi** | 800 | Fire Dragon (triple fireball), Shuriken Shadow Clone storm, Enma staff sweep | **Reaper Death Seal** — weakness, slowness & nausea | Phoenix Flower, Great Fire Annihilation, 32 shuriken |
| **Minato Namikaze** | 750 | Flying Raijin teleport-slash, kunai volley, Rasengan from behind | **Flying Raijin barrage** — 5 blinks + Rasengan | Body Flicker scroll, 16 kunai, Rasengan |

All also drop 1,600–3,200 Ryō, diamonds and pills.

Their skins live in `tools/skins/<name>.png` (standard 64×64 Minecraft skins). Replace a file there and run
`python3 tools/gen_npcs.py` to change a skin — any NPC skin with a file in that folder uses it instead of the generated one.

### Summoning

Summoning scrolls (Sensei): **Toad** (belly-slam AoE), **Slug** (heals you, restores chakra, acid), **Snake**
(fast, poison bite). 40 chakra, 60 s cooldown, the summon fights for 45 s.

```
/scriptevent aegis:spawner           settings of the spawner you're looking at
```

NPC skins/models are generated by `tools/gen_npcs.py`; logic lives in `npcs.js`, `enemies.js` and
`companions.js`. The add-on never builds anything in your world: place NPC Spawners on your own map.

## Visuals

- **Icons**: every item has a detailed 32×32 icon — scrolls with a unique glowing emblem per jutsu, clan crests,
  shaded dōjutsu eyes, metallic kunai/shuriken, ramen, the Shinobi Record — drawn at 4× by `tools/gen_icons.py`.
  Sword and armor icons are rendered from their 3D models.
- **Animations**: every jutsu has its own animation with anticipation, follow-through and leg stances, plus an
  elemental **charge-up** (vortex under your feet, chakra streaks, flame puffs in the jutsu's colour):
  Fireball (seals → deep inhale → exhale), Phoenix Sage Fire (head sweeps the fan of flames), Rasengan (low stance,
  the other hand shapes the sphere → sprinting ram strike), Chidori (sprinter crouch → ram strike), Substitution
  (snap seal and duck), Shadow Clone (cross seal → arms flare), Body Flicker (dive low), Wind Style (twist → two-hand
  gust), Water Dragon (long flowing seal chain → palms), Earth Wall / Wood Wall (leap and slam), Chidori Current
  (chest bursts open), Rasenshuriken (held overhead → hurl), Mystical Palm (healing palms), Summoning (bite thumb →
  slam the ground), dōjutsu activation (hand sweeps the eyes), Almighty Push, Universal Pull, Sealing Chains,
  Shadow Possession (rat seal), Mind Transfer (diamond seal), Expansion (flex), Insect Swarm (sleeves thrown open),
  Fang Over Fang (spinning drill), the transformation power-up, a ninja run and five sword attacks
  (`tools/gen_player_anims.py`).

- **3D models**: a spinning glowing **Rasengan** orb in your hand, a **fireball** and **water dragon** orb that fly
  with trails, the spinning **Rasenshuriken**, and a purple **Susanoo** ribcage that wraps around you.
- **Custom particles**: Rasengan swirl, Chidori lightning crackle and burst, black Amaterasu flames,
  fire trails and explosions, smoke puffs (Substitution / Shadow Clones / Body Flicker),
  chakra aura while focusing, Byakugan markers, Nara shadows, Susanoo flames, wind gusts, water splashes,
  earth dust and green healing light.

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

New scrolls (Blank Scroll + lapis + catalyst): Phoenix = fire charge · Water Dragon = kelp · Earth Wall = stone ·
Chidori Current = copper ingot · Mystical Palm = glistering melon · Rasenshuriken = diamond block + feather.
Vacuum Bullets = wind charge · Earth Spikes = pointed dripstone · Water Prison = water bucket ·
Chidori Sharp Spear = trident · Great Fire Annihilation = blaze powder + diamond · Eight Gates = golden apple + diamond ·
Kirin = lightning rod + diamond.
All are also sold by the Jutsu Sensei.

Catalysts: Fireball = blaze powder · Rasengan = ender pearl · Substitution = oak log ·
Shadow Clone = armor stand · Body Flicker = sugar · Wind Style: Great Breakthrough = feather · Chidori = lightning rod.

All items are also in the creative inventory.

## Jutsu Clash

When two fighters throw jutsu **at each other at the same moment** (within ~0.7 s, each aiming at the other), or two
jutsu **projectiles collide** in mid-air, a manga-style cinematic plays — like Naruto's Rasengan meeting Sasuke's Chidori:

1. **CLASH!** — white flash; a wide side shot of both fighters (their own skins) charging, chakra crackling in their hands
   in their jutsu's colour (Rasengan blue, Chidori lightning, fire, water, wind, earth, Amaterasu, Wood, Ice, Lava…)
2. close-ups over each fighter's shoulder
3. both dash in — low wide angle
4. **impact**: white flash, shockwave rings, lightning pillars, explosions in both colours, huge screen shake, a tinted sky
   for everyone nearby, and a **crater** torn into the ground (cracked rim), then the camera rises over it
5. the stronger jutsu (chakra cost, a little luck; bosses hit harder) **overpowers** the other: the loser takes 30% of
   their health, the winner 8% — or "Even!" (20% each). Both are blasted apart.

Works between players and against the Legend and Akatsuki bosses (half the time, so boss fights aren't all cinematics).
The same pair can clash once every 30 s; fighters are invulnerable while it plays. Craters never touch chests, other
containers, NPC Spawners or unbreakable blocks, and are carved over a few ticks so they don't lag the server.

```
/scriptevent aegis:clash destruction off      (no craters — e.g. to protect your village; "on" to turn them back on)
/scriptevent aegis:clash test                 (clash with the player / boss you're looking at)
```

## Animations

All jutsu and sword animations are generated by `tools/gen_player_anims.py`, keyed pose-to-pose: each motion has its
own easing (snaps, overshoots, settles), the hips carry the weight (crouches, leans, twists), the whole body can hop,
step and spin, and the feet are auto-planted so stances never float. Preview any animation without opening Minecraft:

```
python3 tools/anim_preview.py gif fireball_jutsu -o fireball.gif
python3 tools/anim_preview.py sheet earth_slam ram_strike -o sheet.png
```

## Particles

All 29 effects come from `tools/gen_particles.py`: procedural textures (animated flipbooks for billowing smoke,
fireballs and flame tongues; random variants for sparks, lightning bolts and rock debris; shockwave ring, vortex,
beam, slash streak, wind swoosh, water droplet) and the effects themselves — pop-in / grow / shrink sizes,
white-hot → colour → ember colour ramps, spin, drag and gravity, flat ground shockwaves and vortexes, an imploding
Tailed Beast Bomb charge and an orbiting Rasengan. Effects use fewer, larger particles than before, so they're
lighter on weak devices. Preview them without Minecraft:

```
python3 tools/gen_particles.py --preview fire_burst smoke_puff cine_ring -o particles.png
```

## Project layout

```
behavior_pack/   items, entities, recipes, scripts/main.js (jutsu) + scripts/clans.js (clans)
resource_pack/   textures, client entities, headband attachable
tools/gen_textures.py   regenerates the placeholder pixel art (needs Pillow)
build.sh         packages dist/WayOfTheShinobi.mcaddon
```

Tuning (chakra costs, cooldowns, damage) lives at the top of `behavior_pack/scripts/main.js`.
The add-on uses the stable `@minecraft/server` 1.16.0 Script API.
