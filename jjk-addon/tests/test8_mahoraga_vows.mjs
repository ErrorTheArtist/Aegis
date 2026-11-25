// Mahoraga (the Ten Shadows' ritual, adaptation and the wheel, taming, its attacks) and Binding Vows.
import { H, mkPlayer, spawn, tick, fire, use, melee, check, done, world, answers } from "./harness.mjs";
await import("./main.mjs");
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const C = await import("./combat.mjs");
const S = await import("./sorcerers.mjs");
const core = await import("./core.mjs");
const Mh = await import("./mahoraga.mjs");
const Vw = await import("./vows.mjs");
const dim = world.getDimension("minecraft:overworld");
const last = (e) => e._dmgLog.at(-1)?.amount ?? 0;
const mahoragas = () => H.entities.filter((e) => e._valid && e.typeId === "jjk:mahoraga");

const p = mkPlayer("Megumi");
p._props["jjk:clan"] = "zenin";
await fire("w.playerSpawn", { player: p, initialSpawn: true });
await tick(61);
T.setTechnique(p, "ten_shadows");
Gr.setXp(p, 40000);
p._max = 4000;
p._hp = 4000; // (Mahoraga hits hard: keep the summoner standing through the test)
E.setCE(p, 9999);

// --- the ritual -------------------------------------------------------------------------------------------------------
check("the ritual is the Ten Shadows' Special Grade move", T.MOVES.summon_mahoraga?.tech === "ten_shadows" && T.MOVES.summon_mahoraga.grade === 5);
T.syncItems(p);
check("…and appears in a Special Grade Ten Shadows sorcerer's inventory", p._inv._slots.some((s) => s?.typeId === "jjk:summon_mahoraga"));
const ce0 = E.getCE(p);
await use(p, "jjk:summon_mahoraga");
let m = mahoragas()[0];
check("WITH THIS TREASURE I SUMMON: a wild Mahoraga appears", m && m._props["jjk:summoner"] === p.id && !m._props["jjk:owner"] && p._titles.some((t) => t.includes("SUMMON")));
check("…for its cost", Math.abs(ce0 - E.getCE(p) - T.moveCost(p, T.MOVES.summon_mahoraga)) < 0.01);
T.resetCooldowns(p);
const ce1 = E.getCE(p);
await use(p, "jjk:summon_mahoraga");
check("only one at a time (no cost)", mahoragas().length === 1 && E.getCE(p) === ce1);
check("Jujutsu High keeps out of a ritual", (() => {
  const gojo = S.spawnSorcerer(dim, "gojo", { x: 3, y: 64, z: 8 });
  const t = S.targetOf(gojo);
  gojo._valid = false;
  return t?.id !== m.id;
})());

// --- adaptation -------------------------------------------------------------------------------------------------------
const hit = async (n) => {
  C.hurt(p, m, n);
  await tick(11);
};
await hit(25); // 50 a hit (Special Grade x2)
await hit(25);
check("the wheel turns once one kind of attack has hurt it enough", m._props["P:jjk:turn"] === 1 && Mh.adaptation(m, "ten_shadows") === 1,
  JSON.stringify([m._props["P:jjk:turn"], Mh.stateOf(m).kinds]));
check("…everyone near hears it", p._msgs.some((x) => x.includes("The wheel turns") && x.includes("Ten Shadows")));
let before = m._hp;
await hit(25);
check("…and that kind now does 65%", Math.abs(before - m._hp - 50 * 0.65) < 0.01, before - m._hp);
before = m._hp;
await melee(p, m, 10);
await tick(11);
check("a different kind (melee) still lands in full", m._hp < before && Mh.adaptation(m, "melee") === 0 && Mh.stateOf(m).kinds.melee);
C.hurt(p, m, 5, { sure: true });
await tick(11);
check("domain sure-hits are a kind of their own", !!Mh.stateOf(m).kinds.domain);
for (let i = 0; i < 40 && Mh.adaptation(m, "ten_shadows") < 4; i++) {
  m._hp = 1600;
  await hit(40);
}
before = m._hp;
await hit(25);
check("fully adapted: 5%", Mh.adaptation(m, "ten_shadows") === 4 && Math.abs(before - m._hp - 50 * 0.05) < 0.01, before - m._hp);
check("…the wheel has turned four times for it", m._props["P:jjk:turn"] >= 4);

// --- someone else joins: the ritual is void --------------------------------------------------------------------------------
const q = mkPlayer("Sukuna", { x: 2, y: 64, z: 2 });
C.hurt(q, m, 5);
await tick(1);
check("anyone else's blow makes the ritual void", m._props["jjk:void"] === true && p._msgs.some((x) => x.includes("ritual is void")));
const xp0 = Gr.xpOf(p);
m._hp = 5;
await hit(25);
check("beaten after that: exorcised, not tamed (XP and a Cursed Womb)", !m._valid && !p._props["jjk:mahoraga"] && Gr.xpOf(p) > xp0 && H.drops.includes("jjk:cursed_womb"));

