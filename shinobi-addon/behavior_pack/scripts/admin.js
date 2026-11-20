// Admin Panel (v1.56) — every server-admin tool in one menu, no commands to remember.
//   /scriptevent aegis:admin      — open it (like every /scriptevent, only operators can run it)
//   /tag <you> add aegis_admin    — also puts an "Admin Panel" button in your Shinobi Record
// World events · grace periods · players (Ryō, level, XP Shards, heal, teleport, clan, titles, Kage & Sannin, bounty,
// faction, village, grace) · server settings · clear lag now · a log of the last admin actions (who did what, when).

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { showForm } from "./ui.js";
import { currentEvent, startRaid, startWanted, startScrolls, startDoubleXp, stopEvent, doubleXpLeft, endDoubleXp, autoEvents,
  setAutoEvents, wantedPool, nearestVillage } from "./events.js";
import { startGrace, stopGrace, graceLines, graceLeftText, GRACE_MAX_MINUTES } from "./grace.js";
import { clearItems, clearMobs, lagClearOn, setLagClear, nextItemClear } from "./lagclear.js";
import { vanillaBanned, setVanillaBan } from "./bans.js";
import { bountyOf, setBounty, killReward, setKillReward, KILL_REWARD_RANGE } from "./bounty.js";
import { TRACKERS, trackerOn, setTracker } from "./tracker.js";
import { FACTIONS, factionOf, factionRank, leaveFaction } from "./factions.js";
import { TITLES, TITLE_IDS, hasTitle } from "./titles.js";
import { getLevel, setLevel, MAX_LEVEL, RANKS, getRank, meleePercent, setMeleePercent, MELEE_RANGE } from "./levels.js";
import { addRyo, getRyo, fmtRyo, price, questRyo, pricePercent, questPercent, setEconomy, PRICE_RANGE, QUEST_RANGE, DEFAULT_PRICES,
  DEFAULT_QUESTS } from "./currency.js";
import { giveShards } from "./xpshards.js";
import { KAGE_VILLAGES, SANNIN_SETS, getKage, setKage, appointKage, isSannin, sanninOf, nameSannin, clearSannin } from "./armor.js";
import { rampageHolder } from "./rampage.js";
import { kamuiHolder } from "./kamui.js";
import { VILLAGES, getVillage, villageLabel, isRogue, rogueOf, askVillage, friendlyFire, setFriendlyFire, getHonor } from "./villages.js";
import { CLANS, getClanId, setClan } from "./clans.js";
import { LEGENDS } from "./legends.js";

export const ADMIN_TAG = "aegis_admin";
const LOG_PROP = "aegis:admin_log";
const LOG_MAX = 30;

