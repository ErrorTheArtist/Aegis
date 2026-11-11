// Shinobi levels (1–200) and stat points.
//
// XP: kills (scaled by the victim's max health — Tailed Beasts give a lot), player kills,
// and casting jutsu / clan abilities / sword specials.
// Every level gives 3 stat points (+3 bonus at level 200 = 600 total = every stat maxed).
// Spend them in the Shinobi Record (item) or with /scriptevent aegis:stats.
//
// Commands (cheats on):
//   /scriptevent aegis:stats              — open the stat menu
//   /scriptevent aegis:level set 50       — set your level (points are recalculated)
//   /scriptevent aegis:level xp 5000      — add XP

import { world, system, ItemStack } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { applyNameTag, refreshClanEffects } from "./clans.js";

export const MAX_LEVEL = 200;
const POINTS_PER_LEVEL = 3;
const STAT_CAP = 100;
const RECORD_ITEM = "aegis:shinobi_record";

const P = { level: "aegis:level", xp: "aegis:xp", points: "aegis:points", given: "aegis:record_given" };

export const STATS = {
  vitality: { name: "Vitality", color: "§c", desc: "+2 hearts every 10 points (up to +20 hearts)" },
  chakra: { name: "Chakra", color: "§b", desc: "+2 max chakra and +0.5% chakra regen per point" },
  taijutsu: { name: "Taijutsu", color: "§6", desc: "Strength (+3 melee damage) every 25 points" },
  ninjutsu: { name: "Ninjutsu", color: "§d", desc: "+1% damage for jutsu, clan abilities and sword specials per point" },
  agility: { name: "Agility", color: "§a", desc: "Speed every 25 points, and -0.25% jutsu cooldowns per point" },
  endurance: { name: "Endurance", color: "§7", desc: "Shrug off 0.3% of all damage taken per point (up to 30%)" },
};

let api;

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

export const RANKS = ["Genin", "Chūnin", "Jōnin", "Kage"];
export const getRank = (player) => Math.max(0, Math.min(RANKS.length - 1, num(player, "aegis:rank", 0)));
export const setRank = (player, r) => set(player, "aegis:rank", r);
export const addPoints = (player, n) => set(player, P.points, num(player, P.points, 0) + n);

export const getLevel = (player) => Math.max(1, Math.min(MAX_LEVEL, num(player, P.level, 1)));
export const getStat = (player, id) => num(player, `aegis:stat_${id}`, 0);
const setStat = (player, id, v) => set(player, `aegis:stat_${id}`, v);
const getPoints = (player) => num(player, P.points, 0);

// XP needed to go from `level` to `level + 1`.
export function xpToNext(level) {
  return Math.round(40 + 12 * level + 0.25 * level * level);
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
export const cooldownMultiplier = (player) => 1 - getStat(player, "agility") * 0.0025;

// Extra "levels" of potion-style effects, merged with clan passives in clans.js.
export function statEffectLevels(player) {
  return {
    health_boost: Math.floor(getStat(player, "vitality") / 10), // 1 level = +2 hearts
    strength: Math.floor(getStat(player, "taijutsu") / 25),
    speed: Math.floor(getStat(player, "agility") / 25),
  };
}

// ---------------------------------------------------------------------------
// XP and levelling
// ---------------------------------------------------------------------------
export function gainXp(player, amount, quiet = false) {
  if (!player || player.typeId !== "minecraft:player" || amount <= 0) return;
  let level = getLevel(player);
  if (level >= MAX_LEVEL) return;
  let xp = num(player, P.xp, 0) + Math.round(amount);
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

function levelUpFx(player, level, gained) {
  const max = level >= MAX_LEVEL;
  showTitle(player, max ? "§6§lMAX LEVEL" : `§e§lLevel ${level}`, {
    subtitle: `§a+${gained} stat points §7— open your §fShinobi Record`,
    fadeInDuration: 4, stayDuration: 50, fadeOutDuration: 15,
  });
  api.sound(player.dimension, max ? "ui.toast.challenge_complete" : "random.levelup", player.location, 1, 1);
  api.particle(player.dimension, "aegis:chakra_aura", player.location);
  api.particle(player.dimension, "minecraft:totem_particle", api.add(player.location, { x: 0, y: 1, z: 0 }));
  if (level % 25 === 0 || max) world.sendMessage(`§e${player.name} reached §6Level ${level}§e!`);
  applyNameTag(player);
}

function setLevel(player, level) {
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

export async function openStats(player) {
  const level = getLevel(player);
  const xp = num(player, P.xp, 0);
  const need = xpToNext(level);
  const points = getPoints(player);
  const ids = Object.keys(STATS);

  const form = new ActionFormData()
    .title(`§lShinobi Record — Lv. ${level}`)
    .body(
      [
        level >= MAX_LEVEL ? "§6MAX LEVEL" : `§7XP ${bar(xp, need)} §f${xp}/${need}`,
        `§7Unspent points: §e${points}`,
        "",
        ...ids.map((id) => `${STATS[id].color}${STATS[id].name}§r §f${getStat(player, id)}§7/${STAT_CAP} §8— ${STATS[id].desc}`),
      ].join("\n")
    );
  for (const id of ids) form.button(`${STATS[id].color}${STATS[id].name}  §r§8${getStat(player, id)}/${STAT_CAP}`);
  form.button("§cReset stats");

  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  if (res.selection === ids.length) return confirmReset(player);
  const id = ids[res.selection];
  const room = Math.min(getPoints(player), STAT_CAP - getStat(player, id));
  if (room <= 0) {
    player.sendMessage(getPoints(player) <= 0 ? "§7No stat points to spend — level up first." : `§7${STATS[id].name} is maxed.`);
    return openStats(player);
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
  return openStats(player);
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
  return openStats(player);
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

function giveRecord(player) {
  if (player.getDynamicProperty(P.given)) return;
  try {
    const stack = new ItemStack(RECORD_ITEM, 1);
    stack.keepOnDeath = true;
    player.getComponent("minecraft:inventory").container.addItem(stack);
    player.setDynamicProperty(P.given, true);
  } catch {
    /* inventory full — try next spawn */
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

  // Endurance: shrug off part of every hit.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player") return;
    const end = getStat(hurtEntity, "endurance");
    if (end <= 0) return;
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage * end * 0.003));
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
    giveRecord(player);
    applyStatEffects(player);
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
      else player.sendMessage("§7Usage: /scriptevent aegis:level <set <1-200> | xp <amount>>");
    }
  });
}
