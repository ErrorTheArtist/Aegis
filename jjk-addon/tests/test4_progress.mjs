import { H, mkPlayer, spawn, tick, fire, use, melee, inv, check, done, hp, answers, world } from "./harness.mjs";
import { ItemStack } from "@minecraft/server";
await import("./main.mjs");
const T = await import("./techniques.mjs");
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const C = await import("./combat.mjs");
const K = await import("./curses.mjs");

const p = mkPlayer("Megumi");
p._props["jjk:technique"] = "ten_shadows";
await tick(101);
check("starting moves synced", inv(p).includes("jjk:summon_divine_dogs") && !inv(p).includes("jjk:summon_max_elephant"));

const realRandom = Math.random; Math.random = () => 0.99; // no Black Flash on the killing blows (it pays 15 XP)
// --- exorcism XP and promotion ----------------------------------------------------------------------
function kill(type, by) {
  const c = spawn(type, { x: 0, y: 64, z: 3 });
  c._hp = 1;
  c.applyDamage(5, { cause: "entityAttack", damagingEntity: by });
  return c;
}
kill("jjk:fly_head", p); await tick(1);
check("Grade 4 curse: 10 XP", p._props["jjk:xp"] === 10, p._props["jjk:xp"]);
check("exorcism counted", p._props["jjk:exorcised"] === 1);
kill("jjk:eye_curse", p); kill("jjk:eye_curse", p); kill("jjk:eye_curse", p); kill("jjk:eye_curse", p);
await tick(1);
check("610 XP: promoted to Grade 3", Gr.gradeOf(p) === 1, p._props["jjk:xp"]);
check("promotion title", p._titles.some((t) => t.includes("GRADE 3")));
check("+2 hearts at Grade 3", p.getComponent("minecraft:health").effectiveMax === 24);
for (let i = 0; i < 10; i++) kill("jjk:eye_curse", p);
await tick(1);
check("Grade 2 at 2000 XP", Gr.gradeOf(p) === 2, p._props["jjk:xp"]);
await tick(1);
check("Grade 2 unlocks Max Elephant and Simple Domain", inv(p).includes("jjk:summon_max_elephant") && inv(p).includes("jjk:simple_domain"), JSON.stringify(inv(p)));
check("new move announced", p._msgs.some((m) => m.includes("New move")));
// kills by your shikigami are yours
E.setCE(p, 999); T.resetCooldowns(p);
await use(p, "jjk:summon_divine_dogs"); await tick(1);
const dog = H.entities.find((e) => /divine_dog/.test(e.typeId) && e._valid);
const xp0 = p._props["jjk:xp"];
kill("jjk:lanky_curse", dog); await tick(1);
check("shikigami kill credits the summoner (25)", p._props["jjk:xp"] === xp0 + 25, p._props["jjk:xp"] - xp0);
// other monsters and players
kill("minecraft:zombie", p); await tick(1);
check("vanilla monster: 3 XP", p._props["jjk:xp"] === xp0 + 28);
const rival = mkPlayer("Rival", { x: 3, y: 64, z: 0 });
rival._hp = 1; rival.applyDamage(5, { cause: "entityAttack", damagingEntity: p }); await tick(1);
check("beating a sorcerer: 100 XP", p._props["jjk:xp"] === xp0 + 128 && p._props["jjk:sorcerers_beaten"] === 1);

// --- the Finger Bearer --------------------------------------------------------------------------------
H.drops.length = 0;
kill("jjk:finger_bearer", p); await tick(1);
check("Finger Bearer: 1000 XP", p._props["jjk:xp"] === xp0 + 1128);
check("…always drops a finger", H.drops.includes("jjk:sukuna_finger"), JSON.stringify(H.drops));
check("…and the server hears of it", H.worldMsgs.some((m) => m.includes("Finger Bearer has been exorcised")));
// its fight: roar, spikes, brood, field
const boss = spawn("jjk:finger_bearer", { x: 0, y: 64, z: 6 });
p.location = { x: 0, y: 64, z: 2 }; p._max = 5000; p._hp = 5000; p._lastHurt = -99; // tank the fight
await tick(110);
check("boss: the roar hits players in range", p._dmgLog.some((d) => d.by === boss.id), JSON.stringify(p._dmgLog.slice(-3)));
await tick(150);
check("boss: brood of Fly Heads", H.entities.filter((e) => e.typeId === "jjk:fly_head" && e._valid).length >= 2);
check("boss never hurts other curses", H.entities.filter((e) => e.typeId === "jjk:fly_head").every((f) => !f._dmgLog.some((d) => d.by === boss.id)));
boss._hp = 600; // below half: enraged
await tick(320);
check("enraged boss floods the area", p._msgs.some((m) => m.includes("floods the area")));
// a single hit can't take more than 6%
boss._hp = 1500; boss._lastHurt = -99;
C.hurt(p, boss, 1000);
check("boss hit cap (6% = 90)", Math.abs(boss._dmgLog.at(-1).amount - 90) < 0.01, boss._dmgLog.at(-1).amount);
// nobody near for a minute: it leaves
p.location = { x: 500, y: 64, z: 0 };
await tick(1210);
check("an abandoned boss leaves after a minute", !boss._valid);
p.location = { x: 0, y: 64, z: 2 };
boss._valid = false;
check("player survived the boss checks", p._hp > 0);
p._max = 20; p._hp = 20;

// --- Sukuna's Fingers ---------------------------------------------------------------------------------
const maxBefore = Gr.maxCE(p);
p._inv.setItem(0, new ItemStack("jjk:sukuna_finger", 3)); p.selectedSlotIndex = 0;
await use(p, "jjk:sukuna_finger");
check("eating a finger: +1", Gr.fingersOf(p) === 1 && p._inv.getItem(0).amount === 2);
check("…+10 max CE", Gr.maxCE(p) === maxBefore + 10);
p._props["jjk:fingers"] = 20;
await use(p, "jjk:sukuna_finger");
check("no more than 20", Gr.fingersOf(p) === 20 && p._inv.getItem(0).amount === 2);

