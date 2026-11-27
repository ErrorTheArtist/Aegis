// The cinematics (cinematic.js + cine_shots.js) and the VFX budget (core.js): every domain has its own cinematic, what
// the camera does, who watches (the caster; players caught inside from the reveal), each domain's fog, early ends,
// death and rejoining, the watchdog, the off switches, the preview command — and the per-tick particle budget.
import { H, mkPlayer, spawn, tick, fire, use, check, done, world, system, answers } from "./harness.mjs";
import { readFileSync, existsSync } from "node:fs";
await import("./main.mjs");
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const D = await import("./domains.mjs");
const CI = await import("./cinematic.mjs");
const S = await import("./sorcerers.mjs");
const core = await import("./core.mjs");
const { CINE } = await import("./cine_shots.mjs");
const ROOT = process.env.JJK_ROOT;

// --- the data: one cinematic for each domain, and Hollow Purple's ---------------------------------------------------
const MOVE = { void: ["limitless", "unlimited_void"], shrine: ["shrine", "malevolent_shrine"], garden: ["ten_shadows", "chimera_shadow_garden"],
  moon: ["projection", "time_cell_moon_palace"], volcano: ["disaster_flames", "iron_mountain"], perfection: ["idle_transfiguration", "self_embodiment"],
  jackpot: ["idle_death_gamble", "idle_death_gamble_domain"], tides: ["disaster_tides", "horizon_skandha"] };
check("eight domains, each with a cinematic of its own", Object.keys(D.KINDS).length === 8 && Object.keys(D.KINDS).every((k) => CINE[k] && MOVE[k]), Object.keys(D.KINDS));
check("…and one for Hollow Purple", !!CINE.purple);
check("no two cinematics share a shot list", new Set(Object.values(CINE).map((c) => JSON.stringify(c.shots.map((s) => s.pos)))).size === Object.keys(CINE).length);
const PARTICLES = new Set(["aura", "beam", "blood", "bolt", "burst", "debris", "ember", "fish", "flash", "glyph", "implode", "orb", "pillar", "ring", "shell", "slash",
  "smoke", "spark", "stars", "streak", "vortex"]);
for (const [k, c] of Object.entries(CINE)) {
  const ts = c.shots.map((s) => s.t);
  check(`${k}: shots in order from tick 0, the first a cut`, ts[0] === 0 && !c.shots[0].ease && ts.every((t, i) => i === 0 || t > ts[i - 1]) && ts.at(-1) < c.length);
  check(`${k}: every beat inside its ${c.length} ticks`, [...c.text, ...c.fades, ...c.fx, ...c.sounds, ...c.shakes].every((x) => x.t >= 0 && x.t <= c.length));
  check(`${k}: its particles exist`, c.fx.every((x) => PARTICLES.has(x.id) && existsSync(`${ROOT}/resource_pack/particles/${x.id}.particle.json`)), c.fx.map((x) => x.id));
  const fog = `${ROOT}/resource_pack/fogs/jjk_${c.fog}.json`;
  check(`${k}: its fog exists`, existsSync(fog) && JSON.parse(readFileSync(fog, "utf8"))["minecraft:fog_settings"].description.identifier === `jjk:fog_${c.fog}`);
  if (D.KINDS[k]) {
    check(`${k}: titled with its name, in Japanese too`, c.text.some((x) => x.title.toUpperCase().includes(D.KINDS[k].name.toUpperCase()) && /[぀-鿿]/.test(x.sub)));
    check(`${k}: its fog is the domain's own`, c.fog === k && c.victim > 0 && c.victim < c.length);
  }
}

// --- a player's domain --------------------------------------------------------------------------------------------
const g = mkPlayer("Gojo", { x: 0, y: 64, z: 0 });
const yuji = mkPlayer("Yuji", { x: 5, y: 64, z: 0 }); // inside
const builder = mkPlayer("Builder", { x: -5, y: 64, z: 0 }); builder._mode = "creative"; // inside, but building
const far = mkPlayer("Far", { x: 0, y: 64, z: 40 }); // outside
for (const q of [yuji, builder, far]) q._props["jjk:technique"] = "boogie";
await tick(2);
const f3 = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;
function setup(p, tech) {
  p._props["jjk:technique"] = tech; p._props["jjk:infinity_off"] = true;
  Gr.setXp(p, 40000); E.setCE(p, 99999); T.resetCooldowns(p); D._state.burnout.clear();
  for (const d of [...D.activeDomains()]) D.collapse(d);
  p.location = { x: 0, y: 64, z: 0 }; p._view = { x: 0, y: 0, z: 1 }; p._hp = 40;
}
const camSets = (p) => p._cmds.filter((c) => c.startsWith("camera @s set minecraft:free"));
const all = [g, yuji, builder, far];
const clear = () => { for (const q of all) { q._cmds.length = 0; q._titles.length = 0; } };

