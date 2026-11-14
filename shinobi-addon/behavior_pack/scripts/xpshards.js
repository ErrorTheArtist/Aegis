// XP Shards (v1.52) — crystals of a fallen boss's chakra. Right-click one to absorb it: about a third of the XP your
// next level needs, whatever your level (at least 100 XP). Sneak + right-click absorbs the whole stack.
// Almost every boss drops them when a player (or a player's companion, clone or summon) brings it down:
//   Legendary shinobi 4–5 (Edo Madara 8) · Akatsuki members 3 · Tailed Beasts 5 (Kurama 7).
// They're also paid by the bigger Quest Board quests and A/S-rank missions.
//   /scriptevent aegis:xpshard [n]   — give yourself n shards (testing)

import { world, system, ItemStack } from "@minecraft/server";
import { gainXp, getLevel, xpToNext, MAX_LEVEL } from "./levels.js";

export const XP_SHARD = "aegis:xp_shard";
const SHARE = 0.35; // of the XP to your next level
const MIN_XP = 100;
const TAILED_BEASTS = new Set(["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"].map((b) => `aegis:${b}`));
const COLOR = [0.45, 1, 0.85];

let api;

// How much one shard is worth to a shinobi of this level.
export const shardXp = (level) => Math.max(MIN_XP, Math.round(xpToNext(Math.max(1, Math.min(level, MAX_LEVEL - 1))) * SHARE));

// How many shards a boss drops (0 = not a boss).
export function shardsFor(e) {
  const t = e?.typeId;
  if (t === "aegis:legend") {
    let id;
    try {
      id = e.getDynamicProperty("aegis:member");
    } catch {
      /* ignore */
    }
    return id === "madara" ? 8 : 4 + (Math.random() < 0.5 ? 1 : 0);
  }
  if (t === "aegis:akatsuki") return 3;
  if (TAILED_BEASTS.has(t)) return t === "aegis:kurama" ? 7 : 5;
  return 0;
}

// The player behind a kill: the player, or the owner of the clone / companion / summon that landed it.
function killerOf(damageSource) {
  let k = damageSource?.damagingEntity;
  if (k && k.typeId !== "minecraft:player") {
    try {
      const owner = k.getDynamicProperty("aegis:owner");
      k = owner ? world.getEntity(owner) : undefined;
    } catch {
      k = undefined;
    }
  }
  return k?.typeId === "minecraft:player" ? k : undefined;
}

export function giveShards(player, n) {
  if (n <= 0) return;
  const st = new ItemStack(XP_SHARD, n);
  try {
    const left = player.getComponent("minecraft:inventory")?.container?.addItem(st);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    try {
      player.dimension.spawnItem(st, player.location);
    } catch {
      /* ignore */
    }
  }
}

// Takes up to n shards from the stack in the player's hand; returns how many it took.
function takeFromHand(player, n) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex;
  const it = inv?.getItem(slot);
  if (!it || it.typeId !== XP_SHARD) return 0;
  const used = Math.min(n, it.amount);
  if (it.amount > used) {
    it.amount -= used;
    inv.setItem(slot, it);
  } else inv.setItem(slot, undefined);
  return used;
}

export function absorb(player, all = false) {
  if (getLevel(player) >= MAX_LEVEL) {
    player.onScreenDisplay?.setActionBar("§7You've reached the highest level — save your shards for a friend.");
    return 0;
  }
  const inHand = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
  const n = takeFromHand(player, all ? inHand?.amount ?? 1 : 1);
  if (!n) return 0;
  // one at a time, so each shard is worth what it's worth at your level as you climb
  let total = 0;
  let used = 0;
  for (; used < n && getLevel(player) < MAX_LEVEL; used++) {
    const x = shardXp(getLevel(player));
    gainXp(player, x, true);
    total += x;
  }
  if (used < n) giveShards(player, n - used); // hit the level cap part-way: keep the rest
  const dim = player.dimension;
  const at = player.location;
  api.particle(dim, "aegis:cine_ring", at, COLOR);
  api.particle(dim, "aegis:cine_swirl", at, COLOR);
  if (used > 1) api.particle(dim, "aegis:cine_pillar", at, COLOR);
  api.sound(dim, "random.orb", at, 1, used > 1 ? 0.7 : 1.3);
  api.sound(dim, "aegis.seal", at, 0.5, 1.6);
  player.onScreenDisplay?.setActionBar(`§b+${total.toLocaleString("en-US")} XP §7(${used} XP Shard${used === 1 ? "" : "s"})`);
  return used;
}

export function initXpShards(helpers) {
  api = helpers;

  world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
    if (itemStack?.typeId !== XP_SHARD || player?.typeId !== "minecraft:player") return;
    absorb(player, player.isSneaking);
  });

  // bosses drop them
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    const n = shardsFor(deadEntity);
    if (!n || !killerOf(damageSource)) return;
    try {
      deadEntity.dimension.spawnItem(new ItemStack(XP_SHARD, n), deadEntity.location);
      api.particle(deadEntity.dimension, "aegis:cine_pillar", deadEntity.location, COLOR);
    } catch {
      /* ignore */
    }
  });

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:xpshard" || p?.typeId !== "minecraft:player") return;
    const n = Math.max(1, Math.min(640, Math.floor(Number(String(message ?? "").trim()) || 8)));
    giveShards(p, n);
    p.sendMessage(`§bGave you ${n} XP Shard${n === 1 ? "" : "s"} §7(one is worth ${shardXp(getLevel(p)).toLocaleString("en-US")} XP at your level).`);
  });
}
