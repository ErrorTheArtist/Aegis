// Disaster Plants (Hanami's technique) — Cursed Spirits only. The rage of the earth's forests.
//   Cursed Buds                       three seeds; whoever they hit takes 4, then the bud takes root and drains them:
//                                     2 a second for 5 s (and 4 CE a second from a player) — you heal from it.
//   Wooden Roots                      roots burst out of the ground along a 12-block line: 9 damage, held for 2 s.
//   Flower Field                      (Grade 2) 8 s: flowers bloom around you (radius 7). Enemies in them lose the will
//                                     to fight (weakness, slowness); you heal 1 a second while you stand in them.
//   Maximum: Ceremonial Sea of Light  (Grade 1) the flowers' life gathered into a 24-block beam of light: 26 damage to
//                                     everything in it, and you heal 15% of what it does.

import {
  V, eye, look, fx, fxMust, sound, task, foes, mid, anim, COLOR, effect, health, alive, ground, rayEnd, isPlayer, shake, knock, now,
} from "./core.js";
import { hurt, stun } from "./combat.js";
import { projectile } from "./projectile.js";
import { getCE, setCE } from "./energy.js";

const LEAF = [0.45, 0.85, 0.35];
const BLOOM = [1, 0.62, 0.82];
const WOOD = [0.45, 0.32, 0.2];
const LIGHT = [1, 0.95, 0.72];

function heal(p, n) {
  const h = health(p);
  if (h && h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n));
}

const rooted = new Map(); // target id -> tick its bud withers
function drain(p, x) {
  const growing = (rooted.get(x.id) ?? 0) > now();
  rooted.set(x.id, now() + 100);
  if (growing) return; // (already draining: it just lasts longer)
  task((age) => {
    if (now() > (rooted.get(x.id) ?? 0) || !alive(x) || !alive(p)) {
      rooted.delete(x.id);
      return false;
    }
    if (age % 20 === 10) {
      if (hurt(p, x, 2)) heal(p, 1.5);
      if (isPlayer(x)) setCE(x, Math.max(0, getCE(x) - 4));
      fx(x.dimension, "jjk:ember", x.location, BLOOM, 0.5);
    }
    return true;
  }, 130);
}

function buds(p) {
  anim(p, "point");
  const dim = p.dimension;
  const from = V.add(eye(p), V.mul(look(p), 1));
  const d = look(p);
  for (const off of [-0.15, 0, 0.15]) {
    const dir = V.norm({ x: d.x + off * d.z, y: d.y + 0.03, z: d.z - off * d.x });
    projectile(p, {
      from, dir, speed: 1.3, range: 24, radius: 1.1,
      trail: (pos) => fx(dim, "jjk:orb", pos, LEAF, 0.5),
      onHit: (at, x) => {
        fx(dim, "jjk:burst", at, LEAF, 0.6);
        if (x && hurt(p, x, 4)) drain(p, x);
      },
    });
  }
  sound(dim, "dig.grass", from, 1, 0.8);
  return true;
}

function roots(p) {
  anim(p, "summon");
  const dim = p.dimension;
  const dir = V.flat(look(p));
  const start = { ...p.location };
  const hit = new Set();
  sound(dim, "dig.wood", start, 1, 0.6);
  task((age) => {
    const dist = 1.5 + age * 1.5; // (the roots spread 1.5 blocks a tick)
    if (dist > 13.5) return false;
    const at = ground(dim, V.add(start, { x: dir.x * dist, y: 2, z: dir.z * dist }), 6);
    fx(dim, "jjk:debris", at, WOOD, 0.9);
    if (age % 2 === 0) fx(dim, "jjk:spark", V.add(at, { x: 0, y: 0.6, z: 0 }), LEAF, 0.6);
    for (const e of foes(p, at, 2.2, dim)) {
      if (hit.has(e.id)) continue;
      hit.add(e.id);
      hurt(p, e, 9);
      stun(e, 40);
      knock(e, 0, 0, 0, 0.45);
    }
    if (age % 3 === 0) sound(dim, "dig.wood", at, 1, 0.7);
    return true;
  }, 12);
  return true;
}

function flowerField(p) {
  anim(p, "stance");
  const dim = p.dimension;
  const c = { ...p.location };
  sound(dim, "random.orb", c, 1, 0.6);
  task((age) => {
    if (!alive(p)) return false;
    if (age % 10 === 0) {
      fx(dim, "jjk:ring", c, BLOOM, 2.3);
      fx(dim, "jjk:ember", c, BLOOM, 1.6);
      for (const e of foes(p, c, 7, dim)) {
        effect(e, "weakness", 25, 1);
        effect(e, "slowness", 25, 1);
      }
    }
    if (age % 20 === 0 && V.dist(p.location, c) <= 7) heal(p, 1);
    return age < 160;
  }, 170);
  return true;
}

function seaOfLight(p) {
  anim(p, "purple");
  const dim = p.dimension;
  const aim = look(p);
  effect(p, "slowness", 24, 3);
  fxMust(dim, "jjk:glyph", p.location, BLOOM, 1.2);
  fxMust(dim, "jjk:ember", p.location, BLOOM, 2);
  sound(dim, "beacon.activate", p.location, 1, 1.6);
  task((age) => {
    if (!alive(p)) return false;
    const from = V.add(eye(p), V.mul(aim, 1));
    if (age < 20) {
      if (age % 5 === 0) fx(dim, "jjk:implode", V.add(from, V.mul(aim, 0.4)), LIGHT, 1, { radius: 2 });
      return true;
    }
    const end = rayEnd(dim, from, aim, 24).at;
    const len = V.dist(from, end);
    fxMust(dim, "jjk:beam", from, LIGHT, 2.2, { dx: aim.x, dy: aim.y, dz: aim.z, len });
    fxMust(dim, "jjk:flash", from, LIGHT, 1.6);
    fxMust(dim, "jjk:pillar", end, LIGHT, 1);
    let dealt = 0;
    for (const e of foes(p, V.add(from, V.mul(aim, len / 2)), len / 2 + 2.5, dim)) {
      if (V.segment(mid(e), from, end).d > 2.2) continue;
      if (hurt(p, e, 26)) dealt += 26;
      fx(dim, "jjk:burst", mid(e), LIGHT, 1);
    }
    if (dealt) heal(p, dealt * 0.15);
    shake(dim, from, 0.35, 0.5, 20);
    sound(dim, "mob.warden.sonic_boom", from, 1.2, 1.4);
    return false;
  }, 30);
  return true;
}

export const DISASTER_PLANTS = {
  plant_buds: { name: "Cursed Buds", cost: 20, cd: 7, grade: 0, run: buds,
    info: "Three seeds: 4 damage, then the bud takes root — 2 a second for 5 s (and 4 CE a second from a player); you heal from it." },
  plant_roots: { name: "Wooden Roots", cost: 25, cd: 9, grade: 0, run: roots, info: "Roots burst along a 12-block line: 9 damage, and they're held for 2 s." },
  plant_field: { name: "Flower Field", cost: 45, cd: 25, grade: 2, run: flowerField,
    info: "8 s, radius 7: enemies in the flowers are weakened and slowed; you heal 1 a second in them." },
  sea_of_light: { name: "Maximum: Ceremonial Sea of Light", cost: 90, cd: 60, grade: 4, run: seaOfLight,
    info: "1 s to gather, then a 24-block beam of light: 26 damage to all in it; you heal 15% of what it does." },
};
export const _plants = { rooted, COLOR };
