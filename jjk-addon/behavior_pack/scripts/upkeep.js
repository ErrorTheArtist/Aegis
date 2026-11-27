// Server upkeep: the jobs an admin would otherwise do by hand. On by default; each can be switched off (Admin Panel ->
// Server automation, or /scriptevent jjk:auto <clears|board|events> off).
//   clears   every 10 minutes, dropped items and arrows that have lain on the ground for 2 minutes are cleared (chat
//            warns 30 s and 10 s before), so the server stays light.
//   board    the sidebar ranks everyone who has played here by XP: the Top Sorcerers.
//   events   a server event every 30 minutes (announced a minute before), in turn:
//     Curse Outbreak       for 3 minutes curses pour out around every sorcerer and exorcisms give 1.5x XP; the top
//                          exorcist wins a Cursed Womb.
//     Special Grade Hunt   a Finger Bearer appears near a Grade 2+ sorcerer, announced with where it is; whoever
//                          exorcises it takes one of Sukuna's Fingers.
//     Villain Raid         a villain comes for a Grade 1+ sorcerer.
//   Nobody in the sanctuary is ever picked. An event with nobody to happen to becomes an outbreak, or waits 5 minutes.

import * as MC from "@minecraft/server"; // (a namespace import: a name missing from the game's API can't stop the pack loading)
const { world, system } = MC;
import { now, worldProp, setWorldProp, getProp, isSafe, alive, title, give } from "./core.js";
import { xpOf, gradeOf, G } from "./grades.js";
import { statusHooks } from "./energy.js";
import { spawnAround, cursesNear, spawnFingerBearer, deathHooks, xpHooks, CURSE_XP } from "./curses.js";
import { villainNight } from "./sorcerers.js";
import { on } from "./server.js";

