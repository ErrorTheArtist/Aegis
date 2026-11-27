// Running a multiplayer server by itself: the vanilla bans (bans.js), the welcome, the spawn sanctuary, newcomer and
// respawn protection, Daily Blessings, grade tags, tips (server.js), item clears, the Top Sorcerers board and the server
// events (upkeep.js) — and the Record's This Server page, the Admin Panel's automation page and the commands.
import { H, mkPlayer, spawn, tick, fire, use, check, done, world, system, answers, inv } from "./harness.mjs";
import { ItemStack } from "@minecraft/server";
await import("./main.mjs");
world.setDynamicProperty("jjk:cinematics", false);
world.setDynamicProperty("jjk:curse_path", false); // (everyone a sorcerer here: the path choice is test11's)
const E = await import("./energy.mjs");
const Gr = await import("./grades.mjs");
const C = await import("./combat.mjs");
const B = await import("./bans.mjs");
const SV = await import("./server.mjs");
const U = await import("./upkeep.mjs");
const K = await import("./curses.mjs");
const now = () => system.currentTick;
const say = (who, id, message) => fire("s.scriptEventReceive", { id, message, sourceEntity: who });
function sorcerer(name, loc, tech = "boogie", xp = 0) {
  const p = mkPlayer(name, loc);
  Object.assign(p._props, { "jjk:technique": tech, "jjk:joined": 1, "jjk:clan": "zenin" });
  if (xp) Gr.setXp(p, xp);
  return p;
}
const CURSES = /^jjk:(fly_head|lanky_curse|mouth_curse|eye_curse)$/;

// --- vanilla bans -----------------------------------------------------------------------------------------------------
const p = sorcerer("Yuji", { x: 0, y: 64, z: 0 });
const admin = sorcerer("Admin", { x: 0, y: 64, z: -30 });
admin.addTag("jjk_admin");
const put = (q, slot, id, n = 1) => q._inv.setItem(slot, new ItemStack(id, n));
put(p, 0, "minecraft:iron_helmet"); put(p, 1, "minecraft:redstone", 12); put(p, 2, "minecraft:red_bundle"); put(p, 3, "minecraft:bundle");
put(p, 4, "minecraft:stone_sword"); put(p, 5, "minecraft:bread", 5); put(p, 6, "minecraft:piston"); put(p, 7, "minecraft:turtle_helmet");
p._equip.Chest = new ItemStack("minecraft:diamond_chestplate");
p._equip.Feet = new ItemStack("minecraft:netherite_boots");
await tick(41);
const banned = ["iron_helmet", "redstone", "red_bundle", "bundle", "piston", "turtle_helmet"].map((x) => `minecraft:${x}`);
check("armour, redstone and bundles leave the inventory", !inv(p).some((id) => banned.includes(id)), JSON.stringify(inv(p)));
check("…and the armour slots", !p._equip.Chest && !p._equip.Feet);
check("…weapons and food stay", inv(p).includes("minecraft:stone_sword") && inv(p).includes("minecraft:bread"));
check("…and the player is told what went", p._msgs.some((m) => m.includes("banned on this server") && m.includes("iron helmet")), p._msgs.at(-1));
const builder = sorcerer("Builder", { x: 6, y: 64, z: 0 });
builder._mode = "creative";
builder._equip.Head = new ItemStack("minecraft:iron_helmet");
await tick(41);
check("creative players keep theirs", !!builder._equip.Head);
world.setDynamicProperty("jjk:ban_armour", false);
p._equip.Head = new ItemStack("minecraft:golden_helmet");
await tick(41);
check("a group switched off is allowed", !!p._equip.Head && B.bansLine() === "Redstone and bundles are banned", B.bansLine());
world.setDynamicProperty("jjk:ban_armour", undefined);
await tick(41);
check("…and taken again when it's back on", !p._equip.Head && B.bansLine() === "Vanilla armour, redstone and bundles are banned");
await say(admin, "jjk:ban", "totem_of_undying");
put(p, 8, "minecraft:totem_of_undying");
await tick(41);
check("an admin can ban any item by hand", !inv(p).includes("minecraft:totem_of_undying") && B.extraBans().includes("minecraft:totem_of_undying"));
await say(admin, "jjk:unban", "minecraft:totem_of_undying");
put(p, 8, "minecraft:totem_of_undying");
await tick(41);
check("…and allow it again", inv(p).includes("minecraft:totem_of_undying"));
check("…but never Jujutsu Legacy's own items", B.banItem("jjk:jujutsu_record", true).includes("can't") && !B.isBanned("jjk:cursed_womb"));
const useEv = { source: p, itemStack: new ItemStack("minecraft:iron_chestplate"), cancel: false };
await fire("wb.itemUse", useEv);
const okEv = { source: p, itemStack: new ItemStack("minecraft:bread"), cancel: false };
await fire("wb.itemUse", okEv);
check("using a banned item is cancelled (nothing else)", useEv.cancel === true && !okEv.cancel);
const lever = { player: p, block: { typeId: "minecraft:lever" }, cancel: false };
const door = { player: p, block: { typeId: "minecraft:oak_door" }, cancel: false };
const placing = { player: p, block: { typeId: "minecraft:stone" }, itemStack: new ItemStack("minecraft:redstone"), cancel: false };
for (const ev of [lever, door, placing]) await fire("wb.playerInteractWithBlock", ev);
check("placing a banned block, or switching redstone already placed, is cancelled", lever.cancel && placing.cancel && !door.cancel);
const boots = spawn("minecraft:item", { x: 3, y: 64, z: 3 }); boots._item = new ItemStack("minecraft:iron_boots");
const loaf = spawn("minecraft:item", { x: 3, y: 64, z: 4 }); loaf._item = new ItemStack("minecraft:bread");
for (const e of [boots, loaf]) await fire("w.entitySpawn", { entity: e });
check("a banned item dropped on the ground vanishes", !boots._valid && loaf._valid);

