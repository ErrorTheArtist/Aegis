// Idle Death Gamble (Hakari's technique) — of no clan. A gambler's technique: rough cursed energy, shutter doors, a
// pachinko barrage — and a domain that hurts no one, but spins for a jackpot.
//   Rough Energy                  a burst of rough cursed energy at the one you look at (1 in 8: a little jackpot, +20 CE).
//   Shutter Doors                 two doors slam shut on the one you look at.
//   Pachinko Rush                 (Grade 2) a spray of pachinko balls.
//   Domain Expansion: Idle Death Gamble  (Grade 1) every 2 s the reels spin (1 in 4). JACKPOT: for 20 s your cursed
//                                 energy never runs out, your body heals itself as fast as it's hurt, and you hit 25% harder.
//                                 A jackpot ends the domain without burnout. No jackpot: you just gambled 70% of your CE.

import { world } from "@minecraft/server";
import { V, eye, look, fx, sound, task, aimed, mid, anim, COLOR, effect, bar, title, tell, now, alive, isPlayer, nameOf } from "./core.js";
import { hurt, dmgHooks } from "./combat.js";
import { expand, registerDomain, collapse } from "./domains.js";
import { addCE, setCE, statusHooks } from "./energy.js";
import { maxCE } from "./grades.js";
import { projectile } from "./projectile.js";

const jackpot = new Map(); // caster id -> tick
export const inJackpot = (p) => (jackpot.get(p?.id) ?? 0) > now();
dmgHooks.push((caster) => (inJackpot(caster) ? 1.25 : 1));
statusHooks.push((p) => {
  const left = (jackpot.get(p.id) ?? 0) - now();
  return left > 0 ? `§a§lJACKPOT ${Math.ceil(left / 20)}s` : "";
});

function rough(p) {
  const t = aimed(p, 10);
  if (!t) {
    bar(p, "§7Look at someone.");
    return false;
  }
  anim(p, "point");
  hurt(p, t, 9);
  fx(t.dimension, "jjk:burst", mid(t), COLOR.green, 0.9);
  sound(t.dimension, "random.click", t.location, 1, 0.8);
  if (isPlayer(p) && Math.random() < 0.125) {
    addCE(p, 20);
    bar(p, "§a✦ Lucky! §f+20 CE", 20);
  }
  return true;
}

function shutter(p) {
  const t = aimed(p, 10);
  if (!t) {
    bar(p, "§7Look at someone.");
    return false;
  }
  anim(p, "clap");
  const at = mid(t);
  for (const dx of [-1.2, 1.2]) fx(t.dimension, "jjk:ring", V.add(at, { x: dx, y: 0, z: 0 }), COLOR.white, 0.9);
  hurt(p, t, 14);
  effect(t, "slowness", 40, 1);
  sound(t.dimension, "random.door_close", t.location, 1, 0.7);
  sound(t.dimension, "random.anvil_land", t.location, 0.4, 1.5);
  return true;
}

function pachinko(p) {
  anim(p, "point");
  const dim = p.dimension;
  const from = V.add(eye(p), V.mul(look(p), 1));
  const d = look(p);
  for (let i = 0; i < 8; i++) {
    const off = (i - 3.5) * 0.08;
    const dir = V.norm({ x: d.x + off * d.z + (Math.random() - 0.5) * 0.06, y: d.y + (Math.random() - 0.4) * 0.12, z: d.z - off * d.x });
    projectile(p, {
      from, dir, speed: 1.8, range: 18, radius: 1.0,
      trail: (pos) => fx(dim, "jjk:orb", pos, COLOR.white, 0.35),
      onHit: (at, x) => {
        if (x) hurt(p, x, 5);
        fx(dim, "jjk:spark", at, COLOR.white, 0.4);
      },
    });
  }
  sound(dim, "random.click", from, 1, 1.6);
  return true;
}

const REACH = ["Transit Card Reach", "Seat Struggle Reach", "Green Hold", "Hold On Reach", "Rough Energy Reach"];
export function hitJackpot(p) {
  jackpot.set(p.id, now() + 400);
  title(p, "§a§lJACKPOT!", "§f20 s: endless cursed energy, a body that heals itself", 50);
  fx(p.dimension, "jjk:burst", mid(p), COLOR.green, 2.4);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.gold, 1.2, { radius: 3 });
  sound(p.dimension, "random.levelup", p.location, 1, 1.2);
  sound(p.dimension, "random.totem", p.location, 0.6, 1.4);
  try {
    world.sendMessage(`§a✦ ${nameOf(p)} hit the JACKPOT!`);
  } catch {
    /* ignore */
  }
  // for the next 20 s: a full CE pool and Regeneration IV, refreshed every second
  task((age) => {
    if (!alive(p) || !inJackpot(p)) return false;
    if (age % 20 === 0) {
      if (isPlayer(p)) setCE(p, maxCE(p));
      effect(p, "regeneration", 30, 3);
      fx(p.dimension, "jjk:aura", p.location, COLOR.green, 1.2);
    }
    return true;
  }, 410);
}

registerDomain("jackpot", { name: "Idle Death Gamble", tech: "idle_death_gamble", radius: 12, ticks: 200, color: COLOR.green, dome: "jackpot" },
  (d, victims, every) => {
    if (every(10)) fx(d.dim, "jjk:spark", V.add(d.center, { x: (Math.random() - 0.5) * 16, y: 2 + Math.random() * 4, z: (Math.random() - 0.5) * 16 }), COLOR.gold, 0.8);
    if (!every(40) || inJackpot(d.caster)) return;
    if (Math.random() < 0.25) {
      hitJackpot(d.caster);
      d.noBurnout = true;
      collapse(d, "§a§lJACKPOT!");
    } else if (isPlayer(d.caster)) {
      tell(d.caster, `§7The reels spin... §f${REACH[Math.floor(Math.random() * REACH.length)]}§7 — no luck.`);
      sound(d.dim, "random.click", d.caster.location, 1, 0.6);
    }
  });

export const IDLE_DEATH_GAMBLE = {
  gamble_rough: { name: "Rough Energy", cost: 15, cd: 3, grade: 0, run: rough, info: "9 damage to who you look at (10 blocks); 1 in 8: +20 CE back." },
  gamble_shutter: { name: "Shutter Doors", cost: 25, cd: 8, grade: 0, run: shutter, info: "Two doors slam on who you look at: 14 damage and slowness." },
  gamble_pachinko: { name: "Pachinko Rush", cost: 40, cd: 18, grade: 2, run: pachinko, info: "Eight balls fly out: 5 damage each." },
  idle_death_gamble_domain: { name: "Domain Expansion: Idle Death Gamble", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "jackpot"),
    info: "Hurts no one. Every 2 s: 1 in 4 for a JACKPOT — 20 s of endless CE, fast healing and +25% damage, no burnout." },
};
export const _state = { jackpot };
