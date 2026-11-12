// Jutsu Clash — when two fighters throw jutsu at each other at the same moment (or two jutsu projectiles collide),
// a cinematic plays, staged like Naruto's Rasengan meeting Sasuke's Chidori:
//   the standoff → each fighter gathers their jutsu (hero shot, then close on the hand) → the eyes, cutting faster →
//   black → both sprint (tracking shots) → they leap → the jutsu meet in mid-air → a dome of chakra swells around
//   them as they strain against each other → it bursts, hurls them apart and tears a crater → who is left standing.
// The choreography and every camera position live in clash_shots.js and are storyboarded offline with
// tools/cine_preview.py. Works for players (their own skins) and the Legend / Akatsuki bosses.
//
//   /scriptevent aegis:clash destruction off|on   — turn the crater on/off for the whole world
//   /scriptevent aegis:clash test                  — clash with the nearest player / boss you're looking at

import { world, system } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { sfx, shake, fogFor, setCinematicBusy, inCinematic } from "./cinematic.js";
import { JUTSU_NATURE } from "./natures.js";
import { STAGE, T, PATH, ANIMS, FAMILY_ANIMS, POSES, SHOTS } from "./clash_shots.js";

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
  lightning: { color: [0.6, 0.85, 1], hand: "aegis:chidori", family: "chidori", sound: "aegis.chidori", name: "Chidori" },
  rasengan: { color: [0.4, 0.75, 1], hand: "aegis:rasengan", family: "orb", sound: "aegis.rasengan", name: "Rasengan" },
  fire: { color: [1, 0.45, 0.1], hand: "aegis:fire_trail", family: "orb", sound: "aegis.fire", name: "Fire Release" },
  water: { color: [0.3, 0.6, 1], hand: "aegis:water_splash", family: "orb", sound: "aegis.charge", name: "Water Release" },
  wind: { color: [0.75, 1, 0.85], hand: "aegis:wind_gust", family: "orb", sound: "aegis.whoosh", name: "Wind Release" },
  earth: { color: [0.65, 0.5, 0.3], hand: "aegis:dust", family: "orb", sound: "aegis.charge", name: "Earth Release" },
  blaze: { color: [0.35, 0.05, 0.45], hand: "aegis:amaterasu", family: "chidori", sound: "aegis.fire", name: "Blaze Release" },
  ice: { color: [0.75, 0.92, 1], hand: "aegis:slash", family: "orb", sound: "aegis.charge", name: "Ice Release" },
  wood: { color: [0.5, 0.8, 0.3], hand: "aegis:chakra_aura", family: "orb", sound: "aegis.charge", name: "Wood Release" },
  lava: { color: [1, 0.32, 0.05], hand: "aegis:fire_trail", family: "orb", sound: "aegis.fire", name: "Lava Release" },
  beast: { color: [1, 0.5, 0.1], hand: "aegis:beast_aura", family: "orb", sound: "aegis.charge", name: "Tailed Beast chakra" },
  chakra: { color: [0.5, 0.8, 1], hand: "aegis:chakra_aura", family: "orb", sound: "aegis.charge", name: "Chakra" },
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
const EASES = { lin: (u) => u, in: (u) => u * u, out: (u) => 1 - (1 - u) ** 2, io: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u) };

// Who wins is settled the moment the jutsu are thrown (the final shot needs to know); the damage lands at the burst.
function decide(A, castA, B, castB) {
  const power = (e, c) => (c.cost ?? 30) * (1 + (isPlayer(e) ? 0 : 0.4)) * (0.85 + Math.random() * 0.3);
  const pa = power(A, castA);
  const pb = power(B, castB);
  const even = Math.abs(pa - pb) / Math.max(pa, pb) < 0.1;
  return { even, win: pa >= pb ? "A" : "B", lose: pa >= pb ? "B" : "A" };
}