setup(g, "limitless");
await tick(2); clear();
await use(g, "jjk:unlimited_void");
await tick(1);
const s0 = CINE.void.shots[0];
// facing +z: in front = +z, to the right = -x
const want = `pos ${f3({ x: -s0.pos[1], y: 64 + s0.pos[2], z: s0.pos[0] })} facing ${f3({ x: -s0.look[1], y: 64 + s0.look[2], z: s0.look[0] })}`;
check("the caster watches: a free camera on the hand sign", camSets(g)[0]?.endsWith(want), camSets(g)[0] + " / " + want);
check("…can't walk or turn, and the HUD is hidden", ["inputpermission set @s movement disabled", "inputpermission set @s camera disabled", "hud @s hide all"].every((c) => g._cmds.includes(c)));
check("…and is tougher while watching", (g.getEffect("resistance")?.amplifier ?? -1) >= 2);
check("…the domain is open all the same", !!D.domainOf(g));
check("a cinematic shows instead of the plain announcement", !g._titles.some((t) => t.startsWith("§5§lDOMAIN EXPANSION")) && yuji._titles.some((t) => t.startsWith("§5§lDOMAIN EXPANSION")));
await tick(22); // (ticks 0-22 played)
check("players inside aren't watching yet", camSets(yuji).length === 0 && !CI.inCinematic(yuji));
await tick(2); // tick 24: the reveal
check("players caught inside watch from the reveal", CI.inCinematic(yuji) && camSets(yuji).length >= 1);
check("…straight in with a cut, flashing in", !camSets(yuji)[0].includes(" ease ") && yuji._cmds.some((c) => c.startsWith("camera @s fade time 0 ")));
check("creative players are left alone", !CI.inCinematic(builder) && camSets(builder).length === 0);
check("players outside aren't pulled in", !CI.inCinematic(far) && camSets(far).length === 0);
check("the camera glides and cuts", camSets(g).some((c) => c.includes(" ease ")) && camSets(g).some((c) => !c.includes(" ease ")));
check("a white-out as it opens", g._cmds.some((c) => c.startsWith("camera @s fade time") && c.endsWith("color 235 245 255")));
check("its fog rolls in at the reveal", g._cmds.includes("fog @s push jjk:fog_void jjk_cine"));
await tick(8);
check("from the reveal everyone inside sees the domain's fog", [g, yuji, builder].every((q) => q._cmds.includes("fog @s push jjk:fog_void jjk_domain")));
check("…nobody outside does", !far._cmds.some((c) => c.includes("fog_void")));
check("the world sees it: the sigil, the stars", ["jjk:glyph", "jjk:stars", "jjk:pillar"].every((id) => H.particles.some((x) => x.id === id)));
check("…and the screen shakes for everyone near", yuji._cmds.some((c) => c.startsWith("camerashake add @s")) && !far._cmds.some((c) => c.startsWith("camerashake")));
await tick(30);
check("its name, in Japanese too", g._titles.some((t) => t.includes("UNLIMITED VOID") && t.includes("無量空処")) && yuji._titles.some((t) => t.includes("UNLIMITED VOID")));
check("the camera comes back at the end", [g, yuji].every((q) => !CI.inCinematic(q) && ["camera @s clear", "inputpermission set @s movement enabled",
  "inputpermission set @s camera enabled", "hud @s reset", "fog @s remove jjk_cine"].every((c) => q._cmds.includes(c))));
check("…the domain still open, its fog still there", !!D.domainOf(g) && !yuji._cmds.includes("fog @s remove jjk_domain"));
D.collapse(D.domainOf(g));
check("when it closes the fog lifts", [g, yuji, builder].every((q) => q._cmds.includes("fog @s remove jjk_domain")) && D._state.fogged.size === 0);

