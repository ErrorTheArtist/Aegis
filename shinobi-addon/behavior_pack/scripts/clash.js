// Jutsu Clash — when two fighters throw jutsu at each other at the same moment (or two jutsu projectiles collide),
// a manga-style cinematic plays (like Naruto's Rasengan meeting Sasuke's Chidori): a wide shot of both charging,
// close-ups over each shoulder, the dash, a white flash at the collision, and a crater torn into the ground.
// Works for players (their own skins) and the Legend / Akatsuki bosses.
//
//   /scriptevent aegis:clash destruction off|on   — turn the crater on/off for the whole world
//   /scriptevent aegis:clash test                  — clash with the nearest player / boss you're looking at

import { world, system } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { sfx, shake, fogFor, setCinematicBusy, inCinematic } from "./cinematic.js";
import { JUTSU_NATURE } from "./natures.js";

let api;
const recent = new Map(); // entity id -> { tick, kind, target id, cost }
const pairCd = new Map(); // "idA|idB" -> tick when the pair may clash again
const active = new Set(); // entity ids inside a clash
const WINDOW = 14; // ticks: both jutsu must be thrown within 0.7s
const PAIR_COOLDOWN = 600; // 30s
const DESTRUCTION_PROP = "aegis:clash_destruction";

const CLASHERS = new Set(["minecraft:player", "aegis:legend", "aegis:akatsuki"]);
const PROTECTED = /bedrock|barrier|command_block|structure_block|structure_void|jigsaw|end_portal|portal|light_block|border_block|allow|deny|reinforced_deepslate|npc_spawner|spawner|chest|barrel|shulker|furnace|hopper|dispenser|dropper|bed|sign|banner|lectern|beacon|respawn_anchor|enchanting|anvil|brewing|campfire|crafter|vault|trial_spawner/;

// ---------------------------------------------------------------------------
// What each kind of jutsu looks like in the clash
// ---------------------------------------------------------------------------
const STYLES = {
  lightning: { color: [0.6, 0.85, 1], hand: "aegis:chidori", anim: "animation.aegis.chidori_charge", sound: "aegis.chidori", name: "Chidori" },
  rasengan: { color: [0.4, 0.75, 1], hand: "aegis:rasengan", anim: "animation.aegis.rasengan_form", sound: "aegis.rasengan", name: "Rasengan" },
  fire: { color: [1, 0.45, 0.1], hand: "aegis:fire_trail", anim: "animation.aegis.rasengan_form", sound: "aegis.fire", name: "Fire Release" },
  water: { color: [0.3, 0.6, 1], hand: "aegis:water_splash", anim: "animation.aegis.rasengan_form", sound: "aegis.charge", name: "Water Release" },
  wind: { color: [0.75, 1, 0.85], hand: "aegis:wind_gust", anim: "animation.aegis.rasengan_form", sound: "aegis.whoosh", name: "Wind Release" },
  earth: { color: [0.65, 0.5, 0.3], hand: "aegis:dust", anim: "animation.aegis.rasengan_form", sound: "aegis.charge", name: "Earth Release" },
  blaze: { color: [0.35, 0.05, 0.45], hand: "aegis:amaterasu", anim: "animation.aegis.chidori_charge", sound: "aegis.fire", name: "Blaze Release" },
  ice: { color: [0.75, 0.92, 1], hand: "aegis:slash", anim: "animation.aegis.rasengan_form", sound: "aegis.charge", name: "Ice Release" },
  wood: { color: [0.5, 0.8, 0.3], hand: "aegis:chakra_aura", anim: "animation.aegis.rasengan_form", sound: "aegis.charge", name: "Wood Release" },
  lava: { color: [1, 0.32, 0.05], hand: "aegis:fire_trail", anim: "animation.aegis.rasengan_form", sound: "aegis.fire", name: "Lava Release" },
  beast: { color: [1, 0.5, 0.1], hand: "aegis:beast_aura", anim: "animation.aegis.rasengan_form", sound: "aegis.charge", name: "Tailed Beast chakra" },
  chakra: { color: [0.5, 0.8, 1], hand: "aegis:chakra_aura", anim: "animation.aegis.rasengan_form", sound: "aegis.charge", name: "Chakra" },
};

