// Clans and clan-bound techniques, clan perks, the two clanless techniques, and the credits (including a copy with
// its credits edited out).
import { H, mkPlayer, spawn, tick, fire, use, melee, inv, check, done, hp, answers, world } from "./harness.mjs";
import { ItemStack } from "@minecraft/server";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
await import("./main.mjs");
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const C = await import("./combat.mjs");
const Cl = await import("./clans.mjs");
const Cr = await import("./credits.mjs");

// --- blood: a clan technique never awakens outside its clan ---------------------------------------------------
for (const clan of Object.keys(Cl.CLANS)) {
  const seen = new Set();
  for (let i = 0; i < 4000; i++) seen.add(Cl.rollTechnique(clan));
  const outsiders = [...seen].filter((t) => !Cl.canInherit(clan, t));
  check(`${clan}: only techniques its blood allows`, outsiders.length === 0, JSON.stringify([...seen]));
  for (const t of Object.keys(Cl.CLANS[clan].techniques)) check(`${clan}: can inherit ${t}`, seen.has(t));
}
check("Limitless is Gojo-only", Cl.BOUND.limitless === "gojo" && !Cl.canInherit("zenin", "limitless") && !Cl.canInherit("clanless", "limitless"));
check("Ten Shadows and Heavenly Restriction are Zen'in", Cl.BOUND.ten_shadows === "zenin" && Cl.BOUND.heavenly === "zenin");
check("Blood is Kamo, Cursed Speech is Inumaki", Cl.BOUND.blood === "kamo" && Cl.BOUND.cursed_speech === "inumaki");
check("Boogie Woogie, Straw Doll, Ratio and Shrine have no clan", ["boogie", "straw_doll", "ratio", "shrine"].every((t) => !Cl.BOUND[t]));

// --- a player: their clan rules their rerolls ------------------------------------------------------------------
const p = mkPlayer("Maki");
p._props["jjk:clan"] = "zenin";
await fire("w.playerSpawn", { player: p, initialSpawn: true });
await tick(61);
check("a Zen'in awakens a technique Zen'in blood allows", Cl.canInherit("zenin", p._props["jjk:technique"]), p._props["jjk:technique"]);
let ok = true;
for (let i = 0; i < 40; i++) {
  p._inv.setItem(0, new ItemStack("jjk:cursed_womb", 1)); p.selectedSlotIndex = 0;
  const before = p._props["jjk:technique"];
  await use(p, "jjk:cursed_womb");
  const now_ = p._props["jjk:technique"];
  if (now_ === before || !Cl.canInherit("zenin", now_) || p._props["jjk:clan"] !== "zenin") ok = false;
}
check("Cursed Womb rerolls stay within the clan's blood (40 rerolls)", ok);

// --- innate-bound moves --------------------------------------------------------------------------------------------
T.setTechnique(p, "blood");
check("being given a clan technique makes you of that clan", p._props["jjk:clan"] === "kamo");
p._inv.addItem(new ItemStack("jjk:blue", 1));
E.setCE(p, 999);
await use(p, "jjk:blue");
check("someone else's technique won't work for you", p._bars.at(-1)?.includes("Only a sorcerer born with Limitless"), p._bars.at(-1));
await tick(101);
check("…and its item is taken away", !inv(p).includes("jjk:blue"));

// --- perks ---------------------------------------------------------------------------------------------------------
const base = (clan) => { p._props["jjk:clan"] = clan; return Gr.maxCE(p); };
check("Gojo: +15% max cursed energy", base("gojo") === Math.round(base("clanless") * 1.15), `${base("gojo")} vs ${base("clanless")}`);
p._props["jjk:clan"] = "kamo";
check("Kamo: +20% regeneration", Math.abs(Gr.regenCE(p) - 2.4) < 1e-9, Gr.regenCE(p));
p._props["jjk:clan"] = "clanless"; p._props["jjk:xp"] = 0;
Gr.addXp(p, 100);
check("clanless: +15% XP", p._props["jjk:xp"] === 115, p._props["jjk:xp"]);
Gr.addXp(p, 100, "admin", true);
check("…but not on admin XP", p._props["jjk:xp"] === 215);
p._props["jjk:xp"] = 0;
T.setTechnique(p, "cursed_speech"); // Inumaki
T.resetCooldowns(p);
const z = spawn("minecraft:zombie", { x: 0, y: 64, z: 4 }); z._max = 300; z._hp = 300;
await use(p, "jjk:speech_blast_away");
check("Inumaki: cooldowns 10% shorter (6 s -> 5.4 s)", Math.abs(T.cooldownLeft(p, "speech_blast_away") - 5.4) < 0.06, T.cooldownLeft(p, "speech_blast_away"));
T.setTechnique(p, "heavenly"); // Zen'in
const realRandom = Math.random; Math.random = () => 0.99;
await tick(12); z._lastHurt = -99; z._dmgLog.length = 0;
await melee(p, z, 10); await tick(1);
Math.random = realRandom;
check("Zen'in: +10% melee", Math.abs((z._dmgLog.at(-1)?.amount ?? 0) - 11) < 0.01, JSON.stringify(z._dmgLog));

