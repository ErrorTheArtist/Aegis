// The Great Shinobi War (v1.64) — the whole server, summoned to the Hidden Leaf.
//   An admin declares war (Admin Panel → World Events, or /scriptevent aegis:event war). After a 15-second call to arms
//   every player online — and anyone who joins while it lasts — is summoned to the Hidden Leaf (healed, chakra full, a few
//   seconds of protection), and four battles follow, each harder than the last and scaled to how many are fighting:
//     1. The Zetsu Army   — three waves of enemy ninja storm the village, Zetsu with the last (4 minutes)
//     2. The Reanimated   — Edo Tensei legends rise around the walls (5 minutes)
//     3. The Akatsuki     — the cloaks come for the Hidden Leaf (5 minutes)
//     4. Madara Uchiha    — the final battle; with 4 or more shinobi the Ten-Tails comes too (6 minutes)
//   A battle ends when its enemies are all down (every fighter: +15) — or its time runs out and they pull back.
//   War Merit — the competition, live on the sidebar (the top shinobi and every village's total):
//     an enemy ninja +10 · an Akatsuki member +60 · a legend +100 · the Ten-Tails +250 · the final blow on Madara +200
//     (Hero of the War) · every 1% of a boss's health you deal +1 · a shinobi of another village +40 · falling −15.
//   Who's leading is announced as it changes, and the standings every minute.
//   The end: the top three win big (Ryō, XP Shards and Mystery Scrolls), everyone is paid for their merit, the village
//   with the most merit wins (+500 honor for each of its fighters) — and 15 seconds later everyone is sent back to where
//   they were. Players killed in the war come straight back into it. Kills between players during the war count for
//   merit, never bounty; friendly fire and grace periods still apply.

import { world, system, ItemStack } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { shake } from "./cinematic.js";
import { VILLAGES, getVillage, addHonor } from "./villages.js";
import { QUEST_TARGETS } from "./quests.js";
import { LEGENDS } from "./legends.js";
import { addRyo, fmtRyo, questRyo } from "./currency.js";
import { giveShards } from "./xpshards.js";
import { bumpAch } from "./achievements.js";
import { claimEvent, releaseEvent, currentEvent } from "./events.js";
import { MYSTERY, bumpFun } from "./fun.js";

export const WAR_TAG = "aegis_war";
const EVENT_TAG = "aegis_event"; // (events.js clears these after a restart)
const RETURN = "aegis:war_return"; // player: where to send them back to
const OBJ = "aegis_war";
export const MUSTER = 15; // seconds from the declaration to the summons
export const READY = 10; // seconds between the summons and the first battle
export const BREAK = 8; // seconds between battles
export const PHASES = [
  { id: "zetsu", title: "§2Battle 1 — The Zetsu Army", sub: "§7waves of enemy ninja storm the village", seconds: 240 },
  { id: "edo", title: "§5Battle 2 — The Reanimated", sub: "§7Edo Tensei legends rise around the walls", seconds: 300 },
  { id: "akatsuki", title: "§cBattle 3 — The Akatsuki", sub: "§7the cloaks have come for the Hidden Leaf", seconds: 300 },
  { id: "madara", title: "§4Battle 4 — Madara Uchiha", sub: "§7\"Wake up to reality.\"", seconds: 360 },
];
export const MERIT = { ninja: 10, akatsuki: 60, legend: 100, juubi: 250, hero: 200, pvp: 40, death: -15, phase: 15 };
export const RANK_PRIZES = [[60000, 5, 3], [35000, 3, 2], [20000, 2, 1]]; // Ryō (at the full quest rate), XP Shards, Mystery Scrolls
const EDO = ["zabuza", "hanzo", "tobirama", "hashirama", "sarutobi", "minato"];
const CLOAKS = ["itachi", "kisame", "deidara", "sasori", "hidan", "kakuzu", "konan", "pain"];
const NINJA = ["rogue", "sound", "anbu"];
const BOSSES = new Set(["aegis:legend", "aegis:akatsuki", "aegis:juubi"]);

let api;
let war; // the running war — also events.js's current event