export function styleOf(kind = "") {
  const k = String(kind);
  const n = JUTSU_NATURE[k];
  if (/chidori|kirin|lightning|sasuke/.test(k) || n === "lightning") return "lightning";
  if (/sphere|rasen|naruto|minato/.test(k)) return "rasengan";
  if (/blaze|amaterasu|sharingan|mangekyo|itachi/.test(k)) return "blaze";
  if (/ice|yuki/.test(k)) return "ice";
  if (/wood|senju/.test(k)) return "wood";
  if (/lava|boil|terumi/.test(k)) return "lava";
  if (/bijuu|cloak|beast/.test(k)) return "beast";
  if (/fire|phoenix|flame|sarutobi|deidara/.test(k) || n === "fire") return "fire";
  if (/water|kisame|hydrif/.test(k) || n === "water") return "water";
  if (/wind|vacuum/.test(k) || n === "wind") return "wind";
  if (/earth|tsunade/.test(k) || n === "earth") return "earth";
  return "chakra";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cmd(e, c) {
  try {
    e.runCommand(c);
  } catch {
    /* ignore */
  }
}
const f3 = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const up = (a, h) => ({ x: a.x, y: a.y + h, z: a.z });
const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u });
const isPlayer = (e) => e?.typeId === "minecraft:player";

function camera(p, pos, facing, ease = 0) {
  if (!isPlayer(p)) return;
  cmd(p, `camera @s set minecraft:free${ease > 0 ? ` ease ${ease} in_out_sine` : ""} pos ${f3(pos)} facing ${f3(facing)}`);
}

function eff(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}

function passable(dim, loc) {
  try {
    const a = dim.getBlock(loc);
    const b = dim.getBlock(up(loc, 1));
    return (!a || a.isAir || a.isLiquid) && (!b || b.isAir || b.isLiquid);
  } catch {
    return false;
  }
}

function groundY(dim, x, y, z) {
  for (let dy = 1; dy >= -6; dy--) {
    try {
      const b = dim.getBlock({ x, y: Math.floor(y) + dy, z });
      if (b && !b.isAir && !b.isLiquid) return Math.floor(y) + dy + 1;
    } catch {
      return Math.floor(y);
    }
  }
  return Math.floor(y);
}

export const inClash = (e) => active.has(e?.id);
export const destructionOn = () => world.getDynamicProperty(DESTRUCTION_PROP) !== false;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------
function lookTarget(e, range) {
  try {
    return e.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity)
      .find((x) => CLASHERS.has(x.typeId) && x.id !== e.id);
  } catch {
    return undefined;
  }
}

function facing(a, b) {
  try {
    const d = a.getViewDirection();
    const v = api.norm({ x: b.location.x - a.location.x, y: 0, z: b.location.z - a.location.z });
    return api.norm({ x: d.x, y: 0, z: d.z }).x * v.x + api.norm({ x: d.x, y: 0, z: d.z }).z * v.z > 0.6;
  } catch {
    return false;
  }
}

/**
 * Call whenever a fighter throws a jutsu. kind = scroll / ability id (or "legend:naruto" etc.), cost = its chakra cost.
 * target = who it's aimed at (players: worked out from where they look).
 */
export function registerCast(e, kind, cost = 30, target) {
  if (!api || !e || !CLASHERS.has(e.typeId) || active.has(e.id)) return;
  const now = system.currentTick;
  const tgt = target ?? lookTarget(e, 24);
  recent.set(e.id, { tick: now, kind, cost, target: tgt?.id });
  if (!tgt || active.has(tgt.id)) return;
  const other = recent.get(tgt.id);
  if (!other || now - other.tick > WINDOW) return;
  if (other.target && other.target !== e.id) return;
  if (!other.target && !facing(tgt, e)) return;
  if (!isPlayer(e) && !isPlayer(tgt)) return; // bosses don't clash with each other
  if (!isPlayer(e) || !isPlayer(tgt)) {
    if (Math.random() > 0.5) return; // vs a boss, half the time
  }
  const key = [e.id, tgt.id].sort().join("|");
  if ((pairCd.get(key) ?? 0) > now) return;
  pairCd.set(key, now + PAIR_COOLDOWN);
  startClash(tgt, other, e, recent.get(e.id));
}

