// The five techniques added in 1.2: Projection Sorcery, Disaster Flames, Idle Transfiguration, Idle Death Gamble and
// Cursed Spirit Manipulation — what each move really does, their domains, and whose side a servant curse is on.
import { H, mkPlayer, spawn, tick, fire, use, check, done, world } from "./harness.mjs";
await import("./main.mjs");
world.setDynamicProperty("jjk:cinematics", false); // (moves back to back: no cinematics here — test9 plays them)
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const C = await import("./combat.mjs");
const D = await import("./domains.mjs");
const S = await import("./sorcerers.mjs");
const core = await import("./core.mjs");
const G = await import("./tech_gamble.mjs");
const Sp = await import("./tech_spirits.mjs");
const Sv = await import("./servants.mjs");
const dim = world.getDimension("minecraft:overworld");

const p = mkPlayer("Tester");
p._props["jjk:clan"] = "zenin";
await fire("w.playerSpawn", { player: p, initialSpawn: true });
await tick(61);
function reset(tech) {
  T.setTechnique(p, tech);
  Gr.setXp(p, 40000);
  T.resetCooldowns(p);
  E.setCE(p, 9999);
  for (const d of [...D.activeDomains()]) D.collapse(d);
  D._state.burnout.clear();
  p.location = { x: 0, y: 64, z: 0 };
  p._view = { x: 0, y: 0, z: 1 };
  for (const e of H.entities) if (e.typeId !== "minecraft:player") e._valid = false;
}
const mob = (type, at, max = 400) => {
  const e = spawn(type, at);
  e._max = max;
  e._hp = max;
  return e;
};
const last = (e) => e._dmgLog.at(-1)?.amount ?? 0;

// --- Projection Sorcery (Zen'in) ----------------------------------------------------------------------------------
check("Projection Sorcery is a Zen'in technique", T.TECHNIQUES.projection.clan === "zenin");
reset("projection");
const passed = mob("minecraft:zombie", { x: 0, y: 64, z: 4 });
await use(p, "jjk:projection_rush");
await tick(6);
check("24 FPS Rush: four frames forward (12 blocks)", Math.abs(p.location.z - 12) < 0.01, JSON.stringify(p.location));
check("…whoever you pass is hit and frozen in a frame", passed._dmgLog.length === 1 && C.stunned(passed));

reset("projection");
const frozen = mob("minecraft:zombie", { x: 0, y: 64, z: 3 });
await use(p, "jjk:projection_freeze");
check("Frame Freeze: frozen for 2.5 s", frozen._dmgLog.length === 1 && C.stunned(frozen));
await tick(12);
T.resetCooldowns(p);
await use(p, "jjk:projection_freeze");
check("…touch a frozen one again and the frame shatters (14 vs 6)", frozen._dmgLog.length === 2 && Math.abs(last(frozen) / frozen._dmgLog[0].amount - 14 / 6) < 0.01,
  JSON.stringify(frozen._dmgLog));

reset("projection");
const punching = mob("minecraft:zombie", { x: 0, y: 64, z: 3 }, 2000);
C.hurt(p, punching, 10);
const plain = last(punching);
await use(p, "jjk:projection_barrage");
await tick(12);
C.hurt(p, punching, 10);
check("Accelerated Barrage: +50% damage and Speed III", Math.abs(last(punching) / plain - 1.5) < 0.01 && p.getEffect("speed")?.amplifier === 2);
await tick(120);
check("…for 6 s", !p._bars.length || !p._bars.at(-1).includes("24 FPS"));

reset("projection");
const still = mob("minecraft:zombie", { x: 3, y: 64, z: 0 });
const mover = mob("minecraft:zombie", { x: -3, y: 64, z: 2 });
await use(p, "jjk:time_cell_moon_palace");
for (let i = 0; i < 4; i++) {
  mover.location = { ...mover.location, z: mover.location.z + 1 };
  await tick(20);
}
check("Time Cell Moon Palace: whoever moves is torn apart", mover._dmgLog.length >= 3 && still._dmgLog.length === 0,
  JSON.stringify([mover._dmgLog.length, still._dmgLog.length]));
