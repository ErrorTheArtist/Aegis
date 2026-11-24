// Limitless (Gojo's technique) — rarest of all, with the Shrine.
//   Blue           pulls everything around the enemy you aim at (or a point 8 blocks ahead) into it, then crushes it.
//                  Sneak: Blue pulls YOU there instead.
//   Red            a bolt of repulsion: it explodes on the first thing it touches and hurls everyone away.
//   Hollow Purple  (Grade 2) Blue and Red meet in front of you and the imaginary mass erases a 40-block path.
//   Unlimited Void (Grade 1) Domain Expansion.
// Passive — Infinity: 40% less damage while you have cursed energy (see combat.js).

import {
  V, eye, look, fx, sound, task, spawnFx, removeFx, tp, valid, foes, mid, knock, anim, COLOR, rayEnd, effect, worldProp, alive, aimed,
} from "./core.js";
import { hurt } from "./combat.js";
import { expand } from "./domains.js";
import { projectile } from "./projectile.js";

const UNBREAKABLE = /bedrock|barrier|command_block|structure_block|structure_void|jigsaw|end_portal|end_gateway|portal|light_block|allow|deny|border_block|reinforced_deepslate/;

function blue(p) {
  anim(p, "point");
  const dim = p.dimension;
  const dir = look(p);
  if (p.isSneaking) { // Blue pulls you to it: a dash
    const to = rayEnd(dim, eye(p), dir, 10).at;
    const d = V.norm(V.sub(to, p.location));
    knock(p, d.x, d.z, 2.4, Math.max(0.25, d.y * 1.3));
    fx(dim, "jjk:implode", to, COLOR.blue, 1, { radius: 2 });
    fx(dim, "jjk:beam", eye(p), COLOR.blue, 0.8, { dx: dir.x, dy: dir.y, dz: dir.z, len: V.dist(eye(p), to) });
    sound(dim, "mob.endermen.portal", p.location, 1, 1.4);
    return true;
  }
  // Blue forms on the enemy you aim at (10 blocks), or 8 blocks ahead
  const target = aimed(p, 10);
  const point = target ? mid(target) : rayEnd(dim, eye(p), dir, 8).at;
  const orb = spawnFx(dim, "jjk:orb", point, "jjk:as_blue");
  sound(dim, "beacon.activate", point, 0.8, 1.8);
  task((age) => {
    if (age % 2 === 0) {
      for (const e of foes(p, point, 6)) {
        const d = V.sub(point, mid(e));
        const l = Math.hypot(d.x, d.z);
        if (l > 0.4) knock(e, d.x / l, d.z / l, Math.min(0.7, l * 0.16), d.y > 0.3 ? 0.18 : 0.06);
      }
    }
    if (age % 4 === 0) fx(dim, "jjk:implode", point, COLOR.blue, 1, { radius: 3 });
    if (age < 20) return true;
    for (const e of foes(p, point, 3.5)) if (V.dist(mid(e), point) <= 2.8) hurt(p, e, 8);
    fx(dim, "jjk:burst", point, COLOR.blue, 1.2);
    fx(dim, "jjk:ring", point, COLOR.blue, 0.8);
    sound(dim, "random.explode", point, 0.6, 1.8);
    removeFx(orb);
    return false;
  }, 30);
  return true;
}

function explodeRed(p, at) {
  const dim = p.dimension;
  for (const e of foes(p, at, 4.5)) {
    if (V.dist(mid(e), at) > 3.8) continue;
    hurt(p, e, 12);
    const d = V.flat(V.sub(e.location, at));
    knock(e, d.x, d.z, 2.4, 0.6);
  }
  fx(dim, "jjk:burst", at, COLOR.red, 1.6);
  fx(dim, "jjk:ring", at, COLOR.red, 1.3);
  fx(dim, "jjk:spark", at, COLOR.red, 1.2);
  sound(dim, "random.explode", at, 1, 1.2);
}

