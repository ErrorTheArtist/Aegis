// Grace period (v1.53; reworked in v1.59) — a window an admin can give everyone (when the server opens, before an
// event…) or a single player. While a player has grace:
//   • no player can hurt them, and they can't hurt any player — weapons, arrows, jutsu, clones, companions and summons
//     alike (a player's blow is undone at once, and a jutsu never lands);
//   • enemies leave them alone — ninja, the Akatsuki, legends, Tailed Beasts and monsters don't attack them, and nothing
//     can hurt them (an invisible Resistance V) …
//   • … until they attack: an enemy they strike fights back (for 30 s after their last blow), but weaker — while they're
//     fighting, every hit they take is 60% softer (Resistance III), and hits from enemies they didn't attack are undone.
//     They can still be defeated, so fight carefully;
//   • legends accept their challenge (and wait for the first blow); quests, missions, shops work as usual.
//   /scriptevent aegis:grace 10           — 10 minutes for everyone (players who join meanwhile get it too)
//   /scriptevent aegis:grace 5 Steve      — 5 minutes for one player
//   /scriptevent aegis:grace off          — end every grace period now
//   /scriptevent aegis:grace off Steve    — end one player's
//   /scriptevent aegis:grace              — how long is left
// Every shinobi joining the server for the first time gets 1 hour of grace automatically (v1.54) — counted in play
// time, so it doesn't run out while they're offline.

import { world, system } from "@minecraft/server";
import { showTitle } from "./hud.js";

