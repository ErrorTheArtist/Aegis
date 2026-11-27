// The two paths and the curse's powers: the first join's choice, awakening as a Cursed Spirit, the curse pool, curse
// grades, Devour, Terror, Curse Unleashed, regeneration, the new disasters and the Horizon of the Captivating Skandha,
// who fights whom (curse mobs, Jujutsu High and its night hunters, kin villains), starting over, and the admin tools.
import { H, mkPlayer, spawn, tick, fire, use, check, done, world, answers, inv } from "./harness.mjs";
import { ItemStack } from "@minecraft/server";
import { readFileSync } from "node:fs";
await import("./main.mjs");
for (const k of ["cinematics", "auto_newcomer", "auto_daily", "auto_welcome"]) world.setDynamicProperty(`jjk:${k}`, false);
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const C = await import("./combat.mjs");
const Cl = await import("./clans.mjs");
const S = await import("./sorcerers.mjs");
const D = await import("./domains.mjs");
const ROOT = process.env.JJK_ROOT;
const say = (who, id, message) => fire("s.scriptEventReceive", { id, message, sourceEntity: who });

// --- the choice -------------------------------------------------------------------------------------------------------
globalThis.formLog = [];
const a = mkPlayer("Aoi", { x: 0, y: 64, z: 0 });
answers.push({ selection: 1 }); // the Cursed Spirit
await fire("w.playerSpawn", { player: a, initialSpawn: true });
await tick(62);
const choice = formLog.find((f) => f.t === "§5Choose your path");
check("a new player chooses: Jujutsu Sorcerer or Cursed Spirit", !!choice && choice.btns.length === 2 && choice.btns[0].includes("Jujutsu Sorcerer") && choice.btns[1].includes("Cursed Spirit"));
check("the curse: a Cursed Spirit with a disaster", Cl.isCurse(a) && a._tags.has("jjk_curse") && T.techniqueOf(a) in Cl.CURSE_POOL, T.techniqueOf(a));
check("…the curse's own powers, not a sorcerer's", inv(a).includes("jjk:curse_devour") && !inv(a).includes("jjk:simple_domain") && inv(a).includes("jjk:jujutsu_record"));
check("…told what it is", a._msgs.some((m) => m.includes("Cursed Spirit") && m.includes("disaster")) && a._titles.some((t) => t.includes("humanity's fear")));
check("…and its grade says so", E.hudLine(a).includes("Grade 4 Curse"), E.hudLine(a));
const b = mkPlayer("Bea", { x: 40, y: 64, z: 0 });
answers.push({ selection: 0 });
await fire("w.playerSpawn", { player: b, initialSpawn: true });
await tick(62);
check("the sorcerer: a clan and an innate technique", !Cl.isCurse(b) && !!Cl.CLANS[Cl.clanOf(b)] && !!T.techniqueOf(b) && !b._tags.has("jjk_curse") && !inv(b).includes("jjk:curse_devour"));
const c = mkPlayer("Cid", { x: 80, y: 64, z: 0 });
await fire("w.playerSpawn", { player: c, initialSpawn: true });
await tick(62);
check("closing the choice asks again", !T.techniqueOf(c) && c._bars.some((x) => x.includes("Choose your path")));
await tick(420);
check("…closed three times: the sorcerer's path", !!T.techniqueOf(c) && !Cl.isCurse(c) && c._msgs.some((m) => m.includes("sorcerer's path")));
world.setDynamicProperty("jjk:curse_path", false);
formLog.length = 0;
const d = mkPlayer("Dee", { x: 120, y: 64, z: 0 });
await fire("w.playerSpawn", { player: d, initialSpawn: true });
await tick(62);
check("with the choice switched off, everyone awakens a sorcerer", !!T.techniqueOf(d) && !Cl.isCurse(d) && !formLog.some((f) => f.t === "§5Choose your path"));
world.setDynamicProperty("jjk:curse_path", undefined);

