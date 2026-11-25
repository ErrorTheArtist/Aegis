// Idle Transfiguration (Mahito's technique) — of no clan. You perceive the soul, and reshape it with a touch.
//   Soul Touch                       touch the one in front of you and twist their soul.
//   Body Repel                       spikes burst out of your body; you harden for a moment.
//   Polymorphic Soul Isomer          (Grade 2) two transfigured humans burst out of you and fight for 20 s.
//   Self-Embodiment of Perfection    (Grade 1) Domain Expansion: everyone inside is touched, again and again — and
//                                    whoever is still inside when it ends takes the final touch.

import { V, fx, sound, aimed, inCone, foes, mid, knock, anim, COLOR, effect, bar, ground, isPlayer } from "./core.js";
import { hurt } from "./combat.js";
import { expand, registerDomain, insideDomain, shielded } from "./domains.js";
import { spawnServant } from "./servants.js";

function soulTouch(p) {
  const t = aimed(p, 4) ?? inCone(p, 3.5, 0.5)[0];
  if (!t) {
    bar(p, "§7No one close enough to touch.");
    return false;
  }
  anim(p, "point");
  hurt(p, t, 12);
  effect(t, "nausea", 100, 0);
  effect(t, "slowness", 60, 1);
  fx(t.dimension, "jjk:aura", t.location, COLOR.shadow, 1.6);
  fx(t.dimension, "jjk:spark", mid(t), COLOR.blue, 0.8);
  sound(t.dimension, "mob.zombie.unfect", t.location, 0.8, 0.7);
  return true;
}

function repel(p) {
  anim(p, "black_flash");
  for (const e of foes(p, p.location, 4)) {
    hurt(p, e, 10);
    const d = V.flat(V.sub(e.location, p.location));
    knock(e, d.x, d.z, 1.4, 0.35);
  }
  effect(p, "resistance", 60, 0);
  fx(p.dimension, "jjk:spark", mid(p), COLOR.grey, 1.8);
  fx(p.dimension, "jjk:ring", p.location, COLOR.blue, 1.1);
  sound(p.dimension, "random.anvil_land", p.location, 0.5, 0.6);
  return true;
}

function isomer(p) {
  anim(p, "summon");
  for (let i = 0; i < 2; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnServant(p, "jjk:lanky_curse", ground(p.dimension, { x: p.location.x + Math.cos(a) * 2, y: p.location.y + 2, z: p.location.z + Math.sin(a) * 2 }, 6), 20);
  }
  sound(p.dimension, "mob.zombie.unfect", p.location, 1, 0.5);
  return true;
}

registerDomain("perfection", { name: "Self-Embodiment of Perfection", tech: "idle_transfiguration", radius: 11, ticks: 180, color: COLOR.shadow, dome: "perfection" },
  (d, victims, every, k) => {
    if (!every(20)) return;
    for (const e of victims) {
      hurt(d.caster, e, 3 * k, { sure: true });
      effect(e, "slowness", 25, 2);
      effect(e, "nausea", 40, 0);
      fx(d.dim, "jjk:aura", e.location, COLOR.shadow, 1.2);
    }
  },
  (d, why) => {
    if (why) return; // only when it runs its full course
    for (const e of foes(d.caster, d.center, d.def.radius, d.dim)) {
      if (!insideDomain(d, e) || shielded(d, e)) continue;
      hurt(d.caster, e, 12 * (isPlayer(d.caster) ? 1 : 0.5), { sure: true });
      fx(d.dim, "jjk:burst", mid(e), COLOR.shadow, 1.2);
    }
    sound(d.dim, "mob.zombie.unfect", d.center, 1.4, 0.5);
  });

export const IDLE_TRANSFIGURATION = {
  idle_soul_touch: { name: "Soul Touch", cost: 20, cd: 6, grade: 0, run: soulTouch, info: "12 damage to the one you touch, plus nausea and slowness." },
  idle_body_repel: { name: "Body Repel", cost: 25, cd: 9, grade: 0, run: repel, info: "10 damage and a push to everyone within 4 blocks; Resistance for 3 s." },
  idle_isomer: { name: "Polymorphic Soul Isomer", cost: 45, cd: 20, grade: 2, run: isomer, info: "Two transfigured humans fight for you for 20 s." },
  self_embodiment: { name: "Domain Expansion: Self-Embodiment of Perfection", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "perfection"),
    info: "Radius 11, 9 s: 3 damage a second, slowness and nausea — and a final 12 to whoever is still inside." },
};
