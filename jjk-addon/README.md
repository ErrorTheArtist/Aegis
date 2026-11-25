# Jujutsu Legacy — v1.1.0

**Made by errorlegend.** Questions, ideas or bug reports: DM **errorlegend_** on Discord.

A Jujutsu Kaisen add-on for Minecraft Bedrock (1.21.60+).
- **Your start:** every player is born into a **clan** and awakens an **innate technique** their bloodline allows.
- **Progress:** fight **cursed spirits** to climb from **Grade 4 to Special Grade**, land **Black Flashes** and open
  **Domain Expansions**.
- **The cast:** fight beside **Gojo, Yuji, Megumi, Nobara, Maki and the rest of Jujutsu High**, and face **Sukuna,
  Toji, Geto, Mahito, Choso and Jogo**.

No experimental toggles are needed, and the pack doesn't replace the player file, so it runs next to other add-ons.

**Install:** open `dist/JujutsuLegacy.mcaddon` (build it with `./build.sh`), then turn on both packs in your world.

---

## Credits

Jujutsu Legacy was created by **errorlegend** (Discord: **errorlegend_**). The credit is part of the add-on and can't be
switched off:
- every player sees it when they join
- it's on the first page of the Jujutsu Record and its **Credits** page, and in every awakening message
- `/scriptevent jjk:credits` shows it
- it's on both pack icons and in both pack descriptions

The scripts also keep a second, sealed copy of the credit. A copy with the credits edited out stops awakening
techniques and running moves, and tells everyone who really made it.

*Jujutsu Kaisen belongs to Gege Akutami; this is a fan-made add-on.*

## Getting started

- **Born into a clan, then awakened.** About three seconds after your first join you're born into a clan, and your
  innate technique awakens. Which techniques you can awaken depends on your clan (below).
- **Moves are items.** Your moves appear in your inventory. **Right-click** one to use it.
  - They're locked in your inventory and kept when you die.
  - New ones appear when you're promoted.
  - A technique belongs to whoever awakened it: its moves won't work for anyone else.
- **Cursed energy (CE)** fuels every move. It regenerates every second, twice as fast while you **sneak and stand still**.
- **The bar above your hotbar** shows health, CE, grade and what's active (∞ Infinity, DOMAIN, BURNOUT, ZONE, OVERTIME…).
- **The Jujutsu Record** (right-click it) shows:
  - your clan, technique and grade
  - every move with its cost and cooldown
  - the clans, a guide to fighting, and settings
  - the credits

## Clans

The great clans' techniques run in their blood. **Nobody born outside a clan can ever awaken its technique.** A clan
member who doesn't inherit it awakens a technique of no clan, like everyone clanless.

| Clan | Born into | Clan techniques (chance) | Perk |
|---|---|---|---|
| **Gojo** | 6% | Limitless 25% | +15% max cursed energy |
| **Zen'in** | 20% | Ten Shadows 25%, Heavenly Restriction 35% | +10% melee damage |
| **Kamo** | 20% | Blood Manipulation 70% | +20% cursed energy regeneration |
| **Inumaki** | 14% | Cursed Speech 70% | 10% shorter cooldowns |
| **Clanless** | 40% | — | +15% XP (self-made) |

**Techniques of no clan:** Boogie Woogie, Straw Doll, Ratio and Shrine. Shrine is Sukuna's own and the rarest of all.

**Overall chances:**

| Technique | Chance | | Technique | Chance |
|---|---|---|---|---|
| Limitless | 1.5% | | Blood Manipulation | 14% |
| Shrine | 3% | | Straw Doll | 19% |
| Ten Shadows | 5% | | Ratio | 19% |
| Heavenly Restriction | 7% | | Boogie Woogie | 22% |
| Cursed Speech | 10% | | | |

A **Cursed Womb** rerolls your technique, always into a different one your clan's blood allows.

## Techniques and moves

Each technique has two moves from the start, a third at **Grade 2**, and its domain or Maximum at **Grade 1**.
Damage below is the base. Every grade adds +20% technique damage and each of Sukuna's Fingers adds +2%. Against
other players, technique damage is ×0.6.

### Limitless — Special · 1.5% · Gojo clan only

