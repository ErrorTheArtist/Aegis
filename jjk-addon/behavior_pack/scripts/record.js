// The Jujutsu Record (right-click it): your technique, grade, cursed energy and fingers; every move with its cost,
// cooldown and unlock; the grade ladder; a short guide to fighting; settings — and, for admins (tag jjk_admin), the
// Admin Panel.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getProp, setProp, worldProp, setWorldProp, tell, valid } from "./core.js";
import { GRADES, gradeOf, xpOf, nextGrade, fingersOf, maxCE, regenCE, setXp, MAX_FINGERS, dmgMult, applyStats } from "./grades.js";
import { getCE, setCE, isHeavenly } from "./energy.js";
import { TECHNIQUES, UNIVERSAL, techniqueOf, moveCost, setTechnique, pickTechnique, resetCooldowns, syncItems, cooldownLeft } from "./techniques.js";
import { bfChance } from "./combat.js";
import { spawnFingerBearer } from "./curses.js";

export const ADMIN_TAG = "jjk_admin";
export const isAdmin = (p) => {
  try {
    return p.hasTag(ADMIN_TAG) || p.isOp?.() === true;
  } catch {
    return false;
  }
};

async function show(p, form) {
  for (let i = 0; i < 30; i++) {
    let r;
    try {
      r = await form.show(p);
    } catch {
      return { canceled: true };
    }
    if (!r.canceled || r.cancelationReason !== "UserBusy") return r;
    await new Promise((res) => system.runTimeout(res, 10));
  }
  return { canceled: true };
}

function progress(frac, n = 20) {
  const k = Math.round(Math.max(0, Math.min(1, frac)) * n);
  return `§a${"|".repeat(k)}§8${"|".repeat(n - k)}`;
}

export async function openRecord(p) {
  const tech = TECHNIQUES[techniqueOf(p)];
  if (!tech) return tell(p, "§7Your technique hasn't awakened yet — give it a moment.");
  const g = gradeOf(p);
  const nx = nextGrade(p);
  const lines = [
    `§fInnate technique: ${tech.c}§l${tech.name}§r §8(${tech.rarity}§8)`,
    `§fGrade: ${GRADES[g].c}${GRADES[g].name} §7· ${xpOf(p)} XP`,
    nx.need ? `${progress(nx.frac)} §7${nx.need} XP to ${GRADES[g + 1].c}${GRADES[g + 1].name}` : "§6The strongest there is.",
    isHeavenly(p)
      ? "§fCursed energy: §enone §7(Heavenly Restriction)"
      : `§fCursed energy: §b${Math.floor(getCE(p))}/${maxCE(p)} §7(+${regenCE(p).toFixed(1)}/s · twice as fast sneaking still)`,
    `§fTechnique damage: §cx${dmgMult(p).toFixed(2)}`,
    `§fSukuna's Fingers: §4${fingersOf(p)}/${MAX_FINGERS}`,
    isHeavenly(p) ? "" : `§fBlack Flash chance: §c${Math.round(bfChance(p) * 100)}%§7 · landed ${getProp(p, "black_flashes", 0)}`,
    `§fCurses exorcised: §a${getProp(p, "exorcised", 0)} §7· sorcerers beaten: §a${getProp(p, "sorcerers_beaten", 0)}`,
  ].filter(Boolean);
  const pages = [
    ["§lTechnique & Moves\n§r§7costs, cooldowns, unlocks", () => movesPage(p)],
    ["§lGrades\n§r§7the road to Special Grade", () => gradesPage(p)],
    ["§lHow to Fight\n§r§7Black Flash, domains, curses", () => guidePage(p)],
    ["§lSettings", () => settingsPage(p)],
  ];
  if (isAdmin(p)) pages.push(["§4§lAdmin Panel\n§r§7players · curses · server", () => adminMenu(p)]);
  const f = new ActionFormData().title("§5Jujutsu Record").body(lines.join("\n"));
  for (const [label] of pages) f.button(label);
  const r = await show(p, f);
  if (r.canceled || r.selection === undefined) return;
  return pages[r.selection]?.[1]();
}

async function back(p, title, body, then) {
  const r = await show(p, new ActionFormData().title(title).body(body).button("§l« Back"));
  if (!r.canceled) return then();
}

