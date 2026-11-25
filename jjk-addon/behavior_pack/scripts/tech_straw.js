// Straw Doll Technique (Nobara's technique) — of no clan. A hammer, nails, and a straw doll: anything you've hurt has
// left a piece of itself behind, and what you do to the doll happens to them.
//   Hairpin                three nails fly out; a moment later every nail that struck bursts.
//   Resonance              strike the doll: the last enemy you hurt (within 64 blocks) takes the blow, wherever it is.
//   Nail Barrage           (Grade 2) slam the hammer down: nails burst out in every direction.
//   Resonance: Cursed Doll (Grade 1) every enemy you've hurt in the last 30 s takes the blow at once.

import { V, eye, look, fx, sound, mid, anim, COLOR, effect, bar, alive, byId, later, now } from "./core.js";
import { hurt, hitHooks } from "./combat.js";
import { projectile } from "./projectile.js";

const pieces = new Map(); // caster id -> Map(target id -> tick of the last hit)
hitHooks.push((caster, target) => {
  if (!caster?.id || !target?.id) return;
  const m = pieces.get(caster.id) ?? new Map();
  m.set(target.id, now());
  if (m.size > 24) m.delete(m.keys().next().value);
  pieces.set(caster.id, m);
});
// Enemies this caster has a piece of: hurt within `ticks`, still alive, same dimension, within `range` blocks.
export function piecesOf(caster, ticks = 600, range = 64) {
  const out = [];
  for (const [id, t] of pieces.get(caster.id) ?? []) {
    if (now() - t > ticks) continue;
    const e = byId(id);
    if (!alive(e) || e.dimension?.id !== caster.dimension?.id || V.dist(e.location, caster.location) > range) continue;
    out.push({ e, t });
  }
  return out.sort((a, b) => b.t - a.t).map((x) => x.e);
}

function yawed(d, deg) {
  const a = (deg * Math.PI) / 180;
  return V.norm({ x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y, z: d.x * Math.sin(a) + d.z * Math.cos(a) });
}

function nails(p, dirs, speed, range, dmg, stuck) {
  const dim = p.dimension;
  const from = V.add(eye(p), V.mul(look(p), 0.8));
  for (const dir of dirs) {
    projectile(p, {
      from, dir, speed, range, radius: 1.0,
      trail: (pos) => fx(dim, "jjk:orb", pos, COLOR.grey, 0.35),
      onHit: (at, t) => {
        fx(dim, "jjk:spark", at, COLOR.gold, 0.5);
        if (!t) return;
        hurt(p, t, dmg);
        if (stuck) stuck.set(t.id, (stuck.get(t.id) ?? 0) + 1);
      },
    });
  }
  sound(dim, "random.anvil_land", p.location, 0.5, 2);
}

function hairpin(p) {
  anim(p, "point");
  const stuck = new Map();
  const d = look(p);
  nails(p, [yawed(d, -10), d, yawed(d, 10)], 1.8, 24, 4, stuck);
  later(() => {
    for (const [id, n] of stuck) {
      const t = byId(id);
      if (!alive(t)) continue;
      hurt(p, t, 6 * n);
      fx(t.dimension, "jjk:burst", mid(t), COLOR.fire, 0.6 + n * 0.3);
      sound(t.dimension, "random.explode", t.location, 0.5, 1.8);
    }
    if (stuck.size) bar(p, "§6Hairpin!", 20);
  }, 18);
  return true;
}

function strike(p, t, dmg) {
  hurt(p, t, dmg);
  effect(t, "slowness", 40, 1);
  fx(t.dimension, "jjk:spark", mid(t), COLOR.gold, 1.2);
  fx(t.dimension, "jjk:ring", mid(t), COLOR.red, 0.7);
  sound(t.dimension, "random.anvil_land", t.location, 0.6, 1.4);
}

function resonance(p) {
  const t = piecesOf(p, 600, 64)[0];
  if (!t) {
    bar(p, "§7You need a piece of them first — hit them.");
    return false;
  }
  anim(p, "slash");
  fx(p.dimension, "jjk:spark", V.add(eye(p), V.mul(look(p), 0.8)), COLOR.gold, 0.8);
  strike(p, t, 14);
  return true;
}

function barrage(p) {
  anim(p, "black_flash");
  const d = V.flat(look(p));
  nails(p, Array.from({ length: 10 }, (_, i) => yawed(d, i * 36)), 1.4, 10, 6);
  fx(p.dimension, "jjk:ring", p.location, COLOR.gold, 1.4);
  return true;
}

function cursedDoll(p) {
  const ts = piecesOf(p, 600, 96);
  if (!ts.length) {
    bar(p, "§7You haven't hurt anyone lately — no pieces to resonate with.");
    return false;
  }
  anim(p, "slash");
  for (const t of ts) {
    strike(p, t, 20);
    effect(t, "wither", 60, 0);
  }
  bar(p, `§6Resonance: §f${ts.length} §6struck at once`, 30);
  return true;
}

export const STRAW_DOLL = {
  straw_hairpin: { name: "Hairpin", cost: 20, cd: 5, grade: 0, run: hairpin, info: "Three nails, 4 damage each; every nail that sticks bursts for 6 more." },
  straw_resonance: { name: "Resonance", cost: 30, cd: 10, grade: 0, run: resonance,
    info: "14 damage to the last enemy you hurt in 30 s, wherever they are (64 blocks)." },
  straw_nail_barrage: { name: "Nail Barrage", cost: 45, cd: 15, grade: 2, run: barrage, info: "Ten nails in every direction, 6 damage each." },
  straw_cursed_doll: { name: "Resonance: Cursed Doll", cost: 70, cd: 45, grade: 4, run: cursedDoll,
    info: "20 damage and wither to every enemy you hurt in the last 30 s." },
};
