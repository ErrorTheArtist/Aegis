// Clan system: on a player's first join they "roll" a clan with weighted rarity.
// Each clan gives max-chakra / regen bonuses, passive effects and a clan-only ability item.
//
// Admin commands (cheats on):
//   /scriptevent aegis:clan reroll          — reroll your clan (with the animation)
//   /scriptevent aegis:clan set uchiha      — set your clan directly
//   /scriptevent aegis:clan info            — show your clan

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";

const CLAN_PROP = "aegis:clan";

export const RARITY = {
  common: { label: "COMMON", color: "§f" },
  rare: { label: "RARE", color: "§9" },
  epic: { label: "EPIC", color: "§5" },
  legendary: { label: "LEGENDARY", color: "§6" },
};

// weight = chance out of 100. effects = permanent passives [effect, amplifier].
export const CLANS = {
  otsutsuki: {
    name: "Otsutsuki", color: "§d", rarity: "legendary", weight: 1,
    maxChakra: 250, regen: 2.0, effects: [["strength", 0], ["speed", 0], ["resistance", 0]],
    item: "aegis:rinnegan",
    perks: "Rinnegan (Almighty Push / sneak: Universal Pull), 250 chakra, Strength, Speed, Resistance",
  },
  senju: {
    name: "Senju", color: "§2", rarity: "legendary", weight: 3,
    maxChakra: 180, regen: 1.6, effects: [["regeneration", 0], ["health_boost", 1]],
    item: "aegis:wood_style",
    perks: "Wood Style (Wood Wall / sneak: Healing), 180 chakra, Regeneration, +4 hearts",
  },
  uchiha: {
    name: "Uchiha", color: "§c", rarity: "epic", weight: 6,
    maxChakra: 140, regen: 1.2, effects: [["fire_resistance", 0]],
    item: "aegis:sharingan",
    perks: "Sharingan (toggle: night vision + 30% dodge / sneak: Amaterasu), 140 chakra, Fire Resistance",
  },
  uzumaki: {
    name: "Uzumaki", color: "§6", rarity: "epic", weight: 7,
    maxChakra: 200, regen: 1.5, effects: [["health_boost", 0]],
    item: "aegis:sealing_chains",
    perks: "Adamantine Sealing Chains, 200 chakra, fast regen, +2 hearts",
  },
  hyuga: {
    name: "Hyuga", color: "§7", rarity: "epic", weight: 8,
    maxChakra: 130, regen: 1.2, effects: [],
    item: "aegis:byakugan",
    perks: "Byakugan (toggle: see all life nearby + Gentle Fist / sneak: Rotation), 130 chakra",
  },
  sarutobi: {
    name: "Sarutobi", color: "§4", rarity: "rare", weight: 9,
    maxChakra: 120, regen: 1.2, effects: [["fire_resistance", 0]],
    item: "aegis:flame_bullet",
    perks: "Fire Style: Flame Bullet (triple fireball), 120 chakra, Fire Resistance",
  },
  nara: {
    name: "Nara", color: "§8", rarity: "rare", weight: 11,
    maxChakra: 110, regen: 1.1, effects: [],
    item: "aegis:shadow_possession",
    perks: "Shadow Possession Jutsu (freeze a target), 110 chakra",
  },
  akimichi: {
    name: "Akimichi", color: "§e", rarity: "rare", weight: 11,
    maxChakra: 120, regen: 1.0, effects: [["health_boost", 0]],
    item: "aegis:expansion",
    perks: "Expansion Jutsu (Strength + Resistance + hearts), 120 chakra, +2 hearts",
  },
  aburame: {
    name: "Aburame", color: "§a", rarity: "rare", weight: 10,
    maxChakra: 110, regen: 1.1, effects: [],
    item: "aegis:insect_swarm",
    perks: "Parasitic Insect Swarm (poison + chakra drain), 110 chakra",
  },
  inuzuka: {
    name: "Inuzuka", color: "§b", rarity: "common", weight: 17,
    maxChakra: 100, regen: 1.0, effects: [["speed", 0], ["night_vision", 0]],
    item: "aegis:fang_over_fang",
    perks: "Fang Over Fang (sneak: summon ninja hound), Speed, Night Vision",
  },
  yamanaka: {
    name: "Yamanaka", color: "§3", rarity: "common", weight: 17,
    maxChakra: 100, regen: 1.1, effects: [],
    item: "aegis:mind_transfer",
    perks: "Mind Body Disturbance (confuse & stun a target)",
  },
};