check("…its own barrier", H.entities.some((e) => e._valid && e.typeId === "jjk:domain_dome" && e._events.includes("jjk:as_moon")));

// --- Disaster Flames -----------------------------------------------------------------------------------------------
reset("disaster_flames");
const aimedAt = mob("minecraft:zombie", { x: 0, y: 64, z: 10 });
const beside = mob("minecraft:zombie", { x: 3, y: 64, z: 12 });
const far = mob("minecraft:zombie", { x: 0, y: 64, z: 30 });
await use(p, "jjk:disaster_meteor");
await tick(24);
check("Maximum: Meteor lands on the one you aim at (everyone within 6 blocks, burning)",
  aimedAt._dmgLog.length === 1 && beside._dmgLog.length === 1 && far._dmgLog.length === 0 && aimedAt._fire > 0);
check("…and the burning rock is cleaned up", !H.entities.some((e) => e._valid && e.typeId === "jjk:orb"));

reset("disaster_flames");
const cone = mob("minecraft:zombie", { x: 0, y: 64, z: 5 });
const behind = mob("minecraft:zombie", { x: 0, y: 64, z: -5 });
await use(p, "jjk:disaster_stream");
await tick(22);
check("Fire Stream: everyone in the cone burns — not behind you", cone._dmgLog.length >= 2 && cone._fire > 0 && behind._dmgLog.length === 0);

reset("disaster_flames");
const roasted = mob("minecraft:zombie", { x: 4, y: 64, z: 0 });
await use(p, "jjk:iron_mountain");
await tick(41);
check("Coffin of the Iron Mountain: sure-hit damage and burning", roasted._dmgLog.length >= 2 && roasted._fire > 0);
check("…inside a volcano", H.entities.some((e) => e._valid && e.typeId === "jjk:domain_dome" && e._events.includes("jjk:as_volcano")));

// --- Idle Transfiguration ------------------------------------------------------------------------------------------
reset("idle_transfiguration");
const touched = mob("minecraft:zombie", { x: 0, y: 64, z: 3 });
await use(p, "jjk:idle_soul_touch");
check("Soul Touch: damage, nausea and slowness", touched._dmgLog.length === 1 && !!touched.getEffect("nausea") && !!touched.getEffect("slowness"));
T.resetCooldowns(p);
await use(p, "jjk:idle_isomer");
await tick(2);
const isomers = H.entities.filter((e) => e._valid && e.typeId === "jjk:lanky_curse");
check("Polymorphic Soul Isomer: two transfigured humans fight for you",
  isomers.length === 2 && isomers.every((e) => e._props["jjk:owner"] === p.id && e._events.includes("jjk:servant") && e._tags.has("jjk_servant")));
check("…your techniques never hit them", isomers.every((e) => !core.canHit(p, e)));
await tick(20 * 20 + 2);
check("…and they leave after 20 s", isomers.every((e) => !e._valid));

reset("idle_transfiguration");
const soul = mob("minecraft:zombie", { x: 4, y: 64, z: 0 }, 2000);
await use(p, "jjk:self_embodiment");
await tick(170);
const perSecond = last(soul);
check("Self-Embodiment of Perfection: touched every second, slowed and sick", soul._dmgLog.length >= 8 && !!soul.getEffect("nausea"));
await tick(15);
check("…and the final touch when it runs its full course (12 vs 3)", Math.abs(last(soul) / perSecond - 4) < 0.01, JSON.stringify(soul._dmgLog.slice(-2)));
check("…a dome of its own", H.entities.some((e) => e.typeId === "jjk:domain_dome" && e._events.includes("jjk:as_perfection")));