function moveLine(p, id, m) {
  const g = gradeOf(p);
  const cost = moveCost(p, m);
  const lock = g < m.grade ? ` §8[${GRADES[m.grade].name}]` : "";
  const parts = [];
  if (cost) parts.push(`${cost} CE`);
  if (m.hp) parts.push(`${m.hp} HP`);
  parts.push(`${m.cd}s`);
  const cd = cooldownLeft(p, id);
  return `${g < m.grade ? "§8" : "§f"}${m.name}§7 — ${parts.join(" · ")}${lock}${cd > 0 ? ` §e(${cd.toFixed(0)}s)` : ""}\n§8  ${m.info}`;
}

function movesPage(p) {
  const tech = TECHNIQUES[techniqueOf(p)];
  const lines = [`${tech.c}§l${tech.name}§r`, `§7${tech.blurb}`, ""];
  for (const [id, m] of Object.entries(tech.moves)) lines.push(moveLine(p, id, m));
  if (!isHeavenly(p)) {
    lines.push("", "§d§lEvery sorcerer");
    for (const [id, m] of Object.entries(UNIVERSAL)) lines.push(moveLine(p, id, m));
    lines.push("§fBlack Flash§7 — passive: a melee hit can land as a Black Flash (x2.5, refills 30% CE).");
  } else {
    lines.push("", "§e§lYour body", "§7Strength (II at Grade 1), Speed, Resistance, Jump Boost; Regeneration at Semi-Grade 1.",
      "§7No domain's sure-hit can touch you. Cursed tools are weapons: hit with them, right-click for their art.");
  }
  lines.push("", "§7Domains cost 70% of your max cursed energy and burn your technique out for 15 s afterwards.");
  return back(p, "§5Technique & Moves", lines.join("\n"), () => openRecord(p));
}

function gradesPage(p) {
  const g = gradeOf(p);
  const lines = GRADES.map((gr, i) => `${i === g ? "§l» " : "  "}${gr.c}${gr.name}§r§7 — ${gr.xp} XP`);
  lines.push("", "§fEach grade: §7+40 max cursed energy, +0.8 CE/s, +20% technique damage, +2 hearts.",
    "§fNew moves: §7third move at Grade 2 (with Simple Domain), Reverse Cursed Technique at Semi-Grade 1, your domain at Grade 1.",
    "§fSukuna's Fingers: §7+10 max CE and +2% damage each, up to 20. The Finger Bearer always drops one.",
    "", "§fXP: §7Grade 4 curse 10 · Grade 3 25 · Grade 2 60 · Grade 1 150 · Special Grade 1000 · another sorcerer 100 · any other monster 3.");
  return back(p, "§5Grades", lines.join("\n"), () => openRecord(p));
}

function guidePage(p) {
  const lines = [
    "§l§fUsing moves", "§7Right-click a move item. It costs cursed energy (CE) and recharges; the bar above your hotbar shows your CE.",
    "§7Sneak and stand still to focus: CE comes back twice as fast.", "",
    "§l§fBlack Flash", "§7Any punch or weapon hit can distort into a Black Flash: x2.5 damage, 30% of your CE back, and 30 s in the zone (+10% chance).", "",
    "§l§fDomain Expansion", "§7Grade 1. Everyone inside who isn't protected is hit by its sure-hit — Infinity included. Overlapping domains clash: the stronger sorcerer keeps theirs.",
    "§7Protection: Simple Domain (Grade 2), Heavenly Restriction, or your own domain. The Inverted Spear of Heaven breaks a domain by stabbing its caster.", "",
    "§l§fCurses", "§7Curses gather around sorcerers at night — the higher your grade, the stronger they come. At Grade 1 a Special Grade curse may come for you: the Finger Bearer. Bring friends.", "",
    "§l§fSukuna's Fingers & Cursed Wombs", "§7Eat a finger for permanent power. A Cursed Womb rerolls your innate technique into a different one.",
  ];
  return back(p, "§5How to Fight", lines.join("\n"), () => openRecord(p));
}