// every domain plays its own
for (const [kind, [tech, move]] of Object.entries(MOVE)) {
  setup(g, tech); clear();
  await use(g, `jjk:${move}`);
  await tick(1);
  const s = CINE[kind].shots[0];
  const at = `pos ${f3({ x: -s.pos[1], y: 64 + s.pos[2], z: s.pos[0] })}`;
  check(`${kind}: casting it plays its own cinematic`, !!D.domainOf(g) && CI.inCinematic(g) && camSets(g)[0]?.includes(at), camSets(g)[0]);
  D.collapse(D.domainOf(g));
  await tick(2);
  check(`${kind}: …which ends if the domain does`, !CI.inCinematic(g) && g._cmds.includes("camera @s clear"));
}

// --- Hollow Purple -------------------------------------------------------------------------------------------------
setup(g, "limitless"); clear();
for (const e of H.entities) if (e.typeId === "minecraft:zombie") e._valid = false;
const ahead = spawn("minecraft:zombie", { x: 0, y: 64, z: 16 }); ahead._max = ahead._hp = 400;
const aside = spawn("minecraft:zombie", { x: 16, y: 64, z: 0 }); aside._max = aside._hp = 400;
await use(g, "jjk:hollow_purple");
await tick(3);
check("Hollow Purple: the caster watches", CI.inCinematic(g) && camSets(g).length >= 1);
const ce = E.getCE(g);
await use(g, "jjk:blue");
check("no moves while you watch", E.getCE(g) === ce && T.cooldownLeft(g, "blue") === 0);
g._view = { x: 1, y: 0, z: 0 }; // (whatever happens to the view meanwhile)
await tick(70);
check("…it goes where you faced when you cast it", ahead._dmgLog.length === 1 && aside._dmgLog.length === 0, JSON.stringify([ahead._dmgLog.length, aside._dmgLog.length]));
check("…titled", g._titles.some((t) => t.includes("HOLLOW PURPLE") && t.includes("虚式")));
check("…its fog, then the camera back", g._cmds.includes("fog @s push jjk:fog_purple jjk_cine") && !CI.inCinematic(g) && g._cmds.includes("camera @s clear"));
check("…the rubble it tears up", H.particles.some((x) => x.id === "jjk:debris") && H.particles.some((x) => x.id === "jjk:vortex"));
// Gojo the NPC: a warning for the players near, nobody's camera
const npc = S.spawnSorcerer(H.dim(), "gojo", { x: 100, y: 64, z: 0 });
const near = mkPlayer("Near", { x: 110, y: 64, z: 0 }); near._props["jjk:technique"] = "boogie";
const gTitles = g._titles.length;
T.MOVES.hollow_purple.run(npc);
await tick(1);
check("Gojo the NPC's Hollow Purple: a warning for players near (not 100 blocks away)", near._titles.some((t) => t.includes("HOLLOW PURPLE")) && g._titles.length === gTitles);
check("…their camera stays their own", !CI.inCinematic(near) && camSets(near).length === 0);
await tick(60);

// --- a villain's domain: players caught inside watch it open ---------------------------------------------------------
const sukuna = S.spawnSorcerer(H.dim(), "sukuna", { x: 300, y: 64, z: 0 });
const caught = mkPlayer("Caught", { x: 305, y: 64, z: 0 }); caught._props["jjk:technique"] = "boogie"; caught._max = caught._hp = 500;
T.MOVES.malevolent_shrine.run(sukuna);
await tick(26);
check("a villain's domain: the players caught inside watch it", CI.inCinematic(caught) && camSets(caught).length >= 1);
D.collapse(D.domainOf(sukuna));
await tick(2);
check("…and get their camera back the moment it closes", !CI.inCinematic(caught) && caught._cmds.includes("camera @s clear"));