const DIMS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const say = (text) => {
  try {
    world.sendMessage(`§8[§5Server§8] §7${text}`);
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// Dropped-item clears
// ---------------------------------------------------------------------------
export const CLEAR_EVERY = 12000; // 10 min
export const CLEAR_AGE = 2400; // lying there 2 min
const born = new Map(); // item / arrow id -> tick it appeared
const clearState = { next: -1, warned: 0 };
export function clearItems(all = false) {
  let n = 0;
  for (const id of DIMS) {
    let list = [];
    try {
      const dim = world.getDimension(id);
      list = [...dim.getEntities({ type: "minecraft:item" }), ...dim.getEntities({ type: "minecraft:arrow" })];
    } catch {
      continue;
    }
    for (const e of list) {
      if (!all && now() - (born.get(e.id) ?? -1e9) < CLEAR_AGE) continue;
      try {
        e.remove();
        n++;
      } catch {
        /* gone */
      }
      born.delete(e.id);
    }
  }
  say(n ? `Cleared §f${n}§7 dropped item${n === 1 ? "" : "s"}.` : "No dropped items to clear.");
  return n;
}
function clearTick() {
  if (clearState.next < 0 || !on("clears")) {
    clearState.next = now() + CLEAR_EVERY;
    clearState.warned = 0;
    return;
  }
  const left = clearState.next - now();
  if (left <= 600 && clearState.warned < 1) {
    clearState.warned = 1;
    say("Dropped items will be cleared in §f30s§7.");
  } else if (left <= 200 && clearState.warned < 2) {
    clearState.warned = 2;
    say("Dropped items will be cleared in §f10s§7.");
  }
  if (left > 0) return;
  clearItems();
  clearState.next = now() + CLEAR_EVERY;
  clearState.warned = 0;
}

// ---------------------------------------------------------------------------
// Top Sorcerers
// ---------------------------------------------------------------------------
const OBJ = "jjk_top";
const SIDEBAR = MC.DisplaySlotId?.Sidebar ?? "Sidebar";
const DESCENDING = MC.ObjectiveSortOrder?.Descending ?? 1;
function objective() {
  try {
    const sb = world.scoreboard;
    return sb.getObjective(OBJ) ?? sb.addObjective(OBJ, "§5§lTop Sorcerers");
  } catch {
    return undefined;
  }
}
function boardTick() {
  const sb = world.scoreboard;
  const o = objective();
  if (!o) return;
  try {
    const shown = sb.getObjectiveAtDisplaySlot(SIDEBAR)?.objective?.id === OBJ;
    if (!on("board")) {
      if (shown) sb.clearObjectiveAtDisplaySlot(SIDEBAR);
      return;
    }
    for (const p of world.getAllPlayers()) if (getProp(p, "technique")) o.setScore(p.name, Math.min(2e9, xpOf(p)));
    if (!shown) sb.setObjectiveAtDisplaySlot(SIDEBAR, { objective: o, sortOrder: DESCENDING });
  } catch {
    /* ignore */
  }
}
// [[name, xp]] best first (everyone who has played here, online or not)
export function topSorcerers(n = 5) {
  try {
    return objective().getScores().map((s) => [s.participant.displayName, s.score]).sort((a, b) => b[1] - a[1]).slice(0, n);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Server events
// ---------------------------------------------------------------------------
export const EVENTS = { outbreak: "Curse Outbreak", hunt: "Special Grade Hunt", raid: "Villain Raid" };
const ORDER = ["outbreak", "hunt", "raid"];
export const OUTBREAK_TICKS = 3600; // 3 min
const evState = { next: -1, warned: false, turn: 0, kind: null, until: 0, wave: 0, kills: new Map() };
const every = () => Math.max(10, Math.min(240, Number(worldProp("events_every", 30)) || 30)) * 1200;
// whoever an event may happen to: awakened, alive, in the overworld, not in the sanctuary
export function eligible(minGrade = 0) {
  return world.getAllPlayers().filter((p) => alive(p) && getProp(p, "technique") && p.dimension?.id === "minecraft:overworld" && !isSafe(p)
    && gradeOf(p) >= minGrade);
}

function startOutbreak() {
  if (!eligible().length) return false;
  Object.assign(evState, { kind: "outbreak", until: now() + OUTBREAK_TICKS, wave: -1e9, kills: new Map() });
  try {
    world.sendMessage("§4✦ CURSE OUTBREAK! §fFor 3 minutes curses pour out around every sorcerer. Exorcisms give §a1.5x XP§f, and the top exorcist wins a §dCursed Womb§f.");
  } catch {
    /* ignore */
  }
  for (const p of world.getAllPlayers()) title(p, "§4§lCURSE OUTBREAK", "§f3 minutes · 1.5x XP", 40);
  return true;
}
function outbreakTick() {
  if (now() >= evState.until) return endOutbreak();
  if (now() - evState.wave < 300) return;
  evState.wave = now();
  for (const p of eligible()) if (cursesNear(p) < 6) spawnAround(p, 2 + (Math.random() < 0.5 ? 1 : 0));
}
function endOutbreak() {
  const ranks = [...evState.kills.entries()].sort((a, b) => b[1] - a[1]);
  evState.kind = null;
  const players = world.getAllPlayers();
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? "someone who left";
  let text = "§4✦ §fThe curse outbreak is over.";
  if (!ranks.length) text += " §7Not a single curse was exorcised...";
  else {
    const top = players.find((p) => p.id === ranks[0][0]);
    if (top) give(top, "jjk:cursed_womb", 1);
    text += ` Top exorcist: §6${nameOf(ranks[0][0])}§f (${ranks[0][1]})${top ? ", who wins a §dCursed Womb§f" : ""}.`;
    if (ranks.length > 1) text += ` §7Then ${ranks.slice(1, 3).map(([id, n]) => `${nameOf(id)} (${n})`).join(", ")}.`;
  }
  try {
    world.sendMessage(text);
  } catch {
    /* ignore */
  }
}
function startHunt() {
  const pool = eligible(G.TWO);
  if (!pool.length) return false;
  try {
    if (world.getDimension("minecraft:overworld").getEntities({ type: "jjk:finger_bearer" }).length) return false; // one at a time
  } catch {
    /* ignore */
  }
  const p = pool[Math.floor(Math.random() * pool.length)];
  const b = spawnFingerBearer(p);
  if (!b) return false;
  try {
    world.sendMessage(`§4✦ SPECIAL GRADE HUNT! §fA Finger Bearer is loose near §e${Math.round(b.location.x)}, ${Math.round(b.location.z)}§f — whoever exorcises it takes one of §4Sukuna's Fingers§f.`);
  } catch {
    /* ignore */
  }
  return true;
}
function startRaid() {
  return eligible(G.ONE).length > 0 && !!villainNight(true);
}
// Starts an event now (falling back to an outbreak when this one has nobody to happen to). Returns what started.
export function startEvent(kind) {
  if (evState.kind) return null;
  const tries = kind === "outbreak" ? ["outbreak"] : [kind, "outbreak"];
  for (const k of tries) {
    const ok = k === "outbreak" ? startOutbreak() : k === "hunt" ? startHunt() : k === "raid" ? startRaid() : false;
    if (ok) return k;
  }
  return null;
}
function eventTick() {
  if (evState.kind === "outbreak") outbreakTick();
  if (evState.next < 0 || !on("events")) {
    evState.next = now() + every();
    evState.warned = false;
    return;
  }
  const kind = ORDER[evState.turn % ORDER.length];
  if (!evState.warned && evState.next - now() <= 1200) {
    evState.warned = true;
    if (eligible().length) say(`A server event begins in §f1 minute§7: §d${EVENTS[kind]}§7.`);
  }
  if (now() < evState.next) return;
  evState.warned = false;
  if (startEvent(kind)) {
    evState.turn++;
    evState.next = now() + every();
  } else evState.next = now() + 6000; // nobody to happen to: try again in 5 minutes
}
// For the Record: what's on, or what's next and when.
export function eventInfo() {
  if (!on("events")) return "";
  if (evState.kind === "outbreak") {
    const s = Math.max(0, Math.ceil((evState.until - now()) / 20));
    return `§4Curse Outbreak on now §7(${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} left)`;
  }
  const mins = Math.max(1, Math.ceil((evState.next - now()) / 1200));
  return `§d${EVENTS[ORDER[evState.turn % ORDER.length]]}§7 in ${mins} min`;
}

export function initUpkeep() {
  system.runInterval(() => {
    try {
      clearTick();
    } catch {
      /* ignore */
    }
  }, 20);
  system.runInterval(() => {
    try {
      eventTick();
    } catch {
      /* ignore */
    }
  }, 20);
  system.runInterval(boardTick, 400);
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    try {
      if (entity?.typeId === "minecraft:item" || entity?.typeId === "minecraft:arrow") born.set(entity.id, now());
    } catch {
      /* ignore */
    }
  });
  world.afterEvents.entityRemove?.subscribe?.(({ removedEntityId }) => born.delete(removedEntityId));
  deathHooks.push((dead, p) => {
    if (evState.kind === "outbreak" && p && dead.typeId in CURSE_XP) evState.kills.set(p.id, (evState.kills.get(p.id) ?? 0) + 1);
  });
  xpHooks.push(() => (evState.kind === "outbreak" ? 1.5 : 1));
  statusHooks.push((p) => {
    if (evState.kind !== "outbreak") return "";
    const s = Math.max(0, Math.ceil((evState.until - now()) / 20));
    return `§4OUTBREAK ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} · ${evState.kills.get(p.id) ?? 0}`;
  });
}
export const _upkeep = { born, clearState, evState, boardTick, setEvery: (m) => setWorldProp("events_every", m) };
