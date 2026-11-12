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
  if (/fire|phoenix|flame|sarutobi|deidara|tobi/.test(k) || n === "fire") return "fire";
  if (/hidan/.test(k)) return "blaze";
  if (/kakuzu/.test(k)) return "earth";
  if (/zetsu/.test(k)) return "wood";
  if (/konan/.test(k)) return "wind";
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
function handOf(e, dir, perp, style) {
  if (style?.anim === "animation.aegis.chidori_charge" && api.chidoriHand) {
    try {
      return api.chidoriHand(e);
    } catch {
      /* fall through */
    }
  }
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
  const meetA = add(mid, mul(dir, -1.1));
  const meetB = add(mid, mul(dir, 1.1));
  const canDash = passable(dim, meetA) && passable(dim, meetB);
  const players = [A, B].filter(isPlayer);
  const all = [A, B];
  const name = (e) => (isPlayer(e) ? e.name : e.nameTag || "???");
  const nearby = (() => {
    try {
      return dim.getPlayers({ location: mid, maxDistance: 48 });
    } catch {
      return players;
    }
  })();
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
  // camera position around a fighter: angle (degrees) from the line toward the opponent, distance, height
  const orbit = (e, toward, deg, d, h) => {
    const a = (deg * Math.PI) / 180;
    const x = toward.x * Math.cos(a) - toward.z * Math.sin(a);
    const z = toward.x * Math.sin(a) + toward.z * Math.cos(a);
    return { x: e.location.x + x * d, y: e.location.y + h, z: e.location.z + z * d };
  };
  const tagFog = `aegis_clash_${Math.floor(Math.random() * 1e6)}`;
  const fog = (color) => {
    for (const p of nearby) {
      if (!ok(p)) continue;
      cmd(p, `fog @s remove ${tagFog}`);
      cmd(p, `fog @s push aegis:fog_${fogFor(color)} ${tagFog}`);
    }
  };
  const title = (t, sub, stay = 40) => {
    for (const p of nearby) if (ok(p)) showTitle(p, t, { subtitle: sub, fadeInDuration: 6, stayDuration: stay, fadeOutDuration: 10 });
  };
  const END = 340;

  // ===== setup =====
  for (const e of all) {
    eff(e, "resistance", END + 10, 4);
    eff(e, "slowness", 210, 255);
    if (isPlayer(e)) cmd(e, "inputpermission set @s movement disabled");
  }
  face(A, B);
  face(B, A);
  // keep both locked facing each other until the dash
  for (let t = 2; t < 205; t += 4) run(() => {
    if (ok(A) && ok(B)) {
      if (!isPlayer(A)) face(A, B);
      if (!isPlayer(B)) face(B, A);
    }
  }, t);

  // ===== 0–50: the standoff =====
  for (const p of players) {
    cmd(p, "camera @s fade time 0 0.5 0.9 color 0 0 0");
    camera(p, up(add(mid, mul(perp, 15)), 7), up(mid, 1));
    run(() => camera(p, up(add(mid, mul(perp, 10.5)), 2.4), up(mid, 1.2), 2.4), 2);
  }
  sfx(dim, "aegis.clash_wind", mid, 2.5, 1);
  run(() => title("§l§fJUTSU CLASH", `${colorCode(sa.color)}${name(A)} §7vs ${colorCode(sb.color)}${name(B)}`, 45), 8);
  for (let t = 0; t < 50; t += 5) run(() => {
    const u = Math.random();
    api.particle(dim, "aegis:dust", lerp(A.location, B.location, u));
    api.particle(dim, "aegis:wind_gust", up(lerp(A.location, B.location, Math.random()), 0.4));
  }, t);

  // ===== 50–170: each fighter powers up (like the Tailed Beast transformation) =====
  const powerUp = (e, other, s, t0) => {
    const toward = () => api.norm({ x: other.location.x - e.location.x, y: 0, z: other.location.z - e.location.z });
    run(() => {
      fog(s.color);
      title(`${colorCode(s.color)}§l${s.name}`, `§7${name(e)}`, 45);
      sfx(dim, "aegis.clash_charge", e.location, 2.2, 1);
      sfx(dim, s.sound, e.location, 1.6, 1);
      for (const p of players) {
        camera(p, orbit(e, toward(), 40, 5, 1.9), chest(e));
        camera(p, orbit(e, toward(), -15, 4, 1.4), chest(e), 1.4);
      }
    }, t0);
    run(() => {
      for (const p of players) camera(p, orbit(e, toward(), -70, 3.3, 1.0), up(e.location, 1.5), 1.3);
    }, t0 + 30);
    for (let k = 0; k < 4; k++) run(() => api.anim(e, s.anim), t0 + k * 16);
    run(() => shake(dim, e.location, 0.25, 3, 24), t0 + 4);
    for (let t = 0; t < 60; t += 3) {
      run(() => {
        const c = e.location;
        const h = handOf(e, toward(), { x: -toward().z, y: 0, z: toward().x }, s);
        for (let n = 0; n < 2; n++) {
          const a = Math.random() * Math.PI * 2;
          const r = 1.8 + Math.random() * 2;
          api.particle(dim, "aegis:cine_pillar", add(c, { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }), s.color);
        }
        api.particle(dim, "aegis:cine_bolt", up(c, 1.1), s.color);
        api.particle(dim, s.hand, h, s.color);
        api.particle(dim, "aegis:beast_aura", c, s.color);
        if (t % 6 === 0) api.particle(dim, "aegis:cine_swirl", c, s.color);
        if (t % 9 === 0) api.particle(dim, "aegis:cine_debris", c, [0.6, 0.55, 0.5]);
        if (t === 12 || t === 30 || t === 48) api.particle(dim, "aegis:cine_flame", up(c, 1), s.color);
        if (t % 12 === 0) sfx(dim, "aegis.lightning", c, 1.2, 0.9 + Math.random() * 0.3);
      }, t0 + t);
    }
    run(() => {
      api.particle(dim, "aegis:beast_burst", up(e.location, 1.1), s.color);
      api.particle(dim, "aegis:cine_ring", e.location, s.color);
      sfx(dim, "aegis.transform", e.location, 2, 1);
    }, t0 + 56);
  };
  powerUp(A, B, sa, 50);
  powerUp(B, A, sb, 110);

  // ===== 170–195: face-off — both blazing, lightning arcs between them, heartbeats =====
  run(() => {
    fog(mixColor(sa.color, sb.color));
    for (const p of players) {
      camera(p, up(add(mid, mul(perp, 11)), 2.2), up(mid, 1.3));
      camera(p, up(add(mid, mul(perp, 7)), 1.6), up(mid, 1.3), 1.25);
    }
    sfx(dim, "aegis.clash_heartbeat", mid, 2.5, 1);
    shake(dim, mid, 0.5, 1.4, 32);
  }, 170);
  run(() => sfx(dim, "aegis.clash_heartbeat", mid, 2.8, 0.95), 184);
  for (let t = 170; t < 195; t += 2) run(() => {
    for (const [e, s] of [[A, sa], [B, sb]]) {
      api.particle(dim, "aegis:beast_aura", e.location, s.color);
      api.particle(dim, s.hand, up(e.location, 1.2), s.color);
    }
    const u = Math.random();
    api.particle(dim, "aegis:cine_bolt", up(lerp(A.location, B.location, u), 1.2), u < 0.5 ? sa.color : sb.color);
  }, t);

  // ===== 195–205: cut to black =====
  run(() => {
    for (const p of players) cmd(p, "camera @s fade time 0.15 0.35 0.2 color 0 0 0");
    sfx(dim, "aegis.clash_heartbeat", mid, 3, 0.9);
  }, 195);

  // ===== 205–225: the dash =====
  run(() => {
    for (const p of players) {
      camera(p, up(add(add(mid, mul(perp, 7.5)), mul(dir, -3)), 0.6), up(mid, 1.3));
      camera(p, up(add(mid, mul(perp, 6)), 0.8), up(mid, 1.3), 1.0);
    }
    for (const e of all) {
      api.anim(e, "animation.aegis.ram_strike");
      try {
        e.removeEffect("slowness");
      } catch {
        /* ignore */
      }
    }
    sfx(dim, "aegis.clash_dash", mid, 2.5, 1);
  }, 205);
  const startA = { ...pa0 };
  const startB = { ...pb0 };
  for (let i = 1; i <= 20; i++) {
    run(() => {
      const u = i / 20;
      const k = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      for (const [e, from, to, s, other] of [[A, startA, meetA, sa, B], [B, startB, meetB, sb, A]]) {
        if (!ok(e)) continue;
        const pos = lerp(from, canDash ? to : from, k);
        try {
          e.teleport(pos, { facingLocation: up(other.location, 1.3) });
        } catch {
          /* ignore */
        }
        api.particle(dim, s.hand, up(pos, 1.1), s.color);
        api.particle(dim, "aegis:fire_trail", up(pos, 0.9), s.color);
        if (i % 2 === 0) api.particle(dim, "aegis:wind_gust", up(pos, 0.6));
        if (i % 4 === 0) api.particle(dim, "aegis:dust", pos);
      }
    }, 205 + i);
  }

  // ===== 225–275: the struggle — the two jutsu grind against each other =====
  const clashPt = up(mid, 1.25);
  run(() => {
    for (const p of players) {
      cmd(p, "camera @s fade time 0.03 0.08 0.25 color 255 255 255");
      camera(p, add(up(add(mid, mul(perp, 4.2)), 1.7), mul(dir, 0.3)), clashPt);
      camera(p, add(up(add(mid, mul(perp, 2.8)), 1.4), mul(dir, 0.2)), clashPt, 2.4);
    }
    sfx(dim, "aegis.clash_struggle", mid, 3, 1);
    sfx(dim, "aegis.impact", mid, 2.5, 1.2);
    api.particle(dim, "aegis:cine_ring", up(mid, 0.1), sa.color);
  }, 225);
  for (const t of [225, 240, 255]) run(() => {
    for (const e of all) api.anim(e, "animation.aegis.palm_thrust");
  }, t);
  for (let t = 226; t < 275; t += 2) {
    run(() => {
      const sideA = add(clashPt, mul(dir, -0.25));
      const sideB = add(clashPt, mul(dir, 0.25));
      api.particle(dim, sa.hand, sideA, sa.color);
      api.particle(dim, sb.hand, sideB, sb.color);
      api.particle(dim, "aegis:chidori", clashPt);
      if (t % 4 === 0) api.particle(dim, "aegis:beast_aura", up(mid, 0.2), t % 8 ? sa.color : sb.color);
      if (t % 6 === 0) api.particle(dim, "aegis:cine_bolt", clashPt, t % 12 ? sa.color : sb.color);
      if (t % 10 === 0) api.particle(dim, "aegis:cine_ring", up(mid, 0.1), t % 20 ? sb.color : sa.color);
      if (t % 10 === 0) shake(dim, mid, 0.3 + (t - 226) / 60, 0.6, 32);
      if (t % 12 === 0) fog(t % 24 ? sb.color : sa.color);
      if (t % 8 === 0) api.particle(dim, "aegis:cine_debris", up(mid, 0.2), [0.6, 0.55, 0.5]);
    }, t);
  }

  // ===== 275: EXPLOSION =====
  run(() => impact(dim, mid, sa, sb, players, nearby, tagFog), 275);
  run(() => {
    for (const p of players) {
      camera(p, up(add(mid, mul(perp, 12)), 3), up(mid, 1));
      camera(p, up(add(mid, mul(perp, 4)), 16), mid, 3.2);
    }
  }, 277);
  run(() => resolve(A, castA, B, castB, dir, nearby), 280);
  for (let t = 284; t < 335; t += 5) run(() => {
    api.particle(dim, "aegis:smoke_puff", add(mid, { x: (Math.random() - 0.5) * 7, y: 0.4, z: (Math.random() - 0.5) * 7 }));
    api.particle(dim, "aegis:dust", up(mid, 0.4));
    if (t % 10 === 4) api.particle(dim, "aegis:fire_trail", add(mid, { x: (Math.random() - 0.5) * 5, y: 0.3, z: (Math.random() - 0.5) * 5 }));
  }, t);

  // ===== finish =====
  system.runTimeout(() => {
    for (const p of nearby) if (ok(p)) cmd(p, `fog @s remove ${tagFog}`);
    for (const e of all) {
      active.delete(e.id);
      if (!isPlayer(e)) continue;
      setCinematicBusy(e.id, false);
      if (!ok(e)) continue;
      cmd(e, "camera @s fade time 0.2 0.15 0.4 color 0 0 0");
      system.runTimeout(() => ok(e) && cmd(e, "camera @s clear"), 5);
      cmd(e, "inputpermission set @s movement enabled");
    }
  }, END);
}