async function settingsPage(p) {
  const f = new ModalFormData().title("§5Settings").toggle("Show the cursed energy bar", !getProp(p, "hud_off", false));
  const limitless = techniqueOf(p) === "limitless";
  if (limitless) f.toggle("Infinity (40% less damage, 2 CE a hit)", !getProp(p, "infinity_off", false));
  const r = await show(p, f);
  if (r.canceled || !r.formValues) return;
  setProp(p, "hud_off", !r.formValues[0]);
  if (limitless) setProp(p, "infinity_off", !r.formValues[1]);
  tell(p, "§7Settings saved.");
}

// ---------------------------------------------------------------------------
// Admin Panel
// ---------------------------------------------------------------------------
export async function adminMenu(p) {
  if (!isAdmin(p)) return tell(p, `§cAdmins only (tag ${ADMIN_TAG}).`);
  const f = new ActionFormData().title("§4Admin Panel").body("§7Jujutsu Legacy")
    .button("§lEdit a player\n§r§7technique · grade · fingers")
    .button("§lSummon the Finger Bearer\n§r§7right here")
    .button("§lServer settings\n§r§7curses · terrain")
    .button("§l« Back");
  const r = await show(p, f);
  if (r.canceled) return;
  if (r.selection === 0) return pickPlayer(p);
  if (r.selection === 1) {
    spawnFingerBearer(p, true);
    return tell(p, "§4The Finger Bearer has been summoned.");
  }
  if (r.selection === 2) return serverSettings(p);
  return openRecord(p);
}

async function pickPlayer(p) {
  const players = world.getAllPlayers().sort((a, b) => a.name.localeCompare(b.name));
  const f = new ActionFormData().title("§4Edit a player");
  for (const q of players) f.button(`${q.name}\n§7${TECHNIQUES[techniqueOf(q)]?.name ?? "—"} · ${GRADES[gradeOf(q)].name}`);
  const r = await show(p, f);
  if (r.canceled || r.selection === undefined) return;
  return editPlayer(p, players[r.selection]);
}

const TECH_IDS = Object.keys(TECHNIQUES);
export async function editPlayer(p, q) {
  if (!valid(q)) return;
  const techNames = TECH_IDS.map((id) => TECHNIQUES[id].name);
  const f = new ModalFormData().title(`§4${q.name}`)
    .dropdown("Innate technique", techNames, Math.max(0, TECH_IDS.indexOf(techniqueOf(q))))
    .dropdown("Grade", GRADES.map((g) => g.name), gradeOf(q))
    .slider("Sukuna's Fingers", 0, MAX_FINGERS, 1, fingersOf(q))
    .toggle("Refill cursed energy and reset cooldowns", false)
    .toggle("Reroll their technique at random (overrides the choice above)", false);
  const r = await show(p, f);
  if (r.canceled || !r.formValues) return;
  const [ti, gi, fingers, refill, reroll] = r.formValues;
  const tech = reroll ? pickTechnique(techniqueOf(q)) : TECH_IDS[ti];
  if (tech !== techniqueOf(q)) setTechnique(q, tech, "reroll");
  if (gi !== gradeOf(q)) setXp(q, GRADES[gi].xp);
  setProp(q, "fingers", Math.max(0, Math.min(MAX_FINGERS, Math.round(fingers))));
  if (refill) {
    setCE(q, maxCE(q));
    resetCooldowns(q);
  }
  applyStats(q);
  syncItems(q);
  tell(p, `§7Saved ${q.name}: ${TECHNIQUES[tech].name}, ${GRADES[gradeOf(q)].name}, ${fingersOf(q)} fingers.`);
}

async function serverSettings(p) {
  const f = new ModalFormData().title("§4Server settings")
    .toggle("Curses gather around sorcerers at night", worldProp("surges", true))
    .toggle("The Finger Bearer can appear on its own (Grade 1+)", worldProp("boss_spawns", true))
    .toggle("Hollow Purple destroys terrain", worldProp("terrain", false));
  const r = await show(p, f);
  if (r.canceled || !r.formValues) return;
  setWorldProp("surges", !!r.formValues[0]);
  setWorldProp("boss_spawns", !!r.formValues[1]);
  setWorldProp("terrain", !!r.formValues[2]);
  tell(p, "§7Server settings saved.");
}