// --- Idle Death Gamble ---------------------------------------------------------------------------------------------
reset("idle_death_gamble");
const real = Math.random;
const lucky = mob("minecraft:zombie", { x: 0, y: 64, z: 5 });
E.setCE(p, 100);
Math.random = () => 0.05;
await use(p, "jjk:gamble_rough");
Math.random = real;
check("Rough Energy: a lucky hit gives 20 CE back", lucky._dmgLog.length === 1 && Math.abs(E.getCE(p) - 105) < 0.01, E.getCE(p));

reset("idle_death_gamble");
const shut = mob("minecraft:zombie", { x: 0, y: 64, z: 6 });
await use(p, "jjk:gamble_shutter");
check("Shutter Doors: damage and slowness", shut._dmgLog.length === 1 && !!shut.getEffect("slowness"));

reset("idle_death_gamble");
const bystander = mob("minecraft:zombie", { x: 3, y: 64, z: 0 });
Math.random = () => 0.9; // the reels miss...
await use(p, "jjk:idle_death_gamble_domain");
await tick(41);
check("Idle Death Gamble: no jackpot yet — the reels spin on", p._msgs.some((m) => m.includes("no luck")) && !G.inJackpot(p) && !!D.domainOf(p));
check("…and it never hurts anyone", bystander._dmgLog.length === 0);
Math.random = () => 0.1; // ...then hit
await tick(40);
Math.random = real;
check("JACKPOT: the domain closes, with no burnout", G.inJackpot(p) && !D.domainOf(p) && D.burnedOut(p) === 0 && p._titles.some((t) => t.includes("JACKPOT")));
E.setCE(p, 0);
await tick(21);
check("…your cursed energy keeps refilling", E.getCE(p) >= Gr.maxCE(p) - 0.01, E.getCE(p));
check("…Regeneration IV", p.getEffect("regeneration")?.amplifier === 3);
const lucky2 = mob("minecraft:zombie", { x: 0, y: 64, z: 3 }, 2000);
C.hurt(p, lucky2, 10);
const jackpotHit = last(lucky2);
await tick(400);
C.hurt(p, lucky2, 10);
check("…+25% damage for 20 s", !G.inJackpot(p) && Math.abs(jackpotHit / last(lucky2) - 1.25) < 0.01, JSON.stringify(lucky2._dmgLog));
check("…and everyone hears about it", H.worldMsgs.some((m) => m.includes("JACKPOT")));

// --- Cursed Spirit Manipulation ------------------------------------------------------------------------------------
reset("cursed_spirit");
p._props["jjk:spirits"] = "";
const prey = mob("jjk:mouth_curse", { x: 0, y: 64, z: 3 }, 20);
C.hurt(p, prey, 100);
await tick(1);
check("exorcising a curse absorbs it", Sp.spiritsOf(p).join() === "jjk:mouth_curse", p._props["jjk:spirits"]);
check("…shown on the bar", E.hudLine(p).includes("CURSES 1"));
const weak = mob("jjk:eye_curse", { x: 0, y: 64, z: 3 }, 180);
weak._hp = 50;
const xp0 = Gr.xpOf(p);
await use(p, "jjk:spirit_absorb");
check("Absorb: a weakened curse is swallowed on the spot (with its XP)", !weak._valid && Sp.spiritsOf(p).includes("jjk:eye_curse") && Gr.xpOf(p) > xp0);
const healthy = mob("jjk:eye_curse", { x: 0, y: 64, z: 3 }, 180);
T.resetCooldowns(p);
const ce0 = E.getCE(p);
await use(p, "jjk:spirit_absorb");
check("…a healthy one can't be (and costs nothing)", healthy._valid && E.getCE(p) === ce0);
healthy._valid = false;
T.resetCooldowns(p);
await use(p, "jjk:spirit_release");
await tick(1);
const released = H.entities.filter((e) => e._valid && e.typeId === "jjk:eye_curse" && e._props["jjk:owner"] === p.id);
check("Release: your strongest curse fights for you", released.length === 1 && released[0]._events.includes("jjk:servant") && Sp.spiritsOf(p).join() === "jjk:mouth_curse");
const xpBefore = Gr.xpOf(p);
released[0].applyDamage(999, { cause: "entityAttack", damagingEntity: p });
await tick(1);
check("…a servant gives no XP when it dies, and isn't absorbed again", Gr.xpOf(p) === xpBefore && Sp.spiritsOf(p).join() === "jjk:mouth_curse");
p._props["jjk:spirits"] = Array(12).fill("jjk:fly_head").join(",");
check("no more than 12 curses", !Sp.absorb(p, "jjk:fly_head") && Sp.spiritsOf(p).length === 12);