// --- death, rejoining, the watchdog -----------------------------------------------------------------------------------
setup(g, "limitless"); clear();
await use(g, "jjk:hollow_purple");
await tick(3);
g._hp = 0;
await fire("w.entityDie", { deadEntity: g, damageSource: { cause: "none" } });
check("dying hands the camera back at once", !CI.inCinematic(g) && g._cmds.includes("camera @s clear") && g._cmds.includes("inputpermission set @s movement enabled"));
await tick(60);
g._hp = 40; g._cmds.length = 0; g._props["jjk:cine"] = true; // (as if they had left the game in the middle of one)
await fire("w.playerSpawn", { player: g, initialSpawn: true });
check("coming back after leaving mid-cinematic: the camera is yours", g._cmds.includes("camera @s clear") && g._cmds.includes("hud @s reset") && g._props["jjk:cine"] === undefined);
CI._cine.busy.set(yuji.id, { film: {}, until: system.currentTick - 1 });
await tick(21);
check("the watchdog frees anyone a broken cinematic left stuck", !CI.inCinematic(yuji));

// --- the off switches and the preview -------------------------------------------------------------------------------
setup(g, "shrine"); clear(); g._props["jjk:cine_off"] = true;
await use(g, "jjk:malevolent_shrine");
await tick(30);
check("your cinematics off: no camera", !CI.inCinematic(g) && camSets(g).length === 0);
check("…the domain opens and says so", !!D.domainOf(g) && g._titles.some((t) => t.startsWith("§5§lDOMAIN EXPANSION")));
check("…and the world still sees its side", H.particles.some((x) => x.id === "jjk:glyph"));
check("…players inside still watch theirs", CI.inCinematic(yuji) || yuji._cmds.includes("camera @s clear"));
delete g._props["jjk:cine_off"];
await tick(40);
world.setDynamicProperty("jjk:cinematics", false);
setup(g, "limitless"); clear();
await use(g, "jjk:unlimited_void");
await tick(30);
check("the server's cinematics off: nobody's camera is taken", !CI.inCinematic(g) && !CI.inCinematic(yuji) && camSets(g).length + camSets(yuji).length === 0);
world.setDynamicProperty("jjk:cinematics", undefined);
setup(g, "limitless"); clear();
await fire("s.scriptEventReceive", { id: "jjk:cinematic", message: "garden", sourceEntity: g });
await tick(1);
check("/scriptevent jjk:cinematic garden plays it", CI.inCinematic(g) && camSets(g).length >= 1);
await tick(70);
// the Record: your own switch; the Admin Panel: everyone's, and light effects
globalThis.formLog = [];
answers.push({ selection: 5 }, { formValues: [true, true, false] }); // (Gojo: the bar, Infinity, cinematics)
await use(g, "jjk:jujutsu_record"); await tick(2);
check("Record -> Settings: switch your cinematics off", g._props["jjk:cine_off"] === true && formLog[1]?.ctl.some((c) => c.l.startsWith("Cinematics")));
g.addTag("jjk_admin");
answers.push({ selection: 8 }, { selection: 3 }, { formValues: [true, true, false, true, true, false, true] }); // (Admin Panel: after This Server)
await use(g, "jjk:jujutsu_record"); await tick(3);
check("Admin -> Server settings: cinematics off for everyone, light effects on", world.getDynamicProperty("jjk:cinematics") === false && world.getDynamicProperty("jjk:vfx_light") === true);
world.setDynamicProperty("jjk:cinematics", undefined); world.setDynamicProperty("jjk:vfx_light", undefined);

// --- the VFX budget ---------------------------------------------------------------------------------------------------
await tick(1);
const dim = H.dim();
const burst = (n, loc = { x: 0, y: 65, z: 0 }, d = dim) => { H.particles.length = 0; core._fx.spent = 0; for (let i = 0; i < n; i++) core.fx(d, "jjk:spark", loc); return H.particles.length; };
check("no more than 48 effects a tick", burst(200) === 48);
core._fx.light = true;
check("light effects: no more than 18", burst(200) === 18);
core._fx.light = false;
check("nothing nobody is near enough to see (64 blocks)", burst(10, { x: 5000, y: 65, z: 0 }) === 0 && burst(10, { x: 0, y: 65, z: 0 }, H.dim("minecraft:nether")) === 0);
burst(60);
core.fxMust(dim, "jjk:flash", { x: 0, y: 65, z: 0 });
check("a cinematic's beats skip the budget", H.particles.length === 49 && H.particles.at(-1).id === "jjk:flash");
await tick(1);
check("the budget refills every tick", core._fx.spent < 48);
done();
