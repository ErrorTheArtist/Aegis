// Daily missions & the login streak (v1.55).
//   Every real day (UTC) each shinobi gets three random daily missions — defeat ninja, cast jutsu, eat ramen, earn honor,
//   defeat a boss… Each pays Ryō (some an XP Shard) the moment it's done, and finishing all three pays a bonus.
//   Logging in on consecutive days builds a streak: day 1 → 7 pay more and more (day 7: 10,000 Ryō and 2 XP Shards),
//   then the week starts again. Miss a day and the streak starts over.
//   Shinobi Record → Daily shows today's missions and your streak.
//   /scriptevent aegis:daily          — today's missions
//   /scriptevent aegis:daily reroll   — new missions now (testing)

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { addRyo, fmtRyo, questRyo } from "./currency.js";
import { getLevel } from "./levels.js";
import { getHonor } from "./villages.js";
import { missionsDone } from "./titles.js";
import { giveShards } from "./xpshards.js";
import { bumpAch, achStats } from "./achievements.js";
import { TOOL_IDS } from "./tools.js";
import { quiet } from "./settings.js";

const DAY_PROP = "aegis:daily_day";
const STATE_PROP = "aegis:daily"; // { list: [{ id, have, done }], base: { honor, missions, level }, bonus }
const STREAK_PROP = "aegis:streak";
const STREAK_DAY_PROP = "aegis:streak_day";
const STREAK_PAY = [500, 1000, 1500, 2500, 3500, 5000, 10000];
const ALL_DONE = { ryo: 5000, shards: 1 };

// [id, text, goal, reward { ryo, shards, item }, weight]
export const DAILY = {
  ninja: ["Defeat 15 hostile ninja", 15, { ryo: 3000 }, 10],
  monsters: ["Defeat 30 monsters", 30, { ryo: 2000 }, 10],
  casts: ["Cast 25 jutsu", 25, { ryo: 2500 }, 10],
  variety: ["Cast 5 different jutsu", 5, { ryo: 2000 }, 8],
  ramen: ["Eat 3 bowls of ramen", 3, { ryo: 1000, item: ["aegis:ramen", 2] }, 6],
  boss: ["Defeat a legendary shinobi or an Akatsuki member", 1, { ryo: 8000, shards: 1 }, 5],
  beast: ["Defeat a Tailed Beast", 1, { ryo: 10000, shards: 2 }, 2],
  honor: ["Earn 50 village honor", 50, { ryo: 3000 }, 7],
  mission: ["Complete a mission or a quest", 1, { ryo: 4000 }, 7],
  tools: ["Use ninja tools 10 times", 10, { ryo: 1500 }, 6],
  levels: ["Gain 2 levels", 2, { ryo: 3000 }, 5],
  summon: ["Summon an animal", 1, { ryo: 1500 }, 5],
};

let api;
export const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function readState(p) {
  try {
    return JSON.parse(p.getDynamicProperty(STATE_PROP) ?? "null");
  } catch {
    return null;
  }
}
const saveState = (p, st) => p.setDynamicProperty(STATE_PROP, JSON.stringify(st));

function pick(n) {
  const pool = Object.entries(DAILY);
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, [, d]) => a + d[3], 0);
    let r = Math.random() * total;
    const i = pool.findIndex(([, d]) => (r -= d[3]) < 0);
    out.push(pool.splice(i < 0 ? 0 : i, 1)[0][0]);
  }
  return out;
}

export function rollDailies(p) {
  const st = {
    list: pick(3).map((id) => ({ id, have: 0, done: false })),
    base: { honor: getHonor(p), missions: missionsDone(p), level: getLevel(p) },
    seen: [],
    bonus: false,
  };
  p.setDynamicProperty(DAY_PROP, today());
  saveState(p, st);
  return st;
}

