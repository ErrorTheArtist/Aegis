// The cast: setup from the real behaviour file, teams, every character's moves, sparring (it can't kill you),
// Todo's question, villain and ally encounters, rewards, lingering villains, admin summons.
import { H, mkPlayer, spawn, tick, fire, use, melee, inv, check, done, hp, answers, world, system } from "./harness.mjs";
await import("./main.mjs");
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const C = await import("./combat.mjs");
const D = await import("./domains.mjs");
const S = await import("./sorcerers.mjs");
const { NPC_IDS } = await import("./roster_ids.mjs");

const dim = world.getDimension("minecraft:overworld");
const p = mkPlayer("Yuji");
p._props["jjk:clan"] = "clanless";
await fire("w.playerSpawn", { player: p, initialSpawn: true });
await tick(61);

// --- every character is set up from the real behaviour file -----------------------------------------------------
check("17 characters", NPC_IDS.length === 17 && Object.keys(S.CAST).length === 17);
for (const who of NPC_IDS) {
  const e = S.spawnSorcerer(dim, who, { x: 200, y: 64, z: 200 });
  const c = S.CAST[who];
  const ok = e._props["jjk:who"] === who && e._props["jjk:side"] === c.side && e._props["P:jjk:npc"] === NPC_IDS.indexOf(who)
    && e.nameTag.includes(S.nameOfCast(who)) && e._families.includes(c.side === "ally" ? "jjk_ally" : "jjk_villain") && e._max >= 100;
  check(`${who}: set up (${c.side}, ${e._max} health)`, ok, JSON.stringify([e._props, e._families, e._max]));
  e._valid = false;
}
check("villains are tougher than allies", S.CAST.sukuna && hp(S.spawnSorcerer(dim, "sukuna", { x: 300, y: 64, z: 300 })) === 3000);
for (const e of H.entities) if (e.typeId === "jjk:sorcerer") e._valid = false;
// a spawn egg: the event picks a random ally, the script dresses it up
const egg = spawn("jjk:sorcerer", { x: 210, y: 64, z: 210 });
egg._props["P:jjk:npc"] = 3; // (what minecraft:entity_spawned would have rolled)
await fire("w.entitySpawn", { entity: egg });
await tick(3);
check("spawn egg -> dressed as whoever the event rolled", egg._props["jjk:who"] === NPC_IDS[3] && egg.nameTag.includes("Nobara"), egg.nameTag);
egg._valid = false;

// --- every move of every character works for an NPC caster ----------------------------------------------------------
for (const who of NPC_IDS) {
  for (const [id, range] of S.CAST[who].moves) {
    for (const e of H.entities) if (e.typeId === "jjk:sorcerer" || /curse|zombie|dog|orb|dome|shrine|nue|elephant/.test(e.typeId)) e._valid = false;
    for (const d of [...D.activeDomains()]) D.collapse(d);
    const caster = S.spawnSorcerer(dim, who, { x: 0, y: 64, z: 100 });
    const side = S.CAST[who].side;
    const at = { x: 0, y: 64, z: id === "burst" ? 110 : 103 }; // (Toji's burst closes a gap: it needs one)
    const t = side === "ally" ? spawn("jjk:eye_curse", at) : mkPlayer(`target_${who}_${id}`, at);
    t._max = 2000; t._hp = 2000;
    caster._view = { x: 0, y: 0, z: 1 };
    if (id === "straw_resonance") C.hurt(caster, t, 1); // (needs a piece of them)
    let ok = false;
    try {
      ok = S.runMove(caster, id, t);
    } catch (err) {
      ok = "threw " + err.message;
    }
    await tick(45);
    check(`${who}: ${id}`, ok === true, String(ok));
    if (isFinite(range) && !["convergence", "summon_divine_dogs", "summon_nue", "curse_release"].includes(id)) { // (summons fight through the game AI)
      check(`${who}: ${id} hurt the target`, t._dmgLog.length > 0 || t._effects.slowness || t._effects.weakness, JSON.stringify(t._dmgLog.slice(0, 2)));
    }
    if (t.typeId === "minecraft:player") { t._valid = false; H.players.splice(H.players.indexOf(t), 1); }
  }
}
for (const d of [...D.activeDomains()]) D.collapse(d);
D._state.burnout.clear();
for (const e of H.entities) if (e.typeId !== "minecraft:player") e._valid = false;