// Two jutsu projectiles from different casters met in mid-air.
export function projectilesMet(a, b) {
  if (!api || !a?.caster || !b?.caster || a.caster.id === b.caster.id) return false;
  if (!CLASHERS.has(a.caster.typeId) || !CLASHERS.has(b.caster.typeId)) return false;
  if (active.has(a.caster.id) || active.has(b.caster.id)) return false;
  if (!isPlayer(a.caster) && !isPlayer(b.caster)) return false;
  const now = system.currentTick;
  const key = [a.caster.id, b.caster.id].sort().join("|");
  if ((pairCd.get(key) ?? 0) > now) return false;
  pairCd.set(key, now + PAIR_COOLDOWN);
  const ra = recent.get(a.caster.id) ?? { kind: "chakra", cost: 30 };
  const rb = recent.get(b.caster.id) ?? { kind: "chakra", cost: 30 };
  startClash(a.caster, ra, b.caster, rb);
  return true;
}

// ---------------------------------------------------------------------------
// The cinematic
// ---------------------------------------------------------------------------
function handOf(e, dir, perp) {
  if (isPlayer(e)) {
    try {
      return api.handPos(e);
    } catch {
      /* fall through */
    }
  }
  return add(add(e.location, mul(dir, 0.55)), add(mul(perp, -0.35), { x: 0, y: 1.15, z: 0 }));
}

