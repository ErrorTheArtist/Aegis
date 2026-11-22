// The Bingo Book (v1.55) — bounties on players, and a record of who each shinobi has defeated.
//   Shinobi Record → Bingo Book: the most wanted shinobi, your own bounty, place a bounty, your PvP record.
//   • Place a bounty: pick an online player and pay at least 1,000 Ryō — it's added to the price on their head
//     (anonymously, like a real bounty).
//   • Claim it: defeat the wanted player (your clone, companion or summon counts) and the whole bounty is paid to you.
//   • v1.62: every player kill is worth 50,000 (the admins can change it: Admin Panel → Server Settings) —
//       HONOR for justice: a village shinobi who defeats a wanted player or a rogue ninja;
//       BOUNTY for anything else: a rogue's kills, or a village shinobi cutting down someone who wasn't wanted.
//     (Before v1.62 a killer's bounty grew by 1,000 Ryō + 50 per level of the victim.)
//   • A bounty of 100,000 Ryō or more shows [Wanted] over your name.
//   • Your PvP record counts the players you've defeated and the bounties you've claimed, and remembers if you've ever
//     defeated a Kage, the Toad Sage, or a feared and respected Jōnin (Jōnin rank and 10,000+ honor) — the titles in the
//     Shinobi Record check these, and the bounty amounts.
//   /scriptevent aegis:bounty                     — the ten most wanted
//   /scriptevent aegis:bounty set <player> <ryo>  — set a player's bounty (admins)
//   /scriptevent aegis:bounty clear <player>      — clear it

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getRyo, addRyo, spendRyo, fmtRyo } from "./currency.js";
import { getRank } from "./levels.js";
import { isWarKill } from "./war.js";
import { isRogue, getHonor, getVillage, addHonor } from "./villages.js";
import { getKage, sanninOf } from "./armor.js";
import { anbuBountyBonus, factionProgress } from "./factions.js";

const BOOK = "aegis:bingo"; // world: { [player id]: { n: name, b: bounty } }
const RECORD = "aegis:pvp"; // player: { kills, claimed, kage, toad, jonin }
export const MIN_BOUNTY = 1000;
export const WANTED_AT = 100000;
const FEARED_HONOR = 10000;
// v1.62: what one player kill is worth, in honor or in bounty
const KILL_PROP = "aegis:kill_reward";
export const KILL_REWARD_DEFAULT = 50000;
export const KILL_REWARD_RANGE = [0, 500000];
export function killReward() {
  try {
    const v = world.getDynamicProperty(KILL_PROP);
    return typeof v === "number" && Number.isFinite(v) ? Math.max(KILL_REWARD_RANGE[0], Math.min(KILL_REWARD_RANGE[1], v)) : KILL_REWARD_DEFAULT;
  } catch {
    return KILL_REWARD_DEFAULT;
  }
}
export function setKillReward(n) {
  const v = Math.max(KILL_REWARD_RANGE[0], Math.min(KILL_REWARD_RANGE[1], Math.round(Number(n) || 0)));
  world.setDynamicProperty(KILL_PROP, v === KILL_REWARD_DEFAULT ? undefined : v);
  world.sendMessage(`§6Bingo Book:§7 every player kill is now worth §f${v.toLocaleString("en-US")}§7 honor or bounty.`);
  return v;
}
// Does defeating `victim` earn `killer` honor (justice) rather than a bounty?
export const isJustice = (killer, victim) => !!getVillage(killer) && !isRogue(killer) && (bountyOf(victim) > 0 || isRogue(victim));

let api;

function readBook() {
  try {
    return JSON.parse(world.getDynamicProperty(BOOK) ?? "{}");
  } catch {
    return {};
  }
}
function writeBook(book) {
  for (const [id, e] of Object.entries(book)) if (!e?.b) delete book[id];
  world.setDynamicProperty(BOOK, JSON.stringify(book));
}

export const bountyOf = (p) => (p ? readBook()[p.id]?.b ?? 0 : 0);
export const wantedTag = (p) => (bountyOf(p) >= WANTED_AT ? "§4[Wanted]§r " : "");

export function addBounty(p, n) {
  const book = readBook();
  const e = book[p.id] ?? { n: p.name, b: 0 };
  e.n = p.name;
  e.b = Math.max(0, Math.round(e.b + n));
  book[p.id] = e;
  writeBook(book);
  api?.refreshName?.(p);
  return e.b;
}

export function setBounty(p, n) {
  const book = readBook();
  book[p.id] = { n: p.name, b: Math.max(0, Math.round(n)) };
  writeBook(book);
  api?.refreshName?.(p);
}

export function pvpRecord(p) {
  try {
    return JSON.parse(p.getDynamicProperty(RECORD) ?? "{}");
  } catch {
    return {};
  }
}

