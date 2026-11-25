// Shared helpers for every Jujutsu Legacy module: stored values, maths, particles, sounds, messages, animations,
// effect entities, targeting and one per-tick task runner. No game rules live here.

import { world, system, MolangVariableMap } from "@minecraft/server";

export const PFX = "jjk:";
export const now = () => system.currentTick;

// The second copy of the credits (see credits.js). Don't edit it.
const SEAL = [114, 106, 107, 117, 105, 123, 125, 126, 127, 117, 115, 100, 124, 104, 105, 120, 106, 117, 127, 124, 114, 118, 125, 69];
export const seal = () => String.fromCharCode(...SEAL.map((c, i) => c ^ (23 + (i % 5))));

// ---------------------------------------------------------------------------
// Stored values (dynamic properties, all prefixed "jjk:")
// ---------------------------------------------------------------------------
export function getProp(e, key, def) {
  try {
    const v = e.getDynamicProperty(PFX + key);
    return v === undefined ? def : v;
  } catch {
    return def;
  }
}
export function setProp(e, key, v) {
  try {
    e.setDynamicProperty(PFX + key, v);
  } catch {
    /* entity gone */
  }
}
export function worldProp(key, def) {
  try {
    const v = world.getDynamicProperty(PFX + key);
    return v === undefined ? def : v;
  } catch {
    return def;
  }
}
export function setWorldProp(key, v) {
  try {
    world.setDynamicProperty(PFX + key, v);
  } catch {
    /* ignore */
  }
}
export function bump(e, key, n = 1) {
  setProp(e, key, getProp(e, key, 0) + n);
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
export function valid(e) {
  try {
    if (!e) return false;
    return (typeof e.isValid === "function" ? e.isValid() : e.isValid) !== false;
  } catch {
    return false;
  }
}
export function health(e) {
  try {
    return e.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
}
export function alive(e) {
  if (!valid(e)) return false;
  const h = health(e);
  return !h || h.currentValue > 0;
}
export const isPlayer = (e) => e?.typeId === "minecraft:player";
export function gameMode(p) {
  try {
    return String(p.getGameMode?.() ?? "survival").toLowerCase();
  } catch {
    return "survival";
  }
}
export function effect(e, id, ticks, amplifier = 0, particles = false) {
  try {
    e.addEffect(id, Math.max(1, Math.round(ticks)), { amplifier, showParticles: particles });
  } catch {
    /* ignore */
  }
}
export function clearEffect(e, id) {
  try {
    e.removeEffect(id);
  } catch {
    /* ignore */
  }
}
export function knock(e, dx, dz, h, v) {
  try {
    e.applyKnockback(dx, dz, h, v);
  } catch {
    /* some entities can't be pushed */
  }
}
export function tp(e, loc, opts) {
  try {
    e.teleport(loc, opts);
    return true;
  } catch {
    return false;
  }
}
export function byId(id) {
  try {
    return id ? world.getEntity(id) : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Vectors
// ---------------------------------------------------------------------------
export const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
  len: (a) => Math.hypot(a.x, a.y, a.z),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
  norm(a) {
    const l = Math.hypot(a.x, a.y, a.z);
    return l > 1e-6 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 1 };
  },
  flat(a) {
    const l = Math.hypot(a.x, a.z);
    return l > 1e-6 ? { x: a.x / l, y: 0, z: a.z / l } : { x: 0, y: 0, z: 1 };
  },
  // Distance from p to the segment a→b, and how far along it (0..1) the nearest point is.
  segment(p, a, b) {
    const ab = V.sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z || 1;
    const u = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / l2));
    return { d: V.dist(p, V.add(a, V.mul(ab, u))), u };
  },
};
export function eye(e) {
  try {
    return e.getHeadLocation();
  } catch {
    return { x: e.location.x, y: e.location.y + 1.62, z: e.location.z };
  }
}
export function look(e) {
  try {
    return e.getViewDirection();
  } catch {
    return { x: 0, y: 0, z: 1 };
  }
}
export const mid = (e) => ({ x: e.location.x, y: e.location.y + 0.9, z: e.location.z });