const WORLD_PROP = "aegis:grace_until"; // world: everyone's grace ends at this time (ms)
const PLAYER_PROP = "aegis:grace_until"; // player: their own grace ends at this time (ms)
const LEFT_PROP = "aegis:grace_left"; // player: seconds of play-time grace left (a new player's first hour)
const JOINED_PROP = "aegis:joined";
export const NEW_PLAYER_GRACE = 3600; // seconds
export const GRACE_TAG = "aegis_grace"; // (every player with grace carries it — for commands and other add-ons)
const MAX_MINUTES = 24 * 60;
const SAFE_AMP = 4; // Resistance V: nothing hurts them while they're not fighting
const FIGHT_AMP = 2; // Resistance III: the enemies they've attacked hit 60% softer
export const GRACE_SOFTER = "60%";
const PROVOKE_TICKS = 600; // an enemy fights back for 30 s after a player with grace last struck it

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const worldUntil = () => num(world.getDynamicProperty(WORLD_PROP));
function playerUntil(p) {
  try {
    return num(p.getDynamicProperty(PLAYER_PROP));
  } catch {
    return 0;
  }
}
function playLeft(p) {
  try {
    return num(p.getDynamicProperty(LEFT_PROP));
  } catch {
    return 0;
  }
}
// When this player's grace ends (ms), or 0.
export function graceUntil(p) {
  if (p?.typeId !== "minecraft:player") return 0;
  const left = playLeft(p);
  const t = Math.max(worldUntil(), playerUntil(p), left > 0 ? Date.now() + left * 1000 : 0);
  return t > Date.now() ? t : 0;
}
export const isGraced = (e) => graceUntil(e) > 0;
const left = (until) => {
  const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// The player behind an attack: the player, or the owner of the clone / companion / summon.
function playerBehind(e) {
  if (!e) return undefined;
  if (e.typeId === "minecraft:player") return e;
  try {
    const owner = e.getDynamicProperty("aegis:owner");
    const o = owner ? world.getEntity(owner) : undefined;
    return o?.typeId === "minecraft:player" ? o : undefined;
  } catch {
    return undefined;
  }
}

// Gives back a hit that shouldn't have landed (and puts out any fire it lit).
function undo(p, damage) {
  try {
    const h = p.getComponent("minecraft:health");
    if (h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
    p.extinguishFire?.();
  } catch {
    /* ignore */
  }
}

// Who started it: enemy id -> Map(player id -> the tick of that player's last blow on it). Only players with grace.
const provoked = new Map();
const lastBlow = new Map(); // player id -> the tick they last struck an enemy
export function provokedBy(enemy, p) {
  const t = provoked.get(enemy?.id)?.get(p?.id);
  return t !== undefined && system.currentTick - t < PROVOKE_TICKS;
}
// Is this player (with grace) in a fight they started?
export const isFighting = (p) => system.currentTick - (lastBlow.get(p?.id) ?? -1e9) < PROVOKE_TICKS;
// May `enemy` attack player `p`? Anyone without grace: yes. A player with grace: only an enemy they've struck — or,
// where the script doesn't say which enemy is asking, only while they're fighting.
export function mayFight(p, enemy) {
  if (!isGraced(p)) return true;
  return enemy ? provokedBy(enemy, p) : isFighting(p);
}
function noteBlow(enemy, p) {
  const now = system.currentTick;
  let m = provoked.get(enemy.id);
  if (!m) provoked.set(enemy.id, (m = new Map()));
  m.set(p.id, now);
  const wasFighting = isFighting(p);
  lastBlow.set(p.id, now);
  if (!wasFighting) {
    protect(p, graceUntil(p)); // drop to Resistance III at once, so the fight is real
    p.onScreenDisplay?.setActionBar(`§eYou attacked — it fights back! §7(your grace still stops players, and its hits are ${GRACE_SOFTER} softer)`);
  }
}

// Does grace stop `attacker` from hurting `target`? (used by every scripted attack in the add-on)
//   • player against player: never while either has grace (a player's clones, companions and summons count as them);
//   • an enemy against a player with grace: only one that player has attacked may hurt them.
export function graceBlocks(target, attacker) {
  if (target?.typeId !== "minecraft:player") return false;
  const a = playerBehind(attacker);
  if (a) return a.id !== target.id && (isGraced(target) || isGraced(a));
  return !!attacker && isGraced(target) && !provokedBy(attacker, target);
}

let api;
const graced = new Set(); // players who had grace at the last check
const warned = new Map(); // player id -> last warning given (60 / 10 s)

function protect(p, until) {
  try {
    if (!p.hasTag(GRACE_TAG)) p.addTag(GRACE_TAG);
    const amp = isFighting(p) ? FIGHT_AMP : SAFE_AMP;
    const r = p.getEffect("resistance");
    if (r && r.amplifier === SAFE_AMP && amp !== SAFE_AMP) p.removeEffect("resistance"); // (a weaker effect can't replace a stronger one)
    p.addEffect("resistance", 50, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
  const s = (until - Date.now()) / 1000;
  const step = s <= 10 ? 10 : s <= 60 ? 60 : 0;
  if (step && warned.get(p.id) !== step) {
    warned.set(p.id, step);
    p.sendMessage(`§eYour grace period ends in ${step === 60 ? "1 minute" : "10 seconds"}.`);
  }
}

function unprotect(p, announce) {
  try {
    p.removeTag(GRACE_TAG);
    const r = p.getEffect("resistance");
    if (r && (r.amplifier === FIGHT_AMP || r.amplifier === SAFE_AMP)) p.removeEffect("resistance");
  } catch {
    /* ignore */
  }
  warned.delete(p.id);
  if (announce) {
    showTitle(p, "§cGrace period over", { subtitle: "§7Players and enemies can attack you again — stay sharp!", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
    api?.sound(p.dimension, "mob.wither.ambient", p.location, 0.4, 1.4);
  }
}

function tick() {
  for (const p of world.getAllPlayers()) {
    const left = playLeft(p); // a new player's play-time grace only runs while they're online
    if (left > 0) p.setDynamicProperty(LEFT_PROP, left - 1 > 0 ? left - 1 : undefined);
    const until = graceUntil(p);
    if (until) {
      protect(p, until);
      graced.add(p.id);
    } else if (graced.has(p.id) || p.hasTag?.(GRACE_TAG)) {
      graced.delete(p.id);
      unprotect(p, true);
    }
  }
}

function findPlayer(name) {
  const n = name.toLowerCase();
  const all = world.getAllPlayers();
  return all.find((p) => p.name.toLowerCase() === n) ?? all.find((p) => p.name.toLowerCase().startsWith(n));
}

function start(minutes, target, by) {
  const until = Date.now() + minutes * 60000;
  const len = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  if (target) {
    target.setDynamicProperty(PLAYER_PROP, until);
    showTitle(target, "§aGrace period", { subtitle: `§7No PvP for ${len}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
    target.sendMessage(`§aYou have a grace period of ${len}: no player can hurt you, and you can't hurt players. Enemies leave you alone — unless you attack them: then they fight back, ${GRACE_SOFTER} softer.`);
    if (by && by.id !== target.id) by.sendMessage(`§a${target.name} has grace for ${len}.`);
  } else {
    world.setDynamicProperty(WORLD_PROP, until);
    world.sendMessage(`§a§lGrace period: ${len}.§r §7Players can't hurt each other, and enemies leave everyone alone — unless attacked: then they fight back, ${GRACE_SOFTER} softer. Train, hunt and get ready!`);
    for (const p of world.getAllPlayers()) showTitle(p, "§aGrace period", { subtitle: `§7No PvP for ${len}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
  }
  tick();
}

function stop(target, by) {
  if (target) {
    target.setDynamicProperty(PLAYER_PROP, undefined);
    target.setDynamicProperty(LEFT_PROP, undefined);
    if (!worldUntil() || worldUntil() <= Date.now()) by?.sendMessage(`§7${target.name}'s grace period ended.`);
    else by?.sendMessage(`§7${target.name}'s own grace ended, but everyone's grace is still on (${left(worldUntil())}).`);
  } else {
    world.setDynamicProperty(WORLD_PROP, undefined);
    for (const p of world.getAllPlayers()) {
      p.setDynamicProperty(PLAYER_PROP, undefined);
      p.setDynamicProperty(LEFT_PROP, undefined);
    }
    world.sendMessage("§cThe grace period has been ended.");
  }
  tick();
}

export const startGrace = (minutes, target, by) => start(minutes, target, by);
export const stopGrace = (target, by) => stop(target, by);

export function graceLines() {
  const w = worldUntil() > Date.now() ? worldUntil() : 0;
  const lines = [w ? `§aEveryone has grace: §f${left(w)} left` : "§7No grace period for everyone."];
  for (const p of world.getAllPlayers()) {
    const own = Math.max(playerUntil(p), playLeft(p) > 0 ? Date.now() + playLeft(p) * 1000 : 0);
    if (own > Date.now() && own > w) lines.push(`§a${p.name}§7: §f${left(own)} left${playLeft(p) > 0 ? " §8(new-player grace, play time)" : ""}`);
  }
  return lines;
}
export const graceLeftText = (p) => (graceUntil(p) ? left(graceUntil(p)) : "");
export const GRACE_MAX_MINUTES = MAX_MINUTES;

function status(by) {
  by.sendMessage(graceLines().join("\n"));
}

// A brand-new shinobi (never been on this server): 1 hour of play-time grace.
function welcome(p) {
  if (p.getDynamicProperty(JOINED_PROP)) return;
  p.setDynamicProperty(JOINED_PROP, true);
  // (the levels module sets a newcomer's level and XP on this same spawn, so look for real progress, not for the keys)
  const veteran = ["aegis:village", "aegis:rogue_of", "aegis:starter_kit"].some((k) => p.getDynamicProperty(k) !== undefined) ||
    num(p.getDynamicProperty("aegis:level")) > 1 || num(p.getDynamicProperty("aegis:xp")) > 0;
  if (veteran) return; // (players from before this update)
  p.setDynamicProperty(LEFT_PROP, NEW_PLAYER_GRACE);
  system.runTimeout(() => {
    if (!api.isValid(p)) return;
    p.sendMessage(`§aWelcome, shinobi! You have a §l1-hour grace period§r§a (counted while you play): no player can hurt you, and you can't hurt players. Ninja, bosses and monsters leave you alone — unless you attack them: then they fight back, ${GRACE_SOFTER} softer. Explore, train and get ready!`);
  }, 100);
}

export function initGrace(helpers) {
  api = helpers;
  system.runInterval(tick, 20);
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (initialSpawn) welcome(player);
  });

  // Every hurt event: (Scripted attacks — jutsu, sword arts, combo bonuses — are stopped before they land: graceBlocks.)
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (damage <= 0 || !hurtEntity) return;
    const by = damageSource?.damagingEntity;
    const a = playerBehind(by);
    // a player with grace strikes an enemy (or any creature that isn't a player's): from now on it may fight back
    if (hurtEntity.typeId !== "minecraft:player") {
      if (a && isGraced(a) && !playerBehind(hurtEntity)) noteBlow(hurtEntity, a);
      return;
    }
    if (!isGraced(hurtEntity) && !(a && isGraced(a))) return;
    if (a) {
      // a blow from a player on a player (a sword, an arrow, a clone's or a summon's hit) when either has grace: undone
      if (a.id === hurtEntity.id) return;
      undo(hurtEntity, damage);
      a.onScreenDisplay?.setActionBar(isGraced(a)
        ? `§aYou have a grace period §7— you can't hurt players for another §f${left(graceUntil(a))}`
        : `§a${hurtEntity.name} has a grace period §7— players can't hurt them for another §f${left(graceUntil(hurtEntity))}`);
      return;
    }
    // an enemy's (or a monster's) hit on a player with grace who never attacked it: undone too
    if (by && !provokedBy(by, hurtEntity)) undo(hurtEntity, damage);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    provoked.delete(deadEntity?.id);
  });
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [id, m] of provoked) {
      for (const [pid, t] of m) if (now - t >= PROVOKE_TICKS) m.delete(pid);
      if (!m.size) provoked.delete(id);
    }
    for (const [pid, t] of lastBlow) if (now - t >= PROVOKE_TICKS) lastBlow.delete(pid);
  }, 1200);

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:grace") return;
    const by = sourceEntity?.typeId === "minecraft:player" ? sourceEntity : undefined;
    const reply = (m) => (by ? by.sendMessage(m) : world.sendMessage(m));
    const words = String(message ?? "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return by ? status(by) : undefined;
    const name = words.slice(1).join(" ");
    const target = name ? findPlayer(name) : undefined;
    if (name && !target) return reply(`§cNo player online called "${name}".`);
    if (words[0].toLowerCase() === "off") return stop(target, by);
    const minutes = Math.floor(Number(words[0]));
    if (!Number.isFinite(minutes) || minutes <= 0) return reply("§7Usage: §f/scriptevent aegis:grace <minutes> [player]§7 · §f… off [player]§7 · §f…§7 alone shows what's left");
    start(Math.min(MAX_MINUTES, minutes), target, by);
  });
}
