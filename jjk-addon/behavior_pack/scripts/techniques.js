// Innate techniques: who gets what, the move items, and what happens when you right-click one.
//
// Every player awakens a random innate technique on their first join (rarer ones are rarer):
//   Limitless 2% · Shrine 2% · Ten Shadows 8% · Cursed Speech 14% · Heavenly Restriction 20% · Blood Manipulation 26%
//   · Boogie Woogie 28%
// Each technique has four moves: two from the start, the third at Grade 2 and its domain (or Maximum) at Grade 1.
// Everyone (but Heavenly Restriction) also learns Simple Domain at Grade 2 and Reverse Cursed Technique at
// Semi-Grade 1. Move items are locked in your inventory and kept when you die; new ones appear as you're promoted.
// A Cursed Womb rerolls your technique (always into a different one).

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import {
  getProp, setProp, bump, bar, tell, title, sound, fx, mid, anim, COLOR, health, alive, effect, gameMode,
} from "./core.js";
import { gradeOf, GRADES, G, addFinger, fingersOf, MAX_FINGERS, onPromote, applyStats, maxCE } from "./grades.js";
import { getCE, spendCE, isHeavenly } from "./energy.js";
import { stunned } from "./combat.js";
import { burnedOut, startSimpleDomain, DOMAIN_COST } from "./domains.js";
import { LIMITLESS } from "./tech_limitless.js";
import { SHRINE } from "./tech_shrine.js";
import { TEN_SHADOWS } from "./tech_shadows.js";
import { CURSED_SPEECH } from "./tech_speech.js";
import { BLOOD } from "./tech_blood.js";
import { BOOGIE } from "./tech_boogie.js";
import { HEAVENLY } from "./tech_heavenly.js";

export const TECHNIQUES = {
  limitless: { name: "Limitless", c: "§b", weight: 2, rarity: "§6Special", moves: LIMITLESS,
    blurb: "Infinity itself. Blue pulls, Red repels, Hollow Purple erases — and while you have cursed energy, Infinity turns aside 40% of every blow." },
  shrine: { name: "Shrine", c: "§c", weight: 2, rarity: "§6Special", moves: SHRINE,
    blurb: "The King of Curses' slashes. Dismantle cuts everything in a line, Cleave adapts to toughness, and Fuga opens into fire." },
  ten_shadows: { name: "Ten Shadows", c: "§5", weight: 8, rarity: "§dRare", moves: TEN_SHADOWS,
    blurb: "Shikigami from your shadow: the Divine Dogs, Nue and Max Elephant fight for you." },
  cursed_speech: { name: "Cursed Speech", c: "§3", weight: 14, rarity: "§bUncommon", moves: CURSED_SPEECH,
    blurb: "Your words are commands — Don't Move, Blast Away, Crush. Every word costs your throat a little health." },
  heavenly: { name: "Heavenly Restriction", c: "§e", weight: 20, rarity: "§aCommon", moves: HEAVENLY,
    blurb: "No cursed energy at all — instead a monstrous body, cursed tools, and immunity to every domain's sure-hit." },
  blood: { name: "Blood Manipulation", c: "§4", weight: 26, rarity: "§aCommon", moves: BLOOD,
    blurb: "Your blood is a weapon: Piercing Blood, Supernova, and buffs that push your body past its limits." },
  boogie: { name: "Boogie Woogie", c: "§6", weight: 28, rarity: "§aCommon", moves: BOOGIE,
    blurb: "Clap and swap places with anyone you see. Simple, and terrifying in the right hands." },
};

const universal = {
  simple_domain: { name: "Simple Domain", cost: 25, cd: 25, grade: G.TWO, universal: true, run: (p) => (startSimpleDomain(p), true),
    info: "8 s: no domain's sure-hit can touch you (you move slowly)." },
  reverse_cursed_technique: { name: "Reverse Cursed Technique", cost: 50, cd: 20, grade: G.SEMI_ONE, universal: true, run: rct,
    info: "Heal half your health; clears poison and wither." },
};
function rct(p) {
  const h = health(p);
  if (!h) return false;
  if (h.currentValue >= h.effectiveMax - 0.5) {
    bar(p, "§7You aren't hurt.");
    return false;
  }
  h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + h.effectiveMax * 0.5));
  for (const e of ["poison", "wither", "fatal_poison"]) {
    try {
      p.removeEffect(e);
    } catch {
      /* ignore */
    }
  }
  anim(p, "heal");
  fx(p.dimension, "jjk:aura", p.location, COLOR.green, 2);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.green, 0.8, { radius: 1.5 });
  sound(p.dimension, "random.orb", p.location, 1, 0.5);
  return true;
}

