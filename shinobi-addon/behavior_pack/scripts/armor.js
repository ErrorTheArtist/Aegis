// Armor sets: wearing a full set gives a bonus on top of each piece's protection.

import { world, system, ItemStack } from "@minecraft/server";

function kagePieces(v) {
  return { Head: `aegis:${v}_hat`, Chest: `aegis:${v}_robe`, Legs: `aegis:${v}_pants`, Feet: `aegis:${v}_sandals` };
}

export const KAGE_VILLAGES = {
  hokage: { title: "§cHokage", village: "Hidden Leaf", icon: "🍃" },
  kazekage: { title: "§2Kazekage", village: "Hidden Sand", icon: "🏜" },
  mizukage: { title: "§9Mizukage", village: "Hidden Mist", icon: "🌊" },
  raikage: { title: "§eRaikage", village: "Hidden Cloud", icon: "⚡" },
  tsuchikage: { title: "§6Tsuchikage", village: "Hidden Stone", icon: "🪨" },
};
const KAGE_PROP = "aegis:kage";

const SETS = {
  leaf: {
    name: "§2Leaf Shinobi",
    pieces: { Head: "aegis:headband", Chest: "aegis:flak_jacket", Legs: "aegis:shinobi_pants", Feet: "aegis:ninja_sandals" },
    effects: [["speed", 0], ["resistance", 0]], regen: 1.25,
    desc: "Speed, Resistance, +25% chakra regen",
  },
  anbu: {
    name: "§7Anbu",
    pieces: { Head: "aegis:anbu_mask", Chest: "aegis:anbu_armor", Legs: "aegis:shinobi_pants", Feet: "aegis:ninja_sandals" },
    effects: [["speed", 1], ["night_vision", 0]], sneakInvisible: true,
    desc: "Speed II, night vision, invisible while sneaking",
  },
  akatsuki: {
    name: "§cAkatsuki",
    pieces: { Head: "aegis:akatsuki_hat", Chest: "aegis:akatsuki_cloak" },
    effects: [["fire_resistance", 0]], chakra: 60, damage: 1.2,
    desc: "+60 max chakra, +20% technique damage, fire resistance",
  },
  samurai: {
    name: "§4Samurai",
    pieces: { Head: "aegis:samurai_helmet", Chest: "aegis:samurai_armor", Legs: "aegis:samurai_leggings", Feet: "aegis:samurai_boots" },
    effects: [["resistance", 1], ["strength", 0]],
    desc: "Resistance II, Strength",
  },
  // ---- The Five Kage (Kage exam reward, or appointed with /scriptevent aegis:kage <village>) ----
  hokage: {
    name: "§cHokage", kage: true,
    pieces: kagePieces("hokage"),
    effects: [["strength", 0], ["regeneration", 0], ["fire_resistance", 0]], chakra: 100, regen: 1.5,
    desc: "Will of Fire: +100 max chakra, +50% chakra regen, Strength, Regeneration, Fire Resistance",
  },
  kazekage: {
    name: "§2Kazekage", kage: true,
    pieces: kagePieces("kazekage"),
    effects: [["resistance", 1], ["speed", 0]], chakra: 120, regen: 1.3, sandShield: 0.3,
    desc: "Sand Shield: 30% chance to block a hit, +120 max chakra, Resistance II, Speed",
  },
  mizukage: {
    name: "§9Mizukage", kage: true,
    pieces: kagePieces("mizukage"),
    effects: [["conduit_power", 0], ["speed", 0]], chakra: 100, regen: 1.5, damage: 1.15, sneakInvisible: true,
    desc: "Hidden Mist: invisible while sneaking, +15% technique damage, +100 max chakra, breathe underwater",
  },
  raikage: {
    name: "§eRaikage", kage: true,
    pieces: kagePieces("raikage"),
    effects: [["speed", 1], ["strength", 1], ["haste", 1]], chakra: 80, damage: 1.15, lightningFists: 0.35,
    desc: "Lightning Armor: punches crackle with lightning, Speed II, Strength II, +15% technique damage",
  },
  tsuchikage: {
    name: "§6Tsuchikage", kage: true,
    pieces: kagePieces("tsuchikage"),
    effects: [["resistance", 2], ["jump_boost", 1]], chakra: 100, regen: 1.3, sneakFloat: true,
    desc: "Flight Jutsu: float while sneaking in the air, Resistance III, Jump Boost II, +100 max chakra",
  },
};

let api;
const active = new Map(); // player id -> Set of set ids

function equipment(player) {
  const out = {};
  try {
    const eq = player.getComponent("minecraft:equippable");
    for (const slot of ["Head", "Chest", "Legs", "Feet"]) out[slot] = eq?.getEquipment(slot)?.typeId;
  } catch {
    /* ignore */
  }
  return out;
}

function setsOf(player) {
  const eq = equipment(player);
  const on = new Set();
  for (const [id, s] of Object.entries(SETS)) {
    if (Object.entries(s.pieces).every(([slot, item]) => eq[slot] === item)) on.add(id);
  }
  return on;
}

const has = (player, key) => [...(active.get(player.id) ?? [])].map((id) => SETS[id][key]).filter((v) => v !== undefined);
export const armorChakraBonus = (player) => has(player, "chakra").reduce((a, b) => a + b, 0);
export const armorRegenMultiplier = (player) => has(player, "regen").reduce((a, b) => a * b, 1);
export const armorDamageMultiplier = (player) => (player?.typeId === "minecraft:player" ? has(player, "damage").reduce((a, b) => a * b, 1) : 1);