let api;
const strip = (t) => String(t ?? "").replace(/§./g, "");
const online = () => world.getAllPlayers().sort((a, b) => a.name.localeCompare(b.name));
const mins = (ms) => Math.max(1, Math.ceil(ms / 60000));
const num = (v) => {
  const n = Math.floor(Number(String(v ?? "").replace(/[,\s_]/g, "")));
  return Number.isFinite(n) ? n : NaN;
};
const alive = (e) => {
  try {
    return api ? api.isValid(e) : !!e?.isValid?.();
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// The admin log — the last 30 actions, kept in the world
// ---------------------------------------------------------------------------
function readLog() {
  try {
    const l = JSON.parse(world.getDynamicProperty(LOG_PROP) ?? "[]");
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}
export function adminLog(by, text) {
  const l = readLog();
  l.unshift([Date.now(), by?.name ?? "server", strip(text)]);
  world.setDynamicProperty(LOG_PROP, JSON.stringify(l.slice(0, LOG_MAX)));
}
function ago(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function statusText() {
  const ev = currentEvent();
  const xp = doubleXpLeft();
  const grace = graceLines();
  const beast = rampageHolder();
  const kamui = kamuiHolder();
  return [
    `§7Players online: §f${world.getAllPlayers().length}`,
    `§7World event: ${ev ? `§f${ev.label}§7 (${mins(ev.until - Date.now())} min left)` : "§8none"}`,
    `§7Double XP: ${xp ? `§b${mins(xp)} min left` : "§8off"}§7 · automatic events: ${autoEvents() ? "§aon" : "§coff"}`,
    `§7Grace: ${grace[0].startsWith("§aEveryone") ? grace[0].replace("§aEveryone has grace: ", "§aeveryone, ") : "§8not for everyone"}` +
      (grace.length > 1 ? `§7 · §f${grace.length - 1}§7 player${grace.length === 2 ? "" : "s"} with their own` : ""),
    `§7Vanilla weapons & armour: ${vanillaBanned() ? "§cbanned" : "§aallowed"}§7 · friendly fire: ${friendlyFire() ? "§con" : "§aoff"}`,
    `§7Lag clear: ${lagClearOn() ? `§aon§7 (next item clear in ${nextItemClear()})` : "§coff"}`,
    `§7Economy: prices §f${pricePercent()}%§7 · quests pay §f${questPercent()}%§7 of their usual Ryō · melee damage §f${meleePercent()}%`,
    `§7Tailed Beast loose: ${beast ? `§c${beast.name}${beast.x !== undefined ? `§7 near ${beast.x}, ${beast.z}` : ""}` : "§8none"}`,
    `§7Kamui holder: ${kamui ? `§f${kamui.name}` : "§8nobody"}`,
  ].join("\n");
}

export async function adminMenu(p) {
  const pages = [
    ["§6World Events\n§r§8raid · wanted · scrolls · Double XP", eventsMenu],
    ["§aGrace Periods\n§r§8no PvP for a while", graceMenu],
    ["§bPlayers\n§r§8Ryō · level · titles · teleport…", playersMenu],
    ["§eServer Settings\n§r§8bans · lag clear · friendly fire · events", serverSettings],
    ["§6Economy\n§r§8prices · quest rewards", economyPage],
    ["§cClear Lag Now\n§r§8dropped items · hostile mobs", lagMenu],
    ["§7Admin Log\n§r§8the last 30 admin actions", logPage],
  ];
  const f = new ActionFormData().title("§l§4Admin Panel").body(statusText());
  for (const [label] of pages) f.button(label);
  f.button("§lClose");
  const r = await showForm(p, f);
  if (r.canceled || r.selection === undefined) return;
  return pages[r.selection]?.[1](p);
}

// ---------------------------------------------------------------------------
// World events
// ---------------------------------------------------------------------------
const VIL = () => Object.keys(VILLAGES);
const vilNames = () => VIL().map((v) => strip(VILLAGES[v].name));

async function eventsMenu(p) {
  const ev = currentEvent();
  const xp = doubleXpLeft();
  const opts = [
    ["§cVillage Raid\n§r§8three waves of enemy ninja attack a village", raidForm],
    ["§4Wanted Legend\n§r§8a legend roams the world, already fighting", wantedForm],
    ["§eHidden Scrolls\n§r§8eight sealed scrolls hidden around a village", scrollsForm],
    [`§bDouble XP\n§r§8${xp ? `on — ${mins(xp)} min left · tap to restart` : "all XP counts twice for a while"}`, doubleXpForm],
  ];
  if (ev) {
    opts.push([`§7Stop the event\n§r§8${ev.label}`, (q) => {
      if (stopEvent()) adminLog(q, `stopped the ${ev.label}`);
      return eventsMenu(q);
    }]);
  }
  if (xp) {
    opts.push(["§7End Double XP", (q) => {
      if (endDoubleXp()) adminLog(q, "ended Double XP");
      return eventsMenu(q);
    }]);
  }
  opts.push([`§7Automatic events: ${autoEvents() ? "§aon" : "§coff"}\n§r§8one every hour while 2+ players are online · tap to switch`, (q) => {
    const on = !autoEvents();
    q.sendMessage(setAutoEvents(on));
    adminLog(q, `switched automatic events ${on ? "on" : "off"}`);
    return eventsMenu(q);
  }]);
  opts.push(["§l« Back", adminMenu]);
  const f = new ActionFormData().title("§lWorld Events")
    .body(`§7Running: ${ev ? `§f${ev.label}§7 (${mins(ev.until - Date.now())} min left)` : "§8nothing"}\n§7One event at a time — Double XP can run alongside any of them.`);
  for (const [label] of opts) f.button(label);
  const r = await showForm(p, f);
  if (r.canceled || r.selection === undefined) return;
  return opts[r.selection]?.[1](p);
}

// Runs an event starter: an error message comes back as text; nothing means it started.
function started(p, err, what) {
  if (err) {
    p.sendMessage(err);
    return eventsMenu(p);
  }
  adminLog(p, what);
  p.sendMessage(`§a✔ Started: §f${what.replace(/^started (the |a )?/, "")}`);
}

async function raidForm(p) {
  const r = await showForm(p, new ModalFormData().title("§lVillage Raid")
    .dropdown("Which village is attacked?\n§7Three waves of enemy ninja (an Akatsuki member leads the last). Defenders get 5,000 Ryō, 2 XP Shards and 200 honor. 10 minutes.",
      vilNames(), Math.max(0, VIL().indexOf(nearestVillage(p.location)))));
  if (r.canceled || !r.formValues) return eventsMenu(p);
  const v = VIL()[r.formValues[0]];
  return started(p, startRaid(v), `started a raid on the ${strip(VILLAGES[v].name)}`);
}

async function wantedForm(p) {
  const pool = wantedPool();
  const players = online();
  const r = await showForm(p, new ModalFormData().title("§lWanted Legend")
    .dropdown("Which legend?\n§7Whoever brings it down gets 20,000 Ryō and 3 XP Shards (everyone who hit it, 5,000). 15 minutes.",
      ["Random", ...pool.map((id) => strip(LEGENDS[id].name))], 0)
    .dropdown("It appears near…", players.map((q) => q.name), Math.max(0, players.findIndex((q) => q.id === p.id))));
  if (r.canceled || !r.formValues) return eventsMenu(p);
  const id = r.formValues[0] > 0 ? pool[r.formValues[0] - 1] : undefined;
  const near = players[r.formValues[1]];
  if (!alive(near)) return eventsMenu(p);
  const err = startWanted(near, id);
  return started(p, err, `started a hunt for ${strip(currentEvent()?.label?.replace("hunt for ", "") ?? "a legend")} near ${near.name}`);
}

async function scrollsForm(p) {
  const r = await showForm(p, new ModalFormData().title("§lHidden Scrolls")
    .dropdown("Around which village?\n§7Eight sealed scrolls, each marked by a pillar of light: Ryō, XP Shards, jutsu scrolls — rarely a Bloodline Reroll Scroll. Someone must be near the village. 20 minutes.",
      vilNames(), Math.max(0, VIL().indexOf(nearestVillage(p.location)))));
  if (r.canceled || !r.formValues) return eventsMenu(p);
  const v = VIL()[r.formValues[0]];
  return started(p, startScrolls(v), `started a hidden scroll hunt around the ${strip(VILLAGES[v].name)}`);
}

async function doubleXpForm(p) {
  const r = await showForm(p, new ModalFormData().title("§lDouble XP").slider("For how many minutes?", 5, 240, 5, 30));
  if (r.canceled || !r.formValues) return eventsMenu(p);
  const m = Math.max(5, Math.min(240, Math.floor(Number(r.formValues[0]) || 30)));
  startDoubleXp(m);
  adminLog(p, `started Double XP for ${m} minutes`);
}

// ---------------------------------------------------------------------------
// Grace periods
// ---------------------------------------------------------------------------
async function graceMenu(p) {
  const f = new ActionFormData().title("§lGrace Periods")
    .body(`${graceLines().join("\n")}\n\n§7While a player has grace no player can hurt them, and they can't hurt players. Enemies leave them alone — unless attacked: then they fight back, 60% softer. Everything else works as usual.`)
    .button("§aGrace for everyone\n§r§8players who join meanwhile get it too")
    .button("§aGrace for one player")
    .button("§cEnd every grace period")
    .button("§cEnd one player's grace")
    .button("§l« Back");
  const r = await showForm(p, f);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection === 0) return graceForm(p, false);
  if (r.selection === 1) return graceForm(p, true);
  if (r.selection === 2) {
    const c = await showForm(p, new MessageFormData().title("End every grace period?")
      .body("§7Everyone's grace ends now — new players' first hour included. PvP is back on at once.").button1("§cEnd them all").button2("Cancel"));
    if (c.selection === 0) {
      stopGrace(undefined, p);
      adminLog(p, "ended every grace period");
    }
    return graceMenu(p);
  }
  if (r.selection === 3) {
    const players = online();
    const m = await showForm(p, new ModalFormData().title("§lEnd a grace period")
      .dropdown("Whose?", players.map((q) => `${q.name}${graceLeftText(q) ? ` §a(${graceLeftText(q)} left)` : ""}`), 0));
    if (!m.canceled && m.formValues) {
      const t = players[m.formValues[0]];
      if (alive(t)) {
        stopGrace(t, p);
        adminLog(p, `ended ${t.name}'s grace`);
      }
    }
    return graceMenu(p);
  }
  return adminMenu(p);
}

async function graceForm(p, one) {
  const players = online();
  const f = new ModalFormData().title(one ? "§lGrace for one player" : "§lGrace for everyone");
  if (one) f.dropdown("Who?", players.map((q) => q.name), 0);
  f.textField(`For how many minutes? §7(1–${GRACE_MAX_MINUTES})`, "10", "10");
  const r = await showForm(p, f);
  if (r.canceled || !r.formValues) return graceMenu(p);
  const m = num(r.formValues[one ? 1 : 0]);
  if (!(m >= 1)) {
    p.sendMessage("§cThat's not a number of minutes.");
    return graceForm(p, one);
  }
  const minutes = Math.min(GRACE_MAX_MINUTES, m);
  const t = one ? players[r.formValues[0]] : undefined;
  if (one && !alive(t)) return graceMenu(p);
  startGrace(minutes, t, p);
  adminLog(p, `gave ${t ? t.name : "everyone"} ${minutes} minutes of grace`);
  return graceMenu(p);
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
async function playersMenu(p) {
  const players = online();
  const f = new ActionFormData().title("§lPlayers").body(`§7${players.length} online. Pick a player.`);
  for (const q of players) {
    const v = isRogue(q) ? "§cRogue" : villageLabel(getVillage(q));
    f.button(`${q.name}${q.id === p.id ? " §8(you)" : ""}\n§r§8Lv. ${getLevel(q)} · ${strip(v)} · ${fmtRyo(getRyo(q))}`);
  }
  f.button("§l« Back");
  const r = await showForm(p, f);
  if (r.canceled || r.selection === undefined) return;
  const t = players[r.selection];
  if (!t) return adminMenu(p);
  return playerPage(p, t);
}

function playerText(t) {
  const clan = CLANS[getClanId(t)];
  const faction = FACTIONS[factionOf(t)];
  const kage = getKage(t);
  const titles = TITLE_IDS.filter((id) => hasTitle(t, id)).map((id) => TITLES[id].name);
  const village = isRogue(t) ? `§cRogue ninja §7(left the ${villageLabel(rogueOf(t))}§7)` : villageLabel(getVillage(t));
  let where = "";
  try {
    const l = t.location;
    where = `${Math.round(l.x)}, ${Math.round(l.y)}, ${Math.round(l.z)} §8(${t.dimension.id.replace("minecraft:", "")})`;
  } catch {
    /* ignore */
  }
  return [
    `§7Level §f${getLevel(t)}§7 · ${RANKS[getRank(t)]} · §6${fmtRyo(getRyo(t))}§7 · honor §e${getHonor(t).toLocaleString("en-US")}`,
    `§7Village: ${village}§7 · clan: ${clan ? `${clan.color}${clan.name}` : "§8none"}`,
    `§7Faction: ${faction ? `${faction.name}§7 (${factionRank(t)})` : "§8none"}§7 · bounty: ${bountyOf(t) ? `§6${fmtRyo(bountyOf(t))}` : "§8none"}`,
    `§7Titles: ${titles.length ? titles.join("§7, ") : "§8none"}§7 · Kage: ${kage ? KAGE_VILLAGES[kage].title : "§8no"}§7 · Sannin: ${isSannin(t) ? `§a${sanninOf(t) ? strip(SANNIN_SETS[sanninOf(t)]) : "yes"}` : "§8no"}`,
    `§7Grace: ${graceLeftText(t) ? `§a${graceLeftText(t)} left` : "§8none"}`,
    where ? `§7Position: §f${where}` : "",
  ].filter(Boolean).join("\n");
}

async function playerPage(p, t) {
  if (!alive(t)) {
    p.sendMessage("§7That player has left.");
    return playersMenu(p);
  }
  const back = () => playerPage(p, t);
  const acts = [
    ["§6Give or take Ryō", () => ryoForm(p, t, back)],
    ["§eSet level\n§r§8stat points are refunded", () => levelForm(p, t, back)],
    ["§bGive XP Shards", () => shardsForm(p, t, back)],
    ["§aHeal & refill chakra", () => {
      heal(t);
      p.sendMessage(`§a${t.name} is healed and their chakra is full.`);
      adminLog(p, `healed ${t.name}`);
      return back();
    }],
    ["§3Teleport…\n§r§8to them · bring them · send to a village", () => teleportMenu(p, t, back)],
    ["§dClan", () => clanForm(p, t, back)],
    ["§5Titles of legend", () => titlesForm(p, t, back)],
    ["§cKage & Sannin", () => kageForm(p, t, back)],
    ["§6Bounty", () => bountyForm(p, t, back)],
  ];
  if (factionOf(t)) acts.push([`§8Remove from the ${strip(FACTIONS[factionOf(t)].name)}`, () => factionForm(p, t, back)]);
  acts.push([`§aChoose a village again\n§r§8${isRogue(t) ? "let this rogue back into a village" : "they pick, and are sent there"}`, () => villageForm(p, t, back)]);
  acts.push(["§aGrace period", () => playerGraceForm(p, t, back)]);
  acts.push(["§l« Back", () => playersMenu(p)]);
  const f = new ActionFormData().title(`§l${t.name}`).body(playerText(t));
  for (const [label] of acts) f.button(label);
  const r = await showForm(p, f);
  if (r.canceled || r.selection === undefined) return;
  if (!alive(t)) {
    p.sendMessage("§7That player has left.");
    return playersMenu(p);
  }
  return acts[r.selection]?.[1]();
}

async function ryoForm(p, t, back) {
  const r = await showForm(p, new ModalFormData().title(`§lRyō — ${t.name}`)
    .textField(`§7${t.name} has §6${fmtRyo(getRyo(t))}§7.\nHow much to give? §8(a minus sign takes Ryō away: -5000)`, "5000", ""));
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const n = num(r.formValues[0]);
  if (!Number.isFinite(n) || n === 0) {
    p.sendMessage("§cThat's not an amount of Ryō.");
    return back();
  }
  const amount = Math.max(-getRyo(t), n);
  addRyo(t, amount, true);
  if (amount > 0) t.sendMessage(`§6+${fmtRyo(amount)}§7 from the server.`);
  else if (amount < 0) t.sendMessage(`§c-${fmtRyo(-amount)}§7 taken by the server.`);
  p.sendMessage(`§7${t.name} now has §6${fmtRyo(getRyo(t))}§7.`);
  adminLog(p, `${amount >= 0 ? "gave" : "took"} ${fmtRyo(Math.abs(amount))} ${amount >= 0 ? "to" : "from"} ${t.name}`);
  return back();
}

async function levelForm(p, t, back) {
  const r = await showForm(p, new ModalFormData().title(`§lLevel — ${t.name}`)
    .textField(`§7${t.name} is level §f${getLevel(t)}§7.\nNew level §8(1–${MAX_LEVEL}; their stats are reset and every point refunded)`, String(getLevel(t)), String(getLevel(t))));
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const n = num(r.formValues[0]);
  if (!(n >= 1)) {
    p.sendMessage("§cThat's not a level.");
    return back();
  }
  const lvl = Math.min(MAX_LEVEL, n);
  setLevel(t, lvl);
  t.sendMessage(`§eYour level was set to §f${lvl}§e by the server — your stat points are refunded (Shinobi Record → Stats).`);
  p.sendMessage(`§7${t.name} is now level §f${lvl}§7.`);
  adminLog(p, `set ${t.name}'s level to ${lvl}`);
  return back();
}

async function shardsForm(p, t, back) {
  const r = await showForm(p, new ModalFormData().title(`§lXP Shards — ${t.name}`)
    .slider("§7How many? §8(each is worth a third of a level)", 1, 64, 1, 1));
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const n = Math.max(1, Math.min(64, Math.floor(Number(r.formValues[0]) || 1)));
  giveShards(t, n);
  t.sendMessage(`§b+${n} XP Shard${n === 1 ? "" : "s"}§7 from the server.`);
  adminLog(p, `gave ${t.name} ${n} XP Shard${n === 1 ? "" : "s"}`);
  return back();
}

function heal(t) {
  try {
    t.getComponent("minecraft:health")?.resetToMaxValue();
  } catch {
    /* ignore */
  }
  try {
    api?.setChakra(t, 1e9); // (clamped to their max)
  } catch {
    /* ignore */
  }
  for (const id of ["poison", "wither", "slowness", "weakness", "blindness", "nausea", "mining_fatigue", "darkness"]) {
    try {
      t.removeEffect(id);
    } catch {
      /* ignore */
    }
  }
}

async function teleportMenu(p, t, back) {
  const self = t.id === p.id;
  const f = new ActionFormData().title(`§lTeleport — ${t.name}`).body("§7Where to?");
  const opts = [];
  if (!self) {
    opts.push([`§bGo to ${t.name}`, () => {
      p.teleport(t.location, { dimension: t.dimension });
      adminLog(p, `teleported to ${t.name}`);
    }]);
    opts.push([`§bBring ${t.name} here`, () => {
      t.teleport(p.location, { dimension: p.dimension });
      t.sendMessage("§7You were teleported by the server.");
      adminLog(p, `brought ${t.name} to them`);
    }]);
  }
  for (const v of VIL()) {
    opts.push([`${VILLAGES[v].color}${self ? "Go" : "Send them"} to the ${VILLAGES[v].name}\n§r§8${VILLAGES[v].pos.x}, ${VILLAGES[v].pos.y}, ${VILLAGES[v].pos.z}`, () => {
      t.teleport({ x: VILLAGES[v].pos.x + 0.5, y: VILLAGES[v].pos.y, z: VILLAGES[v].pos.z + 0.5 }, { dimension: world.getDimension("overworld") });
      if (!self) t.sendMessage(`§7You were sent to the ${VILLAGES[v].color}${VILLAGES[v].name}§7 by the server.`);
      adminLog(p, `sent ${self ? "themself" : t.name} to the ${strip(VILLAGES[v].name)}`);
    }]);
  }
  for (const [label] of opts) f.button(label);
  f.button("§l« Back");
  const r = await showForm(p, f);
  if (r.canceled || r.selection === undefined) return;
  if (!opts[r.selection]) return back();
  if (!alive(t)) return playersMenu(p);
  try {
    opts[r.selection][1]();
  } catch {
    p.sendMessage("§cCouldn't teleport there.");
  }
}

async function clanForm(p, t, back) {
  const ids = Object.keys(CLANS);
  const cur = getClanId(t);
  const r = await showForm(p, new ModalFormData().title(`§lClan — ${t.name}`)
    .dropdown(`§7${t.name}'s clan: ${CLANS[cur] ? `${CLANS[cur].color}${CLANS[cur].name}` : "§8none"}§7.\nSet it to §8(a new clan starts its Mangekyō and mastery from scratch)`,
      ids.map((id) => `${CLANS[id].name} (${CLANS[id].rarity})`), Math.max(0, ids.indexOf(cur))));
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const id = ids[r.formValues[0]];
  if (id && id !== cur) {
    setClan(t, id);
    t.sendMessage(`§7The server set your clan to ${CLANS[id].color}${CLANS[id].name}§7.`);
    adminLog(p, `set ${t.name}'s clan to ${CLANS[id].name}`);
  }
  return back();
}

// A shinobi holds ONE title of legend at a time (v1.62): pick it, or None.
async function titlesForm(p, t, back) {
  const label = (id) => {
    const reqs = TITLES[id].reqs;
    const checks = reqs.filter(([, c]) => c);
    let met = 0;
    for (const [, c] of checks) {
      try {
        if (c(t)) met++;
      } catch {
        /* ignore */
      }
    }
    const judged = reqs.length - checks.length;
    return `${strip(TITLES[id].name)} (${met}/${checks.length} met${judged ? `, +${judged} to judge` : ""})`;
  };
  const held = TITLE_IDS.find((id) => hasTitle(t, id));
  const f = new ModalFormData().title(`§lTitle of legend — ${t.name}`)
    .dropdown("§7A shinobi holds one title of legend at a time.\n§fTitle", ["None", ...TITLE_IDS.map(label)], held ? 1 + TITLE_IDS.indexOf(held) : 0);
  const r = await showForm(p, f);
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const want = TITLE_IDS[Number(r.formValues[0]) - 1]; // undefined = None
  for (const id of TITLE_IDS) {
    if (id === want || !hasTitle(t, id)) continue;
    t.removeTag(id);
    adminLog(p, `took the ${strip(TITLES[id].name)} title from ${t.name}`);
  }
  if (want && !hasTitle(t, want)) {
    t.addTag(want);
    adminLog(p, `granted the ${strip(TITLES[want].name)} title to ${t.name}`);
  }
  return back();
}

const KAGES = () => Object.keys(KAGE_VILLAGES);
const SANNIN = () => Object.keys(SANNIN_SETS);
async function kageForm(p, t, back) {
  const kage = getKage(t);
  const sannin = isSannin(t) ? (sanninOf(t) && SANNIN_SETS[sanninOf(t)] ? 2 + SANNIN().indexOf(sanninOf(t)) : 1) : 0;
  const r = await showForm(p, new ModalFormData().title(`§lKage & Sannin — ${t.name}`)
    .dropdown("Kage title", ["None", ...KAGES().map((k) => `${strip(KAGE_VILLAGES[k].title)} (${KAGE_VILLAGES[k].village})`)], kage ? 1 + KAGES().indexOf(kage) : 0)
    .toggle("Give the Kage's full set when appointing", true)
    .dropdown("Legendary Sannin", ["No", "Title only", ...SANNIN().map((s) => `${strip(SANNIN_SETS[s])}'s legacy (title + set)`)], sannin));
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const [k, withSet, s] = r.formValues;
  const newKage = k > 0 ? KAGES()[k - 1] : undefined;
  if (newKage !== kage) {
    if (!newKage) {
      setKage(t, undefined);
      t.sendMessage("§7Your Kage title was removed by the server.");
      adminLog(p, `removed ${t.name}'s Kage title`);
    } else if (withSet) {
      appointKage(t, newKage);
      adminLog(p, `named ${t.name} the ${strip(KAGE_VILLAGES[newKage].title)} (with the set)`);
    } else {
      setKage(t, newKage);
      world.sendMessage(`§e${t.name} has been named the ${KAGE_VILLAGES[newKage].title}§e of the ${KAGE_VILLAGES[newKage].village}!`);
      adminLog(p, `named ${t.name} the ${strip(KAGE_VILLAGES[newKage].title)}`);
    }
  }
  if (s !== sannin) {
    if (s === 0) {
      clearSannin(t);
      t.sendMessage("§7Your Sannin title was removed by the server.");
      adminLog(p, `removed ${t.name}'s Sannin title`);
    } else if (s === 1 && isSannin(t)) {
      t.setDynamicProperty("aegis:sannin_of", undefined); // (keeps the title, drops the legacy)
      adminLog(p, `made ${t.name}'s Sannin title a plain one`);
    } else {
      if (isSannin(t)) clearSannin(t); // (switching legacy: the new one's set is given)
      nameSannin(t, s >= 2 ? SANNIN()[s - 2] : undefined);
      adminLog(p, `named ${t.name} a Legendary Sannin${s >= 2 ? ` (${strip(SANNIN_SETS[SANNIN()[s - 2]])})` : ""}`);
    }
  }
  return back();
}

async function bountyForm(p, t, back) {
  const r = await showForm(p, new ModalFormData().title(`§lBounty — ${t.name}`)
    .textField(`§7Bounty on ${t.name}: ${bountyOf(t) ? `§6${fmtRyo(bountyOf(t))}` : "§8none"}§7.\nSet it to §8(0 clears it; 100,000+ shows [Wanted])`, "0", String(bountyOf(t))));
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const n = num(r.formValues[0]);
  if (!(n >= 0)) {
    p.sendMessage("§cThat's not an amount of Ryō.");
    return back();
  }
  setBounty(t, n);
  p.sendMessage(n ? `§7The bounty on ${t.name} is now §6${fmtRyo(n)}§7.` : `§7The bounty on ${t.name} was cleared.`);
  adminLog(p, n ? `set the bounty on ${t.name} to ${fmtRyo(n)}` : `cleared the bounty on ${t.name}`);
  return back();
}

async function factionForm(p, t, back) {
  const f = factionOf(t);
  if (!f) return back();
  const c = await showForm(p, new MessageFormData().title(`Remove ${t.name}?`)
    .body(`§7${t.name} leaves the ${FACTIONS[f].name}§7 — their standing and contract are lost. They can join again if they still qualify.`)
    .button1("§cRemove").button2("Cancel"));
  if (c.selection === 0 && alive(t) && leaveFaction(t, true)) {
    t.sendMessage(`§7You were removed from the ${FACTIONS[f].name}§7 by the server.`);
    adminLog(p, `removed ${t.name} from the ${strip(FACTIONS[f].name)}`);
  }
  return back();
}

async function villageForm(p, t, back) {
  const c = await showForm(p, new MessageFormData().title("Choose a village again?")
    .body(`§7${t.name} gets the village choice screen: they pick a village and are sent there.${isRogue(t) ? " §fThis lets a rogue ninja back in." : ""}\n§8(Their honor, level and items stay.)`)
    .button1("§aSend the choice").button2("Cancel"));
  if (c.selection === 0 && alive(t)) {
    askVillage(t, true);
    if (t.id !== p.id) p.sendMessage(`§7${t.name} is choosing a village.`);
    adminLog(p, `let ${t.name} choose a village again`);
    if (t.id === p.id) return; // (their own choice screen opens now)
  }
  return back();
}

async function playerGraceForm(p, t, back) {
  const r = await showForm(p, new ModalFormData().title(`§lGrace — ${t.name}`)
    .textField(`§7${t.name}: ${graceLeftText(t) ? `§a${graceLeftText(t)} left` : "§8no grace"}§7.\nMinutes of grace §8(0 ends theirs)`, "10", "10"));
  if (r.canceled || !r.formValues || !alive(t)) return back();
  const m = num(r.formValues[0]);
  if (!(m >= 0)) {
    p.sendMessage("§cThat's not a number of minutes.");
    return back();
  }
  if (m === 0) {
    stopGrace(t, p);
    adminLog(p, `ended ${t.name}'s grace`);
  } else {
    startGrace(Math.min(GRACE_MAX_MINUTES, m), t, p);
    adminLog(p, `gave ${t.name} ${Math.min(GRACE_MAX_MINUTES, m)} minutes of grace`);
  }
  return back();
}

// ---------------------------------------------------------------------------
// Server settings, lag, log
// ---------------------------------------------------------------------------
const SETTINGS = () => [
  ["Ban vanilla weapons, armour, redstone and bundles", vanillaBanned, (on) => setVanillaBan(on)],
  ["Automatic lag clear §8(dropped items every 5 min, hostile mobs after 20 min)", lagClearOn, (on) => setLagClear(on)],
  ["Friendly fire between village-mates", friendlyFire, (on) => setFriendlyFire(on)],
  ["Automatic world events §8(one every hour while 2+ players are online)", autoEvents, (on, p) => p.sendMessage(setAutoEvents(on))],
  // v1.62: the bounty & honor tracker's boards
  ...Object.entries(TRACKERS).map(([id, label]) => [label, () => trackerOn(id), (on) => setTracker(id, on)]),
];

async function serverSettings(p) {
  const f = new ModalFormData().title("§lServer Settings");
  const rows = SETTINGS();
  for (const [label, get] of rows) f.toggle(label, !!get());
  f.slider("§fPlayers' melee damage§7 — % (100 = normal: since v1.60 it grows +1.5% per level, ×5.5 at level 300). Punches, blades\n" +
    "and what rides on them; jutsu aren't affected.", MELEE_RANGE[0], MELEE_RANGE[1], 5, meleePercent());
  f.slider("§fHonor / bounty per player kill§7 — a village shinobi who defeats a wanted player or a rogue earns it as honor;\n" +
    "every other kill puts it on the killer's head as a bounty.", KILL_REWARD_RANGE[0], KILL_REWARD_RANGE[1], 5000, killReward());
  const r = await showForm(p, f);
  if (!r.canceled && r.formValues) {
    rows.forEach(([label, get, set], i) => {
      const on = !!r.formValues[i];
      if (on === !!get()) return;
      set(on, p);
      adminLog(p, `switched "${strip(label).replace(/ \(.*\)$/, "")}" ${on ? "on" : "off"}`);
    });
    const melee = Math.round(Number(r.formValues[rows.length]));
    if (Number.isFinite(melee) && melee !== meleePercent()) adminLog(p, `set players' melee damage to ${setMeleePercent(melee)}%`);
    const perKill = Math.round(Number(r.formValues[rows.length + 1]));
    if (Number.isFinite(perKill) && perKill !== killReward()) adminLog(p, `set every player kill to be worth ${setKillReward(perKill).toLocaleString("en-US")} honor or bounty`);
  }
  return adminMenu(p);
}

// The economy: how expensive everything is, and how much Ryō quests pay (currency.js).
async function economyPage(p) {
  const r = await showForm(p, new ModalFormData().title("§lEconomy")
    .slider(`§fPrices§7 — % of the v1.57 prices (100 = as they were, 200 = twice as expensive). Shops, the merchant, training,
` +
      `repairs, hiring genin, fast travel.
§8Now: Kusanagi ${fmtRyo(price(4000))} · Ichiraku Ramen ${fmtRyo(price(300))} · a genin ${fmtRyo(price(1500))}`,
      PRICE_RANGE[0], PRICE_RANGE[1], 25, pricePercent())
    .slider(`§fQuest Ryō§7 — % of what quests paid in v1.57 (50 = half). Quest Board quests, starter and village quests, Kage
` +
      `missions, daily missions, story chapters, faction contracts.
§8Now: Rogue Patrol ${fmtRyo(questRyo(1000))} · story chapter 12 ${fmtRyo(questRyo(100000))}`,
      QUEST_RANGE[0], QUEST_RANGE[1], 10, questPercent())
    .toggle(`Back to the defaults (prices ${DEFAULT_PRICES}%, quests ${DEFAULT_QUESTS}%)`, false));
  if (r.canceled || !r.formValues) return adminMenu(p);
  const [prices, quests, reset] = r.formValues;
  if (reset) {
    setEconomy({ prices: DEFAULT_PRICES, quests: DEFAULT_QUESTS });
    adminLog(p, `reset the economy to prices ${DEFAULT_PRICES}%, quests ${DEFAULT_QUESTS}%`);
  } else if (Math.round(prices) !== pricePercent() || Math.round(quests) !== questPercent()) {
    setEconomy({ prices, quests });
    adminLog(p, `set the economy to prices ${pricePercent()}%, quests ${questPercent()}%`);
  }
  return adminMenu(p);
}

async function lagMenu(p) {
  const f = new ActionFormData().title("§lClear Lag Now")
    .body(`§7Automatic clears: ${lagClearOn() ? `§aon§7 — next item clear in ${nextItemClear()}` : "§coff"}.\n§7Never touched: players, pets and tamed or name-tagged mobs, villagers, shop NPCs, companions, summons, a legend waiting for a challenger, and anything fighting right now.`)
    .button("§bClear dropped items")
    .button("§cClear every hostile mob\n§r§8ninja, bosses, Tailed Beasts, monsters — any age")
    .button("§l« Back");
  const r = await showForm(p, f);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection === 0) adminLog(p, `cleared ${clearItems()} dropped items`);
  else if (r.selection === 1) adminLog(p, `cleared ${clearMobs(true)} hostile mobs`);
  else return adminMenu(p);
  return lagMenu(p);
}

async function logPage(p) {
  const l = readLog();
  const f = new ActionFormData().title("§lAdmin Log")
    .body(l.length ? l.map(([t, who, what]) => `§8${ago(t)}§7 · §f${who}§7 ${what}`).join("\n") : "§7Nothing yet.")
    .button("§l« Back");
  const r = await showForm(p, f);
  if (r.canceled) return;
  return adminMenu(p);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function initAdmin(helpers) {
  api = helpers;
  system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: p }) => {
    if (id !== "aegis:admin") return;
    if (p?.typeId !== "minecraft:player") return void world.sendMessage("§7The Admin Panel opens for a player: run §f/scriptevent aegis:admin§7 yourself.");
    adminMenu(p);
  });
}