// item id -> move (with its technique)
export const MOVES = {};
for (const [tech, t] of Object.entries(TECHNIQUES)) for (const [id, m] of Object.entries(t.moves)) MOVES[id] = { ...m, tech };
for (const [id, m] of Object.entries(universal)) MOVES[id] = { ...m, tech: null };
export const UNIVERSAL = universal;

export const techniqueOf = (p) => getProp(p, "technique");
export const moveCost = (p, m) => (m.cost === "domain" ? Math.round(maxCE(p) * DOMAIN_COST) : m.cost);

// The move items this player should be holding right now.
export function itemsFor(p) {
  const tech = TECHNIQUES[techniqueOf(p)];
  if (!tech) return [];
  const g = gradeOf(p);
  const ids = Object.entries(tech.moves).filter(([, m]) => g >= m.grade).map(([id]) => id);
  if (!isHeavenly(p)) for (const [id, m] of Object.entries(universal)) if (g >= m.grade) ids.push(id);
  return ids;
}

function lockedStack(id) {
  const s = new ItemStack(`jjk:${id}`, 1);
  try {
    s.lockMode = ItemLockMode.inventory;
    s.keepOnDeath = true;
  } catch {
    /* ignore */
  }
  return s;
}

// Gives missing move items (and the Record); removes move items that aren't yours (after a reroll).
export function syncItems(p) {
  if (!alive(p) || !techniqueOf(p)) return [];
  let inv;
  try {
    inv = p.getComponent("minecraft:inventory")?.container;
  } catch {
    return [];
  }
  if (!inv) return [];
  const want = new Set([...itemsFor(p), "jujutsu_record"]);
  const have = new Set();
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!it?.typeId?.startsWith("jjk:")) continue;
    const id = it.typeId.slice(4);
    if (!(id in MOVES) && id !== "jujutsu_record") continue;
    if (!want.has(id) || have.has(id)) inv.setItem(i, undefined); // not yours, or a duplicate
    else have.add(id);
  }
  const added = [];
  for (const id of want) {
    if (have.has(id)) continue;
    try {
      const left = inv.addItem(lockedStack(id));
      if (left) {
        bar(p, "§eMake room in your inventory — a new move is waiting.", 60);
        continue;
      }
      added.push(id);
    } catch {
      /* ignore */
    }
  }
  return added;
}

export function pickTechnique(except) {
  const pool = Object.entries(TECHNIQUES).filter(([id]) => id !== except);
  const total = pool.reduce((s, [, t]) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const [id, t] of pool) {
    r -= t.weight;
    if (r < 0) return id;
  }
  return pool[pool.length - 1][0];
}

export function setTechnique(p, id, why = "awaken") {
  const t = TECHNIQUES[id];
  if (!t) return false;
  setProp(p, "technique", id);
  if (id === "heavenly") {
    try {
      p.removeEffect("resistance");
    } catch {
      /* ignore */
    }
  }
  syncItems(p);
  title(p, `${t.c}§l${t.name.toUpperCase()}`, why === "reroll" ? "§7Your innate technique has changed" : "§7Your innate technique has awakened", 60);
  tell(p, `§5✦ §fInnate technique: ${t.c}${t.name} §8(${t.rarity}§8)\n§7${t.blurb}\n§7Your moves are in your inventory — §fright-click§7 to use them. Open the §dJujutsu Record§7 for everything else.`);
  sound(p.dimension, "beacon.activate", p.location, 1, 1.2);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.purple, 1, { radius: 2 });
  if (t.weight <= 2) {
    try {
      world.sendMessage(`§6✦ §f${p.name} §7was born with ${t.c}${t.name}§7!`);
    } catch {
      /* ignore */
    }
  }
  return true;
}

export function awaken(p) {
  if (techniqueOf(p)) return false;
  return setTechnique(p, pickTechnique());
}

// ---------------------------------------------------------------------------
// Using a move
// ---------------------------------------------------------------------------
const cooldowns = new Map(); // player id -> { item id: Date.now() when ready }
const nagged = new Map(); // player id -> tick of the last "recharging" message
export const cooldownLeft = (p, id) => Math.max(0, ((cooldowns.get(p.id) ?? {})[id] ?? 0) - Date.now()) / 1000;
export function resetCooldowns(p) {
  cooldowns.delete(p.id);
}
function startCooldown(p, id, secs) {
  const c = cooldowns.get(p.id) ?? {};
  c[id] = Date.now() + secs * 1000;
  cooldowns.set(p.id, c);
  try {
    p.startItemCooldown?.(`jjk_${id}`, Math.round(secs * 20));
  } catch {
    /* ignore */
  }
}
function nag(p, text) {
  const last = nagged.get(p.id) ?? -99;
  if (system.currentTick - last < 10) return;
  nagged.set(p.id, system.currentTick);
  bar(p, text, 30);
}

