// Ninja movement (v1.63) — chakra-powered parkour for every shinobi.
//   Chakra Leap    — jump again in mid-air: chakra bursts from your feet and launches you up and forward (8 chakra,
//                    once per jump; the Yellow Flash and the Sage of Six Paths get two).
//   Wall Running   — hold jump with a wall or a tree right in front of you and run straight up it (8 chakra a second);
//                    at the top you vault over the edge.
//   Water Walking  — run across water like solid ground (1 chakra a second). Sneak to sink in; diving and swimming
//                    work as always once your head is under.
// Each one is on by default. Players switch them off in Shinobi Record → Settings, admins for the whole server in
// Admin Panel → Server Settings.

import { world, system } from "@minecraft/server";

const SERVER_OFF = "aegis:movement_off";
const OFF = { leap: "aegis:leap_off", wall: "aegis:wallrun_off", water: "aegis:waterwalk_off" };
export const LEAP_COST = 8;
export const WALL_COST = 0.4; // a tick — 8 a second (more than base regen, so long climbs drain you)
export const WATER_COST = 0.05; // a tick — 1 a second
// Blocks you can walk through don't count as walls (Block.isSolid isn't in the stable API).
const PASSABLE = /(^|:)(short_grass|tall_grass|grass|fern|large_fern|dead_bush|seagrass|tall_seagrass|kelp|kelp_plant|sugar_cane|vine|.*_vines?|ladder|scaffolding|.*torch|.*_sign|.*_hanging_sign|.*banner|.*button|lever|.*rail|redstone_wire|.*carpet|.*pressure_plate|fire|soul_fire|web|snow_layer|.*sapling|.*flower.*|.*tulip|.*orchid|allium|azure_bluet|oxeye_daisy|poppy|dandelion|cornflower|lily_of_the_valley|wither_rose|.*mushroom|wheat|carrots|potatoes|beetroot|sweet_berry_bush|glow_lichen|hanging_roots|spore_blossom|pink_petals|.*coral_fan|nether_sprouts|.*_roots|tripwire.*|structure_void|light_block.*|frog_spawn|cave_vines.*|weeping_vines.*|twisting_vines.*|small_dripleaf_block|big_dripleaf_stem)$/;

let api;
const state = new Map(); // player id -> { air, leaps, was, climbing, ticks }

export const movementOn = () => {
  try {
    return world.getDynamicProperty(SERVER_OFF) !== true;
  } catch {
    return true;
  }
};
export function setMovement(on) {
  world.setDynamicProperty(SERVER_OFF, on ? undefined : true);
}
const wants = (p, kind) => {
  try {
    return p.getDynamicProperty(OFF[kind]) !== true;
  } catch {
    return true;
  }
};
const maxLeaps = (p) => (p.hasTag?.("yellow_flash") || p.hasTag?.("six_paths") ? 2 : 1);

function block(dim, pos) {
  try {
    return dim.getBlock(pos);
  } catch {
    return undefined;
  }
}
function solid(dim, pos) {
  const b = block(dim, pos);
  return !!b && !b.isAir && !b.isLiquid && !PASSABLE.test(b.typeId);
}
function water(dim, pos) {
  const b = block(dim, pos);
  return !!b && !!b.isLiquid && /water/.test(b.typeId);
}
function flat(p) {
  const d = p.getViewDirection();
  const l = Math.hypot(d.x, d.z);
  return l > 0.001 ? { x: d.x / l, z: d.z / l } : { x: 0, z: 1 };
}
// A wall (or a trunk) right in front of you, at your legs or your chest.
export function wallAhead(p) {
  const f = flat(p);
  const l = p.location;
  return [0.4, 1.3].some((dy) => solid(p.dimension, { x: l.x + f.x * 0.75, y: l.y + dy, z: l.z + f.z * 0.75 }));
}
function riding(p) {
  try {
    return !!p.getComponent("minecraft:riding")?.entityRidingOn;
  } catch {
    return false;
  }
}
function spectator(p) {
  try {
    return String(p.getGameMode?.()).toLowerCase() === "spectator";
  } catch {
    return false;
  }
}

