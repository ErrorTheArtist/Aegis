// World events (v1.55) — started by an admin (or, if switched on, now and then by themselves).
//   Village Raid    — three waves of enemy ninja attack a village (an Akatsuki member leads the last). Defend it and
//                     everyone who took part gets 5,000 Ryō, 2 XP Shards and 200 village honor. 10 minutes.
//   Wanted          — a legendary shinobi appears out in the world, already fighting, and its position is announced.
//                     Whoever brings it down gets 20,000 Ryō and 3 XP Shards on top of its drops (everyone who hit it,
//                     5,000). 15 minutes.
//   Hidden Scrolls  — eight sealed scrolls are hidden around a village, each marked by a pillar of light. Open one
//                     (right-click) for Ryō, an XP Shard, a jutsu scroll — or, rarely, a Bloodline Reroll Scroll.
//   Double XP       — all XP is doubled for a while.
// One event at a time (Double XP can run alongside). The automatic schedule is OFF by default.
//   /scriptevent aegis:event                         — what's running
//   /scriptevent aegis:event raid [village]          — leaf | sand | mist | cloud | stone | rain (default: the nearest)
//   /scriptevent aegis:event wanted [legend]         — e.g. wanted kakashi (default: a random legend), near you
//   /scriptevent aegis:event scrolls [village]
//   /scriptevent aegis:event doublexp [minutes]      — default 30
//   /scriptevent aegis:event stop                    — end the current event
//   /scriptevent aegis:event auto on | off           — a random event every hour while 2+ players are online

import { world, system, ItemStack } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { addRyo, fmtRyo } from "./currency.js";
import { VILLAGES, addHonor } from "./villages.js";
import { QUEST_TARGETS } from "./quests.js";
import { LEGENDS } from "./legends.js";
import { giveShards } from "./xpshards.js";
import { bumpAch } from "./achievements.js";

export const HIDDEN_SCROLL = "aegis:hidden_scroll";
const XP_PROP = "aegis:xp_event_until";
const AUTO_PROP = "aegis:events_auto";
const TAG = "aegis_event";
const RAID_MINUTES = 10;
const WANTED_MINUTES = 15;
const SCROLL_MINUTES = 20;
const RAID_WAVES = [
  [["rogue", 4]],
  [["sound", 4], ["anbu", 2]],
  [["anbu", 3], ["akatsuki", 1]],
];
const RAID_LEGENDS = () => Object.keys(LEGENDS).filter((id) => !["madara", "hashirama", "obito", "kaguya"].includes(id));
const SCROLL_PRIZES = ["aegis:fireball_scroll", "aegis:water_dragon_scroll", "aegis:wind_scroll", "aegis:chidori_scroll", "aegis:earth_wall_scroll",
  "aegis:clone_scroll", "aegis:sphere_scroll", "aegis:gale_palm_scroll", "aegis:mud_river_scroll", "aegis:shadow_snakes_scroll", "aegis:raikiri_scroll",
  "aegis:toad_oil_scroll", "aegis:tree_binding_scroll", "aegis:morning_peacock_scroll", "aegis:great_waterfall_scroll"];

let api;
let current; // { kind, label, dim, center, until, participants: Set, ... }

export const eventXpMultiplier = () => ((world.getDynamicProperty(XP_PROP) ?? 0) > Date.now() ? 2 : 1);
export const currentEvent = () => current;

const say = (t) => world.sendMessage(`§8[§6Event§8] ${t}`);
const mins = (ms) => Math.max(0, Math.ceil(ms / 60000));