export const mostWanted = (n = 10) =>
  Object.entries(readBook()).filter(([, e]) => e.b > 0).sort((a, b) => b[1].b - a[1].b).slice(0, n).map(([id, e]) => ({ id, name: e.n, bounty: e.b }));

// The player behind a kill: the player, or the owner of the clone / companion / summon that landed it.
function killerOf(damageSource) {
  let k = damageSource?.damagingEntity;
  if (k && k.typeId !== "minecraft:player") {
    try {
      const owner = k.getDynamicProperty("aegis:owner");
      k = owner ? world.getEntity(owner) : undefined;
    } catch {
      k = undefined;
    }
  }
  return k?.typeId === "minecraft:player" ? k : undefined;
}

// A player defeated another: the record, the bounty on the victim (claimed), and 50,000 honor or bounty for the killer.
export function onPlayerKill(killer, victim) {
  const rec = pvpRecord(killer);
  rec.kills = (rec.kills ?? 0) + 1;
  if (getKage(victim)) rec.kage = true;
  if (sanninOf(victim) === "jiraiya") rec.toad = true;
  if (getRank(victim) >= 2 && getHonor(victim) >= FEARED_HONOR) rec.jonin = true;
  if (isWarKill(killer, victim)) {
    // (v1.64) the Great Shinobi War: a kill there is war — merit (war.js), never bounty, honor or a claimed bounty
    killer.setDynamicProperty(RECORD, JSON.stringify(rec));
    return { war: true };
  }
  const justice = isJustice(killer, victim); // (decided before the victim's bounty is claimed)
  const out = claim(killer, victim, rec);
  const reward = killReward();
  if (reward > 0) {
    if (justice) {
      addHonor(killer, reward);
      out.honor = reward;
      killer.sendMessage(`§e+${reward.toLocaleString("en-US")} honor §7— you brought down ${isRogue(victim) ? "a rogue ninja" : "a wanted shinobi"}. §8(honor: ${getHonor(killer).toLocaleString("en-US")})`);
      killer.onScreenDisplay?.setActionBar(`§e+${reward.toLocaleString("en-US")} honor`);
    } else {
      const now = addBounty(killer, reward);
      out.earned = reward;
      killer.sendMessage(`§c+${fmtRyo(reward)} on your head §7— the Bingo Book now lists you at §6${fmtRyo(now)}§7.`);
      killer.onScreenDisplay?.setActionBar(`§c+${fmtRyo(reward)} bounty`);
    }
  }
  return out;
}

// The victim's bounty, if any, goes to the killer.
function claim(killer, victim, rec) {
  const wanted = bountyOf(victim);
  if (wanted > 0) {
    rec.claimed = (rec.claimed ?? 0) + 1;
    rec.earned = (rec.earned ?? 0) + wanted;
    killer.setDynamicProperty(RECORD, JSON.stringify(rec));
    setBounty(victim, 0);
    addRyo(killer, wanted, true);
    world.sendMessage(`§6${killer.name}§e claimed the §6${fmtRyo(wanted)}§e bounty on §c${victim.name}§e!`);
    killer.onScreenDisplay?.setActionBar(`§6Bounty claimed: +${fmtRyo(wanted)}`);
    const extra = anbuBountyBonus(killer, victim, wanted); // (v1.56) the village pays its Anbu half again for a rogue
    if (extra) {
      addRyo(killer, extra, true);
      killer.sendMessage(`§8[Anbu]§7 The village adds §6${fmtRyo(extra)}§7 for bringing a missing-nin to justice.`);
    }
    factionProgress(killer, "bounty");
    return { claimed: wanted + extra };
  }
  killer.setDynamicProperty(RECORD, JSON.stringify(rec));
  return {};
}

// ---------------------------------------------------------------------------
// The Bingo Book page (Shinobi Record → Bingo Book)
// ---------------------------------------------------------------------------
export async function bingoBook(player, back) {
  const top = mostWanted(10);
  const rec = pvpRecord(player);
  const mine = bountyOf(player);
  const body = [
    `§7Your bounty: ${mine ? `§6${fmtRyo(mine)}` : "§anone"}`,
    `§7Players defeated: §f${rec.kills ?? 0}§7 · bounties claimed: §f${rec.claimed ?? 0}§7 (${fmtRyo(rec.earned ?? 0)})`,
    "",
    "§c§lMost wanted§r",
    ...(top.length ? top.map((e, i) => `§7${i + 1}. §f${e.name}  §6${fmtRyo(e.bounty)}`) : ["§8Nobody — the Bingo Book is empty."]),
  ].join("\n");
  const r = await new ActionFormData()
    .title("§l§cBingo Book")
    .body(body)
    .button("§6Place a bounty\n§r§7put a price on someone's head")
    .button("§ePvP record\n§r§7who you've defeated")
    .button("§l« Back")
    .show(player);
  if (r.canceled) return;
  if (r.selection === 0) return placeBounty(player, () => bingoBook(player, back));
  if (r.selection === 1) return recordPage(player, () => bingoBook(player, back));
  return back?.();
}