// --- the spawn sanctuary ------------------------------------------------------------------------------------------------
const s = SV.sanctuary();
check("the sanctuary sits on the world spawn, 24 blocks wide", s && s.x === 5000.5 && s.z === 5000.5 && s.r === 24, JSON.stringify(s));
const host = sorcerer("Host", { x: 5003, y: 64, z: 5002 }, "limitless", 40000);
E.setCE(host, 999);
const visitor = sorcerer("Visitor", { x: 5001, y: 64, z: 5001 });
visitor.addTag("jjk_admin");
builder.location = { x: 4999, y: 64, z: 5003 };
await tick(11);
check("inside: nothing can hurt you, and you heal", (host.getEffect("resistance")?.amplifier ?? 0) >= 4 && !!host.getEffect("regeneration"));
check("…survival players can't build (adventure mode)", host._mode === "adventure" && host._tags.has("jjk_sanct_mode"));
check("…admins and creative players can", visitor._mode === "survival" && builder._mode === "creative");
check("…the CE bar says where you are", E.hudLine(host).includes("SANCTUARY"), E.hudLine(host));
const ce = E.getCE(host);
await use(host, "jjk:blue");
check("no techniques in the sanctuary", E.getCE(host) === ce && host._bars.some((b) => b.includes("sanctuary")));
const out = sorcerer("Outsider", { x: 5040, y: 64, z: 5000 }, "shrine", 2000);
const mob = spawn("minecraft:zombie", { x: 5060, y: 64, z: 5000 });
check("nobody can hit a player inside, from out there or in here", !C.hurt(out, host, 10) && !C.hurt(mob, host, 10) && !C.hurt(host, out, 10));
const zombie = spawn("minecraft:zombie", { x: 5005, y: 64, z: 5005 });
const fly = spawn("jjk:fly_head", { x: 4995, y: 64, z: 4998 });
const boss = spawn("jjk:finger_bearer", { x: 5006, y: 64, z: 5000 });
const servant = spawn("jjk:lanky_curse", { x: 5002, y: 64, z: 4996 }); servant._props["jjk:owner"] = host.id;
await tick(41);
check("curses and monsters inside are exorcised", !zombie._valid && !fly._valid);
check("…bosses are pushed back out", boss._valid && Math.hypot(boss.location.x - 5000.5, boss.location.z - 5000.5) > 24);
check("…a sorcerer's own servants may stay", servant._valid);
H.time = 18000;
const before = H.entities.filter((e) => e._valid && CURSES.test(e.typeId)).length;
K._test.surge();
check("night surges never put a curse in the sanctuary", H.entities.filter((e) => e._valid && CURSES.test(e.typeId) && !e._props["jjk:owner"]
  && Math.hypot(e.location.x - 5000.5, e.location.z - 5000.5) <= 24).length === 0, before);