Infinity itself. Blue pulls, Red repels, Hollow Purple erases — and while you have cursed energy, Infinity turns aside 40% of every blow.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Blue | Grade 4 | 25 CE | 6 s | Forms on who you aim at: pulls from 6 blocks, then 8 damage. Sneak: dash forward. |
| Red | Grade 4 | 30 CE | 7 s | 12 damage in a 3.5-block blast, hurls them away. |
| Hollow Purple | Grade 2 | 80 CE | 30 s | 1 s to form, then 30 damage to everything in a 40-block path. |
| Domain Expansion: Unlimited Void | Grade 1 | 70% of max CE | 90 s | Radius 12, 8 s: everyone inside is frozen and takes +50% damage from you. |

### Shrine — Special · 3% · any clan

The King of Curses' slashes. Dismantle cuts everything in a line, Cleave adapts to toughness, and Fuga opens into fire.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Dismantle | Grade 4 | 15 CE | 2.5 s | 10 damage to everyone along a 16-block line. |
| Cleave | Grade 4 | 25 CE | 6 s | 6 damage + 15% of the target's max health (up to +30). |
| Fuga | Grade 2 | 60 CE | 20 s | A flame arrow: 25 damage in a 5-block blast, and sets them alight. |
| Domain Expansion: Malevolent Shrine | Grade 1 | 70% of max CE | 90 s | Radius 14, 10 s, no barrier: 4 damage every half second, and a Cleave every 1.5 s. |

### Ten Shadows — Rare · 5% · Zen'in clan only

Shikigami from your shadow: the Divine Dogs, Nue and Max Elephant fight for you.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Divine Dogs | Grade 4 | 30 CE | 15 s | Two wolves fight for you for 30 s. |
| Nue | Grade 4 | 35 CE | 20 s | For 20 s it dives at your nearest enemy: 6 damage and slowness. |
| Max Elephant | Grade 2 | 60 CE | 25 s | Drops on the enemy you aim at (or where you look, 20 blocks): 20 damage in 5 blocks. |
| Domain Expansion: Chimera Shadow Garden | Grade 1 | 70% of max CE | 90 s | Radius 12, 10 s: enemies slowed, 2 damage a second; you're faster and tougher; two more dogs. |

### Heavenly Restriction — Rare · 7% · Zen'in clan only

No cursed energy at all — instead a monstrous body, cursed tools, and immunity to every domain's sure-hit.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Playful Cloud | Grade 4 | — | 12 s | Whirlwind: 3 blows of 7 damage in front of you. |
| Dragon-Bone | Grade 4 | — | 10 s | Impact Release: lunge for 8 + half the damage you took in the last 10 s (up to +20). |
| Inverted Spear of Heaven | Grade 2 | — | 20 s | Nullify: 10 damage through Infinity; breaks their domain and strips their buffs. |
| Split Soul Katana | Grade 1 | — | 16 s | Soul Split: 12 + 10% of their max health (up to +25). |

### Cursed Speech — Uncommon · 10% · Inumaki clan only

Your words are commands — Don't Move, Blast Away, Crush. Every word costs your throat a little health.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| "Don't Move" | Grade 4 | 20 CE + 1 HP | 8 s | Freezes everyone in front of you (12 blocks) for 2 s. |
| "Blast Away" | Grade 4 | 20 CE + 1 HP | 6 s | 8 damage and a big push to everyone in front. |
| "Crush" | Grade 2 | 45 CE + 3 HP | 15 s | 22 damage to the one you look at (16 blocks). |
| Maximum: "Twist" | Grade 1 | 80 CE + 6 HP | 45 s | 30 damage to everyone within 10 blocks. |

### Blood Manipulation — Uncommon · 14% · Kamo clan only

Your blood is a weapon: Piercing Blood, Supernova, and buffs that push your body past its limits.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Piercing Blood | Grade 4 | 20 CE + 1 HP | 5 s | 14 damage to everyone along a 20-block beam. |
| Convergence | Grade 4 | 30 CE | 30 s | 20 s: Speed II, Strength I, Haste II. |
| Supernova | Grade 2 | 50 CE | 18 s | 18 damage to everyone within 5 blocks. |
| Flowing Red Scale: Stack | Grade 1 | 70 CE | 60 s | 20 s: Strength III, Speed III, Resistance II, Regeneration II — then 5 s weak. |

