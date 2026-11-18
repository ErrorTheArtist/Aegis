// Achievements (v1.55) — 50 of them, in seven groups: Combat, Bosses, Jutsu, Path of the Shinobi, Wealth & Village,
// Daily & Events, and Just for Fun. Each pays a reward the moment it's unlocked (Ryō, XP Shards, sometimes an item), with
// a title on screen; the rare ones are announced to the server. Shinobi Record → Achievements shows them all with your
// progress.
//   /scriptevent aegis:achievements          — your unlocked count
//   /scriptevent aegis:achievements reset    — reset your own achievements (testing)

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { getRyo, addRyo, fmtRyo } from "./currency.js";
import { getLevel, getRank, getStat, STATS, STAT_CAP } from "./levels.js";
import { getHonor, everLeft } from "./villages.js";
import { hasSageTraining } from "./sage.js";
import { titlesOf, missionsDone } from "./titles.js";
import { bountyOf, pvpRecord } from "./bounty.js";
import { giveShards } from "./xpshards.js";
import { quiet } from "./settings.js";

const STATS_PROP = "aegis:ach_stats"; // player: counters and sets
const DONE_PROP = "aegis:ach"; // player: unlocked ids
const AKATSUKI = ["itachi", "kisame", "deidara", "pain", "konan", "hidan", "kakuzu", "sasori", "zetsu", "tobi"];
const BEASTS = ["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"];
const LEGENDS = ["naruto", "sasuke", "tsunade", "sarutobi", "minato", "madara", "gaara", "zabuza", "killer_bee", "onoki", "hanzo",
  "kakashi", "guy", "jiraiya", "orochimaru", "hashirama", "tobirama", "obito", "kaguya"];

let api;

