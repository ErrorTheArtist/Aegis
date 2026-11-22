// The bounty & honor tracker (v1.62).
//   • the sidebar (right of the screen, for everyone): the Bingo Book's most wanted — the top 15 bounties, highest first,
//     offline shinobi included;
//   • the player list (pause screen): everyone's honor next to their name;
//   • optionally, every player's bounty under their name;
//   • the HUD (top-left): your own bounty and honor;
//   • Shinobi Record → Bounty & Honor: your standing, what a kill earns you, the leaders, and the titles' goals.
// Every player kill is worth 50,000 honor or bounty (bounty.js). The admins switch the boards on and off and set the
// amount in Admin Panel → Server Settings.

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { bountyOf, mostWanted, killReward, WANTED_AT } from "./bounty.js";
import { getHonor, getVillage, isRogue, topHonor } from "./villages.js";
import { fmtRyo } from "./currency.js";
import { TITLES, TITLE_IDS, hasTitle } from "./titles.js";
import { warOn } from "./war.js";

const WANTED_OBJ = "aegis_wanted"; // the sidebar: fake players named after the most wanted (they show while offline)
const HONOR_OBJ = "aegis_honor"; // the player list
const TAG_OBJ = "aegis_bounty_tag"; // under the names
const TOP = 15;
const DEFAULTS = { sidebar: true, list: true, below: false };
export const TRACKERS = {
  sidebar: "Most Wanted on the sidebar (the top 15 bounties)",
  list: "Honor in the player list",
  below: "Bounties under players' names",
};

export function trackerOn(which) {
  try {
    const v = world.getDynamicProperty(`aegis:track_${which}`);
    return typeof v === "boolean" ? v : DEFAULTS[which];
  } catch {
    return DEFAULTS[which];
  }
}
export function setTracker(which, on) {
  world.setDynamicProperty(`aegis:track_${which}`, on === DEFAULTS[which] ? undefined : !!on);
  refreshTracker();
}

function board() {
  try {
    return world.scoreboard;
  } catch {
    return undefined;
  }
}
function objective(sb, id, name) {
  try {
    return sb.getObjective(id) ?? sb.addObjective(id, name);
  } catch {
    return undefined;
  }
}
function display(sb, slot, obj, on) {
  try {
    const cur = sb.getObjectiveAtDisplaySlot(slot)?.objective;
    if (on && obj && cur?.id !== obj.id) sb.setObjectiveAtDisplaySlot(slot, { objective: obj, sortOrder: 1 }); // highest first
    else if (!on && cur && [WANTED_OBJ, HONOR_OBJ, TAG_OBJ].includes(cur.id)) sb.clearObjectiveAtDisplaySlot(slot);
  } catch {
    /* ignore */
  }
}
const score = (n) => Math.max(0, Math.min(2000000000, Math.floor(n || 0)));

// Brings the boards up to date (every 2 seconds, and when a setting changes).
export function refreshTracker() {
  const sb = board();
  if (!sb) return;
  const wanted = objective(sb, WANTED_OBJ, "§c§lMost Wanted §r§7(Ryō)");
  const honor = objective(sb, HONOR_OBJ, "§eHonor");
  const tag = objective(sb, TAG_OBJ, "§cRyō bounty");
  // the sidebar: exactly the top bounties
  if (wanted) {
    const top = mostWanted(TOP);
    const names = new Set(top.map((e) => e.name));
    try {
      for (const id of wanted.getParticipants()) if (!names.has(id.displayName)) wanted.removeParticipant(id);
    } catch {
      /* ignore */
    }
    for (const e of top) {
      try {
        wanted.setScore(e.name, score(e.bounty));
      } catch {
        /* ignore */
      }
    }
  }
  for (const p of world.getAllPlayers()) {
    try {
      honor?.setScore(p, score(getHonor(p)));
    } catch {
      /* ignore */
    }
    try {
      const b = bountyOf(p);
      if (b > 0) tag?.setScore(p, score(b));
      else tag?.removeParticipant(p);
    } catch {
      /* ignore */
    }
  }
  display(sb, "Sidebar", wanted, trackerOn("sidebar") && !warOn()); // (the Great Shinobi War has the sidebar while it lasts)
  display(sb, "List", honor, trackerOn("list"));
  display(sb, "BelowName", tag, trackerOn("below"));
}

// ---------------------------------------------------------------------------
// Shinobi Record → Bounty & Honor
// ---------------------------------------------------------------------------
const fmt = (n) => Math.floor(n).toLocaleString("en-US");
function bar(have, need, n = 12) {
  const f = Math.max(0, Math.min(n, Math.round((have / Math.max(1, need)) * n)));
  return "§a" + "|".repeat(f) + "§8" + "|".repeat(n - f);
}

export async function trackerMenu(p, back) {
  const bounty = bountyOf(p);
  const honor = getHonor(p);
  const reward = killReward();
  const hero = !!getVillage(p) && !isRogue(p);
  const wanted = mostWanted(5);
  const honored = topHonor(5);
  const goals = TITLE_IDS.filter((id) => TITLES[id].goal).map((id) => {
    const [kind, need] = TITLES[id].goal;
    const have = kind === "bounty" ? bounty : honor;
    const done = have >= need;
    return `${TITLES[id].name}${hasTitle(p, id) ? " §a(yours)" : ""}§7: ${kind === "bounty" ? "a bounty of" : "honor"} §f${fmt(need)}§7  ${done ? "§a✔" : `${bar(have, need)} §7${Math.floor((have / need) * 100)}%`}`;
  });
  const body = [
    `§7Your bounty: §6${fmtRyo(bounty)}${bounty >= WANTED_AT ? " §4[Wanted]" : ""}`,
    `§7Your honor: §e${fmt(honor)}${getVillage(p) ? "" : " §8(only village shinobi earn honor)"}`,
    "",
    `§fEvery player you defeat is worth §e${fmt(reward)}§f:`,
    hero
      ? `§7· a wanted shinobi or a rogue ninja → §e+${fmt(reward)} honor§7 (and their bounty, in Ryō)\n§7· anyone else → §c+${fmt(reward)} bounty§7 on your own head`
      : `§7· as a rogue ninja, every kill → §c+${fmt(reward)} bounty§7 on your head (and the victim's bounty, in Ryō)`,
    "",
    "§c§lMost wanted",
    ...(wanted.length ? wanted.map((e, i) => `§7${i + 1}. §f${e.name} §6${fmtRyo(e.bounty)}`) : ["§8The Bingo Book is empty."]),
    "",
    "§e§lMost honored",
    ...(honored.length ? honored.map((e, i) => `§7${i + 1}. §f${e.name} §e${fmt(e.honor)}`) : ["§8Nobody has earned honor yet."]),
    "",
    "§f§lTitles of legend — bounty and honor goals",
    ...goals,
  ].join("\n");
  const r = await new ActionFormData().title("§l§cBounty §f& §eHonor").body(body).button("§l« Back").show(p);
  if (r.canceled) return;
  return back?.();
}

export function initTracker() {
  system.runInterval(refreshTracker, 40);
}
