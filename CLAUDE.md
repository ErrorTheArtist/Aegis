# Way of The Shinobi — notes for Claude Code

A Naruto add-on for Minecraft Bedrock, in `shinobi-addon/`. This file explains **how the 3D models are made and wired
into the game**: Tailed Beasts and other big bosses, humanoid NPCs and legends, swords (held items), armour, summons
and effect models. Read it before adding or changing any model.

## The one rule: models are generated, never hand-edited

Every model, texture, attachable, client entity and most entity/item JSON is **written by a Python generator in
`shinobi-addon/tools/`**. To change a model, change the generator and re-run it. Edits made directly to the generated
`.geo.json` / `.png` / entity files are lost the next time the generator runs.

- Run generators from `shinobi-addon/`: `python3 tools/gen_swords.py` (they use paths relative to the repo).
- Generators are deterministic (seeded randomness), so a re-run should only change what you touched. Check with
  `git status` / `git diff --stat` and investigate any unexpected changes.
- **`gen_npcs.py` and `gen_bijuu.py` rewrite `resource_pack/texts/en_US.lang` and can reorder it.** Back the file
  up first, then compare sorted lines afterwards. If only the order changed, restore the backup.
- Python needs only Pillow (and numpy for `gen_jinchuriki.py`).

| Generator | Makes |
|---|---|
| `gen_bijuu.py` | The nine Tailed Beasts and the Ten-Tails: geometry, textures, idle and roar animations, BP and RP entities, loot |
| `gen_npc_gear.py` + `gen_npc_models.py` | Humanoid NPC skins and their 3D **gear** layer (Akatsuki, legends, village NPCs, Kages…) |
| `gen_npcs.py` | NPC entities (BP and client), the skin list, render controllers, summon animals (toad, slug, snake, hound, hawk) |
| `gen_swords.py` | Swords and other held weapons: held model (attachable), icon, item JSON, the back-sling and carry animations |
| `gen_armor.py` | Wearable armour and clothing: attachable, model, palette texture, icon, item JSON |
| `gen_jinchuriki.py` | Tailed Beast cloaks (worn chest pieces with tails, glow layer, form animation) and the jutsu orb's Bijuudama stages |
| `gen_titles.py` | Title-of-legend scrolls, tools and some hand-drawn icons |
| `gen_fun.py` | Mystery Scroll, Contest Ramen, A Thousand Years of Death scroll and the Treasure Toad (reuses the toad model) |
| `gen_player_anims.py` | Player animations (jutsu poses, emotes, the M1 combo, wall run, flips) |
| `gen_icons.py` | 2D item icons (scrolls, eyes, headbands…); its helpers are imported by other generators |

## Units and orientation (all models)

- **16 pixels = 1 block.** Cube `origin` and `size` are in pixels; `pivot` too.
- **The model's front is −Z.** A face that should look forward goes on the `north` face.
- For humanoids, the character's **right side is −X** (the right arm spans x −8…−4) and their left is +X.
- Rotations are degrees `[x, y, z]` about the bone's pivot. When a rotated part's direction matters (a slanted
  headband, a cape), check it in a preview. A stepped stack of unrotated cubes avoids any doubt about direction.
- Humanoid bones (vanilla `geometry.humanoid` names): `root`, `waist`, `body`, `head`, `rightArm`, `leftArm`,
  `rightLeg`, `leftLeg`, with pivots `head`/`body` (0, 24, 0), `rightArm` (−5, 22, 0), `leftArm` (5, 22, 0),
  `rightLeg` (−1.9, 12, 0), `leftLeg` (1.9, 12, 0). Gear and armour reuse these names so the body's animations move them.
- `visible_bounds_*` must cover the whole model, or it vanishes when its origin leaves the screen. Big models need big
  bounds. For example, the beasts use 14×10, and giant summons get 16×14.

## Tailed Beasts and big creature bosses — `tools/gen_bijuu.py`

Each beast is built from a small **creature kit** (`class Kit`) in code:

- **Texture:** one 256×256 atlas made of 64×64 painted **swatches** (`TILES`: main, under, accent, dark, belly,
  pattern, ivory, mouth, glow…). Every cube face samples a random window of its swatch, so large surfaces get texture
  instead of flat colour. `LOOKS` picks each swatch's style (fur, skin, stripes, plates, flames, suckers) and the eyes.
