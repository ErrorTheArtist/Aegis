// Fast Travel (v1.52) — the Travel Master's messenger hawks carry you to any of the six villages, or to any other Travel
// Master in the world. Place Travel Masters with the NPC Spawner (NPC type: Fast Travel); every one is a stop on the
// network, listed under its spawner's "Place name" (or, without one, by the nearest village). The fee grows with the
// distance (and with the spawner's price %); you can't travel in the middle of a fight.

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { VILLAGES, getVillage, inFight } from "./villages.js";
import { getRyo, spendRyo, addRyo, fmtRyo, price } from "./currency.js";

let api;
let listPosts = () => [];
const COOLDOWN = 200; // ticks between trips (10 s)
const HERE = 24; // a stop this close is where you already are
const DIMS = { "minecraft:overworld": "Overworld", "minecraft:nether": "the Nether", "minecraft:the_end": "the End" };
const OVERWORLD = "minecraft:overworld";

// Ryō for a trip: 150 + a quarter per block (most trips 300–700 Ryō), +20% like every price; another dimension is a
// flat 1,500. A spawner's price % scales it.
export function travelFee(from, to, cfg) {
  const scale = (cfg?.price ?? 100) / 100;
  const base = from.dim !== to.dim ? 1500 : Math.min(3000, 150 + Math.hypot(to.x - from.x, to.z - from.z) * 0.25);
  return Math.max(1, Math.round(price(base) * scale));
}

// How a Travel Master's stop is listed.
export function postName(cfg) {
  if (cfg.place) return cfg.place;
  let best;
  if ((cfg.dim ?? OVERWORLD) === OVERWORLD) {
    for (const V of Object.values(VILLAGES)) {
      const d = Math.hypot(V.pos.x - cfg.x, V.pos.z - cfg.z);
      if (d < 400 && (!best || d < best.d)) best = { V, d };
    }
  }
  if (best) return best.d < 120 ? `${best.V.name} Travel Post` : `Travel Post near the ${best.V.name}`;
  return `Travel Post at ${cfg.x}, ${cfg.z}${(cfg.dim ?? OVERWORLD) !== OVERWORLD ? ` (${DIMS[cfg.dim] ?? cfg.dim})` : ""}`;
}

export function destinations(player, cfg) {
  const here = { x: player.location.x, z: player.location.z, dim: player.dimension.id };
  const home = getVillage(player);
  const out = [];
  for (const [id, V] of Object.entries(VILLAGES)) {
    out.push({ kind: "village", id, label: `${V.color}${V.name}`, home: home === id, x: V.pos.x + 0.5, y: V.pos.y, z: V.pos.z + 0.5, dim: OVERWORLD });
  }
  for (const c of listPosts()) {
    if (c.key === cfg?.key) continue;
    out.push({ kind: "post", key: c.key, label: `§b${postName(c)}`, x: c.x + 0.5, y: c.y + 1, z: c.z + 0.5, dim: c.dim ?? OVERWORLD, post: c });
  }
  for (const d of out) {
    d.dist = d.dim === here.dim ? Math.hypot(d.x - here.x, d.z - here.z) : Infinity;
    d.fee = travelFee(here, d, cfg);
  }
  return out.filter((d) => d.dist > HERE).sort((a, b) => (a.kind === b.kind ? (a.kind === "village" ? (b.home ? 1 : 0) - (a.home ? 1 : 0) : a.dist - b.dist) : a.kind === "village" ? -1 : 1));
}

export async function travelMenu(player, npc, cfg, greeting) {
  const list = destinations(player, cfg);
  const f = new ActionFormData()
    .title("§lFast Travel")
    .body(`§7${greeting}\n\n§6Your Ryō: §f${fmtRyo(getRyo(player))}\n§7The fee depends on how far you go.` +
      (list.some((d) => d.kind === "post") ? "" : "\n§8(No other Travel Masters yet — place more with the NPC Spawner to add stops.)"));
  for (const d of list) {
    const where = d.dist === Infinity ? DIMS[d.dim] ?? d.dim : `${Math.round(d.dist).toLocaleString("en-US")} blocks`;
    f.button(`${d.label}${d.home ? " §7(home)" : ""}\n§r§7${where} · ${fmtRyo(d.fee)}`);
  }
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  const d = list[r.selection];
  if (!d) return;
  if (inFight(player)) return player.sendMessage("§cYou can't travel in the middle of a fight.");
  const left = api.cooldownLeft(player, "aegis:fast_travel");
  if (left > 0) return player.sendMessage(`§7The hawks need a rest — ready in §f${Math.ceil(left / 20)}s§7.`);
  if (!spendRyo(player, d.fee)) return player.sendMessage(`§cYou need ${fmtRyo(d.fee)} for that trip.`);
  go(player, d);
}

// The first spot with two free blocks, at or above `at` (a stop's spawner block may be covered).
function freeAbove(dim, at) {
  const free = (b) => !b || b.isAir || (!b.isLiquid && typeof b.isSolid === "boolean" && !b.isSolid);
  for (let dy = 0; dy <= 24; dy++) {
    try {
      const a = dim.getBlock({ x: Math.floor(at.x), y: Math.floor(at.y) + dy, z: Math.floor(at.z) });
      const b = dim.getBlock({ x: Math.floor(at.x), y: Math.floor(at.y) + dy + 1, z: Math.floor(at.z) });
      if (!a) return undefined; // not loaded yet
      if (free(a) && free(b)) return { x: at.x, y: Math.floor(at.y) + dy, z: at.z };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function go(player, d) {
  const from = player.dimension;
  api.particle(from, "aegis:smoke_puff", player.location);
  api.sound(from, "aegis.whoosh", player.location, 1, 0.9);
  api.sound(from, "mob.parrot.fly", player.location, 1, 0.7);
  try {
    player.runCommand("camera @s fade time 0.2 0.5 0.4 color 10 12 16");
  } catch {
    /* ignore */
  }
  api.startCooldown(player, "aegis:fast_travel", COOLDOWN);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    try {
      player.teleport({ x: d.x, y: d.y, z: d.z }, { dimension: world.getDimension(d.dim) });
    } catch {
      addRyo(player, d.fee, true);
      return player.sendMessage("§cThe hawks couldn't find a way there — your Ryō was returned.");
    }
    showTitle(player, d.label, { subtitle: "§7Fast travel", fadeInDuration: 4, stayDuration: 30, fadeOutDuration: 10 });
    api.particle(player.dimension, "aegis:smoke_puff", player.location);
    // a stop's block may be under a floor: once the chunk has loaded, step up to the first free space
    if (d.kind === "post") {
      for (const wait of [10, 30]) {
        system.runTimeout(() => {
          if (!api.isValid(player)) return;
          const spot = freeAbove(player.dimension, player.location);
          if (spot && Math.floor(spot.y) !== Math.floor(player.location.y)) {
            try {
              player.teleport(spot);
            } catch {
              /* ignore */
            }
          }
        }, wait);
      }
    }
  }, 8);
}

export function initTravel(helpers, posts) {
  api = helpers;
  if (posts) listPosts = posts;
}