let api; // helpers from main.js

// ---------------------------------------------------------------------------
// Clan data
// ---------------------------------------------------------------------------
export function getClanId(player) {
  try {
    const id = player.getDynamicProperty(CLAN_PROP);
    return typeof id === "string" && CLANS[id] ? id : undefined;
  } catch {
    return undefined;
  }
}

const getClan = (player) => CLANS[getClanId(player)];

export function clanMaxChakra(player, base) {
  return getClan(player)?.maxChakra ?? base;
}

export function clanRegenMultiplier(player) {
  return getClan(player)?.regen ?? 1;
}

function rollClanId() {
  const entries = Object.entries(CLANS);
  const total = entries.reduce((s, [, c]) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const [id, c] of entries) {
    r -= c.weight;
    if (r <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

function clanLabel(clan) {
  return `${clan.color}${clan.name}`;
}

function applyNameTag(player) {
  const clan = getClan(player);
  try {
    player.nameTag = clan ? `${clan.color}[${clan.name}]§r ${player.name}` : player.name;
  } catch {
    /* ignore */
  }
}

function hasItem(player, typeId) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return true;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === typeId) return true;
  try {
    const eq = player.getComponent("minecraft:equippable");
    if (eq?.getEquipment("Offhand")?.typeId === typeId) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function giveClanItem(player) {
  const clan = getClan(player);
  if (!clan || hasItem(player, clan.item)) return;
  try {
    const stack = new ItemStack(clan.item, 1);
    stack.lockMode = ItemLockMode.inventory; // can't drop it / give it away
    stack.keepOnDeath = true;
    player.getComponent("minecraft:inventory").container.addItem(stack);
  } catch {
    /* inventory full — will retry on next spawn */
  }
}

function removeClanItems(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  const ids = new Set(Object.values(CLANS).map((c) => c.item));
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && ids.has(it.typeId)) inv.setItem(i, undefined);
  }
}

function setClan(player, id) {
  removeClanItems(player);
  activeDojutsu.delete(player.id);
  player.setDynamicProperty(CLAN_PROP, id);
  api.setChakra(player, CLANS[id].maxChakra);
  applyNameTag(player);
  giveClanItem(player);
  refreshEffects(player, true);
}

// ---------------------------------------------------------------------------
// The roll — a slot-machine style animation, then the reveal.
// ---------------------------------------------------------------------------
function rollClan(player) {
  const finalId = rollClanId();
  const names = Object.values(CLANS);
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    // slows down towards the end
    const delay = Math.floor(2 + i * i * 0.12);
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      const c = i === steps - 1 ? CLANS[finalId] : names[Math.floor(Math.random() * names.length)];
      player.onScreenDisplay.setTitle(clanLabel(c), {
        subtitle: "§7Awakening your bloodline...",
        fadeInDuration: 0, stayDuration: 10, fadeOutDuration: 0,
      });
      api.sound(player.dimension, "random.click", player.location, 0.6, 1 + i / steps);
    }, delay);
  }
  const revealAt = Math.floor(2 + steps * steps * 0.12) + 12;
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const clan = CLANS[finalId];
    const rarity = RARITY[clan.rarity];
    setClan(player, finalId);
    player.onScreenDisplay.setTitle(clanLabel(clan) + " Clan", {
      subtitle: `${rarity.color}§l${rarity.label}`,
      fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 20,
    });
    const big = clan.rarity === "legendary" || clan.rarity === "epic";
    api.sound(player.dimension, big ? "ui.toast.challenge_complete" : "random.levelup", player.location, 1, 1);
    player.sendMessage(
      `§7You were born into the ${clanLabel(clan)} Clan§7 (${rarity.color}${rarity.label}§7)!\n§7Perks: §f${clan.perks}`
    );
    if (big) world.sendMessage(`§e${player.name} awakened the ${rarity.color}§l${rarity.label}§r ${clanLabel(clan)} Clan§e!`);
  }, revealAt);
}