Math.random = realRandom;
// --- Cursed Womb ----------------------------------------------------------------------------------------
p._inv.setItem(0, new ItemStack("jjk:cursed_womb", 1));
const old = p._props["jjk:technique"];
await use(p, "jjk:cursed_womb"); await tick(1);
check("womb rerolls into a different technique", p._props["jjk:technique"] !== old && !!T.TECHNIQUES[p._props["jjk:technique"]], p._props["jjk:technique"]);
check("womb consumed", !p._inv.getItem(0) || p._inv.getItem(0).typeId !== "jjk:cursed_womb");
check("old moves gone, new ones given", !inv(p).includes("jjk:summon_divine_dogs") && T.itemsFor(p).every((id) => inv(p).includes("jjk:" + id)), JSON.stringify(inv(p)));

// --- night surges ----------------------------------------------------------------------------------------
for (const e of H.entities) if (e._families.includes("curse")) e._valid = false;
H.time = 18000;
K._test.surge();
const curses = H.entities.filter((e) => e._valid && e._families.includes("curse"));
check("night: curses gather near sorcerers", curses.length >= 1 && curses.every((c) => Math.hypot(c.location.x - p.location.x, c.location.z - p.location.z) >= 15), curses.length);
check("…standing on the ground, not in it", curses.every((c) => c.location.y === 64), JSON.stringify(curses.map((c) => c.location.y)));
H.time = 6000;
const n0 = H.entities.length;
K._test.surge();
check("day: no surge", H.entities.length === n0);
world.setDynamicProperty("jjk:surges", false); H.time = 18000;
K._test.surge();
check("surges can be switched off", H.entities.length === n0);
world.setDynamicProperty("jjk:surges", undefined);

// --- the Record ------------------------------------------------------------------------------------------
globalThis.formLog = [];
answers.push({ selection: 0 }, { selection: 0 }, { canceled: true });
await use(p, "jjk:jujutsu_record"); await tick(2);
check("Record opens with stats", formLog[0]?.b.includes("Innate technique") && formLog[0]?.b.includes("Sukuna's Fingers: §420/20"), formLog[0]?.b);
check("moves page lists costs and cooldowns", /— (\d+ CE · )?\d+(\.\d+)?s/.test(formLog[1]?.b ?? ""), formLog[1]?.b);
check("no admin button for players", !formLog[0].btns.some((b) => b.includes("Admin")));
formLog.length = 0;
answers.push({ selection: 5 }, { formValues: [false] }); // (Settings: after Technique, Grades, Clans, Binding Vows, How to Fight)
await use(p, "jjk:jujutsu_record"); await tick(2);
check("settings: hide the bar", p._props["jjk:hud_off"] === true);
p._bars.length = 0; await tick(20);
check("bar hidden", !p._bars.some((b) => b.includes("CE")), p._bars.at(-1));
delete p._props["jjk:hud_off"];
// admin panel: edit another player
p.addTag("jjk_admin"); formLog.length = 0;
const r2 = mkPlayer("Nobara", { x: 9, y: 64, z: 0 }); r2._props["jjk:technique"] = "boogie";
const others = world.getAllPlayers().sort((x, y) => x.name.localeCompare(y.name));
answers.push({ selection: 8 }, { selection: 0 }, { selection: others.indexOf(r2) }, { formValues: [Object.keys(T.TECHNIQUES).indexOf("shrine"), 1, 4, 5, true, false] });
await use(p, "jjk:jujutsu_record"); await tick(3);
check("admin button for admins", formLog[0]?.btns.some((b) => b.includes("Admin")));
check("admin edit: technique, grade, fingers", r2._props["jjk:technique"] === "shrine" && Gr.gradeOf(r2) === 4 && Gr.fingersOf(r2) === 5,
  JSON.stringify([r2._props["jjk:technique"], Gr.gradeOf(r2), Gr.fingersOf(r2)]));
check("…and they get their Grade 1 moves", inv(r2).includes("jjk:malevolent_shrine"), JSON.stringify(inv(r2)));

// --- commands ---------------------------------------------------------------------------------------------
await fire("s.scriptEventReceive", { id: "jjk:technique", message: "limitless Nobara", sourceEntity: p });
check("command: set technique by name", r2._props["jjk:technique"] === "limitless");
await fire("s.scriptEventReceive", { id: "jjk:grade", message: "5", sourceEntity: p });
check("command: grade (self)", Gr.gradeOf(p) === 5);
await fire("s.scriptEventReceive", { id: "jjk:technique", message: "nonsense", sourceEntity: p });
check("command: unknown technique explained", p._msgs.at(-1).includes("Unknown technique"));
await fire("s.scriptEventReceive", { id: "jjk:reset", message: "Nobara", sourceEntity: p });
check("command: reset re-awakens", !!r2._props["jjk:technique"] && !r2._props["jjk:xp"]);
await fire("s.scriptEventReceive", { id: "jjk:finger", message: "7 Nobara", sourceEntity: p });
check("command: fingers", Gr.fingersOf(r2) === 7);
await fire("s.scriptEventReceive", { id: "jjk:xp", message: "100 Nobody", sourceEntity: p });
check("command: unknown player", p._msgs.at(-1).includes("No player called Nobody"));
await fire("s.scriptEventReceive", { id: "jjk:boss", message: "", sourceEntity: p });
check("command: boss", H.entities.some((e) => e.typeId === "jjk:finger_bearer" && e._valid));
done();
