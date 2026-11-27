// Clans. Every sorcerer is born into a clan (or none) before their technique awakens, and the great clans' innate
// techniques are inherited by blood: nobody outside the clan can ever awaken them.
//
//   Clan      Born into  Clan techniques (chance)                                     Perk
//   Gojo         6%      Limitless 25%                                                +15% max cursed energy
//   Zen'in      20%      Ten Shadows 22%, Heavenly Restriction 30%, Projection 20%    +10% melee damage
//   Kamo        20%      Blood Manipulation 70%                                       +20% cursed energy regeneration
//   Inumaki     14%      Cursed Speech 70%                                            10% shorter cooldowns
//   Clanless    40%      —                                                            +15% XP (self-made)
//
// A clan member who doesn't inherit the clan technique — and every clanless sorcerer — awakens a technique of no clan
// (weights in OPEN): Boogie Woogie 28, Straw Doll 18, Ratio 18, Disaster Flames 11, Idle Death Gamble 9,
// Cursed Spirit Manipulation 7, Idle Transfiguration 5, Shrine 4 (Sukuna's own).
// The overall chance of each technique is worked out from these tables by techChance() — the Record shows it.
// A technique belongs to whoever awakened it: its moves refuse to work for anyone else.
//
// Cursed Spirits (players who chose the curse's path when they first joined, see paths.js) have no family: their
// origin is "cursed". They awaken a disaster (weights in CURSE_POOL): Disaster Flames 30, Disaster Plants 25,
// Disaster Tides 25, Idle Transfiguration 20. Disaster Plants and Disaster Tides belong to curses alone.

import { getProp, setProp } from "./core.js";

export const CLANS = {
  gojo: { name: "Gojo", c: "§b", weight: 6, techniques: { limitless: 25 }, perk: "+15% max cursed energy",
    blurb: "One of the three great families. Once in centuries, a child is born with Limitless — and the Six Eyes." },
  zenin: { name: "Zen'in", c: "§2", weight: 20, techniques: { ten_shadows: 22, heavenly: 30, projection: 20 }, perk: "+10% melee damage",
    blurb: "The great family of strength above all. The Ten Shadows is its treasure, Projection Sorcery its pride, Heavenly Restriction its curse." },
  kamo: { name: "Kamo", c: "§4", weight: 20, techniques: { blood: 70 }, perk: "+20% cursed energy regeneration",
    blurb: "The great family of tradition, whose blood itself is the technique." },
  inumaki: { name: "Inumaki", c: "§3", weight: 14, techniques: { cursed_speech: 70 }, perk: "10% shorter cooldowns",
    blurb: "A family whose words are curses, marked with the snake and fangs." },
  clanless: { name: "Clanless", c: "§7", weight: 40, techniques: {}, perk: "+15% XP (self-made)",
    blurb: "No great family behind you — everything you become, you earn yourself." },
  // (never rolled: only those who choose to be a curse; its own techniques are bound to it)
  cursed: { name: "Cursed Spirit", c: "§4", weight: 0, curse: true, techniques: { disaster_plants: 0, disaster_tides: 0 },
    perk: "your body heals itself while you have cursed energy",
    blurb: "No family at all: a curse, born from humanity's fear. You grow by devouring other curses — and Jujutsu High hunts you." },
};
// The disasters a Cursed Spirit can awaken, and their weights.
export const CURSE_POOL = { disaster_flames: 30, disaster_plants: 25, disaster_tides: 25, idle_transfiguration: 20 };
export const CURSE_TAG = "jjk_curse"; // (every curse player carries it: curse mobs leave them alone, Jujutsu High doesn't)
// Techniques of no clan, for the clanless and for clan members who don't inherit their clan's technique.
export const OPEN = {
  boogie: 28, straw_doll: 18, ratio: 18, disaster_flames: 11, idle_death_gamble: 9, cursed_spirit: 7, idle_transfiguration: 5, shrine: 4,
};
// The clan each clan-bound technique belongs to.
export const BOUND = {};
for (const [clan, c] of Object.entries(CLANS)) {
  c.id = clan;
  for (const t of Object.keys(c.techniques)) BOUND[t] = clan;
}

export const clanOf = (p) => getProp(p, "clan");
export const clanInfo = (p) => CLANS[clanOf(p)] ?? CLANS.clanless;
export const isCurse = (p) => clanOf(p) === "cursed";
export const canInherit = (clan, tech) => (clan === "cursed" ? tech in CURSE_POOL : !BOUND[tech] || BOUND[tech] === clan);
// A curse player carries CURSE_TAG (for the entity files' target filters); nobody else does.
export function syncPathTag(p) {
  try {
    if (isCurse(p)) p.addTag(CURSE_TAG);
    else p.removeTag(CURSE_TAG);
  } catch {
    /* ignore */
  }
}

function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

// The overall chance (in %) that a newborn sorcerer awakens this technique.
export function techChance(tech) {
  const born = Object.values(CLANS).reduce((s, c) => s + c.weight, 0);
  const open = Object.values(OPEN).reduce((s, w) => s + w, 0);
  let total = 0;
  for (const c of Object.values(CLANS)) {
    const own = Object.values(c.techniques).reduce((s, w) => s + w, 0);
    total += (c.weight / born) * ((c.techniques[tech] ?? 0) / 100 + ((100 - own) / 100) * ((OPEN[tech] ?? 0) / open));
  }
  return total * 100;
}
// The chance (in %) that a newborn curse awakens this disaster.
export function curseChance(tech) {
  const total = Object.values(CURSE_POOL).reduce((s, w) => s + w, 0);
  return ((CURSE_POOL[tech] ?? 0) / total) * 100;
}
export function rarityOf(tech) {
  if (BOUND[tech] === "cursed") return `§4Cursed Spirits only · ${Math.round(curseChance(tech))}%`;
  const pct = techChance(tech);
  const tier = pct < 4 ? "§6Special" : pct < 8 ? "§dRare" : pct < 15 ? "§bUncommon" : "§aCommon";
  return `${tier} · ${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export function rollClan() {
  return weighted(Object.entries(CLANS).map(([id, c]) => [id, c.weight]));
}

// A technique for someone of this clan (never `except`, for rerolls). A curse awakens a disaster.
export function rollTechnique(clan, except) {
  if (clan === "cursed") return weighted(Object.entries(CURSE_POOL).filter(([t]) => t !== except));
  const own = CLANS[clan]?.techniques ?? {};
  let r = Math.random() * 100;
  for (const [t, pct] of Object.entries(own)) {
    if (t === except) continue;
    r -= pct;
    if (r < 0) return t;
  }
  return weighted(Object.entries(OPEN).filter(([t]) => t !== except));
}

// Players from before clans existed: the clan their technique came from (or none).
export function ensureClan(p) {
  if (clanOf(p) && CLANS[clanOf(p)]) return clanOf(p);
  const tech = getProp(p, "technique");
  const clan = tech ? BOUND[tech] ?? "clanless" : rollClan();
  setProp(p, "clan", clan);
  return clan;
}

// Perks (read by grades.js, combat.js and techniques.js)
export const clanMaxCE = (p) => (clanOf(p) === "gojo" ? 1.15 : 1);
export const clanRegen = (p) => (clanOf(p) === "kamo" ? 1.2 : 1);
export const clanMelee = (p) => (clanOf(p) === "zenin" ? 1.1 : 1);
export const clanCooldown = (p) => (clanOf(p) === "inumaki" ? 0.9 : 1);
export const clanXp = (p) => (clanOf(p) === "clanless" ? 1.15 : 1);