// ---------------------------------------------------------------------------
// Passive effects
// ---------------------------------------------------------------------------
function refreshEffects(player, force = false) {
  const clan = getClan(player);
  if (!clan) return;
  const effects = [...clan.effects];
  const dojutsu = activeDojutsu.get(player.id);
  if (dojutsu) effects.push(["night_vision", 0]);
  for (const [id, amp] of effects) {
    try {
      const cur = player.getEffect(id);
      if (!force && cur && cur.duration > 260 && cur.amplifier >= amp) continue;
      player.addEffect(id, 600, { amplifier: amp, showParticles: false });
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------
const activeDojutsu = new Map(); // playerId -> "sharingan" | "byakugan"

function eff(entity, id, ticks, amp = 0) {
  try {
    entity.addEffect(id, ticks, { amplifier: amp, showParticles: true });
  } catch {
    /* ignore */
  }
}

function targetInView(player, range) {
  try {
    return player
      .getEntitiesFromViewDirection({ maxDistance: range })
      .map((h) => h.entity)
      .find((e) => api.canBeHit(e, player));
  } catch {
    return undefined;
  }
}

function nearbyTargets(player, radius) {
  return player.dimension
    .getEntities({ location: player.location, maxDistance: radius })
    .filter((e) => api.canBeHit(e, player));
}

function noTarget(player) {
  player.onScreenDisplay.setActionBar("§7No target in sight.");
  return false;
}

function line(player, from, to, particleId) {
  const d = api.sub(to, from);
  const steps = Math.ceil(Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) * 2);
  for (let i = 0; i <= steps; i++) api.particle(player.dimension, particleId, api.add(from, api.scale(d, i / steps)));
}

function toggleDojutsu(player, kind, label) {
  if (activeDojutsu.get(player.id) === kind) {
    activeDojutsu.delete(player.id);
    try {
      player.removeEffect("night_vision");
    } catch {
      /* ignore */
    }
    player.onScreenDisplay.setActionBar(`§7${label} deactivated.`);
    return false; // no chakra cost for turning off
  }
  if (api.getChakra(player) < 10) {
    player.onScreenDisplay.setActionBar("§cNot enough chakra!");
    return false;
  }
  activeDojutsu.set(player.id, kind);
  refreshEffects(player, true);
  api.sound(player.dimension, "mob.endermen.stare", player.location, 0.4, 1.8);
  player.onScreenDisplay.setActionBar(`§c${label}!`);
  return true;
}

// Each entry: normal use and (optional) sneak use. cost = chakra, cd = ticks.
const ABILITIES = {
  // ---- Uchiha ----
  "aegis:sharingan": {
    clan: "uchiha",
    use: { name: "Sharingan", cost: 0, cd: 10, cast: (p) => toggleDojutsu(p, "sharingan", "Sharingan") },
    sneak: {
      name: "Amaterasu", cost: 50, cd: 300,
      cast: (p) => {
        if (activeDojutsu.get(p.id) !== "sharingan") {
          p.onScreenDisplay.setActionBar("§7Activate your Sharingan first.");
          return false;
        }
        const t = targetInView(p, 24);
        if (!t) return noTarget(p);
        api.sound(p.dimension, "mob.wither.shoot", p.location, 0.7, 0.6);
        for (let i = 0; i < 6; i++) {
          system.runTimeout(() => {
            if (!api.isValid(t)) return;
            for (let k = 0; k < 6; k++) {
              api.particle(t.dimension, "minecraft:dragon_breath_trail", api.add(t.location, { x: Math.random() - 0.5, y: Math.random() * 1.8, z: Math.random() - 0.5 }));
            }
            api.hurt(t, 3, p, "fire");
            try {
              t.setOnFire(8, true);
            } catch {
              /* ignore */
            }
          }, i * 20);
        }
        return true;
      },
    },
  },
  // ---- Hyuga ----
  "aegis:byakugan": {
    clan: "hyuga",
    use: { name: "Byakugan", cost: 0, cd: 10, cast: (p) => toggleDojutsu(p, "byakugan", "Byakugan") },
    sneak: {
      name: "Eight Trigrams Palm Rotation", cost: 30, cd: 160,
      cast: (p) => {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          api.particle(p.dimension, "minecraft:knockback_roar_particle", api.add(p.location, { x: Math.cos(a) * 2, y: 1, z: Math.sin(a) * 2 }));
        }
        api.sound(p.dimension, "mob.breeze.wind_burst", p.location, 1, 0.8);
        for (const e of nearbyTargets(p, 5)) {
          const away = api.norm({ x: e.location.x - p.location.x, y: 0, z: e.location.z - p.location.z });
          api.knockback(e, away.x, away.z, 2.5, 0.5);
          api.hurt(e, 5, p);
        }
        eff(p, "resistance", 40, 3);
        return true;
      },
    },
  },
  // ---- Otsutsuki ----
  "aegis:rinnegan": {
    clan: "otsutsuki",
    use: {
      name: "Almighty Push", cost: 50, cd: 200,
      cast: (p) => {
        api.particle(p.dimension, "minecraft:huge_explosion_emitter", p.location);
        for (let r = 1; r <= 8; r += 1.5) {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            api.particle(p.dimension, "minecraft:knockback_roar_particle", api.add(p.location, { x: Math.cos(a) * r, y: 0.5, z: Math.sin(a) * r }));
          }
        }
        api.sound(p.dimension, "random.explode", p.location, 1, 0.5);
        for (const e of nearbyTargets(p, 10)) {
          const away = api.norm({ x: e.location.x - p.location.x, y: 0, z: e.location.z - p.location.z });
          api.knockback(e, away.x, away.z, 4.5, 0.8);
          api.hurt(e, 8, p);
        }
        return true;
      },
    },
    sneak: {
      name: "Universal Pull", cost: 25, cd: 60,
      cast: (p) => {
        const t = targetInView(p, 30);
        if (!t) return noTarget(p);
        line(p, p.getHeadLocation(), t.location, "minecraft:portal_reverse_particle");
        const to = api.norm({ x: p.location.x - t.location.x, y: 0, z: p.location.z - t.location.z });
        api.knockback(t, to.x, to.z, 3, 0.4);
        api.sound(p.dimension, "mob.endermen.portal", t.location, 1, 0.6);
        return true;
      },
    },
  },
  // ---- Senju ----
  "aegis:wood_style": {
    clan: "senju",
    use: { name: "Wood Style: Wood Wall", cost: 35, cd: 200, cast: woodWall },
    sneak: {
      name: "Healing Jutsu", cost: 40, cd: 400,
      cast: (p) => {
        for (const pl of p.dimension.getPlayers({ location: p.location, maxDistance: 8 })) {
          eff(pl, "instant_health", 1, 1);
          eff(pl, "regeneration", 200, 1);
          api.particle(pl.dimension, "minecraft:villager_happy", api.add(pl.location, { x: 0, y: 1, z: 0 }));
        }
        api.sound(p.dimension, "random.levelup", p.location, 0.6, 1.4);
        return true;
      },
    },
  },
  // ---- Uzumaki ----
  "aegis:sealing_chains": {
    clan: "uzumaki",
    use: {
      name: "Adamantine Sealing Chains", cost: 35, cd: 200,
      cast: (p) => {
        const targets = nearbyTargets(p, 9);
        if (!targets.length) return noTarget(p);
        for (const e of targets) {
          line(p, api.add(p.location, { x: 0, y: 1, z: 0 }), api.add(e.location, { x: 0, y: 1, z: 0 }), "minecraft:electric_spark_particle");
          eff(e, "slowness", 100, 255);
          eff(e, "weakness", 100, 2);
          api.hurt(e, 4, p);
        }
        api.sound(p.dimension, "random.anvil_land", p.location, 0.6, 1.5);
        return true;
      },
    },
  },
  // ---- Sarutobi ----
  "aegis:flame_bullet": {
    clan: "sarutobi",
    use: {
      name: "Fire Style: Flame Bullet", cost: 40, cd: 80,
      cast: (p) => {
        const d = p.getViewDirection();
        for (const ang of [-0.25, 0, 0.25]) {
          const c = Math.cos(ang), s = Math.sin(ang);
          api.castFireball(p, { x: d.x * c - d.z * s, y: d.y, z: d.x * s + d.z * c });
        }
        return true;
      },
    },
  },
  // ---- Nara ----
  "aegis:shadow_possession": {
    clan: "nara",
    use: {
      name: "Shadow Possession Jutsu", cost: 30, cd: 160,
      cast: (p) => {
        const t = targetInView(p, 18);
        if (!t) return noTarget(p);
        for (let i = 0; i < 5; i++) {
          system.runTimeout(() => {
            if (api.isValid(t) && api.isValid(p)) line(p, p.location, t.location, "minecraft:dragon_breath_trail");
          }, i * 20);
        }
        eff(t, "slowness", 120, 255);
        eff(t, "weakness", 120, 4);
        eff(t, "mining_fatigue", 120, 4);
        eff(p, "slowness", 120, 1); // you're tied together
        api.sound(p.dimension, "mob.endermen.stare", t.location, 0.5, 0.5);
        p.onScreenDisplay.setActionBar("§8Shadow Possession — success!");
        return true;
      },
    },
  },
  // ---- Akimichi ----
  "aegis:expansion": {
    clan: "akimichi",
    use: {
      name: "Expansion Jutsu", cost: 40, cd: 400,
      cast: (p) => {
        eff(p, "strength", 300, 1);
        eff(p, "resistance", 300, 1);
        eff(p, "absorption", 300, 3);
        eff(p, "slowness", 300, 0);
        api.particle(p.dimension, "minecraft:huge_explosion_emitter", p.location);
        api.sound(p.dimension, "mob.irongolem.repair", p.location, 1, 0.6);
        return true;
      },
    },
  },
  // ---- Aburame ----
  "aegis:insect_swarm": {
    clan: "aburame",
    use: {
      name: "Parasitic Insect Swarm", cost: 25, cd: 120,
      cast: (p) => {
        const dir = p.getViewDirection();
        const hits = nearbyTargets(p, 10).filter((e) => api.dot(api.norm(api.sub(e.location, p.location)), dir) > 0.5);
        for (let d = 1; d <= 10; d++) api.particle(p.dimension, "minecraft:spore_blossom_shower_particle", api.add(p.getHeadLocation(), api.scale(dir, d)));
        if (!hits.length) return noTarget(p);
        for (const e of hits) {
          eff(e, "poison", 120, 1);
          eff(e, "weakness", 120, 1);
          api.particle(e.dimension, "minecraft:spore_blossom_shower_particle", api.add(e.location, { x: 0, y: 2, z: 0 }));
        }
        api.setChakra(p, api.getChakra(p) + 8 * hits.length); // insects feed you chakra
        api.sound(p.dimension, "mob.bee.aggressive", p.location, 1, 1);
        return true;
      },
    },
  },
  // ---- Inuzuka ----
  "aegis:fang_over_fang": {
    clan: "inuzuka",
    use: {
      name: "Fang Over Fang", cost: 25, cd: 80,
      cast: (p) => {
        const d = p.getViewDirection();
        const h = api.norm({ x: d.x, y: 0, z: d.z });
        api.knockback(p, h.x, h.z, 3.2, 0.3);
        const hit = new Set();
        for (let i = 1; i <= 12; i++) {
          system.runTimeout(() => {
            if (!api.isValid(p)) return;
            api.particle(p.dimension, "minecraft:knockback_roar_particle", p.location);
            for (const e of nearbyTargets(p, 2.5)) {
              if (hit.has(e.id)) continue;
              hit.add(e.id);
              api.hurt(e, 7, p);
            }
          }, i);
        }
        api.sound(p.dimension, "mob.wolf.growl", p.location, 1, 1.2);
        return true;
      },
    },
    sneak: {
      name: "Summon Ninja Hound", cost: 20, cd: 600,
      cast: (p) => {
        try {
          const wolf = p.dimension.spawnEntity("minecraft:wolf", p.location);
          wolf.getComponent("minecraft:tameable")?.tame(p);
          wolf.nameTag = `${p.name}'s Hound`;
          api.particle(p.dimension, "minecraft:large_explosion", p.location);
          api.sound(p.dimension, "mob.wolf.bark", p.location, 1, 1);
        } catch {
          return false;
        }
        return true;
      },
    },
  },
  // ---- Yamanaka ----
  "aegis:mind_transfer": {
    clan: "yamanaka",
    use: {
      name: "Mind Body Disturbance", cost: 25, cd: 120,
      cast: (p) => {
        const t = targetInView(p, 20);
        if (!t) return noTarget(p);
        line(p, p.getHeadLocation(), api.add(t.location, { x: 0, y: 1.5, z: 0 }), "minecraft:villager_happy");
        eff(t, "nausea", 200, 0);
        eff(t, "blindness", 100, 0);
        eff(t, "slowness", 100, 4);
        eff(t, "weakness", 160, 2);
        api.sound(p.dimension, "mob.evocation_illager.prepare_attack", t.location, 0.8, 1.4);
        return true;
      },
    },
  },
};

