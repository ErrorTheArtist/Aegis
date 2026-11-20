// Shinobi levels (1–300, v1.54) and stat points.
//
// XP: kills (scaled by the victim's max health — Tailed Beasts give a lot), player kills,
// and casting jutsu / clan abilities / sword specials.
// Every level gives 3 stat points (+3 bonus at level 300 = 900 total = every stat maxed at 150).
// v1.54: your level also raises your max HP (about 1,044 at level 300 with full Vitality — Bedrock's limit) and the
// damage of everything you do (×1 at level 1, ×10 at level 300), so jutsu keep their bite as health grows. Bosses hit
// higher-level shinobi harder too. Out of a fight you heal 1% of your max HP a second.
// Spend them in the Shinobi Record (item) or with /scriptevent aegis:stats.
//
// Commands (cheats on):
//   /scriptevent aegis:stats              — open the stat menu
//   /scriptevent aegis:level set 50       — set your level (points are recalculated)
//   /scriptevent aegis:level xp 5000      — add XP

import { bingoBook, bountyOf } from "./bounty.js";
import { CLANS, getClanId } from "./clans.js";
import { FACTIONS, factionOf, factionRank, factionMenu } from "./factions.js";
import { storyMenu, storyLine } from "./story.js";
import { handbookMenu } from "./handbook.js";
import { settingsMenu } from "./settings.js";
import { achievementsMenu, unlocked, ACH } from "./achievements.js";
import { dailyMenu, dailyState } from "./dailies.js";
import { eventXpMultiplier } from "./events.js";
import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { applyNameTag, refreshClanEffects } from "./clans.js";
import { getRyo, fmtRyo, walletMenu } from "./currency.js";
import { getVillage, villageLabel, villageMenu, villageCooldownMultiplier, isRogue, rogueOf, getHonor } from "./villages.js";
import { starterLine } from "./starter.js";
import { titleHpLevels, titlesMenu, titlesOf, TITLES } from "./titles.js";
import { adminMenu, ADMIN_TAG } from "./admin.js";
import { showForm } from "./ui.js";

export const MAX_LEVEL = 300;
const POINTS_PER_LEVEL = 3;
export const STAT_CAP = 150;
const RECORD_ITEM = "aegis:shinobi_record";
// The last hotbar slot belongs to the Shinobi Record (Bedrock add-ons can't add a slot to the inventory, so one is
// reserved): the Record is locked in it — it can't be moved, dropped, stored or thrown away — and kept on death. If it
// ever goes missing (/clear, a creative inventory wipe…) it's put back within 2 seconds.
export const RECORD_SLOT = 8;

const P = { level: "aegis:level", xp: "aegis:xp", points: "aegis:points", slot: "aegis:record_slot" };

export const STATS = {
  vitality: { name: "Vitality", color: "§c", desc: "+4 max HP every 3 points (on top of the HP your level gives)" },
  chakra: { name: "Chakra", color: "§b", desc: "+2 max chakra and +0.5% chakra regen per point" },
  taijutsu: { name: "Taijutsu", color: "§6", desc: "Strength (+3 melee damage) every 50 points (up to Strength III), and +1% damage for punch combos and taijutsu scrolls per point" },
  ninjutsu: { name: "Ninjutsu", color: "§d", desc: "+1% damage for jutsu, clan abilities and sword specials per point" },
  agility: { name: "Agility", color: "§a", desc: "Speed every 25 points (up to Speed IV), and -0.25% jutsu cooldowns per point" },
  endurance: { name: "Endurance", color: "§7", desc: "Shrug off 0.2% of all damage taken per point (up to 30%)" },
};

let api;
const lastHurt = new Map(); // player id -> tick they were last hurt

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const num = (player, key, def = 0) => {
  try {
    const v = player.getDynamicProperty(key);
    return typeof v === "number" ? v : def;
  } catch {
    return def;
  }
};
const set = (player, key, v) => {
  try {
    player.setDynamicProperty(key, v);
  } catch {
    /* ignore */
  }
};

export const RANKS = ["Genin", "Chūnin", "Jōnin"]; // exams stop at Jōnin; Sannin and Kage are titles given by server admins
export const getRank = (player) => Math.max(0, Math.min(RANKS.length - 1, num(player, "aegis:rank", 0)));
export const setRank = (player, r) => set(player, "aegis:rank", r);
export const addPoints = (player, n) => set(player, P.points, num(player, P.points, 0) + n);

