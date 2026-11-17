// Fourth wave of jutsu scrolls (v1.55) — none of them clan-bound. Sold by the Jutsu Sensei; the new legends drop them.
//   Fire:      Toad Oil Flame Bomb            Water:     Great Waterfall
//   Wind:      Gale Palm                      Lightning: Raikiri · Black Panther
//   Earth:     Mud River
//   Ninjutsu:  Planetary Rasengan · Striking Shadow Snakes · Shadow Clone Explosion
//   Sealing & Space-Time: Flying Thunder God · Five Elements Seal
//   Genjutsu:  Tree Binding Death · Temple of Nirvana · Crow Genjutsu
//   Medical:   Hundred Healings
//   Taijutsu:  Morning Peacock · Daytime Tiger (needs the Eight Inner Gates open)
// main.js merges these into its JUTSU table (cost, cooldown, chakra and affinity all work like every scroll).

import { world, system } from "@minecraft/server";
import { impactFx, sfx, shake, chargeFx } from "./cinematic.js";
import { showTitle } from "./hud.js";
import { isGatesOpen } from "./jutsu2.js";
import { sealChakra } from "./clans.js";

let api;
const COL = {
  fire: [1, 0.45, 0.1], water: [0.3, 0.6, 1], wind: [0.75, 1, 0.85], bolt: [0.6, 0.85, 1], panther: [0.35, 0.3, 0.55],
  earth: [0.55, 0.42, 0.28], chakra: [0.45, 0.8, 1], snake: [0.5, 0.35, 0.6], wood: [0.45, 0.32, 0.18], feather: [1, 1, 1],
  crow: [0.15, 0.12, 0.18], heal: [0.45, 1, 0.6], seal: [1, 0.85, 0.3], peacock: [1, 0.55, 0.2], tiger: [1, 0.8, 0.35],
  raijin: [1, 0.9, 0.4],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eff(e, id, ticks, amp = 0, show = false) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: show });
  } catch {
    /* ignore */
  }
}
const up = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });
const flat = (d) => api.norm({ x: d.x, y: 0, z: d.z });
const fwdOf = (p) => flat(p.getViewDirection());
const at = (o, f, dist, side = 0, h = 0) => ({ x: o.x + f.x * dist - f.z * side, y: o.y + h, z: o.z + f.z * dist + f.x * side });
const isBig = (e) => e.typeId === "aegis:legend" || e.typeId === "aegis:akatsuki" || !!e.matches?.({ families: ["tailed_beast"] });
const rotate = (d, a) => ({ x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y, z: d.x * Math.sin(a) + d.z * Math.cos(a) });
const bar = (p, t) => p.onScreenDisplay?.setActionBar(t);

function lookTarget(player, range) {
  try {
    return player.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
  } catch {
    return undefined;
  }
}

function foes(player, pos, r) {
  try {
    return player.dimension.getEntities({ location: pos, maxDistance: r }).filter((e) => e.id !== player.id && api.canBeHit(e, player));
  } catch {
    return [];
  }
}

// Room for a body (feet and head) at pos?
function open(dim, pos) {
  try {
    const a = dim.getBlock(pos);
    const b = dim.getBlock(up(pos, 1));
    return !!a && !!b && (a.isAir || a.isLiquid) && (b.isAir || b.isLiquid);
  } catch {
    return false;
  }
}

function setFire(e, s) {
  try {
    e.setOnFire(s, true);
  } catch {
    /* ignore */
  }
}

// Is `e` inside the cone in front of `o` (direction f)?
function inCone(e, o, f, range, minDot) {
  const v = api.sub(e.location, o);
  const dist = Math.hypot(v.x, v.z);
  return dist > 0.4 && dist < range && (v.x * f.x + v.z * f.z) / dist > minDot;
}

// Is `e` in the lane of width 2·half starting at `o` along f, from `from` to `to` blocks?
function inLane(e, o, f, from, to, half) {
  const v = api.sub(e.location, o);
  const along = v.x * f.x + v.z * f.z;
  const side = Math.abs(v.x * f.z - v.z * f.x);
  return along >= from && along <= to && side <= half;
}

