// Every Cursed Spirit's own powers — in place of Simple Domain and Reverse Cursed Technique, which are a sorcerer's:
//   Devour           (Grade 4) eat a weakened curse within 4 blocks (a third of its health or less): it's gone, and you
//                    get what exorcising it would give, a quarter of your health and 20 CE.
//   Terror           (Grade 3) the fear you're made of, let loose: everyone within 8 blocks takes 5 and is weakened,
//                    slowed and sickened for 6 s.
//   Curse Unleashed  (Grade 2) 15 s of Strength II, Speed and Resistance, wrapped in your cursed energy.
//   Regeneration     (always) a curse's body heals itself: every second, 0.5 health (+0.25 a grade) for 2 CE.

import { world, system } from "@minecraft/server";
import { V, fx, fxMust, sound, task, foes, mid, anim, COLOR, effect, health, alive, bar, getProp, bump, shake } from "./core.js";
import { hurt } from "./combat.js";
import { getCE, setCE, addCE } from "./energy.js";
import { gradeOf } from "./grades.js";
import { isCurse } from "./clans.js";
import { devoured } from "./curses.js";

export const CURSE_RGB = [0.55, 0.08, 0.2];
const EDIBLE = /^jjk:(fly_head|lanky_curse|mouth_curse|eye_curse)$/; // (never the Finger Bearer, never someone's servant)

function heal(p, n) {
  const h = health(p);
  if (h && h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n));
}

function devour(p) {
  let best;
  let bd = 1e9;
  for (const e of foes(p, p.location, 4.5)) {
    if (!EDIBLE.test(e.typeId) || getProp(e, "owner")) continue;
    const h = health(e);
    if (!h || h.currentValue > h.effectiveMax / 3) continue;
    const d = V.dist(e.location, p.location);
    if (d < bd) {
      best = e;
      bd = d;
    }
  }
  if (!best) {
    bar(p, "§7No weakened curse close enough to devour §8(a third of its health or less, within 4 blocks).");
    return false;
  }
  const at = mid(best);
  fx(p.dimension, "jjk:smoke", at, COLOR.dark, 1.2);
  fx(p.dimension, "jjk:blood", at, CURSE_RGB, 0.8);
  devoured(best, p);
  try {
    best.remove();
  } catch {
    /* ignore */
  }
  const h = health(p);
  if (h) heal(p, h.effectiveMax * 0.25);
  addCE(p, 20);
  bump(p, "devoured");
  anim(p, "eat");
  sound(p.dimension, "random.burp", p.location, 1, 0.6);
  return true;
}

function terror(p) {
  anim(p, "shout");
  const dim = p.dimension;
  for (const e of foes(p, p.location, 8)) {
    hurt(p, e, 5);
    effect(e, "weakness", 120, 1);
    effect(e, "slowness", 120, 1);
    effect(e, "nausea", 120, 0);
    fx(dim, "jjk:aura", e.location, CURSE_RGB, 1);
  }
  fxMust(dim, "jjk:ring", p.location, CURSE_RGB, 2.6);
  fx(dim, "jjk:shell", mid(p), CURSE_RGB, 1, { radius: 8 });
  shake(dim, p.location, 0.3, 0.5, 12);
  sound(dim, "mob.ghast.scream", p.location, 1, 0.6);
  return true;
}

function unleash(p) {
  anim(p, "stance");
  effect(p, "strength", 300, 1);
  effect(p, "speed", 300, 0);
  effect(p, "resistance", 300, 0);
  fxMust(p.dimension, "jjk:pillar", p.location, CURSE_RGB, 1);
  sound(p.dimension, "mob.wither.spawn", p.location, 0.6, 1.5);
  task((age) => {
    if (!alive(p)) return false;
    if (age % 10 === 0) fx(p.dimension, "jjk:aura", p.location, CURSE_RGB, 1.4);
    return age < 300;
  }, 310);
  return true;
}

export const CURSE_MOVES = {
  curse_devour: { name: "Devour", cost: 10, cd: 4, grade: 0, curse: true, run: devour,
    info: "Eat a weakened curse within 4 blocks (a third of its health or less): its XP, a quarter of your health back and 20 CE." },
  curse_terror: { name: "Terror", cost: 30, cd: 18, grade: 1, curse: true, run: terror,
    info: "Everyone within 8 blocks takes 5 and is weakened, slowed and sickened for 6 s." },
  curse_unleash: { name: "Curse Unleashed", cost: 50, cd: 45, grade: 2, curse: true, run: unleash, info: "15 s: Strength II, Speed and Resistance." },
};

export function initCursePowers() {
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (!isCurse(p) || !alive(p)) continue;
      const h = health(p);
      if (!h || h.currentValue >= h.effectiveMax || getCE(p) < 2) continue;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 0.5 + 0.25 * gradeOf(p)));
      setCE(p, getCE(p) - 2);
    }
  }, 20);
  // a curse's cursed energy hangs about it
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) if (isCurse(p) && alive(p)) fx(p.dimension, "jjk:aura", p.location, CURSE_RGB, 0.6);
  }, 60);
}
