// The two paths. On their first join every player chooses:
//   Jujutsu Sorcerer   born into a clan, awakens an innate technique; exorcises curses; Jujutsu High fights beside them.
//   Cursed Spirit      born from humanity's fear (origin "cursed", see clans.js), awakens a disaster (Disaster Flames,
//                      Disaster Plants, Disaster Tides, Idle Transfiguration) and the curse's own powers
//                      (curse_powers.js). Curses don't attack them — they grow by devouring them; Jujutsu High hunts
//                      them (sorcerers.js), and the cursed among the villains (Mahito, Jogo, Geto, Choso) spare them.
// Closing the choice asks again in 10 s; closed three times, the player walks the sorcerer's path. Either path can be
// left later — starting over (Record -> Settings). The server can switch the choice off: then everyone is a sorcerer
// (Admin Panel -> Server settings). Admins: /scriptevent jjk:path curse|sorcerer [name] (keeps their grade).

import { system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { setProp, worldProp, valid, tell, bar } from "./core.js";
import { show } from "./ui.js";
import { clanOf, isCurse, rollClan, canInherit, rollTechnique, syncPathTag } from "./clans.js";
import { techniqueOf, awaken, setTechnique, syncItems, resetCooldowns } from "./techniques.js";
import { applyStats } from "./grades.js";

export const pathsOn = () => worldProp("curse_path", true) !== false;
export const pathOf = (p) => (isCurse(p) ? "curse" : techniqueOf(p) || clanOf(p) ? "sorcerer" : undefined);
// A brand-new player (no clan, no technique yet) gets to choose before anything awakens.
export const needsPath = (p) => pathsOn() && !clanOf(p) && !techniqueOf(p);

const asking = new Set();
const CHOICE = "§fEvery sorcerer fights curses. Every curse feeds on fear. Which will you be?\n\n"
  + "§b§lJujutsu Sorcerer§r\n§7Born into a clan, you awaken an innate technique, exorcise curses and climb from Grade 4 to "
  + "Special Grade. Jujutsu High fights beside you.\n\n"
  + "§4§lCursed Spirit§r\n§7Born from humanity's fear, you master a disaster — flames, plants, the tides, or the shape of the "
  + "soul. Curses don't attack you: you grow by devouring them. Jujutsu High will come to exorcise you.";
export async function askPath(p, tries = 0) {
  if (!valid(p) || asking.has(p.id) || !needsPath(p)) return;
  asking.add(p.id);
  let r;
  try {
    r = await show(p, new ActionFormData().title("§5Choose your path").body(CHOICE)
      .button("§b§lJujutsu Sorcerer\n§r§7a clan · an innate technique")
      .button("§4§lCursed Spirit\n§r§7a disaster · devour curses"));
  } finally {
    asking.delete(p.id);
  }
  if (!valid(p) || !needsPath(p)) return;
  if (r.canceled || r.selection === undefined) {
    if (tries >= 2) {
      tell(p, "§7You'll walk the sorcerer's path. §8(You can start over as a Cursed Spirit from the Record's Settings.)");
      choosePath(p, "sorcerer");
      return;
    }
    bar(p, "§7Choose your path to begin.", 60);
    system.runTimeout(() => askPath(p, tries + 1), 200);
    return;
  }
  choosePath(p, r.selection === 1 ? "curse" : "sorcerer");
}
// Sets a new player's path and awakens them on it.
export function choosePath(p, path) {
  setProp(p, "clan", path === "curse" ? "cursed" : rollClan());
  syncPathTag(p);
  return awaken(p);
}

// Starting over on the other path (Record -> Settings): grade, technique, fingers and vow start again.
export const WIPE = ["technique", "clan", "xp", "fingers", "ce", "black_flashes", "exorcised", "sorcerers_beaten", "moves_used", "hb", "vow",
  "vow_at", "mahoraga", "spirits", "devoured"];
export function startOver(p, path) {
  for (const k of WIPE) setProp(p, k, undefined);
  resetCooldowns(p);
  choosePath(p, path);
  applyStats(p);
  syncItems(p);
}
export async function confirmStartOver(p) {
  const to = isCurse(p) ? "sorcerer" : "curse";
  const r = await show(p, new MessageFormData().title(to === "curse" ? "§4Become a Cursed Spirit" : "§bBecome a Jujutsu Sorcerer")
    .body(`§fYou'll start over as a ${to === "curse" ? "§4Cursed Spirit" : "§bJujutsu Sorcerer"}§f: your grade, technique, Sukuna's Fingers and Binding Vow are wiped.\n\n§7Are you sure?`)
    .button1("§cStart over").button2("§7Keep going"));
  if (r.canceled || r.selection !== 0 || !valid(p)) return false;
  startOver(p, to);
  return true;
}

// Admin: put a player on a path, keeping their grade (their technique changes if the new path doesn't allow it).
export function setPath(p, path) {
  const tech = techniqueOf(p);
  const clan = path === "curse" ? "cursed" : isCurse(p) || !clanOf(p) ? rollClan() : clanOf(p);
  setProp(p, "clan", clan);
  syncPathTag(p);
  if (!tech) return awaken(p);
  const next = canInherit(clan, tech) ? tech : rollTechnique(clan, tech);
  if (next !== tech) {
    resetCooldowns(p);
    setTechnique(p, next, "reroll");
  } else syncItems(p); // (their moves change: a curse's powers, or a sorcerer's)
  applyStats(p);
  return true;
}
export const _paths = { asking, CHOICE };
