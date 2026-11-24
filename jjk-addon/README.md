# Jujutsu Legacy — v1.0.0

A Jujutsu Kaisen add-on for Minecraft Bedrock (1.21.60+). Every player awakens a random **innate technique** on their
first join, fights **cursed spirits** to climb from **Grade 4 to Special Grade**, lands **Black Flashes**, opens
**Domain Expansions** — and hunts the **Finger Bearer** for **Sukuna's Fingers**.

No experimental toggles are needed, and the pack doesn't replace the player file, so it runs next to other add-ons.

**Install:** open `dist/JujutsuLegacy.mcaddon` (build it with `./build.sh`), then turn on both packs in your world.

---

## Getting started

- **Awakening.** About three seconds after you first join, your innate technique awakens. Rarer techniques are rarer:

  | Technique | Chance | | Technique | Chance |
  |---|---|---|---|---|
  | Limitless | 2% | | Heavenly Restriction | 20% |
  | Shrine | 2% | | Blood Manipulation | 26% |
  | Ten Shadows | 8% | | Boogie Woogie | 28% |
  | Cursed Speech | 14% | | | |

- **Moves are items.** Your moves appear in your inventory. **Right-click** one to use it. They're locked in your
  inventory and you keep them when you die. New ones appear when you're promoted.
- **Cursed energy (CE)** fuels every move. It regenerates every second, twice as fast while you **sneak and stand still**.
- **The bar above your hotbar** shows health, CE, grade and what's active (∞ Infinity, DOMAIN, BURNOUT, ZONE…).
- **The Jujutsu Record** (right-click it) shows your technique, grade, every move with its cost and cooldown, a guide to
  fighting, and settings (hide the bar; switch Infinity off).

## Techniques and moves

Each technique has two moves from the start, a third at **Grade 2**, and its domain or Maximum at **Grade 1**.
Damage below is the base. Every grade adds +20% technique damage and each of Sukuna's Fingers adds +2%. Against
other players, technique damage is ×0.6.

### Limitless — 2%

Infinity itself. Blue pulls, Red repels, Hollow Purple erases — and while you have cursed energy, Infinity turns aside 40% of every blow.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Blue | Grade 4 | 25 CE | 6 s | Forms on who you aim at: pulls from 6 blocks, then 8 damage. Sneak: dash forward. |
| Red | Grade 4 | 30 CE | 7 s | 12 damage in a 3.5-block blast, hurls them away. |
| Hollow Purple | Grade 2 | 80 CE | 30 s | 1 s to form, then 30 damage to everything in a 40-block path. |
| Domain Expansion: Unlimited Void | Grade 1 | 70% of max CE | 90 s | Radius 12, 8 s: everyone inside is frozen and takes +50% damage from you. |

### Shrine — 2%

The King of Curses' slashes. Dismantle cuts everything in a line, Cleave adapts to toughness, and Fuga opens into fire.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Dismantle | Grade 4 | 15 CE | 2.5 s | 10 damage to everyone along a 16-block line. |
| Cleave | Grade 4 | 25 CE | 6 s | 6 damage + 15% of the target's max health (up to +30). |
| Fuga | Grade 2 | 60 CE | 20 s | A flame arrow: 25 damage in a 5-block blast, and sets them alight. |
| Domain Expansion: Malevolent Shrine | Grade 1 | 70% of max CE | 90 s | Radius 14, 10 s, no barrier: 4 damage every half second, and a Cleave every 1.5 s. |

### Ten Shadows — 8%

Shikigami from your shadow: the Divine Dogs, Nue and Max Elephant fight for you.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Divine Dogs | Grade 4 | 30 CE | 15 s | Two wolves fight for you for 30 s. |
| Nue | Grade 4 | 35 CE | 20 s | For 20 s it dives at your nearest enemy: 6 damage and slowness. |
| Max Elephant | Grade 2 | 60 CE | 25 s | Drops where you look (up to 20 blocks): 20 damage in 5 blocks. |
| Domain Expansion: Chimera Shadow Garden | Grade 1 | 70% of max CE | 90 s | Radius 12, 10 s: enemies slowed, 2 damage a second; you're faster and tougher; two more dogs. |

### Cursed Speech — 14%

Your words are commands — Don't Move, Blast Away, Crush. Every word costs your throat a little health.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| "Don't Move" | Grade 4 | 20 CE + 1 HP | 8 s | Freezes everyone in front of you (12 blocks) for 2 s. |
| "Blast Away" | Grade 4 | 20 CE + 1 HP | 6 s | 8 damage and a big push to everyone in front. |
| "Crush" | Grade 2 | 45 CE + 3 HP | 15 s | 22 damage to the one you look at (16 blocks). |
| Maximum: "Twist" | Grade 1 | 80 CE + 6 HP | 45 s | 30 damage to everyone within 10 blocks. |