// --- the curse pool -----------------------------------------------------------------------------------------------------
const counts = {};
for (let i = 0; i < 4000; i++) {
  const t = Cl.rollTechnique("cursed");
  counts[t] = (counts[t] ?? 0) + 1;
}
check("a curse awakens only disasters, as often as the pool says", Object.keys(counts).every((t) => t in Cl.CURSE_POOL)
  && Object.keys(Cl.CURSE_POOL).every((t) => Math.abs(counts[t] / 40 - Cl.curseChance(t)) < 3), JSON.stringify(counts));
let sorcererRolls = new Set();
for (let i = 0; i < 4000; i++) sorcererRolls.add(Cl.rollTechnique(Cl.rollClan()));
check("Disaster Plants and Tides are the curses' alone", !sorcererRolls.has("disaster_plants") && !sorcererRolls.has("disaster_tides")
  && Cl.techChance("disaster_tides") === 0 && T.TECHNIQUES.disaster_plants.rarity.includes("Cursed Spirits only"));
check("…a curse sees curse odds for a shared one", T.rarityFor(a, "disaster_flames").includes("Cursed Spirits") && !T.rarityFor(b, "disaster_flames").includes("Cursed"));
const was = T.techniqueOf(a);
a.selectedSlotIndex = 30;
a._inv.setItem(30, new ItemStack("jjk:cursed_womb"));
await use(a, "jjk:cursed_womb");
check("a Cursed Womb rerolls a curse into another disaster", T.techniqueOf(a) !== was && T.techniqueOf(a) in Cl.CURSE_POOL && Cl.isCurse(a));
a.selectedSlotIndex = 0;

// --- the curse's powers ---------------------------------------------------------------------------------------------------
E.setCE(a, 999);
T.resetCooldowns(a);
const prey = spawn("jjk:lanky_curse", { x: 2, y: 64, z: 0 });
prey._hp = 8; // (a third of its 30 or less)
let xp0 = Gr.xpOf(a);
a._hp = 10;
await use(a, "jjk:curse_devour");
check("Devour: a weakened curse is eaten — its XP, health and CE", !prey._valid && Gr.xpOf(a) - xp0 === 25 && a._hp > 10 && a._props["jjk:devoured"] === 1, Gr.xpOf(a) - xp0);
const whole = spawn("jjk:lanky_curse", { x: 2, y: 64, z: 1 });
T.resetCooldowns(a);
let ce0 = E.getCE(a);
await use(a, "jjk:curse_devour");
check("…not a healthy one (and that costs nothing)", whole._valid && E.getCE(a) === ce0);
whole._valid = false;
Gr.setXp(a, 600);
T.syncItems(a);
check("Terror unlocks at Grade 3", inv(a).includes("jjk:curse_terror") && !inv(a).includes("jjk:curse_unleash"));
const scared = spawn("minecraft:zombie", { x: 3, y: 64, z: 3 });
await use(a, "jjk:curse_terror");
check("Terror: everyone near takes 5 and is weakened, slowed and sickened", scared._dmgLog.length === 1 && ["weakness", "slowness", "nausea"].every((x) => !!scared.getEffect(x)));
scared._valid = false;
Gr.setXp(a, 2000);
T.resetCooldowns(a);
await use(a, "jjk:curse_unleash");
check("Curse Unleashed: Strength II, Speed, Resistance", a.getEffect("strength")?.amplifier === 1 && !!a.getEffect("speed") && !!a.getEffect("resistance"));
a._hp = 10; b._hp = 10;
E.setCE(a, 50);
await tick(21);
check("a curse's body heals itself, for CE", a._hp > 10 && E.getCE(a) < 50 + 10, `${a._hp} ${E.getCE(a)}`);
check("…a sorcerer's doesn't", b._hp === 10);
b._bars.length = 0; a._bars.length = 0;
await use(b, "jjk:curse_devour");
await use(a, "jjk:reverse_cursed_technique");
check("a sorcerer can't use a curse's powers, nor a curse a sorcerer's", b._bars.some((x) => x.includes("Only a Cursed Spirit")) && a._bars.some((x) => x.includes("sorcerer's technique")));

