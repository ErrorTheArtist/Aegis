// Grace period (v1.53) — a no-fighting window an admin can give everyone (when the server opens, before an event…) or
// a single player. While a player has grace:
//   • nothing can hurt them — players, enemy ninja, bosses, mobs (they get an invisible Resistance V);
//   • enemy ninja, Akatsuki, legends and Tailed Beasts ignore them — no chasing, no jutsu;
//   • they can't hurt other players, nor the add-on's ninja and bosses (no free boss kills while untouchable).
// Gathering, building, travelling, quests, shops — everything else works as usual.
//   /scriptevent aegis:grace 10           — 10 minutes for everyone (players who join meanwhile get it too)
//   /scriptevent aegis:grace 5 Steve      — 5 minutes for one player
//   /scriptevent aegis:grace off          — end every grace period now
//   /scriptevent aegis:grace off Steve    — end one player's
//   /scriptevent aegis:grace              — how long is left

import { world, system } from "@minecraft/server";
import { showTitle } from "./hud.js";

const WORLD_PROP = "aegis:grace_until"; // world: everyone's grace ends at this time (ms)
const PLAYER_PROP = "aegis:grace_until"; // player: their own grace ends at this time (ms)
export const GRACE_TAG = "aegis_grace"; // the add-on's mobs won't target a player with this tag
const MAX_MINUTES = 24 * 60;
// what a player with grace may not hurt (besides other players)
const ENEMIES = new Set(["aegis:hostile_ninja", "aegis:akatsuki", "aegis:legend",
  ...["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"].map((b) => `aegis:${b}`)]);

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const worldUntil = () => num(world.getDynamicProperty(WORLD_PROP));
function playerUntil(p) {
  try {
    return num(p.getDynamicProperty(PLAYER_PROP));
  } catch {
    return 0;
  }
}
// When this player's grace ends (ms), or 0.
export function graceUntil(p) {
  if (p?.typeId !== "minecraft:player") return 0;
  const t = Math.max(worldUntil(), playerUntil(p));
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

// Does grace stop `attacker` from hurting `target`? (used by every scripted attack in the add-on)
export function graceBlocks(target, attacker) {
  if (isGraced(target)) return true;
  const p = playerBehind(attacker);
  if (!p || !isGraced(p) || p.id === target?.id) return false;
  return target?.typeId === "minecraft:player" || ENEMIES.has(target?.typeId);
}

let api;
const graced = new Set(); // players who had grace at the last check
const warned = new Map(); // player id -> last warning given (60 / 10 s)

function protect(p, until) {
  try {
    if (!p.hasTag(GRACE_TAG)) p.addTag(GRACE_TAG);
    p.addEffect("resistance", 50, { amplifier: 4, showParticles: false }); // Resistance V: no damage at all
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
    if (r && r.amplifier >= 4) p.removeEffect("resistance");
  } catch {
    /* ignore */
  }
  warned.delete(p.id);
  if (announce) {
    showTitle(p, "§cGrace period over", { subtitle: "§7Fighting is back on — stay sharp!", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
    api?.sound(p.dimension, "mob.wither.ambient", p.location, 0.4, 1.4);
  }
}

function tick() {
  for (const p of world.getAllPlayers()) {
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
    showTitle(target, "§aGrace period", { subtitle: `§7No fighting for ${len}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
    target.sendMessage(`§aYou have a grace period of ${len}: nothing can hurt you, and you can't fight other players or bosses.`);
    if (by && by.id !== target.id) by.sendMessage(`§a${target.name} has grace for ${len}.`);
  } else {
    world.setDynamicProperty(WORLD_PROP, until);
    world.sendMessage(`§a§lGrace period: ${len}.§r §7Nobody can be hurt and nobody can fight — players, ninja and bosses alike. Gather, build and get ready!`);
    for (const p of world.getAllPlayers()) showTitle(p, "§aGrace period", { subtitle: `§7No fighting for ${len}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
  }
  tick();
}

function stop(target, by) {
  if (target) {
    target.setDynamicProperty(PLAYER_PROP, undefined);
    if (!worldUntil() || worldUntil() <= Date.now()) by?.sendMessage(`§7${target.name}'s grace period ended.`);
    else by?.sendMessage(`§7${target.name}'s own grace ended, but everyone's grace is still on (${left(worldUntil())}).`);
  } else {
    world.setDynamicProperty(WORLD_PROP, undefined);
    for (const p of world.getAllPlayers()) p.setDynamicProperty(PLAYER_PROP, undefined);
    world.sendMessage("§cThe grace period has been ended.");
  }
  tick();
}

function status(by) {
  const w = worldUntil() > Date.now() ? worldUntil() : 0;
  const lines = [w ? `§aEveryone has grace: §f${left(w)} left` : "§7No grace period for everyone."];
  for (const p of world.getAllPlayers()) {
    const own = playerUntil(p);
    if (own > Date.now() && own > w) lines.push(`§a${p.name}§7: §f${left(own)} left`);
  }
  by.sendMessage(lines.join("\n"));
}

export function initGrace(helpers) {
  api = helpers;
  system.runInterval(tick, 20);

  // what Resistance can't catch: a player with grace landing a blow on another player or on a ninja / boss
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (damage <= 0) return;
    const p = playerBehind(damageSource?.damagingEntity);
    if (!p || !isGraced(p) || p.id === hurtEntity.id) return;
    if (hurtEntity.typeId !== "minecraft:player" && !ENEMIES.has(hurtEntity.typeId)) return;
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
    } catch {
      /* ignore */
    }
    p.onScreenDisplay?.setActionBar(`§aGrace period §7— no fighting for another §f${left(graceUntil(p))}`);
  });

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