export const getLevel = (player) => Math.max(1, Math.min(MAX_LEVEL, num(player, P.level, 1)));
export const getStat = (player, id) => num(player, `aegis:stat_${id}`, 0);
const setStat = (player, id, v) => set(player, `aegis:stat_${id}`, v);
const getPoints = (player) => num(player, P.points, 0);

// XP needed to go from `level` to `level + 1`.
// v1.54: a little steeper than before (≈20% more per level), and on to level 300.
export function xpToNext(level) {
  return Math.round(50 + 15 * level + 0.3 * level * level);
}

// Health boost levels (4 HP each) from level and Vitality; Bedrock allows 256 at most (1,044 HP).
export const HP_LEVEL_CAP = 256;
export const hpLevels = (player) => Math.floor((getLevel(player) - 1) * 0.69) + Math.floor(getStat(player, "vitality") / 3);
// Everything a shinobi does hits harder as they level: ×1 at level 1 → ×9.97 at level 300.
export const levelDamageFactor = (player) => (player?.typeId === "minecraft:player" ? 1 + (getLevel(player) - 1) * 0.03 : 1);
// v1.60: melee — punches, blades and what rides on them (Gentle Fist, Lightning Armour, Tailed Beast Mode's punches) —
// grows half as fast as jutsu: +1.5% per level (×5.49 at 300 instead of ×9.97). The server's admins can scale it further
// (Admin Panel → Server Settings, or /scriptevent aegis:melee <percent>).
export const MELEE_PER_LEVEL = 0.015;
const MELEE_PROP = "aegis:melee_pct";
export const MELEE_RANGE = [25, 200];
export function meleePercent() {
  try {
    const v = world.getDynamicProperty(MELEE_PROP);
    return typeof v === "number" && Number.isFinite(v) ? Math.max(MELEE_RANGE[0], Math.min(MELEE_RANGE[1], v)) : 100;
  } catch {
    return 100;
  }
}
export function setMeleePercent(n) {
  const v = Math.max(MELEE_RANGE[0], Math.min(MELEE_RANGE[1], Math.round(Number(n) || 100)));
  world.setDynamicProperty(MELEE_PROP, v === 100 ? undefined : v);
  world.sendMessage(`§6Combat:§7 players' melee damage is now §f${v}%§7 of normal.`);
  return v;
}
export const meleeDamageFactor = (player) =>
  player?.typeId === "minecraft:player" ? ((1 + (getLevel(player) - 1) * MELEE_PER_LEVEL) * meleePercent()) / 100 : 1;
// …and the bosses hit higher-level shinobi harder (×1 → ×6.98 at level 300), though HP grows faster.
export const bossDamageFactor = (target) => (target?.typeId === "minecraft:player" ? 1 + (getLevel(target) - 1) * 0.02 : 1);

// For the HUD: XP into the current level, XP needed for the next one, unspent points.
export function xpInfo(player) {
  const level = getLevel(player);
  return { xp: num(player, P.xp, 0), need: level >= MAX_LEVEL ? 0 : xpToNext(level), points: getPoints(player) };
}

function pointsForLevel(level) {
  return (level - 1) * POINTS_PER_LEVEL + (level >= MAX_LEVEL ? 3 : 0);
}

function spentPoints(player) {
  return Object.keys(STATS).reduce((s, id) => s + getStat(player, id), 0);
}

// ---------------------------------------------------------------------------
// Stat effects (used by main.js, clans.js)
// ---------------------------------------------------------------------------
export const levelChakraBonus = (player) => getStat(player, "chakra") * 2;
export const levelRegenMultiplier = (player) => 1 + getStat(player, "chakra") * 0.005;
export const ninjutsuMultiplier = (player) => 1 + getStat(player, "ninjutsu") * 0.01;
export const taijutsuMultiplier = (player) => 1 + getStat(player, "taijutsu") * 0.01;
export const cooldownMultiplier = (player) => (1 - getStat(player, "agility") * 0.0025) * villageCooldownMultiplier(player);

// Extra "levels" of potion-style effects, merged with clan passives in clans.js.
export function statEffectLevels(player) {
  return {
    health_boost: Math.min(HP_LEVEL_CAP, hpLevels(player) + titleHpLevels(player, hpLevels(player))), // 1 level = +4 HP (Naruto's title: +10%)
    strength: Math.floor(getStat(player, "taijutsu") / 50), // v1.60: every 50 points (was 25), so Strength III at most
    speed: Math.floor(Math.min(100, getStat(player, "agility")) / 25),
  };
}