function nearestVillage(pos) {
  let best;
  let bd = Infinity;
  for (const [id, v] of Object.entries(VILLAGES)) {
    const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

const playersNear = (dim, pos, r) => {
  try {
    return dim.getPlayers({ location: pos, maxDistance: r });
  } catch {
    return [];
  }
};

// A spot on the ground about `r` blocks from `c` (tries a few angles), or undefined.
function groundSpot(dim, c, r) {
  for (let k = 0; k < 8; k++) {
    const a = Math.random() * Math.PI * 2;
    const x = c.x + Math.cos(a) * r;
    const z = c.z + Math.sin(a) * r;
    const y = api.surfaceY(dim, { x, y: c.y, z });
    if (y !== undefined) return { x, y, z };
  }
  return undefined;
}

function reward(p, ryo, shards, honor) {
  if (ryo) addRyo(p, ryo, true);
  if (shards) giveShards(p, shards);
  if (honor) addHonor(p, honor);
  bumpAch(p, "events");
}

function cleanup() {
  for (const name of ["overworld", "nether", "the_end"]) {
    try {
      for (const e of world.getDimension(name).getEntities({ tags: [TAG] })) e.remove();
    } catch {
      /* ignore */
    }
  }
}

export function stopEvent(quiet = false) {
  if (!current) return false;
  if (!quiet) say(`§7The ${current.label} is over.`);
  cleanup();
  current = undefined;
  return true;
}

// ---------------------------------------------------------------------------
// Village Raid
// ---------------------------------------------------------------------------
function spawnWave(ev) {
  const wave = RAID_WAVES[ev.wave];
  const extra = Math.min(4, Math.max(0, playersNear(ev.dim, ev.center, 96).length - 1));
  let n = 0;
  for (const [kind, count] of wave) {
    for (let i = 0; i < count + (kind === "akatsuki" ? 0 : Math.ceil(extra / wave.length)); i++) {
      const at = groundSpot(ev.dim, ev.center, 22 + Math.random() * 10);
      if (!at) continue;
      try {
        const e = QUEST_TARGETS[kind].spawn(ev.dim, at, [TAG]);
        e?.addTag(TAG);
        api.particle(ev.dim, "aegis:smoke_puff", at);
        n++;
      } catch {
        /* unloaded */
      }
    }
  }
  ev.spawned += n;
  say(`§cRaid on the ${VILLAGES[ev.village].name}§7 — wave §f${ev.wave + 1}/${RAID_WAVES.length}§7: §f${n}§7 enemies!`);
  for (const p of playersNear(ev.dim, ev.center, 96)) showTitle(p, `§cWave ${ev.wave + 1}`, { subtitle: `§7${n} enemies attack the village!`, fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
}

export function startRaid(village) {
  if (current) return `§7An event is already running: ${current.label}.`;
  const V = VILLAGES[village];
  if (!V) return "§7Unknown village.";
  const dim = world.getDimension("overworld");
  const center = { ...V.pos };
  if (!playersNear(dim, center, 96).length) return `§7Nobody is near the ${V.name} — a raid needs defenders (and loaded chunks).`;
  current = { kind: "raid", label: `raid on the ${V.name}`, village, dim, center, wave: 0, spawned: 0, until: Date.now() + RAID_MINUTES * 60000,
    participants: new Set(), next: system.currentTick + 200 };
  say(`§c§lThe ${V.name} is under attack!§r§7 Enemy ninja are closing in — defend the village! (${RAID_MINUTES} minutes)`);
  for (const p of world.getAllPlayers()) showTitle(p, `§c${V.name}`, { subtitle: "§7is under attack!", fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
  return undefined;
}

function raidTick(ev) {
  for (const p of playersNear(ev.dim, ev.center, 64)) ev.participants.add(p.id);
  if (system.currentTick < ev.next) return;
  let left = 0;
  try {
    left = ev.dim.getEntities({ tags: [TAG] }).length;
  } catch {
    left = 0;
  }
  for (const p of playersNear(ev.dim, ev.center, 96)) {
    p.onScreenDisplay?.setActionBar(`§cRaid on the ${VILLAGES[ev.village].name}§7 — wave ${Math.min(ev.wave + 1, RAID_WAVES.length)}/${RAID_WAVES.length} · §f${left}§7 enemies left · §f${mins(ev.until - Date.now())} min`);
  }
  if (ev.spawned === 0 || left === 0) {
    if (ev.spawned > 0 && ev.wave >= RAID_WAVES.length - 1) return finishRaid(ev, true);
    if (ev.spawned > 0) ev.wave++;
    spawnWave(ev);
  }
  if (Date.now() > ev.until) return finishRaid(ev, false);
  ev.next = system.currentTick + 40;
}

function finishRaid(ev, won) {
  const V = VILLAGES[ev.village];
  current = undefined;
  if (!won) {
    cleanup();
    return say(`§7The raiders withdraw from the ${V.name}. They'll be back…`);
  }
  const heroes = world.getAllPlayers().filter((p) => ev.participants.has(p.id));
  for (const p of heroes) {
    reward(p, 5000, 2, 200);
    showTitle(p, "§aThe village is safe!", { subtitle: `§f+${fmtRyo(5000)} · 2 XP Shards · 200 honor`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
  }
  say(`§a§lThe ${V.name} held!§r§7 Thanks to ${heroes.length ? heroes.map((p) => `§f${p.name}`).join("§7, ") : "its shinobi"}§7.`);
}

// ---------------------------------------------------------------------------
// Wanted: a roaming legend
// ---------------------------------------------------------------------------
export function startWanted(near, id) {
  if (current) return `§7An event is already running: ${current.label}.`;
  const pool = RAID_LEGENDS();
  const who = id && LEGENDS[id] ? id : pool[Math.floor(Math.random() * pool.length)];
  const dim = near.dimension;
  const at = groundSpot(dim, near.location, 30) ?? groundSpot(dim, near.location, 15);
  if (!at) return "§7Couldn't find open ground nearby — try somewhere flatter.";
  let boss;
  try {
    boss = QUEST_TARGETS[`legend_${who}`].spawn(dim, at, [TAG, "aegis_q_event"]);
    boss?.addTag(TAG);
  } catch {
    boss = undefined;
  }
  if (!boss) return "§7The legend couldn't appear there.";
  current = { kind: "wanted", label: `hunt for ${LEGENDS[who].name.replace(/§./g, "")}`, legend: who, dim, center: at, boss: boss.id,
    until: Date.now() + WANTED_MINUTES * 60000, participants: new Set() };
  say(`§4§lWANTED:§r ${LEGENDS[who].name}§7 has been sighted near §f${Math.round(at.x)}, ${Math.round(at.z)}§7! Bring them down: §6${fmtRyo(20000)}§7 and 3 XP Shards. (${WANTED_MINUTES} minutes)`);
  return undefined;
}

function wantedTick(ev) {
  if (Date.now() > ev.until) {
    say(`§7${LEGENDS[ev.legend].name}§7 has slipped away.`);
    return stopEvent(true);
  }
}

// ---------------------------------------------------------------------------
// Hidden Scrolls
// ---------------------------------------------------------------------------
export function startScrolls(village) {
  if (current) return `§7An event is already running: ${current.label}.`;
  const V = VILLAGES[village];
  if (!V) return "§7Unknown village.";
  const dim = world.getDimension("overworld");
  if (!playersNear(dim, V.pos, 128).length) return `§7Nobody is near the ${V.name} — the scrolls need searchers (and loaded chunks).`;
  const spots = [];
  for (let i = 0; i < 8; i++) {
    const at = groundSpot(dim, V.pos, 15 + Math.random() * 45);
    if (!at) continue;
    try {
      const it = dim.spawnItem(new ItemStack(HIDDEN_SCROLL, 1), { x: at.x, y: at.y + 0.2, z: at.z });
      it?.addTag(TAG);
      spots.push({ ...at, id: it?.id });
    } catch {
      /* unloaded */
    }
  }
  if (!spots.length) return "§7Couldn't hide any scrolls there.";
  current = { kind: "scrolls", label: `hunt for the hidden scrolls of the ${V.name}`, village, dim, center: { ...V.pos }, spots, found: 0,
    until: Date.now() + SCROLL_MINUTES * 60000, participants: new Set() };
  say(`§e§lHidden Scrolls!§r§7 ${spots.length} sealed scrolls are hidden around the §f${V.name}§7 — follow the pillars of light. (${SCROLL_MINUTES} minutes)`);
  return undefined;
}

function scrollsTick(ev) {
  if (Date.now() > ev.until) {
    say("§7The last hidden scrolls crumble to dust.");
    return stopEvent(true);
  }
  for (const s of ev.spots) {
    if (s.taken) continue;
    const e = s.id ? world.getEntity(s.id) : undefined;
    if (!e || !api.isValid(e)) {
      s.taken = true;
      continue;
    }
    api.particle(ev.dim, "aegis:cine_pillar", e.location, [1, 0.85, 0.3]);
  }
  if (ev.spots.every((s) => s.taken) && ev.found >= ev.spots.length) {
    say("§aEvery hidden scroll has been found!");
    current = undefined;
  }
}

// Opening one (right-click).
export function openHiddenScroll(p) {
  let msg;
  const r = Math.random();
  if (r < 0.05) {
    p.dimension.spawnItem(new ItemStack("aegis:reroll_scroll", 1), p.location);
    msg = "§d§la Bloodline Reroll Scroll!";
  } else if (r < 0.35) {
    const id = SCROLL_PRIZES[Math.floor(Math.random() * SCROLL_PRIZES.length)];
    p.dimension.spawnItem(new ItemStack(id, 1), p.location);
    msg = `§ba jutsu scroll: §f${id.replace("aegis:", "").replace(/_scroll$/, "").replace(/_/g, " ")}`;
  } else if (r < 0.6) {
    giveShards(p, 1);
    msg = "§aan XP Shard";
  } else {
    const ryo = 2000 + Math.floor(Math.random() * 4001);
    addRyo(p, ryo, true);
    msg = `§6${fmtRyo(ryo)}`;
  }
  p.sendMessage(`§eThe seal breaks… inside: ${msg}`);
  api.sound(p.dimension, "random.levelup", p.location, 0.6, 1.5);
  if (current?.kind === "scrolls") {
    current.found++;
    if (!current.participants.has(p.id)) {
      current.participants.add(p.id);
      bumpAch(p, "events");
    }
  }
}

// ---------------------------------------------------------------------------
// Double XP
// ---------------------------------------------------------------------------
export function startDoubleXp(minutes) {
  const m = Math.max(1, Math.min(240, Math.floor(minutes) || 30));
  world.setDynamicProperty(XP_PROP, Date.now() + m * 60000);
  say(`§b§lDouble XP!§r§7 Every bit of XP counts twice for the next §f${m} minutes§7.`);
  for (const p of world.getAllPlayers()) showTitle(p, "§bDouble XP!", { subtitle: `§7for ${m} minutes`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function autoEvent() {
  const players = world.getAllPlayers();
  if (current || players.length < 2) return;
  const p = players[Math.floor(Math.random() * players.length)];
  const village = nearestVillage(p.location);
  const r = Math.random();
  if (r < 0.3) startRaid(village);
  else if (r < 0.6) startWanted(p);
  else if (r < 0.85) startScrolls(village);
  else startDoubleXp(20);
}

export function initEvents(helpers) {
  api = helpers;
  system.runTimeout(cleanup, 60); // leftovers from before a restart
  system.runInterval(() => {
    if (!current) return;
    try {
      if (current.kind === "raid") raidTick(current);
      else if (current.kind === "wanted") wantedTick(current);
      else if (current.kind === "scrolls") scrollsTick(current);
    } catch {
      /* ignore */
    }
  }, 20);
  // the hourly automatic event (off unless an admin switches it on)
  system.runInterval(() => {
    if (world.getDynamicProperty(AUTO_PROP)) autoEvent();
  }, 72000);

  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    if (!current || !hurtEntity?.hasTag?.(TAG)) return;
    let p = damageSource?.damagingEntity;
    if (p && p.typeId !== "minecraft:player") {
      try {
        p = world.getEntity(p.getDynamicProperty("aegis:owner"));
      } catch {
        p = undefined;
      }
    }
    if (p?.typeId === "minecraft:player") current.participants.add(p.id);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (current?.kind !== "wanted" || deadEntity?.id !== current.boss) return;
    const ev = current;
    current = undefined;
    let killer = damageSource?.damagingEntity;
    if (killer && killer.typeId !== "minecraft:player") {
      try {
        killer = world.getEntity(killer.getDynamicProperty("aegis:owner"));
      } catch {
        killer = undefined;
      }
    }
    for (const p of world.getAllPlayers()) {
      if (killer?.id === p.id) {
        reward(p, 20000, 3, 0);
        p.sendMessage(`§6You brought down ${LEGENDS[ev.legend].name}§6! §f+${fmtRyo(20000)}, 3 XP Shards`);
      } else if (ev.participants.has(p.id)) {
        reward(p, 5000, 0, 0);
        p.sendMessage(`§6The hunt is over — for your part: §f+${fmtRyo(5000)}`);
      }
    }
    say(`§a${LEGENDS[ev.legend].name}§a has been defeated${killer?.typeId === "minecraft:player" ? ` by §f${killer.name}` : ""}§a!`);
  });
  world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
    if (itemStack?.typeId !== HIDDEN_SCROLL || p?.typeId !== "minecraft:player") return;
    try {
      const inv = p.getComponent("minecraft:inventory")?.container;
      const it = inv?.getItem(p.selectedSlotIndex);
      if (it?.typeId === HIDDEN_SCROLL) {
        if (it.amount > 1) {
          it.amount -= 1;
          inv.setItem(p.selectedSlotIndex, it);
        } else inv.setItem(p.selectedSlotIndex, undefined);
      }
    } catch {
      /* ignore */
    }
    openHiddenScroll(p);
  });

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: by }) => {
    if (id !== "aegis:event") return;
    const tell = (t) => (by?.typeId === "minecraft:player" ? by.sendMessage(t) : world.sendMessage(t));
    const [cmd, arg] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    const at = by?.location ?? VILLAGES.leaf.pos;
    let err;
    if (cmd === "raid") err = startRaid(arg || nearestVillage(at));
    else if (cmd === "scrolls") err = startScrolls(arg || nearestVillage(at));
    else if (cmd === "wanted") err = by?.typeId === "minecraft:player" ? startWanted(by, arg) : "§7Run it as a player (the legend appears near you).";
    else if (cmd === "doublexp") startDoubleXp(Number(arg) || 30);
    else if (cmd === "stop") err = stopEvent() ? undefined : "§7No event is running.";
    else if (cmd === "auto") {
      world.setDynamicProperty(AUTO_PROP, arg === "on" ? true : undefined);
      err = arg === "on" ? "§7Automatic events: §aon§7 (a random event every hour while 2+ players are online)." : "§7Automatic events: §coff§7.";
    } else {
      const xp = (world.getDynamicProperty(XP_PROP) ?? 0) - Date.now();
      err = `§7Event: ${current ? `§f${current.label}§7 (${mins(current.until - Date.now())} min left)` : "§8none"}§7 · Double XP: ${xp > 0 ? `§b${mins(xp)} min left` : "§8off"}§7 · automatic: ${world.getDynamicProperty(AUTO_PROP) ? "§aon" : "§coff"}`;
    }
    if (err) tell(err);
  });
}
