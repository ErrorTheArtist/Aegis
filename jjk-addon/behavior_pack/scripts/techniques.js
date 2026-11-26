// Innate techniques: who gets what, the move items, and what happens when you right-click one.
//
// Every player is born into a clan and awakens an innate technique on their first join. The great clans' techniques
// are inherited by blood (see clans.js): nobody outside the Gojo clan can awaken Limitless, and so on.
// A technique belongs to whoever awakened it — its moves refuse to work for anyone else.
// Each technique has four moves: two from the start, the third at Grade 2 and its domain (or Maximum) at Grade 1.
// Everyone (but Heavenly Restriction) also learns Simple Domain at Grade 2 and Reverse Cursed Technique at
// Semi-Grade 1. Move items are locked in your inventory and kept when you die; new ones appear as you're promoted.
// A Cursed Womb rerolls your technique — always into a different one your clan's blood allows.

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
import { STRAW_DOLL } from "./tech_straw.js";
import { RATIO } from "./tech_ratio.js";
import { PROJECTION } from "./tech_projection.js";
import { DISASTER_FLAMES } from "./tech_disaster.js";
import { IDLE_TRANSFIGURATION } from "./tech_transfiguration.js";
import { IDLE_DEATH_GAMBLE } from "./tech_gamble.js";
import { CURSED_SPIRITS } from "./tech_spirits.js";
import { CLANS, BOUND, clanOf, ensureClan, rollTechnique, clanCooldown, rarityOf } from "./clans.js";
import { creditsIntact, creditLine, tamperedLine } from "./credits.js";
import { vowMult, vowInfo } from "./vows.js";
import { nameKinds } from "./mahoraga.js";
import { inCinematic } from "./cinematic.js";

export const TECHNIQUES = {
  limitless: { name: "Limitless", c: "§b", moves: LIMITLESS,
    blurb: "Infinity itself. Blue pulls, Red repels, Hollow Purple erases — and while you have cursed energy, Infinity turns aside 40% of every blow." },
  shrine: { name: "Shrine", c: "§c", moves: SHRINE,
    blurb: "The King of Curses' slashes. Dismantle cuts everything in a line, Cleave adapts to toughness, and Fuga opens into fire." },
  ten_shadows: { name: "Ten Shadows", c: "§5", moves: TEN_SHADOWS,
    blurb: "Shikigami from your shadow: the Divine Dogs, Nue and Max Elephant fight for you." },
  heavenly: { name: "Heavenly Restriction", c: "§e", moves: HEAVENLY,
    blurb: "No cursed energy at all — instead a monstrous body, cursed tools, and immunity to every domain's sure-hit." },
  projection: { name: "Projection Sorcery", c: "§f", moves: PROJECTION,
    blurb: "One second split into 24 frames. Move along them faster than anyone can follow — and freeze whoever can't keep up inside a frame." },
  cursed_speech: { name: "Cursed Speech", c: "§3", moves: CURSED_SPEECH,
    blurb: "Your words are commands — Don't Move, Blast Away, Crush. Every word costs your throat a little health." },
  blood: { name: "Blood Manipulation", c: "§4", moves: BLOOD,
    blurb: "Your blood is a weapon: Piercing Blood, Supernova, and buffs that push your body past its limits." },
  disaster_flames: { name: "Disaster Flames", c: "§6", moves: DISASTER_FLAMES,
    blurb: "Volcanic heat as a technique: burning insects, a stream of fire, a falling meteor — and a domain inside a volcano." },
  idle_death_gamble: { name: "Idle Death Gamble", c: "§a", moves: IDLE_DEATH_GAMBLE,
    blurb: "A gambler's technique. Its domain hurts no one — it spins for a JACKPOT, and a jackpot makes you all but immortal for 20 s." },
  cursed_spirit: { name: "Cursed Spirit Manipulation", c: "§d", moves: CURSED_SPIRITS,
    blurb: "Every curse you exorcise is swallowed and kept (up to 12). Release them to fight for you — or compress them all into Uzumaki." },
  idle_transfiguration: { name: "Idle Transfiguration", c: "§9", moves: IDLE_TRANSFIGURATION,
    blurb: "You touch the soul, and the body follows: twist the ones you touch, grow spikes, and make transfigured humans fight for you." },
  straw_doll: { name: "Straw Doll", c: "§6", moves: STRAW_DOLL,
    blurb: "Hammer, nails and a straw doll. Anyone you've hurt has left a piece of themselves behind — and what you do to the doll happens to them." },
  ratio: { name: "Ratio", c: "§9", moves: RATIO,
    blurb: "Divide anything along a 7:3 line and strike that point for a critical hit. Work overtime and it only gets worse for them." },
  boogie: { name: "Boogie Woogie", c: "§6", moves: BOOGIE,
    blurb: "Clap and swap places with anyone you see. Simple, and terrifying in the right hands." },
};
for (const [id, t] of Object.entries(TECHNIQUES)) t.rarity = rarityOf(id); // from the clan tables (clans.js)
// each technique's cursed energy colour (the flare when you cast one of its moves)
const RGB = {
  limitless: COLOR.blue, shrine: COLOR.red, ten_shadows: COLOR.shadow, heavenly: COLOR.gold, projection: COLOR.white, cursed_speech: COLOR.teal,
  blood: COLOR.blood, disaster_flames: COLOR.fire, idle_death_gamble: COLOR.green, cursed_spirit: [0.85, 0.4, 0.9],
  idle_transfiguration: [0.42, 0.5, 0.95], straw_doll: COLOR.gold, ratio: [0.42, 0.5, 0.95], boogie: COLOR.gold,
};
for (const [id, t] of Object.entries(TECHNIQUES)) t.rgb = RGB[id] ?? COLOR.ce;
nameKinds(Object.fromEntries(Object.entries(TECHNIQUES).map(([id, t]) => [id, `${t.c}${t.name}`]))); // (what Mahoraga adapts to)
for (const [id, t] of Object.entries(TECHNIQUES)) t.clan = BOUND[id] ?? null; // the clan whose blood it runs in (null: any)

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
export const moveCost = (p, m) => Math.round((m.cost === "domain" ? maxCE(p) * DOMAIN_COST : m.cost) * vowMult(p, "ce"));

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