// ---------------------------------------------------------------------------
// XP and levelling
// ---------------------------------------------------------------------------
export function gainXp(player, amount, quiet = false, shared = false) {
  if (!player || player.typeId !== "minecraft:player" || amount <= 0) return;
  let level = getLevel(player);
  if (level >= MAX_LEVEL) return;
  let xp = num(player, P.xp, 0) + Math.round(amount * eventXpMultiplier()); // (a Double XP event, v1.55)
  let ups = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    ups++;
  }
  if (level >= MAX_LEVEL) xp = 0;
  set(player, P.xp, xp);
  if (ups > 0) {
    set(player, P.level, level);
    const gained = pointsForLevel(level) - pointsForLevel(level - ups);
    set(player, P.points, getPoints(player) + gained);
    levelUpFx(player, level, gained);
  } else if (!quiet) {
    player.onScreenDisplay.setActionBar(`§a+${Math.round(amount)} XP §7(${xp}/${xpToNext(level)})`);
  }
}

// Called whenever a jutsu / clan ability / sword special is successfully used.
export function gainJutsuXp(player, cost) {
  gainXp(player, 3 + cost * 0.5, true);
}

// Levelling up is silent: nothing in chat, nothing across the screen — the level and XP bars (and the level in the
// name tag) simply update. The new stat points wait in the Shinobi Record.
function levelUpFx(player) {
  applyNameTag(player);
}