H.time = 1000;
const blocks = [{ location: { x: 5001, y: 63, z: 5001 } }, { location: { x: 5100, y: 63, z: 5000 } }];
const blast = { dimension: H.dim(), getImpactedBlocks: () => blocks, setImpactedBlocks(b) { this.kept = b; } };
await fire("wb.explosion", blast);
check("explosions can't break the sanctuary", blast.kept?.length === 1 && blast.kept[0].location.x === 5100);
host.location = { x: 5100, y: 64, z: 5000 };
await tick(11);
check("leaving it: back to survival", host._mode === "survival" && !host._tags.has("jjk_sanct_mode") && !E.hudLine(host).includes("SANCTUARY"));
await say(admin, "jjk:auto", "sanctuary off");
host.location = { x: 5003, y: 64, z: 5002 };
await tick(11);
check("switched off: no sanctuary", host._mode === "survival" && !SV.sanctuary() && C.hurt(out, host, 1));
await say(admin, "jjk:auto", "sanctuary on");
host.location = { x: 5100, y: 64, z: 5000 };
await tick(11);

// --- joining: the welcome, newcomer protection, the MOTD, respawns -------------------------------------------------------
await say(admin, "jjk:motd", "Be nice — and exorcise curses!");
const n = mkPlayer("Newbie", { x: 0, y: 64, z: 10 });
await fire("w.playerSpawn", { player: n, initialSpawn: true });
check("a first join: 20 minutes of newcomer protection", n._props["jjk:newcomer"] === 1200);
await tick(155);
check("the welcome: how to play, the sanctuary, the bans, the rules", n._msgs.some((m) => m.includes("Welcome to the server")) && n._msgs.some((m) => m.includes("sanctuary"))
  && n._msgs.some((m) => m.includes("banned")) && n._msgs.some((m) => m.includes("Be nice")));
check("…and a starter kit", inv(n).includes("minecraft:bread") && inv(n).includes("minecraft:torch"));
const vet = sorcerer("Veteran", { x: 2, y: 64, z: 10 }, "shrine", 2000);
const curse = spawn("jjk:fly_head", { x: 0, y: 64, z: 14 });
check("newcomers can't be hit by players' techniques, nor hit players", !C.hurt(vet, n, 10) && !C.hurt(n, vet, 10));
check("…curses still come for them", C.hurt(curse, n, 1));
check("…the CE bar shows it", E.hudLine(n).includes("NEW 20m"), E.hudLine(n));
n._hp = 20; n._lastHurt = -99;
n.applyDamage(5, { cause: "entityAttack", damagingEntity: vet });
await tick(1);
check("a player's blow on a newcomer is undone", n._hp === 20, n._hp);
check("…and the attacker is told why", vet._bars.some((b) => b.includes("newcomer protection")));
n._props["jjk:newcomer"] = 1;
await tick(21);
check("protection ends after its 20 minutes, with a word", !n._props["jjk:newcomer"] && n._msgs.some((m) => m.includes("newcomer protection is over")));
check("…then players can fight them", C.hurt(vet, n, 1));
const oldTimer = mkPlayer("OldTimer", { x: -5, y: 64, z: 10 });
oldTimer._props["jjk:xp"] = 5000;
await fire("w.playerSpawn", { player: oldTimer, initialSpawn: true });
check("a sorcerer from before this update gets no protection", !oldTimer._props["jjk:newcomer"]);
n._msgs.length = 0;
await fire("w.playerSpawn", { player: n, initialSpawn: true });
await tick(131);
check("the MOTD on every join — no second welcome or kit", n._msgs.some((m) => m.includes("Be nice")) && !n._msgs.some((m) => m.includes("Welcome to the server")));
await fire("w.playerSpawn", { player: n, initialSpawn: false });
check("respawning: 5 s in which nothing can hurt you", n.getEffect("resistance")?.amplifier === 4 && n.getEffect("resistance").duration > 90);

// --- the Daily Blessing -------------------------------------------------------------------------------------------------
const d = sorcerer("Daily", { x: 0, y: 64, z: 20 });
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
let x0 = Gr.xpOf(d);
check("the first join of the day: a Daily Blessing", SV.dailyBlessing(d) && Gr.xpOf(d) - x0 === 60 && d._titles.some((t) => t.includes("Daily Blessing")));
check("…once a day", !SV.dailyBlessing(d));
d._props["jjk:daily_day"] = day(Date.now() - 86400000);
x0 = Gr.xpOf(d);
check("the next day: day 2, +10%", SV.dailyBlessing(d) && d._props["jjk:daily_streak"] === 2 && Gr.xpOf(d) - x0 === 66, Gr.xpOf(d) - x0);
d._props["jjk:daily_day"] = day(Date.now() - 86400000); d._props["jjk:daily_streak"] = 6;
x0 = Gr.xpOf(d);
check("day 7 in a row: +60% and a Cursed Womb", SV.dailyBlessing(d) && Gr.xpOf(d) - x0 === 96 && inv(d).includes("jjk:cursed_womb"));
d._props["jjk:daily_day"] = day(Date.now() - 3 * 86400000);
check("a missed day starts the streak again", SV.dailyBlessing(d) && d._props["jjk:daily_streak"] === 1);

