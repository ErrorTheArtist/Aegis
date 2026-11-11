// Shinobi outposts: small Leaf-style villages with NPC spawners hidden under the floor.
// They appear on their own while exploring (can be turned off), or on demand:
//   /scriptevent aegis:village build   — build one in front of you
//   /scriptevent aegis:village off|on  — disable / enable automatic villages

import { world, system } from "@minecraft/server";
import { CLANS } from "./clans.js";
import { createSpawner } from "./npcs.js";

const LIST_PROP = "aegis:villages";
const ENABLED_PROP = "aegis:villages_enabled";
const MIN_SPACING = 600;
let api;

const villages = () => {
  try {
    return JSON.parse(world.getDynamicProperty(LIST_PROP) ?? "[]");
  } catch {
    return [];
  }
};
const enabled = () => world.getDynamicProperty(ENABLED_PROP) !== false;

const SKIP = /leaves|log|wood|grass$|short_grass|tall_grass|fern|flower|bush|vine|snow_layer|mushroom|sapling|dandelion|poppy|tulip|orchid|allium|bluet|daisy|cornflower|lily|rose|peony|lilac|sunflower|kelp|seagrass/;

function groundY(dim, x, z, fromY) {
  for (let y = fromY + 24; y > fromY - 24; y--) {
    let b;
    try {
      b = dim.getBlock({ x, y, z });
    } catch {
      return undefined;
    }
    if (!b) return undefined;
    if (b.isAir || SKIP.test(b.typeId.replace("minecraft:", ""))) continue;
    if (b.isLiquid) return null;
    return y;
  }
  return undefined;
}

function siteOk(dim, cx, cz, refY) {
  const ys = [];
  for (const dx of [-8, 0, 8]) {
    for (const dz of [-8, 0, 8]) {
      const y = groundY(dim, cx + dx, cz + dz, refY);
      if (y === undefined || y === null) return undefined;
      ys.push(y);
    }
  }
  if (Math.max(...ys) - Math.min(...ys) > 4) return undefined;
  return Math.round(ys.reduce((a, b) => a + b, 0) / ys.length);
}

function set(dim, x, y, z, type) {
  try {
    dim.getBlock({ x, y, z })?.setType(type);
  } catch {
    /* ignore */
  }
}

function hut(dim, x0, y0, z0, w, d, h, door, roof) {
  for (let x = x0; x < x0 + w; x++) {
    for (let z = z0; z < z0 + d; z++) {
      set(dim, x, y0, z, "minecraft:spruce_planks");
      const edgeX = x === x0 || x === x0 + w - 1;
      const edgeZ = z === z0 || z === z0 + d - 1;
      for (let y = y0 + 1; y <= y0 + h; y++) {
        if (edgeX && edgeZ) set(dim, x, y, z, "minecraft:spruce_log");
        else if (edgeX || edgeZ) set(dim, x, y, z, y === y0 + 2 && (x - x0 + z - z0) % 3 === 1 ? "minecraft:glass_pane" : "minecraft:oak_planks");
        else set(dim, x, y, z, "minecraft:air");
      }
    }
  }
  // roof with overhang
  for (let x = x0 - 1; x <= x0 + w; x++) for (let z = z0 - 1; z <= z0 + d; z++) set(dim, x, y0 + h + 1, z, roof);
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) set(dim, x, y0 + h + 2, z, roof === "minecraft:red_terracotta" ? "minecraft:orange_terracotta" : "minecraft:red_terracotta");
  // door opening
  const [dx, dz] = door;
  set(dim, dx, y0 + 1, dz, "minecraft:air");
  set(dim, dx, y0 + 2, dz, "minecraft:air");
}

function lamp(dim, x, y, z) {
  set(dim, x, y + 1, z, "minecraft:oak_fence");
  set(dim, x, y + 2, z, "minecraft:oak_fence");
  set(dim, x, y + 3, z, "minecraft:lantern");
}