export function setLevel(player, level) {
  level = Math.max(1, Math.min(MAX_LEVEL, level));
  set(player, P.level, level);
  set(player, P.xp, 0);
  for (const id of Object.keys(STATS)) setStat(player, id, 0);
  set(player, P.points, pointsForLevel(level) + [0, 5, 15, 35][getRank(player)]);
  clearStatEffects(player);
  applyNameTag(player);
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function bar(cur, max, n = 20) {
  const f = Math.round((cur / Math.max(1, max)) * n);
  return "§a" + "|".repeat(f) + "§8" + "|".repeat(n - f);
}

// The Shinobi Record (v1.56 redesign): a summary of your shinobi at the top, every page one tap away.
export async function openStats(player) {
  const level = getLevel(player);
  const xp = num(player, P.xp, 0);
  const need = xpToNext(level);
  const points = getPoints(player);
  const clan = CLANS[getClanId(player)];
  const faction = FACTIONS[factionOf(player)];
  const bounty = bountyOf(player);
  const daily = dailyState(player);
  const streak = Number(player.getDynamicProperty("aegis:streak") ?? 0);
  const village = isRogue(player) ? `§cRogue ninja §7(left the ${villageLabel(rogueOf(player))}§7)` : villageLabel(getVillage(player));
  const body = [
    level >= MAX_LEVEL ? "§6MAX LEVEL" : `§7XP ${bar(xp, need)} §f${xp.toLocaleString("en-US")}/${need.toLocaleString("en-US")}`,
    `§7Rank: §f${RANKS[getRank(player)]}§7 · Ryō: §6${fmtRyo(getRyo(player))}§7 · Honor: §e${getHonor(player).toLocaleString("en-US")}`,
    `§7Village: ${village}§7 · Clan: ${clan ? `${clan.color}${clan.name}` : "§8none"}`,
    faction ? `§7Faction: ${faction.name}§7 (${factionRank(player)})` : "",
    `§7Bounty: ${bounty ? `§6${fmtRyo(bounty)}` : "§anone"}§7 · Achievements: §f${unlocked(player).size}/${ACH.length}`,
    `§7Daily: §f${daily.list.filter((m) => m.done).length}/${daily.list.length}${streak ? `§7 · streak §f${streak}` : ""}`,
    storyLine(player),
    starterLine(player),
  ].filter(Boolean).join("\n");
  const pages = [
    [`§eStats\n§r§7${points ? `§a${points} point${points === 1 ? "" : "s"} to spend` : "your six stats"}`, () => statsPage(player)],
    ["§6Story\n§r§7the Path of the Shinobi", () => storyMenu(player, back)],
    ["§aDaily\n§r§7missions · login streak", () => dailyMenu(player, back)],
    [`§6Achievements\n§r§7${unlocked(player).size}/${ACH.length} unlocked`, () => achievementsMenu(player, back)],
    ["§aVillage\n§r§7chat · leaderboard · return home · leave", () => villageMenu(player)],
    [`§8Faction\n§r§7${faction ? faction.name.replace(/§./g, "") : "Akatsuki · Anbu"}`, () => factionMenu(player, back)],
    ["§cBingo Book\n§r§7bounties · most wanted · PvP record", () => bingoBook(player, back)],
    ["§5Titles\n§r§7Pain · Itachi · Tobi · Sasuke · Naruto", () => titlesMenu(player, back)],
    ["§6Ryō Wallet\n§r§7pay players · exchange emeralds", () => walletMenu(player)],
    ["§bHandbook\n§r§7how everything works", () => handbookMenu(player, back)],
    ["§7Settings", () => settingsMenu(player, back)],
  ];
  if (player.hasTag?.(ADMIN_TAG)) pages.push(["§4Admin Panel\n§r§7events · grace · players · server", () => adminMenu(player)]);
  function back() {
    return openStats(player);
  }
  const form = new ActionFormData().title(`§lShinobi Record — Lv. ${level}`).body(body);
  for (const [label] of pages) form.button(label);
  const res = await showForm(player, form);
  if (res.canceled || res.selection === undefined) return;
  return pages[res.selection]?.[1]();
}

// Shinobi Record → Stats: spend your points.
async function statsPage(player) {
  const points = getPoints(player);
  const ids = Object.keys(STATS);
  const form = new ActionFormData()
    .title("§lStats")
    .body([`§7Unspent points: §e${points}`, "", ...ids.map((id) => `${STATS[id].color}${STATS[id].name}§r §f${getStat(player, id)}§7/${STAT_CAP} §8— ${STATS[id].desc}`)].join("\n"));
  for (const id of ids) form.button(`${STATS[id].color}${STATS[id].name}  §r§8${getStat(player, id)}/${STAT_CAP}`);
  form.button("§cReset stats");
  form.button("§l« Back");
  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  if (res.selection === ids.length) return confirmReset(player);
  if (res.selection === ids.length + 1) return openStats(player);
  const id = ids[res.selection];
  const room = Math.min(getPoints(player), STAT_CAP - getStat(player, id));
  if (room <= 0) {
    player.sendMessage(getPoints(player) <= 0 ? "§7No stat points to spend — level up first." : `§7${STATS[id].name} is maxed.`);
    return statsPage(player);
  }
  const m = await new ModalFormData()
    .title(`${STATS[id].name}`)
    .slider(`${STATS[id].desc}\n§7Current: §f${getStat(player, id)}§7 — points to add`, 1, room, 1, Math.min(room, 1))
    .show(player);
  if (!m.canceled && m.formValues) {
    const add = Math.max(0, Math.min(room, Math.floor(Number(m.formValues[0]) || 0)));
    if (add > 0) {
      setStat(player, id, getStat(player, id) + add);
      set(player, P.points, getPoints(player) - add);
      applyStatEffects(player);
      api.sound(player.dimension, "random.orb", player.location, 1, 1.4);
    }
  }
  return statsPage(player);
}

async function confirmReset(player) {
  const r = await new MessageFormData()
    .title("Reset stats?")
    .body(`All ${spentPoints(player)} spent points will be refunded so you can spend them again.`)
    .button1("§cReset")
    .button2("Cancel")
    .show(player);
  if (r.selection === 0) {
    set(player, P.points, getPoints(player) + spentPoints(player));
    for (const id of Object.keys(STATS)) setStat(player, id, 0);
    clearStatEffects(player);
    player.sendMessage("§7Stats reset — your points are back.");
  }
  return statsPage(player);
}

function clearStatEffects(player) {
  for (const id of ["health_boost", "strength", "speed"]) {
    try {
      player.removeEffect(id);
    } catch {
      /* ignore */
    }
  }
  applyStatEffects(player);
}

function applyStatEffects(player) {
  refreshClanEffects(player, true);
  // keep the chakra pool within the (possibly new) max
  api.setChakra(player, api.getChakra(player));
}

function lockedRecord() {
  const stack = new ItemStack(RECORD_ITEM, 1);
  stack.keepOnDeath = true;
  stack.lockMode = ItemLockMode.slot;
  return stack;
}

// Keeps exactly one locked Shinobi Record in RECORD_SLOT. Stray copies (old unlocked ones, one picked up from a chest)
// are removed; whatever the player had in that slot moves into the inventory, or drops at their feet if it's full.
export function ensureRecord(player) {
  try {
    if (!(player.getComponent("minecraft:health")?.currentValue > 0)) return; // not while dead
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv || inv.size <= RECORD_SLOT) return;
    for (let i = 0; i < inv.size; i++) {
      if (i !== RECORD_SLOT && inv.getItem(i)?.typeId === RECORD_ITEM) inv.setItem(i, undefined);
    }
    const cur = inv.getItem(RECORD_SLOT);
    if (cur?.typeId === RECORD_ITEM && cur.lockMode === ItemLockMode.slot) return;
    inv.setItem(RECORD_SLOT, lockedRecord());
    const first = !player.getDynamicProperty(P.slot);
    if (first) player.setDynamicProperty(P.slot, true);
    if (cur && cur.typeId !== RECORD_ITEM) {
      const left = inv.addItem(cur);
      if (left) player.dimension.spawnItem(left, player.location);
      player.sendMessage(left
        ? "§eThe last hotbar slot belongs to your Shinobi Record — your inventory was full, so what was there dropped at your feet."
        : "§7The last hotbar slot belongs to your §eShinobi Record§7 — what was there moved into your inventory.");
    } else if (first) {
      player.sendMessage("§7Your §eShinobi Record§7 lives in the last hotbar slot: it can't be moved, dropped or lost.");
    }
  } catch {
    /* try again on the next check */
  }
}