// (the missions and their bonus follow the economy's quest-reward setting; the login streak doesn't)
const ryoOf = (reward, quest = true) => (quest ? questRyo(reward.ryo) : reward.ryo ?? 0);
function pay(p, reward, quest = true) {
  const bits = [];
  const ryo = ryoOf(reward, quest);
  if (ryo) {
    addRyo(p, ryo, true);
    bits.push(fmtRyo(ryo));
  }
  if (reward.shards) {
    giveShards(p, reward.shards);
    bits.push(`${reward.shards} XP Shard${reward.shards > 1 ? "s" : ""}`);
  }
  if (reward.item) {
    try {
      const left = p.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(reward.item[0], reward.item[1]));
      if (left) p.dimension.spawnItem(left, p.location);
    } catch {
      /* ignore */
    }
    bits.push(`${reward.item[1]}× ${reward.item[0].replace("aegis:", "").replace(/_/g, " ")}`);
  }
  return bits.join("§7, §f");
}

// The current day's state (rolled fresh when the day has changed).
export function dailyState(p) {
  if (p.getDynamicProperty(DAY_PROP) !== today()) return rollDailies(p);
  return readState(p) ?? rollDailies(p);
}

// Progress on one kind of daily (`set`: an absolute value instead of an increment).
export function dailyProgress(p, id, by = 1, set) {
  if (p?.typeId !== "minecraft:player") return;
  const st = dailyState(p);
  let changed = false;
  for (const m of st.list) {
    if (m.id !== id || m.done) continue;
    const goal = DAILY[id][1];
    const was = m.have;
    m.have = Math.min(goal, set !== undefined ? Math.max(m.have, set) : m.have + by);
    if (m.have === was) continue;
    changed = true;
    if (m.have >= goal) {
      m.done = true;
      const got = pay(p, DAILY[id][2]);
      if (!quiet(p)) p.sendMessage(`§a✔ Daily mission done: §f${DAILY[id][0]}§a — §f${got}`);
      showTitle(p, "§aDaily mission complete!", { subtitle: `§f${DAILY[id][0]}`, fadeInDuration: 4, stayDuration: 40, fadeOutDuration: 10 });
      api?.sound(p.dimension, "random.levelup", p.location, 0.6, 1.4);
      bumpAch(p, "dailies");
    }
  }
  if (!changed) return;
  if (!st.bonus && st.list.every((m) => m.done)) {
    st.bonus = true;
    const bonus = `${pay(p, ALL_DONE)}${Math.random() < 0.1 ? ` §7and §f${pay(p, { item: ["aegis:reroll_scroll", 1] })}` : ""}`;
    if (!quiet(p)) p.sendMessage(`§6★ All three daily missions done! §fBonus: ${bonus}`);
  }
  saveState(p, st);
}

// Called by main.js when a jutsu is cast.
export function noteDailyCast(p, itemId) {
  dailyProgress(p, "casts");
  const st = dailyState(p);
  if (!st.list.some((m) => m.id === "variety" && !m.done)) return;
  const seen = st.seen ?? [];
  if (seen.includes(itemId)) return;
  seen.push(itemId);
  st.seen = seen;
  saveState(p, st);
  dailyProgress(p, "variety", 0, seen.length);
}

// The login streak: called when a player joins (and checked now and then for players who stay online past midnight).
export function checkStreak(p) {
  const day = today();
  const last = p.getDynamicProperty(STREAK_DAY_PROP);
  if (last === day) return;
  const streak = last === yesterday() ? Number(p.getDynamicProperty(STREAK_PROP) ?? 0) + 1 : 1;
  p.setDynamicProperty(STREAK_PROP, streak);
  p.setDynamicProperty(STREAK_DAY_PROP, day);
  const slot = (streak - 1) % 7;
  const got = pay(p, { ryo: STREAK_PAY[slot], shards: slot === 6 ? 2 : 0 }, false);
  p.sendMessage(`§e☀ Login streak: day ${streak}§7 — §f${got}${slot === 6 ? " §6(a full week!)" : `§8 (day 7 pays ${fmtRyo(STREAK_PAY[6])} + 2 XP Shards)`}`);
  const best = achStats(p).streak_best ?? 0;
  if (streak > best) bumpAch(p, "streak_best", streak - best);
}