function clearColumn(dim, at, from, to) {
  for (let y = from; y <= to; y++) {
    try {
      const b = dim.getBlock({ x: at.x, y: at.y + y, z: at.z });
      if (b && !b.isAir && !b.isLiquid) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function startClash(A, castA, B, castB) {
  const dim = A.dimension;
  if (B.dimension.id !== dim.id) return;
  const pa0 = { ...A.location };
  const pb0 = { ...B.location };
  const dist = Math.hypot(pb0.x - pa0.x, pb0.z - pa0.z);
  if (dist > 26 || dist < 1) return;
  const F = { A, B };
  const S = { A: STYLES[styleOf(castA.kind)], B: STYLES[styleOf(castB.kind)] };
  const all = [A, B];
  const players = all.filter(isPlayer);
  for (const e of all) {
    active.add(e.id);
    if (isPlayer(e)) setCinematicBusy(e.id, true);
  }
  const outcome = decide(A, castA, B, castB);

  // ----- the stage -----
  const dir = api.norm({ x: pb0.x - pa0.x, y: 0, z: pb0.z - pa0.z }); // A → B
  const perp = { x: -dir.z, y: 0, z: dir.x }; // the camera's side (A's right hand)
  const mid = lerp(pa0, pb0, 0.5);
  mid.y = groundY(dim, mid.x, Math.max(pa0.y, pb0.y), mid.z);
  const sign = { A: -1, B: 1 };
  const spotAt = (who, d) => {
    const p = add(mid, mul(dir, sign[who] * d));
    p.y = groundY(dim, p.x, mid.y + 1, p.z);
    return p;
  };
  const standable = (p) => Math.abs(p.y - mid.y) <= 2 && passable(dim, p);
  const start = dist / 2;
  const canMeet = passable(dim, spotAt("A", STAGE.strike)) && passable(dim, spotAt("B", STAGE.strike));
  let H = Math.max(start, STAGE.half);
  if (!canMeet || !standable(spotAt("A", H)) || !standable(spotAt("B", H))) H = start; // no room to spring apart
  const air = canMeet && clearColumn(dim, mid, 1, Math.ceil(STAGE.air + 3)) ? STAGE.air : 0;
  const back = standable(spotAt("A", STAGE.back)) && standable(spotAt("B", STAGE.back)) ? STAGE.back : H;
  const baseY = { A: spotAt("A", H).y, B: spotAt("B", H).y };
  const val = (v) => (v === "start" ? start : v === "H" ? H : v === "air" ? air : v === "back" ? back : v);

  // where a fighter is at a tick: distance from the middle and height (clash_shots.js PATH)
  const pathAt = (tick) => {
    if (!canMeet) return { d: tick < T.apart ? start + (H - start) * (tick / T.apart) : H, h: 0 };
    if (tick <= PATH[0].t) return { d: val(PATH[0].d), h: val(PATH[0].h) };
    for (let i = 1; i < PATH.length; i++) {
      const a = PATH[i - 1];
      const b = PATH[i];
      if (tick > b.t) continue;
      const u = (tick - a.t) / (b.t - a.t);
      const e = EASES[b.ease ?? "lin"](u);
      return { d: val(a.d) + (val(b.d) - val(a.d)) * e, h: val(a.h) + (val(b.h) - val(a.h)) * e + (b.arc ?? 0) * 4 * u * (1 - u) };
    }
    const z = PATH[PATH.length - 1];
    return { d: val(z.d), h: val(z.h) };
  };
  const feet = (who, tick) => {
    const { d, h } = pathAt(tick);
    const p = add(mid, mul(dir, sign[who] * d));
    p.y = mid.y + (baseY[who] - mid.y) * Math.min(1, d / Math.max(H, 0.01)) + h;
    return p;
  };
  // which pose a fighter is in at a tick (for the hand / head anchors)
  const poseAt = (who, tick) => {
    let key = "ready";
    for (const [t, target, k] of ANIMS) {
      if (t > tick) continue;
      if (target === "both" || target === who || (!outcome.even && ((target === "W" && who === outcome.win) || (target === "L" && who === outcome.lose)))) key = k;
    }
    if (!canMeet && ["run", "leap", "recoil", "land", "rise", "kneel"].includes(key)) key = "hold";
    return FAMILY_ANIMS.includes(key) ? `${key}_${S[who].family}` : key;
  };
  // an anchor from the shot list → a point in the world
  const anchor = (a, tick) => {
    const [name, f, p, h0, airK] = a;
    const h = h0 + (airK ?? 0) * air;
    if (name === "M") return add(add(mid, mul(dir, f)), add(mul(perp, p), { x: 0, y: h, z: 0 }));
    const who = name[0] === "W" ? outcome.win : name[0] === "L" ? outcome.lose : name[0];
    const part = name.slice(1);
    const off = part ? (POSES[poseAt(who, tick)]?.[part] ?? [0, 0, 1]) : [0, 0, 0];
    const base = feet(who, tick);
    return add(add(base, mul(dir, -sign[who] * (f + off[0]))), add(mul(perp, p + off[1]), { x: 0, y: h + off[2], z: 0 }));
  };
  const handAt = (who, tick) => anchor([`${who}hand`, 0, 0, 0], tick);

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
  }, Math.max(1, t));
  const ok = (e) => api.isValid(e);
  const tagFog = `aegis_clash_${Math.floor(Math.random() * 1e6)}`;
  const fog = (color) => {
    for (const p of nearby) {
      if (!ok(p)) continue;
      cmd(p, `fog @s remove ${tagFog}`);
      cmd(p, `fog @s push aegis:fog_${fogFor(color)} ${tagFog}`);
    }
  };
  const title = (t, sub, stay = 40) => {
    for (const p of nearby) if (ok(p)) showTitle(p, t, { subtitle: sub, fadeInDuration: 4, stayDuration: stay, fadeOutDuration: 10 });
  };
  const clashPt = add(mid, { x: 0, y: air + STAGE.hit, z: 0 });
  const mixed = mixColor(S.A.color, S.B.color);

  // ===== setup =====
  for (const e of all) {
    eff(e, "resistance", T.end + 10, 4);
    eff(e, "slowness", T.run, 255);
    if (!isPlayer(e)) continue;
    cmd(e, "inputpermission set @s movement disabled");
    cmd(e, "inputpermission set @s camera disabled");
    cmd(e, "hud @s hide all");
    cmd(e, "camera @s fade time 0 0.3 0.7 color 0 0 0");
  }

  // ===== the fighters: positions every tick while they move, animations from the list =====
  const place = (tick) => {
    for (const who of ["A", "B"]) {
      const e = F[who];
      if (!ok(e)) continue;
      const other = feet(who === "A" ? "B" : "A", tick);
      try {
        e.teleport(feet(who, tick), { facingLocation: { x: other.x, y: other.y + 1.5, z: other.z }, keepVelocity: false });
      } catch {
        /* ignore */
      }
    }
  };
  place(0);
  for (let t = 1; t <= T.land + 2; t++) {
    const moving = t <= T.apart + 1 || (canMeet && t >= T.run);
    if (moving || t % 5 === 0) run(() => place(t), t);
  }
  if (canMeet && air > 0) run(() => all.forEach((e) => eff(e, "slow_falling", T.land - T.leap + 20, 0)), T.leap - 2);
  run(() => all.forEach((e) => {
    try {
      e.removeEffect("slowness");
    } catch {
      /* ignore */
    }
  }), T.run - 1);
  for (const [t, target, key] of ANIMS) {
    for (const who of ["A", "B"]) {
      const mine = target === "both" || target === who || (!outcome.even && ((target === "W" && who === outcome.win) || (target === "L" && who === outcome.lose)));
      if (!mine) continue;
      if (!canMeet && ["run", "leap", "recoil", "land", "rise", "kneel"].includes(key)) continue;
      const id = `animation.aegis.clash_${FAMILY_ANIMS.includes(key) ? `${key}_${S[who].family}` : key}${who === "B" ? "_m" : ""}`;
      run(() => ok(F[who]) && api.anim(F[who], id), t);
    }
  }

  // ===== the camera (participants only) =====
  for (let i = 0; i < SHOTS.length; i++) {
    const shot = outcome.even && SHOTS[i].even ? { ...SHOTS[i], ...SHOTS[i].even } : SHOTS[i];
    const next = SHOTS[i + 1]?.t ?? T.release;
    const go = (tick, ease) => {
      const pos = anchor(shot.pos, tick);
      const look = anchor(shot.look, tick);
      for (const p of players) if (ok(p)) cmd(p, `camera @s set minecraft:free${ease ? ` ease ${ease} in_out_sine` : ""} pos ${f3(pos)} facing ${f3(look)}`);
    };
    if (shot.t === 0) go(0, 0);
    else run(() => go(shot.t + (shot.ease ? Math.round(shot.ease * 20) : 0), shot.ease), shot.t);
    if (shot.track) for (let t = shot.t + 2; t < next; t += 2) run(() => go(t + 2, 0.1), t);
  }

  // ===== 1. the standoff =====
  sfx(dim, "aegis.clash_wind", mid, 2.5, 1);
  run(() => title("§l§fJUTSU CLASH", `${colorCode(S.A.color)}${name(A)} §7vs ${colorCode(S.B.color)}${name(B)}`, 22), 6);
  for (let t = 0; t < T.chargeA; t += 4) run(() => {
    api.particle(dim, "aegis:dust", lerp(feet("A", t), feet("B", t), Math.random()));
    api.particle(dim, "aegis:wind_gust", up(lerp(feet("A", t), feet("B", t), Math.random()), 0.4));
    if (t < T.apart) for (const who of ["A", "B"]) api.particle(dim, "aegis:dust", feet(who, t));
  }, t);

  // ===== 2–5. each gathers their jutsu =====
  const gather = (who, t0) => {
    const s = S[who];
    run(() => {
      fog(s.color);
      title(`${colorCode(s.color)}§l${s.name}`, `§7${name(F[who])}`, 30);
      sfx(dim, "aegis.clash_charge", feet(who, t0), 2.2, 1);
      sfx(dim, s.sound, feet(who, t0), 1.6, 1);
      shake(dim, feet(who, t0), 0.25, 2.2, 24);
    }, t0);
    for (let t = 6; t < 45; t += 3) {
      run(() => {
        const c = feet(who, t0 + t);
        for (let n = 0; n < 2; n++) {
          const a = Math.random() * Math.PI * 2;
          const r = 1.6 + Math.random() * 2;
          api.particle(dim, "aegis:cine_pillar", add(c, { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }), s.color);
        }
        api.particle(dim, "aegis:cine_bolt", up(c, 1.1), s.color);
        api.particle(dim, "aegis:beast_aura", c, s.color);
        if (t % 6 === 0) api.particle(dim, "aegis:cine_swirl", c, s.color);
        if (t % 9 === 0) api.particle(dim, "aegis:cine_debris", c, [0.6, 0.55, 0.5]);
        if (t % 12 === 0) sfx(dim, "aegis.lightning", c, 1.1, 0.9 + Math.random() * 0.3);
      }, t0 + t);
    }
    run(() => {
      api.particle(dim, "aegis:beast_burst", handAt(who, t0 + 40), s.color);
      api.particle(dim, "aegis:cine_ring", feet(who, t0 + 40), s.color);
      sfx(dim, "aegis.transform", feet(who, t0 + 40), 1.6, 1.1);
    }, t0 + 40);
    // from now until the burst the jutsu burns in their hand
    for (let t = t0 + 8; t < T.burst; t += 2) {
      run(() => {
        const h = handAt(who, t);
        api.particle(dim, s.hand, h, s.color);
        if (t % 4 === 0) api.particle(dim, "aegis:chakra_aura", h, s.color);
        if (t % 6 === 0 && t < T.run) api.particle(dim, "aegis:beast_aura", feet(who, t), s.color);
      }, t);
    }
  };
  gather("A", T.chargeA);
  gather("B", T.chargeB);

  // ===== 6–9. the eyes =====
  run(() => fog(mixed), T.eyes);
  for (const [dt, vol, pitch] of [[0, 2.4, 1], [11, 2.6, 1], [20, 2.8, 0.97], [26, 3, 0.94]]) run(() => sfx(dim, "aegis.clash_heartbeat", mid, vol, pitch), T.eyes + dt);
  run(() => {
    for (const p of players) cmd(p, "camera @s fade time 0.1 0.15 0.15 color 0 0 0");
  }, T.black);

  // ===== 10–12. the charge and the leap =====
  if (canMeet) {
    run(() => {
      sfx(dim, "aegis.clash_dash", mid, 2.5, 1);
      shake(dim, mid, 0.3, 1.4, 32);
    }, T.run);
    for (let t = T.run; t < T.impact; t += 2) {
      run(() => {
        for (const who of ["A", "B"]) {
          const p = feet(who, t);
          api.particle(dim, "aegis:fire_trail", up(p, 0.9), S[who].color);
          api.particle(dim, "aegis:wind_gust", up(p, 0.6));
          if (t < T.leap) api.particle(dim, "aegis:dust", { x: p.x, y: mid.y, z: p.z });
        }
      }, t);
    }
    run(() => {
      sfx(dim, "aegis.whoosh", mid, 2.5, 0.7);
      for (const who of ["A", "B"]) {
        const p = feet(who, T.leap);
        api.particle(dim, "aegis:cine_ring", p, S[who].color);
        api.particle(dim, "aegis:cine_debris", p, [0.6, 0.55, 0.5]);
      }
    }, T.leap);
  }

  // ===== 13–15. impact: the dome swells while they strain =====
  run(() => {
    for (const p of players) cmd(p, "camera @s fade time 0.03 0.06 0.2 color 255 255 255");
    sfx(dim, "aegis.clash_struggle", clashPt, 3, 1);
    sfx(dim, "aegis.impact", clashPt, 2.5, 1.2);
    sfx(dim, "aegis.dome", clashPt, 3, 1);
    shake(dim, mid, 0.9, 0.5, 32);
    api.particle(dim, "aegis:beast_burst", clashPt, mixed);
    api.particle(dim, "aegis:cine_ring", up(mid, 0.1), S.A.color);
    try {
      const orb = dim.spawnEntity("aegis:clash_orb", clashPt);
      orb.setProperty("aegis:cr", Math.min(1, mixed[0] + 0.15));
      orb.setProperty("aegis:cg", Math.min(1, mixed[1] + 0.15));
      orb.setProperty("aegis:cb", Math.min(1, mixed[2] + 0.15));
      system.runTimeout(() => api.isValid(orb) && orb.remove(), T.burst - T.impact + 7);
    } catch {
      /* ignore */
    }
  }, T.impact);
  run(() => sfx(dim, "aegis.clash_dash", clashPt, 2, 0.6), T.impact + 15); // the dome surges out
  for (let t = T.impact + 1; t < T.burst; t += 2) {
    run(() => {
      const k = (t - T.impact) / (T.burst - T.impact);
      api.particle(dim, "aegis:chidori", clashPt);
      if (t % 4 === 0) api.particle(dim, "aegis:cine_bolt", clashPt, t % 8 ? S.A.color : S.B.color);
      if (t % 6 === 0) api.particle(dim, "aegis:lightning_burst", clashPt);
      if (t % 8 === 0) api.particle(dim, "aegis:cine_ring", up(mid, 0.1), t % 16 ? S.B.color : S.A.color);
      if (t % 8 === 0) api.particle(dim, "aegis:cine_debris", up(mid, 0.2), [0.6, 0.55, 0.5]);
      if (t % 10 === 0) shake(dim, mid, 0.3 + k * 0.9, 0.6, 32);
      if (t % 12 === 0) fog(t % 24 ? S.B.color : S.A.color);
    }, t);
  }
  run(() => sfx(dim, "aegis.clash_heartbeat", mid, 3, 0.9), T.burst - 12);

  // ===== 16. the burst =====
  run(() => impact(dim, mid, clashPt, S.A, S.B, players, nearby, tagFog), T.burst);
  run(() => resolve(A, B, outcome), T.burst + 3);
  for (let t = T.burst + 8; t < T.release; t += 5) run(() => {
    api.particle(dim, "aegis:smoke_puff", add(mid, { x: (Math.random() - 0.5) * 7, y: 0.4, z: (Math.random() - 0.5) * 7 }));
    api.particle(dim, "aegis:dust", up(mid, 0.4));
    if (t % 10 === 3) api.particle(dim, "aegis:fire_trail", add(mid, { x: (Math.random() - 0.5) * 5, y: 0.3, z: (Math.random() - 0.5) * 5 }));
  }, t);
  if (canMeet) run(() => {
    for (const who of ["A", "B"]) {
      const p = feet(who, T.land);
      api.particle(dim, "aegis:dust", p);
      api.particle(dim, "aegis:cine_debris", p, [0.6, 0.55, 0.5]);
      api.sound(dim, "dig.gravel", p, 1.5, 0.6);
    }
    shake(dim, mid, 0.35, 0.3, 32);
  }, T.land);

  // ===== 17. who is left standing =====
  run(() => {
    const [w, l] = [F[outcome.win], F[outcome.lose]];
    for (const p of nearby) {
      if (!ok(p)) continue;
      showTitle(p, outcome.even ? "§fEven!" : `§e${name(w)}`, { subtitle: outcome.even ? "§7Neither jutsu gives way" : `§7overpowers ${name(l)}!`, fadeInDuration: 4, stayDuration: 26, fadeOutDuration: 8 });
    }
  }, T.result + 2);

  // ===== finish =====
  system.runTimeout(() => {
    for (const p of nearby) if (ok(p)) cmd(p, `fog @s remove ${tagFog}`);
    for (const e of all) {
      active.delete(e.id);
      if (ok(e)) api.anim(e, "animation.aegis.rest");
      if (!isPlayer(e)) continue;
      setCinematicBusy(e.id, false);
      if (!ok(e)) continue;
      cmd(e, "camera @s fade time 0.15 0.1 0.35 color 0 0 0");
      system.runTimeout(() => ok(e) && cmd(e, "camera @s clear"), 4);
      cmd(e, "inputpermission set @s movement enabled");
      cmd(e, "inputpermission set @s camera enabled");
      cmd(e, "hud @s reset");
    }
  }, T.release);
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

function impact(dim, mid, c, sa, sb, players, nearby, tagFog) {
  for (const p of players) cmd(p, "camera @s fade time 0.05 0.35 0.9 color 255 255 255");
  for (const p of nearby) if (!players.includes(p)) cmd(p, "camera @s fade time 0.03 0.15 0.5 color 255 255 255");
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

// The burst lands: the loser takes the worst of it (both do when it's even). The fighters stay protected until the
// cinematic lets them go.
function resolve(A, B, outcome) {
  const F = { A, B };
  const hit = (e, frac) => {
    if (!api.isValid(e)) return;
    try {
      e.removeEffect("resistance");
      const h = e.getComponent("minecraft:health");
      api.hurt(e, Math.min(isPlayer(e) ? 16 : 120, h.effectiveMax * frac), undefined, "entityExplosion");
    } catch {
      /* ignore */
    }
    eff(e, "resistance", T.release - T.burst + 10, 4);
  };
  if (outcome.even) {
    hit(A, 0.2);
    hit(B, 0.2);
  } else {
    hit(F[outcome.lose], 0.3);
    hit(F[outcome.win], 0.08);
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