export function setTechnique(p, id, why = "awaken") {
  const t = TECHNIQUES[id];
  if (!t) return false;
  // a clan technique runs in its clan's blood: whoever is given it (by an admin) joins that clan
  if (t.clan && clanOf(p) !== t.clan) setProp(p, "clan", t.clan);
  if (!clanOf(p)) ensureClan(p);
  setProp(p, "technique", id);
  if (id === "heavenly") {
    try {
      p.removeEffect("resistance");
    } catch {
      /* ignore */
    }
  }
  syncItems(p);
  const clan = CLANS[clanOf(p)];
  title(p, `${t.c}§l${t.name.toUpperCase()}`, why === "reroll" ? "§7Your innate technique has changed" : `§7Born into ${clan.c}${clan.id === "clanless" ? "no clan" : `the ${clan.name} clan`}`, 60);
  tell(p, `§5✦ §fClan: ${clan.c}${clan.name} §8(${clan.perk})\n§5✦ §fInnate technique: ${t.c}${t.name} §8(${t.rarity}§8)\n§7${t.blurb}\n§7Your moves are in your inventory — §fright-click§7 to use them. Open the §dJujutsu Record§7 for everything else.\n${creditLine()}`);
  sound(p.dimension, "beacon.activate", p.location, 1, 1.2);
  fx(p.dimension, "jjk:shell", mid(p), COLOR.purple, 1, { radius: 2 });
  if (id === "limitless" || id === "shrine") {
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
  if (!creditsIntact()) return tell(p, tamperedLine()), false;
  const clan = ensureClan(p);
  return setTechnique(p, rollTechnique(clan));
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
  secs *= clanCooldown(p) * vowMult(p, "cd");
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
  if (!creditsIntact()) return nag(p, tamperedLine()), false;
  const tech = techniqueOf(p);
  // a technique belongs to whoever awakened it: no one else can use its moves
  if (m.tech && m.tech !== tech) return nag(p, `§cOnly a sorcerer born with ${TECHNIQUES[m.tech].name} can use that.`), false;
  if (!m.tech && isHeavenly(p)) return nag(p, "§eHeavenly Restriction: you have no cursed energy to use that."), false;
  if (gradeOf(p) < m.grade) return nag(p, `§7${m.name} unlocks at ${GRADES[m.grade].c}${GRADES[m.grade].name}§7.`), false;
  if (stunned(p)) return nag(p, "§cYou can't move!"), false;
  if (inCinematic(p)) return false; // (the camera isn't yours until it ends)
  if (m.tech && m.tech !== "heavenly" && burnedOut(p)) return nag(p, `§cBurnout: your technique is spent for ${Math.ceil(burnedOut(p) / 20)}s more.`), false;
  const left = cooldownLeft(p, id);
  if (left > 0) return nag(p, `§7${m.name} §8— ready in §f${left.toFixed(1)}s`), false;
  const cost = moveCost(p, m);
  if (getCE(p) + 1e-6 < cost) return nag(p, `§9Not enough cursed energy §7(${Math.floor(getCE(p))}/${cost})`), false;
  const h = health(p);
  if (m.hp && h && h.currentValue <= m.hp + 1) return nag(p, "§cYour throat can't take another word right now."), false;
  const vow = vowInfo(p);
  if (vow?.hp && h && h.currentValue <= vow.hp + 1) return nag(p, "§4Blood Price: §cyou haven't the blood to pay for that."), false;
  let ok = false;
  try {
    ok = m.run(p) !== false;
  } catch {
    ok = false;
  }
  if (!ok) return false;
  spendCE(p, cost);
  if (m.hp && h) h.setCurrentValue(Math.max(1, h.currentValue - m.hp));
  if (vow?.hp && h) h.setCurrentValue(Math.max(1, h.currentValue - vow.hp));
  if (vow?.reveal) reveal(p, m);
  startCooldown(p, id, m.cd);
  bump(p, "moves_used");
  // the flare of cursed energy at your feet (domains and Hollow Purple have cinematics of their own)
  if (m.cost !== "domain" && id !== "hollow_purple") fx(p.dimension, "jjk:ring", p.location, TECHNIQUES[tech]?.rgb ?? COLOR.ce, 0.55);
  return true;
}

// Revealed Technique: every move is explained aloud to everyone near you.
function reveal(p, m) {
  for (const q of world.getAllPlayers()) {
    try {
      if (q.dimension.id !== p.dimension.id || Math.hypot(q.location.x - p.location.x, q.location.z - p.location.z) > 20) continue;
    } catch {
      continue;
    }
    tell(q, `§e✦ ${p.name} reveals: §f${m.name} §7— ${m.info}`);
  }
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
  setTechnique(p, rollTechnique(ensureClan(p), techniqueOf(p)), "reroll");
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