// ===========================================================================
// FIRE
// ===========================================================================
// Toad Oil Flame Bomb: a gush of toad oil set alight — a long cone of fire, and the oil keeps burning on the ground.
function castToadOil(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.jutsu_breath");
  chargeFx(player, COL.fire, 12, "aegis.inhale");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const o = { ...player.location };
    const f = fwdOf(player);
    sfx(dim, "aegis.fire_roar", o, 2.4, 0.7);
    shake(dim, o, 0.3, 0.8, 16);
    for (let k = 0; k < 4; k++) {
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        for (let d = 2; d <= 12; d += 2.5) for (const s of [-1, 0, 1]) api.particle(dim, "aegis:cine_flame", at(o, f, d, s * d * 0.28, 1), COL.fire);
        for (const e of foes(player, o, 13)) {
          if (!inCone(e, o, f, 13, 0.75)) continue;
          api.hurt(e, 6, player, "fire");
          setFire(e, 6);
        }
      }, k * 5);
    }
    // the oil burns on for three seconds
    for (let t = 20; t < 80; t += 10) {
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        for (let d = 3; d <= 12; d += 3) api.particle(dim, "aegis:fire_burst", at(o, f, d, 0, 0.2), COL.fire);
        for (const e of foes(player, o, 13)) {
          if (!inCone(e, o, f, 13, 0.75)) continue;
          api.hurt(e, 2, player, "fire");
          setFire(e, 3);
        }
      }, t);
    }
  }, 12);
  return true;
}

// ===========================================================================
// WATER
// ===========================================================================
// Great Waterfall: a wall of water rises in front and rolls forward, sweeping everything away.
function castGreatWaterfall(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.water_seals");
  chargeFx(player, COL.water, 14, "aegis.water");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const o = { ...player.location };
    const f = fwdOf(player);
    sfx(dim, "aegis.water_burst", o, 2.5, 0.6);
    shake(dim, o, 0.4, 1, 20);
    const hit = new Set();
    for (let step = 0; step < 8; step++) {
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        const d = 2 + step * 1.75;
        for (let s = -3; s <= 3; s += 1.5) {
          const p = at(o, f, d, s, 0.3);
          api.particle(dim, "aegis:water_splash", p, COL.water);
          if (step % 2 === 0) api.particle(dim, "aegis:water_splash", up(p, 1.6), COL.water);
        }
        for (const e of foes(player, at(o, f, d), 4.2)) {
          if (hit.has(e.id)) {
            api.knockback(e, f.x, f.z, 1.2, 0.15); // still carried along
            continue;
          }
          hit.add(e.id);
          api.hurt(e, 12, player);
          api.knockback(e, f.x, f.z, 3.5, 0.5);
          eff(e, "slowness", 100, 1, true);
          try {
            e.extinguishFire?.();
          } catch {
            /* ignore */
          }
        }
      }, step * 3);
    }
  }, 14);
  return true;
}

// ===========================================================================
// WIND
// ===========================================================================
// Gale Palm: a palm thrust that fires a compressed beam of wind straight ahead.
function castGalePalm(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.wind_palm");
  sfx(dim, "aegis.wind", player.location, 1.6, 1.2);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const o = up(player.location, 1.2);
    const d = player.getViewDirection();
    const hit = new Set();
    for (let i = 1; i <= 10; i++) {
      const p = api.add(o, api.scale(d, i));
      api.particle(dim, "aegis:wind_gust", p, COL.wind);
      for (const e of foes(player, p, 1.6)) {
        if (hit.has(e.id)) continue;
        hit.add(e.id);
        api.hurt(e, 10, player);
        api.knockback(e, d.x, d.z, 2.8, 0.35);
        eff(e, "slowness", 40, 1, true);
      }
    }
    sfx(dim, "aegis.wind_cut", o, 1.4, 0.9);
  }, 6);
  return true;
}

// ===========================================================================
// LIGHTNING
// ===========================================================================
// Raikiri: the Lightning Blade — charge it in the hand, then cross 14 blocks in a flash, cutting through everyone in
// the way.
function castRaikiri(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.chidori_charge");
  sfx(dim, "aegis.chidori", player.location, 1.6, 0.85);
  for (let i = 0; i < 14; i += 2) system.runTimeout(() => api.isValid(player) && api.particle(dim, "aegis:chidori", api.handPos(player), COL.bolt), i);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const f = fwdOf(player);
    const o = { ...player.location };
    let end = o;
    for (let i = 1; i <= 14; i++) {
      const p = at(o, f, i);
      if (!open(dim, p)) break;
      end = p;
    }
    const len = Math.hypot(end.x - o.x, end.z - o.z);
    const struck = foes(player, at(o, f, len / 2), len / 2 + 2.5).filter((e) => inLane(e, o, f, -0.5, len + 1.5, 1.8));
    for (let i = 0; i <= len; i += 1) api.particle(dim, "aegis:chidori_arc", at(o, f, i, 0, 1), COL.bolt);
    try {
      player.teleport(end, { facingLocation: at(end, f, 3, 0, 1.6) });
    } catch {
      /* ignore */
    }
    api.anim(player, "animation.aegis.ram_strike");
    sfx(dim, "aegis.lightning", end, 1.8, 1.3);
    for (const e of struck) {
      api.hurt(e, 22, player);
      api.particle(dim, "aegis:lightning_burst", up(e.location, 1), COL.bolt);
      eff(e, "slowness", 30, 3, true);
    }
    if (struck.length) shake(dim, end, 0.4, 0.4, 12);
  }, 14);
  return true;
}

