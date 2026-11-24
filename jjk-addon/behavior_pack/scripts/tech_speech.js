// Cursed Speech (Inumaki's technique): your words are commands. Every word strains your throat — each move also costs
// health — and commanding someone of a higher grade than you backfires (+2 damage to you, and they shake it off sooner).
//   "Don't Move"      everyone in front of you is frozen for 2 s.
//   "Blast Away"      blows everyone in front of you back.
//   "Crush"           (Grade 2) crushes the one you look at.
//   Maximum: "Twist"  (Grade 1) wrings out everyone within 10 blocks.

import { V, eye, fx, sound, inCone, aimed, foes, mid, knock, anim, COLOR, effect, bar, health, isPlayer } from "./core.js";
import { hurt, stun } from "./combat.js";
import { gradeOf } from "./grades.js";

function voice(p, color = COLOR.teal) {
  anim(p, "shout");
  const at = eye(p);
  fx(p.dimension, "jjk:ring", at, color, 0.7);
  fx(p.dimension, "jjk:ring", V.add(at, { x: 0, y: -0.3, z: 0 }), color, 1.1);
  sound(p.dimension, "mob.elderguardian.curse", at, 0.4, 1.6);
}
// commanding a stronger sorcerer hurts you more
function backlash(p, targets) {
  if (!targets.some((e) => isPlayer(e) && gradeOf(e) > gradeOf(p))) return false;
  const h = health(p);
  if (h) h.setCurrentValue(Math.max(1, h.currentValue - 2));
  bar(p, "§cThey're stronger than you — your throat tears.", 40);
  return true;
}

function dontMove(p) {
  const ts = inCone(p, 12, 0.75);
  if (!ts.length) {
    bar(p, "§7No one in front of you to command.");
    return false;
  }
  voice(p);
  for (const e of ts) {
    const resist = isPlayer(e) && gradeOf(e) > gradeOf(p);
    stun(e, resist ? 20 : 40);
    fx(e.dimension, "jjk:ring", e.location, COLOR.teal, 0.8);
  }
  backlash(p, ts);
  return true;
}

function blastAway(p) {
  const ts = inCone(p, 10, 0.7);
  if (!ts.length) {
    bar(p, "§7No one in front of you to command.");
    return false;
  }
  voice(p);
  for (const e of ts) {
    hurt(p, e, 8);
    const d = V.flat(V.sub(e.location, p.location));
    knock(e, d.x, d.z, 2.8, 0.55);
    fx(e.dimension, "jjk:burst", mid(e), COLOR.teal, 0.8);
  }
  backlash(p, ts);
  return true;
}

function crush(p) {
  const t = aimed(p, 16);
  if (!t) {
    bar(p, "§7Look at who you want to crush.");
    return false;
  }
  voice(p);
  hurt(p, t, 22);
  effect(t, "slowness", 60, 2);
  fx(t.dimension, "jjk:ring", t.location, COLOR.teal, 1.4);
  fx(t.dimension, "jjk:smoke", t.location, COLOR.grey, 1.2);
  sound(t.dimension, "random.anvil_land", t.location, 1, 0.5);
  backlash(p, [t]);
  return true;
}

function twist(p) {
  const ts = foes(p, p.location, 10);
  voice(p, COLOR.white);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.teal, 1, { radius: 10 });
  for (const e of ts) {
    hurt(p, e, 30);
    effect(e, "nausea", 120, 0);
    fx(e.dimension, "jjk:spark", mid(e), COLOR.teal, 1);
  }
  sound(p.dimension, "mob.wither.break_block", p.location, 1, 0.6);
  backlash(p, ts);
  return true;
}

export const CURSED_SPEECH = {
  speech_dont_move: { name: "\"Don't Move\"", cost: 20, hp: 1, cd: 8, grade: 0, run: dontMove, info: "Freezes everyone in front of you (12 blocks) for 2 s." },
  speech_blast_away: { name: "\"Blast Away\"", cost: 20, hp: 1, cd: 6, grade: 0, run: blastAway, info: "8 damage and a big push to everyone in front." },
  speech_crush: { name: "\"Crush\"", cost: 45, hp: 3, cd: 15, grade: 2, run: crush, info: "22 damage to the one you look at (16 blocks)." },
  speech_twist: { name: "Maximum: \"Twist\"", cost: 80, hp: 6, cd: 45, grade: 4, run: twist, info: "30 damage to everyone within 10 blocks." },
};
