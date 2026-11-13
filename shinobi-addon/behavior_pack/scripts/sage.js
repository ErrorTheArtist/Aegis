// Sage Mode: learned from the Jutsu Sensei (Lv 60). Hold sneak and stand still for 5 seconds to
// gather natural energy, then enter Sage Mode for 60 seconds:
//   Strength II, Speed II, Resistance, Jump Boost, +50% damage for all techniques,
//   full chakra on entering, and you sense hostile mobs within 32 blocks.
// 2 minute cooldown after it ends.
//   /scriptevent aegis:sage learn   — learn it instantly (testing)

import { world, system } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { isTransformed } from "./bijuu.js";
import { transformCinematic, aura } from "./cinematic.js";

const SAGE_PROP = "aegis:sage";
const GATHER_TICKS = 100;
const DURATION = 1200;
const COOLDOWN = 2400;
const ORANGE = [1.0, 0.55, 0.1];
const GREEN = [0.4, 0.95, 0.4];

let api;
const gathering = new Map(); // player id -> ticks gathered
const active = new Map(); // player id -> tick Sage Mode ends
const lastPos = new Map();

export const hasSageTraining = (p) => {
  try {
    return p.getDynamicProperty(SAGE_PROP) === true;
  } catch {
    return false;
  }
};
export const inSageMode = (p) => active.has(p?.id);
export const sageMultiplier = (p) => (inSageMode(p) ? 1.5 : 1);

export function grantSage(player) {
  player.setDynamicProperty(SAGE_PROP, true);
  showTitle(player, "§6Sage Training complete", { subtitle: "§7Sneak and stay still for 5s to gather natural energy", stayDuration: 70 });
  api.sound(player.dimension, "random.levelup", player.location, 1, 0.7);
}

function eff(p, id, amp) {
  try {
    p.addEffect(id, 30, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}

function enter(player) {
  active.set(player.id, system.currentTick + DURATION);
  gathering.delete(player.id);
  api.setChakra(player, api.getMaxChakra(player));
  transformCinematic(player, { color: [0.35, 0.95, 0.35], title: "§6Sage Mode", subtitle: "§7Natural energy flows through you" });
  api.sound(player.dimension, "beacon.activate", player.location, 1, 0.8);
}

function leave(player) {
  active.delete(player.id);
  api.startCooldown(player, "sage_mode", COOLDOWN);
  player.onScreenDisplay.setActionBar("§7Sage Mode fades…");
}

function tick() {
  const now = system.currentTick;
  for (const p of world.getAllPlayers()) {
    if (!hasSageTraining(p)) continue;
    const loc = p.location;
    const prev = lastPos.get(p.id);
    lastPos.set(p.id, loc);

    const end = active.get(p.id);
    if (end !== undefined) {
      if (now >= end) {
        leave(p);
        continue;
      }
      eff(p, "strength", 1);
      eff(p, "speed", 1);
      eff(p, "resistance", 0);
      eff(p, "jump_boost", 1);
      api.particle(p.dimension, "aegis:beast_aura", loc, ORANGE);
      if (now % 10 < 5) aura(p, [0.35, 0.95, 0.35]);
      if (now % 20 === 0) {
        // sense hostile life nearby
        for (const e of p.dimension.getEntities({ location: loc, maxDistance: 32, families: ["monster"] })) {
          api.particle(p.dimension, "aegis:byakugan_mark", api.add(e.location, { x: 0, y: 2.3, z: 0 }));
        }
        const left = Math.ceil((end - now) / 20);
        if (left <= 10) p.onScreenDisplay.setActionBar(`§6Sage Mode §7— ${left}s`);
      }
      continue;
    }

    const still = prev && Math.abs(prev.x - loc.x) < 0.05 && Math.abs(prev.z - loc.z) < 0.05;
    if (!p.isSneaking || !still || isTransformed(p) || api.cooldownLeft(p, "sage_mode") > 0) {
      gathering.delete(p.id);
      continue;
    }
    const g = (gathering.get(p.id) ?? 0) + 5;
    gathering.set(p.id, g);
    const need = GATHER_TICKS;
    if (g >= 20) {
      api.particle(p.dimension, "aegis:beast_aura", loc, GREEN);
      const n = Math.min(10, Math.floor((g / need) * 10));
      p.onScreenDisplay.setActionBar(`§aGathering natural energy ${"§2■".repeat(n)}${"§8■".repeat(10 - n)}`);
    }
    if (g >= need) enter(p);
  }
}

export function initSage(helpers) {
  api = helpers;
  system.runInterval(tick, 5);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:sage" || sourceEntity?.typeId !== "minecraft:player") return;
    if (message.trim().toLowerCase() === "learn") grantSage(sourceEntity);
    else sourceEntity.sendMessage("§7Usage: /scriptevent aegis:sage learn");
  });
}