### Straw Doll — Common · 19% · any clan

Hammer, nails and a straw doll. Anyone you've hurt has left a piece of themselves behind — and what you do to the doll happens to them.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Hairpin | Grade 4 | 20 CE | 5 s | Three nails, 4 damage each; every nail that sticks bursts for 6 more. |
| Resonance | Grade 4 | 30 CE | 10 s | 14 damage to the last enemy you hurt in 30 s, wherever they are (64 blocks). |
| Nail Barrage | Grade 2 | 45 CE | 15 s | Ten nails in every direction, 6 damage each. |
| Resonance: Cursed Doll | Grade 1 | 70 CE | 45 s | 20 damage and wither to every enemy you hurt in the last 30 s. |

### Ratio — Common · 19% · any clan

Divide anything along a 7:3 line and strike that point for a critical hit. Work overtime and it only gets worse for them.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| 7:3 | Grade 4 | 20 CE | 6 s | 10 damage to the one in front, x1.7 while they're above 70% health. |
| Blunt Sword Flurry | Grade 4 | 25 CE | 9 s | Three blows of 5; the third is a guaranteed critical (13.6). |
| Overtime | Grade 2 | 40 CE | 60 s | A binding vow: 20 s of +40% damage and Strength. |
| Extension: Collapse | Grade 1 | 70 CE | 40 s | Shatter the ground ahead: 26 damage within 6 blocks, and a short stun. |

### Boogie Woogie — Common · 22% · any clan

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

**Infinity (Limitless passive).** While you have 10+ CE you take 40% less damage, and each blow it turns costs 2 CE.
A domain's sure-hit, the Inverted Spear of Heaven and burnout switch it off.

**Heavenly Restriction** has no cursed energy at all. Instead it has:
- a monstrous body: Strength (II from Grade 1), Speed, Resistance, Jump Boost, and Regeneration from Semi-Grade 1
- cursed tools that are real weapons: hit with them, or right-click for their art
- immunity to every domain's sure-hit

It can't land a Black Flash.

## Domain Expansion

- **Unlocks at Grade 1.** It costs 70% of your maximum CE.
- **Sure-hit:** everyone inside who isn't protected takes its effect.
- **The domains:**
  - **Unlimited Void:** a starry barrier dome.
  - **Malevolent Shrine:** no barrier; Sukuna's shrine rises behind you.
  - **Chimera Shadow Garden:** a shadow dome.
- **Burnout:** when it ends, your technique burns out for 15 s. Reverse Cursed Technique and Simple Domain still work.
- **Clash:** if two domains overlap, the stronger sorcerer keeps theirs.
- **Protection:**
  - Simple Domain (Grade 2)
  - Heavenly Restriction
  - your own domain
  - the **Inverted Spear of Heaven**, which breaks a domain by stabbing its caster

## Grades

Each grade gives:
- +40 max CE
- +0.8 CE/s regeneration
- +20% technique damage
- +2 hearts

| Grade | XP | Max CE | Health |
|---|---|---|---|
| Grade 4 | 0 | 100 | 20 |
| Grade 3 | 500 | 140 | 24 |
| Grade 2 | 2,000 | 180 | 28 |
| Semi-Grade 1 | 6,000 | 220 | 32 |
| Grade 1 | 15,000 | 260 | 36 |
| Special Grade | 40,000 | 300 | 40 |

The Gojo clan gets +15% on max CE. Clanless sorcerers get +15% on all XP.

## Curses

Curses spawn in the dark. At night they gather around sorcerers, stronger the higher your grade. Kills by your
shikigami count as yours.

| Curse | Grade | Health | Hits | XP |
|---|---|---|---|---|
| Fly Head | 4 | 14 | 3 | 10 |
| Lanky Curse | 3 | 30 | 5 | 25 |
| Gaping Curse | 2 | 70 | 9 | 60 |
| Hundred-Eyed Curse | 1 | 180 | 14 | 150 |
| **Finger Bearer** | Special | 1,500 | 16 | 1,000 |

**The Finger Bearer** is a boss (boss bar), and no single hit can take more than 6% of its health.
- **How it appears:** at night, near Grade 1 sorcerers.
- **If nobody comes:** it leaves when no one is near for a minute.
- **Its attacks:** a roar, finger spikes, Fly Heads it calls in, and below half health a field of cursed energy.
- **Drops:** always one of **Sukuna's Fingers**, half the time a **Cursed Womb**.

