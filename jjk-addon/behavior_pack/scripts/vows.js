// Binding Vows: a promise you make to yourself — give something up, get something back. You keep one vow at a time
// (Jujutsu Record -> Binding Vows) and can change or break it once every 10 minutes. Ratio's Overtime is a vow of its
// own and stacks with these.
//
//   Glass Cannon        +25% technique damage          techniques hit you 20% harder
//   Revealed Technique  +20% technique damage          every move you use is explained aloud to everyone near you
//   Swift Hands         30% shorter cooldowns          moves cost 30% more cursed energy
//   Frugal              moves cost 30% less CE         cooldowns are 30% longer
//   Blood Price         +35% technique damage          every move also costs you 3 health
//   Chase the Spark     double Black Flash chance      techniques hit 15% softer
//   Brawler             +30% melee damage              techniques hit 20% softer
//   Deep Reserves       +50% cursed energy regen       techniques hit 10% softer
//
// The numbers are read where they apply: combat.js (damage, Black Flash, melee), grades.js (regeneration) and
// techniques.js (cost, cooldown, health, the explanation).

import { getProp, setProp, isPlayer } from "./core.js";

export const VOWS = {
  glass: { name: "Glass Cannon", c: "§c", gain: "+25% technique damage", cost: "techniques hit you 20% harder", dmg: 1.25, taken: 1.2 },
  reveal: { name: "Revealed Technique", c: "§e", gain: "+20% technique damage", cost: "every move is explained aloud to everyone near you",
    dmg: 1.2, reveal: true },
  swift: { name: "Swift Hands", c: "§b", gain: "30% shorter cooldowns", cost: "moves cost 30% more cursed energy", cd: 0.7, ce: 1.3 },
  frugal: { name: "Frugal", c: "§a", gain: "moves cost 30% less cursed energy", cost: "cooldowns are 30% longer", cd: 1.3, ce: 0.7 },
  blood: { name: "Blood Price", c: "§4", gain: "+35% technique damage", cost: "every move also costs you 3 health", dmg: 1.35, hp: 3 },
  spark: { name: "Chase the Spark", c: "§5", gain: "double Black Flash chance", cost: "techniques hit 15% softer", bf: 2, dmg: 0.85 },
  brawler: { name: "Brawler", c: "§6", gain: "+30% melee damage", cost: "techniques hit 20% softer", melee: 1.3, dmg: 0.8 },
  reserves: { name: "Deep Reserves", c: "§9", gain: "+50% cursed energy regeneration", cost: "techniques hit 10% softer", regen: 1.5, dmg: 0.9 },
};
export const VOW_COOLDOWN = 600000; // ms between changes

export const vowOf = (p) => (isPlayer(p) && VOWS[getProp(p, "vow")] ? getProp(p, "vow") : undefined);
export const vowInfo = (p) => VOWS[vowOf(p)];
// The vow's multiplier for one stat ("dmg", "taken", "cd", "ce", "bf", "melee", "regen"), 1 without a vow.
export const vowMult = (p, key) => vowInfo(p)?.[key] ?? 1;
export const vowReadyIn = (p) => Math.max(0, getProp(p, "vow_at", 0) + VOW_COOLDOWN - Date.now());

// Make (id), or break (undefined), a vow. Returns "ok", "wait" (changed too recently), "same" or "unknown".
export function setVow(p, id) {
  if (id !== undefined && !VOWS[id]) return "unknown";
  if (id === vowOf(p)) return "same";
  if (vowReadyIn(p) > 0) return "wait";
  setProp(p, "vow", id);
  setProp(p, "vow_at", Date.now());
  return "ok";
}