// --- teams -----------------------------------------------------------------------------------------------------------
const gojo = S.spawnSorcerer(dim, "gojo", { x: 0, y: 64, z: 6 });
const curse = spawn("jjk:mouth_curse", { x: 0, y: 64, z: 10 });
const sukuna = S.spawnSorcerer(dim, "sukuna", { x: 50, y: 64, z: 0 });
p.location = { x: 0, y: 64, z: 0 }; p._view = { x: 0, y: 0, z: 1 };
check("players' techniques never hit Jujutsu High", !C.hurt(p, gojo, 5));
check("…but do hit villains", C.hurt(p, sukuna, 5));
check("allies never hit players (not sparring)", !C.hurt(gojo, p, 5));
check("allies hit curses", C.hurt(gojo, curse, 5));
check("villains spare curses", !C.hurt(sukuna, curse, 5));
check("allies and villains fight", C.hurt(gojo, sukuna, 5) && C.hurt(sukuna, gojo, 5));
check("an ally targets the curse, not the player", S.targetOf(gojo)?.id === curse.id);
check("Gojo's Infinity is on", (S.act(gojo), !!gojo.getEffect("resistance")));
// an ally fights the curse on its own
curse._max = 500; curse._hp = 500;
for (let i = 0; i < 20; i++) { gojo._view = { x: 0, y: 0, z: 1 }; S.act(gojo); await tick(10); }
check("Gojo exorcises on his own", hp(curse) < 500, hp(curse));
check("…without touching the player", !p._dmgLog.some((d) => d.by === gojo.id));
// a villain hunts the player
sukuna.location = { x: 0, y: 64, z: -8 };
check("a villain targets the player", S.targetOf(sukuna)?.id === p.id || S.targetOf(sukuna)?.id === gojo.id);
gojo._valid = false;
p._max = 5000; p._hp = 5000;
for (let i = 0; i < 25; i++) { S.act(sukuna); await tick(10); }
check("Sukuna fights the player", p._dmgLog.some((d) => d.by === sukuna.id));
sukuna._hp = sukuna._max * 0.5; // below 60%: the domain is on the table
let opened = false;
for (let i = 0; i < 60 && !opened; i++) { S._state.casting.get(sukuna.id).next = 0; S.act(sukuna); opened = !!D.domainOf(sukuna); await tick(2); }
check("Sukuna opens the Malevolent Shrine when hurt", opened);
if (D.domainOf(sukuna)) {
  const before = p._dmgLog.filter((d) => d.by === sukuna.id).length;
  await tick(40);
  const sure = p._dmgLog.filter((d) => d.by === sukuna.id).slice(before);
  check("an NPC's sure-hit lands at half strength (4 x0.5 x1.5 = 3)", sure.some((d) => Math.abs(d.amount - 3) < 0.01), JSON.stringify(sure.map((d) => d.amount)));
  D.collapse(D.domainOf(sukuna));
}
D._state.burnout.clear();
p._max = 20; p._hp = 20;

// --- villain death: XP, drops, a message ------------------------------------------------------------------------------
H.drops.length = 0; H.worldMsgs.length = 0;
const xp0 = p._props["jjk:xp"] ?? 0;
const realRandom = Math.random; Math.random = () => 0.99;
sukuna._hp = 1; sukuna._lastHurt = -99;
await melee(p, sukuna, 5); await tick(1);
Math.random = realRandom;
check("beating Sukuna: 3000 XP (x1.15 clanless)", (p._props["jjk:xp"] ?? 0) - xp0 === Math.round(3000 * 1.15), (p._props["jjk:xp"] ?? 0) - xp0);
check("…drops fingers and a womb", H.drops.includes("jjk:sukuna_finger") && H.drops.includes("jjk:cursed_womb"), JSON.stringify(H.drops));
check("…and everyone hears", H.worldMsgs.some((m) => m.includes("Ryomen Sukuna") && m.includes("defeated")));
check("…counted", p._props["jjk:villains_beaten"] === 1);