// --- a clean ritual tames it ----------------------------------------------------------------------------------------------------
q._valid = false;
H.players.splice(H.players.indexOf(q), 1);
T.resetCooldowns(p);
E.setCE(p, 9999);
await use(p, "jjk:summon_mahoraga");
m = mahoragas()[0];
m._hp = 5;
const xp1 = Gr.xpOf(p);
await hit(25);
check("beaten alone: MAHORAGA TAMED", !m._valid && p._props["jjk:mahoraga"] === true && p._titles.some((t) => t.includes("TAMED")) && Gr.xpOf(p) >= xp1 + 3000);
T.resetCooldowns(p);
await use(p, "jjk:summon_mahoraga");
const mine = mahoragas()[0];
check("from then on it comes to fight beside you", mine && mine._props["jjk:owner"] === p.id && mine._events.includes("jjk:tamed") && mine.nameTag.includes("Mahoraga"));
check("…your techniques never hit it, and it never hits you", !core.canHit(p, mine) && !core.canHit(mine, p));
const curse = spawn("jjk:eye_curse", { x: mine.location.x, y: 64, z: mine.location.z + 2 });
curse._max = 2000;
curse._hp = 2000;
const stranger = mkPlayer("Stranger", { x: mine.location.x + 1, y: 64, z: mine.location.z + 2 });
await tick(80);
check("…it cuts down curses (twice as hard: positive energy)", curse._dmgLog.some((d) => d.amount === 24), JSON.stringify(curse._dmgLog));
check("…and leaves other players alone", !stranger._dmgLog.some((d) => d.by === mine.id));
await tick(800);
check("…for 40 s", !mine._valid);
curse._valid = false;
stranger._valid = false;
H.players.splice(H.players.indexOf(stranger), 1);

// --- the summoner falls: the ritual ends ----------------------------------------------------------------------------------------
delete p._props["jjk:mahoraga"];
T.resetCooldowns(p);
await use(p, "jjk:summon_mahoraga");
m = mahoragas()[0];
p._hp = 0;
await tick(11);
check("if the summoner dies, Mahoraga sinks back into the shadows", m && !m._valid);
p._hp = 4000;

// --- a wild one: its sword, its leap, its measure ------------------------------------------------------------------------------
await fire("s.scriptEventReceive", { id: "jjk:mahoraga", message: "", sourceEntity: p });
m = mahoragas()[0];
check("jjk:mahoraga: a wild one, with no ritual", m && !m._props["jjk:summoner"] && !m._props["jjk:owner"]);
m.location = { x: 50, y: 64, z: 50 };
m._view = { x: 0, y: 0, z: 1 };
p.location = { x: 0, y: 64, z: 0 };
const zombie = spawn("minecraft:zombie", { x: 50, y: 64, z: 53 });
const fly = spawn("jjk:eye_curse", { x: 51, y: 64, z: 53 });
const lim = mkPlayer("Gojo", { x: 49, y: 64, z: 53 });
await fire("w.playerSpawn", { player: lim, initialSpawn: true });
lim._max = 2000;
lim._hp = 2000;
lim._props["jjk:technique"] = "limitless";
for (const e of [zombie, fly]) {
  e._max = 2000;
  e._hp = 2000;
}
Mh.stateOf(m).kinds.limitless = { level: 4, taken: 0, label: "Limitless" };
Mh.stateOf(m).slash = 0;
await tick(11);
check("Sword of Extermination: a sweep in front of it", last(zombie) === 12, JSON.stringify(zombie._dmgLog));
check("…twice as hard on a curse", last(fly) === 24, JSON.stringify(fly._dmgLog));
check("…and +50% on a sorcerer whose technique it has fully adapted to", lim._dmgLog.some((d) => d.amount === 18), JSON.stringify(lim._dmgLog));
for (const e of [zombie, fly, lim]) e._valid = false;
H.players.splice(H.players.indexOf(lim), 1);
const runner = mkPlayer("Runner", { x: 50, y: 64, z: 62 });
runner._max = 2000;
runner._hp = 2000;
Mh.stateOf(m).leap = 0;
await tick(11);
check("it leaps at whoever keeps their distance", Math.hypot(m.location.x - 50, m.location.z - 62) < 3.5 && runner._dmgLog.length > 0, JSON.stringify(m.location));
runner._valid = false;
H.players.splice(H.players.indexOf(runner), 1);
m._valid = false;