// --- grade tags, tips -----------------------------------------------------------------------------------------------------
await tick(101);
check("every player's grade above their name", d.nameTag === "§7Grade 4§r\n§fDaily", JSON.stringify(d.nameTag));
Gr.setXp(d, 15000);
await tick(101);
check("…following promotions", d.nameTag.startsWith("§dGrade 1"));
await say(admin, "jjk:auto", "tags off");
await tick(101);
check("…and off when switched off", d.nameTag === "Daily");
const t1 = SV.tip();
check("tips in chat, one after another", H.worldMsgs.at(-1).includes(t1) && SV.tip() !== t1);

// --- dropped-item clears --------------------------------------------------------------------------------------------------
const lying = spawn("minecraft:item", { x: 30, y: 64, z: 30 }); lying._item = new ItemStack("minecraft:dirt");
const justDropped = spawn("minecraft:item", { x: 31, y: 64, z: 30 }); justDropped._item = new ItemStack("minecraft:cobblestone");
for (const e of [lying, justDropped]) await fire("w.entitySpawn", { entity: e });
U._upkeep.born.set(lying.id, now() - 3000);
check("a clear takes what has lain there 2 minutes", U.clearItems() >= 1 && !lying._valid && justDropped._valid);
H.worldMsgs.length = 0;
Object.assign(U._upkeep.clearState, { next: now() + 610, warned: 0 });
await tick(21);
check("…warned 30 s before", H.worldMsgs.some((m) => m.includes("30s")));
await tick(400);
check("…and 10 s before", H.worldMsgs.some((m) => m.includes("10s")));
await tick(220);
check("…then cleared", H.worldMsgs.some((m) => m.includes("Cleared") || m.includes("No dropped items")) && U._upkeep.clearState.next > now() + 10000);

// --- the Top Sorcerers board -----------------------------------------------------------------------------------------------
U._upkeep.boardTick();
const sb = world.scoreboard;
check("Top Sorcerers on the sidebar, best first", sb.getObjectiveAtDisplaySlot("Sidebar")?.objective?.id === "jjk_top" && sb.getObjectiveAtDisplaySlot("Sidebar").sortOrder === 1);
check("…ranked by XP", sb.getObjective("jjk_top").getScore("Host") === Gr.xpOf(host) && U.topSorcerers(1)[0][1] === Math.max(...H.players.map((q) => Gr.xpOf(q))));
await say(admin, "jjk:auto", "board off");
U._upkeep.boardTick();
check("…and gone when switched off", !sb.getObjectiveAtDisplaySlot("Sidebar"));
await say(admin, "jjk:auto", "board on");

// --- server events ---------------------------------------------------------------------------------------------------------
for (const e of H.entities) if (CURSES.test(e.typeId) || e.typeId === "jjk:finger_bearer") e._valid = false;
const hunter = sorcerer("Hunter", { x: 300, y: 64, z: 300 }, "shrine", 2000);
host.location = { x: 5003, y: 64, z: 5002 }; // (in the sanctuary: never picked)
await tick(11);
H.worldMsgs.length = 0;
check("a curse outbreak", U.startEvent("outbreak") === "outbreak" && H.worldMsgs.some((m) => m.includes("CURSE OUTBREAK")));
await tick(21);
const around = (x, z, r) => H.entities.filter((e) => e._valid && CURSES.test(e.typeId) && Math.hypot(e.location.x - x, e.location.z - z) < r);
check("…curses pour out around sorcerers", around(300, 300, 40).length >= 2);
check("…but never in the sanctuary", around(5000.5, 5000.5, 30).length === 0);
check("…the CE bar counts down", E.hudLine(hunter).includes("OUTBREAK"), E.hudLine(hunter));
const prey = spawn("jjk:fly_head", { x: 302, y: 64, z: 300 });
x0 = Gr.xpOf(hunter);
prey.applyDamage(999, { cause: "entityAttack", damagingEntity: hunter });
await tick(1);
check("…exorcisms give 1.5x XP", Gr.xpOf(hunter) - x0 === 15, Gr.xpOf(hunter) - x0);
U._upkeep.evState.until = now();
await tick(21);
check("…and the top exorcist wins a Cursed Womb", inv(hunter).includes("jjk:cursed_womb") && H.worldMsgs.some((m) => m.includes("Top exorcist") && m.includes("Hunter")));
check("a Special Grade hunt: a Finger Bearer near a Grade 2+ sorcerer, announced", U.startEvent("hunt") === "hunt"
  && H.entities.some((e) => e._valid && e.typeId === "jjk:finger_bearer") && H.worldMsgs.some((m) => m.includes("SPECIAL GRADE HUNT")));