- **Parts:**
  - `K.box(origin, size, sw, under, top, front)` is a cube whose underside automatically uses the shaded swatch.
  - `K.leg(parent, x, z, hip_y, upper, lower, paw, claws)` makes a jointed leg: bone `leg<i>`, knee bone `leg<i>_l`.
  - `K.tail(parent, base, segs, w0, w1, seg_len, lift, yaw, curl)` makes a chain of tapering segments, bones
    `tail<i>_<k>`.
  - Also `jaw()`, `upper_teeth()` and `K.eye()` for painted eyes.
- **One builder per beast:** `m_shukaku`, `m_kurama`, `m_juubi`… registered in `MODELS`. Sizes and colours live in
  `BEASTS` (W/H/L body size, legH, head, snout, ears, tail, colours, spawn egg).
- **Animation:** `build_animation()` writes `animation.aegis.<id>.idle` from Molang. The legs walk from
  `q.modified_distance_moved`, a wave travels down each tail, the jaw opens on attack, and wings flap. It animates only
  the bones the beast actually has. The roar is `animation.aegis.bijuu_roar`.
- **Entity:** health, attack, collision box (derived from the model's size), boss bar (`minecraft:boss`), targeting
  (skips players tagged `aegis_grace`) and loot are all written here. Balance numbers live here too (v1.61: health ×4,
  attack ×1.5).
- **Behaviour (attacks, Bijuudama, specials)** is script, not JSON: `behavior_pack/scripts/bijuu.js` and `juubi.js`.
  `dmgutil.js` caps any single hit at 4% of a beast's health.

To add a creature boss, add an entry to `BEASTS`, write an `m_<id>(K, b)` builder, register it in `MODELS` (and
`LOOKS` if it needs special swatches), re-run, and add its behaviour in a script.

## Humanoid NPCs, legends and Akatsuki — skin + 3D gear

Humanoids are **two layers**:

1. **The skin:** a normal 64×64 player-style skin, both layers, painted in code (`Skin` class in `gen_npc_gear.py`;
   hand-made skins can sit in `tools/skins/`). It's drawn on `geometry.humanoid.custom`.
2. **The gear:** a second geometry `geometry.aegis.gear_<name>` (64×64 texture `gear_<name>.png`) for everything that
   sticks out in 3D: hats, hair, capes, collars, weapons on the back, pouches. It's built with the `Gear` class in
   `gen_npc_gear.py`:
   - `g.bone(name, parent, pivot)` and `g.cube(bone, origin, size, uv(...), inflate, rotation, pivot)`.
   - `uv(north=(x, y, w, h), …, rest="none")` sets each face's texture rectangle. `"none"` points at a transparent
     corner. `ring(region)` makes a band.
   - The gear's bones are named like the body's, so the walk, look and attack animations move it. Extra swaying bones
     (`g_ties`, `g_scarf_*`, `g_tail`, ponytails, lanterns) are animated by `animation.aegis.npc_gear.flutter`. Each
     model's swaying bones are added to the `FLUTTER` dict.
- **Register a model** in `gen_npc_models.py`: `MODELS[name] = (skin_fn, gear_fn)`. Then add the name to `SKINS` in
  `gen_npcs.py`. Its position in that list is the **skin index**.
- **How the right gear is drawn:** the NPC client entities (`client_humanoid()` in `gen_npcs.py`) list every gear
  geometry and texture, with a render controller per gear (`controller.render.aegis.npc_gear_<name>`) that is
  active only when `q.property('aegis:skin') == <index>`. The script sets that property:
  - `setupNpc()` in `npcs.js`, using `NPC_TYPES[...].skin`
  - `LEGENDS[id].skin` in `legends.js`
  - `AKATSUKI` in `npcs.js`
- **Order:** run `gen_npc_gear.py` (skins and gear) **then** `gen_npcs.py` (client entities, which only include gear
  files that exist).
- **Legends** share one entity, `aegis:legend`. Each has a component group `aegis:legend_<id>` and a health value in
  `LEGEND_HP`. What a legend holds in hand is set with `LEGEND_EQUIP` (an item id, for example
  `aegis:kusanagi_drawn`). Fight moves, phases and Susanoo are in `legends.js`. A legend waits in a calm state until
  challenged: script tags whose names start with `aegis_q_` make it spawn already fighting.
- **Preview:** `python3 tools/gen_npc_gear.py --preview out.png --only <name>` renders the NPC front and back with
  its gear.

## Swords and held weapons — `tools/gen_swords.py`

- **Design space:** each weapon is a list of `box(offset, size, swatch)` cubes **relative to the grip** (`G`), with the
  **blade pointing −Z** and width along +Y.
- **Texture:** a 64×64 palette of 8×8 swatches (`SW`: steel, edge, dark, wrap, accent, accent2, light, red, sheath)
  filled from the weapon's `colors`.
- **Defining a weapon:** `SWORDS[id] = dict(name, damage, durability, owner, colors, slash, recipe=None, cubes)`.
  - `slash` is the colour of the weapon's slash particles; it's written to `tools/sword_colors.json`.
  - An optional `sheath` list gives a scabbard bone, which the drawn form can hide.
- **Held model:** `held_cube()` converts design space into the vanilla **trident's** pole space (blade along +Y,
  gripped at y 13.5), so the hand lands on the handle. The attachable binds the model to the hand with the
  `HOLD_ROT` / `HOLD_POS` pose.
  - Standing still swings the blade onto the shoulder ("carry", `controller.animation.aegis.sword_carry`).
  - In the off hand, a second copy is drawn on the **back** (`back_bone()`, following the body bone).
  - Samehada and the Kusanagi use a player carrying pose (`POSED`).