**Sukuna's Fingers:** eat one for +10 max CE and +2% damage, up to 20.

## The cast

One entity, `jjk:sorcerer`, wears every character's 3D model: hair, collars, hoods, Sukuna's four arms, the weapons on
their backs. Each character fights with the same techniques players use, plus a few of their own.

| Character | Side | Clan | Fights with | Health | Spar XP / reward |
|---|---|---|---|---|---|
| Satoru Gojo — *The Strongest* | Jujutsu High | Gojo | Blue, Red, Hollow Purple, Domain Expansion: Unlimited Void | 400 | 1500 XP |
| Yuji Itadori — *Sukuna's Vessel* | Jujutsu High | Clanless | Divergent Fist, Black Flash | 160 | 150 XP |
| Megumi Fushiguro — *Ten Shadows* | Jujutsu High | Zen'in | Divine Dogs, Nue, Max Elephant, Domain Expansion: Chimera Shadow Garden | 130 | 120 XP |
| Nobara Kugisaki — *Straw Doll* | Jujutsu High | Clanless | Hairpin, Resonance, Nail Barrage | 110 | 120 XP |
| Maki Zen'in — *Heavenly Restriction* | Jujutsu High | Zen'in | Playful Cloud, Dragon-Bone | 160 | 160 XP |
| Toge Inumaki — *Cursed Speech* | Jujutsu High | Inumaki | "Don't Move", "Blast Away", "Crush" | 100 | 110 XP |
| Panda — *Abrupt Mutated Cursed Corpse* | Jujutsu High | Clanless | Gorilla Core | 200 | 150 XP |
| Kento Nanami — *Ratio* | Jujutsu High | Clanless | 7:3, Blunt Sword Flurry, Extension: Collapse | 220 | 300 XP |
| Mei Mei — *Black Bird Manipulation* | Jujutsu High | Clanless | Bird Strike, Axe Cleave | 200 | 300 XP |
| Aoi Todo — *Boogie Woogie* | Jujutsu High | Clanless | Boogie Woogie, Clap Barrage, Vibe Swap: Black Flash | 240 | 350 XP |
| Yuta Okkotsu — *Special Grade Sorcerer* | Jujutsu High | Clanless | Rika, "Blast Away", Black Flash | 300 | 800 XP |
| Ryomen Sukuna — *King of Curses* | villain | Clanless | Dismantle, Cleave, Fuga, Domain Expansion: Malevolent Shrine | 3000 | 3000 XP · 3× Sukuna's Finger, 1× Cursed Womb |
| Toji Fushiguro — *Sorcerer Killer* | villain | Zen'in | Burst, Inverted Spear of Heaven, Playful Cloud, Split Soul Katana | 900 | 1200 XP · 1× Cursed Womb (50%) |
| Suguru Geto — *The Worst Curse User* | villain | Clanless | Curse Release, Maximum: Uzumaki | 1400 | 1500 XP · 1× Sukuna's Finger |
| Mahito — *Special Grade Curse* | villain | Clanless | Idle Transfiguration, Soul Spikes | 1000 | 1200 XP · 1× Cursed Womb (60%) |
| Choso — *Death Painting* | villain | Kamo | Piercing Blood, Supernova, Convergence | 800 | 1000 XP · 1× Cursed Womb (50%) |
| Jogo — *Special Grade Curse* | villain | Clanless | Ember Insects, Maximum: Meteor | 1100 | 1200 XP · 1× Sukuna's Finger |

**Jujutsu High (allies):**
- They exorcise curses and fight villains.
- They never hurt a player who isn't sparring them, and players' techniques don't hurt them.
- At night one may come to help a sorcerer surrounded by curses.

**Talking and sparring:** right-click an ally to talk. You'll get a line in character, they'll tell you about their
technique, and they'll offer a **spar**.
- A spar is a real fight, but they pull their punches: **a spar can't kill you**.
- Bring them to half their health to win the XP above, once every 10 minutes per character.
- Fall to 30% and you lose.
- Ask **Todo** what he asks everyone.

**Villains (bosses):**
- **How they appear:** at night, one may come for a Grade 1 sorcerer (one villain at a time). Sukuna only comes for
  the Special Grade, or for whoever has eaten 15 of his fingers.
