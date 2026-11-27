import { H, mkPlayer, spawn, tick, fire, use, inv, check, done, system, world } from "./harness.mjs";
await import("./main.mjs");
world.setDynamicProperty("jjk:auto_daily", false); // (the Daily Blessing would take over the bar — test10 tests it)
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");

// 1. first join: a technique awakens after 3 s, with its starting moves and the Record, locked and kept on death
const p = mkPlayer("Yuji");
await fire("w.playerSpawn", { player: p, initialSpawn: true });
check("no technique before the delay", !p._props["jjk:technique"]);
await tick(61);
const tech = p._props["jjk:technique"];
check("technique awakened", !!T.TECHNIQUES[tech], tech);
const want = T.itemsFor(p);
check("two starting moves (grade 4)", want.length === 2, JSON.stringify(want));
const items = inv(p);
check("moves + record in inventory", want.every((id) => items.includes("jjk:" + id)) && items.includes("jjk:jujutsu_record"), JSON.stringify(items));
check("items locked and kept on death", p._inv._slots.filter(Boolean).every((s) => s.lockMode === "inventory" && s.keepOnDeath));
check("awakening title shown (with the clan)", p._titles.some((t) => /Born into/.test(t)), JSON.stringify(p._titles));

// 2. clans and rarity: overall chances over many births
const Cl = await import("./clans.mjs");
const counts = {};
for (let i = 0; i < 40000; i++) { const t = Cl.rollTechnique(Cl.rollClan()); counts[t] = (counts[t] || 0) + 1; }
const pct = (k) => (counts[k] / 400).toFixed(1);
check("Limitless ~1.5%", Math.abs(counts.limitless / 400 - 1.5) < 0.5, pct("limitless"));
check("Shrine ~2.4%", Math.abs(counts.shrine / 400 - 2.4) < 0.5, pct("shrine"));
check("Boogie Woogie ~17%", Math.abs(counts.boogie / 400 - 16.9) < 1.2, pct("boogie"));
check("Projection Sorcery ~4%", Math.abs(counts.projection / 400 - 4) < 0.7, pct("projection"));
const T0 = await import("./techniques.mjs");
check("all 14 techniques appear", Object.keys(counts).length === 14 && Object.keys(T0.TECHNIQUES).length === 14, JSON.stringify(counts));
check("techChance adds up to 100%", Math.abs(Object.keys(T0.TECHNIQUES).reduce((s, t) => s + Cl.techChance(t), 0) - 100) < 1e-6);
for (const t of Object.keys(T0.TECHNIQUES)) check(`${t}: rolled as often as techChance says`, Math.abs(counts[t] / 400 - Cl.techChance(t)) < 1.3, `${pct(t)} vs ${Cl.techChance(t).toFixed(2)}`);
check("rarity text comes from the tables", T0.TECHNIQUES.limitless.rarity.includes("1.5%") && T0.TECHNIQUES.boogie.rarity.includes("Common"), T0.TECHNIQUES.boogie.rarity);
check("reroll never repeats", [...Array(500)].every(() => Cl.rollTechnique("clanless", "boogie") !== "boogie"));
check("born into a clan", !!Cl.CLANS[p._props["jjk:clan"]], p._props["jjk:clan"]);
check("…and the technique is one their blood allows", Cl.canInherit(p._props["jjk:clan"], p._props["jjk:technique"]));
check("awakening message names the clan and the credits", p._msgs.some((m) => m.includes("Clan:") && m.includes("errorlegend")), p._msgs[0]);
await tick(40);
check("the credits on joining (made by errorlegend, Discord errorlegend_)", p._msgs.some((m) => m.includes("made by §derrorlegend") && m.includes("errorlegend_")), JSON.stringify(p._msgs.slice(-2)));

// 3. sync removes foreign moves and duplicates
T.setTechnique(p, "blood");
p._inv.addItem({ typeId: "jjk:blue", amount: 1 });
p._inv.addItem({ typeId: "jjk:piercing_blood", amount: 1 });
T.syncItems(p);
const after = inv(p);
check("foreign move removed", !after.includes("jjk:blue"), JSON.stringify(after));
check("no duplicate moves", after.filter((x) => x === "jjk:piercing_blood").length === 1, JSON.stringify(after));

// 4. HUD + regeneration + focusing
E.setCE(p, 10);
p._bars.length = 0;
await tick(40);
check("HUD on the action bar", p._bars.some((b) => b.includes("CE") && b.includes("Grade 4")), p._bars.at(-1));
const c0 = E.getCE(p);
await tick(20);
const regen = E.getCE(p) - c0;
check("regenerates 2 CE/s at Grade 4 (x1.2 for the Kamo)", Math.abs(regen - Gr.regenCE(p)) < 0.01 && Math.abs(Gr.regenCE(p) - 2 * (p._props["jjk:clan"] === "kamo" ? 1.2 : 1)) < 1e-9, regen);
p.isSneaking = true;
await tick(20);
const c1 = E.getCE(p);
await tick(20);
check("focusing (sneak + still) doubles regen", Math.abs(E.getCE(p) - c1 - 2 * Gr.regenCE(p)) < 0.01, E.getCE(p) - c1);
p.isSneaking = false;
check("CE saved to a property", typeof p._props["jjk:ce"] === "number");

// 5. heavenly: no CE on the bar, no universal moves, body buffs
T.setTechnique(p, "heavenly");
Gr.setXp(p, 40000);
T.syncItems(p);
await tick(40);
check("heavenly bar", p._bars.at(-1)?.includes("Heavenly Restriction"), p._bars.at(-1));
check("heavenly: tools only, no universal moves", !inv(p).includes("jjk:simple_domain") && inv(p).includes("jjk:split_soul_katana"), JSON.stringify(inv(p)));
check("heavenly body: strength II at Grade 1+", p.getEffect("strength")?.amplifier === 1 && !!p.getEffect("regeneration"));
check("health boost at Special Grade (+20)", p.getComponent("minecraft:health").effectiveMax === 40, p.getComponent("minecraft:health").effectiveMax);

// 6. a second player joining while the first is online
const q = mkPlayer("Megumi", { x: 5, y: 64, z: 0 });
await fire("w.playerSpawn", { player: q, initialSpawn: true });
await tick(61);
check("second player awakened", !!q._props["jjk:technique"]);
// respawn restores health to the boosted max
Gr.setXp(q, 2000);
q._hp = 0;
await fire("w.playerSpawn", { player: q, initialSpawn: false });
await tick(6);
check("respawn: full boosted health", q._hp === q.getComponent("minecraft:health").effectiveMax && q._hp === 28, q._hp);
done();
