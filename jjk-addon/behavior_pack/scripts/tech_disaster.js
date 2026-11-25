// Disaster Flames (Jogo's technique) — of no clan. Volcanic heat, made into a technique.
//   Ember Insects                    three burning insects fly out and burst on what they touch.
//   Fire Stream                      a cone of fire in front of you for a second.
//   Maximum: Meteor                  (Grade 2) a burning mountain falls on the enemy you aim at.
//   Coffin of the Iron Mountain      (Grade 1) Domain Expansion: the inside of a volcano. Everyone burns.

import { V, eye, look, fx, sound, task, aimed, foes, inCone, mid, anim, COLOR, spawnFx, removeFx, tp, valid, alive, ground, rayEnd } from "./core.js";
import { hurt } from "./combat.js";
import { expand, registerDomain } from "./domains.js";
import { projectile } from "./projectile.js";

const burn = (e, secs) => {
  try {
    e.setOnFire(secs, true);
  } catch {
    /* ignore */
  }
};

function embers(p) {
  anim(p, "point");
  const dim = p.dimension;
  const from = V.add(eye(p), V.mul(look(p), 1));
  const d = look(p);
  for (const off of [-0.2, 0, 0.2]) {
    const dir = V.norm({ x: d.x + off * d.z, y: d.y + 0.04, z: d.z - off * d.x });
    projectile(p, {
      from, dir, speed: 1.4, range: 26, radius: 1.2,
      trail: (pos) => fx(dim, "jjk:orb", pos, COLOR.fire, 0.6),
      onHit: (at, x) => {
        if (x) {
          hurt(p, x, 8);
          burn(x, 4);
        }
        fx(dim, "jjk:burst", at, COLOR.fire, 0.7);
        sound(dim, "fire.ignite", at, 0.6, 1.4);
      },
    });
  }
  sound(dim, "mob.blaze.shoot", from, 1, 1.1);
  return true;
}

function stream(p) {
  anim(p, "point");
  const dim = p.dimension;
  task((age) => {
    if (!alive(p)) return false;
    const from = V.add(eye(p), V.mul(look(p), 0.8));
    for (let dd = 1; dd <= 8; dd += 1.5) fx(dim, "jjk:orb", V.add(from, V.mul(look(p), dd)), COLOR.fire, 0.6 + dd * 0.12);
    if (age % 5 === 0) {
      for (const e of inCone(p, 8, 0.6)) {
        hurt(p, e, 4);
        burn(e, 6);
      }
      sound(dim, "mob.blaze.shoot", from, 0.5, 0.8);
    }
    return age < 19;
  }, 22);
  return true;
}

export function meteorOn(p, spot) {
  const dim = p.dimension;
  const top = V.add(spot, { x: 0, y: 16, z: 0 });
  const rock = spawnFx(dim, "jjk:orb", top, "jjk:as_fire");
  sound(dim, "mob.ghast.warn", spot, 1.4, 0.6);
  task((age) => {
    const u = Math.min(1, age / 20);
    if (valid(rock)) tp(rock, { x: spot.x, y: top.y - 15 * u * u, z: spot.z });
    if (age % 4 === 0) fx(dim, "jjk:ring", spot, COLOR.fire, 2.5 - u);
    if (age < 20) return true;
    for (const e of foes(p, spot, 6)) {
      hurt(p, e, 28);
      burn(e, 6);
    }
    fx(dim, "jjk:burst", spot, COLOR.fire, 3);
    fx(dim, "jjk:smoke", spot, COLOR.dark, 3);
    sound(dim, "random.explode", spot, 1.6, 0.5);
    removeFx(rock);
    return false;
  }, 24);
}

function meteor(p) {
  anim(p, "domain_sign");
  const dim = p.dimension;
  const t = aimed(p, 24);
  const spot = ground(dim, t ? t.location : rayEnd(dim, eye(p), look(p), 20).at, 10);
  meteorOn(p, spot);
  return true;
}

registerDomain("volcano", { name: "Coffin of the Iron Mountain", tech: "disaster_flames", radius: 12, ticks: 200, color: COLOR.fire, dome: "volcano" },
  (d, victims, every, k) => {
    if (every(20)) {
      for (const e of victims) {
        hurt(d.caster, e, 3 * k, { sure: true });
        burn(e, 3);
      }
    }
    if (every(6)) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * d.def.radius;
      const at = { x: d.center.x + Math.cos(a) * r, y: d.center.y + 0.3, z: d.center.z + Math.sin(a) * r };
      fx(d.dim, "jjk:burst", at, COLOR.fire, 0.6);
      fx(d.dim, "jjk:smoke", at, COLOR.dark, 0.6);
    }
  });

export const DISASTER_FLAMES = {
  disaster_ember: { name: "Ember Insects", cost: 20, cd: 6, grade: 0, run: embers, info: "Three burning insects: 8 damage each, and they set the target alight." },
  disaster_stream: { name: "Fire Stream", cost: 25, cd: 7, grade: 0, run: stream, info: "A cone of fire (8 blocks) for 1 s: 4 damage four times, and burning." },
  disaster_meteor: { name: "Maximum: Meteor", cost: 70, cd: 30, grade: 2, run: meteor, info: "A burning mountain falls on who you aim at: 28 damage within 6 blocks." },
  iron_mountain: { name: "Domain Expansion: Coffin of the Iron Mountain", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "volcano"),
    info: "Radius 12, 10 s: everyone inside takes 3 damage a second and burns." },
};