// Temporary wall of logs in front of the caster, removed after 10s.
function woodWall(p) {
  const dim = p.dimension;
  const d = p.getViewDirection();
  const fwd = Math.abs(d.x) > Math.abs(d.z) ? { x: Math.sign(d.x), z: 0 } : { x: 0, z: Math.sign(d.z) };
  const side = { x: -fwd.z, z: fwd.x };
  const base = { x: Math.floor(p.location.x) + fwd.x * 3, y: Math.floor(p.location.y), z: Math.floor(p.location.z) + fwd.z * 3 };
  const placed = [];
  for (let s = -2; s <= 2; s++) {
    for (let y = 0; y < 4; y++) {
      const loc = { x: base.x + side.x * s, y: base.y + y, z: base.z + side.z * s };
      try {
        const b = dim.getBlock(loc);
        if (b && b.isAir) {
          b.setType("minecraft:oak_log");
          placed.push(loc);
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!placed.length) return false;
  api.sound(dim, "dig.wood", p.location, 1, 0.6);
  system.runTimeout(() => {
    for (const loc of placed) {
      try {
        const b = dim.getBlock(loc);
        if (b?.typeId === "minecraft:oak_log") b.setType("minecraft:air");
      } catch {
        /* ignore */
      }
    }
  }, 200);
  return true;
}

export function handleClanItemUse(player, itemStack) {
  const ability = ABILITIES[itemStack.typeId];
  if (!ability) return false;

  const clanId = getClanId(player);
  if (clanId !== ability.clan) {
    player.onScreenDisplay.setActionBar(`§cOnly the ${clanLabel(CLANS[ability.clan])} Clan§c can use this.`);
    return true;
  }
  const move = player.isSneaking && ability.sneak ? ability.sneak : ability.use;
  const key = `${itemStack.typeId}#${move.name}`;
  const left = api.cooldownLeft(player, key);
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7${move.name} ready in §f${(left / 20).toFixed(1)}s`);
    return true;
  }
  const chakra = api.getChakra(player);
  if (chakra < move.cost) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(chakra)}/${move.cost})`);
    return true;
  }
  if (move.cast(player) === false) return true;
  if (move.cost) api.setChakra(player, api.getChakra(player) - move.cost);
  api.startCooldown(player, key, move.cd);
  if (move.cost) player.onScreenDisplay.setActionBar(`${CLANS[ability.clan].color}${move.name}!`);
  return true;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function initClans(helpers) {
  api = helpers;

  // First join → roll. Every spawn → name tag + make sure they still have their item.
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!getClanId(player)) {
      if (initialSpawn) system.runTimeout(() => api.isValid(player) && rollClan(player), 60);
      return;
    }
    applyNameTag(player);
    giveClanItem(player);
    refreshEffects(player, true);
  });

  // Sharingan: 30% chance to read and dodge an attack.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player") return;
    if (activeDojutsu.get(hurtEntity.id) !== "sharingan" || Math.random() > 0.3) return;
    try {
      const health = hurtEntity.getComponent("minecraft:health");
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + damage));
      hurtEntity.onScreenDisplay.setActionBar("§cSharingan: §7attack predicted — dodged!");
      api.particle(hurtEntity.dimension, "minecraft:large_explosion", api.add(hurtEntity.location, { x: 0, y: 1, z: 0 }));
    } catch {
      /* ignore */
    }
  });

  // Byakugan: Gentle Fist — melee hits deal bonus internal damage.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity.typeId !== "minecraft:player") return;
    if (activeDojutsu.get(damagingEntity.id) !== "byakugan") return;
    if (!api.canBeHit(hitEntity, damagingEntity)) return;
    api.hurt(hitEntity, 4, damagingEntity, "magic");
    eff(hitEntity, "weakness", 60, 0);
    api.particle(hitEntity.dimension, "minecraft:electric_spark_particle", api.add(hitEntity.location, { x: 0, y: 1, z: 0 }));
  });

  // Dojutsu drain + Byakugan vision + passives.
  let tick = 0;
  system.runInterval(() => {
    tick++;
    for (const player of world.getAllPlayers()) {
      if (!getClanId(player)) continue;
      const kind = activeDojutsu.get(player.id);
      if (kind) {
        const drain = kind === "sharingan" ? 2 : 1.5; // per second
        const c = api.getChakra(player) - drain * 0.25;
        api.setChakra(player, c);
        if (c <= 0) {
          activeDojutsu.delete(player.id);
          try {
            player.removeEffect("night_vision");
          } catch {
            /* ignore */
          }
          player.onScreenDisplay.setActionBar("§7Out of chakra — your eyes return to normal.");
        }
        if (kind === "byakugan" && tick % 4 === 0) {
          // mark every living thing within 40 blocks, even through walls
          for (const e of player.dimension.getEntities({ location: player.location, maxDistance: 40 })) {
            if (e.id === player.id || !e.getComponent("minecraft:health")) continue;
            api.particle(e.dimension, "minecraft:blue_flame_particle", api.add(e.location, { x: 0, y: 2.2, z: 0 }));
          }
        }
      }
      if (tick % 20 === 0) refreshEffects(player);
    }
  }, 5);

  // Admin / testing commands.
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:clan" || sourceEntity?.typeId !== "minecraft:player") return;
    const player = sourceEntity;
    const [cmd, arg] = message.trim().toLowerCase().split(/\s+/);
    if (cmd === "reroll") {
      player.setDynamicProperty(CLAN_PROP, undefined);
      removeClanItems(player);
      activeDojutsu.delete(player.id);
      rollClan(player);
    } else if (cmd === "set" && CLANS[arg]) {
      setClan(player, arg);
      player.sendMessage(`§7Clan set to ${clanLabel(CLANS[arg])}§7.`);
    } else if (cmd === "info") {
      const clan = getClan(player);
      player.sendMessage(clan ? `§7Clan: ${clanLabel(clan)} §7(${RARITY[clan.rarity].color}${RARITY[clan.rarity].label}§7)\n§7Perks: §f${clan.perks}` : "§7No clan yet.");
    } else {
      player.sendMessage(`§7Usage: /scriptevent aegis:clan <reroll | info | set <${Object.keys(CLANS).join("|")}>>`);
    }
  });
}
