import { H, mkPlayer, spawn, tick, fire, use, inv, check, done, system, hp } from "./harness.mjs";
await import("./main.mjs");
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const D = await import("./domains.mjs");
const C = await import("./combat.mjs");

const p = mkPlayer("Gojo");
await fire("w.playerSpawn", { player: p, initialSpawn: true });
await tick(61);
let foes = [];
function fresh() {
  for (const f of foes) f._valid = false;
  foes = [spawn("minecraft:zombie", { x: 0, y: 64, z: 5 }), spawn("minecraft:zombie", { x: 2, y: 64, z: 3 }), spawn("minecraft:zombie", { x: 0, y: 64, z: -4 })];
  for (const f of foes) { f._max = 400; f._hp = 400; }
}
const DAMAGING = new Set(["blue", "red", "hollow_purple", "unlimited_void", "dismantle", "cleave", "fuga", "malevolent_shrine", "summon_nue",
  "summon_max_elephant", "chimera_shadow_garden", "speech_blast_away", "speech_crush", "speech_twist", "piercing_blood", "supernova", "clap_barrage",
  "black_flash_swap", "playful_cloud", "dragon_bone", "straw_hairpin", "straw_nail_barrage", "ratio_seven_three", "ratio_flurry", "ratio_collapse", "inverted_spear_of_heaven", "split_soul_katana"]);
