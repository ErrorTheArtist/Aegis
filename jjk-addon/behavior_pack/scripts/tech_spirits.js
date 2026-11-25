// Cursed Spirit Manipulation (Geto's technique) — of no clan. Every curse you exorcise is absorbed (up to 12), and
// you can release them to fight for you.
//   Release            release your strongest stored curse: it fights for you for 30 s.
//   Absorb             swallow a weakened curse in front of you (40% health or less) on the spot.
//   Cursed Swarm       (Grade 2) release up to four at once.
//   Maximum: Uzumaki   (Grade 1) compress every stored curse into one spiralling blast: 10 + 3 for each curse.
// (An NPC Geto keeps a few curses in him for ever, and his Uzumaki always compresses four.)

import { V, eye, look, fx, sound, task, foes, mid, anim, COLOR, bar, tell, getProp, setProp, health, alive, isPlayer, ground, aimed, bump, removeFx, rayEnd } from "./core.js";
import { hurt } from "./combat.js";
import { addXp } from "./grades.js";
import { statusHooks } from "./energy.js";
import { spawnServant } from "./servants.js";
import { deathHooks, CURSE_XP } from "./curses.js";

export const MAX_SPIRITS = 12;
const ABSORBABLE = ["jjk:fly_head", "jjk:lanky_curse", "jjk:mouth_curse", "jjk:eye_curse"]; // weakest -> strongest
const NAMES = { "jjk:fly_head": "Grade 4", "jjk:lanky_curse": "Grade 3", "jjk:mouth_curse": "Grade 2", "jjk:eye_curse": "Grade 1" };

export function spiritsOf(p) {
  if (!isPlayer(p)) return ["jjk:mouth_curse", "jjk:lanky_curse", "jjk:mouth_curse", "jjk:eye_curse", "jjk:lanky_curse", "jjk:mouth_curse"]; // an NPC Geto never runs out
  const raw = getProp(p, "spirits", "");
  return raw ? raw.split(",").filter((t) => ABSORBABLE.includes(t)) : [];
}
function save(p, list) {
  if (isPlayer(p)) setProp(p, "spirits", list.slice(0, MAX_SPIRITS).join(","));
}
export function absorb(p, typeId) {
  if (!ABSORBABLE.includes(typeId)) return false;
  const list = spiritsOf(p);
  if (list.length >= MAX_SPIRITS) return false;
  list.push(typeId);
  save(p, list);
  return true;
}
function takeStrongest(p) {
  const list = spiritsOf(p);
  if (!list.length) return undefined;
  list.sort((a, b) => ABSORBABLE.indexOf(a) - ABSORBABLE.indexOf(b));
  const t = list.pop();
  save(p, list);
  return t;
}

// exorcising a curse absorbs it
deathHooks.push((dead, p) => {
  if (!p || getProp(p, "technique") !== "cursed_spirit" || !ABSORBABLE.includes(dead.typeId)) return;
  if (absorb(p, dead.typeId)) bar(p, `§6Absorbed a ${NAMES[dead.typeId]} curse §7(${spiritsOf(p).length}/${MAX_SPIRITS})`, 30);
});
statusHooks.push((p) => (getProp(p, "technique") === "cursed_spirit" ? `§6CURSES ${spiritsOf(p).length}` : ""));

function release(p, n) {
  let out = 0;
  for (let i = 0; i < n; i++) {
    const t = takeStrongest(p);
    if (!t) break;
    const a = Math.random() * Math.PI * 2;
    spawnServant(p, t, ground(p.dimension, { x: p.location.x + Math.cos(a) * 2, y: p.location.y + 2, z: p.location.z + Math.sin(a) * 2 }, 6), 30);
    out++;
  }
  return out;
}

function releaseOne(p) {
  if (!spiritsOf(p).length) {
    bar(p, "§7No curses stored — exorcise some (or Absorb a weakened one).");
    return false;
  }
  anim(p, "summon");
  release(p, 1);
  sound(p.dimension, "mob.wither.ambient", p.location, 0.7, 0.9);
  return true;
}