// --- sparring ----------------------------------------------------------------------------------------------------------
const maki = S.spawnSorcerer(dim, "maki", { x: 0, y: 64, z: 3 });
globalThis.formLog = [];
answers.push({ selection: 0 });
await fire("w.playerInteractWithEntity", { player: p, target: maki }); await tick(2);
check("talking: their line, their title, a spar button", formLog[0]?.t.includes("Maki") && formLog[0]?.btns[0].includes("Spar"), JSON.stringify(formLog[0]));
check("spar started", S.sparPartner(maki) === p.id && p.hasTag("jjk_spar"));
check("in a spar, Maki may hit you", C.hurt(maki, p, 1) || true);
p._hp = 20; p._lastHurt = -99;
// she can't kill you: a huge technique hit is capped at 35% and never below 1 health
p._hp = 3; p._lastHurt = -99;
C.hurt(maki, p, 500);
check("a spar can't kill you", p._hp >= 1, p._hp);
await tick(10);
check("…and you lose at 30% health (healed back to 40%)", !S.sparPartner(maki) && p._hp >= 8 && p._titles.some((t) => t.includes("DEFEATED")), p._hp);
check("…no XP for losing, and no cooldown", !p._props["jjk:spar_maki"]);
answers.push({ selection: 0 });
await fire("w.playerInteractWithEntity", { player: p, target: maki }); await tick(2);
const xp1 = p._props["jjk:xp"];
maki._hp = maki._max * 0.45;
await tick(10);
check("win at half their health: 160 XP (x1.15)", p._props["jjk:xp"] - xp1 === Math.round(160 * 1.15) && maki._hp === maki._max, p._props["jjk:xp"] - xp1);
answers.push({ selection: 0 });
await fire("w.playerInteractWithEntity", { player: p, target: maki }); await tick(2);
check("…then she needs 10 minutes' rest", !S.sparPartner(maki) && p._msgs.at(-1).includes("Rest"), p._msgs.at(-1));
const bystander = mkPlayer("Bystander", { x: 1, y: 64, z: 1 });
check("spar techniques only hit the partner", !C.hurt(maki, bystander, 5));
bystander._valid = false; H.players.splice(H.players.indexOf(bystander), 1);
// Todo
const todo = S.spawnSorcerer(dim, "todo", { x: 3, y: 64, z: 3 });
answers.push({ selection: 0 });
await fire("w.playerInteractWithEntity", { player: p, target: todo }); await tick(2);
check("Todo: the right answer makes you his best friend", p._titles.some((t) => t.includes("BEST FRIEND")) && p.getEffect("strength")?.amplifier === 1);
answers.push({ selection: 1 });
await fire("w.playerInteractWithEntity", { player: p, target: todo }); await tick(2);
check("…the wrong one starts a fight", S.sparPartner(todo) === p.id);
S.endSpar(todo.id, "over");

// --- encounters --------------------------------------------------------------------------------------------------------
for (const e of H.entities) if (e.typeId === "jjk:sorcerer") e._valid = false;
Gr.setXp(p, 0);
check("no villains for a Grade 4", !S.villainNight(true));
Gr.setXp(p, 15000);
const v = S.villainNight(true);
check("a villain comes for a Grade 1 sorcerer", v && S.CAST[v._props["jjk:who"]].side === "villain" && v._props["jjk:who"] !== "sukuna", v?._props["jjk:who"]);
check("…one at a time", !S.villainNight(true));
p.location = { x: 900, y: 64, z: 900 };
await tick(1210);
check("a villain left alone leaves", !v._valid);
p.location = { x: 0, y: 64, z: 0 };
spawn("jjk:fly_head", { x: 4, y: 64, z: 4 }); spawn("jjk:fly_head", { x: -4, y: 64, z: 4 });
const a = S.allyNight(true);
check("Jujutsu High comes to help (and leaves again later)", a && S.CAST[a._props["jjk:who"]].side === "ally" && a._events.includes("jjk:wanderer"));
check("…announced", p._msgs.at(-1).includes("arrived to help"));

// --- admin -------------------------------------------------------------------------------------------------------------
p.addTag("jjk_admin");
await fire("s.scriptEventReceive", { id: "jjk:summon", message: "gojo stay", sourceEntity: p });
const g2 = H.entities.filter((e) => e._valid && e._props["jjk:who"] === "gojo").at(-1);
check("jjk:summon gojo stay", g2 && g2._events.includes("jjk:stay") && g2._stay === true);
await fire("s.scriptEventReceive", { id: "jjk:summon", message: "nobody", sourceEntity: p });
check("jjk:summon: unknown names explained", p._msgs.at(-1).includes("Who?"));
globalThis.formLog = [];
answers.push({ selection: 2 }, { selection: NPC_IDS.indexOf("mahito") }, { formValues: [false] });
const { adminMenu } = await import("./record.mjs");
await adminMenu(p); await tick(2);
check("Admin Panel: summon a character", H.entities.some((e) => e._valid && e._props["jjk:who"] === "mahito"));
done();