const WAIT = { straw_hairpin: 30, ratio_flurry: 40, hollow_purple: 70, fuga: 60, unlimited_void: 60, malevolent_shrine: 60, chimera_shadow_garden: 60, summon_nue: 60, summon_max_elephant: 40, clap_barrage: 50, playful_cloud: 40 };
for (const [techId, t] of Object.entries(T.TECHNIQUES)) {
  T.setTechnique(p, techId);
  Gr.setXp(p, 40000);
  for (const id of Object.keys(t.moves)) {
    fresh();
    p.location = { x: 0, y: 64, z: 0 }; p._view = { x: 0, y: 0, z: 1 }; p._hp = p.getComponent("minecraft:health").effectiveMax;
    T.resetCooldowns(p);
    E.setCE(p, Gr.maxCE(p));
    for (const d of [...D.activeDomains()]) D.collapse(d);
    D._state.burnout.clear();
    if (id === "straw_resonance" || id === "straw_cursed_doll") C.hurt(p, foes[0], 1); // they need a piece of someone
    const ce0 = E.getCE(p);
    const before = foes.map(hp);
    await use(p, "jjk:" + id);
    const spent = ce0 - E.getCE(p);
    const cost = T.moveCost(p, T.MOVES[id]);
    check(`${techId}/${id}: costs ${cost} CE`, Math.abs(spent - cost) < 0.01, `spent ${spent}`);
    check(`${techId}/${id}: on cooldown`, T.cooldownLeft(p, id) > 0 && p._cds["jjk_" + id] > 0);
    await tick(WAIT[id] ?? 30);
    const dmg = foes.map((f, i) => before[i] - hp(f));
    if (DAMAGING.has(id)) check(`${techId}/${id}: hurt someone`, dmg.some((x) => x > 0), JSON.stringify(dmg));
    // a second use straight away is refused
    const ce1 = E.getCE(p);
    await use(p, "jjk:" + id);
    check(`${techId}/${id}: refused while recharging`, E.getCE(p) >= ce1 - 0.01);
  }
}
// specific behaviours -----------------------------------------------------------------------------
// Blue pulls; Red knocks back
const home = () => { p.location = { x: 0, y: 64, z: 0 }; p._view = { x: 0, y: 0, z: 1 }; };
T.setTechnique(p, "limitless"); home(); fresh(); T.resetCooldowns(p); E.setCE(p, 999);
await use(p, "jjk:blue"); await tick(4);
check("Blue forms on the target and pulls the others in", foes[1]._kb.length > 0, JSON.stringify(foes[0]._kb.slice(0, 1)));
await tick(30);
fresh(); T.resetCooldowns(p); await use(p, "jjk:red"); await tick(10);
check("Red blasts them away", foes[0]._kb.some((k) => k[2] >= 2), JSON.stringify(foes[0]._kb));
// sneaking Blue dashes you instead
fresh(); T.resetCooldowns(p); p.isSneaking = true; p._kb.length = 0; const hp0 = hp(foes[0]);
await use(p, "jjk:blue"); await tick(30); p.isSneaking = false;
check("sneak + Blue dashes you", p._kb.length === 1 && hp(foes[0]) === hp0, JSON.stringify(p._kb));
// Hollow Purple: orbs spawned and removed; damage once per target
fresh(); T.resetCooldowns(p); E.setCE(p, 999);
await use(p, "jjk:hollow_purple"); await tick(70);
const orbs = H.entities.filter((e) => e.typeId === "jjk:orb");
check("Purple: all orbs cleaned up", orbs.every((o) => !o._valid), orbs.filter((o) => o._valid).length);
check("Purple: one hit per target", foes[0]._dmgLog.length === 1, JSON.stringify(foes[0]._dmgLog));
(await import("./tech_ratio.mjs"))._state.overtime.clear(); // (the Ratio loop left Overtime running)
// grade multiplier: Special Grade (x2.0) Dismantle = 20 on a mob
T.setTechnique(p, "shrine"); fresh(); T.resetCooldowns(p);
await use(p, "jjk:dismantle"); await tick(2);
check("Dismantle x2 at Special Grade", Math.abs(foes[0]._dmgLog[0]?.amount - 20) < 0.01, JSON.stringify(foes[0]._dmgLog));
// grade gates
Gr.setXp(p, 0); T.resetCooldowns(p); E.setCE(p, 999);
const ce2 = E.getCE(p);
await use(p, "jjk:fuga");
check("Fuga locked below Grade 2", E.getCE(p) === ce2 && p._bars.at(-1)?.includes("Grade 2"), p._bars.at(-1));
// not your technique
await tick(10); await use(p, "jjk:blue");
check("someone else's move refused: it's bound to its innate", p._bars.at(-1)?.includes("Only a sorcerer born with Limitless"), p._bars.at(-1));
// not enough CE
Gr.setXp(p, 40000); E.setCE(p, 5); T.resetCooldowns(p);
await tick(10); E.setCE(p, 5); await use(p, "jjk:cleave");
check("not enough CE", p._bars.at(-1)?.includes("Not enough cursed energy"), p._bars.at(-1));
// cursed speech costs health, never kills
T.setTechnique(p, "cursed_speech"); fresh(); T.resetCooldowns(p); E.setCE(p, 999);
p._hp = 20; await use(p, "jjk:speech_crush"); await tick(2);
check("Crush costs 3 HP", p._hp === 17, p._hp);
p._hp = 4; T.resetCooldowns(p); await use(p, "jjk:speech_crush"); await tick(2);
check("speech refused when it would nearly kill", p._hp === 4, p._hp);
// Don't Move stuns; a stunned player can't use moves
fresh(); T.resetCooldowns(p); p._hp = 20;
await use(p, "jjk:speech_dont_move"); await tick(1);
check("Don't Move stuns the zombie in front", C.stunned(foes[0]) && foes[0].getEffect("slowness")?.amplifier === 255);
check("…but not the one behind", !C.stunned(foes[2]));
// boogie woogie swaps positions
T.setTechnique(p, "boogie"); fresh(); T.resetCooldowns(p); p.location = { x: 0, y: 64, z: 0 };
await use(p, "jjk:boogie_swap"); await tick(1);
check("Boogie Woogie swaps places", p.location.z === 5 && foes[0].location.z === 0, JSON.stringify([p.location, foes[0].location]));
// nothing to swap with: refunded, no cooldown
foes[0].location = { x: 0, y: 64, z: 9 }; p.location = { x: 0, y: 64, z: 0 }; p._view = { x: 1, y: 0, z: 0 }; T.resetCooldowns(p); E.setCE(p, 50);
await use(p, "jjk:boogie_swap");
check("no target: no cost, no cooldown", E.getCE(p) === 50 && T.cooldownLeft(p, "boogie_swap") === 0);
p._view = { x: 0, y: 0, z: 1 };
// Ten Shadows: dogs are owned and tamed, never hurt their owner
T.setTechnique(p, "ten_shadows"); T.resetCooldowns(p); E.setCE(p, 999);
await use(p, "jjk:summon_divine_dogs"); await tick(1);
const dogs = H.entities.filter((e) => /divine_dog/.test(e.typeId) && e._valid);
check("two dogs, owned and tamed", dogs.length >= 2 && dogs.every((d) => d._props["jjk:owner"] === p.id && d._owner === p.id), dogs.length);
// re-summoning replaces them
T.resetCooldowns(p); await use(p, "jjk:summon_divine_dogs"); await tick(1);
check("re-summon replaces the old pair", H.entities.filter((e) => /divine_dog/.test(e.typeId) && e._valid).length === 2);
// a technique can't hit your own dogs
const own = H.entities.find((e) => /divine_dog/.test(e.typeId) && e._valid);
check("own shikigami are not targets", !C.hurt(p, own, 10));
// Heavenly: Inverted Spear breaks a domain and pierces Infinity
for (const f of foes) f._valid = false; home();
const g = mkPlayer("Gojo2", { x: 0, y: 64, z: 4 });
g._props["jjk:technique"] = "limitless"; Gr.setXp(g, 40000); E.setCE(g, 999);
g._view = { x: 0, y: 0, z: -1 };
await use(g, "jjk:unlimited_void"); await tick(1);
check("enemy domain open", !!D.domainOf(g));
T.setTechnique(p, "heavenly"); T.resetCooldowns(p);
await tick(12); // Infinity on
check("Infinity active on Gojo2", !!g.getEffect("resistance"));
await use(p, "jjk:inverted_spear_of_heaven"); await tick(2);
check("Inverted Spear breaks the domain", !D.domainOf(g));
check("…and switches Infinity off", !g.getEffect("resistance"));
check("Heavenly is never stunned by the Void", !C.stunned(p));
g._valid = false; H.players.splice(H.players.indexOf(g), 1);
// Dragon-Bone gives back half of what you took in the last 10 s (up to +20)
fresh(); home(); foes[0].location = { x: 0, y: 64, z: 2.5 }; T.resetCooldowns(p); p._max = 200; p._hp = 200; p._lastHurt = -99;
p.applyDamage(30, { cause: "entityAttack", damagingEntity: foes[0] }); await tick(1);
p._lastHurt = -99; p.applyDamage(30, { cause: "entityAttack", damagingEntity: foes[0] }); await tick(12);
foes[0]._lastHurt = -99; foes[0]._dmgLog.length = 0;
await use(p, "jjk:dragon_bone"); await tick(6);
const dmgDone = foes[0]._dmgLog.at(-1)?.amount;
// (8 + min(20, 60 * 0.5)) x2.0 at Special Grade = 56
check("Dragon-Bone releases stored impact", Math.abs(dmgDone - 56) < 0.01, dmgDone);
T.resetCooldowns(p); await tick(1); foes[0]._lastHurt = -99;
await use(p, "jjk:dragon_bone"); await tick(6);
check("…and the store empties once released", Math.abs(foes[0]._dmgLog.at(-1)?.amount - 16) < 0.01, foes[0]._dmgLog.at(-1)?.amount);
done();