function startClash(A, castA, B, castB) {
  const dim = A.dimension;
  if (B.dimension.id !== dim.id) return;
  const pa0 = { ...A.location };
  const pb0 = { ...B.location };
  const dist = Math.hypot(pb0.x - pa0.x, pb0.z - pa0.z);
  if (dist > 26 || dist < 1) return;
  for (const e of [A, B]) {
    active.add(e.id);
    if (isPlayer(e)) setCinematicBusy(e.id, true);
  }
  const sa = STYLES[styleOf(castA.kind)];
  const sb = STYLES[styleOf(castB.kind)];
  const dir = api.norm({ x: pb0.x - pa0.x, y: 0, z: pb0.z - pa0.z }); // A → B
  const perp = { x: -dir.z, y: 0, z: dir.x };
  const mid = lerp(pa0, pb0, 0.5);
  mid.y = groundY(dim, mid.x, Math.max(pa0.y, pb0.y), mid.z);
  // where they meet (only if there's room, otherwise they stay put and their jutsu meet in the middle)
  const meetA = add(mid, mul(dir, -1.1));
  const meetB = add(mid, mul(dir, 1.1));
  const canDash = passable(dim, meetA) && passable(dim, meetB);
  const players = [A, B].filter(isPlayer);
  const all = [A, B];
  const run = (fn, t) => system.runTimeout(() => {
    try {
      fn();
    } catch {
      /* a participant left — the finish step still runs */
    }
  }, t);
  const ok = (e) => api.isValid(e);
  const chest = (e) => up(e.location, 1.2);
  const face = (e, other) => {
    try {
      e.teleport(e.location, { facingLocation: up(other.location, 1.4) });
    } catch {
      /* ignore */
    }
  };

  // --- setup ---
  for (const e of all) {
    eff(e, "resistance", 150, 4);
    eff(e, "slowness", 90, 255);
    if (isPlayer(e)) cmd(e, "inputpermission set @s movement disabled");
  }
  face(A, B);
  face(B, A);
  for (const p of players) cmd(p, "camera @s fade time 0.08 0.05 0.25 color 255 255 255");
  sfx(dim, "aegis.boom", mid, 1.6, 1.4);
  const nearby = (() => {
    try {
      return dim.getPlayers({ location: mid, maxDistance: 40 });
    } catch {
      return players;
    }
  })();
  for (const p of nearby) showTitle(p, "§l§fCLASH!", { subtitle: `${colorCode(sa.color)}${sa.name} §7vs ${colorCode(sb.color)}${sb.name}`, fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 8 });

  // --- shot 1 (0–28): wide side view, both charging ---
  for (const p of players) {
    camera(p, up(add(mid, mul(perp, 10.5)), 2.4), up(mid, 1.2));
    run(() => camera(p, up(add(mid, mul(perp, 8)), 2.0), up(mid, 1.2), 1.3), 1);
  }
  for (const [e, s] of [[A, sa], [B, sb]]) {
    api.anim(e, s.anim);
    sfx(dim, s.sound, e.location, 1.6, 1);
  }
  for (let t = 0; t < 64; t += 2) {
    run(() => {
      for (const [e, s, other] of [[A, sa, B], [B, sb, A]]) {
        if (!ok(e)) continue;
        const d = api.norm({ x: other.location.x - e.location.x, y: 0, z: other.location.z - e.location.z });
        const pp = { x: -d.z, y: 0, z: d.x };
        const h = handOf(e, d, pp);
        api.particle(dim, s.hand, h, s.color);
        if (t % 6 === 0) api.particle(dim, "aegis:cine_swirl", e.location, s.color);
        if (t % 8 === 0) api.particle(dim, "aegis:cine_bolt", h, s.color);
        if (t % 4 === 0 && !isPlayer(e)) face(e, other); // keep bosses locked on
      }
    }, t);
  }
  run(() => shake(dim, mid, 0.18, 2.8, 24), 4);
  // ground cracks under their feet from the build-up of chakra
  for (const t of [10, 24, 40]) run(() => {
    api.particle(dim, "aegis:dust", A.location);
    api.particle(dim, "aegis:dust", B.location);
  }, t);

  // --- shot 2 (28–46): over A's shoulder toward B ---
  run(() => {
    for (const p of players) {
      const from = up(add(add(A.location, mul(dir, -2.5)), mul(perp, 1.05)), 1.85);
      camera(p, from, chest(B));
      camera(p, up(add(add(A.location, mul(dir, -2.0)), mul(perp, 0.9)), 1.75), chest(B), 0.9);
    }
    sfx(dim, sa.sound, A.location, 1.8, 1.05);
  }, 28);
  // --- shot 3 (46–64): over B's shoulder toward A ---
  run(() => {
    for (const p of players) {
      camera(p, up(add(add(B.location, mul(dir, 2.5)), mul(perp, -1.05)), 1.85), chest(A));
      camera(p, up(add(add(B.location, mul(dir, 2.0)), mul(perp, -0.9)), 1.75), chest(A), 0.9);
    }
    sfx(dim, sb.sound, B.location, 1.8, 1.05);
  }, 46);

  // --- shot 4 (64–80): low wide angle, they dash in ---
  run(() => {
    for (const p of players) camera(p, up(add(add(mid, mul(perp, 6.5)), mul(dir, -1.2)), 0.7), up(mid, 1.4), 0);
    for (const e of all) {
      api.anim(e, "animation.aegis.ram_strike");
      try {
        e.removeEffect("slowness");
      } catch {
        /* ignore */
      }
    }
    sfx(dim, "aegis.whoosh", mid, 2, 0.8);
  }, 64);
  const startA = { ...pa0 };
  const startB = { ...pb0 };
  for (let i = 1; i <= 14; i++) {
    run(() => {
      const u = 1 - (1 - i / 14) ** 2; // fast start, slowing into the hit
      for (const [e, from, to, s, other] of [[A, startA, meetA, sa, B], [B, startB, meetB, sb, A]]) {
        if (!ok(e)) continue;
        const target = canDash ? to : from;
        const pos = lerp(from, target, u);
        try {
          e.teleport(pos, { facingLocation: up(other.location, 1.3) });
        } catch {
          /* ignore */
        }
        api.particle(dim, s.hand, up(pos, 1.1), s.color);
        if (i % 3 === 0) api.particle(dim, "aegis:wind_gust", up(pos, 0.6));
      }
    }, 64 + i);
  }

  // --- impact (80) ---
  run(() => impact(dim, mid, sa, sb, players, nearby), 80);

  // --- aftermath (80–124): camera rises over the crater ---
  run(() => {
    for (const p of players) {
      camera(p, up(add(mid, mul(perp, 7)), 2), up(mid, 0.5));
      camera(p, up(add(mid, mul(perp, 3.5)), 13), mid, 2.0);
    }
  }, 81);
  for (let t = 84; t < 120; t += 6) run(() => {
    api.particle(dim, "aegis:dust", up(mid, 0.5));
    api.particle(dim, "aegis:smoke_puff", add(mid, { x: (Math.random() - 0.5) * 6, y: 0.5, z: (Math.random() - 0.5) * 6 }));
  }, t);
  run(() => resolve(A, castA, B, castB, dir, nearby), 84);

  // --- finish (124) ---
  system.runTimeout(() => {
    for (const e of all) {
      active.delete(e.id);
      if (!isPlayer(e)) continue;
      setCinematicBusy(e.id, false);
      if (!ok(e)) continue;
      cmd(e, "camera @s fade time 0.15 0.1 0.3 color 0 0 0");
      system.runTimeout(() => ok(e) && cmd(e, "camera @s clear"), 4);
      cmd(e, "inputpermission set @s movement enabled");
    }
  }, 124);
}