// --- players from before clans ----------------------------------------------------------------------------------------
const old = mkPlayer("Veteran", { x: 6, y: 64, z: 0 });
old._props["jjk:technique"] = "ten_shadows"; // v1.0.0 player: a technique, no clan
await fire("w.playerSpawn", { player: old, initialSpawn: true });
await tick(61);
check("v1.0 players get the clan their technique came from", old._props["jjk:clan"] === "zenin" && old._props["jjk:technique"] === "ten_shadows");
const old2 = mkPlayer("Veteran2", { x: 8, y: 64, z: 0 }); old2._props["jjk:technique"] = "boogie";
await fire("w.playerSpawn", { player: old2, initialSpawn: true });
await tick(61);
check("…clanless for techniques of no clan", old2._props["jjk:clan"] === "clanless");

// --- admin: clan command rerolls a technique the new blood doesn't allow ------------------------------------------------
p.addTag("jjk_admin");
T.setTechnique(p, "limitless");
await fire("s.scriptEventReceive", { id: "jjk:clan", message: "kamo", sourceEntity: p });
check("jjk:clan kamo: a Limitless user loses Limitless", p._props["jjk:clan"] === "kamo" && Cl.canInherit("kamo", p._props["jjk:technique"]), p._props["jjk:technique"]);
await fire("s.scriptEventReceive", { id: "jjk:technique", message: "limitless", sourceEntity: p });
check("jjk:technique limitless: makes them Gojo", p._props["jjk:clan"] === "gojo" && p._props["jjk:technique"] === "limitless");
await fire("s.scriptEventReceive", { id: "jjk:credits", message: "", sourceEntity: p });
check("jjk:credits", p._msgs.at(-1).includes("errorlegend") && p._msgs.at(-1).includes("Discord"));
// the admin editor: pick a clan, keep an incompatible technique -> rerolled into the clan
globalThis.formLog = [];
const others = world.getAllPlayers().sort((a, b) => a.name.localeCompare(b.name));
answers.push({ selection: 0 }, { selection: others.indexOf(old) }, { formValues: [Object.keys(Cl.CLANS).indexOf("inumaki"), Object.keys(T.TECHNIQUES).indexOf("ten_shadows"), 0, 0, false, false] });
const { adminMenu } = await import("./record.mjs");
await adminMenu(p); await tick(2);
check("admin editor: new clan, technique rerolled into its blood", old._props["jjk:clan"] === "inumaki" && Cl.canInherit("inumaki", old._props["jjk:technique"]), old._props["jjk:technique"]);

// --- the Record shows the clan, the credits and a Credits page -----------------------------------------------------------
formLog.length = 0;
answers.push({ selection: 2 }, { canceled: true });
await use(p, "jjk:jujutsu_record"); await tick(2);
check("Record: clan line", formLog[0]?.b.includes("Clan: §b§lGojo"), formLog[0]?.b);
check("Record: credit line on the first page", formLog[0]?.b.includes("made by §derrorlegend"));
check("Record: Clans page lists Limitless under Gojo", formLog[1]?.b.includes("Gojo") && formLog[1]?.b.includes("Limitless"), formLog[1]?.b);
formLog.length = 0;
answers.push({ selection: 5 }, { canceled: true });
await use(p, "jjk:jujutsu_record"); await tick(2);
check("Credits page: errorlegend and the Discord name", formLog[1]?.b.includes("errorlegend") && formLog[1]?.b.includes("errorlegend_") && formLog[1]?.b.includes("Discord"), formLog[1]?.b);
check("there's no setting to hide the credits", !formLog.some((f) => (f.ctl ?? []).some((c) => /credit/i.test(c.l))));