function mixColor(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function colorCode([r, g, b]) {
  if (r > 0.8 && g < 0.6) return "§6";
  if (b > 0.8 && r < 0.7) return "§b";
  if (g > 0.7 && r < 0.6) return "§a";
  if (r < 0.4 && g < 0.2) return "§5";
  if (r > 0.6 && g > 0.6 && b > 0.6) return "§f";
  return "§e";
}

function impact(dim, mid, sa, sb, players, nearby, tagFog) {
  for (const p of players) cmd(p, "camera @s fade time 0.05 0.6 1.3 color 255 255 255");
  for (const p of nearby) if (!players.includes(p)) cmd(p, "camera @s fade time 0.03 0.15 0.5 color 255 255 255");
  const c = up(mid, 1.3);
  sfx(dim, "aegis.clash_impact", mid, 5, 1);
  sfx(dim, "aegis.clash_ring", mid, 2.5, 1);
  sfx(dim, "aegis.boom", mid, 3, 0.55);
  api.sound(dim, "random.explode", mid, 3, 0.5);
  shake(dim, mid, 2.6, 2.6, 56);
  for (const p of nearby) {
    if (!api.isValid(p)) continue;
    cmd(p, `fog @s remove ${tagFog}`);
    cmd(p, `fog @s push aegis:fog_${fogFor(mixColor(sa.color, sb.color))} ${tagFog}`);
  }
  for (let k = 0; k < 8; k++) {
    system.runTimeout(() => {
      const col = k % 2 ? sb.color : sa.color;
      api.particle(dim, "aegis:cine_ring", up(mid, 0.1 + k * 0.05), col);
      if (k < 4) {
        api.particle(dim, "aegis:beast_burst", c, col);
        api.particle(dim, "aegis:fire_burst", c);
      }
      api.particle(dim, "aegis:cine_flame", up(c, k * 0.4), col);
      api.particle(dim, "aegis:cine_swirl", up(mid, 0.05), col);
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 4;
        api.particle(dim, "aegis:cine_pillar", add(mid, { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }), col);
      }
      api.particle(dim, "aegis:cine_debris", up(mid, 0.3), [0.6, 0.55, 0.5]);
      api.particle(dim, "aegis:lightning_burst", c);
      api.particle(dim, "aegis:dust", up(mid, 0.2));
      api.particle(dim, "aegis:smoke_puff", up(mid, 0.5));
    }, k * 3);
  }
  if (destructionOn()) crater(dim, mid, 4.6, 2.6);
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