reset("cursed_spirit");
p._props["jjk:spirits"] = Array(5).fill("jjk:lanky_curse").join(",");
const blasted = mob("minecraft:zombie", { x: 0, y: 64, z: 10 }, 2000);
await use(p, "jjk:uzumaki");
await tick(18);
check("Maximum: Uzumaki — 10 + 3 per curse, and every curse is used up",
  blasted._dmgLog.length === 1 && Math.abs(last(blasted) - (10 + 3 * 5) * Gr.dmgMult(p)) < 0.01 && Sp.spiritsOf(p).length === 0, JSON.stringify(blasted._dmgLog));
T.resetCooldowns(p);
const ce1 = E.getCE(p);
await use(p, "jjk:uzumaki");
check("…with nothing stored it refuses (and costs nothing)", E.getCE(p) === ce1 && T.cooldownLeft(p, "uzumaki") === 0);

// --- whose side a summoned curse is on ---------------------------------------------------------------------------------
reset("cursed_spirit");
const geto = S.spawnSorcerer(dim, "geto", { x: 0, y: 64, z: 20 });
const victim = mkPlayer("Victim", { x: 0, y: 64, z: 26 });
geto._view = { x: 0, y: 0, z: 1 };
S.runMove(geto, "spirit_release", victim);
await tick(1);
const minion = H.entities.find((e) => e._valid && e._props["jjk:owner"] === geto.id);
check("a villain's curse stays hostile (no servant event)", minion && minion._tags.has("jjk_minion") && !minion._events.includes("jjk:servant"));
check("…spares its master, and he never targets it", !core.canHit(geto, minion) && S.targetOf(geto)?.id !== minion.id);
const gojo = S.spawnSorcerer(dim, "gojo", { x: 5, y: 64, z: 20 });
check("…Jujutsu High and players exorcise it", core.canHit(gojo, minion) && core.canHit(p, minion));
const mine = Sv.spawnServant(p, "jjk:mouth_curse", { x: 1, y: 64, z: 1 });
check("a player's servant curse: villains can hit it, its owner and Jujutsu High can't", core.canHit(geto, mine) && !core.canHit(p, mine) && !core.canHit(gojo, mine));
check("…and Jujutsu High doesn't hunt it", S.targetOf(gojo)?.id !== mine.id);

// --- the Record and the cast know them ---------------------------------------------------------------------------------
for (const t of ["projection", "disaster_flames", "idle_transfiguration", "idle_death_gamble", "cursed_spirit"]) {
  const moves = Object.keys(T.TECHNIQUES[t].moves);
  check(`${t}: four moves, the last a domain or a Maximum at Grade 1`, moves.length === 4 && T.TECHNIQUES[t].moves[moves[3]].grade === 4);
}
for (const [who, tech] of [["geto", "cursed_spirit"], ["mahito", "idle_transfiguration"], ["jogo", "disaster_flames"], ["hakari", "idle_death_gamble"], ["naoya", "projection"]]) {
  check(`${who} fights with ${tech}`, S.CAST[who].tech === tech && S.CAST[who].moves.every(([id]) => T.MOVES[id]?.tech === tech));
}
done();