// Blocks you can pass through don't stop projectiles (Block.isSolid isn't in the stable API).
const PASSABLE = /(^|:)(short_grass|tall_grass|grass|fern|large_fern|dead_bush|seagrass|tall_seagrass|kelp|kelp_plant|sugar_cane|vine|.*_vines?|ladder|scaffolding|.*torch|.*_sign|.*banner|.*button|lever|.*rail|redstone_wire|.*carpet|.*pressure_plate|fire|soul_fire|web|snow_layer|.*sapling|.*flower.*|.*tulip|.*orchid|allium|azure_bluet|oxeye_daisy|poppy|dandelion|cornflower|lily_of_the_valley|wither_rose|.*mushroom|wheat|carrots|potatoes|beetroot|sweet_berry_bush|glow_lichen|hanging_roots|pink_petals|nether_sprouts|.*_roots|tripwire.*|structure_void|light_block.*|.*dripleaf.*)$/;
export function solidAt(dim, loc) {
  try {
    const b = dim.getBlock(loc);
    return !!b && !b.isAir && !b.isLiquid && !PASSABLE.test(b.typeId);
  } catch {
    return false;
  }
}
// The first solid block along a ray (or the end of the ray).
export function rayEnd(dim, from, dir, max) {
  for (let d = 0.5; d <= max; d += 0.5) {
    const at = V.add(from, V.mul(dir, d));
    if (solidAt(dim, at)) return { at: V.add(from, V.mul(dir, Math.max(0, d - 0.5))), hit: true, d };
  }
  return { at: V.add(from, V.mul(dir, max)), hit: false, d: max };
}
// The first spot at or below loc with solid ground and two blocks of air above it (never inside rock).
export function ground(dim, loc, down = 24) {
  const y0 = Math.floor(loc.y);
  for (let i = 0; i <= down; i++) {
    const y = y0 - i;
    if (solidAt(dim, { x: loc.x, y, z: loc.z }) && !solidAt(dim, { x: loc.x, y: y + 1, z: loc.z }) && !solidAt(dim, { x: loc.x, y: y + 2, z: loc.z })) {
      return { x: loc.x, y: y + 1, z: loc.z };
    }
  }
  return { x: loc.x, y: loc.y, z: loc.z };
}

