// Shrine (Sukuna's technique) — rarest of all, with Limitless.
//   Dismantle          a flying slash: cuts everyone along a 16-block line.
//   Cleave             cuts the one in front of you — the tougher they are, the deeper it cuts.
//   Fuga               (Grade 2) "Open": a flame arrow that bursts into a sea of fire.
//   Malevolent Shrine  (Grade 1) Domain Expansion, with no barrier.

import { V, eye, look, fx, sound, task, aimed, mid, knock, anim, COLOR, rayEnd, health, bar, foes, spawnFx } from "./core.js";
import { hurt } from "./combat.js";
import { expand } from "./domains.js";
import { projectile, alongLine } from "./projectile.js";

function dismantle(p) {
  anim(p, "slash");
  const dim = p.dimension;
  const from = eye(p);
  const dir = look(p);
  const end = rayEnd(dim, from, dir, 16).at;
  const len = V.dist(from, end);
  for (const e of alongLine(p, from, end, 1.4)) {
    hurt(p, e, 10);
    fx(dim, "jjk:blood", mid(e), COLOR.blood, 0.7);
  }
  for (let d = 1.5; d <= len; d += 2) fx(dim, "jjk:slash", V.add(from, V.mul(dir, d)), COLOR.white, 0.9);
  sound(dim, "item.trident.throw", from, 1, 1.7);
  sound(dim, "mob.phantom.swoop", from, 0.6, 1.9);
  return true;
}

function cleave(p) {
  const t = aimed(p, 6);
  if (!t) {
    bar(p, "§7Nothing in reach to Cleave.");
    return false;
  }
  anim(p, "slash");
  const max = health(t)?.effectiveMax ?? 20;
  hurt(p, t, 6 + Math.min(30, max * 0.15));
  const at = mid(t);
  for (let i = 0; i < 3; i++) fx(t.dimension, "jjk:slash", { x: at.x, y: at.y + (i - 1) * 0.4, z: at.z }, i === 1 ? COLOR.red : COLOR.white, 1.1);
  fx(t.dimension, "jjk:blood", at, COLOR.blood, 1.4);
  sound(t.dimension, "item.trident.hit", at, 1, 0.7);
  return true;
}

function fuga(p) {
  anim(p, "fuga");
  const dim = p.dimension;
  sound(dim, "fire.ignite", p.location, 1, 0.6);
  task((age) => {
    const hand = V.add(eye(p), V.mul(look(p), 0.9));
    if (age < 16) {
      if (age % 2 === 0) fx(dim, "jjk:orb", hand, COLOR.fire, 1 + age / 10);
      return true;
    }
    const dir = look(p);
    sound(dim, "mob.ghast.fireball", hand, 1, 0.7);
    const arrow = spawnFx(dim, "jjk:orb", hand, "jjk:as_red");
    projectile(p, {
      from: hand, dir, speed: 1.4, range: 40, radius: 1.4, entity: arrow,
      trail: (pos) => {
        fx(dim, "jjk:orb", pos, COLOR.fire, 1.3);
        fx(dim, "jjk:smoke", pos, COLOR.dark, 0.4);
      },
      onHit: (at) => {
        for (const e of foes(p, at, 6.2)) {
          if (V.dist(mid(e), at) > 5.2) continue;
          hurt(p, e, 25);
          try {
            e.setOnFire(8, true);
          } catch {
            /* ignore */
          }
          const d = V.flat(V.sub(e.location, at));
          knock(e, d.x, d.z, 1.4, 0.5);
        }
        fx(dim, "jjk:burst", at, COLOR.fire, 2.4);
        fx(dim, "jjk:ring", at, COLOR.fire, 1.8);
        fx(dim, "jjk:smoke", at, COLOR.dark, 2);
        sound(dim, "random.explode", at, 1.2, 0.8);
        sound(dim, "fire.ignite", at, 1, 0.8);
      },
    });
    return false;
  }, 20);
  return true;
}

export const SHRINE = {
  dismantle: { name: "Dismantle", cost: 15, cd: 2.5, grade: 0, run: dismantle, info: "10 damage to everyone along a 16-block line." },
  cleave: { name: "Cleave", cost: 25, cd: 6, grade: 0, run: cleave, info: "6 damage + 15% of the target's max health (up to +30)." },
  fuga: { name: "Fuga", cost: 60, cd: 20, grade: 2, run: fuga, info: "A flame arrow: 25 damage in a 5-block blast, and sets them alight." },
  malevolent_shrine: { name: "Domain Expansion: Malevolent Shrine", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "shrine"),
    info: "Radius 14, 10 s, no barrier: 4 damage every half second, and a Cleave every 1.5 s." },
};
