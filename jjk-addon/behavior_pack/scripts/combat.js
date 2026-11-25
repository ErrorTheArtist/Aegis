// Damage and the fighting rules every technique shares.
//
//  hurt()        — every technique hit goes through here: grade multiplier, PvP scaling, the boss hit cap, and a mark
//                  so the melee listener can tell a technique from a punch.
//  Black Flash   — a melee hit has a small chance (4%, +1% a grade) to land within a millionth of a second of the
//                  cursed energy: ×2.5 damage, black lightning, 30% of your cursed energy back, and 30 s "in the zone"
//                  (+10% chance). Heavenly Restriction has no cursed energy, so no Black Flash.
//  Infinity      — Limitless users take 40% less damage while they have 10+ CE (2 CE a hit). A domain's sure-hit and
//                  the Inverted Spear of Heaven switch it off.
//  Stuns         — "Don't Move" and the Unlimited Void: frozen in place, no techniques.
//
// Bedrock only applies the part of a hit that exceeds the last one while an entity's hurt cooldown is running, so a
// bonus on top of a hit that just landed is applied as one bigger hit (base + bonus) — boostHit(); its own hurt event
// is recognised (isEcho) and ignored.

import { world, system } from "@minecraft/server";
import {
  getProp, bump, now, isPlayer, alive, health, canHit, fx, sound, effect, clearEffect, mid, title, COLOR,
} from "./core.js";
import { gradeOf, dmgMult, maxCE, addXp, fingersOf } from "./grades.js";
import { getCE, setCE, addCE, isHeavenly, statusHooks } from "./energy.js";
import { clanMelee } from "./clans.js";
import { vowMult } from "./vows.js";

export const PVP_SCALE = 0.6; // technique damage against players (fights last longer than one Hollow Purple)
export const BOSS_CAP = 0.06; // no single hit takes more than 6% of a Special Grade curse's health
export const BF_MULT = 2.5;
const BOSSES = new Set(["jjk:finger_bearer", "jjk:mahoraga"]);

const scripted = new Map(); // target id -> tick of the last technique hit
const echoes = new Map(); // target id -> { tick, bonus, total }
const zone = new Map(); // player id -> tick until which they're "in the zone"
const stunUntil = new Map(); // entity id -> tick
const infinityOff = new Map(); // player id -> tick until which Infinity is switched off
const infinityOn = new Set(); // players whose Resistance currently comes from Infinity
const taken = new Map(); // player id -> [{ tick, dmg }] hits taken lately (Dragon-Bone stores them)
export const dmgHooks = []; // (caster, target) => multiplier (domains: +50% inside your Unlimited Void)
export const hitHooks = []; // (caster, target) => after any technique or melee hit lands (Straw Doll remembers who you hurt)
export const dmgCaps = []; // (caster, target, damage) => damage (a sparring partner never takes you below 1 health)
export const infinityBlockers = []; // (player) => true when Infinity can't run (burnout)
export const lastHit = new Map(); // target id -> { tick, caster, how: "technique" | "sure" | "melee" } (Mahoraga adapts by kind)

export function capBoss(target, amount) {
  if (!BOSSES.has(target?.typeId)) return amount;
  const max = health(target)?.effectiveMax ?? 0;
  return max > 0 ? Math.min(amount, max * BOSS_CAP) : amount;
}