// Black Panther: a panther of black lightning races along the ground to the target, stuns it, and jumps to one more.
function castBlackPanther(player) {
  const dim = player.dimension;
  const target = lookTarget(player, 30);
  api.anim(player, "animation.aegis.hand_signs");
  chargeFx(player, COL.panther, 12, "aegis.thunder");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const f = fwdOf(player);
    const start = at(player.location, f, 1.5, 0, 0.5);
    sfx(dim, "aegis.hound", start, 1.6, 0.6);
    api.launchProjectile(player, start, f, {
      noOrb: true, hug: true, hugHeight: 0.6, speed: 1.1, maxAge: 40, home: target, turn: 0.18,
      trail: "aegis:chidori_arc", color: COL.panther, hitRadius: 1.6, custom: true,
      tick: (pr) => pr.age % 2 === 0 && api.particle(dim, "aegis:lightning_burst", pr.pos, COL.panther),
      onHit: (pr) => {
        api.particle(dim, "aegis:lightning_burst", pr.pos, COL.panther);
        sfx(dim, "aegis.thunder", pr.pos, 1.6, 1.1);
        if (!api.isValid(player)) return;
        const first = pr.hitEntity && api.isValid(pr.hitEntity) ? pr.hitEntity : foes(player, pr.pos, 2.5)[0];
        if (!first) return;
        api.hurt(first, 18, player);
        eff(first, "slowness", 30, 255, true); // stunned
        const next = foes(player, first.location, 5).find((e) => e.id !== first.id);
        if (!next) return;
        const a = up(first.location, 1);
        const b = up(next.location, 1);
        for (let i = 0; i <= 5; i++) api.particle(dim, "aegis:chidori_arc", api.add(a, api.scale(api.sub(b, a), i / 5)), COL.panther);
        api.hurt(next, 8, player);
        eff(next, "slowness", 20, 3, true);
      },
    });
  }, 12);
  return true;
}

// ===========================================================================
// EARTH
// ===========================================================================
// Mud River: the ground ahead turns into a river of mud that drags enemies away and bogs them down.
function castMudRiver(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.earth_slam");
  chargeFx(player, COL.earth, 10, "aegis.earth");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const o = { ...player.location };
    const f = fwdOf(player);
    sfx(dim, "aegis.earth_break", o, 1.8, 0.6);
    for (let t = 0; t < 80; t += 10) {
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        for (let d = 2; d <= 12; d += 2) api.particle(dim, "aegis:swamp_mud", at(o, f, d, (t / 10) % 2 ? 0.8 : -0.8, 0.1));
        for (const e of foes(player, at(o, f, 7), 7.5)) {
          if (!inLane(e, o, f, 1, 13, 2)) continue;
          api.hurt(e, 4, player);
          eff(e, "slowness", 30, 2, true);
          api.knockback(e, f.x, f.z, 0.9, 0.05); // dragged downstream
        }
      }, t);
    }
  }, 10);
  return true;
}

// ===========================================================================
// NINJUTSU
// ===========================================================================
// Planetary Rasengan: a Rasengan orbited by three smaller ones; the big one bursts and the three hit around it.
function castPlanetaryRasengan(player) {
  const dim = player.dimension;
  const CHARGE = 20;
  api.anim(player, "animation.aegis.rasengan_hold");
  chargeFx(player, COL.chakra, CHARGE, "aegis.rasengan");
  [0, 1, 2].forEach((k) => {
    const moon = api.spawnFx(dim, "aegis:jutsu_orb", "aegis:as_rasengan", api.handPos(player));
    api.follow(moon, () => {
      if (!api.isValid(player)) return undefined;
      const hp = api.handPos(player);
      const a = system.currentTick * 0.5 + k * 2.094;
      return { x: hp.x + Math.cos(a) * 1.4, y: hp.y + 0.5, z: hp.z + Math.sin(a) * 1.4 };
    }, CHARGE);
  });
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    api.anim(player, "animation.aegis.throw_overhead");
    const d = player.getViewDirection();
    const start = api.add(player.getHeadLocation(), api.scale(d, 1.5));
    sfx(dim, "aegis.rasengan", start, 2, 0.7);
    api.launchProjectile(player, start, d, {
      orbEvent: "aegis:as_big_rasengan", speed: 1.0, maxAge: 40, damage: 26, radius: 5, knock: 2.6, fire: 0,
      trail: "aegis:rasengan_wind", burst: "aegis:chakra_burst", color: COL.chakra, hitRadius: 1.8, power: 2.4, sound: "random.explode",
      onExplode: (pos, dm, caster) => {
        for (let k = 0; k < 3; k++) {
          system.runTimeout(() => {
            const a = k * 2.094;
            const p = { x: pos.x + Math.cos(a) * 3, y: pos.y, z: pos.z + Math.sin(a) * 3 };
            api.particle(dm, "aegis:rasengan", p, COL.chakra);
            api.particle(dm, "aegis:chakra_burst", p, COL.chakra);
            if (!api.isValid(caster)) return;
            for (const e of foes(caster, p, 2.5)) api.hurt(e, 8, caster);
          }, 4 + k * 3);
        }
      },
    });
  }, CHARGE);
  return true;
}

