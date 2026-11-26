# Jujutsu Legacy — v1.3.0

**Made by errorlegend.** Questions, ideas or bug reports: DM **errorlegend_** on Discord.

A Jujutsu Kaisen add-on for Minecraft Bedrock (1.21.60+).
- **Your start:** every player is born into a **clan** and awakens an **innate technique** their bloodline allows.
- **Progress:** fight **cursed spirits** to climb from **Grade 4 to Special Grade**, land **Black Flashes** and open
  **Domain Expansions**.
- **The cast:** fight beside **Gojo, Yuji, Megumi, Nobara, Maki, Hakari and the rest of Jujutsu High**, and face
  **Sukuna, Toji, Geto, Mahito, Choso, Jogo and Naoya**.
- **And more:** tame **Mahoraga**, make **Binding Vows**.

No experimental toggles are needed, and the pack doesn't replace the player file, so it runs next to other add-ons.

**Install:** open `dist/JujutsuLegacy.mcaddon` (build it with `./build.sh`), then turn on both packs in your world.

**New in 1.3: the cast, remade.** Every character has been redone one by one:
- **Plain hair:** painted on the skin, strand by strand, with a proper fringe. No more spikes.
- **Faces with twice the detail (16×16):** real anime eyes, brows and expressions, plus each character's marks:
  Sukuna's second eyes, Todo's scar, Choso's blood line, Mahito's stitches, Kenjaku's stitched brow.
- **Twice the detail on every outfit:** uniforms with buttons and seams, Nanami's leopard tie, Geto's kesa, Mahito's
  patchwork.