export function handleRecordUse(player, itemStack) {
  if (itemStack.typeId !== RECORD_ITEM) return false;
  system.run(() => openStats(player).catch(() => {}));
  return true;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function killXp(dead) {
  try {
    if (dead.getDynamicProperty("aegis:no_xp")) return 0; // shadow clones etc.
  } catch {
    /* ignore */
  }
  if (dead.typeId === "minecraft:player") return 60 + getLevel(dead) * 6;
  try {
    const h = dead.getComponent("minecraft:health");
    return Math.max(2, Math.round(h.effectiveMax * 3));
  } catch {
    return 5;
  }
}

export function initLevels(helpers) {
  api = helpers;

  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    let killer = damageSource?.damagingEntity;
    if (killer?.typeId === "aegis:chakra_clone") {
      try {
        killer = world.getEntity(killer.getDynamicProperty("aegis:owner"));
      } catch {
        killer = undefined;
      }
    }
    if (killer?.typeId !== "minecraft:player" || killer.id === deadEntity.id) return;
    gainXp(killer, killXp(deadEntity));
  });

  // Out of a fight (not hit for 8 s) you heal 1% of your max HP every second — big health pools refill in time.
  system.runInterval(() => {
    const now = system.currentTick;
    for (const p of world.getAllPlayers()) {
      if (now - (lastHurt.get(p.id) ?? -1e9) < 160) continue;
      try {
        const h = p.getComponent("minecraft:health");
        if (h.currentValue > 0 && h.currentValue < h.effectiveMax) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + Math.max(0.5, h.effectiveMax * 0.01)));
      } catch {
        /* ignore */
      }
    }
  }, 20);

  // Endurance: shrug off part of every hit.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player") return;
    lastHurt.set(hurtEntity.id, system.currentTick);
    const end = getStat(hurtEntity, "endurance");
    if (end <= 0) return;
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage * Math.min(0.3, end * 0.002)));
    } catch {
      /* ignore */
    }
  });

  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (initialSpawn && player.getDynamicProperty(P.level) === undefined) {
      set(player, P.level, 1);
      set(player, P.xp, 0);
      set(player, P.points, 0);
    }
    ensureRecord(player);
    applyStatEffects(player);
  });

  system.runInterval(() => {
    for (const p of world.getAllPlayers()) ensureRecord(p);
  }, 40);

  // /scriptevent aegis:melee [percent]   — players' melee damage (25-200%, 100 = normal); no number shows it
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:melee") return;
    const n = Number(String(message ?? "").trim());
    if (String(message ?? "").trim() && Number.isFinite(n)) return void setMeleePercent(n);
    const t = `§6Combat:§7 players' melee damage is §f${meleePercent()}%§7 of normal. Change it: §f/scriptevent aegis:melee <${MELEE_RANGE.join("-")}>`;
    if (sourceEntity?.typeId === "minecraft:player") sourceEntity.sendMessage(t);
    else world.sendMessage(t);
  });

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (sourceEntity?.typeId !== "minecraft:player") return;
    const player = sourceEntity;
    if (id === "aegis:stats") {
      system.run(() => openStats(player).catch(() => {}));
    } else if (id === "aegis:level") {
      const [cmd, arg] = message.trim().toLowerCase().split(/\s+/);
      const n = Number(arg);
      if (cmd === "set" && n >= 1) {
        setLevel(player, Math.floor(n));
        player.sendMessage(`§7Level set to §e${getLevel(player)}§7 with §e${getPoints(player)}§7 stat points.`);
      } else if (cmd === "xp" && n > 0) gainXp(player, n);
      else player.sendMessage("§7Usage: /scriptevent aegis:level <set <1-300> | xp <amount>>");
    }
  });
}