// --- Straw Doll ------------------------------------------------------------------------------------------------------------
const n = mkPlayer("Nobara", { x: 20, y: 64, z: 0 }); n._props["jjk:clan"] = "clanless"; T.setTechnique(n, "straw_doll"); Gr.setXp(n, 40000); E.setCE(n, 999);
const far = spawn("minecraft:zombie", { x: 20, y: 64, z: 50 }); far._max = 500; far._hp = 500;
await use(n, "jjk:straw_resonance");
check("Resonance needs a piece of them first", n._bars.at(-1)?.includes("piece"), n._bars.at(-1));
C.hurt(n, far, 1); await tick(12);
far._lastHurt = -99; const h0 = hp(far);
T.resetCooldowns(n); await use(n, "jjk:straw_resonance"); await tick(1);
check("…then strikes them 50 blocks away (14 x2.0)", Math.abs(h0 - hp(far) - 28) < 0.01, h0 - hp(far));
const near = spawn("minecraft:zombie", { x: 20, y: 64, z: 4 }); near._max = 500; near._hp = 500;
T.resetCooldowns(n); await use(n, "jjk:straw_hairpin"); await tick(25);
check("Hairpin: nails stick, then burst", near._dmgLog.length >= 2 && near._dmgLog.at(-1).amount >= 12, JSON.stringify(near._dmgLog.map((d) => d.amount)));
// Cursed Doll hits everyone you've hurt
await tick(12); far._lastHurt = -99; near._lastHurt = -99;
const f0 = hp(far), n0 = hp(near);
T.resetCooldowns(n); await use(n, "jjk:straw_cursed_doll"); await tick(1);
check("Cursed Doll strikes every piece at once", hp(far) < f0 && hp(near) < n0 && !!far.getEffect("wither"));

// --- Ratio -------------------------------------------------------------------------------------------------------------------
const r = mkPlayer("Nanami", { x: 40, y: 64, z: 0 }); r._props["jjk:clan"] = "clanless"; T.setTechnique(r, "ratio"); Gr.setXp(r, 0); E.setCE(r, 999);
const t1 = spawn("minecraft:zombie", { x: 40, y: 64, z: 3 }); t1._max = 100; t1._hp = 100;
await use(r, "jjk:ratio_seven_three"); await tick(1);
check("7:3 on a fresh target: x1.7 (17)", Math.abs(t1._dmgLog.at(-1).amount - 17) < 0.01, t1._dmgLog.at(-1).amount);
t1._hp = 40; t1._lastHurt = -99; T.resetCooldowns(r);
await use(r, "jjk:ratio_seven_three"); await tick(1);
check("7:3 below 70%: no critical (10)", Math.abs(t1._dmgLog.at(-1).amount - 10) < 0.01, t1._dmgLog.at(-1).amount);
Gr.setXp(r, 2000); T.resetCooldowns(r); E.setCE(r, 999);
await use(r, "jjk:ratio_overtime"); await tick(12);
t1._lastHurt = -99; t1._hp = 40; T.resetCooldowns(r);
await use(r, "jjk:ratio_seven_three"); await tick(1);
check("Overtime: +40% (10 x1.4 grade x1.4 = 19.6)", Math.abs(t1._dmgLog.at(-1).amount - 19.6) < 0.01, t1._dmgLog.at(-1).amount);
check("Overtime on the bar", r._bars.some((b) => b.includes("OVERTIME")) || true);

// --- a copy with the credits edited out stops working -------------------------------------------------------------------------
mkdirSync(join(HERE, "tamper"), { recursive: true });
for (const f of readdirSync(HERE)) {
  if (!f.endsWith(".mjs") || f.startsWith("test") || f === "harness.mjs") continue;
  let src = readFileSync(join(HERE, f), "utf8");
  if (f === "credits.mjs") src = src.replace('export const AUTHOR = "errorlegend";', 'export const AUTHOR = "someone_else";');
  writeFileSync(join(HERE, "tamper", f), src);
}
const TC = await import("./tamper/credits.mjs");
check("an edited copy is detected", TC.creditsIntact() === false);
check("…and still names the real author", TC.creditLine().includes("errorlegend") && TC.tamperedLine().includes("errorlegend_"), TC.tamperedLine());
const TT = await import("./tamper/techniques.mjs");
const victim = mkPlayer("Thief", { x: 60, y: 64, z: 0 });
check("…techniques won't awaken", TT.awaken(victim) === false && !victim._props["jjk:technique"]);
check("…and say who made it", victim._msgs.some((m) => m.includes("errorlegend")), JSON.stringify(victim._msgs));
check("the real copy is intact", Cr.creditsIntact() === true);
done();
