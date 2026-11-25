// Projection Sorcery (Naobito and Naoya Zen'in) — a Zen'in clan technique. You split one second into 24 frames and
// move along them at impossible speed; anyone you touch who can't keep up is frozen inside a frame.
//   24 FPS Rush             four frames forward in a blink (12 blocks): 6 damage to everyone you pass, frozen 1 s.
//   Frame Freeze            touch the one in front of you: trapped in a frame for 2.5 s — touch a frozen one to shatter it.
//   Accelerated Barrage     (Grade 2) 6 s of Speed III and +50% damage.
//   Time Cell Moon Palace   (Grade 1) Domain Expansion: every cell of everyone inside follows the 24-frame rule —
//                           whoever moves is torn apart a little, every second.

import { V, eye, look, fx, sound, task, aimed, foes, mid, tp, anim, COLOR, effect, bar, alive, solidAt, now } from "./core.js";
import { hurt, stun, stunned, dmgHooks } from "./combat.js";
import { expand, registerDomain } from "./domains.js";
import { statusHooks } from "./energy.js";

const accel = new Map(); // caster id -> tick
dmgHooks.push((caster) => ((accel.get(caster?.id) ?? 0) > now() ? 1.5 : 1));
statusHooks.push((p) => {
  const left = (accel.get(p.id) ?? 0) - now();
  return left > 0 ? `§a24 FPS ${Math.ceil(left / 20)}s` : "";
});

function frame(e) {
  fx(e.dimension, "jjk:ring", mid(e), COLOR.white, 0.9);
  fx(e.dimension, "jjk:ring", e.location, COLOR.white, 0.9);
}

function rush(p) {
  anim(p, "black_flash");
  const dim = p.dimension;
  const dir = V.flat(look(p));
  const hit = new Set();
  let pos = { ...p.location };
  sound(dim, "mob.phantom.swoop", pos, 1, 2);
  task((age) => {
    if (!alive(p)) return false;
    const next = V.add(pos, V.mul(dir, 3));
    if (solidAt(dim, V.add(next, { x: 0, y: 0.5, z: 0 })) || solidAt(dim, V.add(next, { x: 0, y: 1.5, z: 0 }))) return false;
    for (const e of foes(p, V.mul(V.add(pos, next), 0.5), 2.6)) {
      if (hit.has(e.id)) continue;
      hit.add(e.id);
      hurt(p, e, 6);
      stun(e, 20);
      frame(e);
    }
    fx(dim, "jjk:smoke", pos, COLOR.white, 0.5);
    pos = next;
    tp(p, pos, { facingLocation: V.add(pos, V.add(dir, { x: 0, y: 1.6, z: 0 })) });
    return age < 3;
  }, 6);
  return true;
}

function freeze(p) {
  const t = aimed(p, 4.5);
  if (!t) {
    bar(p, "§7No one in reach.");
    return false;
  }
  anim(p, "point");
  if (stunned(t)) {
    hurt(p, t, 14); // the frame shatters
    fx(t.dimension, "jjk:spark", mid(t), COLOR.white, 1.6);
    sound(t.dimension, "random.glass", t.location, 1, 0.8);
    return true;
  }
  hurt(p, t, 6);
  stun(t, 50);
  frame(t);
  sound(t.dimension, "random.click", t.location, 1, 1.8);
  return true;
}

function barrage(p) {
  anim(p, "black_flash");
  accel.set(p.id, now() + 120);
  effect(p, "speed", 120, 2);
  fx(p.dimension, "jjk:aura", p.location, COLOR.white, 1.6);
  sound(p.dimension, "mob.phantom.swoop", p.location, 1, 1.6);
  return true;
}

// Time Cell Moon Palace: whoever moves inside takes damage every second
registerDomain("moon", { name: "Time Cell Moon Palace", tech: "projection", radius: 12, ticks: 180, color: COLOR.white, dome: "moon" },
  (d, victims, every, k) => {
    if (!every(20)) return;
    d.last ??= new Map();
    for (const e of victims) {
      effect(e, "slowness", 25, 0);
      const was = d.last.get(e.id);
      d.last.set(e.id, { ...e.location });
      if (was && V.dist(was, e.location) > 0.6) {
        hurt(d.caster, e, 5 * k, { sure: true });
        fx(d.dim, "jjk:spark", mid(e), COLOR.white, 1);
        frame(e);
      }
    }
  });

export const PROJECTION = {
  projection_rush: { name: "24 FPS Rush", cost: 15, cd: 4, grade: 0, run: rush, info: "Blink 12 blocks ahead: 6 damage to everyone you pass, frozen for 1 s." },
  projection_freeze: { name: "Frame Freeze", cost: 20, cd: 8, grade: 0, run: freeze,
    info: "Freeze the one in front for 2.5 s (6 damage) — or shatter a frozen one for 14." },
  projection_barrage: { name: "Accelerated Barrage", cost: 40, cd: 18, grade: 2, run: barrage, info: "6 s of Speed III and +50% damage." },
  time_cell_moon_palace: { name: "Domain Expansion: Time Cell Moon Palace", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "moon"),
    info: "Radius 12, 9 s: whoever moves inside takes 5 damage every second." },
};
export const _state = { accel };