export function useMove(p, id) {
  const m = MOVES[id];
  if (!m) return false;
  const tech = techniqueOf(p);
  if (m.tech && m.tech !== tech) return nag(p, "§cThat isn't your technique."), false;
  if (!m.tech && isHeavenly(p)) return nag(p, "§eHeavenly Restriction: you have no cursed energy to use that."), false;
  if (gradeOf(p) < m.grade) return nag(p, `§7${m.name} unlocks at ${GRADES[m.grade].c}${GRADES[m.grade].name}§7.`), false;
  if (stunned(p)) return nag(p, "§cYou can't move!"), false;
  if (m.tech && m.tech !== "heavenly" && burnedOut(p)) return nag(p, `§cBurnout: your technique is spent for ${Math.ceil(burnedOut(p) / 20)}s more.`), false;
  const left = cooldownLeft(p, id);
  if (left > 0) return nag(p, `§7${m.name} §8— ready in §f${left.toFixed(1)}s`), false;
  const cost = moveCost(p, m);
  if (getCE(p) + 1e-6 < cost) return nag(p, `§9Not enough cursed energy §7(${Math.floor(getCE(p))}/${cost})`), false;
  const h = health(p);
  if (m.hp && h && h.currentValue <= m.hp + 1) return nag(p, "§cYour throat can't take another word right now."), false;
  let ok = false;
  try {
    ok = m.run(p) !== false;
  } catch {
    ok = false;
  }
  if (!ok) return false;
  spendCE(p, cost);
  if (m.hp && h) h.setCurrentValue(Math.max(1, h.currentValue - m.hp));
  startCooldown(p, id, m.cd);
  bump(p, "moves_used");
  return true;
}

// ---------------------------------------------------------------------------
// Keepsakes
// ---------------------------------------------------------------------------
function consumeHeld(p, typeId) {
  try {
    const inv = p.getComponent("minecraft:inventory")?.container;
    const slot = p.selectedSlotIndex;
    const it = inv?.getItem(slot);
    if (!it || it.typeId !== typeId) return false;
    if (gameMode(p) === "creative") return true;
    if (it.amount > 1) {
      it.amount -= 1;
      inv.setItem(slot, it);
    } else inv.setItem(slot, undefined);
    return true;
  } catch {
    return false;
  }
}

export function eatFinger(p) {
  if (fingersOf(p) >= MAX_FINGERS) return void bar(p, "§4Your body can't hold another finger.", 40);
  if (!consumeHeld(p, "jjk:sukuna_finger")) return;
  addFinger(p);
  const n = fingersOf(p);
  anim(p, "eat");
  sound(p.dimension, "random.burp", p.location, 1, 0.6);
  sound(p.dimension, "mob.wither.ambient", p.location, 0.5, 1.4);
  fx(p.dimension, "jjk:aura", p.location, COLOR.red, 2.5);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.blood, 1, { radius: 2.5 });
  effect(p, "nausea", 100, 0);
  title(p, "§4Sukuna's Finger", `§7${n}/${MAX_FINGERS} — +10 max cursed energy, +2% damage`, 50);
  if (n === MAX_FINGERS) {
    title(p, "§4§lKING OF CURSES", "§7All twenty fingers", 80);
    try {
      world.sendMessage(`§4✦ ${p.name} has eaten all twenty of Sukuna's Fingers.`);
    } catch {
      /* ignore */
    }
  }
}

export function useWomb(p) {
  if (!techniqueOf(p)) return;
  if (!consumeHeld(p, "jjk:cursed_womb")) return;
  resetCooldowns(p);
  setTechnique(p, pickTechnique(techniqueOf(p)), "reroll");
  applyStats(p);
}

export function initTechniques() {
  onPromote((p, from, to) => {
    const added = syncItems(p);
    for (const id of added) if (id !== "jujutsu_record") tell(p, `§d✦ New move: §f${MOVES[id]?.name ?? id}`);
  });
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (!techniqueOf(p)) continue;
      try {
        syncItems(p);
      } catch {
        /* ignore */
      }
    }
  }, 100);
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => nagged.delete(playerId));
}
export const _state = { cooldowns };