// ---------------------------------------------------------------------------
// Particles, sounds, messages, animations
// ---------------------------------------------------------------------------
export const COLOR = {
  blue: [0.3, 0.62, 1], red: [1, 0.22, 0.18], purple: [0.72, 0.36, 1], white: [1, 1, 1], black: [0.02, 0.01, 0.02],
  blood: [0.78, 0.03, 0.08], gold: [1, 0.8, 0.3], fire: [1, 0.5, 0.12], shadow: [0.45, 0.25, 0.75], teal: [0.3, 0.9, 0.8],
  ce: [0.45, 0.6, 1], green: [0.4, 1, 0.55], grey: [0.35, 0.33, 0.38], dark: [0.12, 0.1, 0.14], water: [0.35, 0.65, 1],
};
export function fx(dim, id, loc, color = COLOR.white, size = 1, vars) {
  try {
    const m = new MolangVariableMap();
    m.setColorRGB("variable.color", { red: color[0], green: color[1], blue: color[2] });
    m.setFloat("variable.size", size);
    if (vars) for (const k in vars) m.setFloat(`variable.${k}`, vars[k]);
    dim.spawnParticle(id, loc, m);
  } catch {
    /* chunk not loaded */
  }
}
export function beam(dim, from, dir, len, color, size = 1) {
  fx(dim, "jjk:beam", from, color, size, { dx: dir.x, dy: dir.y, dz: dir.z, len });
}
export function sound(dim, id, loc, volume = 1, pitch = 1) {
  try {
    dim.playSound(id, loc, { volume, pitch });
  } catch {
    /* ignore */
  }
}
const quiet = new Map(); // player id -> tick until which the cursed energy bar leaves the action bar alone
export function bar(p, text, ticks = 40) {
  try {
    p.onScreenDisplay.setActionBar(text);
  } catch {
    /* ignore */
  }
  quiet.set(p.id, now() + ticks);
}
export const barQuietUntil = (p) => quiet.get(p.id) ?? 0;
export function tell(p, text) {
  try {
    p.sendMessage(text);
  } catch {
    /* ignore */
  }
}
export function title(p, text, sub = "", stay = 40) {
  try {
    p.onScreenDisplay.setTitle(text, { subtitle: sub, fadeInDuration: 4, stayDuration: stay, fadeOutDuration: 12 });
  } catch {
    /* ignore */
  }
}
export function anim(e, name) {
  try {
    e.playAnimation(`animation.jjk.${name}`, { blendOutTime: 0.2, stopExpression: "q.any_animation_finished", controller: "jjk.move" });
  } catch {
    /* ignore */
  }
}
export function pvpOn() {
  try {
    return world.gameRules?.pvp !== false;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Effect entities (orbs, the domain barrier, shikigami models): spawned, moved by script, removed when done
// ---------------------------------------------------------------------------
export const FX_IDS = new Set(["jjk:orb", "jjk:domain_dome", "jjk:shrine", "jjk:nue", "jjk:max_elephant"]);
export function spawnFx(dim, id, loc, event) {
  try {
    const e = dim.spawnEntity(id, loc);
    if (event) e.triggerEvent(event);
    return e;
  } catch {
    return undefined;
  }
}
export function removeFx(e) {
  try {
    if (valid(e)) e.remove();
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// One task runner: task(fn) calls fn(age) every tick until it returns false (or maxTicks pass)
// ---------------------------------------------------------------------------
const tasks = [];
export function task(fn, maxTicks = 400) {
  tasks.push({ fn, age: 0, max: maxTicks });
}
export function later(fn, ticks) {
  task((age) => {
    if (age < ticks) return true;
    fn();
    return false;
  }, ticks + 1);
}
export function initTasks() {
  system.runInterval(() => {
    for (let i = tasks.length - 1; i >= 0; i--) {
      const t = tasks[i];
      let keep = false;
      try {
        keep = t.fn(t.age) !== false;
      } catch {
        keep = false;
      }
      t.age++;
      if (!keep || t.age > t.max) tasks.splice(i, 1);
    }
  }, 1);
}
export const taskCount = () => tasks.length;

// ---------------------------------------------------------------------------
// Targets: everything a sorcerer may hurt
// ---------------------------------------------------------------------------
const NOT_TARGETS = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand", "minecraft:painting",
  "minecraft:leash_knot", "minecraft:fishing_hook", "minecraft:ender_crystal", "minecraft:tnt", "minecraft:falling_block",
  "minecraft:minecart", "minecraft:boat", "minecraft:chest_boat", "minecraft:thrown_trident", "minecraft:snowball", "minecraft:egg",
  "minecraft:ender_pearl", "minecraft:area_effect_cloud", "minecraft:lightning_bolt", "minecraft:npc", "minecraft:agent",
  "minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader"]);
// Extra targeting rules (sorcerers.js: allies never hurt players they aren't sparring, villains spare each other...):
// (caster, target) => false forbids the hit.
export const targetRules = [];
// A character NPC's side ("ally" / "villain"), or undefined for anything else.
export const sideOf = (e) => (e?.typeId === "jjk:sorcerer" ? getProp(e, "side") : undefined);
export function nameOf(e) {
  try {
    return e.name ?? (e.nameTag ? e.nameTag.split("\n")[0] : e.typeId);
  } catch {
    return "someone";
  }
}
export function canHit(caster, e) {
  if (!e || !caster || e.id === caster.id || NOT_TARGETS.has(e.typeId) || FX_IDS.has(e.typeId) || !alive(e)) return false;
  for (const rule of targetRules) {
    try {
      if (rule(caster, e) === false) return false;
    } catch {
      /* ignore */
    }
  }
  if (isPlayer(e)) {
    if (isPlayer(caster) && !pvpOn()) return false; // (PvP off stops players' techniques — not curses, villains or Mahoraga)
    const gm = gameMode(e);
    if (gm === "creative" || gm === "spectator") return false;
  }
  if (getProp(e, "owner") === caster.id) return false; // your own shikigami
  if (isPlayer(caster) === false && getProp(caster, "owner") && getProp(caster, "owner") === e.id) return false;
  return !!health(e);
}
export function foes(caster, loc, r, dim = caster.dimension) {
  let list = [];
  try {
    list = dim.getEntities({ location: loc, maxDistance: r, excludeFamilies: ["jjk_fx"] });
  } catch {
    return [];
  }
  return list.filter((e) => canHit(caster, e));
}
// The enemy you're looking at (within max blocks), or the nearest one in a narrow cone in front of you.
export function aimed(p, max, cone = 0.93) {
  try {
    for (const hit of p.getEntitiesFromViewDirection({ maxDistance: max })) {
      if (canHit(p, hit.entity)) return hit.entity;
    }
  } catch {
    /* ignore */
  }
  const from = eye(p);
  const dir = look(p);
  let best;
  let bestD = 1e9;
  for (const e of foes(p, from, max)) {
    const to = V.sub(mid(e), from);
    const d = V.len(to);
    if (d < 0.01) continue;
    const dot = (to.x * dir.x + to.y * dir.y + to.z * dir.z) / d;
    if (dot >= cone && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}
// Everyone in a cone in front of you.
export function inCone(p, max, cone = 0.7) {
  const from = eye(p);
  const dir = look(p);
  return foes(p, from, max).filter((e) => {
    const to = V.sub(mid(e), from);
    const d = V.len(to);
    return d < 1.5 || (to.x * dir.x + to.y * dir.y + to.z * dir.z) / d >= cone;
  });
}