- **Fighting them:** they use their techniques for real. Sukuna opens the Malevolent Shrine when he's hurt; an NPC's
  sure-hit lands at half strength.
- **If nobody comes:** they leave when no one is near for a minute.

## Admins

- **Admin Panel:** tag yourself (`/tag @s add jjk_admin`) and it appears in your Jujutsu Record. You can also open it
  with `/scriptevent jjk:admin`. It lets you:
  - edit any player (clan, technique, grade, fingers, refill)
  - summon the Finger Bearer or any character (optionally standing still, for a hub)
  - change server settings: night curse surges, natural Finger Bearer, villains at night, Jujutsu High helping (all on),
    and Hollow Purple destroying terrain (off)
- **Commands** (the last word can name another player):

  | Command | Does |
  |---|---|
  | `/scriptevent jjk:technique limitless [name]` | set a technique; a clan technique also sets its clan. `random` rerolls within their clan |
  | `/scriptevent jjk:clan zenin [name]` | set a clan: `gojo`, `zenin`, `kamo`, `inumaki`, `clanless`. A technique the new blood doesn't allow is rerolled |
  | `/scriptevent jjk:grade 4 [name]` | set a grade (0 = Grade 4 … 5 = Special Grade) |
  | `/scriptevent jjk:xp 500 [name]` | give XP |
  | `/scriptevent jjk:finger 20 [name]` | set Sukuna's Fingers eaten |
  | `/scriptevent jjk:ce [name]` | refill CE and reset cooldowns |
  | `/scriptevent jjk:summon gojo [stay]` | summon a character next to you |
  | `/scriptevent jjk:boss` | summon the Finger Bearer next to you |
  | `/scriptevent jjk:reset [name]` | wipe a player; they're born and awaken again |
  | `/scriptevent jjk:record` | open your Jujutsu Record |
  | `/scriptevent jjk:credits` | who made this add-on |

## For developers

Everything visual is **generated by Python** (Pillow only). Change the generator and re-run it; never hand-edit its
output. Run the generators from this folder:

| Generator | Makes |
|---|---|
| `tools/gen_entities.py` | Curses, shikigami and effect models (orbs, the domain dome, the shrine): geometry, painted textures, idle animations, BP/RP entities, spawn rules, names |
| `tools/gen_sorcerers.py` | The cast: painted skins + 3D gear for all 17 characters, the `jjk:sorcerer` entity (BP + RP), render controllers, `roster_ids.js`. Preview with `--preview out.png [--only gojo,sukuna]` |
| `tools/gen_items.py` | Every item: 32×32 icons drawn in code, item JSON, `item_texture.json`, both pack icons |
| `tools/gen_particles.py` | The `jjk:` particles and their textures (tinted per use from script) |
| `tools/gen_anims.py` | Player animations (point, Hollow Purple, domain hand sign, clap, shout, summon…) |

**Gameplay** is in `behavior_pack/scripts/` (`@minecraft/server` 1.16.0, `@minecraft/server-ui` 1.3.0):

| Module | Does |
|---|---|
| `main.js` | entry point |
| `credits.js` | the credits (sealed) |
| `core.js` | helpers, targeting rules and the task runner |
| `clans.js` | clans and blood-bound techniques |
| `grades.js` | grades, XP, fingers |
| `energy.js` | cursed energy and the bar |
| `combat.js` | damage, Black Flash, Infinity, stuns |
| `domains.js` | domains, clashes, Simple Domain |
| `tech_*.js` | the nine techniques |
| `techniques.js` | awakening, items, using moves |
| `curses.js` | curses, the Finger Bearer, night surges |
| `sorcerers.js` + `npc_moves.js` | the cast |
| `record.js` | the Record and the Admin Panel |
| `commands.js` | admin commands |

**Tests:** `./tests/run.sh` runs the mock tests (no Minecraft needed). They cover:
- every move of every technique and of every character
- Black Flash, Infinity, domains and clashes
- clans and their perks
- sparring, encounters and rewards
- the Record, the commands
- the credits, including a copy with them edited out

**Release:**
1. Bump the version in **both** manifests. Never change the pack UUIDs: players' data depends on them.
2. Run `./build.sh`.
