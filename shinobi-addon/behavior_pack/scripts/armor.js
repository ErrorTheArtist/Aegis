// Armor sets: wearing a full set gives a bonus on top of each piece's protection.

import { world, system } from "@minecraft/server";

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
  hokage: {
    name: "§fHokage",
    pieces: { Head: "aegis:hokage_hat", Chest: "aegis:hokage_robe" },
    effects: [["strength", 0], ["regeneration", 0]], chakra: 100, regen: 1.5,
    desc: "+100 max chakra, +50% chakra regen, Strength, Regeneration",
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

export function initArmor(helpers) {
  api = helpers;
  system.runInterval(tick, 20);
}