// A technique hit. opts.flat skips the grade multiplier (curse attacks, set damage); opts.sure is a domain's sure-hit
// (ignores Infinity); opts.pierce also ignores it (Inverted Spear).
export function hurt(caster, target, base, opts = {}) {
  if (!canHit(caster, target)) return false;
  let dmg = base * (opts.flat || !isPlayer(caster) ? 1 : dmgMult(caster));
  for (const f of dmgHooks) {
    try {
      dmg *= f(caster, target) ?? 1;
    } catch {
      /* ignore */
    }
  }
  dmg *= vowMult(caster, "dmg") * vowMult(target, "taken"); // Binding Vows
  if (isPlayer(target) && isPlayer(caster)) dmg *= PVP_SCALE;
  if (opts.sure || opts.pierce) suppressInfinity(target, opts.pierce ? 120 : 25);
  dmg = capBoss(target, dmg);
  for (const f of dmgCaps) {
    try {
      dmg = f(caster, target, dmg) ?? dmg;
    } catch {
      /* ignore */
    }
  }
  if (!(dmg > 0)) return false;
  scripted.set(target.id, now());
  lastHit.set(target.id, { tick: now(), caster, how: opts.sure ? "sure" : "technique" });
  try {
    target.applyDamage(Math.max(0.5, dmg), { cause: "entityAttack", damagingEntity: caster });
  } catch {
    return false;
  }
  hit(caster, target);
  return true;
}
function hit(caster, target) {
  for (const f of hitHooks) {
    try {
      f(caster, target);
    } catch {
      /* ignore */
    }
  }
}
export const wasScripted = (e) => now() - (scripted.get(e?.id) ?? -99) <= 2;

export function boostHit(target, base, total, attacker) {
  if (!(total > base + 0.01)) return false;
  echoes.set(target.id, { tick: now(), bonus: total - base, total });
  scripted.set(target.id, now());
  try {
    target.applyDamage(total, { cause: "entityAttack", damagingEntity: attacker });
    return true;
  } catch {
    echoes.delete(target.id);
    return false;
  }
}
export function isEcho(e, damage) {
  const x = echoes.get(e?.id);
  if (!x || now() - x.tick > 3) return false;
  return Math.abs(damage - x.bonus) < 0.6 || Math.abs(damage - x.total) < 0.6;
}

// Damage this player has taken in the last `ticks` ticks (and forget it when `clear`).
export function recentDamage(p, ticks = 200, clear = false) {
  const list = (taken.get(p.id) ?? []).filter((h) => now() - h.tick <= ticks);
  if (clear) taken.delete(p.id);
  else taken.set(p.id, list);
  return list.reduce((s, h) => s + h.dmg, 0);
}

// ---------------------------------------------------------------------------
// Stuns
// ---------------------------------------------------------------------------
export function stun(e, ticks) {
  stunUntil.set(e.id, Math.max(stunUntil.get(e.id) ?? 0, now() + ticks));
  effect(e, "slowness", ticks, 255);
  effect(e, "weakness", ticks, 255);
  effect(e, "mining_fatigue", ticks, 4);
  if (!isPlayer(e)) effect(e, "jump_boost", ticks, 250); // mobs: no hopping out of it
}
export const stunned = (e) => (stunUntil.get(e?.id) ?? 0) > now();

// ---------------------------------------------------------------------------
// Black Flash
// ---------------------------------------------------------------------------
export const inZone = (p) => (zone.get(p.id) ?? 0) > now();
export function bfChance(p) {
  return (0.04 + gradeOf(p) * 0.01 + (inZone(p) ? 0.1 : 0)) * vowMult(p, "bf");
}
export function blackFlashFx(p, target) {
  const at = mid(target);
  const dim = target.dimension;
  fx(dim, "jjk:bolt", at, COLOR.black, 1.3);
  fx(dim, "jjk:bolt", at, COLOR.black, 0.9);
  fx(dim, "jjk:spark", at, COLOR.red, 1.6);
  fx(dim, "jjk:ring", target.location, COLOR.red, 1.2);
  sound(dim, "ambient.weather.thunder", at, 0.5, 1.7);
  sound(dim, "random.explode", at, 0.45, 1.6);
}
// Everything that happens to the sorcerer who lands one.
export function blackFlashed(p, target) {
  blackFlashFx(p, target);
  addCE(p, maxCE(p) * 0.3);
  zone.set(p.id, now() + 600);
  bump(p, "black_flashes");
  title(p, "§4§lBLACK FLASH", "§7In the zone: +10% Black Flash chance for 30s", 20);
  addXp(p, 15);
}