// Striking Shadow Snakes: three snakes lash out of the sleeve — poisonous bites that hold the target.
function castShadowSnakes(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.palm_thrust");
  api.sound(dim, "mob.silverfish.say", player.location, 1.4, 0.6);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    const start = api.add(player.getHeadLocation(), api.scale(d, 1.2));
    for (const a of [-0.25, 0, 0.25]) {
      api.launchProjectile(player, start, rotate(d, a), {
        noOrb: true, speed: 1.3, maxAge: 16, custom: true, trail: "aegis:thread", color: COL.snake, hitRadius: 1.2,
        tick: (pr) => pr.age % 2 === 0 && api.particle(dim, "aegis:slash", pr.pos, COL.snake),
        onHit: (pr) => {
          const e = pr.hitEntity;
          if (!e || !api.isValid(e) || !api.isValid(player)) return;
          api.hurt(e, 8, player);
          eff(e, "poison", 80, 1, true);
          eff(e, "slowness", 40, 2, true);
          api.particle(dim, "aegis:slash", up(e.location, 1), COL.snake);
        },
      });
    }
  }, 5);
  return true;
}

// Shadow Clone Explosion: a clone runs at the enemy and blows itself up (or goes off when it's hit).
const bombClones = new Map(); // clone id -> { owner, born, target }
function castCloneExplosion(player) {
  const dim = player.dimension;
  const target = lookTarget(player, 24) ?? foes(player, player.location, 16)[0];
  api.anim(player, "animation.aegis.clone_seal");
  chargeFx(player, [1, 1, 1], 8, "aegis.whoosh");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const loc = at(player.location, fwdOf(player), 1.5);
    let c;
    try {
      c = dim.spawnEntity("aegis:chakra_clone", open(dim, loc) ? loc : player.location);
    } catch {
      return;
    }
    try {
      c.setDynamicProperty("aegis:owner", player.id);
      c.setDynamicProperty("aegis:no_xp", true);
      c.nameTag = `${player.name}'s Shadow Clone`;
      c.addTag("aegis_bomb_clone");
    } catch {
      /* ignore */
    }
    api.particle(dim, "aegis:smoke_puff", c.location);
    bombClones.set(c.id, { owner: player, born: system.currentTick, target });
  }, 8);
  return true;
}

function explodeClone(c, owner) {
  const dim = c.dimension;
  const pos = { ...c.location };
  api.particle(dim, "minecraft:huge_explosion_emitter", pos);
  api.particle(dim, "aegis:fire_burst", up(pos, 1), COL.fire);
  impactFx(dim, pos, COL.fire, 2);
  api.sound(dim, "random.explode", pos, 1.4, 0.9);
  try {
    c.remove();
  } catch {
    /* ignore */
  }
  if (!api.isValid(owner)) return;
  for (const e of foes(owner, pos, 4)) {
    if (e.typeId === "aegis:chakra_clone") continue;
    api.hurt(e, 20, owner, "entityExplosion");
    const a = flat(api.sub(e.location, pos));
    api.knockback(e, a.x, a.z, 2, 0.5);
  }
}

function tickBombClones() {
  const now = system.currentTick;
  for (const [id, b] of [...bombClones]) {
    const c = world.getEntity(id);
    if (!c || !api.isValid(c)) {
      bombClones.delete(id);
      continue;
    }
    const t = b.target && api.isValid(b.target) ? b.target : api.isValid(b.owner) ? foes(b.owner, c.location, 12).find((e) => e.typeId !== "aegis:chakra_clone") : undefined;
    const close = t && Math.hypot(t.location.x - c.location.x, t.location.z - c.location.z) < 2.4;
    if (t && !close && (now - b.born) % 6 === 0) {
      const d = flat(api.sub(t.location, c.location));
      api.knockback(c, d.x, d.z, 0.9, 0.15);
    }
    if (close || now - b.born > 70) {
      bombClones.delete(id);
      explodeClone(c, b.owner);
    }
  }
}