// --- the new disasters -----------------------------------------------------------------------------------------------------
const plant = mkPlayer("Hanami", { x: 300, y: 64, z: 0 });
T.setTechnique(plant, "disaster_plants");
check("being given a curse's own technique makes you a curse", Cl.isCurse(plant) && plant._tags.has("jjk_curse"));
Gr.setXp(plant, 15000); E.setCE(plant, 9999); T.syncItems(plant);
const victim = mkPlayer("Victim", { x: 300, y: 64, z: 6 });
victim._props["jjk:technique"] = "boogie"; victim._max = victim._hp = 200;
E.setCE(victim, 100);
await use(plant, "jjk:plant_buds");
await tick(50);
check("Cursed Buds take root: they keep draining health and CE", victim._dmgLog.length >= 2 && E.getCE(victim) < 100, `${victim._dmgLog.length} ${E.getCE(victim)}`);
T.resetCooldowns(plant);
const tree = spawn("minecraft:zombie", { x: 300, y: 64, z: 4 }); tree._max = tree._hp = 300;
await use(plant, "jjk:plant_roots");
await tick(6);
check("Wooden Roots: 9 damage, and held", tree._dmgLog.length === 1 && C.stunned(tree));
T.resetCooldowns(plant);
plant._hp = 10;
tree.location = { x: 300, y: 64, z: 10 }; tree._lastHurt = -99;
await use(plant, "jjk:sea_of_light");
await tick(22);
check("Maximum: Ceremonial Sea of Light — a beam, and you heal from it", tree._dmgLog.length === 2 && plant._hp > 10 && H.particles.some((x) => x.id === "jjk:beam"));
const dg = mkPlayer("Dagon", { x: 600, y: 64, z: 0 });
T.setTechnique(dg, "disaster_tides");
Gr.setXp(dg, 15000); E.setCE(dg, 9999); T.syncItems(dg);
const fishFood = spawn("minecraft:zombie", { x: 600, y: 64, z: 5 }); fishFood._max = fishFood._hp = 400;
await use(dg, "jjk:tide_swarm");
await tick(30);
check("Death Swarm: three bites", fishFood._dmgLog.length === 3 && H.particles.some((x) => x.id === "jjk:fish"), fishFood._dmgLog.length);
T.resetCooldowns(dg);
fishFood.location = { x: 607, y: 64, z: 3 }; fishFood._kb.length = 0;
await use(dg, "jjk:tide_undertow");
check("Undertow drags them in", fishFood._kb.length === 1 && fishFood._kb[0][0] < 0 && !!fishFood.getEffect("slowness"));
T.resetCooldowns(dg);
fishFood.location = { x: 600, y: 64, z: 5 }; fishFood._lastHurt = -99;
const n0 = fishFood._dmgLog.length;
await use(dg, "jjk:horizon_skandha");
await tick(45);
check("Horizon of the Captivating Skandha: its own barrier, fish biting everyone inside", D.domainOf(dg)?.kind === "tides"
  && H.entities.some((e) => e._valid && e.typeId === "jjk:domain_dome" && e._events.includes("jjk:as_tides")) && fishFood._dmgLog.length - n0 >= 2
  && !!fishFood.getEffect("slowness") && !!dg.getEffect("speed"));
D.collapse(D.domainOf(dg));

// --- who fights whom ------------------------------------------------------------------------------------------------------------
const fly = JSON.parse(readFileSync(`${ROOT}/behavior_pack/entities/fly_head.json`, "utf8"));
check("curses leave Cursed Spirit players alone (their entity files)", JSON.stringify(fly).includes('"value":"jjk_curse"') && JSON.stringify(fly).includes('"operator":"!="'));
const sorc = JSON.parse(readFileSync(`${ROOT}/behavior_pack/entities/sorcerer.json`, "utf8"))["minecraft:entity"];
check("…Jujutsu High goes for them, the cursed villains don't", JSON.stringify(sorc.component_groups["jjk:ally"]).includes("jjk_curse")
  && sorc.events["jjk:as_mahito"].add.component_groups.includes("jjk:villain_kin") && sorc.events["jjk:as_sukuna"].add.component_groups.includes("jjk:villain"));