for (const e of H.entities) if (e.typeId === "jjk:finger_bearer") e._valid = false;
Gr.setXp(d, 0); // (nobody outside the sanctuary is Grade 1 now)
check("a villain raid with nobody Grade 1 becomes an outbreak", U.startEvent("raid") === "outbreak");
U._upkeep.evState.until = now();
await tick(21);
Gr.setXp(hunter, 15000);
check("a villain raid", U.startEvent("raid") === "raid" && H.entities.some((e) => e._valid && e.typeId === "jjk:sorcerer"));
for (const e of H.entities) if (e.typeId === "jjk:sorcerer") e._valid = false;
H.worldMsgs.length = 0;
Object.assign(U._upkeep.evState, { next: now() + 1205, warned: false, turn: 0 });
await tick(41);
check("events are announced a minute before", H.worldMsgs.some((m) => m.includes("begins in") && m.includes("Curse Outbreak")));
await tick(1200);
check("…and start on their own", U._upkeep.evState.kind === "outbreak" && U._upkeep.evState.turn === 1 && U.eventInfo().includes("on now"));
U._upkeep.evState.until = now();
await tick(21);
check("…the next one is lined up", U.eventInfo().includes("Special Grade Hunt"), U.eventInfo());

// --- the Record and the Admin Panel ------------------------------------------------------------------------------------------
globalThis.formLog = [];
answers.push({ selection: 7 }, { canceled: true }); // (This Server: after Settings and Credits)
await use(hunter, "jjk:jujutsu_record");
await tick(2);
const page = formLog.find((f) => f.t === "§5This Server");
check("Record -> This Server: the rules, the sanctuary, the bans, events, the Top Sorcerers", !!page && ["Be nice", "Sanctuary", "Banned", "Server events", "Top Sorcerers"]
  .every((x) => page.b.includes(x)), page?.b);
hunter.addTag("jjk_admin");
// 3 ban groups, then welcome, sanctuary, newcomer, daily, tags, tips, clears, board, events; then the two sliders
answers.push({ selection: 8 }, { selection: 5 }, { formValues: [false, true, true, true, true, true, true, true, false, true, true, true, 32, 15] });
await use(hunter, "jjk:jujutsu_record");
await tick(3);
check("Admin Panel -> Server automation: bans, every part, the radius and the event timer", !B.groupOn("armour") && B.groupOn("redstone") && !SV.on("tips")
  && SV.on("tags") && SV.sanctuary()?.r === 32 && world.getDynamicProperty("jjk:events_every") === 15);

// --- commands -------------------------------------------------------------------------------------------------------------------
await say(hunter, "jjk:sanctuary", "here 16");
check("/scriptevent jjk:sanctuary here 16", SV.sanctuary().x === 300 && SV.sanctuary().r === 16);
await say(hunter, "jjk:sanctuary", "spawn");
check("/scriptevent jjk:sanctuary spawn", SV.sanctuary().x === 5000.5);
await say(hunter, "jjk:bans", "redstone off");
check("/scriptevent jjk:bans redstone off", !B.groupOn("redstone"));
await say(hunter, "jjk:protection", "5 Veteran");
check("/scriptevent jjk:protection 5 Veteran", SV.protectedLeft(vet) === 300);
await say(hunter, "jjk:protection", "off Veteran");
check("…and off", SV.protectedLeft(vet) === 0);
const litter = spawn("minecraft:item", { x: 40, y: 64, z: 40 }); litter._item = new ItemStack("minecraft:dirt");
await fire("w.entitySpawn", { entity: litter });
await say(hunter, "jjk:clear", "");
check("/scriptevent jjk:clear clears everything now", !litter._valid);
H.worldMsgs.length = 0;
await say(hunter, "jjk:event", "outbreak");
check("/scriptevent jjk:event outbreak", U._upkeep.evState.kind === "outbreak");
await say(hunter, "jjk:motd", "off");
check("/scriptevent jjk:motd off", SV.motd() === "");
done();