// ===========================================================================
// SEALING & SPACE-TIME
// ===========================================================================
// Flying Thunder God: plant a seal (sneak + use) or mark someone with a Flying Raijin Kunai — then use the scroll to
// flash to the seal, or behind the marked enemy with a strike.
const SPOT_TICKS = 6000; // a planted seal lasts 5 minutes
const MARK_TICKS = 400; // a marked enemy stays marked for 20 s
const marks = new Map(); // player id -> { spot: { dim, pos, until }, foe: { id, until } }

export function setRaijinSpot(player, dim, pos) {
  const m = marks.get(player.id) ?? {};
  m.spot = { dim: dim.id, pos: { ...pos }, until: system.currentTick + SPOT_TICKS };
  marks.set(player.id, m);
  api.particle(dim, "aegis:jin_seal", pos);
}

export function markFoe(player, e) {
  const m = marks.get(player.id) ?? {};
  m.foe = { id: e.id, until: system.currentTick + MARK_TICKS };
  marks.set(player.id, m);
  api.particle(e.dimension, "aegis:cine_ring", e.location, COL.raijin);
  bar(player, `§eFlying Thunder God mark on §f${(e.nameTag || e.typeId.replace(/^.*:/, "")).replace(/§./g, "")}§e — use the scroll to flash to them!`);
}

export const raijinMarks = (player) => marks.get(player.id);

function castFlyingRaijin(player) {
  const dim = player.dimension;
  const now = system.currentTick;
  if (player.isSneaking) {
    setRaijinSpot(player, dim, player.location);
    sfx(dim, "aegis.seal", player.location, 1, 1.4);
    bar(player, "§eFlying Thunder God seal placed here §7(5 minutes) — use the scroll anywhere to return.");
    return true;
  }
  const m = marks.get(player.id) ?? {};
  const foe = m.foe && m.foe.until > now ? world.getEntity(m.foe.id) : undefined;
  if (foe && api.isValid(foe) && foe.dimension.id === dim.id && Math.hypot(foe.location.x - player.location.x, foe.location.z - player.location.z) < 64) {
    const d = flat(foe.getViewDirection());
    const behind = { x: foe.location.x - d.x * 1.6, y: foe.location.y, z: foe.location.z - d.z * 1.6 };
    api.particle(dim, "aegis:cine_ring", player.location, COL.raijin);
    try {
      player.teleport(open(dim, behind) ? behind : foe.location, { facingLocation: up(foe.location, 1) });
    } catch {
      return false;
    }
    sfx(dim, "aegis.whoosh", player.location, 1.5, 1.6);
    api.anim(player, "animation.aegis.sword_slash");
    system.runTimeout(() => {
      if (!api.isValid(foe) || !api.isValid(player)) return;
      api.hurt(foe, 14, player);
      api.particle(dim, "aegis:slash", up(foe.location, 1.1), COL.raijin);
      sfx(dim, "aegis.slash", foe.location, 1.2, 1.3);
    }, 3);
    m.foe = undefined;
    return true;
  }
  if (m.spot && m.spot.until > now && m.spot.dim === dim.id) {
    api.particle(dim, "aegis:cine_ring", player.location, COL.raijin);
    try {
      player.teleport(m.spot.pos);
    } catch {
      return false;
    }
    api.particle(dim, "aegis:cine_ring", m.spot.pos, COL.raijin);
    sfx(dim, "aegis.whoosh", m.spot.pos, 1.5, 1.6);
    bar(player, "§eFlying Thunder God!");
    return true;
  }
  bar(player, "§7No Flying Thunder God seal — §fsneak + use§7 to plant one, or hit an enemy with a §fFlying Raijin Kunai§7.");
  return false;
}

