// Sorcerer grades. Exorcising curses (and beating sorcerers) gives XP; enough XP promotes you:
//   Grade 4 → Grade 3 → Grade 2 → Semi-Grade 1 → Grade 1 → Special Grade.
// Each grade raises your cursed energy, its regeneration, your technique damage and your health (+2 hearts).
// Sukuna's Fingers add on top: +10 max cursed energy and +2% damage each, up to 20.

import { world } from "@minecraft/server";
import { getProp, setProp, tell, title, sound, fx, fxMust, bar, mid, effect, clearEffect, COLOR } from "./core.js";
import { clanMaxCE, clanRegen, clanXp, isCurse } from "./clans.js";
import { vowMult } from "./vows.js";

export const GRADES = [
  { name: "Grade 4", xp: 0, c: "§7" },
  { name: "Grade 3", xp: 500, c: "§a" },
  { name: "Grade 2", xp: 2000, c: "§b" },
  { name: "Semi-Grade 1", xp: 6000, c: "§9" },
  { name: "Grade 1", xp: 15000, c: "§d" },
  { name: "Special Grade", xp: 40000, c: "§6" },
];
export const G = { FOUR: 0, THREE: 1, TWO: 2, SEMI_ONE: 3, ONE: 4, SPECIAL: 5 };
export const MAX_FINGERS = 20;

export const xpOf = (p) => getProp(p, "xp", 0);
export const fingersOf = (p) => getProp(p, "fingers", 0);
export function gradeFromXp(xp) {
  let g = 0;
  for (let i = 0; i < GRADES.length; i++) if (xp >= GRADES[i].xp) g = i;
  return g;
}
export const gradeOf = (p) => gradeFromXp(xpOf(p));
export const gradeName = (g) => `${GRADES[g].c}${GRADES[g].name}`;
// A player's grade as shown to everyone: a curse's says so ("Grade 2 Curse").
export const gradeLabel = (p, g = gradeOf(p)) => `${GRADES[g].c}${GRADES[g].name}${isCurse(p) ? " Curse" : ""}`;
export const dmgMult = (p) => 1 + gradeOf(p) * 0.2 + fingersOf(p) * 0.02;
export const maxCE = (p) => Math.round((100 + gradeOf(p) * 40 + fingersOf(p) * 10) * clanMaxCE(p)); // Gojo clan: +15%
export const regenCE = (p) => (2 + gradeOf(p) * 0.8) * clanRegen(p) * vowMult(p, "regen"); // a second (Kamo clan: +20%; Deep Reserves: +50%)

// XP still needed for the next grade (0 at Special Grade) and progress through the current one (0..1).
export function nextGrade(p) {
  const g = gradeOf(p);
  if (g >= GRADES.length - 1) return { need: 0, frac: 1 };
  const xp = xpOf(p);
  const a = GRADES[g].xp;
  const b = GRADES[g + 1].xp;
  return { need: b - xp, frac: (xp - a) / (b - a) };
}

const promoteHooks = [];
export const onPromote = (f) => promoteHooks.push(f);

// XP earned in play (clanless sorcerers get +15%); admins use setXp or pass raw = true.
export function addXp(p, n, why, raw = false) {
  n = Math.round(n * (raw ? 1 : clanXp(p)));
  if (!(n > 0)) return;
  const before = gradeOf(p);
  setProp(p, "xp", xpOf(p) + n);
  if (why) bar(p, `§a+${n} XP §7${why}`, 30);
  const after = gradeOf(p);
  if (after > before) promote(p, before, after);
}

// Admin: set XP outright (promotes or demotes).
export function setXp(p, xp) {
  const before = gradeOf(p);
  setProp(p, "xp", Math.max(0, Math.round(xp)));
  const after = gradeOf(p);
  if (after > before) promote(p, before, after);
  else applyStats(p);
}

function promote(p, from, to) {
  const g = GRADES[to];
  const curse = isCurse(p);
  title(p, `${g.c}§l${g.name.toUpperCase()}${curse ? " CURSE" : ""}`, curse ? "§7You have grown stronger" : "§7You have been promoted", 50);
  tell(p, `§6✦ §fYou are now ${gradeLabel(p, to)}§f. More cursed energy, more power, more health.`);
  sound(p.dimension, "random.levelup", p.location, 1, 0.8);
  sound(p.dimension, "random.totem", p.location, 0.6, 1.3);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.gold, 1, { radius: 2.2 });
  fx(p.dimension, "jjk:aura", p.location, COLOR.gold, 2);
  fxMust(p.dimension, "jjk:pillar", p.location, COLOR.gold, 1.2);
  fxMust(p.dimension, "jjk:ring", p.location, COLOR.gold, 1.6);
  if (to >= G.ONE) {
    try {
      world.sendMessage(curse ? `§4✦ §f${p.name} §7has grown into a ${gradeLabel(p, to)}§7.` : `§6✦ §f${p.name} §7has been promoted to ${g.c}${g.name}§7.`);
    } catch {
      /* ignore */
    }
  }
  applyStats(p);
  for (const f of promoteHooks) {
    try {
      f(p, from, to);
    } catch {
      /* ignore */
    }
  }
}

// Health: +4 (2 hearts) for every grade above Grade 4, through a hidden, endless Health Boost.
export function applyStats(p) {
  const g = gradeOf(p);
  const had = getProp(p, "hb", -1);
  try {
    if (g === 0) {
      if (had >= 0) {
        clearEffect(p, "health_boost");
        setProp(p, "hb", -1);
      }
      return;
    }
    const cur = p.getEffect?.("health_boost");
    if (!cur || cur.amplifier !== g - 1 || cur.duration < 1200) {
      effect(p, "health_boost", 20000000, g - 1);
      setProp(p, "hb", g - 1);
    }
  } catch {
    /* ignore */
  }
}

export function addFinger(p) {
  const n = fingersOf(p);
  if (n >= MAX_FINGERS) return false;
  setProp(p, "fingers", n + 1);
  return true;
}