- **Item JSON:** written here, with `minecraft:use_modifiers` so right-click counts as a "use" and the special fires.
- **Icon:** rendered automatically from the same cubes (a side view turned 45°). In the icon, **thicker cubes are
  drawn first**, so a decoration only shows on the icon if it's thinner than what it sits on. Put crests and trims as
  0.1-thick plates on the faces (see `gunbai_v2`).
- **Behaviour:**
  - Right-click specials are in `swords.js` (`SWORDS` there) or, for title weapons, `titles.js` / `legend_titles.js`
    (`SPECIALS`).
  - The M1 combo treats an item as a blade if its id matches `BLADES` in `m1.js`. Add new weapon ids there.
- Swords are never craftable (any old recipe file is deleted). They come from shops, drops or titles.

## Armour and clothing — `tools/gen_armor.py`

- **Defining a piece:** `ARMOR[id] = dict(name, slot, prot, dur, colors, bones={bone: [cubes]}, recipe=None)`.
  - Slots: `head`, `chest`, `legs`, `feet`.
  - Sets are grouped in dicts (`SANNIN`, `VILLAGE_GEAR`, `ROGUE_GEAR`, `TITLE_GEAR`…) merged into `ARMOR`.
- **Cubes:** `c(origin, size, swatch, inflate)` in **player model space**, using the bone names `head`, `body`,
  `rightArm`, `leftArm`, `rightLeg`, `leftLeg`.
  - Helpers: `BODY(inflate, sw)`, `RARM`/`LARM`/`RLEG`/`LLEG`, `SHOULDER_R`/`SHOULDER_L`.
  - `rotz(o, s, sw, deg, pivot)` makes a z-rotated cube.
  - A **chest item may also put cubes on the legs and arms** (coats, robes, the jumpsuit).
- **Texture:** a 64×64 palette from `SW` = base, dark, light, accent, accent2, metal, red, white, gold, black.
- **Output:** an attachable using `controller.render.armor` with the `armor` / `armor_enchanted` materials, the
  geometry `geometry.aegis.armor_<id>`, and an item with `minecraft:wearable` (slot and protection).
- **Icon:** rendered from the model, unless the id is in `DRAWN_ICONS` (then it's drawn in `gen_titles.py` or
  `gen_icons.py`, which suits flat things like masks and headbands).