export function buildVillage(dim, cx, cy, cz) {
  const R = 10;
  // level the ground and clear the air above
  for (let x = cx - R; x <= cx + R; x++) {
    for (let z = cz - R; z <= cz + R; z++) {
      for (let y = cy - 3; y < cy; y++) {
        try {
          const b = dim.getBlock({ x, y, z });
          if (b && (b.isAir || b.isLiquid || SKIP.test(b.typeId))) b.setType("minecraft:dirt");
        } catch {
          /* ignore */
        }
      }
      set(dim, x, cy, z, x === cx || z === cz ? "minecraft:dirt_path" : "minecraft:grass_block");
      for (let y = cy + 1; y <= cy + 9; y++) set(dim, x, y, z, "minecraft:air");
    }
  }
  const clan = Object.keys(CLANS)[Math.floor(Math.random() * Object.keys(CLANS).length)];
  // Mission hall (north)
  hut(dim, cx - 3, cy, cz - 9, 7, 5, 4, [cx, cz - 5], "minecraft:red_terracotta");
  set(dim, cx - 2, cy + 1, cz - 8, "minecraft:bookshelf");
  set(dim, cx + 2, cy + 1, cz - 8, "minecraft:bookshelf");
  createSpawner(dim, { x: cx, y: cy - 1, z: cz - 7 }, { type: "mission_desk" });
  // Dojo / Sensei (west)
  hut(dim, cx - 9, cy, cz - 2, 5, 5, 3, [cx - 5, cz], "minecraft:orange_terracotta");
  createSpawner(dim, { x: cx - 7, y: cy - 1, z: cz }, { type: "sensei" });
  // Ramen stand (east): counter + striped awning
  for (let z = cz - 2; z <= cz + 2; z++) {
    set(dim, cx + 5, cy + 1, z, "minecraft:oak_planks");
    for (let x = cx + 5; x <= cx + 8; x++) set(dim, x, cy + 4, z, (z + x) % 2 ? "minecraft:red_wool" : "minecraft:white_wool");
  }
  for (const z of [cz - 2, cz + 2]) for (let y = cy + 1; y <= cy + 3; y++) set(dim, cx + 8, y, z, "minecraft:oak_fence");
  set(dim, cx + 8, cy + 1, cz, "minecraft:smoker");
  createSpawner(dim, { x: cx + 7, y: cy - 1, z: cz }, { type: "ramen" });
  // Weaponsmith (south-west)
  hut(dim, cx - 9, cy, cz + 4, 5, 5, 3, [cx - 7, cz + 4], "minecraft:red_terracotta");
  set(dim, cx - 8, cy + 1, cz + 7, "minecraft:anvil");
  createSpawner(dim, { x: cx - 7, y: cy - 1, z: cz + 6 }, { type: "weaponsmith" });
  // Clan Elder (south-east)
  hut(dim, cx + 4, cy, cz + 4, 5, 5, 3, [cx + 6, cz + 4], "minecraft:orange_terracotta");
  createSpawner(dim, { x: cx + 6, y: cy - 1, z: cz + 6 }, { type: "clan_elder", clan });
  // Training ground (south) with the exam proctor and targets
  for (const x of [cx - 2, cx + 2]) {
    set(dim, x, cy + 1, cz + 9, "minecraft:oak_fence");
    set(dim, x, cy + 2, cz + 9, "minecraft:hay_block");
  }
  createSpawner(dim, { x: cx, y: cy - 1, z: cz + 7 }, { type: "proctor", stay: false, radius: 3 });
  // Villagers + a recruitable genin in the square
  createSpawner(dim, { x: cx + 2, y: cy - 1, z: cz - 2 }, { type: "villager", stay: false, radius: 6 });
  createSpawner(dim, { x: cx - 2, y: cy - 1, z: cz + 2 }, { type: "genin", stay: false, radius: 5, delay: 600 });
  for (const [x, z] of [[cx - R, cz - R], [cx + R, cz - R], [cx - R, cz + R], [cx + R, cz + R], [cx - 1, cz - 1], [cx + 1, cz + 1]]) lamp(dim, x, cy, z);
  const list = villages();
  list.push({ dim: dim.id, x: cx, z: cz });
  world.setDynamicProperty(LIST_PROP, JSON.stringify(list.slice(-200)));
}

function compass(dx, dz) {
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const dirs = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return dirs[Math.round(((a + 360) % 360) / 45) % 8];
}

function tryAutoVillage(player) {
  if (player.dimension.id !== "minecraft:overworld") return;
  const { x, y, z } = player.location;
  if (villages().some((v) => v.dim === player.dimension.id && Math.hypot(v.x - x, v.z - z) < MIN_SPACING)) return;
  for (let k = 0; k < 8; k++) {
    const a = Math.random() * Math.PI * 2;
    const cx = Math.floor(x + Math.cos(a) * 56);
    const cz = Math.floor(z + Math.sin(a) * 56);
    const gy = siteOk(player.dimension, cx, cz, Math.floor(y));
    if (gy === undefined) continue;
    buildVillage(player.dimension, cx, gy, cz);
    player.sendMessage(`§eYou sense chakra… a shinobi outpost lies to the §f${compass(cx - x, cz - z)}§e.`);
    return;
  }
}

export function initVillages(helpers) {
  api = helpers;
  system.runInterval(() => {
    if (!enabled()) return;
    for (const p of world.getAllPlayers()) if (Math.random() < 0.2) tryAutoVillage(p);
  }, 1200);

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:village" || sourceEntity?.typeId !== "minecraft:player") return;
    const p = sourceEntity;
    const cmd = message.trim().toLowerCase();
    if (cmd === "off" || cmd === "on") {
      world.setDynamicProperty(ENABLED_PROP, cmd === "on");
      p.sendMessage(`§7Automatic villages ${cmd === "on" ? "enabled" : "disabled"}.`);
    } else if (cmd === "build") {
      const d = p.getViewDirection();
      const cx = Math.floor(p.location.x + d.x * 14);
      const cz = Math.floor(p.location.z + d.z * 14);
      const gy = groundY(p.dimension, cx, cz, Math.floor(p.location.y)) ?? Math.floor(p.location.y) - 1;
      buildVillage(p.dimension, cx, gy, cz);
      p.sendMessage("§aOutpost built. Its NPC spawners are hidden under the floor.");
    } else p.sendMessage("§7Usage: /scriptevent aegis:village <build | on | off>");
  });
}