// Five Elements Seal: a five-fingered seal struck into the enemy — a player can't use jutsu for 10 s, an NPC can't for
// 10 s (a boss for 5 s).
function castFiveElementsSeal(player) {
  const target = lookTarget(player, 5);
  if (!target) {
    bar(player, "§7Get close and look at an enemy to seal them.");
    return false;
  }
  const dim = player.dimension;
  api.anim(player, "animation.aegis.palm_thrust");
  chargeFx(player, COL.seal, 6, "aegis.seal");
  system.runTimeout(() => {
    if (!api.isValid(target) || !api.isValid(player)) return;
    api.hurt(target, 6, player, "magic");
    api.particle(dim, "aegis:jin_seal", target.location);
    sfx(dim, "aegis.seal", target.location, 1.4, 1.2);
    if (target.typeId === "minecraft:player") {
      sealChakra(target, 200);
      showTitle(target, "§6Five Elements Seal", { subtitle: "§7Your chakra is sealed!", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
    } else {
      try {
        target.setDynamicProperty("aegis:sealed_until", system.currentTick + (isBig(target) ? 100 : 200));
      } catch {
        /* ignore */
      }
      eff(target, "weakness", 200, 1, true);
    }
    bar(player, "§6Five Elements Seal — their chakra is sealed!");
  }, 6);
  return true;
}

// Is this NPC's chakra sealed (Five Elements Seal)? Their AI skips its jutsu while it is.
export function npcSealed(e) {
  try {
    return (e.getDynamicProperty("aegis:sealed_until") ?? 0) > system.currentTick;
  } catch {
    return false;
  }
}

// ===========================================================================
// GENJUTSU
// ===========================================================================
// Demonic Illusion: Tree Binding Death — the target is caught by a tree: it can't move, can't see, and the branches
// squeeze (3 s; a boss shakes it off in 1.5 s).
function castTreeBinding(player) {
  const target = lookTarget(player, 16);
  if (!target) {
    bar(player, "§7Look at an enemy to cast the genjutsu.");
    return false;
  }
  const dim = player.dimension;
  api.anim(player, "animation.aegis.mind_seal");
  sfx(dim, "aegis.eye", player.location, 1.2, 0.8);
  system.runTimeout(() => {
    if (!api.isValid(target) || !api.isValid(player)) return;
    const ticks = isBig(target) ? 30 : 60;
    if (target.typeId === "minecraft:player") {
      showTitle(target, "§2Tree Binding Death", { subtitle: "§7A tree grows around you…", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
    }
    eff(target, "slowness", ticks, 255, true);
    eff(target, "blindness", ticks, 0, true);
    eff(target, "weakness", ticks, 1, true);
    sfx(dim, "aegis.wood", target.location, 1.4, 0.8);
    for (let t = 0; t < ticks; t += 10) {
      system.runTimeout(() => {
        if (!api.isValid(target)) return;
        for (let y = 0; y < 2.4; y += 0.6) api.particle(dim, "aegis:wood_burst", up(target.location, y), COL.wood);
        if (api.isValid(player)) api.hurt(target, 4, player, "magic");
      }, t);
    }
  }, 10);
  return true;
}

// Temple of Nirvana: feathers drift down all around you and every enemy within 10 blocks grows drowsy.
function castNirvana(player) {
  const dim = player.dimension;
  const o = { ...player.location };
  api.anim(player, "animation.aegis.hand_signs");
  chargeFx(player, COL.feather, 12, "aegis.eye");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    for (let t = 0; t < 40; t += 5) {
      system.runTimeout(() => {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 9;
          api.particle(dim, "aegis:heal", { x: o.x + Math.cos(a) * r, y: o.y + 2.5 + Math.random() * 2, z: o.z + Math.sin(a) * r }, COL.feather);
        }
      }, t);
    }
    let n = 0;
    for (const e of foes(player, o, 10)) {
      const big = isBig(e);
      eff(e, "slowness", big ? 60 : 100, big ? 1 : 4, true);
      eff(e, "weakness", 100, big ? 0 : 2, true);
      if (!big) {
        eff(e, "blindness", 100, 0, true);
        eff(e, "mining_fatigue", 100, 2, true);
      }
      if (e.typeId === "minecraft:player") {
        showTitle(e, "§fTemple of Nirvana", { subtitle: "§7Feathers fall… you feel so drowsy…", fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
      }
      n++;
    }
    if (!n) bar(player, "§7The feathers fall, but no enemy is close enough.");
  }, 12);
  return true;
}

// Crow Genjutsu: you burst into a flock of crows that blinds the enemies in front, and re-form 6 blocks back, unseen.
function castCrows(player) {
  const dim = player.dimension;
  const o = { ...player.location };
  const f = fwdOf(player);
  api.anim(player, "animation.aegis.substitution");
  api.sound(dim, "mob.bat.takeoff", o, 1.6, 0.6);
  sfx(dim, "aegis.poof", o, 1.2, 0.8);
  for (let t = 0; t < 20; t += 2) {
    system.runTimeout(() => {
      for (let i = 0; i < 4; i++) {
        const d = 1 + Math.random() * 8;
        api.particle(dim, "aegis:ash_cloud", at(o, f, d, (Math.random() - 0.5) * d * 0.8, 1 + Math.random() * 1.5));
      }
    }, t);
  }
  for (const e of foes(player, at(o, f, 4.5), 6)) {
    if (!inCone(e, o, f, 9, 0.5)) continue;
    api.hurt(e, 3, player, "magic");
    eff(e, "blindness", 80, 0, true);
    eff(e, "nausea", 100, 0, true);
  }
  eff(player, "invisibility", 60, 0);
  const back = at(o, f, -6);
  if (open(dim, back)) {
    try {
      player.teleport(back, { facingLocation: up(o, 1.6) });
    } catch {
      /* ignore */
    }
  }
  return true;
}

// ===========================================================================
// MEDICAL
// ===========================================================================
// Hundred Healings: the seal on your forehead spreads over your body — 20 s of fast healing (4% of your health a
// second) and a little toughness.
const healing = new Map(); // player id -> until tick
function castHundredHealings(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.heal_palms");
  chargeFx(player, COL.heal, 10, "aegis.heal");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    healing.set(player.id, system.currentTick + 400);
    eff(player, "resistance", 400, 0);
    api.particle(dim, "aegis:heal_seal", player.location, COL.heal);
    bar(player, "§aHundred Healings — the seal spreads across your body!");
  }, 10);
  return true;
}

function tickHealing() {
  const now = system.currentTick;
  for (const [id, until] of [...healing]) {
    const p = world.getEntity(id);
    if (!p || !api.isValid(p) || now > until) {
      healing.delete(id);
      continue;
    }
    try {
      const h = p.getComponent("minecraft:health");
      if (h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + Math.max(1, h.effectiveMax * 0.04)));
    } catch {
      /* ignore */
    }
    api.particle(p.dimension, "aegis:heal", p.location, COL.heal);
  }
}
export const isHundredHealing = (p) => (healing.get(p?.id) ?? 0) > system.currentTick;

