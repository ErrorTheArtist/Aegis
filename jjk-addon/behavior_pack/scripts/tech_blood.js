// Blood Manipulation (the Kamo clan's technique / Choso's).
//   Piercing Blood            a hypersonic beam of compressed blood: everyone along 20 blocks.
//   Convergence               your blood rushes: 20 s of speed, strength and haste.
//   Supernova                 (Grade 2) blood orbs burst around you.
//   Flowing Red Scale: Stack  (Grade 1) 20 s far beyond your limits — then 5 s of weakness.

import { V, eye, look, fx, sound, task, mid, knock, anim, COLOR, rayEnd, effect, foes, alive } from "./core.js";
import { hurt } from "./combat.js";
import { alongLine } from "./projectile.js";

function aura(p, ticks, color) {
  task((age) => {
    if (!alive(p)) return false;
    if (age % 8 === 0) fx(p.dimension, "jjk:aura", p.location, color, 1);
    return age < ticks;
  }, ticks + 1);
}

function piercing(p) {
  anim(p, "blood");
  const dim = p.dimension;
  task((age) => {
    const hand = V.add(eye(p), V.mul(look(p), 0.8));
    if (age < 8) {
      fx(dim, "jjk:orb", hand, COLOR.blood, 0.6 + age * 0.08);
      return true;
    }
    const dir = look(p);
    const end = rayEnd(dim, hand, dir, 20).at;
    for (const e of alongLine(p, hand, end, 1.1)) {
      hurt(p, e, 14);
      fx(dim, "jjk:blood", mid(e), COLOR.blood, 1);
    }
    fx(dim, "jjk:beam", hand, COLOR.blood, 1.2, { dx: dir.x, dy: dir.y, dz: dir.z, len: V.dist(hand, end) });
    fx(dim, "jjk:blood", end, COLOR.blood, 1.2);
    sound(dim, "mob.blaze.shoot", hand, 1, 1.6);
    sound(dim, "item.trident.riptide_1", hand, 0.6, 1.8);
    return false;
  }, 12);
  return true;
}

function convergence(p) {
  anim(p, "heal");
  effect(p, "speed", 400, 1);
  effect(p, "strength", 400, 0);
  effect(p, "haste", 400, 1);
  aura(p, 400, COLOR.blood);
  sound(p.dimension, "mob.warden.heartbeat", p.location, 1, 1.2);
  return true;
}

function supernova(p) {
  anim(p, "blood");
  const dim = p.dimension;
  task((age) => {
    const c = mid(p);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + age * 0.3;
      fx(dim, "jjk:orb", { x: c.x + Math.cos(a) * 1.6, y: c.y + 0.4, z: c.z + Math.sin(a) * 1.6 }, COLOR.blood, 0.9);
    }
    if (age < 12) return true;
    for (const e of foes(p, p.location, 6)) {
      if (V.dist(mid(e), c) > 5.3) continue;
      hurt(p, e, 18);
      const d = V.flat(V.sub(e.location, p.location));
      knock(e, d.x, d.z, 1.2, 0.4);
      fx(dim, "jjk:blood", mid(e), COLOR.blood, 1.2);
    }
    fx(dim, "jjk:burst", c, COLOR.blood, 2);
    fx(dim, "jjk:blood", c, COLOR.blood, 2.5);
    fx(dim, "jjk:ring", p.location, COLOR.blood, 1.6);
    sound(dim, "random.explode", c, 0.9, 1.4);
    return false;
  }, 16);
  return true;
}

function redScale(p) {
  anim(p, "heal");
  effect(p, "strength", 400, 2);
  effect(p, "speed", 400, 2);
  effect(p, "resistance", 400, 1);
  effect(p, "regeneration", 400, 1);
  effect(p, "jump_boost", 400, 1);
  aura(p, 400, COLOR.red);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.blood, 1, { radius: 2 });
  sound(p.dimension, "mob.warden.heartbeat", p.location, 1.4, 0.8);
  task((age) => {
    if (age < 400) return true;
    if (alive(p)) {
      effect(p, "weakness", 100, 0);
      effect(p, "slowness", 100, 0);
    }
    return false;
  }, 401);
  return true;
}

export const BLOOD = {
  piercing_blood: { name: "Piercing Blood", cost: 20, hp: 1, cd: 5, grade: 0, run: piercing, info: "14 damage to everyone along a 20-block beam." },
  convergence: { name: "Convergence", cost: 30, cd: 30, grade: 0, run: convergence, info: "20 s: Speed II, Strength I, Haste II." },
  supernova: { name: "Supernova", cost: 50, cd: 18, grade: 2, run: supernova, info: "18 damage to everyone within 5 blocks." },
  flowing_red_scale_stack: { name: "Flowing Red Scale: Stack", cost: 70, cd: 60, grade: 4, run: redScale,
    info: "20 s: Strength III, Speed III, Resistance II, Regeneration II — then 5 s weak." },
};
