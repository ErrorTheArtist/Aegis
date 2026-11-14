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

## Joining: choose your village

The first time a player joins they choose one of the villages, are **teleported there** (it becomes their spawn point)
and receive a **starter kit** (Kusanagi, 8 kunai, 3 Soldier Pills, 2 ramen). Then they roll their clan, their chakra
nature, and start the starter quests. Players from before this update are asked once on their next join.

| Village | Coordinates |
|---|---|
| Hidden Leaf — Konohagakure | 500 74 -1412 |
| Hidden Sand — Sunagakure | -959 88 -175 |
| Hidden Rain — Amegakure | -192 70 -1197 |
| Hidden Stone — Iwagakure | -216 95 -1533 |
| Hidden Cloud — Kumogakure | 1980 78 -2380 |
| Hidden Mist — Kirigakure | 2135 77 -641 |

`/scriptevent aegis:village` (show) · `… home` (go back) · `… choose` (pick again). Coordinates live in
`behavior_pack/scripts/villages.js`.

### Starter quests

An automatic chain — progress on the action bar, rewards paid instantly, shown in the Shinobi Record:

| # | Quest | Goal | Reward |
|---|---|---|---|
| 1 | First Blood | defeat 5 hostile mobs | 1,000 Ryō, 300 XP |
| 2 | Chakra Control | cast 3 jutsu / clan abilities | Body Flicker scroll, 500 XP |
| 3 | Rogue Hunter | defeat 3 enemy ninja | 2,500 Ryō, 3 Soldier Pills, 800 XP |
| 4 | Growing Stronger | reach level 10 | 3,000 Ryō, Shadow Clone scroll |
| 5 | The Chūnin Exam | pass the Chūnin exam | 5,000 Ryō, Leaf Flak Jacket |
| 6 | Akatsuki Sighting | defeat any Akatsuki member | 10,000 Ryō, 5,000 XP, Rasengan scroll |

`/scriptevent aegis:starter` shows your current quests.

### Village quest lines

Every village has its own 4-quest line that runs **alongside** the starter quests (it starts when you choose your
village, and restarts if you ever change village). Patrol → master your village's release → hunt its enemies →
reach level 25 for its **signature reward**:

| Village | Quests | Release scroll (quest 1) | Enemies (quest 3) | Signature reward (quest 4) |
|---|---|---|---|---|
| Leaf | Konoha Patrol · The Fire Within · Snakes in the Grass · The Will of Fire | Fireball | 5 Sound Ninja | **Toad Summoning** scroll |
| Sand | Desert Patrol · Desert Winds · Puppet Thieves · The Sand's Shield | Great Breakthrough | 5 Rogue Ninja | **Sand Gourd** |
| Mist | Fog Patrol · The Hidden Mist · Hunter-nin · The Seven Swordsmen | Water Dragon | 5 Rogue Anbu | **Kubikiribōchō** |
| Cloud | Mountain Patrol · Storm Training · Kumo's Rivals · Lightning Armor | Chidori | 5 enemy ninja | **Chidori Current** scroll |
| Stone | Quarry Patrol · Solid as Rock · Border Skirmish · The Unmovable Stone | Earth Wall | 5 enemy ninja | **Earth Spikes** scroll |
| Rain | Rain Patrol · Endless Rain · Orphans of War · The God of Rain | Water Prison | 5 Rogue Ninja | **Akatsuki cloak** |

Quest 2 is "cast 5 jutsu of your village's release". Rewards along the way: 1,000 / 2,000 / 3,000 / 5,000 Ryō, XP and pills.

**Sand Gourd** — right-click: **Sand Coffin** (sand wraps the enemy you look at, holds them and crushes them for 14;
30 chakra, 10s). Sneak + right-click: **Sand Shield** (sand swirls around you, damage reduced for 4s; 20 chakra, 20s).

### Village loyalty

- **Village tag** over every player's head: `[Leaf] [Uchiha] Chūnin Lv.12 Name`.
- **No friendly fire** — village-mates can't hurt each other with weapons, jutsu, arrows or summons.
  For an event (tournament, exam fights): `/scriptevent aegis:village friendlyfire on` / `off`.
- **Village menu** — Shinobi Record → *Village*:
  - **Village chat** — a message only your village sees.
  - **Village leaderboard** — the villages ranked by **Village Honor**, with member counts, the current Kage and the top 3 shinobi.
  - **Return Home** — teleport to your village (10 min cooldown, not while in a fight).
- **Village Honor** — every kill earns honor for you and your village: mob 1, enemy ninja 3, Akatsuki 25,
  legend 40, Tailed Beast 60 (companions' and summons' kills count for their owner). `/scriptevent aegis:village honor` prints the board.

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