// ===========================================================================
// TAIJUTSU
// ===========================================================================
// Morning Peacock: a blazing storm of punches into the enemy in front of you, the last one launching them
// (twice as many punches with the Eight Inner Gates open).
function castMorningPeacock(player) {
  const target = lookTarget(player, 5) ?? foes(player, at(player.location, fwdOf(player), 2), 3)[0];
  if (!target) {
    bar(player, "§7Get in close — Morning Peacock needs an enemy right in front of you.");
    return false;
  }
  const dim = player.dimension;
  const gates = isGatesOpen(player);
  const hits = gates ? 16 : 8;
  sfx(dim, "aegis.gates", player.location, 1.5, 1.4);
  for (let i = 0; i < hits; i++) {
    system.runTimeout(() => {
      if (!api.isValid(player) || !api.isValid(target)) return;
      api.anim(player, i % 2 ? "animation.aegis.m1_cross" : "animation.aegis.m1_jab");
      const p = up(target.location, 1 + (Math.random() - 0.3));
      api.particle(dim, "aegis:fire_burst", p, COL.peacock);
      api.hurt(target, 3, player, "entityAttack", "fist");
      setFire(target, 2);
      if (i % 3 === 0) sfx(dim, "aegis.hit", p, 1, 1.2);
    }, 4 + i * 2);
  }
  system.runTimeout(() => {
    if (!api.isValid(player) || !api.isValid(target)) return;
    api.anim(player, "animation.aegis.m1_finisher");
    const d = flat(api.sub(target.location, player.location));
    api.hurt(target, gates ? 14 : 8, player, "entityAttack", "fist");
    api.knockback(target, d.x, d.z, 3, 0.9);
    impactFx(dim, target.location, COL.peacock, 2);
    sfx(dim, "aegis.hit_heavy", target.location, 1.6, 0.8);
  }, 6 + hits * 2);
  return true;
}

