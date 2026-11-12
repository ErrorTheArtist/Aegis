// Starter quests — a short automatic chain every new shinobi follows after choosing their village.
// No NPC needed: progress shows on the action bar, rewards are paid automatically, the next quest starts right away.
//   /scriptevent aegis:starter        — show your current starter quest
//   /scriptevent aegis:starter reset  — restart the chain (testing)

import { world, system, ItemStack } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { addRyo, fmtRyo } from "./currency.js";
import { getLevel, gainXp, getRank } from "./levels.js";

const PROP = "aegis:starter";
const CHAIN = [
  { title: "First Blood", text: "Defeat 5 hostile mobs (try your Kusanagi!)", kind: "kill", match: "monster", need: 5, ryo: 1000, xp: 300 },
  { title: "Chakra Control", text: "Cast 3 jutsu or clan abilities", kind: "cast", need: 3, xp: 500, items: [["aegis:flash_scroll", 1]] },
  { title: "Rogue Hunter", text: "Defeat 3 enemy ninja", kind: "kill", match: "ninja", need: 3, ryo: 2500, xp: 800, items: [["aegis:chakra_pill", 3]] },
  { title: "Growing Stronger", text: "Reach level 10", kind: "level", need: 10, ryo: 3000, items: [["aegis:clone_scroll", 1]] },
  { title: "The Chūnin Exam", text: "Pass the Chūnin exam at an Exam Proctor", kind: "rank", need: 1, ryo: 5000, items: [["aegis:flak_jacket", 1]] },
  { title: "Akatsuki Sighting", text: "Defeat any Akatsuki member", kind: "kill", match: "akatsuki", need: 1, ryo: 10000, xp: 5000, items: [["aegis:sphere_scroll", 1]] },
];

let api;

function get(p) {
  try {
    return JSON.parse(p.getDynamicProperty(PROP) ?? "null");
  } catch {
    return null;
  }
}
const set = (p, s) => p.setDynamicProperty(PROP, JSON.stringify(s));

export function startStarterQuests(player) {
  if (get(player)) return;
  set(player, { step: 0, progress: 0 });
  announce(player, 0);
}

function announce(player, step) {
  const q = CHAIN[step];
  if (!q) return;
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    showTitle(player, `§e${q.title}`, { subtitle: `§7Starter quest ${step + 1}/${CHAIN.length}: ${q.text}`, fadeInDuration: 8, stayDuration: 60, fadeOutDuration: 15 });
    player.sendMessage(`§6Starter quest ${step + 1}/${CHAIN.length}: §e${q.title}§7 — ${q.text}. ${rewardText(q)}`);
  }, 40);
}

function rewardText(q) {
  const r = [];
  if (q.ryo) r.push(`§6${fmtRyo(q.ryo)}`);
  if (q.xp) r.push(`§b${q.xp} XP`);
  for (const [id, n] of q.items ?? []) r.push(`§f${n}× ${id.split(":")[1].replace(/_/g, " ")}`);
  return r.length ? `§7Reward: ${r.join("§7, ")}` : "";
}

function advance(player, amount = 1, absolute) {
  const s = get(player);
  if (!s || s.step >= CHAIN.length) return;
  const q = CHAIN[s.step];
  s.progress = absolute ?? s.progress + amount;
  if (s.progress < q.need) {
    set(player, s);
    if (absolute === undefined) player.onScreenDisplay?.setActionBar(`§eStarter quest: §f${q.title} §7${s.progress}/${q.need}`);
    return;
  }
  // complete: pay out and move on
  if (q.ryo) addRyo(player, q.ryo, true);
  if (q.xp) gainXp(player, q.xp);
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (const [id, n] of q.items ?? []) {
    const st = new ItemStack(id, n);
    try {
      const left = inv ? inv.addItem(st) : st;
      if (left) player.dimension.spawnItem(left, player.location);
    } catch {
      player.dimension.spawnItem(st, player.location);
    }
  }
  showTitle(player, "§aQuest complete!", { subtitle: `§e${q.title}`, stayDuration: 40 });
  player.sendMessage(`§aStarter quest complete: §e${q.title}§a. ${rewardText(q)}`);
  api.sound(player.dimension, "random.levelup", player.location, 1, 1.2);
  set(player, { step: s.step + 1, progress: 0 });
  if (s.step + 1 >= CHAIN.length) {
    system.runTimeout(() => api.isValid(player) && player.sendMessage("§6You've finished every starter quest. §7The Quest Givers of the villages have more work for you."), 60);
  } else announce(player, s.step + 1);
}

// Called by main.js / clans.js whenever the player casts a jutsu or clan ability.
export function noteCast(player) {
  const s = get(player);
  if (s && CHAIN[s.step]?.kind === "cast") advance(player);
}

export function starterLine(player) {
  const s = get(player);
  if (!s) return "";
  if (s.step >= CHAIN.length) return "§7Starter quests: §acomplete";
  const q = CHAIN[s.step];
  return `§7Starter quest ${s.step + 1}/${CHAIN.length}: §e${q.title} §7(${q.text}) §f${Math.min(s.progress, q.need)}/${q.need}`;
}

function killKind(dead) {
  if (dead.typeId === "aegis:akatsuki") return "akatsuki";
  if (dead.typeId === "aegis:hostile_ninja") return "ninja";
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
    const s = get(k);
    const q = s && CHAIN[s.step];
    if (!q || q.kind !== "kill") return;
    const kind = killKind(deadEntity);
    // any hostile counts for "monster"; enemy ninja / Akatsuki count for "ninja" too
    const ok = q.match === kind || (q.match === "monster" && kind !== "other") || (q.match === "ninja" && kind === "akatsuki");
    if (ok) advance(k);
  });
  // level / rank goals are checked every couple of seconds
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      const s = get(p);
      const q = s && CHAIN[s.step];
      if (!q) continue;
      if (q.kind === "level") advance(p, 0, getLevel(p));
      else if (q.kind === "rank") advance(p, 0, getRank(p));
    }
  }, 40);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:starter" || p?.typeId !== "minecraft:player") return;
    if (String(message ?? "").trim() === "reset") {
      p.setDynamicProperty(PROP, undefined);
      return startStarterQuests(p);
    }
    p.sendMessage(starterLine(p) || "§7No starter quests yet — choose a village first.");
  });
}