// ---------------------------------------------------------------------------
// Player data
// ---------------------------------------------------------------------------
function readJson(p, key, def) {
  try {
    const v = p.getDynamicProperty(key);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
}
export const achStats = (p) => readJson(p, STATS_PROP, {});
const saveStats = (p, s) => p.setDynamicProperty(STATS_PROP, JSON.stringify(s));
export const unlocked = (p) => new Set(readJson(p, DONE_PROP, []));
const n = (s, k) => s[k] ?? 0;
const size = (s, k) => (s[k] ?? []).length;

// Adds to a counter (and checks the achievements it could finish).
export function bumpAch(p, key, by = 1) {
  if (p?.typeId !== "minecraft:player") return;
  const s = achStats(p);
  s[key] = (s[key] ?? 0) + by;
  saveStats(p, s);
  checkAch(p, s);
}

// Remembers one of a set (a jutsu cast, a boss defeated…).
function addToSet(p, key, id) {
  const s = achStats(p);
  const list = s[key] ?? [];
  if (list.includes(id)) return s;
  list.push(id);
  s[key] = list;
  saveStats(p, s);
  return s;
}

// ---------------------------------------------------------------------------
// The achievements: [id, group, name, description, goal, progress(p, s), reward]
//   reward: { ryo, shards, item: [id, n], rare }
// ---------------------------------------------------------------------------
const lv = (x) => (p) => getLevel(p) / x;
export const ACH = [
  // Combat
  ["first_blood", "Combat", "First Blood", "Defeat a hostile ninja", 1, (p, s) => n(s, "ninja"), { ryo: 500 }],
  ["rogue_hunter", "Combat", "Rogue Hunter", "Defeat 50 hostile ninja", 50, (p, s) => n(s, "ninja"), { ryo: 5000, shards: 1 }],
  ["ninja_slayer", "Combat", "Ninja Slayer", "Defeat 500 hostile ninja", 500, (p, s) => n(s, "ninja"), { ryo: 25000, shards: 3 }],
  ["one_man_army", "Combat", "One-Man Army", "Defeat 3,000 hostile ninja", 3000, (p, s) => n(s, "ninja"), { ryo: 100000, shards: 10, rare: true }],
  ["monster_hunter", "Combat", "Monster Hunter", "Defeat 100 monsters", 100, (p, s) => n(s, "monster"), { ryo: 3000 }],
  ["rival", "Combat", "Rival", "Defeat another player", 1, (p) => pvpRecord(p).kills ?? 0, { ryo: 2000 }],
  ["feared", "Combat", "Feared Shinobi", "Defeat 25 players", 25, (p) => pvpRecord(p).kills ?? 0, { ryo: 25000, shards: 2 }],
  ["bounty_hunter", "Combat", "Bounty Hunter", "Claim a bounty from the Bingo Book", 1, (p) => pvpRecord(p).claimed ?? 0, { ryo: 5000 }],
  ["most_wanted", "Combat", "Most Wanted", "Have a bounty of 1,000,000 Ryō on your head", 1000000, (p) => bountyOf(p), { ryo: 10000, rare: true }],
  // Bosses
  ["cloud_breaker", "Bosses", "Cloud Breaker", "Defeat an Akatsuki member", 1, (p, s) => size(s, "akatsuki"), { ryo: 10000, shards: 2 }],
  ["end_of_akatsuki", "Bosses", "The End of the Akatsuki", "Defeat all ten Akatsuki members", 10, (p, s) => size(s, "akatsuki"),
    { ryo: 100000, item: ["aegis:reroll_scroll", 1], rare: true }],
  ["beast_tamer", "Bosses", "Beast Tamer", "Defeat a Tailed Beast", 1, (p, s) => size(s, "beasts"), { ryo: 15000, shards: 2 }],
  ["nine_down", "Bosses", "Nine Tails Down", "Defeat all nine Tailed Beasts", 9, (p, s) => size(s, "beasts"), { ryo: 150000, shards: 10, rare: true }],
  ["god_tree", "Bosses", "The God Tree Falls", "Defeat the Ten-Tails", 1, (p, s) => n(s, "juubi"), { ryo: 200000, shards: 15, rare: true }],
  ["legend_slayer", "Bosses", "Legend Slayer", "Defeat a legendary shinobi", 1, (p, s) => size(s, "legends"), { ryo: 10000, shards: 1 }],
  ["hall_of_legends", "Bosses", "Hall of Legends", "Defeat all 19 legendary shinobi", 19, (p, s) => size(s, "legends"),
    { ryo: 300000, item: ["aegis:reroll_scroll", 2], rare: true }],
  ["beyond_the_grave", "Bosses", "Beyond the Grave", "Defeat Edo Madara", 1, (p, s) => ((s.legends ?? []).includes("madara") ? 1 : 0), { ryo: 50000, shards: 5 }],
  ["rabbit_goddess", "Bosses", "Sealing the Rabbit Goddess", "Defeat Kaguya Ōtsutsuki", 1, (p, s) => ((s.legends ?? []).includes("kaguya") ? 1 : 0),
    { ryo: 150000, shards: 10, rare: true }],
  // Jutsu
  ["first_jutsu", "Jutsu", "First Jutsu", "Cast a jutsu", 1, (p, s) => n(s, "casts"), { ryo: 200 }],
  ["practiced", "Jutsu", "Practiced", "Cast 100 jutsu", 100, (p, s) => n(s, "casts"), { ryo: 3000 }],
  ["jutsu_master", "Jutsu", "Jutsu Master", "Cast 1,000 jutsu", 1000, (p, s) => n(s, "casts"), { ryo: 20000, shards: 2 }],
  ["collector", "Jutsu", "Scroll Collector", "Cast 10 different jutsu", 10, (p, s) => size(s, "jutsu"), { ryo: 5000 }],
  ["walking_library", "Jutsu", "Walking Library", "Cast 40 different jutsu", 40, (p, s) => size(s, "jutsu"), { ryo: 30000, shards: 3, rare: true }],
  ["springtime", "Jutsu", "Springtime of Youth", "Open the Eight Inner Gates", 1, (p, s) => ((s.jutsu ?? []).includes("aegis:eight_gates_scroll") ? 1 : 0), { ryo: 5000 }],
  ["contract", "Jutsu", "Contract Signed", "Summon an animal with a summoning scroll", 1, (p, s) => n(s, "summons"), { ryo: 2000 }],
  ["forbidden", "Jutsu", "Forbidden Arts", "Use the Reanimation Jutsu", 1, (p, s) => ((s.jutsu ?? []).includes("aegis:edo_tensei_scroll") ? 1 : 0), { ryo: 10000 }],
  ["sage_mode", "Jutsu", "Sage of Mount Myōboku", "Learn Sage Mode", 1, (p) => (hasSageTraining(p) ? 1 : 0), { ryo: 20000, shards: 2 }],
  ["eyes_of_hatred", "Jutsu", "Eyes of Hatred", "Awaken the Mangekyō Sharingan", 1, (p) => (p.getDynamicProperty("aegis:mangekyo") === true ? 1 : 0), { ryo: 15000 }],
  ["host", "Jutsu", "Host", "Become a Jinchūriki", 1, (p) => (p.getDynamicProperty("aegis:bijuu") ? 1 : 0), { ryo: 20000, shards: 2 }],
  // Path of the Shinobi
  ["genin", "Path", "Ninja Way", "Reach level 10", 1, lv(10), { ryo: 1000 }],
  ["level_50", "Path", "Seasoned", "Reach level 50", 1, lv(50), { ryo: 10000, shards: 1 }],
  ["level_100", "Path", "Elite", "Reach level 100", 1, lv(100), { ryo: 25000, shards: 2 }],
  ["level_200", "Path", "Living Legend", "Reach level 200", 1, lv(200), { ryo: 75000, shards: 5, rare: true }],
  ["level_300", "Path", "Peak of the Shinobi World", "Reach level 300", 1, lv(300), { ryo: 200000, shards: 10, rare: true }],
  ["chunin", "Path", "Chūnin", "Pass the Chūnin exam", 1, (p) => (getRank(p) >= 1 ? 1 : 0), { ryo: 5000 }],
  ["jonin", "Path", "Jōnin", "Pass the Jōnin exam", 1, (p) => (getRank(p) >= 2 ? 1 : 0), { ryo: 15000, shards: 1 }],
  ["perfect_body", "Path", "Perfect Body", "Max out a stat (150)", 1, (p) => (Object.keys(STATS).some((id) => getStat(p, id) >= STAT_CAP) ? 1 : 0), { ryo: 10000 }],
  ["hero", "Path", "Hero of the Shinobi World", "Finish the Path of the Shinobi (all 12 story chapters)", 1, (p, s) => n(s, "story_done"),
    { ryo: 50000, shards: 5, rare: true }],
  ["title_of_legend", "Path", "A Title of Legend", "Hold a title (Pain, Itachi, Tobi, Sasuke or Naruto)", 1, (p) => (titlesOf(p).length ? 1 : 0), { ryo: 50000, rare: true }],
  // Wealth & Village
  ["well_off", "Wealth", "Well Off", "Hold 100,000 Ryō", 100000, (p) => getRyo(p), { shards: 1 }],
  ["millionaire", "Wealth", "Millionaire", "Hold 1,000,000 Ryō", 1000000, (p) => getRyo(p), { shards: 5, rare: true }],
  ["honored", "Wealth", "Honored", "Earn 1,000 village honor", 1000, (p) => getHonor(p), { ryo: 5000 }],
  ["pride", "Wealth", "Pride of the Village", "Earn 100,000 village honor", 100000, (p) => getHonor(p), { ryo: 100000, shards: 5, rare: true }],
  ["reliable", "Wealth", "Reliable", "Complete 10 missions", 10, (p) => missionsDone(p), { ryo: 5000 }],
  ["veteran", "Wealth", "Veteran", "Complete 100 missions", 100, (p) => missionsDone(p), { ryo: 50000, shards: 3 }],
  ["missing_nin", "Wealth", "Missing-nin", "Leave your village", 1, (p) => (everLeft(p) ? 1 : 0), { ryo: 1000 }],
  // Daily & Events
  ["dedicated", "Daily", "Dedicated", "Keep a 7-day login streak", 7, (p, s) => n(s, "streak_best"), { ryo: 20000, shards: 2 }],
  ["every_day", "Daily", "Every Day a Shinobi", "Complete 30 daily missions", 30, (p, s) => n(s, "dailies"), { ryo: 30000, shards: 3 }],
  ["defender", "Daily", "Defender of the Village", "Take part in a world event", 1, (p, s) => n(s, "events"), { ryo: 10000, shards: 1 }],
  // Just for fun
  ["ichiraku", "Fun", "Ichiraku Regular", "Eat 50 bowls of ramen", 50, (p, s) => n(s, "ramen"), { ryo: 5000, item: ["aegis:ramen", 10] }],
  ["so_spicy", "Fun", "So Spicy!", "Eat the Curry of Life", 1, (p, s) => n(s, "curry"), { ryo: 1000 }],
];
export const ACH_GROUPS = ["Combat", "Bosses", "Jutsu", "Path", "Wealth", "Daily", "Fun"];
const GROUP_NAMES = { Combat: "§cCombat", Bosses: "§4Bosses", Jutsu: "§bJutsu", Path: "§ePath of the Shinobi", Wealth: "§6Wealth & Village",
  Daily: "§aDaily & Events", Fun: "§dJust for Fun" };

function grant(p, a) {
  const [, , name, desc, , , reward] = a;
  const bits = [];
  if (reward.ryo) {
    addRyo(p, reward.ryo, true);
    bits.push(fmtRyo(reward.ryo));
  }
  if (reward.shards) {
    giveShards(p, reward.shards);
    bits.push(`${reward.shards} XP Shard${reward.shards > 1 ? "s" : ""}`);
  }
  if (reward.item) {
    const [id, k] = reward.item;
    try {
      const left = p.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(id, k));
      if (left) p.dimension.spawnItem(left, p.location);
    } catch {
      /* ignore */
    }
    bits.push(`${k > 1 ? `${k}× ` : ""}${id.replace("aegis:", "").replace(/_/g, " ")}`);
  }
  showTitle(p, "§6Achievement unlocked!", { subtitle: `§f${name}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
  if (!quiet(p)) p.sendMessage(`§6★ Achievement: §f${name}§7 — ${desc}.${bits.length ? ` §6Reward: §f${bits.join("§7, §f")}` : ""}`);
  api?.sound(p.dimension, "random.levelup", p.location, 0.8, 1.2);
  if (reward.rare) world.sendMessage(`§6★ ${p.name}§e unlocked the achievement §f${name}§e!`);
}

// Checks every achievement and grants the ones just reached. Returns how many were granted.
export function checkAch(p, s = achStats(p)) {
  const done = unlocked(p);
  const fresh = [];
  for (const a of ACH) {
    if (done.has(a[0])) continue;
    let prog = 0;
    try {
      prog = a[5](p, s);
    } catch {
      prog = 0;
    }
    if (prog >= a[4]) {
      done.add(a[0]);
      fresh.push(a);
    }
  }
  if (!fresh.length) return 0;
  p.setDynamicProperty(DONE_PROP, JSON.stringify([...done]));
  for (const a of fresh) grant(p, a);
  return fresh.length;
}

// ---------------------------------------------------------------------------
// The Shinobi Record page
// ---------------------------------------------------------------------------
export async function achievementsMenu(p, back) {
  const done = unlocked(p);
  const f = new ActionFormData().title("§l§6Achievements").body(`§7Unlocked: §f${done.size}§7/${ACH.length}\n§8Pick a group to see your progress.`);
  for (const g of ACH_GROUPS) {
    const list = ACH.filter((a) => a[1] === g);
    f.button(`${GROUP_NAMES[g]}\n§r§7${list.filter((a) => done.has(a[0])).length}/${list.length}`);
  }
  f.button("§l« Back");
  const r = await f.show(p);
  if (r.canceled) return;
  if (r.selection === ACH_GROUPS.length) return back?.();
  const g = ACH_GROUPS[r.selection];
  const s = achStats(p);
  const lines = ACH.filter((a) => a[1] === g).map((a) => {
    const [id, , name, desc, goal, prog] = a;
    if (done.has(id)) return `§a✔ §f${name}§7 — ${desc}`;
    let v = 0;
    try {
      v = prog(p, s);
    } catch {
      v = 0;
    }
    const pct = goal === 1 ? "" : ` §8(${Math.min(Math.floor(v), goal).toLocaleString("en-US")}/${goal.toLocaleString("en-US")})`;
    return `§8✘ §7${name}§8 — ${desc}${pct}`;
  });
  await new ActionFormData().title(`§l${GROUP_NAMES[g]}`).body(lines.join("\n")).button("§l« Back").show(p);
  return achievementsMenu(p, back);
}

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

// Called by main.js when a jutsu is cast.
export function noteAchCast(p, itemId) {
  const s = addToSet(p, "jutsu", itemId);
  s.casts = (s.casts ?? 0) + 1;
  saveStats(p, s);
  checkAch(p, s);
}

export function initAchievements(helpers) {
  api = helpers;
  world.afterEvents.entityDie.subscribe(({ deadEntity: e, damageSource }) => {
    const k = killerOf(damageSource);
    if (!k || e?.typeId === "minecraft:player") return;
    try {
      if (e.getDynamicProperty("aegis:no_xp")) return; // clones
    } catch {
      /* ignore */
    }
    const t = e.typeId;
    let member;
    try {
      member = e.getDynamicProperty("aegis:member");
    } catch {
      member = undefined;
    }
    let s;
    if (t === "aegis:hostile_ninja") s = (() => { const x = achStats(k); x.ninja = (x.ninja ?? 0) + 1; return x; })();
    else if (t === "aegis:akatsuki" && AKATSUKI.includes(member)) s = addToSet(k, "akatsuki", member);
    else if (t === "aegis:legend" && LEGENDS.includes(member)) s = addToSet(k, "legends", member);
    else if (t === "aegis:juubi") s = (() => { const x = achStats(k); x.juubi = (x.juubi ?? 0) + 1; return x; })();
    else if (t.startsWith("aegis:") && BEASTS.includes(t.slice(6))) s = addToSet(k, "beasts", t.slice(6));
    else {
      let monster = false;
      try {
        monster = !!e.matches?.({ families: ["monster"] });
      } catch {
        monster = false;
      }
      if (!monster) return;
      s = achStats(k);
      s.monster = (s.monster ?? 0) + 1;
    }
    saveStats(k, s);
    checkAch(k, s);
  });
  world.afterEvents.itemCompleteUse.subscribe(({ source: p, itemStack }) => {
    if (p?.typeId !== "minecraft:player") return;
    if (itemStack?.typeId === "aegis:ramen" || itemStack?.typeId === "aegis:miso_ramen") bumpAch(p, "ramen");
    else if (itemStack?.typeId === "aegis:curry_of_life") bumpAch(p, "curry");
  });
  // a summoned animal appears: count it for its summoner
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (!entity?.typeId?.startsWith("aegis:summon_")) return;
    system.runTimeout(() => {
      try {
        const owner = world.getEntity(entity.getDynamicProperty("aegis:owner"));
        if (owner?.typeId === "minecraft:player") bumpAch(owner, "summons");
      } catch {
        /* ignore */
      }
    }, 3);
  });
  // the state ones (level, Ryō, honor, ranks…) are checked every five seconds
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        checkAch(p);
      } catch {
        /* ignore */
      }
    }
  }, 100);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:achievements" || p?.typeId !== "minecraft:player") return;
    if (String(message ?? "").trim() === "reset") {
      p.setDynamicProperty(DONE_PROP, undefined);
      p.setDynamicProperty(STATS_PROP, undefined);
      return p.sendMessage("§7Your achievements were reset.");
    }
    p.sendMessage(`§6Achievements: §f${unlocked(p).size}§7/${ACH.length} §8(Shinobi Record → Achievements)`);
  });
}
