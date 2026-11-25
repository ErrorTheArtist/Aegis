// Ratio Technique (Nanami's technique) — of no clan. Any target can be divided along a line in a 7:3 ratio: strike
// exactly there and the blow is a critical hit.
//   7:3                  a precise strike on the one in front of you: 10 damage, x1.7 while they're above 70% health.
//   Blunt Sword Flurry   three blows on whoever is in front of you; the third always finds the 7:3 point.
//   Overtime             (Grade 2) a binding vow: for 20 s, +40% damage and Strength.
//   Extension: Collapse  (Grade 1) shatter everything around the spot you strike: 26 damage within 6 blocks.

import { V, eye, look, fx, sound, task, aimed, inCone, foes, mid, knock, anim, COLOR, effect, bar, health, alive, rayEnd, ground, now } from "./core.js";
import { hurt, dmgHooks, stun } from "./combat.js";
import { statusHooks } from "./energy.js";

const overtime = new Map(); // caster id -> tick
dmgHooks.push((caster) => ((overtime.get(caster?.id) ?? 0) > now() ? 1.4 : 1));
statusHooks.push((p) => {
  const left = (overtime.get(p.id) ?? 0) - now();
  return left > 0 ? `§9OVERTIME ${Math.ceil(left / 20)}s` : "";
});

function critical(p, t, base) {
  const h = health(t);
  const fresh = h && h.currentValue >= h.effectiveMax * 0.7;
  hurt(p, t, fresh ? base * 1.7 : base);
  const at = mid(t);
  fx(t.dimension, "jjk:slash", at, fresh ? COLOR.gold : COLOR.white, 1.1);
  if (fresh) {
    fx(t.dimension, "jjk:spark", at, COLOR.gold, 1.2);
    sound(t.dimension, "random.anvil_land", at, 0.5, 1.9);
  }
  sound(t.dimension, "item.trident.hit", at, 1, 0.8);
  return fresh;
}

function sevenThree(p) {
  const t = aimed(p, 6);
  if (!t) {
    bar(p, "§7No one in reach.");
    return false;
  }
  anim(p, "slash");
  if (critical(p, t, 10)) bar(p, "§6Critical — 7:3", 20);
  return true;
}

function flurry(p) {
  if (!inCone(p, 4, 0.5).length) {
    bar(p, "§7No one in reach.");
    return false;
  }
  let n = 0;
  task((age) => {
    if (!alive(p)) return false;
    if (age % 10 !== 0) return true;
    anim(p, n === 2 ? "black_flash" : "slash");
    for (const t of inCone(p, 4, 0.5)) {
      if (n < 2) {
        hurt(p, t, 5);
        fx(t.dimension, "jjk:slash", mid(t), COLOR.white, 0.8);
      } else {
        hurt(p, t, 5 * 1.7 * 1.6);
        fx(t.dimension, "jjk:spark", mid(t), COLOR.gold, 1.3);
      }
    }
    return ++n < 3;
  }, 32);
  return true;
}

function overtimeVow(p) {
  anim(p, "heal");
  overtime.set(p.id, now() + 400);
  effect(p, "strength", 400, 0);
  fx(p.dimension, "jjk:aura", p.location, COLOR.gold, 2);
  sound(p.dimension, "random.levelup", p.location, 0.6, 0.6);
  bar(p, "§9Overtime: §f+40% damage for 20 s", 40);
  return true;
}

function collapse(p) {
  anim(p, "black_flash");
  const dim = p.dimension;
  const at = ground(dim, rayEnd(dim, eye(p), look(p), 6).at, 6);
  task((age) => {
    if (age < 5) return true;
    for (const e of foes(p, at, 7)) {
      if (V.dist(e.location, at) > 6) continue;
      hurt(p, e, 26);
      const d = V.flat(V.sub(e.location, at));
      knock(e, d.x, d.z, 1.2, 0.7);
      stun(e, 20);
    }
    fx(dim, "jjk:ring", at, COLOR.gold, 2.2);
    fx(dim, "jjk:smoke", at, COLOR.grey, 2.6);
    fx(dim, "jjk:burst", V.add(at, { x: 0, y: 0.5, z: 0 }), COLOR.grey, 2);
    sound(dim, "random.explode", at, 1.2, 0.7);
    sound(dim, "dig.stone", at, 1, 0.6);
    return false;
  }, 8);
  return true;
}

export const RATIO = {
  ratio_seven_three: { name: "7:3", cost: 20, cd: 6, grade: 0, run: sevenThree, info: "10 damage to the one in front, x1.7 while they're above 70% health." },
  ratio_flurry: { name: "Blunt Sword Flurry", cost: 25, cd: 9, grade: 0, run: flurry, info: "Three blows of 5; the third is a guaranteed critical (13.6)." },
  ratio_overtime: { name: "Overtime", cost: 40, cd: 60, grade: 2, run: overtimeVow, info: "A binding vow: 20 s of +40% damage and Strength." },
  ratio_collapse: { name: "Extension: Collapse", cost: 70, cd: 40, grade: 4, run: collapse,
    info: "Shatter the ground ahead: 26 damage within 6 blocks, and a short stun." },
};
export const _state = { overtime };