for (const q of [a, b]) q.location = { x: 1000, y: 64, z: q === a ? 0 : 30 };
const yuji = S.spawnSorcerer(H.dim(), "yuji", { x: 1004, y: 64, z: 0 });
check("Jujutsu High goes for a Cursed Spirit", S.targetOf(yuji)?.id === a.id);
check("…its techniques hurt them, not a sorcerer", C.hurt(yuji, a, 1) && !C.hurt(yuji, b, 1));
check("…and a curse can fight back", C.hurt(a, yuji, 1) && !C.hurt(b, yuji, 1));
a._msgs.length = 0;
await S.talk(a, yuji);
check("…no talking, no sparring with a curse", a._msgs.some((m) => m.includes("exorcise you")) && S.startSpar(yuji, a) === false);
yuji._valid = false;
const mahito = S.spawnSorcerer(H.dim(), "mahito", { x: 1004, y: 64, z: 2 });
const sukuna = S.spawnSorcerer(H.dim(), "sukuna", { x: 1000, y: 64, z: 60 });
check("Mahito spares a Cursed Spirit — not a sorcerer", !C.hurt(mahito, a, 1) && C.hurt(mahito, b, 1) && S.targetOf(mahito)?.id !== a.id);
check("…Sukuna spares no one", C.hurt(sukuna, a, 1));
for (const e of [mahito, sukuna]) e._valid = false;
H.time = 18000;
Gr.setXp(a, 0);
const hunter = S.hunterNight(true);
check("at night Jujutsu High comes to exorcise a Cursed Spirit", !!hunter && a._msgs.some((m) => m.includes("has come to exorcise you"))
  && ["yuji", "megumi", "nobara", "panda", "maki", "inumaki"].includes(hunter._props["jjk:who"]) && hunter._props["jjk:hunting"] === a.id);
Gr.setXp(a, 15000); // (Grade 1: a villain would come for a sorcerer this strong)
check("…while villains never come for one", S.villainNight(true) === undefined);
Gr.setXp(a, 0);
H.time = 1000;
hunter._valid = false;
const nobara = S.spawnSorcerer(H.dim(), "nobara", { x: 1010, y: 64, z: 0 });
xp0 = Gr.xpOf(a);
nobara.applyDamage(99999, { cause: "magic", damagingEntity: a });
await tick(1);
check("beating a Jujutsu High sorcerer pays a curse twice their spar XP", Gr.xpOf(a) - xp0 === 240 && (a._props["jjk:sorcerers_beaten"] ?? 0) >= 1, Gr.xpOf(a) - xp0);

// --- starting over, the admin's tools ---------------------------------------------------------------------------------------------
globalThis.formLog = [];
answers.push({ selection: 5 }, { formValues: [true, true, true] }, { selection: 0 }); // Settings: the bar, cinematics, start over; then yes
await use(a, "jjk:jujutsu_record");
await tick(3);
check("Record -> Settings: a curse can start over as a sorcerer", !Cl.isCurse(a) && !a._tags.has("jjk_curse") && Gr.xpOf(a) === 0 && !!T.techniqueOf(a)
  && !inv(a).includes("jjk:curse_devour") && formLog.some((f) => f.t === "§bBecome a Jujutsu Sorcerer"));
const xpB = Gr.xpOf(b);
await say(d, "jjk:path", "curse Bea");
check("/scriptevent jjk:path curse Bea: a curse, grade kept", Cl.isCurse(b) && T.techniqueOf(b) in Cl.CURSE_POOL && Gr.xpOf(b) === xpB && b._tags.has("jjk_curse"));
await say(d, "jjk:path", "sorcerer Bea");
check("…and back", !Cl.isCurse(b) && !b._tags.has("jjk_curse") && Cl.canInherit(Cl.clanOf(b), T.techniqueOf(b)));
await say(d, "jjk:technique", "disaster_tides Cid");
check("/scriptevent jjk:technique disaster_tides makes them a curse", Cl.isCurse(c) && T.techniqueOf(c) === "disaster_tides");
await say(d, "jjk:reset", "Cid");
await tick(2);
check("/scriptevent jjk:reset: they choose their path again", !T.techniqueOf(c) && !Cl.clanOf(c));
done();
