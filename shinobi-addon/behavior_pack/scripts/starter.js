// Starter quests — a short automatic chain every new shinobi follows after choosing their village, plus a village
// quest line (different for every village, with its own signature reward) that runs alongside it.
// No NPC needed: progress shows on the action bar, rewards are paid automatically, the next quest starts right away.
//   /scriptevent aegis:starter        — show your current starter quest
//   /scriptevent aegis:starter reset  — restart the chain (testing)

import { world, system, ItemStack } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { addRyo, fmtRyo } from "./currency.js";
import { getLevel, gainXp, getRank } from "./levels.js";
import { getVillage, VILLAGES, gearOf } from "./villages.js";
import { JUTSU_NATURE } from "./natures.js";

const PROP = "aegis:starter";
const VPROP = "aegis:vquest";
const CHAIN = [
  { title: "First Blood", text: "Defeat 5 hostile mobs (try your Kusanagi!)", kind: "kill", match: "monster", need: 5, ryo: 1000, xp: 300 },
  { title: "Chakra Control", text: "Cast 3 jutsu or clan abilities", kind: "cast", need: 3, xp: 500, items: [["aegis:flash_scroll", 1]] },
  { title: "Rogue Hunter", text: "Defeat 3 enemy ninja", kind: "kill", match: "ninja", need: 3, ryo: 2500, xp: 800, items: [["aegis:chakra_pill", 3]] },
  { title: "Growing Stronger", text: "Reach level 10", kind: "level", need: 10, ryo: 3000, items: [["aegis:clone_scroll", 1]] },
  { title: "The Chūnin Exam", text: "Pass the Chūnin exam at an Exam Proctor", kind: "rank", need: 1, ryo: 5000, items: (p) => [[gearOf(p).jacket, 1]] },
  { title: "Akatsuki Sighting", text: "Defeat any Akatsuki member", kind: "kill", match: "akatsuki", need: 1, ryo: 10000, xp: 5000, items: [["aegis:sphere_scroll", 1]] },
];

// Village quest lines: patrol → master your village's release → its enemies → its signature reward.
const vline = (scroll, nature, natureName, foe, foeText, finalTitle, finalItem, finalName, titles) => [
  { title: titles[0], text: "Defeat 8 hostile mobs around the village", kind: "kill", match: "monster", need: 8, ryo: 1000, xp: 200, items: [[scroll, 1]] },
  { title: titles[1], text: `Cast 5 ${natureName} jutsu`, kind: "nature", nature, need: 5, ryo: 2000, xp: 600, items: [["aegis:chakra_pill", 2]] },
  { title: titles[2], text: foeText, kind: "kill", match: foe, need: 5, ryo: 3000, xp: 1200 },
  { title: finalTitle, text: `Reach level 25 to earn the ${finalName}`, kind: "level", need: 25, ryo: 5000, items: [[finalItem, 1]] },
];
const VCHAINS = {
  leaf: vline("aegis:fireball_scroll", "fire", "Fire Release", "sound", "Defeat 5 Sound Ninja (Orochimaru's spies)", "The Will of Fire", "aegis:summon_toad_scroll", "Toad Summoning scroll",
    ["Konoha Patrol", "The Fire Within", "Snakes in the Grass"]),
  sand: vline("aegis:wind_scroll", "wind", "Wind Release", "rogue", "Defeat 5 Rogue Ninja (puppet thieves)", "The Sand's Shield", "aegis:sand_gourd", "Sand Gourd",
    ["Desert Patrol", "Desert Winds", "Puppet Thieves"]),
  mist: vline("aegis:water_dragon_scroll", "water", "Water Release", "anbu", "Defeat 5 Rogue Anbu (hunt them like a hunter-nin)", "The Seven Swordsmen", "aegis:kubikiribocho", "blade Kubikiribōchō",
    ["Fog Patrol", "The Hidden Mist", "Hunter-nin"]),
  cloud: vline("aegis:chidori_scroll", "lightning", "Lightning Release", "ninja", "Defeat 5 enemy ninja", "Lightning Armor", "aegis:lightning_armor_scroll", "Lightning Release Armour scroll",
    ["Mountain Patrol", "Storm Training", "Kumo's Rivals"]),
  stone: vline("aegis:earth_wall_scroll", "earth", "Earth Release", "ninja", "Defeat 5 enemy ninja (border skirmish)", "The Unmovable Stone", "aegis:earth_spikes_scroll", "Earth Spikes scroll",
    ["Quarry Patrol", "Solid as Rock", "Border Skirmish"]),
  rain: vline("aegis:water_prison_scroll", "water", "Water Release", "rogue", "Defeat 5 Rogue Ninja (orphans of the war)", "The God of Rain", "aegis:akatsuki_cloak", "Akatsuki cloak",
    ["Rain Patrol", "Endless Rain", "Orphans of War"]),
};