**New in 1.2:**
- **Five new innate techniques:** Projection Sorcery (Zen'in), Disaster Flames, Idle Death Gamble, Cursed Spirit
  Manipulation and Idle Transfiguration, each with its own domain or Maximum.
- **Two new characters:** Kinji Hakari (Jujutsu High) and Naoya Zen'in (villain). Geto, Mahito and Jogo now fight with
  their real techniques.
- **Mahoraga:** the Ten Shadows' Special Grade ritual. It adapts to every attack: beat it alone to tame it.
- **Binding Vows:** give something up, get something back.
- **Better models:** every character remodelled, new curse anatomy and textures, four new domain barriers.

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
  - your clan, technique, grade and Binding Vow
  - every move with its cost and cooldown
  - the clans, Binding Vows, a guide to fighting, and settings
  - the credits

## Clans

The great clans' techniques run in their blood. **Nobody born outside a clan can ever awaken its technique.** A clan
member who doesn't inherit it awakens a technique of no clan, like everyone clanless.

| Clan | Born into | Clan techniques (chance) | Perk |
|---|---|---|---|
| **Gojo** | 6% | Limitless 25% | +15% max cursed energy |
| **Zen'in** | 20% | Ten Shadows 22%, Heavenly Restriction 30%, Projection Sorcery 20% | +10% melee damage |
| **Kamo** | 20% | Blood Manipulation 70% | +20% cursed energy regeneration |
| **Inumaki** | 14% | Cursed Speech 70% | 10% shorter cooldowns |
| **Clanless** | 40% | — | +15% XP (self-made) |

**Techniques of no clan** (for the clanless, and for clan members who don't inherit): Boogie Woogie 28, Straw Doll 18, Ratio 18, Disaster Flames 11, Idle Death Gamble 9, Cursed Spirit Manipulation 7, Idle Transfiguration 5, Shrine 4 (out of 100).
Shrine is Sukuna's own and the rarest of all.

**Overall chances:**

| Technique | Chance | | Technique | Chance |
|---|---|---|---|---|
| Limitless | 1.5% | | Heavenly Restriction | 6.0% |
| Shrine | 2.4% | | Disaster Flames | 6.6% |
| Idle Transfiguration | 3.0% | | Cursed Speech | 9.8% |
| Projection Sorcery | 4.0% | | Straw Doll | 11% |
| Cursed Spirit Manipulation | 4.2% | | Ratio | 11% |
| Ten Shadows | 4.4% | | Blood Manipulation | 14% |
| Idle Death Gamble | 5.4% | | Boogie Woogie | 17% |

A **Cursed Womb** rerolls your technique, always into a different one your clan's blood allows.

## Techniques and moves

Each technique has two moves from the start, a third at **Grade 2**, and its domain or Maximum at **Grade 1**
(listed rarest first). The Ten Shadows also has a fifth, at **Special Grade**: the Mahoraga ritual.
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

### Shrine — Special · 2.4% · any clan

The King of Curses' slashes. Dismantle cuts everything in a line, Cleave adapts to toughness, and Fuga opens into fire.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Dismantle | Grade 4 | 15 CE | 2.5 s | 10 damage to everyone along a 16-block line. |
| Cleave | Grade 4 | 25 CE | 6 s | 6 damage + 15% of the target's max health (up to +30). |
| Fuga | Grade 2 | 60 CE | 20 s | A flame arrow: 25 damage in a 5-block blast, and sets them alight. |
| Domain Expansion: Malevolent Shrine | Grade 1 | 70% of max CE | 90 s | Radius 14, 10 s, no barrier: 4 damage every half second, and a Cleave every 1.5 s. |

### Idle Transfiguration — Special · 3.0% · any clan

You touch the soul, and the body follows: twist the ones you touch, grow spikes, and make transfigured humans fight for you.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Soul Touch | Grade 4 | 20 CE | 6 s | 12 damage to the one you touch, plus nausea and slowness. |
| Body Repel | Grade 4 | 25 CE | 9 s | 10 damage and a push to everyone within 4 blocks; Resistance for 3 s. |
| Polymorphic Soul Isomer | Grade 2 | 45 CE | 20 s | Two transfigured humans fight for you for 20 s. |
| Domain Expansion: Self-Embodiment of Perfection | Grade 1 | 70% of max CE | 90 s | Radius 11, 9 s: 3 damage a second, slowness and nausea — and a final 12 to whoever is still inside. |

### Projection Sorcery — Rare · 4.0% · Zen'in clan only

One second split into 24 frames. Move along them faster than anyone can follow — and freeze whoever can't keep up inside a frame.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| 24 FPS Rush | Grade 4 | 15 CE | 4 s | Blink 12 blocks ahead: 6 damage to everyone you pass, frozen for 1 s. |
| Frame Freeze | Grade 4 | 20 CE | 8 s | Freeze the one in front for 2.5 s (6 damage) — or shatter a frozen one for 14. |
| Accelerated Barrage | Grade 2 | 40 CE | 18 s | 6 s of Speed III and +50% damage. |
| Domain Expansion: Time Cell Moon Palace | Grade 1 | 70% of max CE | 90 s | Radius 12, 9 s: whoever moves inside takes 5 damage every second. |

### Cursed Spirit Manipulation — Rare · 4.2% · any clan

Every curse you exorcise is swallowed and kept (up to 12). Release them to fight for you — or compress them all into Uzumaki.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Release | Grade 4 | 15 CE | 6 s | Your strongest stored curse fights for you for 30 s. |
| Absorb | Grade 4 | 20 CE | 10 s | Swallow a curse in front of you at 40% health or less (XP as if exorcised). |
| Cursed Swarm | Grade 2 | 45 CE | 25 s | Release up to four stored curses at once. |
| Maximum: Uzumaki | Grade 1 | 60 CE | 45 s | All stored curses in one blast along 24 blocks: 10 + 3 damage per curse. |

### Ten Shadows — Rare · 4.4% · Zen'in clan only

Shikigami from your shadow: the Divine Dogs, Nue and Max Elephant fight for you.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Divine Dogs | Grade 4 | 30 CE | 15 s | Two wolves fight for you for 30 s. |
| Nue | Grade 4 | 35 CE | 20 s | For 20 s it dives at your nearest enemy: 6 damage and slowness. |
| Max Elephant | Grade 2 | 60 CE | 25 s | Drops on the enemy you aim at (or where you look, 20 blocks): 20 damage in 5 blocks. |
| Domain Expansion: Chimera Shadow Garden | Grade 1 | 70% of max CE | 90 s | Radius 12, 10 s: enemies slowed, 2 damage a second; you're faster and tougher; two more dogs. |
| Eight-Handled Sword Divergent Sila Divine General Mahoraga | Special Grade | 120 CE | 120 s | The ritual: Mahoraga attacks everyone, you first. Beat it alone and it's yours — then it fights beside you for 40 s. |

### Idle Death Gamble — Rare · 5.4% · any clan

A gambler's technique. Its domain hurts no one — it spins for a JACKPOT, and a jackpot makes you all but immortal for 20 s.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Rough Energy | Grade 4 | 15 CE | 3 s | 9 damage to who you look at (10 blocks); 1 in 8: +20 CE back. |
| Shutter Doors | Grade 4 | 25 CE | 8 s | Two doors slam on who you look at: 14 damage and slowness. |
| Pachinko Rush | Grade 2 | 40 CE | 18 s | Eight balls fly out: 5 damage each. |
| Domain Expansion: Idle Death Gamble | Grade 1 | 70% of max CE | 90 s | Hurts no one. Every 2 s: 1 in 4 for a JACKPOT — 20 s of endless CE, fast healing and +25% damage, no burnout. |

### Heavenly Restriction — Rare · 6.0% · Zen'in clan only

No cursed energy at all — instead a monstrous body, cursed tools, and immunity to every domain's sure-hit.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Playful Cloud | Grade 4 | — | 12 s | Whirlwind: 3 blows of 7 damage in front of you. |
| Dragon-Bone | Grade 4 | — | 10 s | Impact Release: lunge for 8 + half the damage you took in the last 10 s (up to +20). |
| Inverted Spear of Heaven | Grade 2 | — | 20 s | Nullify: 10 damage through Infinity; breaks their domain and strips their buffs. |
| Split Soul Katana | Grade 1 | — | 16 s | Soul Split: 12 + 10% of their max health (up to +25). |

### Disaster Flames — Rare · 6.6% · any clan

Volcanic heat as a technique: burning insects, a stream of fire, a falling meteor — and a domain inside a volcano.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Ember Insects | Grade 4 | 20 CE | 6 s | Three burning insects: 8 damage each, and they set the target alight. |
| Fire Stream | Grade 4 | 25 CE | 7 s | A cone of fire (8 blocks) for 1 s: 4 damage four times, and burning. |
| Maximum: Meteor | Grade 2 | 70 CE | 30 s | A burning mountain falls on who you aim at: 28 damage within 6 blocks. |
| Domain Expansion: Coffin of the Iron Mountain | Grade 1 | 70% of max CE | 90 s | Radius 12, 10 s: everyone inside takes 3 damage a second and burns. |

### Cursed Speech — Uncommon · 9.8% · Inumaki clan only

Your words are commands — Don't Move, Blast Away, Crush. Every word costs your throat a little health.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| "Don't Move" | Grade 4 | 20 CE + 1 HP | 8 s | Freezes everyone in front of you (12 blocks) for 2 s. |
| "Blast Away" | Grade 4 | 20 CE + 1 HP | 6 s | 8 damage and a big push to everyone in front. |
| "Crush" | Grade 2 | 45 CE + 3 HP | 15 s | 22 damage to the one you look at (16 blocks). |
| Maximum: "Twist" | Grade 1 | 80 CE + 6 HP | 45 s | 30 damage to everyone within 10 blocks. |

### Straw Doll — Uncommon · 11% · any clan

Hammer, nails and a straw doll. Anyone you've hurt has left a piece of themselves behind — and what you do to the doll happens to them.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Hairpin | Grade 4 | 20 CE | 5 s | Three nails, 4 damage each; every nail that sticks bursts for 6 more. |
| Resonance | Grade 4 | 30 CE | 10 s | 14 damage to the last enemy you hurt in 30 s, wherever they are (64 blocks). |
| Nail Barrage | Grade 2 | 45 CE | 15 s | Ten nails in every direction, 6 damage each. |
| Resonance: Cursed Doll | Grade 1 | 70 CE | 45 s | 20 damage and wither to every enemy you hurt in the last 30 s. |

### Ratio — Uncommon · 11% · any clan

Divide anything along a 7:3 line and strike that point for a critical hit. Work overtime and it only gets worse for them.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| 7:3 | Grade 4 | 20 CE | 6 s | 10 damage to the one in front, x1.7 while they're above 70% health. |
| Blunt Sword Flurry | Grade 4 | 25 CE | 9 s | Three blows of 5; the third is a guaranteed critical (13.6). |
| Overtime | Grade 2 | 40 CE | 60 s | A binding vow: 20 s of +40% damage and Strength. |
| Extension: Collapse | Grade 1 | 70 CE | 40 s | Shatter the ground ahead: 26 damage within 6 blocks, and a short stun. |

### Blood Manipulation — Uncommon · 14% · Kamo clan only

Your blood is a weapon: Piercing Blood, Supernova, and buffs that push your body past its limits.

| Move | Unlocks | Cost | Cooldown | What it does |
|---|---|---|---|---|
| Piercing Blood | Grade 4 | 20 CE + 1 HP | 5 s | 14 damage to everyone along a 20-block beam. |
| Convergence | Grade 4 | 30 CE | 30 s | 20 s: Speed II, Strength I, Haste II. |
| Supernova | Grade 2 | 50 CE | 18 s | 18 damage to everyone within 5 blocks. |
| Flowing Red Scale: Stack | Grade 1 | 70 CE | 60 s | 20 s: Strength III, Speed III, Resistance II, Regeneration II — then 5 s weak. |

### Boogie Woogie — Common · 17% · any clan

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

**Curses you store (Cursed Spirit Manipulation).** Every Grade 4–1 curse you exorcise is absorbed, up to 12. Released
curses fight for you for 30 s and give no XP. The bar shows how many you hold.

**JACKPOT (Idle Death Gamble).** The domain hurts no one: every 2 s it spins (1 in 4). A jackpot closes it with no
burnout and gives 20 s of endless cursed energy, Regeneration IV and +25% damage.

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
  - **Time Cell Moon Palace:** a moonlit dome cut into film frames. Whoever moves inside is torn apart.
  - **Coffin of the Iron Mountain:** the inside of a volcano. Everyone burns.
  - **Self-Embodiment of Perfection:** a dark dome of stitches and hands. A last touch for whoever stays to the end.
  - **Idle Death Gamble:** a pachinko parlour that hurts no one, but can hit the JACKPOT.
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

## Mahoraga

The **Eight-Handled Sword Divergent Sila Divine General Mahoraga** is the strongest shikigami of the Ten Shadows, and
no one has ever tamed it.
- **The ritual:** at **Special Grade**, the Ten Shadows' fifth move calls it out as a wild boss (1,600 health, a boss
  bar). It attacks everyone near it, its summoner first.
- **Taming it:** beat it **alone** and it's yours. From then on the same move calls it to fight beside you for 40 s.
- **A void ritual:** if anyone else lands a blow (another player, an NPC, someone else's shikigami), the ritual is void.
  It can still be exorcised (1,500 XP and a Cursed Womb), but not tamed this time.
- **If the summoner falls:** when they die, leave or run 64 blocks, the ritual ends and Mahoraga sinks back into the
  shadows.
- **Adaptation:** Mahoraga adapts to whatever hurts it, and each kind of attack is counted on its own: each technique,
  melee, domain sure-hits, shikigami, arrows, fire.
  - After enough of one kind, **the wheel over its head turns**. Mahoraga heals 4%, and that kind does less from then
    on: 100% → 65% → 40% → 20% → 5%.
  - Switch it up, or finish it before it adapts.
- **Its attacks:**
  - a sweep of the Sword of Extermination: double damage against curses, +50% against a sorcerer whose technique it has
    fully adapted to
  - a leap at anyone who keeps their distance
  - below half health it moves faster and swings more often
- Jujutsu High stays out of a ritual.

## Binding Vows

A Binding Vow is a promise to yourself: give something up and get something back.
- **One vow at a time.** Make it in the Jujutsu Record (**Binding Vows**).
- **Changing it:** you can change or break it once every **10 minutes**.
- Ratio's Overtime is a vow of its own and stacks with these.

| Vow | You get | You give up |
|---|---|---|
| **Glass Cannon** | +25% technique damage | techniques hit you 20% harder |
| **Revealed Technique** | +20% technique damage | every move is explained aloud to everyone near you |
| **Swift Hands** | 30% shorter cooldowns | moves cost 30% more cursed energy |
| **Frugal** | moves cost 30% less cursed energy | cooldowns are 30% longer |
| **Blood Price** | +35% technique damage | every move also costs you 3 health |
| **Chase the Spark** | double Black Flash chance | techniques hit 15% softer |
| **Brawler** | +30% melee damage | techniques hit 20% softer |
| **Deep Reserves** | +50% cursed energy regeneration | techniques hit 10% softer |

## The cast

One entity, `jjk:sorcerer`, wears every character: a 128×128 painted skin (a 16×16 face, plain hair painted on both
layers) and a 3D model for what sticks out: collars, hoods, coats, Sukuna's four arms, the weapons on their backs. Each character fights with the same techniques players use, plus a few of their own. A spawn egg gives a
random member of Jujutsu High.

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
| Kinji Hakari — *Idle Death Gamble* | Jujutsu High | Clanless | Rough Energy, Shutter Doors, Pachinko Rush, Domain Expansion: Idle Death Gamble | 240 | 400 XP |
| Ryomen Sukuna — *King of Curses* | villain | Clanless | Dismantle, Cleave, Fuga, Domain Expansion: Malevolent Shrine | 3000 | 3000 XP · 3× Sukuna's Finger, 1× Cursed Womb |
| Toji Fushiguro — *Sorcerer Killer* | villain | Zen'in | Burst, Inverted Spear of Heaven, Playful Cloud, Split Soul Katana | 900 | 1200 XP · 1× Cursed Womb (50%) |
| Suguru Geto — *The Worst Curse User* | villain | Clanless | Release, Cursed Swarm, Maximum: Uzumaki | 1400 | 1500 XP · 1× Sukuna's Finger |
| Mahito — *Special Grade Curse* | villain | Clanless | Soul Touch, Body Repel, Polymorphic Soul Isomer, Domain Expansion: Self-Embodiment of Perfection | 1000 | 1200 XP · 1× Cursed Womb (60%) |
| Choso — *Death Painting* | villain | Kamo | Piercing Blood, Supernova, Convergence | 800 | 1000 XP · 1× Cursed Womb (50%) |
| Jogo — *Special Grade Curse* | villain | Clanless | Ember Insects, Fire Stream, Maximum: Meteor, Domain Expansion: Coffin of the Iron Mountain | 1100 | 1200 XP · 1× Sukuna's Finger |
| Naoya Zen'in — *Projection Sorcery* | villain | Zen'in | 24 FPS Rush, Frame Freeze, Accelerated Barrage, Domain Expansion: Time Cell Moon Palace | 950 | 1100 XP · 1× Cursed Womb (60%) |

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
  sure-hit lands at half strength. Geto's released curses and Mahito's transfigured humans fight for them.
- **If nobody comes:** they leave when no one is near for a minute.

## Admins

- **Admin Panel:** tag yourself (`/tag @s add jjk_admin`) and it appears in your Jujutsu Record. You can also open it
  with `/scriptevent jjk:admin`. It lets you:
  - edit any player (clan, technique, grade, fingers, refill)
  - summon the Finger Bearer, Mahoraga or any character (optionally standing still, for a hub)
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
  | `/scriptevent jjk:mahoraga` | summon a wild Mahoraga next to you (no ritual: it can't be tamed) |
  | `/scriptevent jjk:tame_mahoraga [off] [name]` | let a Ten Shadows sorcerer skip the ritual (`off` undoes it) |
  | `/scriptevent jjk:reset [name]` | wipe a player (also their vow, stored curses and Mahoraga); they're born and awaken again |
  | `/scriptevent jjk:record` | open your Jujutsu Record |
  | `/scriptevent jjk:credits` | who made this add-on |

## For developers

Everything visual is **generated by Python** (Pillow only). Change the generator and re-run it; never hand-edit its
output. Run the generators from this folder:

| Generator | Makes |
|---|---|
| `tools/gen_entities.py` | Curses, shikigami (Mahoraga too) and effect models (orbs, the domain dome and its six barriers, the shrine): geometry, painted textures, idle animations, BP/RP entities, spawn rules, names |
| `tools/gen_sorcerers.py` | The cast: 128×128 painted skins (16×16 faces, plain painted hair) + 3D gear for all 19 characters (built with `tools/sorcerer_kit.py`), their body geometry, the `jjk:sorcerer` entity (BP + RP), render controllers, `roster_ids.js`. Preview with `--preview out.png [--only gojo,sukuna]` |
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
| `domains.js` | domains, clashes, Simple Domain (`registerDomain` lets a technique add its own) |
| `tech_*.js` | the fourteen techniques |
| `servants.js` | curses that fight for someone (Geto's, Mahito's) |
| `mahoraga.js` | Mahoraga: the ritual, adaptation, the wheel |
| `vows.js` | Binding Vows |
| `techniques.js` | awakening, items, using moves |
| `curses.js` | curses, the Finger Bearer, night surges |
| `sorcerers.js` + `npc_moves.js` | the cast |
| `record.js` | the Record and the Admin Panel |
| `commands.js` | admin commands |

**Tests:** `./tests/run.sh` runs the mock tests (no Minecraft needed). They cover:
- every move of every technique and of every character
- what each of the five new techniques does, their domains, and whose side a summoned curse is on
- Mahoraga's ritual, adaptation and taming; every Binding Vow
- Black Flash, Infinity, domains and clashes
- clans and their perks
- sparring, encounters and rewards
- the Record, the commands
- the credits, including a copy with them edited out

**Release:**
1. Bump the version in **both** manifests. Never change the pack UUIDs: players' data depends on them.
2. Run `./build.sh`.