function swarm(p) {
  if (!spiritsOf(p).length) {
    bar(p, "§7No curses stored.");
    return false;
  }
  anim(p, "summon");
  const n = release(p, 4);
  fx(p.dimension, "jjk:ring", p.location, COLOR.dark, 1.6);
  sound(p.dimension, "mob.wither.ambient", p.location, 1, 0.7);
  bar(p, `§6Released ${n} curses`, 20);
  return true;
}

function absorbMove(p) {
  if (spiritsOf(p).length >= MAX_SPIRITS) {
    bar(p, `§7You can't hold more than ${MAX_SPIRITS} curses.`);
    return false;
  }
  const t = aimed(p, 6);
  const h = t && health(t);
  if (!t || !ABSORBABLE.includes(t.typeId) || getProp(t, "owner") || !h || h.currentValue > h.effectiveMax * 0.4) {
    bar(p, "§7Look at a weakened curse (40% health or less).");
    return false;
  }
  anim(p, "eat");
  absorb(p, t.typeId);
  fx(t.dimension, "jjk:implode", mid(t), COLOR.dark, 1, { radius: 2 });
  fx(t.dimension, "jjk:smoke", t.location, COLOR.dark, 1.4);
  removeFx(t);
  if (isPlayer(p)) {
    addXp(p, CURSE_XP[t.typeId] ?? 10, `absorbed a ${NAMES[t.typeId]} curse`);
    bump(p, "exorcised");
  }
  sound(p.dimension, "random.burp", p.location, 1, 0.5);
  return true;
}

function uzumaki(p) {
  const list = spiritsOf(p);
  if (!list.length) {
    bar(p, "§7No curses stored to compress.");
    return false;
  }
  anim(p, "purple");
  const n = isPlayer(p) ? Math.min(MAX_SPIRITS, list.length) : 4;
  save(p, []);
  const dim = p.dimension;
  task((age) => {
    if (!alive(p)) return false;
    if (age < 14) {
      if (age % 2 === 0) fx(dim, "jjk:implode", V.add(eye(p), V.mul(look(p), 1.5)), COLOR.shadow, 1, { radius: 2.5 });
      return true;
    }
    const from = V.add(eye(p), V.mul(look(p), 1.5));
    const t = aimed(p, 24);
    const dir = t ? V.norm(V.sub(mid(t), from)) : look(p);
    const end = rayEnd(dim, from, dir, 24);
    const hit = new Set();
    for (let d = 1; d <= end.d; d += 1) {
      const at = V.add(from, V.mul(dir, d));
      for (const e of foes(p, at, 2.4)) {
        if (hit.has(e.id)) continue;
        hit.add(e.id);
        hurt(p, e, 10 + 3 * n);
      }
      if (d % 2 === 0) fx(dim, "jjk:burst", at, COLOR.shadow, 0.6 + n * 0.08);
    }
    sound(dim, "random.explode", from, 1.2, 0.6);
    if (isPlayer(p)) tell(p, `§6Maximum: Uzumaki §7— ${n} curse${n === 1 ? "" : "s"} compressed.`);
    return false;
  }, 16);
  return true;
}

export const CURSED_SPIRITS = {
  spirit_release: { name: "Release", cost: 15, cd: 6, grade: 0, run: releaseOne, info: "Your strongest stored curse fights for you for 30 s." },
  spirit_absorb: { name: "Absorb", cost: 20, cd: 10, grade: 0, run: absorbMove, info: "Swallow a curse in front of you at 40% health or less (XP as if exorcised)." },
  spirit_swarm: { name: "Cursed Swarm", cost: 45, cd: 25, grade: 2, run: swarm, info: "Release up to four stored curses at once." },
  uzumaki: { name: "Maximum: Uzumaki", cost: 60, cd: 45, grade: 4, run: uzumaki, info: "All stored curses in one blast along 24 blocks: 10 + 3 damage per curse." },
};
