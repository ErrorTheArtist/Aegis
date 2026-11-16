// Lag clear — keeps the server light (v1.54).
//   every 5 minutes: every dropped item lying on the ground is removed (chat warns 30 s and 10 s before)
//   after 20 minutes alive: hostile mobs are removed — rogue / Sound / Anbu ninja, Akatsuki, legends, Tailed Beasts
//     (the Ten-Tails too) and vanilla monsters. Spawners send theirs back after their delay, and a Tailed Beast that's
//     sent home frees the world for the next one.
// Never touched: players, villagers and animals, pets and anything tamed or name-tagged, shop NPCs, companions,
// summons and clones, reanimated shinobi, a legend waiting for a challenger, a Jinchūriki's trial — and anything that
// was hit in the last 2 minutes (a fight in progress is never cut short).
//   /scriptevent aegis:lag            — when the next item clear is due
//   /scriptevent aegis:lag items      — clear dropped items now
//   /scriptevent aegis:lag mobs       — clear every hostile mob now (any age)
//   /scriptevent aegis:lag off | on   — stop / resume the automatic clears

import { world, system } from "@minecraft/server";
import { TAILED_BEASTS, releaseRampage } from "./rampage.js";

const ITEMS_EVERY = 6000; // 5 min
const MOB_AGE = 24000; // 20 min
const SCAN_EVERY = 1200; // look for old mobs once a minute
const FIGHTING = 2400; // hit in the last 2 min = still fighting
const WARN = [600, 200]; // ticks before an item clear
const OFF = "aegis:lag_off";
const DIMENSIONS = ["overworld", "nether", "the_end"];
const BOSSES = new Set(["aegis:akatsuki", "aegis:legend", ...TAILED_BEASTS]);

let nextItems = ITEMS_EVERY;
const born = new Map(); // entity id -> tick it was first seen
const lastHit = new Map(); // entity id -> tick it was last hurt
const say = (text) => world.sendMessage(`§8[§bLag Clear§8] §7${text}`);

function each(query, fn) {
  let n = 0;
  for (const name of DIMENSIONS) {
    let list = [];
    try {
      list = world.getDimension(name).getEntities(query);
    } catch {
      continue;
    }
    for (const e of list) {
      try {
        if (fn(e)) n++;
      } catch {
        /* unloaded or already gone */
      }
    }
  }
  return n;
}

export function clearItems() {
  const n = each({ type: "minecraft:item" }, (e) => {
    e.remove();
    return true;
  });
  say(n ? `Removed §f${n}§7 dropped item${n === 1 ? "" : "s"}.` : "No dropped items to remove.");
  return n;
}

const prop = (e, k) => {
  try {
    return e.getDynamicProperty(k);
  } catch {
    return undefined;
  }
};

// A hostile mob nobody owns, that isn't busy fighting or waiting for a challenger.
function disposable(e, now) {
  if (e.typeId === "minecraft:player") return false;
  if (now - (lastHit.get(e.id) ?? -1e9) < FIGHTING) return false;
  if (BOSSES.has(e.typeId)) {
    if (prop(e, "aegis:trial_of") || prop(e, "aegis:owner")) return false;
    if (e.typeId === "aegis:legend" && e.hasTag?.("aegis_calm")) return false; // waiting by its spawner for a challenger
    return true;
  }
  if (e.typeId.startsWith("aegis:") && e.typeId !== "aegis:hostile_ninja") return false;
  if (e.nameTag && !e.typeId.startsWith("aegis:")) return false; // name-tagged by a player
  if (e.getTags().some((t) => t.startsWith("aegis_lclone_") || t.startsWith("aegis_exam"))) return false; // a legend's clones, an exam
  if (prop(e, "aegis:owner")) return false;
  if (e.getComponent("minecraft:is_tamed") || e.getComponent("minecraft:tameable")?.isTamed) return false;
  return true;
}

function remove(e) {
  if (TAILED_BEASTS.has(e.typeId)) releaseRampage(e.id);
  born.delete(e.id);
  lastHit.delete(e.id);
  try {
    if (BOSSES.has(e.typeId)) {
      e.dimension.spawnParticle("aegis:smoke_puff", e.location);
      for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 48 })) {
        p.sendMessage(`§8[§bLag Clear§8] §7${e.nameTag || e.typeId.replace("aegis:", "")}§7 has moved on.`);
      }
    }
  } catch {
    /* ignore */
  }
  e.remove();
}

const hostiles = (fn) => each({ families: ["monster"] }, fn) + each({ families: ["tailed_beast"], excludeFamilies: ["monster"] }, fn);

// Removes hostile mobs older than 20 minutes (or every one, with all = true).
export function clearMobs(all = false) {
  const now = system.currentTick;
  const n = hostiles((e) => {
    if (!born.has(e.id)) born.set(e.id, now);
    if (!all && now - born.get(e.id) < MOB_AGE) return false;
    if (!disposable(e, now)) return false;
    remove(e);
    return true;
  });
  if (all || n) say(n ? `Cleared §f${n}§7 hostile mob${n === 1 ? "" : "s"} — they'll spawn again.` : "No hostile mobs to clear.");
  return n;
}

const left = (ticks) => {
  const s = Math.max(0, Math.round(ticks / 20));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

export function initLagClear() {
  nextItems = system.currentTick + ITEMS_EVERY;
  world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
    if (hurtEntity.typeId !== "minecraft:player") lastHit.set(hurtEntity.id, system.currentTick);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    born.delete(deadEntity.id);
    lastHit.delete(deadEntity.id);
  });
  system.runInterval(() => {
    if (world.getDynamicProperty(OFF)) return;
    const now = system.currentTick;
    for (const w of WARN) {
      if (nextItems - now <= w && nextItems - now > w - 20) say(`Dropped items will be removed in §f${left(w)}§7 — pick up what you want to keep.`);
    }
    if (now >= nextItems) {
      nextItems = now + ITEMS_EVERY;
      clearItems();
    }
    if (now % SCAN_EVERY < 20) clearMobs(false);
    if (now % 72000 < 20) for (const [id, t] of born) if (now - t > MOB_AGE * 4) born.delete(id); // forget long-gone ones
  }, 20);

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:lag") return;
    const cmd = String(message ?? "").trim().toLowerCase();
    const tell = (t) => (p?.typeId === "minecraft:player" ? p.sendMessage(t) : say(t));
    if (cmd === "items") return void clearItems();
    if (cmd === "mobs") return void clearMobs(true);
    if (cmd === "off" || cmd === "on") {
      world.setDynamicProperty(OFF, cmd === "off" ? true : undefined);
      if (cmd === "on") nextItems = system.currentTick + ITEMS_EVERY;
      return say(cmd === "off" ? "Automatic clears are §coff§7." : "Automatic clears are §aon§7 (items every 5 min, hostile mobs after 20 min alive).");
    }
    tell(world.getDynamicProperty(OFF) ? "§7Lag clear is §coff§7. /scriptevent aegis:lag on" :
      `§7Next item clear in §f${left(nextItems - system.currentTick)}§7. Hostile mobs and bosses are cleared after 20 minutes alive (not mid-fight).`);
  });
}