export async function dailyMenu(p, back) {
  checkStreak(p);
  const st = dailyState(p);
  const streak = Number(p.getDynamicProperty(STREAK_PROP) ?? 1);
  const lines = st.list.map((m) => {
    const [text, goal, reward] = DAILY[m.id];
    return `${m.done ? "§a✔" : "§8✘"} §f${text}§7 — ${m.done ? "done" : `${m.have}/${goal}`} §8(${[ryoOf(reward) ? fmtRyo(ryoOf(reward)) : "", reward.shards ? `${reward.shards} XP Shard` : ""].filter(Boolean).join(", ")})`;
  });
  const now = new Date();
  const left = Math.max(0, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 3600000));
  await new ActionFormData()
    .title("§l§aDaily")
    .body([
      "§a§lToday's missions§r",
      ...lines,
      st.bonus ? "§6★ All done — bonus paid!" : `§7Finish all three for a bonus: §f${fmtRyo(ryoOf(ALL_DONE))} + an XP Shard`,
      `§8New missions in about ${left} hour${left === 1 ? "" : "s"}.`,
      "",
      `§e☀ Login streak: §fday ${streak}§7 — tomorrow pays §f${fmtRyo(STREAK_PAY[streak % 7])}${streak % 7 === 6 ? " + 2 XP Shards" : ""}`,
    ].join("\n"))
    .button("§l« Back")
    .show(p);
  return back?.();
}

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

export function initDailies(helpers) {
  api = helpers;
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;
    system.runTimeout(() => {
      try {
        checkStreak(player);
        dailyState(player);
      } catch {
        /* ignore */
      }
    }, 140);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity: e, damageSource }) => {
    const k = killerOf(damageSource);
    if (!k || !e || e.typeId === "minecraft:player") return;
    try {
      if (e.getDynamicProperty("aegis:no_xp")) return;
    } catch {
      /* ignore */
    }
    const t = e.typeId;
    if (t === "aegis:hostile_ninja") dailyProgress(k, "ninja");
    else if (t === "aegis:legend" || t === "aegis:akatsuki") dailyProgress(k, "boss");
    else if (["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama", "juubi"].some((b) => t === `aegis:${b}`)) dailyProgress(k, "beast");
    else {
      try {
        if (e.matches?.({ families: ["monster"] })) dailyProgress(k, "monsters");
      } catch {
        /* ignore */
      }
    }
  });
  world.afterEvents.itemCompleteUse.subscribe(({ source: p, itemStack }) => {
    if (itemStack?.typeId === "aegis:ramen" || itemStack?.typeId === "aegis:miso_ramen") dailyProgress(p, "ramen");
  });
  world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
    if (TOOL_IDS.includes(itemStack?.typeId)) dailyProgress(p, "tools");
  });
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (!entity?.typeId?.startsWith("aegis:summon_")) return;
    system.runTimeout(() => {
      try {
        const owner = world.getEntity(entity.getDynamicProperty("aegis:owner"));
        if (owner?.typeId === "minecraft:player") dailyProgress(owner, "summon");
      } catch {
        /* ignore */
      }
    }, 3);
  });
  // the ones measured from the day's start: honor, missions, levels — and the day changing for players online at midnight
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        checkStreak(p);
        const st = dailyState(p);
        dailyProgress(p, "honor", 0, getHonor(p) - (st.base?.honor ?? 0));
        dailyProgress(p, "mission", 0, missionsDone(p) - (st.base?.missions ?? 0));
        dailyProgress(p, "levels", 0, getLevel(p) - (st.base?.level ?? 1));
      } catch {
        /* ignore */
      }
    }
  }, 200);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:daily" || p?.typeId !== "minecraft:player") return;
    if (String(message ?? "").trim() === "reroll") rollDailies(p);
    const st = dailyState(p);
    p.sendMessage(`§aDaily missions: ${st.list.map((m) => `${m.done ? "§a✔" : "§7"}${DAILY[m.id][0]} §8(${m.have}/${DAILY[m.id][1]})`).join("§7, ")}`);
  });
}
