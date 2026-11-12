// Lag clear — keeps the server light.
//   every 10 minutes: every dropped item lying on the ground is removed (chat warns 60 s and 10 s before)
//   every 30 minutes: hostile mobs are cleared; they simply spawn again (naturally, or from their NPC Spawner)
// Never touched: players, villagers and animals, pets and anything tamed or name-tagged, shop NPCs, companions,
// summons, reanimated shinobi, bosses (Akatsuki, legends, Tailed Beasts) and anything a quest, exam or spawner made.
//   /scriptevent aegis:lag            — when the next clears are due
//   /scriptevent aegis:lag items      — clear dropped items now
//   /scriptevent aegis:lag mobs       — clear hostile mobs now
//   /scriptevent aegis:lag off | on   — stop / resume the automatic clears

import { world, system } from "@minecraft/server";

const ITEMS_EVERY = 12000; // 10 min
const MOBS_EVERY = 36000; // 30 min
const WARN = [1200, 200]; // ticks before an item clear
const OFF = "aegis:lag_off";
const DIMENSIONS = ["overworld", "nether", "the_end"];
const BOSSES = /^aegis:(akatsuki|legend|shukaku|matatabi|isobu|son_goku|kokuo|saiken|chomei|gyuki|kurama)$/;

let nextItems = ITEMS_EVERY;
let nextMobs = MOBS_EVERY;
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

// A hostile mob nobody owns and nothing depends on.
function disposable(e) {
  if (e.typeId === "minecraft:player" || BOSSES.test(e.typeId)) return false;
  if (e.typeId.startsWith("aegis:") && e.typeId !== "aegis:hostile_ninja") return false;
  if (e.nameTag && !e.typeId.startsWith("aegis:")) return false; // name-tagged by a player
  if (e.getTags().length) return false; // quest / exam / spawner / clone bookkeeping
  if (e.getDynamicProperty("aegis:owner") || e.getDynamicProperty("aegis:spawner")) return false;
  if (e.getComponent("minecraft:is_tamed") || e.getComponent("minecraft:tameable")?.isTamed) return false;
  return true;
}

export function clearMobs() {
  const n = each({ families: ["monster"] }, (e) => {
    if (!disposable(e)) return false;
    e.remove();
    return true;
  });
  say(n ? `Cleared §f${n}§7 hostile mob${n === 1 ? "" : "s"} — they'll spawn again.` : "No hostile mobs to clear.");
  return n;
}

const left = (ticks) => {
  const s = Math.max(0, Math.round(ticks / 20));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

export function initLagClear() {
  nextItems = system.currentTick + ITEMS_EVERY;
  nextMobs = system.currentTick + MOBS_EVERY;
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
    if (now >= nextMobs) {
      nextMobs = now + MOBS_EVERY;
      clearMobs();
    }
  }, 20);

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:lag") return;
    const cmd = String(message ?? "").trim().toLowerCase();
    const tell = (t) => (p?.typeId === "minecraft:player" ? p.sendMessage(t) : say(t));
    if (cmd === "items") return void clearItems();
    if (cmd === "mobs") return void clearMobs();
    if (cmd === "off" || cmd === "on") {
      world.setDynamicProperty(OFF, cmd === "off" ? true : undefined);
      if (cmd === "on") {
        nextItems = system.currentTick + ITEMS_EVERY;
        nextMobs = system.currentTick + MOBS_EVERY;
      }
      return say(cmd === "off" ? "Automatic clears are §coff§7." : "Automatic clears are §aon§7 (items every 10 min, hostile mobs every 30 min).");
    }
    tell(world.getDynamicProperty(OFF) ? "§7Lag clear is §coff§7. /scriptevent aegis:lag on" :
      `§7Next item clear in §f${left(nextItems - system.currentTick)}§7, next mob clear in §f${left(nextMobs - system.currentTick)}§7.`);
  });
}
