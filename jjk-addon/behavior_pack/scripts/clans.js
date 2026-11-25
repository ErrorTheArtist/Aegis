// Clans. Every sorcerer is born into a clan (or none) before their technique awakens, and the great clans' innate
// techniques are inherited by blood: nobody outside the clan can ever awaken them.
//
//   Clan      Born into  Clan techniques (chance)                  Perk
//   Gojo         6%      Limitless 25%                             +15% max cursed energy
//   Zen'in      20%      Ten Shadows 25%, Heavenly Restriction 35% +10% melee damage
//   Kamo        20%      Blood Manipulation 70%                    +20% cursed energy regeneration
//   Inumaki     14%      Cursed Speech 70%                         10% shorter cooldowns
//   Clanless    40%      —                                         +15% XP (self-made)
//
// A clan member who doesn't inherit the clan technique — and every clanless sorcerer — awakens a technique of no clan:
// Boogie Woogie 35, Straw Doll 30, Ratio 30, Shrine 5 (Sukuna's own, the rarest of all).
// Overall: Limitless 1.5% · Shrine 3% · Ten Shadows 5% · Heavenly Restriction 7% · Cursed Speech 10% · Blood 14% ·
// Straw Doll and Ratio 19% each · Boogie Woogie 22%.
// A technique belongs to whoever awakened it: its moves refuse to work for anyone else.

import { getProp, setProp } from "./core.js";

export const CLANS = {
  gojo: { name: "Gojo", c: "§b", weight: 6, techniques: { limitless: 25 }, perk: "+15% max cursed energy",
    blurb: "One of the three great families. Once in centuries, a child is born with Limitless — and the Six Eyes." },
  zenin: { name: "Zen'in", c: "§2", weight: 20, techniques: { ten_shadows: 25, heavenly: 35 }, perk: "+10% melee damage",
    blurb: "The great family of strength above all. The Ten Shadows is its treasure; Heavenly Restriction its curse." },
  kamo: { name: "Kamo", c: "§4", weight: 20, techniques: { blood: 70 }, perk: "+20% cursed energy regeneration",
    blurb: "The great family of tradition, whose blood itself is the technique." },
  inumaki: { name: "Inumaki", c: "§3", weight: 14, techniques: { cursed_speech: 70 }, perk: "10% shorter cooldowns",
    blurb: "A family whose words are curses, marked with the snake and fangs." },
  clanless: { name: "Clanless", c: "§7", weight: 40, techniques: {}, perk: "+15% XP (self-made)",
    blurb: "No great family behind you — everything you become, you earn yourself." },
};
// Techniques of no clan, for the clanless and for clan members who don't inherit their clan's technique.
export const OPEN = { boogie: 35, straw_doll: 30, ratio: 30, shrine: 5 };
// The clan each clan-bound technique belongs to.
export const BOUND = {};
for (const [clan, c] of Object.entries(CLANS)) {
  c.id = clan;
  for (const t of Object.keys(c.techniques)) BOUND[t] = clan;
}

export const clanOf = (p) => getProp(p, "clan");
export const clanInfo = (p) => CLANS[clanOf(p)] ?? CLANS.clanless;
export const canInherit = (clan, tech) => !BOUND[tech] || BOUND[tech] === clan;

function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

export function rollClan() {
  return weighted(Object.entries(CLANS).map(([id, c]) => [id, c.weight]));
}

// A technique for someone of this clan (never `except`, for rerolls).
export function rollTechnique(clan, except) {
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