function step(p) {
  const s = state.get(p.id) ?? { air: 0, leaps: 0, was: false, climbing: false, ticks: 0 };
  state.set(p.id, s);
  s.ticks++;
  const jumping = !!p.isJumping;
  const ground = !!p.isOnGround;
  if (p.isFlying || p.isGliding || riding(p) || spectator(p)) {
    s.was = jumping;
    s.climbing = false;
    return;
  }
  if (ground) {
    s.air = 0;
    s.leaps = 0;
  } else s.air++;
  const dim = p.dimension;
  const chakra = api.getChakra(p);

  // Wall running: hold jump against a wall and run up it.
  if (wants(p, "wall") && jumping && chakra >= 1 && wallAhead(p)) {
    const f = flat(p);
    p.applyKnockback(f.x, f.z, 0.08, 0.32);
    api.setChakra(p, chakra - WALL_COST);
    if (s.ticks % 4 === 0) {
      api.particle(dim, "aegis:dust", p.location);
      api.sound(dim, "step.stone", p.location, 0.5, 1.4);
    }
    if (!s.climbing || s.ticks % 10 === 0) api.anim?.(p, "animation.aegis.wall_run"); // (one stride, replayed while climbing)
    s.climbing = true;
  } else {
    // over the top: vault onto the edge
    if (s.climbing && jumping && !ground) {
      const f = flat(p);
      p.applyKnockback(f.x, f.z, 0.35, 0.42);
      api.particle(dim, "aegis:smoke_puff", p.location);
    }
    s.climbing = false;
    // Chakra Leap: a fresh press of jump in mid-air.
    if (wants(p, "leap") && jumping && !s.was && !ground && s.air > 3 && s.leaps < maxLeaps(p) && chakra >= LEAP_COST && !p.isInWater) {
      s.leaps++;
      const f = flat(p);
      p.applyKnockback(f.x, f.z, 0.75, 0.62);
      api.setChakra(p, chakra - LEAP_COST);
      api.particle(dim, "aegis:smoke_puff", p.location);
      api.particle(dim, "aegis:cine_ring", p.location, [0.55, 0.85, 1]);
      api.sound(dim, "aegis.leap", p.location, 0.7, 1.25);
      api.anim?.(p, "animation.aegis.chakra_leap");
    }
  }

  // Water walking: keep your feet on the surface — unless you sneak, or your head's already under.
  if (wants(p, "water") && !p.isSneaking) {
    const l = p.location;
    const head = water(dim, { x: l.x, y: l.y + 1.6, z: l.z });
    const feet = !head && water(dim, { x: l.x, y: l.y + 0.2, z: l.z });
    const over = !head && !feet && water(dim, { x: l.x, y: l.y - 0.35, z: l.z });
    if ((feet || over) && api.getChakra(p) >= 0.5) {
      const v = p.getVelocity();
      const h = Math.hypot(v.x, v.z);
      const dx = h > 0.001 ? v.x / h : 0;
      const dz = h > 0.001 ? v.z / h : 0;
      if (feet) p.applyKnockback(dx, dz, h, 0.34); // up out of the water
      else if (v.y < -0.02 && !jumping) p.applyKnockback(dx, dz, h, 0); // stand on it
      api.setChakra(p, api.getChakra(p) - WATER_COST);
      if (s.ticks % 6 === 0 && h > 0.05) api.particle(dim, "aegis:water_splash", l);
    }
  }
  s.was = jumping;
}

export function initMovement(helpers) {
  api = helpers;
  system.runInterval(() => {
    if (!movementOn()) return;
    for (const p of world.getAllPlayers()) {
      try {
        step(p);
      } catch {
        /* ignore */
      }
    }
  }, 1);
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => state.delete(playerId));
}
