import { H, mkPlayer, spawn, tick, fire, use, melee, check, done, hp } from "./harness.mjs";
await import("./main.mjs");
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const D = await import("./domains.mjs");
const C = await import("./combat.mjs");
const realRandom = Math.random;

const a = mkPlayer("Yuji", { x: 0, y: 64, z: 0 });
const b = mkPlayer("Todo", { x: 0, y: 64, z: 3 });
for (const p of [a, b]) { p._props["jjk:technique"] = "boogie"; }
await tick(2);

// --- Black Flash ----------------------------------------------------------------------------------
const z = spawn("minecraft:zombie", { x: 0, y: 64, z: 2 }); z._max = 500; z._hp = 500;
Math.random = () => 0.99; // never
await melee(a, z, 5);
check("plain melee: grade 4 adds nothing", z._dmgLog.length === 1 && hp(z) === 495, JSON.stringify(z._dmgLog));
await tick(12);
Math.random = () => 0.0; // always
E.setCE(a, 10);
await melee(a, z, 5);
await tick(1);
const bf = z._dmgLog.at(-1);
check("Black Flash: one bigger hit (x2.5 total)", Math.abs(500 - 5 - 12.5 - hp(z)) < 0.01, JSON.stringify(z._dmgLog.slice(-2)) + " hp " + hp(z));
check("Black Flash refills 30% CE", Math.abs(E.getCE(a) - (10 + 30)) < 0.01, E.getCE(a));
check("…and puts you in the zone", C.inZone(a) && Math.abs(C.bfChance(a) - 0.14) < 1e-9, C.bfChance(a));
check("…counted", a._props["jjk:black_flashes"] === 1);
check("…titled", a._titles.some((t) => t.includes("BLACK FLASH")));
check("the boosted hit's echo doesn't roll again", (a._props["jjk:black_flashes"] ?? 0) === 1);
// technique hits never roll a Black Flash
await tick(12);
const bfs = a._props["jjk:black_flashes"];
C.hurt(a, z, 5);
await tick(1);
check("technique hits don't Black Flash", a._props["jjk:black_flashes"] === bfs);
// Heavenly Restriction never Black Flashes
a._props["jjk:technique"] = "heavenly";
await tick(12);
await melee(a, z, 5);
check("no Black Flash without cursed energy", a._props["jjk:black_flashes"] === bfs);
a._props["jjk:technique"] = "boogie";
Math.random = realRandom;

// --- PvP scaling + grade multiplier -----------------------------------------------------------------
Gr.setXp(a, 40000);
b._hp = 20; b._lastHurt = -99;
C.hurt(a, b, 10);
check("technique vs player: x2.0 grade x0.6 PvP = 12", Math.abs(b._dmgLog.at(-1).amount - 12) < 0.01, JSON.stringify(b._dmgLog.at(-1)));
// creative players and own shikigami can't be hit
b._mode = "creative";
check("creative players are never targets", !C.hurt(a, b, 10));
b._mode = "survival";

// --- Infinity ---------------------------------------------------------------------------------------
b._props["jjk:technique"] = "limitless";
E.setCE(b, 100);
await tick(10);
check("Infinity: Resistance II while CE >= 10", b.getEffect("resistance")?.amplifier === 1);
await tick(12);
b._lastHurt = -99; const ce0 = E.getCE(b);
b.applyDamage(10, { cause: "entityAttack", damagingEntity: z });
await tick(1);
check("Infinity takes 40% off", Math.abs(b._dmgLog.at(-1).applied - 6) < 0.01, JSON.stringify(b._dmgLog.at(-1)));
check("…and costs 2 CE a hit", E.getCE(b) < ce0 - 1.9 && E.getCE(b) > ce0 - 2.1, ce0 - E.getCE(b));
E.setCE(b, 5);
await tick(10);
check("Infinity drops below 10 CE", !b.getEffect("resistance"));
E.setCE(b, 100);
await tick(10);
b._props["jjk:infinity_off"] = true;
await tick(10);
check("Infinity can be switched off in Settings", !b.getEffect("resistance"));
delete b._props["jjk:infinity_off"];