function red(p) {
  anim(p, "point");
  const dim = p.dimension;
  const dir = look(p);
  const from = V.add(eye(p), V.mul(dir, 1.2));
  const orb = spawnFx(dim, "jjk:orb", from, "jjk:as_red");
  sound(dim, "mob.blaze.shoot", from, 1, 1.5);
  projectile(p, {
    from, dir, speed: 1.6, range: 30, radius: 1.3, entity: orb,
    trail: (pos) => fx(dim, "jjk:orb", pos, COLOR.red, 0.8),
    onHit: (at) => explodeRed(p, at),
  });
  return true;
}

function purple(p) {
  anim(p, "purple");
  const dim = p.dimension;
  effect(p, "slowness", 22, 3);
  sound(dim, "mob.warden.sonic_charge", p.location, 1, 1.2);
  const side = () => {
    const f = V.flat(look(p));
    return { x: -f.z, y: 0, z: f.x };
  };
  const front = () => V.add(eye(p), V.mul(look(p), 1.6));
  const left = spawnFx(dim, "jjk:orb", front(), "jjk:as_blue");
  const right = spawnFx(dim, "jjk:orb", front(), "jjk:as_red");
  task((age) => {
    if (!alive(p)) {
      removeFx(left);
      removeFx(right);
      return false;
    }
    const k = 1 - age / 20; // the two orbs close in
    const s = side();
    const c = front();
    if (valid(left)) tp(left, V.add(c, V.mul(s, 2.2 * k)));
    if (valid(right)) tp(right, V.add(c, V.mul(s, -2.2 * k)));
    if (age % 3 === 0) fx(dim, "jjk:implode", c, COLOR.purple, 1, { radius: 2.5 });
    if (age < 20) return true;
    removeFx(left);
    removeFx(right);
    launchPurple(p, c, look(p));
    return false;
  }, 30);
  return true;
}

function launchPurple(p, from, dir) {
  const dim = p.dimension;
  const orb = spawnFx(dim, "jjk:orb", from, "jjk:as_purple");
  const hit = new Set();
  const terrain = worldProp("terrain", false);
  sound(dim, "mob.warden.sonic_boom", from, 1.5, 0.7);
  sound(dim, "random.explode", from, 1, 0.5);
  let pos = { ...from };
  task((age) => {
    pos = V.add(pos, V.mul(dir, 1.1));
    if (valid(orb)) tp(orb, pos);
    for (const e of foes(p, pos, 4.5)) {
      if (hit.has(e.id) || V.dist(mid(e), pos) > 3.2) continue;
      hit.add(e.id);
      hurt(p, e, 30);
      knock(e, dir.x, dir.z, 1.2, 0.4);
      fx(dim, "jjk:burst", mid(e), COLOR.purple, 1);
    }
    if (terrain) {
      for (let x = -2; x <= 2; x++) {
        for (let y = -2; y <= 2; y++) {
          for (let z = -2; z <= 2; z++) {
            if (x * x + y * y + z * z > 5) continue;
            try {
              const b = dim.getBlock({ x: pos.x + x, y: pos.y + y, z: pos.z + z });
              if (b && !b.isAir && !UNBREAKABLE.test(b.typeId)) b.setType("minecraft:air");
            } catch {
              /* unloaded */
            }
          }
        }
      }
    }
    if (age % 2 === 0) fx(dim, "jjk:burst", pos, COLOR.purple, 0.8);
    if (age < 36) return true;
    removeFx(orb);
    fx(dim, "jjk:burst", pos, COLOR.purple, 2.5);
    fx(dim, "jjk:shell", pos, COLOR.purple, 1, { radius: 3 });
    sound(dim, "random.explode", pos, 1.2, 0.7);
    return false;
  }, 45);
}

export const LIMITLESS = {
  blue: { name: "Blue", cost: 25, cd: 6, grade: 0, run: blue, info: "Forms on who you aim at: pulls from 6 blocks, then 8 damage. Sneak: dash forward." },
  red: { name: "Red", cost: 30, cd: 7, grade: 0, run: red, info: "12 damage in a 3.5-block blast, hurls them away." },
  hollow_purple: { name: "Hollow Purple", cost: 80, cd: 30, grade: 2, run: purple, info: "1 s to form, then 30 damage to everything in a 40-block path." },
  unlimited_void: { name: "Domain Expansion: Unlimited Void", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "void"),
    info: "Radius 12, 8 s: everyone inside is frozen and takes +50% damage from you." },
};