export const warOn = () => !!war;
export const warState = () => war;
const say = (t) => world.sendMessage(`§8[§4War§8] ${t}`);
const overworld = () => world.getDimension("overworld");
const center = () => VILLAGES.leaf.pos;
const online = (id) => world.getAllPlayers().find((p) => p.id === id);
const fighting = () => world.getAllPlayers().filter((p) => war?.merit.has(p.id));
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
// Kills between two of the war's shinobi are part of the war (bounty.js skips them).
export const isWarKill = (killer, victim) => !!war && war.stage !== "muster" && war.merit.has(killer?.id) && war.merit.has(victim?.id);

function ownerOf(e) {
  if (!e) return undefined;
  if (e.typeId === "minecraft:player") return e;
  try {
    const o = world.getEntity(e.getDynamicProperty("aegis:owner"));
    return o?.typeId === "minecraft:player" ? o : undefined;
  } catch {
    return undefined;
  }
}
function entry(p) {
  let e = war.merit.get(p.id);
  if (!e) {
    e = { name: p.name, village: getVillage(p) ?? "rogue", merit: 0, dmg: 0 };
    war.merit.set(p.id, e);
    war.participants.add(p.id);
  }
  return e;
}
export function meritOf(p) {
  return war?.merit.get(p?.id)?.merit ?? 0;
}
export function addMerit(p, n, why) {
  if (!war || !p) return 0;
  const e = entry(p);
  e.merit = Math.max(0, e.merit + n);
  if (why && n) p.onScreenDisplay?.setActionBar(`${n > 0 ? "§6+" : "§c"}${n} War Merit §7(${why})`);
  return e.merit;
}
export function ranking() {
  return war ? [...war.merit.entries()].map(([id, e]) => ({ id, ...e })).sort((a, b) => b.merit - a.merit) : [];
}
export function villageTotals() {
  const t = new Map();
  for (const e of war?.merit.values() ?? []) t.set(e.village, (t.get(e.village) ?? 0) + e.merit);
  return [...t].map(([v, total]) => ({ v, total })).sort((a, b) => b.total - a.total);
}
const villageName = (v) => (VILLAGES[v] ? `${VILLAGES[v].color}${VILLAGES[v].name}` : "§8Rogue ninja");

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------
// A spot to stand (air over something solid) near x/z, searched downward from above `yHint`.
function ground(dim, x, z, yHint) {
  for (let y = Math.floor(yHint) + 12; y >= Math.floor(yHint) - 12; y--) {
    try {
      const b = dim.getBlock({ x, y, z });
      const up = dim.getBlock({ x, y: y + 1, z });
      const below = dim.getBlock({ x, y: y - 1, z });
      if (b?.isAir && up?.isAir && below && !below.isAir && !below.isLiquid) return y;
    } catch {
      return undefined; // not loaded
    }
  }
  return undefined;
}
function ringSpot(r0, r1) {
  const c = center();
  const dim = overworld();
  for (let k = 0; k < 12; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = r0 + Math.random() * (r1 - r0);
    const x = Math.floor(c.x + Math.cos(a) * r);
    const z = Math.floor(c.z + Math.sin(a) * r);
    const y = ground(dim, x, z, c.y);
    if (y !== undefined) return { x: x + 0.5, y, z: z + 0.5 };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The summons and the way home
// ---------------------------------------------------------------------------
function summon(p, first = true) {
  if (!war || !api.isValid(p)) return;
  entry(p);
  try {
    if (first && p.getDynamicProperty(RETURN) === undefined) {
      p.setDynamicProperty(RETURN, JSON.stringify({ dim: p.dimension.id, x: p.location.x, y: p.location.y, z: p.location.z }));
    }
  } catch {
    /* ignore */
  }
  const c = center();
  const at = ringSpot(2, 9) ?? { x: c.x, y: c.y, z: c.z }; // (not loaded yet: the village's own teleport point)
  try {
    p.teleport(at, { dimension: overworld(), facingLocation: { x: c.x, y: c.y + 1.5, z: c.z } });
  } catch {
    /* ignore */
  }
  try {
    const h = p.getComponent("minecraft:health");
    h?.setCurrentValue(h.effectiveMax);
  } catch {
    /* ignore */
  }
  api.setChakra(p, 1e9); // (clamped to their max)
  try {
    p.addEffect("resistance", first ? 100 : 60, { amplifier: 4, showParticles: false });
  } catch {
    /* ignore */
  }
  api.particle(overworld(), "aegis:smoke_puff", at);
}
export function sendHome(p) {
  let ret;
  try {
    ret = JSON.parse(p.getDynamicProperty(RETURN) ?? "null");
    p.setDynamicProperty(RETURN, undefined);
  } catch {
    ret = null;
  }
  if (!ret) return false;
  try {
    p.teleport({ x: ret.x, y: ret.y, z: ret.z }, { dimension: world.getDimension(ret.dim) });
  } catch {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// The sidebar: the top shinobi and every village's total
// ---------------------------------------------------------------------------
function board() {
  try {
    return world.scoreboard;
  } catch {
    return undefined;
  }
}
function showBoard() {
  const sb = board();
  if (!sb || !war) return;
  let o;
  try {
    o = sb.getObjective(OBJ) ?? sb.addObjective(OBJ, "§4§l⚔ War Merit");
  } catch {
    return;
  }
  const rows = new Map();
  for (const t of villageTotals()) rows.set(`${villageName(t.v)} ⚑`, t.total);
  for (const e of ranking().slice(0, 10)) rows.set(`§f${e.name}`, e.merit);
  try {
    for (const id of o.getParticipants()) if (!rows.has(id.displayName)) o.removeParticipant(id);
  } catch {
    /* ignore */
  }
  for (const [name, v] of rows) {
    try {
      o.setScore(name, Math.max(0, Math.floor(v)));
    } catch {
      /* ignore */
    }
  }
  try {
    if (sb.getObjectiveAtDisplaySlot("Sidebar")?.objective?.id !== OBJ) sb.setObjectiveAtDisplaySlot("Sidebar", { objective: o, sortOrder: 1 });
  } catch {
    /* ignore */
  }
}
function hideBoard() {
  const sb = board();
  if (!sb) return;
  try {
    if (sb.getObjectiveAtDisplaySlot("Sidebar")?.objective?.id === OBJ) sb.clearObjectiveAtDisplaySlot("Sidebar");
  } catch {
    /* ignore */
  }
  try {
    if (sb.getObjective(OBJ)) sb.removeObjective(OBJ);
  } catch {
    /* ignore */
  }
}
function standings() {
  const top = ranking().slice(0, 3);
  if (!top.length) return;
  const vs = villageTotals();
  say(`§6Leading: ${top.map((e, i) => `§f${i + 1}. ${e.name} §6${Math.floor(e.merit)}`).join("§7 · ")}${vs.length ? ` §8| ${vs.map((t) => `${villageName(t.v)} §f${Math.floor(t.total)}`).join(" §7· ")}` : ""}`);
}

// ---------------------------------------------------------------------------
// The battles
// ---------------------------------------------------------------------------
function spawnOne(kind, at, label) {
  let e;
  try {
    e = kind === "juubi" ? overworld().spawnEntity("aegis:juubi", at) : QUEST_TARGETS[kind].spawn(overworld(), at, [EVENT_TAG, WAR_TAG, "aegis_q_war"]);
  } catch {
    return undefined;
  }
  if (!e) return undefined;
  try {
    e.addTag(EVENT_TAG);
    e.addTag(WAR_TAG);
  } catch {
    /* ignore */
  }
  war.enemies.add(e.id);
  if (label) war.labels.set(e.id, label);
  api.particle(overworld(), "aegis:smoke_puff", at);
  api.particle(overworld(), "aegis:cine_bolt", { x: at.x, y: at.y + 1, z: at.z }, [0.9, 0.2, 0.2]);
  return e;
}
function spawnGroup(list) {
  let n = 0;
  for (const [kind, label] of list) {
    const at = ringSpot(22, 34);
    if (at && spawnOne(kind, at, label)) n++;
  }
  return n;
}
const ninjas = (n) => Array.from({ length: n }, () => [NINJA[Math.floor(Math.random() * NINJA.length)]]);

function spawnWave(ev) {
  const n = Math.max(1, fighting().length);
  const list = ninjas(Math.min(16, 4 + 2 * n));
  if (ev.wave === 2) list.push(["zetsu", "§aZetsu"]);
  ev.wave++;
  ev.nextWave = system.currentTick + 60 * 20;
  spawnGroup(list);
  for (const p of fighting()) p.onScreenDisplay?.setActionBar(`§2Wave ${ev.wave}/3 §7— they're coming over the walls!`);
}
function startPhase(i) {
  const ev = war;
  ev.stage = "phase";
  ev.phase = i;
  ev.phaseUntil = system.currentTick + PHASES[i].seconds * 20;
  ev.wave = 0;
  const n = Math.max(1, fighting().length);
  const P = PHASES[i];
  for (const p of fighting()) {
    showTitle(p, `§l${P.title}`, { subtitle: P.sub, fadeInDuration: 4, stayDuration: 50, fadeOutDuration: 12 });
    api.sound(p.dimension, "raid.horn", p.location, 2, i === 3 ? 0.7 : 1);
    api.sound(p.dimension, "ambient.weather.thunder", p.location, 1, 0.8);
  }
  say(`${P.title}§7 — ${P.sub.replace(/§./g, "")}`);
  shake(overworld(), center(), 0.8, 1, 64);
  if (P.id === "zetsu") return spawnWave(ev);
  if (P.id === "edo") {
    const L = shuffle(EDO).slice(0, Math.min(4, 1 + Math.ceil(n / 2)));
    spawnGroup([...L.map((id) => [`legend_${id}`, LEGENDS[id]?.name]), ...ninjas(Math.min(10, 2 + n))]);
    return undefined;
  }
  if (P.id === "akatsuki") {
    const A = shuffle(CLOAKS).slice(0, Math.min(5, 2 + Math.floor(n / 2)));
    spawnGroup([...A.map((id) => [id]), ...ninjas(Math.min(10, 2 + n))]);
    return undefined;
  }
  // the final battle
  const at = ringSpot(18, 26);
  const madara = at && spawnOne("legend_madara", at, LEGENDS.madara?.name);
  ev.madara = madara?.id;
  if (n >= 4) {
    const jt = ringSpot(26, 34);
    if (jt) spawnOne("juubi", jt, "§5the Ten-Tails");
  }
  spawnGroup(ninjas(Math.min(12, 4 + n)));
  for (const p of fighting()) showTitle(p, "§4§lMADARA UCHIHA", { subtitle: `§7has entered the battlefield${n >= 4 ? " — with the Ten-Tails" : ""}`, fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 12 });
  return undefined;
}
function alive(ev) {
  for (const id of [...ev.enemies]) {
    const e = world.getEntity(id);
    if (!e || !api.isValid(e)) ev.enemies.delete(id);
  }
  return ev.enemies.size;
}
function phaseCleared(ev) {
  const P = PHASES[ev.phase];
  for (const p of fighting()) {
    addMerit(p, MERIT.phase, "battle won");
    showTitle(p, "§a§lBATTLE WON", { subtitle: `§7${P.title.replace(/§./g, "")} · +${MERIT.phase} War Merit`, fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
    api.sound(p.dimension, "random.levelup", p.location, 1, 1.2);
  }
  if (ev.phase === PHASES.length - 1) return results(ev, true);
  say(`§aThe ${P.title.replace(/§./g, "").replace(/^Battle \d — /, "")} is beaten!§7 The next battle starts in ${BREAK} seconds.`);
  standings();
  ev.stage = "break";
  ev.breakUntil = system.currentTick + BREAK * 20;
  return undefined;
}
function phaseTimeout(ev) {
  for (const id of [...ev.enemies]) {
    const e = world.getEntity(id);
    if (!e) continue;
    try {
      api.particle(e.dimension, "aegis:smoke_puff", e.location);
      e.remove();
    } catch {
      /* ignore */
    }
  }
  ev.enemies.clear();
  if (ev.phase === PHASES.length - 1) return results(ev, false);
  say(`§7Time's up — the enemy pulls back into the smoke. The next battle starts in ${BREAK} seconds.`);
  standings();
  ev.stage = "break";
  ev.breakUntil = system.currentTick + BREAK * 20;
  return undefined;
}

// ---------------------------------------------------------------------------
// The end
// ---------------------------------------------------------------------------
function give(p, id, n) {
  if (n <= 0) return;
  let left = new ItemStack(id, n);
  try {
    left = p.getComponent("minecraft:inventory")?.container?.addItem(left);
  } catch {
    /* drop it */
  }
  if (left) {
    try {
      p.dimension.spawnItem(left, p.location);
    } catch {
      /* ignore */
    }
  }
}
export const meritPay = (merit) => questRyo(Math.min(30000, Math.floor(merit) * 25));
function results(ev, victory) {
  ev.stage = "results";
  ev.victory = victory;
  ev.homeAt = system.currentTick + 15 * 20;
  for (const id of [...ev.enemies]) {
    try {
      world.getEntity(id)?.remove();
    } catch {
      /* ignore */
    }
  }
  ev.enemies.clear();
  const ranked = ranking();
  const villages = villageTotals();
  const winner = villages[0] && villages[0].total > 0 && villages[0].v !== "rogue" ? villages[0].v : undefined;
  say(victory ? "§a§lVICTORY! §r§7Madara has fallen — the Allied Shinobi Forces win the Great Shinobi War!" : "§7§lThe war is over. §r§7Madara withdraws into the smoke… no one wins this one.");
  if (ev.hero) say(`§6§lHero of the War: §r§f${ev.hero}§6 — the final blow on Madara!`);
  if (ranked.length) say(`§6Top shinobi: ${ranked.slice(0, 3).map((e, i) => `${["§6#1", "§7#2", "§c#3"][i]} §f${e.name} §6${Math.floor(e.merit)}`).join("§7 · ")}`);
  if (winner) say(`§6The war is won by the ${villageName(winner)}§6 — +500 honor to each of its fighters!`);
  ranked.forEach((e, i) => {
    const p = online(e.id);
    if (!p) return;
    const pay = meritPay(e.merit);
    const prize = e.merit > 0 ? RANK_PRIZES[i] : undefined;
    const ryo = pay + (prize ? questRyo(prize[0]) : 0);
    if (ryo) addRyo(p, ryo, true);
    if (prize) {
      giveShards(p, prize[1]);
      give(p, MYSTERY, prize[2]);
    }
    if (winner && e.village === winner) addHonor(p, 500);
    bumpAch(p, "events");
    bumpFun(p, "wars");
    bumpFun(p, "warBest", Math.floor(e.merit), true);
    if (i === 0 && e.merit > 0) bumpFun(p, "warWins");
    showTitle(p, victory ? "§a§lVICTORY!" : "§7§lThe war is over", { subtitle: `§fYou placed §6#${i + 1}§f with §6${Math.floor(e.merit)} War Merit`, fadeInDuration: 4, stayDuration: 80, fadeOutDuration: 16 });
    p.sendMessage(`§6Your war: §f#${i + 1} of ${ranked.length}, ${Math.floor(e.merit)} War Merit§6 — §f+${fmtRyo(ryo)}${prize ? `, ${prize[1]} XP Shards, ${prize[2]} Mystery Scroll${prize[2] > 1 ? "s" : ""}` : ""}${winner && e.village === winner ? ", +500 honor" : ""}§6. Home in 15 seconds.`);
    api.sound(p.dimension, victory ? "random.totem" : "random.levelup", p.location, 0.8, 1);
  });
  try {
    overworld().setWeather?.("Clear", 20 * 60 * 10);
  } catch {
    /* ignore */
  }
  return undefined;
}
function finish(ev) {
  for (const p of world.getAllPlayers()) if (ev.merit.has(p.id)) sendHome(p);
  for (const id of [...ev.enemies]) {
    try {
      world.getEntity(id)?.remove();
    } catch {
      /* ignore */
    }
  }
  hideBoard();
  if (war === ev) war = undefined;
  releaseEvent(ev);
}

// ---------------------------------------------------------------------------
// The clock (events.js calls it every second)
// ---------------------------------------------------------------------------
function tick(ev) {
  const now = system.currentTick;
  if (ev.stage === "muster") {
    const left = Math.ceil((ev.summonAt - now) / 20);
    if ([10, 5, 3, 2, 1].includes(left)) {
      for (const p of world.getAllPlayers()) {
        showTitle(p, `§4§l${left}`, { subtitle: "§7…until the summons to the Hidden Leaf", fadeInDuration: 0, stayDuration: 16, fadeOutDuration: 4 });
        api.sound(p.dimension, "note.pling", p.location, 1, left <= 3 ? 1.4 : 1);
      }
    }
    if (now < ev.summonAt) return;
    for (const p of world.getAllPlayers()) summon(p);
    for (const p of fighting()) {
      showTitle(p, "§4§l⚔ THE GREAT SHINOBI WAR ⚔", { subtitle: "§7every shinobi fights for the Hidden Leaf — earn War Merit!", fadeInDuration: 4, stayDuration: 70, fadeOutDuration: 14 });
      api.sound(p.dimension, "raid.horn", p.location, 2, 0.8);
    }
    try {
      overworld().setWeather?.("Thunder", 20 * 60 * 25);
    } catch {
      /* ignore */
    }
    say(`§7${fighting().length} shinobi stand at the Hidden Leaf. The first battle begins in ${READY} seconds!`);
    ev.stage = "ready";
    ev.readyUntil = now + READY * 20;
    showBoard();
    return;
  }
  if (ev.stage === "ready") {
    if (now >= ev.readyUntil) startPhase(0);
    return showBoard();
  }
  if (ev.stage === "break") {
    if (now >= ev.breakUntil) startPhase(ev.phase + 1);
    return showBoard();
  }
  if (ev.stage === "results") {
    if (now >= ev.homeAt) {
      say("§7The war is over — everyone is going home.");
      finish(ev);
    }
    return undefined;
  }
  // a battle
  const P = PHASES[ev.phase];
  const left = alive(ev);
  if (P.id === "zetsu" && ev.wave < 3 && (now >= ev.nextWave || left === 0)) spawnWave(ev);
  else if (left === 0 && (P.id !== "zetsu" || ev.wave >= 3)) phaseCleared(ev);
  else if (now >= ev.phaseUntil) phaseTimeout(ev);
  if (!war || ev.stage === "results") return undefined;
  // who's in front?
  const lead = ranking()[0];
  if (lead && lead.merit > 0 && lead.id !== ev.leader && now >= (ev.leadAnnounced ?? 0)) {
    ev.leader = lead.id;
    ev.leadAnnounced = now + 200;
    say(`§6${lead.name}§7 takes the lead with §6${Math.floor(lead.merit)}§7 War Merit!`);
  }
  if (now >= (ev.nextStandings ?? 0)) {
    ev.nextStandings = now + 1200;
    if (now > ev.start + 1200) standings();
  }
  return showBoard();
}
function stop(ev, quiet) {
  if (!quiet) say("§7The war has been called off — everyone is going home.");
  finish(ev);
}

// Declares war. Returns an error for the admin, or undefined.
export function startWar(by) {
  if (war || currentEvent()) return `§7An event is already running: ${currentEvent()?.label ?? "the war"}.`;
  if (!world.getAllPlayers().length) return "§7Nobody is online.";
  const now = system.currentTick;
  const ev = { kind: "war", label: "Great Shinobi War", stage: "muster", start: now, summonAt: now + MUSTER * 20, phase: -1, merit: new Map(),
    enemies: new Set(), labels: new Map(), participants: new Set(), until: Date.now() + 30 * 60000, tick, stop };
  if (!claimEvent(ev)) return "§7An event is already running.";
  war = ev;
  say(`§4§l⚔ THE GREAT SHINOBI WAR ⚔§r§7 has been declared${by?.name ? ` by §f${by.name}` : ""}! In ${MUSTER} seconds every shinobi will be summoned to the §aHidden Leaf§7. Four battles, one leaderboard: earn §6War Merit§7 for the biggest prizes — and win it for your village.`);
  for (const p of world.getAllPlayers()) {
    showTitle(p, "§4§l⚔ WAR ⚔", { subtitle: `§7summoned to the Hidden Leaf in ${MUSTER} seconds — get ready!`, fadeInDuration: 4, stayDuration: 60, fadeOutDuration: 12 });
    api.sound(p.dimension, "raid.horn", p.location, 2, 1);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function initWar(helpers) {
  api = helpers;
  world.afterEvents.entityDie.subscribe(({ deadEntity: e, damageSource }) => {
    if (!war || !e) return;
    try {
      if (e.typeId === "minecraft:player") {
        if (!war.merit.has(e.id) || war.stage === "muster") return;
        addMerit(e, MERIT.death, "you fell");
        const k = ownerOf(damageSource?.damagingEntity);
        if (k && k.id !== e.id && war.merit.has(k.id) && entry(k).village !== entry(e).village) {
          addMerit(k, MERIT.pvp, `defeated ${e.name}`);
          say(`§c${k.name}§7 defeated §f${e.name}§7 of the ${villageName(entry(e).village)}§7! §6(+${MERIT.pvp})`);
        }
        return;
      }
      if (!war.enemies.has(e.id)) return;
      war.enemies.delete(e.id);
      const p = ownerOf(damageSource?.damagingEntity);
      if (!p || !war.merit.has(p.id)) return;
      const kind = e.typeId === "aegis:juubi" ? "juubi" : e.typeId === "aegis:legend" ? "legend" : e.typeId === "aegis:akatsuki" ? "akatsuki" : "ninja";
      const name = war.labels.get(e.id) ?? (e.nameTag || "an enemy ninja");
      addMerit(p, MERIT[kind], kind === "ninja" ? "enemy ninja" : name.replace(/§./g, ""));
      if (kind !== "ninja") say(`§6${p.name}§7 defeated ${name}§7! §6(+${MERIT[kind]})`);
      if (e.id === war.madara) {
        war.hero = p.name;
        addMerit(p, MERIT.hero, "the final blow on Madara");
        for (const q of fighting()) showTitle(q, "§6§lMADARA HAS FALLEN", { subtitle: `§f${p.name}§7 struck the final blow!`, fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 12 });
      }
    } catch {
      /* ignore */
    }
  });
  // every 1% of a boss's health you deal: +1 War Merit
  world.afterEvents.entityHurt.subscribe(({ hurtEntity: e, damage, damageSource }) => {
    if (!war || damage <= 0 || !war.enemies.has(e?.id) || !BOSSES.has(e.typeId)) return;
    const p = ownerOf(damageSource?.damagingEntity);
    if (!p || !war.merit.has(p.id)) return;
    let max = 1000;
    try {
      max = e.getComponent("minecraft:health")?.effectiveMax ?? max;
    } catch {
      /* ignore */
    }
    const en = entry(p);
    en.dmg += (Math.min(damage, max) / max) * 100;
    if (en.dmg >= 1) {
      const whole = Math.floor(en.dmg);
      en.dmg -= whole;
      en.merit += whole;
    }
  });
  // back into the fight after falling; summoned on joining mid-war; sent home if they left before it ended
  world.afterEvents.playerSpawn.subscribe(({ player: p, initialSpawn }) => {
    system.runTimeout(() => {
      if (!api.isValid(p)) return;
      if (war && war.stage !== "muster" && war.stage !== "results") {
        if (!war.merit.has(p.id)) {
          summon(p, true);
          p.sendMessage("§4The Great Shinobi War is raging§7 — you've been summoned to the Hidden Leaf. Earn War Merit!");
        } else if (!initialSpawn) summon(p, false);
      } else if (!war) {
        try {
          if (p.getDynamicProperty(RETURN) !== undefined && sendHome(p)) p.sendMessage("§7The war ended while you were away — you've been sent back to where you were.");
        } catch {
          /* ignore */
        }
      }
    }, 20);
  });
}