let api;

// Two chains: "starter" (everyone) and "village" (depends on the player's village).
const CHAINS = {
  starter: { prop: PROP, label: "Starter quest", quests: () => CHAIN },
  village: { prop: VPROP, label: "Village quest", quests: (p, s) => VCHAINS[s?.v ?? getVillage(p)] ?? [] },
};

function get(p, key = "starter") {
  try {
    return JSON.parse(p.getDynamicProperty(CHAINS[key].prop) ?? "null");
  } catch {
    return null;
  }
}
const set = (p, s, key = "starter") => p.setDynamicProperty(CHAINS[key].prop, JSON.stringify(s));
const label = (p, key) => (key === "village" ? `${VILLAGES[get(p, key)?.v]?.color ?? "§a"}Village quest` : "§6Starter quest");

export function startStarterQuests(player) {
  if (!get(player)) {
    set(player, { step: 0, progress: 0 });
    announce(player, 0);
  }
  startVillageQuests(player);
}

// Starts (or restarts, after changing village) the village line.
export function startVillageQuests(player) {
  const v = getVillage(player);
  const s = get(player, "village");
  if (!v || s?.v === v) return;
  set(player, { v, step: 0, progress: 0 }, "village");
  system.runTimeout(() => announce(player, 0, "village"), 120);
}

function announce(player, step, key = "starter") {
  if (!api.isValid(player)) return;
  const list = CHAINS[key].quests(player, get(player, key));
  const q = list[step];
  if (!q) return;
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const head = `${label(player, key)} ${step + 1}/${list.length}`;
    showTitle(player, `§e${q.title}`, { subtitle: `§7${head.replace(/§./g, "")}: ${q.text}`, fadeInDuration: 8, stayDuration: 60, fadeOutDuration: 15 });
    player.sendMessage(`${head}: §e${q.title}§7 — ${q.text}. ${rewardText(q, player)}`);
  }, 40);
}

// A quest's item rewards (some depend on who earns them, e.g. the Chūnin flak jacket of your own village).
const itemsOf = (q, player) => (typeof q.items === "function" ? q.items(player) : q.items ?? []);

function rewardText(q, player) {
  const r = [];
  if (q.ryo) r.push(`§6${fmtRyo(q.ryo)}`);
  if (q.xp) r.push(`§b${q.xp} XP`);
  for (const [id, n] of itemsOf(q, player)) r.push(`§f${n}× ${id.split(":")[1].replace(/_/g, " ")}`);
  return r.length ? `§7Reward: ${r.join("§7, ")}` : "";
}

function advance(player, amount = 1, absolute, key = "starter") {
  const s = get(player, key);
  const list = CHAINS[key].quests(player, s);
  if (!s || s.step >= list.length) return;
  const q = list[s.step];
  s.progress = absolute ?? s.progress + amount;
  if (s.progress < q.need) {
    if (absolute !== undefined) return; // polled goals: nothing to save until done
    set(player, s, key);
    player.onScreenDisplay?.setActionBar(`${label(player, key)}: §f${q.title} §7${s.progress}/${q.need}`);
    return;
  }
  // complete: pay out and move on
  if (q.ryo) addRyo(player, q.ryo, true);
  if (q.xp) gainXp(player, q.xp);
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (const [id, n] of itemsOf(q, player)) {
    const st = new ItemStack(id, n);
    try {
      const left = inv ? inv.addItem(st) : st;
      if (left) player.dimension.spawnItem(left, player.location);
    } catch {
      player.dimension.spawnItem(st, player.location);
    }
  }
  showTitle(player, "§aQuest complete!", { subtitle: `§e${q.title}`, stayDuration: 40 });
  player.sendMessage(`§a${label(player, key).replace(/§./g, "")} complete: §e${q.title}§a. ${rewardText(q, player)}`);
  api.sound(player.dimension, "random.levelup", player.location, 1, 1.2);
  set(player, { ...s, step: s.step + 1, progress: 0 }, key);
  if (s.step + 1 >= list.length) {
    const msg = key === "village"
      ? `§6You've completed your village's quest line. §7${VILLAGES[s.v]?.name ?? "Your village"} is proud of you.`
      : "§6You've finished every starter quest. §7The Quest Givers of the villages have more work for you.";
    system.runTimeout(() => api.isValid(player) && player.sendMessage(msg), 60);
  } else announce(player, s.step + 1, key);
}