function colorCode([r, g, b]) {
  if (r > 0.8 && g < 0.6) return "§6";
  if (b > 0.8 && r < 0.7) return "§b";
  if (g > 0.7 && r < 0.6) return "§a";
  if (r < 0.4 && g < 0.2) return "§5";
  if (r > 0.6 && g > 0.6 && b > 0.6) return "§f";
  return "§e";
}

function impact(dim, mid, sa, sb, players, nearby) {
  for (const p of players) cmd(p, "camera @s fade time 0.05 0.25 0.6 color 255 255 255");
  for (const p of nearby) if (!players.includes(p)) cmd(p, "camera @s fade time 0.02 0.05 0.3 color 255 255 255");
  const c = up(mid, 1.3);
  sfx(dim, "aegis.boom", mid, 4, 0.6);
  sfx(dim, "aegis.lightning", mid, 3, 0.7);
  sfx(dim, "aegis.impact", mid, 3, 0.8);
  api.sound(dim, "random.explode", mid, 3, 0.6);
  shake(dim, mid, 2.2, 2.2, 48);
  for (const s of [sa, sb]) {
    api.particle(dim, "aegis:beast_burst", c, s.color);
    api.particle(dim, "aegis:cine_flame", c, s.color);
  }
  for (let k = 0; k < 3; k++) {
    system.runTimeout(() => {
      api.particle(dim, "aegis:cine_ring", up(mid, 0.1), k % 2 ? sb.color : sa.color);
      api.particle(dim, "aegis:cine_swirl", up(mid, 0.05), k % 2 ? sa.color : sb.color);
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        api.particle(dim, "aegis:cine_pillar", add(mid, { x: Math.cos(a) * 2.5, y: 0, z: Math.sin(a) * 2.5 }), i % 2 ? sa.color : sb.color);
      }
      api.particle(dim, "aegis:cine_debris", up(mid, 0.3), [0.6, 0.55, 0.5]);
      api.particle(dim, "aegis:lightning_burst", c);
      api.particle(dim, "aegis:dust", up(mid, 0.2));
    }, k * 4);
  }
  // fog flash for everyone watching
  const tag = `aegis_clash_${Math.floor(Math.random() * 1e6)}`;
  for (const p of nearby) cmd(p, `fog @s push aegis:fog_${fogFor(sa.color)} ${tag}`);
  system.runTimeout(() => {
    for (const p of nearby) if (api.isValid(p)) cmd(p, `fog @s remove ${tag}`);
  }, 50);
  if (destructionOn()) crater(dim, mid, 4.2, 2.4);
}

