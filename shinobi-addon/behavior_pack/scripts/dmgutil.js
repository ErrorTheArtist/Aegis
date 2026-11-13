// Bonus damage, heal-back and drain helpers (the M1 combos, Tailed Beast Mode, the jutsu).
//
// Scripted hits (every jutsu, taijutsu and sword art goes through main.js hurt()) are marked with markScripted() so
// listeners that only care about real melee swings — the M1 combo, Chakra Scalpel, Lightning Armour — can tell a jutsu
// hit from a punch with scriptedHit(). Otherwise a Rasengan landing would also count as a jab.
//
// Bedrock only applies the part of a hit that exceeds the last one while an entity's hurt cooldown is running, so a
// bonus on top of a hit that just landed is applied as one bigger hit (base + bonus). That re-applied hit raises its
// own (deferred) hurt event: boostHit() remembers it so every handler can recognise that echo (same target, a few
// ticks later, the bonus amount) and ignore it instead of treating it as a new attack.

import { system } from "@minecraft/server";

const echoes = new Map(); // entity id -> { tick, bonus, total } of the last boosted hit
const scripted = new Map(); // entity id -> { tick, by, cause, kind } of the last scripted hit

export function markScripted(target, attacker, cause, kind) {
  if (target?.id) scripted.set(target.id, { tick: system.currentTick, by: attacker?.id, cause, kind });
}

// The scripted hit behind this hurt event (same target, attacker and cause, a tick or two ago), or undefined if it was
// a real swing. Its `kind` says what it was ("fist" for taijutsu, "tech" for ninjutsu …).
export function scriptedHit(entity, damageSource) {
  const s = scripted.get(entity?.id);
  if (!s || system.currentTick - s.tick > 2) return undefined;
  if (s.cause !== damageSource?.cause || s.by !== damageSource?.damagingEntity?.id) return undefined;
  return s;
}

export function boostHit(target, base, total, attacker, cause = "entityAttack") {
  if (!(total > base + 0.01)) return false;
  echoes.set(target.id, { tick: system.currentTick, bonus: total - base, total });
  try {
    target.applyDamage(total, attacker ? { cause, damagingEntity: attacker } : { cause });
    return true;
  } catch {
    echoes.delete(target.id);
    return false;
  }
}

// True if this hurt event is the echo of a boostHit on this entity (it reports either the bonus or the full total).
export function isEcho(entity, damage) {
  const e = echoes.get(entity?.id);
  if (!e || system.currentTick - e.tick > 3) return false;
  return Math.abs(damage - e.bonus) < 0.6 || Math.abs(damage - e.total) < 0.6;
}

// Give back part of a hit (the entity must still be alive).
export function healBack(entity, amount) {
  if (!(amount > 0)) return;
  try {
    const h = entity.getComponent("minecraft:health");
    if (!h || h.currentValue <= 0) return;
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
  } catch {
    /* ignore */
  }
}

// Take extra health directly (never the killing blow: it stops at half a heart).
export function drain(entity, amount) {
  if (!(amount > 0)) return;
  try {
    const h = entity.getComponent("minecraft:health");
    if (!h || h.currentValue <= 0) return;
    h.setCurrentValue(Math.max(Math.min(1, h.currentValue), h.currentValue - amount));
  } catch {
    /* ignore */
  }
}

system.runInterval(() => {
  const now = system.currentTick;
  for (const [id, e] of echoes) if (now - e.tick > 20) echoes.delete(id);
  for (const [id, e] of scripted) if (now - e.tick > 20) scripted.delete(id);
}, 200);