// --- Binding Vows ---------------------------------------------------------------------------------------------------------------
const v = mkPlayer("Vowmaker", { x: 100, y: 64, z: 100 });
await fire("w.playerSpawn", { player: v, initialSpawn: true });
await tick(61);
T.setTechnique(v, "limitless");
Gr.setXp(v, 40000);
v._max = 400;
v._hp = 400;
const dummy = spawn("minecraft:zombie", { x: 100, y: 64, z: 103 });
dummy._max = 100000;
dummy._hp = 100000;
const away = () => { v._props["jjk:vow_at"] = (v._props["jjk:vow_at"] ?? 0) - 600001; }; // (ten minutes pass)
C.hurt(v, dummy, 10);
const plain = last(dummy);
await tick(11);
check("Glass Cannon: made", Vw.setVow(v, "glass") === "ok" && Vw.vowOf(v) === "glass");
C.hurt(v, dummy, 10);
check("…+25% technique damage", Math.abs(last(dummy) / plain - 1.25) < 1e-9, last(dummy) / plain);
const biter = spawn("jjk:mouth_curse", { x: 100, y: 64, z: 98 });
C.hurt(biter, v, 10, { flat: true });
check("…and techniques hit you 20% harder", Math.abs(last(v) - 12) < 1e-9, last(v));
biter._valid = false;
check("a vow can't be changed again for 10 minutes", Vw.setVow(v, "swift") === "wait" && Vw.vowOf(v) === "glass");
away();
check("Swift Hands: made after 10 minutes", Vw.setVow(v, "swift") === "ok");
check("…moves cost 30% more", T.moveCost(v, T.MOVES.red) === Math.round(T.MOVES.red.cost * 1.3));
T.resetCooldowns(v);
E.setCE(v, 9999);
await use(v, "jjk:red");
check("…30% shorter cooldowns", Math.abs(T.cooldownLeft(v, "red") - T.MOVES.red.cd * 0.7) < 0.06, T.cooldownLeft(v, "red"));
away();
Vw.setVow(v, "frugal");
check("Frugal: 30% cheaper", T.moveCost(v, T.MOVES.red) === Math.round(T.MOVES.red.cost * 0.7) && T.moveCost(v, T.MOVES.unlimited_void) === Math.round(Gr.maxCE(v) * 0.7 * 0.7));
away();
Vw.setVow(v, "blood");
T.resetCooldowns(v);
let h0 = v._hp;
await use(v, "jjk:red");
check("Blood Price: every move costs 3 health", Math.abs(h0 - v._hp - 3) < 1e-9 && T.cooldownLeft(v, "red") > 0, h0 - v._hp);
T.resetCooldowns(v);
v._hp = 4;
const ce2 = E.getCE(v);
await use(v, "jjk:red");
check("…and refuses when you haven't the blood", E.getCE(v) === ce2 && v._hp === 4);
v._hp = 400;
away();
Vw.setVow(v, "reveal");
const witness = mkPlayer("Witness", { x: 104, y: 64, z: 100 });
T.resetCooldowns(v);
await use(v, "jjk:red");
check("Revealed Technique: everyone near hears your move explained", witness._msgs.some((x) => x.includes("reveals") && x.includes("Red")));
witness._valid = false;
H.players.splice(H.players.indexOf(witness), 1);
away();
const bf0 = C.bfChance(v);
Vw.setVow(v, "spark");
check("Chase the Spark: double Black Flash chance", Math.abs(C.bfChance(v) / bf0 - 2) < 1e-9);
away();
const real = Math.random;
Math.random = () => 0.99; // (no Black Flash)
const pad = spawn("minecraft:zombie", { x: 96, y: 64, z: 100 }); // (out of the way of the last Red)
pad._max = 100000;
pad._hp = 100000;
Vw.setVow(v, undefined);
await melee(v, pad, 10);
const fist = last(pad);
await tick(11);
away();
Vw.setVow(v, "brawler");
await melee(v, pad, 10);
Math.random = real;
check("Brawler: +30% melee damage", Math.abs(last(pad) / fist - 1.3) < 1e-9, last(pad) / fist);
away();
const regen0 = Gr.regenCE(v);
Vw.setVow(v, "reserves");
check("Deep Reserves: +50% cursed energy regeneration", Math.abs(Gr.regenCE(v) / regen0 - 1.5) < 1e-9);
away();
check("breaking a vow", Vw.setVow(v, undefined) === "ok" && !Vw.vowOf(v));
// through the Record
away();
globalThis.formLog = [];
answers.push({ selection: 3 }, { selection: Object.keys(Vw.VOWS).indexOf("frugal") });
await use(v, "jjk:jujutsu_record");
await tick(2);
check("the Record's Binding Vows page makes one", Vw.vowOf(v) === "frugal" && v._msgs.some((x) => x.includes("Binding Vow") && x.includes("Frugal")),
  JSON.stringify(formLog.map((f) => f.t)));
formLog.length = 0;
answers.push({ canceled: true });
await use(v, "jjk:jujutsu_record");
await tick(2);
check("…and the first page shows it", formLog[0]?.b.includes("Binding Vow: §aFrugal"), formLog[0]?.b);
answers.push({ selection: 3 }, { selection: Object.keys(Vw.VOWS).indexOf("glass") });
await use(v, "jjk:jujutsu_record");
await tick(2);
check("…which also enforces the 10 minutes", Vw.vowOf(v) === "frugal" && v._msgs.at(-1).includes("so soon"), v._msgs.at(-1));
check("NPCs have no vows", Vw.vowMult(S.spawnSorcerer(dim, "gojo", { x: 200, y: 64, z: 200 }), "dmg") === 1);
done();
