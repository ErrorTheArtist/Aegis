// Heavenly Restriction (Toji / Maki): born with no cursed energy at all — and a body far beyond any sorcerer's.
//   Passive   Strength (II from Grade 1), Speed, Resistance, Jump Boost; Regeneration from Semi-Grade 1.
//             No cursed energy means no Black Flash and no domain — but a domain's sure-hit can't find you either.
//   Cursed tools (real weapons; right-click for their art):
//     Playful Cloud             Whirlwind: three crushing blows in front of you.
//     Dragon-Bone               Impact Release: lunge, and give back half of everything you took in the last 10 s.
//     Inverted Spear of Heaven  (Grade 2) Nullify: stab — it switches off Infinity, breaks the target's domain and
//                               strips their buffs.
//     Split Soul Katana         (Grade 1) Soul Split: cuts the soul — the tougher the target, the deeper.

import { world, system } from "@minecraft/server";
import { V, fx, sound, task, aimed, inCone, mid, knock, anim, COLOR, effect, bar, health, alive, getProp, clearEffect, isPlayer, tell, look } from "./core.js";
import { hurt, recentDamage } from "./combat.js";
import { breakDomain } from "./domains.js";
import { gradeOf, G } from "./grades.js";

function whirlwind(p) {
  if (!inCone(p, 4, 0.4).length) {
    bar(p, "§7No one in reach.");
    return false;
  }
  anim(p, "tool_spin");
  let n = 0;
  task((age) => {
    if (!alive(p)) return false;
    if (age % 10 !== 0) return true;
    for (const e of inCone(p, 4, 0.4)) {
      hurt(p, e, 7);
      const d = V.flat(V.sub(e.location, p.location));
      knock(e, d.x, d.z, 0.9, 0.3);
      fx(e.dimension, "jjk:spark", mid(e), COLOR.red, 0.8);
    }
    sound(p.dimension, "random.anvil_land", p.location, 0.3, 1.8);
    return ++n < 3;
  }, 35);
  return true;
}

function impactRelease(p) {
  const stored = recentDamage(p, 200);
  const bonus = Math.min(20, stored * 0.5);
  const dir = V.flat(look(p));
  anim(p, "black_flash");
  knock(p, dir.x, dir.z, 1.6, 0.12);
  fx(p.dimension, "jjk:streak", V.add(p.location, { x: 0, y: 1, z: 0 }), COLOR.white, 1, { dx: dir.x, dy: 0, dz: dir.z });
  task((age) => {
    if (age < 4) return true;
    const ts = inCone(p, 4, 0.4);
    for (const e of ts) {
      hurt(p, e, 8 + bonus);
      knock(e, dir.x, dir.z, 1.4, 0.35);
      fx(e.dimension, "jjk:burst", mid(e), bonus > 5 ? COLOR.red : COLOR.white, 0.8 + bonus / 20);
    }
    if (ts.length) recentDamage(p, 200, true); // released
    sound(p.dimension, "random.explode", p.location, 0.5, 1.5);
    fx(p.dimension, "jjk:ring", p.location, COLOR.white, 0.8);
    return false;
  }, 6);
  if (bonus >= 1) bar(p, `§eImpact released: §f+${Math.round(bonus)} damage`, 30);
  return true;
}

const BUFFS = ["strength", "speed", "resistance", "regeneration", "absorption", "haste", "jump_boost"];
function nullify(p) {
  const t = aimed(p, 5);
  if (!t) {
    bar(p, "§7No one in reach.");
    return false;
  }
  anim(p, "tool_spin");
  hurt(p, t, 10, { pierce: true });
  const broke = breakDomain(t);
  if (isPlayer(t)) {
    for (const b of BUFFS) clearEffect(t, b);
    tell(t, broke ? "§cThe Inverted Spear of Heaven nullified your domain!" : "§cThe Inverted Spear of Heaven nullified your technique!");
  }
  fx(t.dimension, "jjk:spark", mid(t), COLOR.white, 1.2);
  fx(t.dimension, "jjk:ring", mid(t), COLOR.white, 0.8);
  sound(t.dimension, "random.glass", t.location, 1, 0.7);
  return true;
}

function soulSplit(p) {
  const t = aimed(p, 6);
  if (!t) {
    bar(p, "§7No one in reach.");
    return false;
  }
  anim(p, "tool_spin");
  const max = health(t)?.effectiveMax ?? 20;
  hurt(p, t, 12 + Math.min(25, max * 0.1));
  fx(t.dimension, "jjk:slash", mid(t), COLOR.water, 1.3);
  fx(t.dimension, "jjk:aura", t.location, COLOR.white, 1.4);
  sound(t.dimension, "item.trident.hit", t.location, 1, 0.5);
  return true;
}

export const HEAVENLY = {
  playful_cloud: { name: "Playful Cloud", cost: 0, cd: 12, grade: 0, run: whirlwind, info: "Whirlwind: 3 blows of 7 damage in front of you." },
  dragon_bone: { name: "Dragon-Bone", cost: 0, cd: 10, grade: 0, run: impactRelease,
    info: "Impact Release: lunge for 8 + half the damage you took in the last 10 s (up to +20)." },
  inverted_spear_of_heaven: { name: "Inverted Spear of Heaven", cost: 0, cd: 20, grade: 2, run: nullify,
    info: "Nullify: 10 damage through Infinity; breaks their domain and strips their buffs." },
  split_soul_katana: { name: "Split Soul Katana", cost: 0, cd: 16, grade: 4, run: soulSplit, info: "Soul Split: 12 + 10% of their max health (up to +25)." },
};

// The body: refreshed every 2 seconds.
export function initHeavenly() {
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (getProp(p, "technique") !== "heavenly" || !alive(p)) continue;
      const g = gradeOf(p);
      effect(p, "strength", 60, g >= G.ONE ? 1 : 0);
      effect(p, "speed", 60, 0);
      effect(p, "resistance", 60, 0);
      effect(p, "jump_boost", 60, 0);
      if (g >= G.SEMI_ONE) effect(p, "regeneration", 60, 0);
    }
  }, 40);
}