async function placeBounty(player, back) {
  const others = world.getAllPlayers().filter((p) => p.id !== player.id);
  if (!others.length) {
    player.sendMessage("§7Nobody else is online to put a bounty on.");
    return back?.();
  }
  const have = getRyo(player);
  if (have < MIN_BOUNTY) {
    player.sendMessage(`§cA bounty is at least ${fmtRyo(MIN_BOUNTY)} §7(you have ${fmtRyo(have)}).`);
    return back?.();
  }
  const r = await new ModalFormData()
    .title("§lPlace a bounty")
    .dropdown("Who?", others.map((p) => `${p.name}${bountyOf(p) ? ` §6(${fmtRyo(bountyOf(p))})` : ""}`), 0)
    .textField(`How much? §7(at least ${fmtRyo(MIN_BOUNTY)}; you have ${fmtRyo(have)})`, "5000", String(MIN_BOUNTY))
    .show(player);
  if (r.canceled || !r.formValues) return back?.();
  const target = others[Number(r.formValues[0])];
  const amount = Math.floor(Number(String(r.formValues[1] ?? "").replace(/[^0-9]/g, "")));
  if (!target || !Number.isFinite(amount) || amount < MIN_BOUNTY) {
    player.sendMessage(`§cA bounty is at least ${fmtRyo(MIN_BOUNTY)}.`);
    return back?.();
  }
  if (!spendRyo(player, amount)) {
    player.sendMessage(`§cYou don't have ${fmtRyo(amount)}.`);
    return back?.();
  }
  const total = addBounty(target, amount);
  world.sendMessage(`§cWANTED: §f${target.name}§7 — §6${fmtRyo(amount)}§7 has been put on their head §8(bounty now ${fmtRyo(total)})§7.`);
  player.sendMessage("§7Your bounty is placed. Nobody will know it was you.");
  return back?.();
}

async function recordPage(player, back) {
  const rec = pvpRecord(player);
  const tick = (v) => (v ? "§a✔" : "§8✘");
  await new ActionFormData()
    .title("§lPvP record")
    .body([
      `§7Players defeated: §f${rec.kills ?? 0}`,
      `§7Bounties claimed: §f${rec.claimed ?? 0}§7 — §6${fmtRyo(rec.earned ?? 0)}`,
      "",
      `${tick(rec.kage)} §7Defeated a Kage`,
      `${tick(rec.toad)} §7Defeated the Toad Sage`,
      `${tick(rec.jonin)} §7Defeated a feared and respected Jōnin §8(Jōnin rank, ${FEARED_HONOR.toLocaleString("en-US")}+ honor)`,
    ].join("\n"))
    .button("§l« Back")
    .show(player);
  return back?.();
}

function findPlayer(name) {
  const n = String(name ?? "").toLowerCase();
  if (!n) return undefined;
  const all = world.getAllPlayers();
  return all.find((p) => p.name.toLowerCase() === n) ?? all.find((p) => p.name.toLowerCase().startsWith(n));
}

export function initBounty(helpers) {
  api = helpers;
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (deadEntity?.typeId !== "minecraft:player") return;
    const killer = killerOf(damageSource);
    if (!killer || killer.id === deadEntity.id) return;
    try {
      onPlayerKill(killer, deadEntity);
    } catch {
      /* ignore */
    }
  });
  // keep names in the book current (a player who renamed)
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;
    const book = readBook();
    if (book[player.id] && book[player.id].n !== player.name) {
      book[player.id].n = player.name;
      writeBook(book);
    }
  });
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: by }) => {
    if (id !== "aegis:bounty") return;
    const tell = (t) => (by?.typeId === "minecraft:player" ? by.sendMessage(t) : world.sendMessage(t));
    const [cmd, name, amount] = String(message ?? "").trim().split(/\s+/);
    // (v1.62) what every player kill is worth — also Admin Panel → Server Settings
    if (cmd === "reward") {
      if (name !== undefined && name !== "") setKillReward(name);
      return tell(`§7Every player kill is worth §f${killReward().toLocaleString("en-US")}§7 honor or bounty §8(0 = off; default ${KILL_REWARD_DEFAULT.toLocaleString("en-US")})§7.`);
    }
    if (cmd === "set" || cmd === "clear") {
      const p = findPlayer(name);
      if (!p) return tell(`§7No online player called "${name ?? ""}".`);
      setBounty(p, cmd === "clear" ? 0 : Math.max(0, Math.floor(Number(amount) || 0)));
      return tell(`§7${p.name}'s bounty is now §6${fmtRyo(bountyOf(p))}§7.`);
    }
    const top = mostWanted(10);
    tell(top.length ? `§c§lMost wanted:§r ${top.map((e) => `§f${e.name} §6${fmtRyo(e.bounty)}`).join("§7, ")}` : "§7The Bingo Book is empty.");
  });
}