// Daytime Tiger: one punch that fires a tiger-shaped cannon of air — only with the Eight Inner Gates open.
function castDaytimeTiger(player) {
  if (!isGatesOpen(player)) {
    bar(player, "§cDaytime Tiger needs the Eight Inner Gates open §7— cast Eight Inner Gates Release first.");
    return false;
  }
  const dim = player.dimension;
  api.anim(player, "animation.aegis.power_up");
  chargeFx(player, COL.tiger, 12, "aegis.gates");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    api.anim(player, "animation.aegis.palm_thrust");
    const d = player.getViewDirection();
    const start = api.add(player.getHeadLocation(), api.scale(d, 1.6));
    sfx(dim, "aegis.boom", start, 2.2, 0.8);
    shake(dim, player.location, 0.5, 0.6, 16);
    api.launchProjectile(player, start, d, {
      noOrb: true, speed: 1.3, maxAge: 30, custom: true, trail: "aegis:rasengan_wind", color: COL.tiger, hitRadius: 2,
      tick: (pr) => {
        api.particle(dim, "aegis:cine_swirl", pr.pos, COL.tiger);
        if (pr.age % 2 === 0) api.particle(dim, "aegis:wind_gust", pr.pos, COL.tiger);
      },
      onHit: (pr) => {
        // a taijutsu blow: it scales with the Taijutsu stat, like a punch
        api.particle(dim, "aegis:chakra_burst", pr.pos, COL.tiger);
        api.particle(dim, "minecraft:huge_explosion_emitter", pr.pos);
        impactFx(dim, pr.pos, COL.tiger, 2.6);
        api.sound(dim, "random.explode", pr.pos, 1.6, 0.7);
        if (!api.isValid(player)) return;
        for (const e of foes(player, pr.pos, 4.5)) {
          api.hurt(e, 30, player, "entityAttack", "fist");
          const a = flat(api.sub(e.location, pr.pos));
          api.knockback(e, a.x, a.z, 3.2, 0.6);
        }
      },
    });
  }, 12);
  return true;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function makeJutsu4(helpers) {
  api = helpers;
  system.runInterval(tickBombClones, 2);
  system.runInterval(tickHealing, 20);
  // a bomb clone that's hit goes off at once
  world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
    if (hurtEntity.typeId !== "aegis:chakra_clone" || !bombClones.has(hurtEntity.id)) return;
    const b = bombClones.get(hurtEntity.id);
    bombClones.delete(hurtEntity.id);
    system.run(() => api.isValid(hurtEntity) && explodeClone(hurtEntity, b.owner));
  });
  // seals placed by the planter are visible to them now and then
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [id, m] of marks) {
      if (m.spot && m.spot.until <= now) m.spot = undefined;
      if (m.foe && m.foe.until <= now) m.foe = undefined;
      if (!m.spot && !m.foe) {
        marks.delete(id);
        continue;
      }
      if (!m.spot) continue;
      try {
        api.particle(world.getDimension(m.spot.dim), "aegis:cine_ring", m.spot.pos, COL.raijin);
      } catch {
        /* ignore */
      }
    }
  }, 40);

  return {
    "aegis:toad_oil_scroll": { name: "Fire Style: Toad Oil Flame Bomb", cost: 45, cooldown: 220, cast: castToadOil },
    "aegis:great_waterfall_scroll": { name: "Water Style: Great Waterfall", cost: 55, cooldown: 300, cast: castGreatWaterfall },
    "aegis:gale_palm_scroll": { name: "Wind Style: Gale Palm", cost: 25, cooldown: 80, cast: castGalePalm },
    "aegis:raikiri_scroll": { name: "Lightning Style: Raikiri", cost: 50, cooldown: 220, cast: castRaikiri },
    "aegis:black_panther_scroll": { name: "Lightning Style: Black Panther", cost: 45, cooldown: 200, cast: castBlackPanther },
    "aegis:mud_river_scroll": { name: "Earth Style: Mud River", cost: 35, cooldown: 220, cast: castMudRiver },
    "aegis:planetary_rasengan_scroll": { name: "Planetary Rasengan", cost: 70, cooldown: 360, cast: castPlanetaryRasengan },
    "aegis:shadow_snakes_scroll": { name: "Striking Shadow Snakes", cost: 30, cooldown: 100, cast: castShadowSnakes },
    "aegis:clone_explosion_scroll": { name: "Shadow Clone Explosion", cost: 40, cooldown: 240, cast: castCloneExplosion },
    "aegis:flying_raijin_scroll": { name: "Flying Thunder God", cost: 30, cooldown: 60, cast: castFlyingRaijin },
    "aegis:five_elements_seal_scroll": { name: "Sealing: Five Elements Seal", cost: 40, cooldown: 300, cast: castFiveElementsSeal },
    "aegis:tree_binding_scroll": { name: "Genjutsu: Tree Binding Death", cost: 40, cooldown: 260, cast: castTreeBinding },
    "aegis:nirvana_scroll": { name: "Genjutsu: Temple of Nirvana", cost: 45, cooldown: 400, cast: castNirvana },
    "aegis:crow_genjutsu_scroll": { name: "Genjutsu: Crow Genjutsu", cost: 35, cooldown: 260, cast: castCrows },
    "aegis:hundred_healings_scroll": { name: "Medical: Hundred Healings", cost: 60, cooldown: 1200, cast: castHundredHealings },
    "aegis:morning_peacock_scroll": { name: "Taijutsu: Morning Peacock", cost: 35, cooldown: 200, kind: "taijutsu", cast: castMorningPeacock },
    "aegis:daytime_tiger_scroll": { name: "Taijutsu: Daytime Tiger", cost: 60, cooldown: 600, kind: "taijutsu", cast: castDaytimeTiger },
  };
}