function tick() {
  for (const p of world.getAllPlayers()) {
    const now = setsOf(p);
    const before = active.get(p.id) ?? new Set();
    for (const id of now) if (!before.has(id)) p.onScreenDisplay.setActionBar(`${SETS[id].name} set bonus§7: ${SETS[id].desc}`);
    active.set(p.id, now);
    for (const id of now) {
      const s = SETS[id];
      for (const [effect, amp] of s.effects) {
        try {
          p.addEffect(effect, 50, { amplifier: amp, showParticles: false });
        } catch {
          /* ignore */
        }
      }
      if (s.sneakInvisible && p.isSneaking) {
        try {
          p.addEffect("invisibility", 30, { amplifier: 0, showParticles: false });
        } catch {
          /* ignore */
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Kage titles
// ---------------------------------------------------------------------------
export function getKage(player) {
  try {
    const v = player.getDynamicProperty(KAGE_PROP);
    return KAGE_VILLAGES[v] ? v : undefined;
  } catch {
    return undefined;
  }
}

// Gives the full set for a village and records the title. Returns false if the village is unknown.
export function giveKageSet(player, village) {
  if (!KAGE_VILLAGES[village]) return false;
  player.setDynamicProperty(KAGE_PROP, village);
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (const id of Object.values(SETS[village].pieces)) {
    const stack = new ItemStack(id, 1);
    try {
      if (inv?.addItem(stack)) player.dimension.spawnItem(stack, player.location);
    } catch {
      player.dimension.spawnItem(stack, player.location);
    }
  }
  return true;
}

function setKage(player, village) {
  if (village) player.setDynamicProperty(KAGE_PROP, village);
  else player.setDynamicProperty(KAGE_PROP, undefined);
  api.refreshName?.(player);
}

function floatTick() {
  for (const p of world.getAllPlayers()) {
    if (!active.get(p.id)?.size || !p.isSneaking || p.isOnGround) continue;
    if (![...active.get(p.id)].some((id) => SETS[id].sneakFloat)) continue;
    try {
      p.addEffect("slow_falling", 10, { amplifier: 0, showParticles: false });
      api.particle(p.dimension, "aegis:dust", p.location);
    } catch {
      /* ignore */
    }
  }
}

export function initArmor(helpers) {
  api = helpers;
  system.runInterval(tick, 20);
  system.runInterval(floatTick, 4);

  // Kazekage — Sand Shield: sometimes the sand blocks a hit completely.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player" || damage <= 0) return;
    const chance = has(hurtEntity, "sandShield")[0];
    if (!chance || Math.random() > chance) return;
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
      api.particle(hurtEntity.dimension, "aegis:dust", hurtEntity.location);
      api.particle(hurtEntity.dimension, "aegis:cine_ring", hurtEntity.location, [0.85, 0.72, 0.45]);
      api.sound(hurtEntity.dimension, "dig.sand", hurtEntity.location, 1, 0.7);
      hurtEntity.onScreenDisplay.setActionBar("§6Sand Shield!");
    } catch {
      /* ignore */
    }
  });

  // Raikage — Lightning Armor: punches crackle with lightning.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== "minecraft:player" || !api.isValid(hitEntity)) return;
    const chance = has(damagingEntity, "lightningFists")[0];
    if (!chance || Math.random() > chance || !api.canBeHit(hitEntity, damagingEntity)) return;
    api.hurt(hitEntity, 4, damagingEntity, "lightning");
    api.particle(hitEntity.dimension, "aegis:chidori", { x: hitEntity.location.x, y: hitEntity.location.y + 1, z: hitEntity.location.z });
    api.sound(hitEntity.dimension, "ambient.weather.lightning.impact", hitEntity.location, 0.4, 1.8);
    try {
      hitEntity.addEffect("slowness", 30, { amplifier: 2 });
    } catch {
      /* ignore */
    }
  });

  // /scriptevent aegis:kage <hokage|kazekage|mizukage|raikage|tsuchikage> — appoint the player who runs it
  //   (use /execute as <player> run scriptevent ... to appoint someone else)
  // /scriptevent aegis:kage title <village> — set the title only, no items
  // /scriptevent aegis:kage clear — remove the title
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:kage" || sourceEntity?.typeId !== "minecraft:player") return;
    const [a, b] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    if (a === "clear") {
      setKage(sourceEntity, undefined);
      return sourceEntity.sendMessage("§7Kage title removed.");
    }
    if (a === "title" && KAGE_VILLAGES[b]) {
      setKage(sourceEntity, b);
      return sourceEntity.sendMessage(`§7You are now the ${KAGE_VILLAGES[b].title}§7.`);
    }
    if (KAGE_VILLAGES[a]) {
      giveKageSet(sourceEntity, a);
      setKage(sourceEntity, a);
      world.sendMessage(`§e${sourceEntity.name} has been named the ${KAGE_VILLAGES[a].title}§e of the ${KAGE_VILLAGES[a].village}!`);
      return;
    }
    sourceEntity.sendMessage("§7Usage: /scriptevent aegis:kage <hokage|kazekage|mizukage|raikage|tsuchikage|title <village>|clear>");
  });
}