- **Behaviour:** set bonuses, Kage and Sannin sets, perks are in `armor.js` (`SETS`, `KAGE_VILLAGES`, `SANNIN_SETS`).
- **Preview:** load `armor_<id>.geo.json` with its palette texture in `tools/cine_preview.py` on top of a humanoid
  skin (its bones line up with the body's), and check the generated icon.

## Summons and giant summons — `tools/gen_npcs.py` (`ANIMALS`)

- Each animal has a builder (`toad()`, `slug()`, `snake()`, `hound()`, `hawk()`), texture colours, health, damage,
  speed, collision box and spawn egg. The idle animation is generated in the same loop.
- **Giant forms** (Gamabunta, Katsuyu) reuse the same model through a `GIANT` component group, `aegis:giant`
  (`minecraft:scale`, more health and attack, a bigger collision box, a 40 s timer), triggered by script
  (`legend_titles.js`). Scaling an entity up is the cheapest way to make a "big" version of an existing model.
  Remember to enlarge `visible_bounds`.
- The Treasure Toad (`gen_fun.py`) reuses `geometry.aegis.summon_toad` with a recoloured texture and
  `minecraft:scale` 0.6.

## Effect models (Susanoo, jutsu orbs, dragons, the Rasenshuriken…)

- These are small **entities that only exist to be seen**: `aegis:jutsu_orb`, `aegis:susanoo`, `aegis:fire_dragon`,
  `aegis:water_shark`, `aegis:edo_coffin` and others.
- Scripts spawn them with `spawnFx(dim, id, event, loc)` and move them every tick with `follow(entity, posFn, ticks,
  rotFn)` (both in `main.js`).
- Variants are chosen with events, for example the orb's `aegis:as_rasengan` / `aegis:as_bijuudama` /
  `aegis:as_fireball`, which set a render-controller texture or geometry array.
- **Every effect model must be listed in `FX_MODELS` in `main.js`**, or jutsu will hit their own visuals.

## Player animations — `tools/gen_player_anims.py`

- Pose-to-pose keys:
  ```
  A["animation.aegis.<name>"] = anim(length, [(time, ease, {bone: rot | (rot, pos)}), …], plant=True, loop=False)
  ```
  - Bone aliases: `rt` root, `w` waist (`HIPS(lean, twist, side, drop, fwd)`), `b` body, `h` head, `ra`/`la` arms,
    `rl`/`ll` legs.
  - Easings include `lin`, `io`, `snap`, `back`, `out` and `in`. The string `REST` returns every bone to zero.
  - `plant=True` lowers the model so a foot stays on the ground. Use `plant=False` for jumps and flips.
  - A 360° spin needs a `"cut"` key at the same time to unwind it.
- Scripts play them with `api.anim(entity, "animation.aegis.<name>", controller, stopExpression)`.
- **Preview:** `python3 tools/anim_preview.py sheet animation.aegis.<name> -o out.png` (or `gif`).

## Previewing before you ship

Always look at a new or changed model before committing:

- `tools/anim_preview.py` renders player animations as a contact sheet or GIF.
- `tools/gen_npc_gear.py --preview` renders NPCs with their gear.
- `tools/jin_preview.py` renders the Jinchūriki cloaks.
- `tools/cine_preview.py` is a small software renderer for any `.geo.json` with its texture:
  `CP.load_geo(geo, png)`, `CP.model_quads(model, anim, t, place)`, `CP.Camera(...)`, `CP.render(...)`.
  Use it for beasts, summons and anything else.
- Item icons are PNGs in `resource_pack/textures/items/aegis/`. Put them on a contact sheet scaled ×4 with
  `Image.NEAREST` to judge them.

## Checklist for a new model

1. Add it in the right generator (never in the output files) and re-run that generator (for NPCs, `gen_npc_gear.py`
   then `gen_npcs.py`).
2. Check `git status`: only your files should change. Restore `en_US.lang` if it was only reordered.
3. Preview it: front and back for wearables and NPCs, the icon for items, the animation for anything that moves.
4. Wire the behaviour in `behavior_pack/scripts/`. New items need an icon in `item_texture.json`, which the
   generators add.
5. Run the mock tests and the build (`./build.sh`). Bump the version in **both** manifests and **never change the
   pack UUIDs** (players' data depends on them).

## Other gotchas

- Scripts target `@minecraft/server` **1.16.0**. Not available there: `Block.isSolid`, `applyImpulse` on players
  (use `applyKnockback`). Available: `Player.isJumping`.
- `node --check file.js` does **not** catch syntax errors in these ES modules (Node 22 detection). Check the `.mjs`
  copies used by the mock tests instead.
- Bedrock's chat and UI font can't draw emoji outside the basic Unicode range (🥇, 🍜…). Use symbols like ✦ ⚔ ⚑ ★.
- Python heredocs that build JS strings turn `\n` into real line breaks. Write `\\n` inside double-quoted JS
  strings.