// --- Domains -----------------------------------------------------------------------------------------
for (const p of [a, b]) { Gr.setXp(p, 40000); E.setCE(p, 999); T.resetCooldowns(p); }
a._props["jjk:technique"] = "shrine";
b._props["jjk:technique"] = "limitless";
b.location = { x: 0, y: 64, z: 30 };
const victim = spawn("minecraft:zombie", { x: 4, y: 64, z: 2 }); victim._max = 999; victim._hp = 999;
await use(a, "jjk:malevolent_shrine");
await tick(1);
const d = D.domainOf(a);
check("Malevolent Shrine opens (no barrier: a shrine model)", !!d && H.entities.some((e) => e.typeId === "jjk:shrine" && e._valid));
check("domain costs 70% of max CE", Math.abs(E.getCE(a) - (Gr.maxCE(a) * 0.3)) < 2, E.getCE(a));
await tick(40);
check("sure-hit slashes the victim", hp(victim) < 999, hp(victim));
// Simple Domain protects; Heavenly is immune
const sd = mkPlayer("Miwa", { x: 3, y: 64, z: 0 }); sd._props["jjk:technique"] = "blood"; Gr.setXp(sd, 2000); E.setCE(sd, 999);
await use(sd, "jjk:simple_domain");
const sdHp = hp(sd);
await tick(30);
check("Simple Domain: no sure-hit damage", hp(sd) === sdHp, hp(sd));
const hr = mkPlayer("Maki", { x: -3, y: 64, z: 0 }); hr._props["jjk:technique"] = "heavenly";
const hrHp = hp(hr);
await tick(30);
check("Heavenly Restriction: immune to sure-hit", hp(hr) === hrHp, hp(hr));
// a clash: Unlimited Void cast 8 blocks away overlaps the Shrine
b.location = { x: 0, y: 64, z: 8 };
const rnd = Math.random; Math.random = () => 0.5;
E.setCE(b, Gr.maxCE(b)); E.setCE(a, 0); // equal grades; a is drained -> b wins
await use(b, "jjk:unlimited_void");
Math.random = rnd;
await tick(1);
check("clash: the stronger domain survives", !!D.domainOf(b) && !D.domainOf(a));
check("clash loser burns out", D.burnedOut(a) > 0);
check("clash announced", a._titles.some((t) => t.includes("DOMAIN CLASH")) && b._titles.some((t) => t.includes("DOMAIN CLASH")));
check("shrine model removed", !H.entities.some((e) => e.typeId === "jjk:shrine" && e._valid));
// the void freezes and boosts damage
await tick(11);
check("Unlimited Void stuns the people inside", C.stunned(a), D.domainOf(b)?.center);
const before = a._dmgLog.length;
a._lastHurt = -99;
C.hurt(b, a, 10);
check("+50% to the frozen (10 x2.0 x1.5 x0.6 = 18)", Math.abs(a._dmgLog.at(-1).amount - 18) < 0.01, JSON.stringify(a._dmgLog.at(-1)));
// the domain ends on time and burns its caster out
await tick(200);
check("Unlimited Void closes after 8 s", !D.domainOf(b));
check("…its dome is removed", !H.entities.some((e) => e.typeId === "jjk:domain_dome" && e._valid));
check("…and its caster burns out", D.burnedOut(b) > 0);
check("burnout switches Infinity off", !b.getEffect("resistance") || b.getEffect("resistance").duration <= 0);
// burnout blocks technique moves but not RCT / simple domain
T.resetCooldowns(a); E.setCE(a, 999); a._hp = 10;
await tick(20);
check("no longer frozen", !C.stunned(a));
check("still burnt out from the clash", D.burnedOut(a) > 0, D.burnedOut(a));
await use(a, "jjk:dismantle");
check("burnt out: no technique", a._bars.at(-1)?.includes("Burnout"), a._bars.at(-1));
await tick(10);
await use(a, "jjk:reverse_cursed_technique");
check("burnt out: RCT still works", a._hp > 10, a._hp);
// leaving your domain collapses it
T.resetCooldowns(a); D._state.burnout.clear(); E.setCE(a, 999); a._props["jjk:technique"] = "ten_shadows";
await use(a, "jjk:chimera_shadow_garden"); await tick(1);
check("Chimera Shadow Garden calls two extra dogs", H.entities.filter((e) => /divine_dog/.test(e.typeId) && e._valid).length >= 2);
a.location = { x: 40, y: 64, z: 0 };
await tick(2);
check("leaving your domain collapses it", !D.domainOf(a));
done();
