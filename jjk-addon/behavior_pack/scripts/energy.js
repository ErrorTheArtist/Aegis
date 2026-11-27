// Cursed energy (CE): the fuel for every technique. It regenerates every second — twice as fast while you sneak and
// stand still (focusing) — and is shown on the action bar together with your health and grade:
//   ❤ 18/20 | CE ||||||||||||| 120/200 | Grade 2 | ∞ INFINITY
// The bar steps aside for a moment whenever an ability shows a message there. Players can hide it in the Record.
// Heavenly Restriction has no cursed energy at all.

import { world, system } from "@minecraft/server";
import { getProp, setProp, now, barQuietUntil, health, alive } from "./core.js";
import { maxCE, regenCE, gradeOf, gradeLabel } from "./grades.js";
import { inCinematic } from "./cinematic.js";

const pool = new Map(); // player id -> cursed energy (saved every few seconds)
const still = new Map(); // player id -> last location (focusing check)
export const statusHooks = []; // (player) => short text for the bar, or ""

export const isHeavenly = (p) => getProp(p, "technique") === "heavenly";
export function getCE(p) {
  if (!pool.has(p.id)) pool.set(p.id, Math.min(maxCE(p), getProp(p, "ce", maxCE(p))));
  return pool.get(p.id);
}
export function setCE(p, v) {
  pool.set(p.id, Math.max(0, Math.min(maxCE(p), v)));
}
export function addCE(p, n) {
  setCE(p, getCE(p) + n);
}
export function spendCE(p, n) {
  const c = getCE(p);
  if (c + 1e-6 < n) return false;
  setCE(p, c - n);
  return true;
}
function save(p) {
  setProp(p, "ce", Math.round(getCE(p) * 10) / 10);
}

function ceBar(cur, max) {
  const n = 20;
  const full = Math.round((cur / max) * n);
  return `§bCE ${"|".repeat(full)}§8${"|".repeat(n - full)} §f${Math.floor(cur)}§7/${max}`;
}

export function hudLine(p) {
  const h = health(p);
  const parts = [`§c❤ ${Math.ceil(h?.currentValue ?? 0)}/${Math.round(h?.effectiveMax ?? 20)}`];
  parts.push(isHeavenly(p) ? "§eHeavenly Restriction" : ceBar(getCE(p), maxCE(p)));
  parts.push(gradeLabel(p));
  for (const f of statusHooks) {
    try {
      const s = f(p);
      if (s) parts.push(s);
    } catch {
      /* ignore */
    }
  }
  return parts.join(" §8| ");
}

function focusing(p) {
  const l = p.location;
  const last = still.get(p.id);
  still.set(p.id, { x: l.x, y: l.y, z: l.z });
  return !!p.isSneaking && !!last && Math.hypot(l.x - last.x, l.z - last.z) < 0.15;
}

export function initEnergy() {
  // regeneration (1 s)
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (!alive(p) || isHeavenly(p) || !getProp(p, "technique")) continue;
      addCE(p, regenCE(p) * (focusing(p) ? 2 : 1));
    }
  }, 20);
  // the bar (twice a second)
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (!getProp(p, "technique") || getProp(p, "hud_off", false) || now() < barQuietUntil(p) || inCinematic(p)) continue;
      try {
        p.onScreenDisplay.setActionBar(hudLine(p));
      } catch {
        /* ignore */
      }
    }
  }, 10);
  // save (5 s)
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) save(p);
  }, 100);
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => {
    pool.delete(playerId);
    still.delete(playerId);
  });
}