### Heavenly Restriction — 20%

No cursed energy at all — instead a monstrous body, cursed tools, and immunity to every domain's sure-hit.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Playful Cloud | Grade 4 | — | 12 s | Whirlwind: 3 blows of 7 damage in front of you. |
| Dragon-Bone | Grade 4 | — | 10 s | Impact Release: lunge for 8 + half the damage you took in the last 10 s (up to +20). |
| Inverted Spear of Heaven | Grade 2 | — | 20 s | Nullify: 10 damage through Infinity; breaks their domain and strips their buffs. |
| Split Soul Katana | Grade 1 | — | 16 s | Soul Split: 12 + 10% of their max health (up to +25). |

### Blood Manipulation — 26%

Your blood is a weapon: Piercing Blood, Supernova, and buffs that push your body past its limits.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Piercing Blood | Grade 4 | 20 CE + 1 HP | 5 s | 14 damage to everyone along a 20-block beam. |
| Convergence | Grade 4 | 30 CE | 30 s | 20 s: Speed II, Strength I, Haste II. |
| Supernova | Grade 2 | 50 CE | 18 s | 18 damage to everyone within 5 blocks. |
| Flowing Red Scale: Stack | Grade 1 | 70 CE | 60 s | 20 s: Strength III, Speed III, Resistance II, Regeneration II — then 5 s weak. |

### Boogie Woogie — 28%

Clap and swap places with anyone you see. Simple, and terrifying in the right hands.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Boogie Woogie | Grade 4 | 10 CE | 1.5 s | Swap places with whoever you look at (24 blocks). |
| Feint | Grade 4 | 15 CE | 8 s | Everyone within 8 blocks reels; you get Speed III for 2 s. |
| Clap Barrage | Grade 2 | 40 CE | 15 s | Up to 4 swaps among enemies within 12 blocks, 6 damage each. |
| Vibe Swap: Black Flash | Grade 1 | 60 CE | 25 s | Swap in and land a guaranteed Black Flash (25). |

### Every sorcerer (not Heavenly Restriction)

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Simple Domain | Grade 2 | 25 CE | 25 s | 8 s: no domain's sure-hit can touch you (you move slowly). |
| Reverse Cursed Technique | Semi-Grade 1 | 50 CE | 20 s | Heal half your health; clears poison and wither. |

**Black Flash (passive, everyone but Heavenly Restriction).** Any melee hit has a 4% chance (+1% per grade) to land as
a Black Flash. It deals ×2.5 damage, gives back 30% of your CE and puts you **in the zone** for 30 s (+10% chance).
Melee hits also get a little stronger every grade.

**Infinity (Limitless passive).** While you have 10+ CE you take 40% less damage, and each blow it turns costs 2 CE.
A domain's sure-hit and the Inverted Spear of Heaven switch it off. Burnout switches it off too.

**Heavenly Restriction** has no cursed energy at all. Instead it has a monstrous body: Strength (II from Grade 1),
Speed, Resistance, Jump Boost, and Regeneration from Semi-Grade 1. Its cursed tools are real weapons: hit with them,
or right-click for their art. No domain's sure-hit can touch it. It can't land a Black Flash.

## Domain Expansion

- **Unlocks at Grade 1.** It costs 70% of your maximum CE.
- **Sure-hit:** everyone inside who isn't protected takes its effect, and Infinity doesn't help.
- **The domains:**
  - **Unlimited Void:** a starry barrier dome.
  - **Malevolent Shrine:** no barrier; Sukuna's shrine rises behind you.
  - **Chimera Shadow Garden:** a shadow dome with an ink-black floor.
- **Burnout:** when your domain ends, your technique burns out for 15 s. Reverse Cursed Technique and Simple Domain
  still work during burnout.
- **Leaving:** if you walk out of your own domain, it collapses.
- **Clash:** if two domains overlap, the stronger sorcerer keeps theirs. Strength is grade, CE left, fingers and a
  little luck. The other domain shatters, and its caster burns out.
- **Protection:**
  - Simple Domain (Grade 2)
  - Heavenly Restriction
  - your own domain
  - stabbing the caster with the **Inverted Spear of Heaven**, which breaks the domain on the spot

## Grades

Each grade gives:
- +40 max CE
- +0.8 CE/s regeneration
- +20% technique damage
- +2 hearts

New moves come at Grade 2, Semi-Grade 1 (Reverse Cursed Technique) and Grade 1 (your domain).

| Grade | XP | Max CE | Health |
|---|---|---|---|
| Grade 4 | 0 | 100 | 20 |
| Grade 3 | 500 | 140 | 24 |
| Grade 2 | 2,000 | 180 | 28 |
| Semi-Grade 1 | 6,000 | 220 | 32 |
| Grade 1 | 15,000 | 260 | 36 |
| Special Grade | 40,000 | 300 | 40 |