function meleeMult(p) {
  return (1 + gradeOf(p) * (isHeavenly(p) ? 0.1 : 0.08) + fingersOf(p) * 0.01) * clanMelee(p) * vowMult(p, "melee");
}

function onMelee(p, target, damage) {
  if (!getProp(p, "technique")) return;
  let total = damage * meleeMult(p);
  for (const f of dmgHooks) {
    try {
      total *= f(p, target) ?? 1;
    } catch {
      /* ignore */
    }
  }
  const bf = !isHeavenly(p) && Math.random() < bfChance(p);
  if (bf) total *= BF_MULT;
  total = capBoss(target, total);
  lastHit.set(target.id, { tick: now(), caster: p, how: "melee" });
  if (total > damage + 0.05) boostHit(target, damage, total, p);
  if (bf) blackFlashed(p, target);
  hit(p, target);
}

// ---------------------------------------------------------------------------
// Infinity
// ---------------------------------------------------------------------------
export function suppressInfinity(e, ticks) {
  infinityOff.set(e.id, Math.max(infinityOff.get(e.id) ?? 0, now() + ticks));
  if (infinityOn.has(e.id)) {
    clearEffect(e, "resistance");
    infinityOn.delete(e.id);
  }
}
export function infinityActive(p) {
  if (getProp(p, "technique") !== "limitless" || getProp(p, "infinity_off", false)) return false;
  if ((infinityOff.get(p.id) ?? 0) > now() || getCE(p) < 10) return false;
  for (const f of infinityBlockers) {
    try {
      if (f(p)) return false;
    } catch {
      /* ignore */
    }
  }
  return true;
}
function infinityTick(p) {
  if (infinityActive(p)) {
    effect(p, "resistance", 30, 1);
    infinityOn.add(p.id);
  } else if (infinityOn.has(p.id)) {
    clearEffect(p, "resistance");
    infinityOn.delete(p.id);
  }
}

export function initCombat() {
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
    try {
      if (isPlayer(hurtEntity) && damage > 0) {
        const list = taken.get(hurtEntity.id) ?? [];
        list.push({ tick: now(), dmg: damage });
        if (list.length > 40) list.shift();
        taken.set(hurtEntity.id, list);
      }
      // Infinity costs cursed energy for every blow it turns
      if (isPlayer(hurtEntity) && infinityOn.has(hurtEntity.id) && damageSource?.damagingEntity) {
        setCE(hurtEntity, getCE(hurtEntity) - 2);
        fx(hurtEntity.dimension, "jjk:ring", mid(hurtEntity), COLOR.blue, 0.4);
      }
      const atk = damageSource?.damagingEntity;
      if (!isPlayer(atk) || damageSource.cause !== "entityAttack") return;
      if (wasScripted(hurtEntity) || isEcho(hurtEntity, damage) || !alive(atk)) return;
      onMelee(atk, hurtEntity, damage);
    } catch {
      /* ignore */
    }
  });
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        infinityTick(p);
      } catch {
        /* ignore */
      }
    }
  }, 10);
  statusHooks.push((p) => (infinityOn.has(p.id) ? "§b∞" : ""));
  statusHooks.push((p) => (inZone(p) ? "§4ZONE" : ""));
  statusHooks.push((p) => (stunned(p) ? "§cSTUNNED" : ""));
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => {
    zone.delete(playerId);
    infinityOff.delete(playerId);
    infinityOn.delete(playerId);
    stunUntil.delete(playerId);
    taken.delete(playerId);
  });
  // (forget old hits now and then)
  system.runInterval(() => {
    for (const [id, h] of lastHit) if (now() - h.tick > 40) lastHit.delete(id);
  }, 200);
}
// (exported for tests and the Record)
export const _state = { scripted, echoes, zone, stunUntil, infinityOff, infinityOn, lastHit };