**Stats** (max 100 each) — spend points with the **Shinobi Record** (it lives in the last slot of your hotbar, locked
there: it can't be moved, dropped or lost), or `/scriptevent aegis:stats`:

| Stat | Effect |
|---|---|
| Vitality | +2 hearts every 10 points (up to +20 hearts) |
| Chakra | +2 max chakra and +0.5% chakra regen per point (+200 chakra, +50% regen at 100) |
| Taijutsu | Strength I/II/III/IV at 25/50/75/100 (stacks with clan Strength), and +1% damage for punch combos and taijutsu scrolls per point |
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
| Fire | Fireball, Phoenix Sage Fire, Great Fire Annihilation, Dragon Flame Bullet, Ash Pile Burning |
| Wind | Great Breakthrough, Vacuum Bullets, Rasenshuriken, Sickle Weasel, Pressure Damage |
| Lightning | Chidori, Chidori Current, Chidori Sharp Spear, Kirin, Lightning Hound, Lightning Release Armour |
| Earth | Earth Wall, Earth Spikes, Earth Dragon Bullet, Headhunter Jutsu, Swamp of the Underworld |
| Water | Water Dragon Bullet, Water Prison, Water Shark Bomb, Hiding in Mist, Exploding Water Shockwave |

Learn more releases at the **Jutsu Sensei** (*Chakra Nature Training*): 2nd release Lv 25 / 2,400 Ryō, 3rd Lv 50 / 4,000,
4th Lv 90 / 5,600, 5th Lv 140 / 6,400. `/scriptevent aegis:nature info|reroll|add <nature>|set <nature>` for testing.

### Kekkei genkai releases (clan-bound)

These scrolls can **only be cast by their clan** (anyone else gets *"Only the Senju Clan can use Wood Release"*).
Only a **Clan Elder** of that clan sells them, and only to its members.

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

Where to get one: the **Travelling Merchant** (3,000 Ryō — one turns up in about 2 of every 5 restocks), Tailed
Beasts and Akatsuki (a chance in their drops), or a Quest Giver's reward. There is no crafting recipe.
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
| Rasengan | 30 | 2.5s | Form it in your palm and lunge: the first thing you reach takes **22** damage, is dazed and blasted away; anyone close by takes 8. |
| Substitution Jutsu | 20 | 5s | For 8s, the next hit you take is undone and you reappear behind the attacker. |
| Shadow Clone Jutsu | 40 | 10s | Summons 2 clones (max 4) that fight hostile mobs for 30s. Hit your own clone to dispel it. |
| Body Flicker | 10 | 0.75s | Burst of speed where you're looking, with a moment of slow-falling. |
| Wind Style: Great Breakthrough | 15 | 1.5s | Cone of wind that blasts everything in front of you away. |
| Chidori | 35 | 3s | Charge up lightning, then lunge: the first thing you hit takes **24** damage and is paralysed for 1.5s, and the current arcs to the two closest enemies around it (8 each). |
| Fire Style: Phoenix Sage Fire | 30 | 3s | Breathe a fan of 5 fireballs (5 fire damage each). |
| Water Style: Water Dragon Bullet | 35 | 4s | Heavy water orb: 14 damage in a 4-block splash, big knockback, slows. |
| Earth Style: Earth Wall | 25 | 10s | Slam the ground: a 7×4 mud-brick wall erupts in front of you for 15s, launching enemies. |
| Lightning Style: Chidori Current | 30 | 5s | Lightning bursts from your whole body: **14** damage and a 3s paralysis to everything within **7** blocks, then a second pulse (6) half a second later. |
| Wind Style: Rasenshuriken | 60 | 10s | Form the spinning shuriken overhead and hurl it at what you aim at: **34** damage in 6.5 blocks, then a storm of wind blades keeps cutting and slowing (6 × 6). |
| Mystical Palm Technique | 25 | 5s | Heal the player/companion you're looking at (or yourself): +12 HP over 1s and Regeneration II. |
| Wind Style: Vacuum Bullets | 30 | 3s | Five compressed air bullets in quick succession: 6 damage + strong knockback each. |
| Earth Style: Earth Spikes | 35 | 5s | A 14-block line of stone spikes rips out of the ground: 10 damage, launches and slows (spikes crumble after 4s). |
| Water Style: Water Prison | 35 | 12s | Trap the target you look at (12 blocks) in a sphere of water for 5s (2s on bosses): can't move, 3 drowning damage per second. |
| Lightning Style: Chidori Sharp Spear | 40 | 4s | The Chidori stretches into a **22-block** lightning blade that pierces everything in line: **22** damage and a 3s paralysis. |
| Fire Style: Great Fire Annihilation | 55 | 10s | A huge wall of fire that widens as it rolls forward: up to 3 × 6 fire damage and sets everything alight. |
| Eight Inner Gates Release | 50 | 60s | 20s of Strength III, Speed III, Haste, Jump Boost and Resistance; every punch blasts enemies away. Afterwards: exhaustion and −2 hearts. |
| Lightning Style: Kirin | 80 | 20s | Aim at a spot up to 48 blocks away: storm clouds gather, then a dragon of lightning crashes down — 28 damage in 5 blocks. |

Thousand Needles of Death is now a **Yuki-only Ice Release** (see Clans). Clan discounts on the new scrolls: **Uchiha** — Great Fire Annihilation, Kirin, Chidori Sharp Spear · **Sarutobi** — Great
Fire Annihilation · **Senju** — Earth Spikes · **Hyuga** — Vacuum Bullets. All of them are sold by the Jutsu Sensei
(unlocked from level 10 to 70).

### More jutsu — anyone can learn these (v1.40)

19 more scrolls that belong to no clan. Buy them from the Jutsu Sensei (level and price below), or catch one cheap at
the Travelling Merchant.
Elemental ones get your **chakra-nature affinity** (−25% chakra, +25% damage). Jutsu that need a target cost nothing
if you aren't looking at one.

| Scroll | Chakra | Cooldown | Sensei | Effect |
|---|---|---|---|---|
| Fire Style: Dragon Flame Bullet | 45 | 8s | Lv 35 · 2,800 | A dragon of fire pours from your mouth and hunts the target you look at, scorching everything it passes (3 + burning), then bursts: 16 fire damage in 4 blocks. |
| Fire Style: Ash Pile Burning | 40 | 10s | Lv 45 · 3,000 | Breathe a 10-block cone of hot ash: enemies inside are blinded and slowed. Two seconds later you click your teeth and the cloud ignites — 14 fire damage and burning. |
| Water Style: Water Shark Bomb | 35 | 5s | Lv 30 · 2,200 | A shark of water swims after your target and bites: 16 damage, 7 to anyone within 3 blocks, knockback and slowness. |
| Water Style: Hiding in Mist | 30 | 20s | Lv 25 · 1,800 | A thick mist (9 blocks) for 10s: you're invisible and faster inside it; enemies inside are blinded and enemy players see only fog. |
| Water Style: Exploding Water Shockwave | 60 | 25s | Lv 70 · 4,400 | A flood erupts from your mouth and rolls out as a wall of water up to 11 blocks: 12 damage, a huge push and Slowness III. You get Water Breathing. (No real water is placed.) |
| Wind Style: Sickle Weasel | 30 | 4.5s | Lv 20 · 1,600 | A crescent of wind blades sweeps 14 blocks forward: 10 damage and a knock-up to everything in front of you. |
| Wind Style: Pressure Damage | 55 | 13s | Lv 60 · 3,800 | A slow, huge ball of compressed wind that bursts across 7 blocks: 24 damage and a big push. |
| Lightning Style: Lightning Hound | 40 | 7s | Lv 40 · 2,600 | A hound of lightning leaps from your hand, runs your target down along the ground and bites: 14 damage and a 1.5s paralysis, then the current jumps to 2 more enemies (6 each). |
| Lightning Style: Lightning Release Armour | 50 | 35s | Lv 60 · 4,000 | 15s of Speed II, Strength I, Resistance I and Haste II. Anyone who hits you in melee gets shocked (5 + slowness); your own melee hits crackle for +4. |
| Earth Style: Earth Dragon Bullet | 35 | 6s | Lv 30 · 2,200 | A dragon of rock rises from the ground in front of you and spits 3 mud bullets at your target: 9 damage in 2.6 blocks + slowness each. |
| Earth Style: Headhunter Jutsu | 30 | 8s | Lv 20 · 1,600 | Sink into the earth and drag the enemy you look at (16 blocks) into the ground: 10 damage, rooted for 3s — then pop up behind them with an uppercut (+6). |
| Earth Style: Swamp of the Underworld | 45 | 16s | Lv 50 · 3,200 | The ground where you look turns to sucking mud (4-block radius) for 8s: enemies are slowed, weakened, dragged to the centre and take 1.5 damage a second. Every block is put back afterwards — even after a crash or restart. |
| Big Ball Rasengan | 50 | 8s | Lv 50 · 3,400 | A Rasengan more than twice the size. Dash into the first enemy you reach: **34** damage and a huge knockback, **18** to everyone within 4.5 blocks, everyone slowed. |
| Explosive Tag Barrage | 15 | 5s | Lv 10 · 800 | Throw 3 tags at your target: they stick to whatever they hit, fizz, and go off one after another (6 damage in 3 blocks each). |
| Taijutsu: Leaf Hurricane | 15 | 2s | Lv 5 · 600 | A leaping spin kick: 8 damage and knockback to everyone within 3 blocks. |
| Taijutsu: Dynamic Entry | 15 | 4s | Lv 15 · 1,000 | A flying kick straight at the enemy you look at (up to 16 blocks): 12 damage and a big knockback. |
| Taijutsu: Front Lotus | 30 | 12s | Lv 35 · 2,400 | Kick the enemy (within 4 blocks) high into the air, follow them up, wrap them and drive them head-first into the ground: 4 + 20 damage. Costs you 1.5 hearts. Bosses can't be lifted but still take the slam. |
| Medical: Chakra Scalpel | 25 | 10s | Lv 30 · 2,000 | Chakra blades on your hands for 10s: every punch also cuts muscle — +5 damage, Slowness III and Weakness II for 5s. |
| Genjutsu: Hell Viewing | 25 | 10s | Lv 25 · 1,800 | Trap the enemy you look at (18 blocks) in their worst fear for 6s (3s on bosses): nausea, blindness, weakness and slowness; players also see darkness. |

**Taijutsu scrolls** are melee techniques: they scale with the **Taijutsu** stat (+1% per point) instead of Ninjutsu.
The Eight Inner Gates count as taijutsu too.

### Forbidden: Reanimation Jutsu (Edo Tensei)

Sold by the Jutsu Sensei (Lv 60, 9,000 Ryō; using it needs Lv 40, 100 chakra, 5 min cooldown). Choose a fallen shinobi —
**Hiruzen Sarutobi, Minato Namikaze, Itachi Uchiha, Nagato, Deidara, Sasori, Kakuzu, Hashirama Senju or Tobirama Senju**
— a coffin rises from the earth and they fight beside you for **60 seconds** with their own jutsu (Fire Dragon, Flying
Raijin + Rasengan, Amaterasu, Shinra Tensei + Banshō Ten'in, clay bombs, poison senbon, fire & wind masks, Wood Release
roots + healing you, Water Dragon + Flying Raijin). Their jutsu are cast in your name — they
never hit you or your companions, and kills count for you. Then their soul returns to the afterlife and the body crumbles.
One reanimation at a time.

A reanimated shinobi attacks **whoever you are fighting** — players and bosses included — for 12 seconds after you hit
them or they hit you; otherwise the nearest monster. Hashirama grows real (temporary) trunks and roots under his
target and throws lances of wood. They walk at a normal pace.

**The summoning cinematic** (about 10 seconds on the caster's camera; the caster can't move or be hurt during it):

1. **Hand seals** — one camera cut per seal as they snap into place: **Tiger → Serpent → Dog → Dragon**.
2. **Clap, then both palms hit the ground** — the **summoning formula** (ink script) races out across the ground to
   the spot in front of the caster. Seen from directly above.
3. **The coffin heaves out of the earth** in three jerks — the ground cracks, rubble flies, dust pours off it —
   filmed from ground level looking up. A planked wooden coffin with iron bands and a sealing talisman.
4. **Stillness** — over the kneeling caster's shoulder, the coffin standing.
5. **The lid creaks, tips and crashes down**, cut to black…
6. …**the reanimated shinobi** in the dark of the coffin, head bowed. A twitch; the head lifts, tilted; snaps straight.
   **EDO TENSEI**. Ash and paper flake off the body for as long as it walks.
7. Pull back; the caster stands; control returns. The coffin later sinks back into the earth.

It has its own sounds (seal snaps, the clap, a deep gong, the earth rumbling, the lid's creak and crash, an eerie drone).
Everyone nearby sees and hears it; only the caster's camera is taken over (not at all if they're already in another
cinematic). The whole shot list is data in `behavior_pack/scripts/edo_shots.js` — camera positions are relative to the
caster — and `python3 tools/cine_preview.py edo -o storyboard.png` renders the storyboard offline from the real
models and animations (`--gif` for an animated preview).

## Tailed Beasts (bosses)

Nine boss mobs with a boss bar, their own models and animations, a chakra aura, and a full move set:

Each beast is hand-modelled (`tools/gen_bijuu.py`) from a small creature kit: painted fur, shell and
marking swatches, jointed legs with paws and claws, hinged jaws that open when they roar or bite, painted eyes, and
tails built from chained segments so a wave travels down each one instead of the whole tail swinging like a plank.

| Beast | Model |
|---|---|
| Shukaku | a fat tanuki of sand with a pot belly, cursed-seal markings, a masked face with star pupils, one massive ringed tail |
| Matatabi | a sleek cat in blue flame: long neck and limbs, tall ears, flames along the spine, one yellow eye and one green, two whip tails |
| Isobu | an armoured turtle: layered, spiked shell, helmed head with one eye shut, clawed arms, three flat paddle tails |
| Son Goku | a red gorilla on knuckle-walking arms, bare green chest and face, a crown of horns, tusks, four tails |
| Kokuo | a white horse with a dolphin's snout, five horns, tan hooves, five flowing tails |
| Saiken | a pale slug reared up on its foot, eye stalks, stubby arms, slime running off it, six fat tails |
| Chomei | a plated blue rhinoceros beetle: sweeping forked horn, six jointed legs, six beating wings and a tail |
| Gyuki | an ox on an octopus: hulking torso and arms, four horns (one snapped), eight tentacles with suckers, half of them braced on the ground |
| Kurama | a lean, deep-chested fox: long ears, black-rimmed eyes sweeping back to them, clawed hands, nine fanned tails |

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

**Summon:** use a **Tailed Beast Summoning Scroll** (the S-rank mission reward, a rare Akatsuki drop, or — very rarely —
the Travelling Merchant's, Lv 50, 4,500 Ryō). A random beast is released 8 blocks in front of you after a short ritual
(fewer tails = more common). Only one beast can be summoned within 64 blocks at a time. Spawn eggs are in the
creative inventory too.

**Drops:** diamonds, golden apples, Soldier Pills, a chance at a Bloodline Reroll Scroll, and lots of XP.

### Jinchūriki & Tailed Beast Mode

Land the **killing blow** and the beast is sealed inside you (a new one replaces the old):

- +50 max chakra, plus 10 per tail (Kurama: +140), and 1.3× chakra regen
- You get that beast's **Tailed Beast Cloak**, a wearable (chest slot) item. **Put it on to transform**; take it off to
  return to normal. Only the beast's own Jinchūriki can wear its cloak.

**The transformation** (≈5 s, and nothing can hurt you while it plays): the seal on your stomach burns — *ba-dum,
BA-DUM* — the chakra erupts, you drop onto all fours as the shroud bubbles up around you, your tails sprout one by one,
and you **roar**: the shockwave blasts away everything within 7 blocks (6 damage +1 per tail). The camera follows every
beat; your view and controls come back when it ends. Mastered Jinchūriki transform calmly instead — hands in the Ram
seal, a golden flash, the flames rising around a steady stance, a shout of power.

**The cloak** is a glowing, bubbling chakra shroud in your beast's colour, with flame wisps licking off it, chakra
claws, a beast face (slit eyes, fangs; Kurama's whiskers) and the beast's own ears or horns and tails: Shukaku's
tanuki ears and one thick tail, Matatabi's cat ears, Isobu's spiked shell, Son Goku's horns, Kokuo's horse horns,
Saiken's eye-stalks, Chomei's beetle horn and six insect wings, Gyuki's ox horns and eight tentacle tails, Kurama's fox
ears and nine fanned tails. The tails ripple like flame and the chakra shimmers.

| While transformed | Tailed Beast Mode | Mastered (Tailed Beast Chakra Mode) |
|---|---|---|
| Effects | Strength III, Speed II, Resistance II, Jump Boost II, Regeneration I, +4 hearts, Night Vision | Strength IV, Speed III, Resistance III, Jump Boost III, Regeneration II, Fire Resistance, +8 hearts, Night Vision |
| Chakra | −2/s (Uzumaki −1/s), no natural regen; the cloak comes off at 0 | no drain, regen keeps working |
| Melee | every punch and sword hit carries the beast's chakra: +2, +0.4 per tail (Kurama +5.6) | ×1.5 |
| **Hold sneak** (~1.7 s): Tailed Beast Bomb | the orb grows in your hands, then flies where you aim: 40 damage, 7-block blast · 60 chakra · 14 s | 60 damage, 9-block blast, a bigger orb · 30 chakra · 8 s |
| **Double-tap sneak**: Beast Art | 30 chakra · 10 s | 15 chakra · 6 s · 1.5× damage |

Each beast adds its perk: Shukaku Resistance IV · Matatabi Fire Resistance + Speed III · Isobu Water Breathing +
Resistance III · Son Goku Fire Resistance + Strength IV · Kokuo Speed IV · Saiken Water Breathing + Regeneration II ·
Chomei Jump Boost IV + Slow Falling · Gyuki Strength IV + Water Breathing · Kurama Regeneration II + Strength IV.

| Beast | Beast Art (double-tap sneak) |
|---|---|
| Shukaku | **Sand Coffin**: sand engulfs the enemy you look at (24 blocks) and holds them still, then **Sand Burial** crushes them — 14 damage (6 to anyone beside them) and weakness |
| Matatabi | **Blue Fire**: a 10-block cone of blue cat-fire — 9 damage and burning |
| Isobu | **Coral Spikes**: four rings of coral burst out around you — 10 damage, knock-up, Slowness III — while a shell gives you Resistance III for 3 s |
| Son Goku | **Lava Globs**: three globs of lava at your target — 8 fire damage each in a 2.6-block splash, burning |
| Kokuo | **Steam Rush**: a boiling charge forward — 10 damage, a big push and scalding to everything in your path |
| Saiken | **Acid Bubbles**: a fan of five corrosive bubbles — 5 damage, Poison II and slowness where they burst |
| Chomei | **Scale Powder**: your wings lift you up and you glide down while blinding scales rain on everyone within 7 blocks — 6 damage, blindness, weakness |
| Gyuki | **Ink & Lariat**: an ink spray (5 damage, blindness), then Killer B's **Lariat** — a dash that hits the first enemy for 14 and launches them |
| Kurama | **Chakra Arms**: two chakra claws stretch out up to 14 blocks; the first enemy they reach is dragged back to you and slammed into the ground for 14 (bosses are too big to drag, but still get slammed). Nothing in reach: the claws smash the ground (8) |

### One Jinchūriki per Tailed Beast

Each Tailed Beast can be sealed into **only one player at a time**. While someone carries it, defeating another copy of
that beast doesn't seal it ("its chakra returns to its Jinchūriki"), the Uzumaki seal refuses it, and the Summoning
Scroll won't summon it. When the Jinchūriki loses the beast (3 deaths, a reroll into another beast, or `release`), it's
free again. Beasts from quests can never be sealed.

```
/scriptevent aegis:bijuu holders        (who carries which beast)
/scriptevent aegis:bijuu free shukaku   (admin: free a beast whose Jinchūriki left the server for good)
```

### Uzumaki: Four Symbols Seal & mastering your beast

Only the **Uzumaki** can do this (sneak + use the **Sealing Chains**):

- **Seal a Tailed Beast alive** — needs **100 Chakra and 100 Vitality** stats, 150 chakra, and the beast weakened
  **below half health**. Look at it, choose who becomes the Jinchūriki (**yourself or any player within 16 blocks**),
  and golden chains bind it for a 3-second ritual. The beast isn't killed — it's sealed straight into that player.
  You get the XP. 60 s cooldown. Stay within 40 blocks or the seal breaks.
- **Open the seal** — an Uzumaki who carries a beast (sneak + use the chains with no beast in sight) can face the
  **dark half of their beast** (60% health, 4 minutes). Defeat it to **master** your beast, like Naruto with Kurama:
  - Your cloak becomes **Tailed Beast Chakra Mode**: a golden shroud with black seal markings (the spiral seal on the
    belly, bands on the limbs), a flame crest and coat tails, golden tails tipped with your beast's colour — and a
    calm golden transformation
  - **No chakra drain**, chakra regen keeps working, and every buff goes up a level (see the table above)
  - Tailed Beast Bomb: **30** chakra, **8 s** cooldown, 60 damage, a 9-block blast · Beast Art: 15 chakra, 6 s, 1.5× damage

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

Beast models: `tools/gen_bijuu.py`. The Jinchūriki cloaks (both forms, their glow layer and their form/sway animations):
`tools/gen_jinchuriki.py` — preview every cloak, or the transformation shot by shot, with
`python3 tools/jin_preview.py sheet -o cloaks.png` / `python3 tools/jin_preview.py story -o story.png --beast kurama`.
Boss AI and Tailed Beast Mode: `behavior_pack/scripts/bijuu.js`, the transformation and Beast Arts:
`jinchuriki.js` (shot list: `jin_shots.js`).

## Armor & clothing

3D wearable pieces (they follow your body when you move) with a **set bonus** when the whole set is worn:

| Set | Pieces | Set bonus |
|---|---|---|
| **Leaf Shinobi** | Hidden Leaf Headband, Leaf Flak Jacket, Shinobi Pants, Ninja Sandals | Speed, Resistance, +25% chakra regen |
| **Anbu** | Anbu Mask, Anbu Armor (+ Shinobi Pants, Ninja Sandals) | Speed II, night vision, **invisible while sneaking** |
| **Akatsuki** | Akatsuki Straw Hat, Akatsuki Cloak | +60 max chakra, +20% technique damage, fire resistance |
| **Samurai** | Kabuto, Dō, Haidate, Suneate | Resistance II, Strength |

The **Akatsuki set** models: the cloak is a long black coat to the shins with a tall standing collar that hides the
mouth (red lining inside), wide sleeves that swallow the hands, a red-lined hem, and outlined red clouds on the chest,
back, sleeves and skirt; the hat is a round conical kasa in woven rings with a curtain of white paper strips (open at
the front) and a small bell on a red cord.

No armour is crafted. The **Weaponsmith** sells the Leaf, Anbu and Samurai pieces; the **Travelling Merchant** sometimes
has one of them 30% off, and sells the **Akatsuki Cloak** (1,600 Ryō, Lv 20) and **Straw Hat** (600 Ryō, Lv 10) when
he has them; Akatsuki members drop their gear.

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

Swords aren't crafted: the **Weaponsmith** sells seven of them (Lv 15–35), the **Travelling Merchant** sometimes has
one 30% off, Sasuke drops the Kusanagi and the Akatsuki the Shibuki — and **Samehada** is only earned through its quest
chain.

**Use the special:** right-click (hold use on mobile) with the sword, **or sneak + hit an enemy**.
All swords repair with diamonds and take sword enchantments. Models and icons are generated by `tools/gen_swords.py`
(held placement copies the vanilla trident's bound-bone setup);
abilities live in `behavior_pack/scripts/swords.js`.

### Wearing a sword

- **On your back:** scroll away from a legendary sword and it is slung across your back (Kusanagi, Nuibari and the
  Chakra Blades sit across the back of the waist). Scroll back to its now-empty hotbar slot to draw it. It works by
  moving the sword to your off-hand slot, so the off hand must be free, and one sword is worn at a time.
  `/scriptevent aegis:sheath off` keeps swords in the hotbar instead.
- **On your shoulder:** stand still with a sword in hand for a moment and the blade is swung up to rest against your
  shoulder until you move or sneak.
- **Samehada** is carried like Kisame does: while you hold it, it rests across the back of your neck and shoulders, your
  arm raised to its grip.
- **Kusanagi** has its **scabbard**: while you hold it, it stays sheathed, held across your body from the right hip
  with your other hand on the scabbard, ready to draw. Every swing draws the blade (the scabbard disappears for the
  strike), and put away on your back it sits in its scabbard.
- Both carrying poses step aside the moment you swing, land a hit or use the sword's special, and come back a moment
  later; in first person you just see the sword.
- **Kisame** now carries **Samehada** and **Sasuke** his **Kusanagi** (they never drop from them).

## HUD

The vanilla hearts are replaced by a custom HUD in the **top-left corner**, in a slanted-bar style:
**HP bar** (red) and **Chakra bar** (blue) with their values, **Level**, the **XP bar** (yellow, `xp/needed XP`) and
**Points** (unspent stat points). Levelling up is silent — no chat line, no title; the bars and your name tag just update. Big titles (clan reveal, Tailed Beasts…) show as normal Minecraft titles;
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
| Mastering your Tailed Beast | gold |
| Sage Mode | green |
| Awakening the Mangekyō / Eternal Mangekyō | red / purple |

Tailed Beast Mode has its own transformation sequence (the seal, the eruption, the tails, the roar — see
Jinchūriki & Tailed Beast Mode), and so do Edo Tensei and the Jutsu Clash.

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

Settings: NPC type · name (colour codes work) · outfit (33) · clan (Clan Elder) · Akatsuki member ·
how many to keep spawned (1–6) · respawn on/off + delay (5–600 s) · stay in place / wander radius ·
invulnerable · shop prices / mission rewards % · greeting line · spawn height (0 = first free space) ·
restock time (Travelling Merchant, 5–120 min). A Travelling Merchant's spawner menu also has **Restock now**.
Friendly NPCs are leashed to their spawner; breaking the spawner removes its NPCs.

### Ryō currency

**Ryō** is the shinobi money. Your wallet is shown on the HUD under your stat points.

- **Earn it:** enemy ninja, Akatsuki, Legends and Tailed Beasts drop **Ryō notes** (100 Ryō each) — picking them up puts
  them straight into your wallet. Missions and quests pay Ryō too.
- **Spend it:** every shop, the Clan Elder, Sage Training, nature training and recruiting Genin.
- **Pay a player / exchange emeralds:** open your **Shinobi Record → Ryō Wallet**. Old emeralds exchange for **100 Ryō
  each** (also at the Jutsu Sensei, the Weaponsmith and the Travelling Merchant).
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
| Requires finishing a quest first | pick another Quest Giver's quest — build **quest chains** (the player is told which quest to finish first) |

Tailed Beasts spawned by a quest can be defeated but **never sealed** (no Jinchūriki from quests).
Players talk to the Quest Giver to accept, see their progress, claim the reward or abandon. One quest at a time
(missions from the Mission Desk are separate). `/scriptevent aegis:quest` shows your current quest, `… abandon` drops it.

### Friendly NPCs (talk to them)

| NPC | What they do |
|---|---|
| **Jutsu Sensei** | Teaches by school — pick **Fire, Water, Wind, Lightning, Earth, Ninjutsu, Taijutsu, Genjutsu & Medical** or **Summoning & Forbidden**, then a scroll (each page shows how many you've unlocked at your level and has a « Back button). **Services**: Chakra Nature Training, emerald exchange. **Sage Training** (Lv 60) is under Summoning & Forbidden |
| **Weaponsmith** | Kunai, shuriken, headbands, seven legendary swords (Lv 15–35 — Samehada is quest-only), Leaf / Anbu / Samurai armour, repairs the item in your hand |
| **Ramen Shop** | Ichiraku Ramen (heal + 60 chakra + regen), Miso Ramen (+30 chakra + speed), Soldier Pills |
| **Travelling Merchant** | **Random wares that change every 20 minutes** (set per spawner): cheap ramen every time, plus 4–5 random finds — Bloodline Reroll Scrolls, bargain jutsu scrolls, swords and armour, Akatsuki gear, pills, kunai… Limited stock shared by everyone. Buys back old Blank Scrolls. See *The Travelling Merchant* below |
| **Hokage (Mission Desk)** | D/C/B/A/S missions (kill mobs, ninja, a Tailed Beast, an Akatsuki member) for XP, Ryō and items |
| **Exam Proctor** | Rank exams: **Chūnin** (Lv 20, beat 4 rogue ninja in 90 s), **Jōnin** (Lv 60, 3 Anbu + 3 Sound in 2 min), nothing higher — exams stop at Jōnin. Ranks show on your name tag and give +5/+10 stat points |
| **Clan Elder** | For their clan: **Clan Mastery** 1–3 (+10% clan max chakra, −10% clan ability cooldowns each); the Uchiha Elder also awakens the **Eternal Mangekyō**. Others: **Bloodline transfer** into that clan (6,400 Ryō, Lv 30) |
| **Leaf Shinobi** | Chatter and tips. Wears a 3D chūnin flak jacket (thick collar, four scroll pouches, the red swirl on the back), a Leaf headband with its ties, a ponytail and a taped thigh holster (the Quest Giver dresses the same) |
| **Genin** | Recruit for 1,500 Ryō — follows you, fights, levels up to 10 (Strength, Resistance, hearts). Talk to toggle follow/stay or dismiss |

Shops use **Ryō** — see *Ryō currency* below.

### Enemies

- **Rogue ninja** (kunai, Fireball, Substitution) — a missing-nin with a scratched-out headband, a face wrap, spiked
  hair and a scar over one eye, a tattered red scarf whose tails stream behind them, a cleaver strapped across the back,
  bandaged forearms, a thigh holster and wrapped shins — **Sound ninja** (sound-wave blast, nausea), **Rogue Anbu** (blink
  behind you and strike) **wander the overworld day and night** in groups of 1–3 (more in the dark/underground).
  Killing them gives XP (and levels), Ryō, kunai and pills.
- **Akatsuki bosses** with boss bars: **Itachi** (Amaterasu, Tsukuyomi, Fireball, crow Substitution),
  **Kisame** (Water Shark Bomb, Water Prison, Samehada chakra drain), **Deidara** (C1 clay birds, telegraphed C3
  blast, keeps his distance), **Pain** (Shinra Tensei blasts everyone away, Banshō Ten'in yanks you in for a strike,
  Chibaku Tensei lifts you in a sphere of debris and slams you down below half health), **Konan** (paper shuriken storms,
  a paper butterfly swarm that blinds and cuts, paper wings to rain paper bombs from above, paper substitution),
  **Hidan** (scythe sweeps and a thrown scythe draw your blood → the **Jashin ritual**: he turns into his black-and-white
  second form inside a blood circle and **every wound he takes — even when he stabs himself — appears on you**; he
  survives one killing blow), **Kakuzu** (fire, wind and lightning masks; **five hearts** — he comes back from the brink
  four times), **Sasori** (poisoned senbon, a puppet army, telegraphed Iron Sand), **Zetsu** (sinks into the ground and
  resurfaces behind you, White Zetsu spore clones, a chakra-draining grab) and **Tobi** (**Kamui**: he's phased out of this
  world and **nothing can hurt him** — except in the ~1.5 s he turns **solid to attack** (his strike, his grab and his
  Great Fireball; you get a *"Tobi is solid — strike NOW!"* cue and he flickers orange). He also warps you away with Kamui.
  **The first player to defeat Tobi claims Kamui** — only one player in the world can ever hold it. Like Tobi, the holder
  is **permanently phased: nothing can hurt them**, except for **1.5 s every time they attack** (a hit, a jutsu, a clan
  ability, any item use) when they turn solid. Their locked, keep-on-death Kamui eye: *right-click* = **Kamui Warp**
  (twist space around the enemy you look at: 14 damage and thrown 10 blocks away, 20 to bosses — stays phased),
  *sneak + right-click* = warp yourself to the spot you look at. The holder's hits also drag any other Tobi out of his phase.
  `/scriptevent aegis:kamui` shows the holder; `… free` lets the next Tobi-slayer claim it. They **rarely roam the world** (Normal/Hard difficulty — you get a "sighted nearby"
  warning), **hunt Jinchūriki** (every 5 min, 35% chance) and appear for S-rank missions. ~1,500 XP each.

Enemy ninja, the Akatsuki, the legends and companions walk at about a player's pace. Their jutsu push players less
than half as far as before, and nobody can be thrown again within 1.5 s of the last throw.

### Legendary bosses (NPC Spawner only)

These **never spawn on their own** — place an **NPC Spawner**, choose *Legend: …* as the NPC type, and they
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
| **Madara Uchiha [Edo Tensei]** (raid boss) | 1800 | Great Fire Annihilation (a wall of 7–9 fireballs), Wood Release roots racing along the ground (bind), Susanoo blade, gunbai sweep | **Perfect Susanoo** + **Tengai Shinsei** — a meteor falls on your spot after 3s (radius 8, 30 dmg — run!). His **Edo body reforms once** from 12% back to 45% HP | Great Fire Annihilation, 12,800 Ryō, Phoenix Flower (50%), Wood Dragon (35%), **Edo Tensei scroll (15%)** |

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

## Where things come from (no crafting)

Since v1.46 **nothing from the add-on can be crafted** — every recipe is gone. Everything is bought with Ryō, won from
enemies or given out by quests (and everything is still in the creative inventory):

| Item | Where to get it |
|---|---|
| Jutsu scrolls | **Jutsu Sensei** (by school, level-gated) · Travelling Merchant bargains (40% off) · Legend drops |
| Kekkei genkai release scrolls | the **Clan Elder** of that clan |
| Kunai, shuriken, Hidden Leaf Headband | **Weaponsmith** · Travelling Merchant · enemy ninja drop kunai and shuriken |
| Soldier Pills | **Ramen Shop** · Travelling Merchant · enemy ninja · C-rank missions |
| Ichiraku / Miso Ramen | **Ramen Shop** (300 / 200 Ryō) · **Travelling Merchant** (50 / 30 Ryō, while stocks last) |
| Legendary swords | **Weaponsmith** · Travelling Merchant bargains · Legend / Akatsuki drops · Samehada: its quest chain only |
| Armour (Leaf, Anbu, Samurai) | **Weaponsmith** · Travelling Merchant bargains |
| Akatsuki Cloak & Straw Hat | **Travelling Merchant** · Akatsuki drops |
| Bloodline Reroll Scroll | **Travelling Merchant** (rare) · Tailed Beast and Akatsuki drops (chance) · quest rewards |
| Tailed Beast Summoning Scroll | S-rank missions · Akatsuki drops (chance) · Travelling Merchant (very rare) |
| Shinobi Record | everyone has one, locked in the last hotbar slot — it can't be lost |
| Blank Scroll | no longer used — the Travelling Merchant buys old ones back for 25 Ryō each |

## M1 combos (basic attacks)

Land hits within 1.4 s of each other and they chain; every hit has its own animation and sound, and pulls you a step
toward the target so the next one connects.

| Weapon | Combo | Bonus |
|---|---|---|
| **Fists** (or anything that isn't a blade) | jab → cross → roundhouse kick → **rising uppercut** | +2, +2, +3, **+5** damage (×(1 + Taijutsu/100)); the uppercut launches and staggers the target |
| **Blades** (legendary swords, vanilla swords, kunai, axes) | slash → backhand → **leaping chop** | +2 on the chop, which also launches and staggers |

`/scriptevent aegis:m1 off` turns your own combo animations off (the bonus stays).

## Jutsu Clash

When two fighters throw jutsu **at each other at the same moment** (within ~0.7 s, each aiming at the other), or two
jutsu **projectiles collide** in mid-air, a ~16-second cinematic plays — staged like Naruto's Rasengan meeting
Sasuke's Chidori. Both fighters keep their own skins; every effect uses each jutsu's colour.

| Time | Beat |
|---|---|
| 0–1.5 s | **Standoff** — if they're close they spring apart; wide shot, wind and dust, *"JUTSU CLASH — A vs B"* |
| 1.5–3.7 s | **Fighter 1 gathers their jutsu** — a low hero shot pushing in, then a close-up on the hand: lightning pillars, tinted sky, the jutsu's name |
| 3.7–6 s | **Fighter 2** — the same, mirrored (fighter 2 uses the **other hand**, so the two face off symmetrically) |
| 6–7.5 s | **The eyes** — face, face, face, face, cutting faster, a heartbeat on every cut |
| 7.5 s | **Cut to black** |
| 7.7–9.2 s | **The charge** — tracking shots running alongside each fighter as they sprint, jutsu trailing behind |
| 9.2–10.2 s | **The leap** — both launch into the air toward each other (low wide shot) |
| 10.2–12.5 s | **Impact** — white flash, the two jutsu meet in mid-air; a **dome of chakra** swells from between their fists until it swallows them both, while the camera cuts between their faces inside it |
| 12.5 s | **The burst** — the dome detonates: white-out, boom and ringing ears, shockwaves, a **crater** torn into the ground, both fighters hurled back tumbling |
| 14.3–16 s | **Who's left standing** — over the winner's shoulder as they rise, the loser on one knee across the crater |

Fighters whose jutsu is lightning or Blaze hold it low at their side (Chidori style); everyone else forms a sphere in
their palm. If there's a ceiling they meet on the ground instead of in the air, and if there's a wall between them
they hold their ground and the dome forms in the middle. The choreography and every camera position are data in
`behavior_pack/scripts/clash_shots.js`; `python3 tools/cine_preview.py clash -o clash.png` renders the storyboard
offline (`--gif` for an animated preview).

The stronger jutsu (chakra cost, a little luck; bosses hit harder) **overpowers** the other: the loser takes 30% of
their health, the winner 8% — or *"Even!"* (20% each). Both are blasted apart. Sound effects are synthesized by
`tools/gen_clash_sounds.py` (wind, charge, heartbeat, dash, struggle, impact, ear-ring).

Works between players and against the Legend and Akatsuki bosses (half the time, so boss fights aren't all cinematics).
The same pair can clash once every 30 s; fighters are invulnerable while it plays. Craters never touch chests, other
containers, NPC Spawners or unbreakable blocks, and are carved over a few ticks so they don't lag the server.

```
/scriptevent aegis:clash destruction off      (no craters — e.g. to protect your village; "on" to turn them back on)
/scriptevent aegis:clash test                 (clash with the player / boss you're looking at)
```

## Animations

All jutsu and sword animations are generated by `tools/gen_player_anims.py`, keyed pose-to-pose. Every jutsu is
choreographed the same way: **anticipation** with the whole body (a coil at the hip, a lean back onto the toes as the
chest fills, a crouch before a leap) → the **strike** on a fixed frame, with real travel (lunges, leaps, a full spin
for the wind jutsu, a drop to one knee for Kirin and the summon) → a **finishing pose that is held** for a beat
(trembling while a breath jutsu pours out or a Rasengan grinds in) → recovery. The strike frames never move, so
effects stay in sync with the scripts. Feet are auto-planted; a 360° spin is unwound with an invisible cut key.

Preview without opening Minecraft (textured, in perspective):

```
python3 tools/cine_preview.py anim fireball_jutsu kirin_call wind_palm -o sheet.png
python3 tools/anim_preview.py gif fireball_jutsu -o fireball.gif
```

## Sound effects

Every sound is synthesized (no samples) by the `tools/gen_*_sounds.py` scripts — 64 in all.

- **Foley, cued from the animations** (`behavior_pack/scripts/sfx.js`): hand seals snap one by one, thrusts and throws
  swish, spins whirl, leaps take off and land with a thud, the chest fills before a breath jutsu, feet pound in the
  clash sprint. It plays for players, bosses and reanimated shinobi alike — whoever plays the animation.
- **Elements and techniques** (`tools/gen_jutsu_sounds.py`), replacing the vanilla stand-ins: rushing **water** and its
  burst, a **wind** gust and its cutting edge, the **earth** rumbling and breaking, **ice** forming and shattering,
  **wood** creaking as it grows, bubbling **lava**, a roaring stream of **fire**, real **thunder** for Kirin,
  healing shimmer, Almighty **Push** and Universal **Pull**, the dōjutsu "shing", the Nara **shadow**, the Eight
  **Gates** opening, summoning, and the hum of the clash **dome**.
- **Cinematics**: `gen_clash_sounds.py` (Jutsu Clash) and `gen_edo_sounds.py` (Edo Tensei); Tailed Beast Mode's
  heartbeat, chakra eruption, tail flares and golden swell come from `gen_jutsu_sounds.py`
  (`python3 tools/gen_jutsu_sounds.py heartbeat jin_tail` re-makes just the named ones).

## Particles

All particles are generated by `tools/gen_particles.py`: 21 procedural textures (animated smoke, flame and fireball
flipbooks; sparks, bolts, embers, ice shards, leaves, wood splinters and rocks in several variants; shockwave rings,
lens flares, a sealing circle, a scorch mark) and 108 effects.

**Every effect is a stack of layers.** When a jutsu asks for an effect, the scripts spawn it together with its layers
(`behavior_pack/scripts/particles.js`, table generated into `particle_layers.js`), all in the jutsu's colour:

| Effect | What you see now |
|---|---|
| Fire burst | a white-hot flash → rolling fireballs → embers that arc away and bounce → dark smoke left hanging → a shockwave skimming the ground |
| Lightning burst | a lens-flare flash, branching bolts thrown outward, sparks, a ground ring |
| Chidori | flickering core, bolts, a long arc now and then, sparks dripping off |
| Rasengan | orbiting motes around a spinning core with a ring of wind |
| Water splash | droplets, jets, a crown ring on the ground, drifting mist |
| Wind gust | swooshes, speed lines stretched along their flight, a few leaves torn along |
| Chakra / Tailed-Beast bursts | flash, shockwave, speed lines, embers and smoke in the caster's colour |
| Auras | flames with sparks rising through them and a glow on the ground |
| Smoke puff (clones, substitution) | the cloud, a ring of smoke rolling out along the ground, speed lines |
| Shockwave ring | two rings at different speeds and dust kicked outward |
| Healing | rising sparks and beams over a slowly turning seal on the ground |
| Amaterasu | black flames, violet embers, black smoke and a scorch mark |

**New dedicated effects** replace the generic ones the releases used to borrow: **ice** (faceted shards, sparkle,
frost mist), **earth** (rocks, pebbles, dust and a ground ring), **wood** (splinters and leaves) and **lava**
(fire, molten globs that fall and bounce, embers, smoke).

A server-wide budget (160 extra layers per tick) keeps a crowded fight from flooding clients: past it, only the base
effects are spawned. Preview any effect with all its layers, without opening Minecraft:

```
python3 tools/gen_particles.py --preview fire_burst ice_burst heal -o sheet.png
```

## Lag clear

- **Every 10 minutes** all dropped items lying on the ground are removed. Chat warns 60 seconds and 10 seconds before,
  then reports how many were removed.
- **Every 30 minutes** hostile mobs are cleared (a chat line says how many); they simply spawn again.
- Never touched: players, animals and villagers, pets and anything tamed or name-tagged, shop NPCs, companions,
  summons, reanimated shinobi, bosses (Akatsuki, legends, Tailed Beasts), and anything made by a quest, an exam or an
  NPC Spawner.

```
/scriptevent aegis:lag            (when the next clears are due)
/scriptevent aegis:lag items      (clear dropped items now)
/scriptevent aegis:lag mobs       (clear hostile mobs now)
/scriptevent aegis:lag off        (stop the automatic clears; "on" resumes them)
```

The timers start when the server starts. Intervals are the two constants at the top of `behavior_pack/scripts/lagclear.js`.

## The Shinobi Record's own slot (v1.47)

The **last slot of your hotbar belongs to the Shinobi Record**. Minecraft doesn't let an add-on add a new slot to the
inventory, so one is reserved instead: the Record is **locked** in it — it can't be moved, dropped, put in a chest or
thrown away — and it stays with you when you die. Select the slot and right-click to open it, as before.

- If it ever goes missing (`/clear`, a creative inventory wipe…), it's back within 2 seconds. Extra copies (an old one
  in a chest) disappear when you pick them up.
- On the first join after the update, whatever was in that slot moves into your inventory (or drops at your feet if
  the inventory is full — you're told either way), and an old Record anywhere else is replaced by the locked one.
- A sword you'd put away on your back from that slot before the update is drawn into whichever empty slot you select.
- The replacement Records the Jutsu Sensei sold in v1.46 are gone — you can't lose yours any more.

## The Travelling Merchant (v1.46)

Every crafting recipe is gone (see *Where things come from*). In their place: the **Travelling Merchant**, a new NPC
for the NPC Spawner (*Travelling Merchant (random stock)*). He's a jolly old peddler with a grey beard under a wide
woven straw kasa, an ochre haori with a coin crest on the back, an abacus tucked into his obi — and a tall wooden
cabinet of drawers on his back with a green furoshiki bundle tied on top, a rolled straw mat underneath and a red paper
lantern swinging from its side (`tools/gen_npc_gear.py`, skin 32).

- **What he sells:** two bowls of ramen are always on his cart, dirt cheap (Ichiraku 50 Ryō, Miso 30 Ryō — the Ramen
  Shop charges 300 / 200), plus **4–5 random wares** from: Soldier Pills (half price), 16 kunai, 32 shuriken, a Hidden
  Leaf Headband, the **Bloodline Reroll Scroll** (3,000 Ryō, in about 2 of every 5 restocks), the **Tailed Beast
  Summoning Scroll** (4,500 Ryō, Lv 50, about one restock in eight), the Akatsuki Cloak / Straw Hat, and bargains — a
  random jutsu scroll 40% off, a legendary sword or an armour piece 30% off (their usual level requirement still applies).
  Rare finds are starred (★); every button shows the price, the discount and how many are left.
- **Limited stock, shared:** each ware has 1–8 in stock for everyone who shops there — when it's gone, it's gone until
  the next restock. Two players can't buy the last one twice.
- **Restocks** every **20 minutes** of real time (5–120 per spawner; *Restock now* in the spawner menu re-rolls at once).
  The wares are stored with the spawner, so killing or respawning the merchant doesn't re-roll them.
- He also exchanges emeralds for Ryō and **buys back Blank Scrolls** (25 Ryō each) — they were only ever used for
  crafting. Enemy ninja no longer drop them.
- The Jutsu Sensei no longer sells blank scrolls.

## Nindō removed (v1.44)

The Nindō system (a random "ninja way" rolled on join, with perks and drawbacks) has been taken out: nobody rolls one
any more and the bonuses and penalties are gone, so every shinobi plays by the same rules again. The old Nindō button
in the Shinobi Record and `/scriptevent aegis:nindo` are gone too.

## NPC models (v1.42)

The Rogue Ninja and the Leaf Shinobi have new hand-painted skins (using the skin's outer layer too) and a layer of 3D
gear that follows their walk, look and attack animations; the scarf tails, headband ties and ponytail sway, and stream
out further when they run. Generated by `tools/gen_npc_gear.py` (preview: `python3 tools/gen_npc_gear.py --preview
npcs.png`); the gear is drawn only for the skins that have it (`controller.render.aegis.npc_gear_*` — since v1.46 the
Travelling Merchant's too).

## Fixes (v1.41.1)

- The legendary swords are visible again, in the hand and on the back. Since v1.35 their renderer decided which copy
  to show (in the hand or put away on the back) with values Minecraft only allows in an attachable's scripts, so it
  errored and hid both. The swords use the standard item renderer again, and the switch is done by the attachable's
  own scripts, the way the vanilla shield does it.

## Fixes (v1.40)

- Jutsu hits no longer count as M1 punches. Before, a Rasengan or any other scripted hit that landed also played a
  punch animation (cutting the jutsu's own animation short) and stacked the punch combo's bonus damage on top.
- Enemy knockback works again: since v1.35 the softened enemy knockback called itself, so enemy jutsu never pushed
  players at all and enemies' own dashes and leaps failed with a script error.
- Projectiles can never "hit" an effect model (orbs, the new dragons, shark and hound, coffins, Susanoo).

## Stability notes (v1.30)

- Enemy AI state is cleaned up when ninja die or despawn, and expired cooldowns are pruned every minute, so memory no
  longer creeps up on servers that stay online for days.
- Friendly fire is blocked at the source: scripted jutsu damage, sword on-hit effects and armor procs (Raikage lightning,
  Orochimaru venom…) never touch a village-mate.

## Project layout

```
behavior_pack/   items, entities, loot tables, scripts/main.js (jutsu) + scripts/clans.js (clans) — no recipes
resource_pack/   textures, client entities, headband attachable
tools/gen_textures.py   regenerates the placeholder pixel art (needs Pillow)
build.sh         packages dist/WayOfTheShinobi.mcaddon
```

Tuning (chakra costs, cooldowns, damage) lives at the top of `behavior_pack/scripts/main.js`.
The add-on uses the stable `@minecraft/server` 1.16.0 Script API.