## Curses

Curses spawn in the dark. At night they also gather around sorcerers: every 30 s, anyone with fewer than 4 curses
nearby draws one or two more, and they're stronger the higher your grade. Kills by your shikigami count as yours.

| Curse | Grade | Health | Hits | XP |
|---|---|---|---|---|
| Fly Head | 4 | 14 | 3 | 10 |
| Lanky Curse | 3 | 30 | 5 | 25 |
| Gaping Curse | 2 | 70 | 9 | 60 |
| Hundred-Eyed Curse | 1 | 180 | 14 | 150 |
| **Finger Bearer** | Special | 1,500 | 16 | 1,000 |

You also get XP for other things:
- another sorcerer: 100 XP
- any other monster: 3 XP
- landing a Black Flash: 15 XP

**The Finger Bearer** is a boss (boss bar), and no single hit can take more than 6% of its health.
- **How it appears:** at night, near sorcerers of Grade 1 and up (one at a time). Admins can also summon it.
- **If nobody comes:** it leaves when no one is within 64 blocks for a minute.
- **Its attacks:**
  - a roar that blasts everyone within 8 blocks
  - finger spikes
  - Fly Heads it calls in
  - below half health, a field of cursed energy that burns everyone near it
- **Drops:** always one of **Sukuna's Fingers**, and half the time a **Cursed Womb**. A Hundred-Eyed Curse sometimes
  drops either.

**Sukuna's Fingers:** eat one (right-click) for +10 max CE and +2% damage, up to 20. Eating all twenty makes you the
King of Curses, and the whole server hears about it.
**Cursed Womb:** right-click to reawaken as a different, random innate technique.

## Admins

- **Admin Panel:** tag yourself (`/tag @s add jjk_admin`) and it appears in your Jujutsu Record. You can also open it
  with `/scriptevent jjk:admin`. It lets you:
  - edit any player (technique, grade, fingers, refill)
  - summon the Finger Bearer
  - change server settings: night curse surges (on), natural Finger Bearer (on), Hollow Purple destroys terrain (off)
- **Commands** (the last word can name another player):

  | Command | Does |
  |---|---|
  | `/scriptevent jjk:technique limitless [name]` | set a technique: `limitless`, `shrine`, `ten_shadows`, `cursed_speech`, `heavenly`, `blood`, `boogie` or `random` |
  | `/scriptevent jjk:grade 4 [name]` | set a grade (0 = Grade 4 … 5 = Special Grade) |
  | `/scriptevent jjk:xp 500 [name]` | give XP |
  | `/scriptevent jjk:finger 20 [name]` | set Sukuna's Fingers eaten |
  | `/scriptevent jjk:ce [name]` | refill CE and reset cooldowns |
  | `/scriptevent jjk:boss` | summon the Finger Bearer next to you |
  | `/scriptevent jjk:reset [name]` | wipe a player; they awaken again |
  | `/scriptevent jjk:record` | open your Jujutsu Record |

## For developers

Everything visual is **generated by Python** (Pillow only). Change the generator and re-run it; never hand-edit its
output. Run the generators from this folder:

| Generator | Makes |
|---|---|
| `tools/gen_entities.py` | Curses, shikigami and effect models (orbs, the domain dome, the shrine): geometry, painted textures, idle animations, BP/RP entities, spawn rules, names |
| `tools/gen_items.py` | Every item: 32×32 icons drawn in code, item JSON, `item_texture.json`, both pack icons |
| `tools/gen_particles.py` | The `jjk:` particles and their textures (tinted per use from script) |
| `tools/gen_anims.py` | Player animations (point, Hollow Purple, domain hand sign, clap, shout, summon…) |

**Gameplay** is in `behavior_pack/scripts/` (`@minecraft/server` 1.16.0, `@minecraft/server-ui` 1.3.0):

| Module | Does |
|---|---|
| `main.js` | entry point |
| `core.js` | helpers and the task runner |
| `grades.js` | grades, XP, fingers |
| `energy.js` | cursed energy and the bar |
| `combat.js` | damage, Black Flash, Infinity, stuns |
| `domains.js` | domains, clashes, Simple Domain |
| `tech_*.js` | the seven techniques |
| `techniques.js` | awakening, items, using moves |
| `curses.js` | XP, drops, the Finger Bearer, night surges |
| `record.js` | the Record and the Admin Panel |
| `commands.js` | admin commands |

**Tests:** `./tests/run.sh` runs the mock tests. They cover every move of every technique, Black Flash, Infinity,
domains and clashes, progression, the boss, the Record and the commands, and need no Minecraft.

**Release:**
1. Bump the version in **both** manifests. Never change the pack UUIDs: players' data depends on them.
2. Run `./build.sh`.