// Carve a crater, a few layers per tick so it never spikes the server. Protected blocks and containers are skipped;
// the rim is left cracked.
function crater(dim, c, R, D) {
  const cx = Math.floor(c.x);
  const cy = Math.floor(c.y);
  const cz = Math.floor(c.z);
  const layers = [];
  for (let dy = 2; dy >= -Math.ceil(D); dy--) layers.push(dy);
  layers.forEach((dy, i) => {
    system.runTimeout(() => {
      for (let dx = -Math.ceil(R + 1); dx <= Math.ceil(R + 1); dx++) {
        for (let dz = -Math.ceil(R + 1); dz <= Math.ceil(R + 1); dz++) {
          const horiz = Math.hypot(dx, dz);
          const depth = dy < 0 ? (-dy / D) : 0;
          const edge = R * Math.sqrt(Math.max(0, 1 - depth * depth)) + (Math.random() - 0.5) * 0.8;
          let b;
          try {
            b = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
          } catch {
            continue;
          }
          if (!b || b.isAir || PROTECTED.test(b.typeId)) continue;
          if (b.getComponent?.("minecraft:inventory")) continue;
          if (horiz <= edge) {
            try {
              b.setType("minecraft:air");
            } catch {
              /* ignore */
            }
          } else if (horiz <= edge + 1.4 && dy <= 0 && !b.isLiquid && Math.random() < 0.45) {
            try {
              b.setType(Math.random() < 0.5 ? "minecraft:cobblestone" : "minecraft:gravel");   // cracked rim
            } catch {
              /* ignore */
            }
          }
        }
      }
    }, 1 + i);
  });
}

function resolve(A, castA, B, castB, dir, nearby) {
  const power = (e, c) => (c.cost ?? 30) * (1 + (isPlayer(e) ? 0 : 0.4)) * (0.85 + Math.random() * 0.3);
  const pa = power(A, castA);
  const pb = power(B, castB);
  const even = Math.abs(pa - pb) / Math.max(pa, pb) < 0.1;
  const [win, lose] = pa >= pb ? [A, B] : [B, A];
  const hit = (e, frac) => {
    if (!api.isValid(e)) return;
    try {
      const h = e.getComponent("minecraft:health");
      api.hurt(e, Math.min(isPlayer(e) ? 16 : 120, h.effectiveMax * frac), undefined, "entityExplosion");
    } catch {
      /* ignore */
    }
  };
  for (const e of [A, B]) {
    try {
      e.removeEffect("resistance");
    } catch {
      /* ignore */
    }
  }
  if (even) {
    hit(A, 0.2);
    hit(B, 0.2);
  } else {
    hit(lose, 0.3);
    hit(win, 0.08);
  }
  const push = (e, s) => api.isValid(e) && api.knockback(e, dir.x * s, dir.z * s, 2.8, 0.7);
  push(A, -1);
  push(B, 1);
  const name = (e) => (isPlayer(e) ? e.name : e.nameTag || "the enemy");
  for (const p of nearby) {
    if (!api.isValid(p)) continue;
    showTitle(p, even ? "§fEven!" : `§e${name(win)}`, { subtitle: even ? "§7Neither jutsu gives way" : `§7overpowers ${name(lose)}!`, stayDuration: 40, fadeOutDuration: 10 });
  }
}

// ---------------------------------------------------------------------------
export function initClash(helpers) {
  api = helpers;
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [id, r] of recent) if (now - r.tick > 200) recent.delete(id);
    for (const [k, t] of pairCd) if (t < now) pairCd.delete(k);
  }, 200);

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:clash" || p?.typeId !== "minecraft:player") return;
    const [cmd1, arg] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    if (cmd1 === "destruction") {
      world.setDynamicProperty(DESTRUCTION_PROP, arg !== "off");
      return p.sendMessage(`§7Clash craters: ${arg === "off" ? "§coff" : "§aon"}`);
    }
    if (cmd1 === "test") {
      const t = lookTarget(p, 30);
      if (!t) return p.sendMessage("§7Look at a player or boss within 30 blocks.");
      if (inCinematic(p)) return;
      startClash(p, { kind: "aegis:sphere_scroll", cost: 30 }, t, { kind: t.typeId === "aegis:legend" ? `legend:${t.getDynamicProperty("aegis:member")}` : "aegis:chidori_scroll", cost: 35 });
      return;
    }
    p.sendMessage(`§7Clash craters are ${destructionOn() ? "§aon" : "§coff"}§7. /scriptevent aegis:clash destruction on|off · test`);
  });
}