const each = (fn) => {
  for (const key of Object.keys(CHAINS)) fn(key);
};
const current = (player, key) => {
  const s = get(player, key);
  return s && CHAINS[key].quests(player, s)[s.step];
};

// Called by main.js / clans.js whenever the player casts a jutsu or clan ability.
export function noteCast(player, itemId) {
  each((key) => {
    const q = current(player, key);
    if (q?.kind === "cast" || (q?.kind === "nature" && JUTSU_NATURE[itemId] === q.nature)) advance(player, 1, undefined, key);
  });
}

function line(player, key) {
  const s = get(player, key);
  if (!s) return "";
  const list = CHAINS[key].quests(player, s);
  const name = label(player, key).replace(/§./g, "");
  if (s.step >= list.length) return `§7${name}s: §acomplete`;
  const q = list[s.step];
  const prog = q.kind === "level" ? getLevel(player) : q.kind === "rank" ? getRank(player) : s.progress;
  return `§7${name} ${s.step + 1}/${list.length}: §e${q.title} §7(${q.text}) §f${Math.min(prog, q.need)}/${q.need}`;
}
export const starterLine = (player) => [line(player, "starter"), line(player, "village")].filter(Boolean).join("\n");

function killKind(dead) {
  if (dead.typeId === "aegis:akatsuki" || dead.typeId === "aegis:legend") return "akatsuki";
  if (dead.typeId === "aegis:hostile_ninja") {
    try {
      const role = dead.getDynamicProperty("aegis:role");
      if (role === "sound" || role === "rogue" || role === "anbu") return role;
    } catch {
      /* ignore */
    }
    return "ninja";
  }
  try {
    if (dead.matches?.({ families: ["monster"] })) return "monster";
  } catch {
    /* ignore */
  }
  return "other";
}

export function initStarter(helpers) {
  api = helpers;
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    let k = damageSource?.damagingEntity;
    if (k && k.typeId !== "minecraft:player") {
      try {
        k = world.getEntity(k.getDynamicProperty("aegis:owner"));
      } catch {
        k = undefined;
      }
    }
    if (k?.typeId !== "minecraft:player" || deadEntity.typeId === "minecraft:player") return;
    try {
      if (deadEntity.getDynamicProperty("aegis:no_xp")) return; // shadow clones etc.
    } catch {
      return;
    }
    const kind = killKind(deadEntity);
    const ninja = kind === "ninja" || kind === "sound" || kind === "rogue" || kind === "anbu";
    each((key) => {
      const q = current(k, key);
      if (q?.kind !== "kill") return;
      // any hostile counts for "monster"; every enemy ninja / Akatsuki counts for "ninja"
      const ok = q.match === kind || (q.match === "monster" && kind !== "other") || (q.match === "ninja" && (ninja || kind === "akatsuki"));
      if (ok) advance(k, 1, undefined, key);
    });
  });
  // players who chose a village before village quests existed
  world.afterEvents.playerSpawn.subscribe(({ player }) => {
    system.runTimeout(() => api.isValid(player) && get(player) && startVillageQuests(player), 200);
  });
  // level / rank goals are checked every couple of seconds
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      each((key) => {
        const q = current(p, key);
        if (q?.kind === "level") advance(p, 0, getLevel(p), key);
        else if (q?.kind === "rank") advance(p, 0, getRank(p), key);
      });
    }
  }, 40);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:starter" || p?.typeId !== "minecraft:player") return;
    if (String(message ?? "").trim() === "reset") {
      p.setDynamicProperty(PROP, undefined);
      p.setDynamicProperty(VPROP, undefined);
      return startStarterQuests(p);
    }
    p.sendMessage(starterLine(p) || "§7No starter quests yet — choose a village first.");
  });
}
