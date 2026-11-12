// Clan system: on a player's first join they "roll" a clan with weighted rarity.
// Each clan gives max-chakra / regen bonuses, passive effects and a clan-only ability item.
//
// Admin commands (cheats on):
//   /scriptevent aegis:clan reroll          — reroll your clan (with the animation)
//   /scriptevent aegis:clan set uchiha      — set your clan directly
//   /scriptevent aegis:clan info            — show your clan
//   /scriptevent aegis:clan mangekyo        — instantly awaken the Mangekyō (Uchiha only)
//   /scriptevent aegis:clan eternal         — instantly awaken the Eternal Mangekyō (Uchiha only)

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { uzumakiSealMenu } from "./bijuu.js";
import { getKage, KAGE_VILLAGES, isSannin } from "./armor.js";
import { registerCast } from "./clash.js";

import { noteCast } from "./starter.js";
import { getVillage, villageTag } from "./villages.js";
import { transformCinematic, impactFx, sfx, chargeFx } from "./cinematic.js";
import { statEffectLevels, getLevel, getRank, RANKS } from "./levels.js";

const CLAN_PROP = "aegis:clan";
const MS_XP_PROP = "aegis:sharingan_xp";
const MS_PROP = "aegis:mangekyo";
const EMS_PROP = "aegis:eternal_mangekyo";
const MANGEKYO_XP = 100; // mob kill = 1, player kill = 10 (with Sharingan active)
const REROLL_ITEM = "aegis:reroll_scroll";

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
    perks: "Wood Style (Wood Wall / sneak: Healing), Wood Release scrolls (Deep Forest Emergence, Wood Dragon), 180 chakra, Regeneration, +4 hearts",
  },
  uchiha: {
    name: "Uchiha", color: "§c", rarity: "epic", weight: 6,
    maxChakra: 140, regen: 1.2, effects: [["fire_resistance", 0]],
    item: "aegis:sharingan",
    perks: "Sharingan (toggle: night vision + 30% dodge / sneak: Amaterasu), awakens the Mangekyō with kills, Blaze Release scrolls (Kagutsuchi Spears, Black Flame Barrier), cheaper Fireball & Chidori, 140 chakra",
  },
  uzumaki: {
    name: "Uzumaki", color: "§6", rarity: "epic", weight: 7,
    maxChakra: 200, regen: 1.5, effects: [["health_boost", 0]],
    item: "aegis:sealing_chains",
    perks: "Adamantine Sealing Chains (sneak: Four Symbols Seal — seal Tailed Beasts alive, open & master your own), cheaper Rasengan & Shadow Clones, 200 chakra, fast regen, +2 hearts",
  },
  hyuga: {
    name: "Hyuga", color: "§7", rarity: "epic", weight: 8,
    maxChakra: 130, regen: 1.2, effects: [],
    item: "aegis:byakugan",
    perks: "Byakugan (toggle: see all life nearby + Gentle Fist / sneak: Rotation), 130 chakra",
  },
  yuki: {
    name: "Yuki", color: "§b", rarity: "epic", weight: 5,
    maxChakra: 150, regen: 1.2, effects: [["resistance", 0]],
    item: "aegis:ice_mirrors",
    perks: "Ice Release: Demonic Mirroring Ice Crystals (sneak: Ice Dome), Ice Release scrolls (Thousand Needles, Black Dragon Blizzard), 150 chakra, Resistance",
  },
  terumi: {
    name: "Terumi", color: "§6", rarity: "epic", weight: 4,
    maxChakra: 160, regen: 1.3, effects: [["fire_resistance", 0]],
    item: "aegis:lava_boil",
    perks: "Lava Release: Melting Apparition (sneak: Boil Release: Skilled Mist), Lava & Boil Release scrolls, 160 chakra, Fire Resistance",
  },
  hozuki: {
    name: "Hōzuki", color: "§9", rarity: "rare", weight: 6,
    maxChakra: 120, regen: 1.2, effects: [["water_breathing", 0], ["dolphins_grace", 0]],
    item: "aegis:hydrification",
    perks: "Water Gun (sneak: Hydrification — attacks pass through you for 6s), breathe underwater, swim fast, 120 chakra",
  },
  sarutobi: {
    name: "Sarutobi", color: "§4", rarity: "rare", weight: 7,
    maxChakra: 120, regen: 1.2, effects: [["fire_resistance", 0]],
    item: "aegis:flame_bullet",
    perks: "Fire Style: Flame Bullet (triple fireball), cheaper Fireball, 120 chakra, Fire Resistance",
  },
  nara: {
    name: "Nara", color: "§8", rarity: "rare", weight: 9,
    maxChakra: 110, regen: 1.1, effects: [],
    item: "aegis:shadow_possession",
    perks: "Shadow Possession Jutsu (freeze a target), 110 chakra",
  },
  akimichi: {
    name: "Akimichi", color: "§e", rarity: "rare", weight: 9,
    maxChakra: 120, regen: 1.0, effects: [["health_boost", 0]],
    item: "aegis:expansion",
    perks: "Expansion Jutsu (Strength + Resistance + hearts), 120 chakra, +2 hearts",
  },
  aburame: {
    name: "Aburame", color: "§a", rarity: "rare", weight: 9,
    maxChakra: 110, regen: 1.1, effects: [],
    item: "aegis:insect_swarm",
    perks: "Parasitic Insect Swarm (poison + chakra drain), 110 chakra",
  },
  inuzuka: {
    name: "Inuzuka", color: "§b", rarity: "common", weight: 13,
    maxChakra: 100, regen: 1.0, effects: [["speed", 0], ["night_vision", 0]],
    item: "aegis:fang_over_fang",
    perks: "Fang Over Fang (sneak: summon ninja hound), Speed, Night Vision",
  },
  yamanaka: {
    name: "Yamanaka", color: "§3", rarity: "common", weight: 13,
    maxChakra: 100, regen: 1.1, effects: [],
    item: "aegis:mind_transfer",
    perks: "Mind Body Disturbance (confuse & stun a target)",
  },
};

let api; // helpers from main.js

// Clan discounts on the normal jutsu scrolls (multiplier on chakra cost).
const JUTSU_DISCOUNTS = {
  uchiha: { "aegis:fireball_scroll": 0.6, "aegis:chidori_scroll": 0.7, "aegis:phoenix_scroll": 0.7, "aegis:chidori_current_scroll": 0.8,
    "aegis:great_fire_scroll": 0.7, "aegis:kirin_scroll": 0.75, "aegis:chidori_spear_scroll": 0.75 },
  uzumaki: { "aegis:sphere_scroll": 0.7, "aegis:clone_scroll": 0.6, "aegis:rasenshuriken_scroll": 0.75 },
  sarutobi: { "aegis:fireball_scroll": 0.7, "aegis:phoenix_scroll": 0.7, "aegis:great_fire_scroll": 0.8 },
  senju: { "aegis:mystical_palm_scroll": 0.6, "aegis:water_dragon_scroll": 0.8, "aegis:earth_spikes_scroll": 0.75 },
  hyuga: { "aegis:vacuum_scroll": 0.7 },
};

export function clanJutsuCostMultiplier(player, itemId) {
  return JUTSU_DISCOUNTS[getClanId(player)]?.[itemId] ?? 1;
}

const hasMangekyo = (player) => getClanId(player) === "uchiha" && player.getDynamicProperty(MS_PROP) === true;
export const hasEternalMangekyo = (player) => hasMangekyo(player) && player.getDynamicProperty(EMS_PROP) === true;

function clanItemFor(player) {
  const clan = getClan(player);
  if (!clan) return undefined;
  if (hasEternalMangekyo(player)) return "aegis:eternal_mangekyo";
  return hasMangekyo(player) ? "aegis:mangekyo" : clan.item;
}

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

// Clan Mastery (trained at a Clan Elder): +10% clan max chakra and -10% clan ability cooldowns per level.
const mastery = (player) => {
  try {
    return Number(player.getDynamicProperty("aegis:clan_mastery") ?? 0);
  } catch {
    return 0;
  }
};

export function clanMaxChakra(player, base) {
  const c = getClan(player);
  return c ? Math.round(c.maxChakra * (1 + 0.1 * mastery(player))) : base;
}

export function clanRegenMultiplier(player) {
  return getClan(player)?.regen ?? 1;
}

function rollClanId(exclude) {
  const entries = Object.entries(CLANS).filter(([id]) => id !== exclude);
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

export function applyNameTag(player) {
  const clan = getClan(player);
  try {
    const rank = getRank(player);
    const kage = getKage(player);
    // titles chosen by the server owner take priority: Kage > Sannin > exam rank
    const title = kage ? `${KAGE_VILLAGES[kage].title} ` : isSannin(player) ? "§aSannin " : rank ? `§7${RANKS[rank]} ` : "";
    const lv = `${title}§eLv.${getLevel(player)}§r`;
    const vt = villageTag(getVillage(player));
    player.nameTag = clan ? `${vt}${clan.color}[${clan.name}]§r ${lv} ${player.name}` : `${vt}${lv} ${player.name}`;
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
  const itemId = clanItemFor(player);
  if (!clan || hasItem(player, itemId)) return;
  try {
    const stack = new ItemStack(itemId, 1);
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
  const ids = new Set([...Object.values(CLANS).map((c) => c.item), "aegis:mangekyo", "aegis:eternal_mangekyo"]);
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && ids.has(it.typeId)) inv.setItem(i, undefined);
  }
}

export const setClanPublic = (player, id) => setClan(player, id);

function setClan(player, id) {
  removeClanItems(player);
  deactivateDojutsu(player);
  if (getClanId(player) !== id) {
    // a new bloodline starts from scratch
    player.setDynamicProperty(MS_XP_PROP, 0);
    player.setDynamicProperty(MS_PROP, false);
    player.setDynamicProperty(EMS_PROP, false);
    player.setDynamicProperty("aegis:clan_mastery", 0);
  }
  player.setDynamicProperty(CLAN_PROP, id);
  api.setChakra(player, CLANS[id].maxChakra);
  applyNameTag(player);
  giveClanItem(player);
  refreshEffects(player, true);
}

// ---------------------------------------------------------------------------
// The roll — a slot-machine style animation, then the reveal.
// ---------------------------------------------------------------------------
function rollClan(player, exclude) {
  const finalId = rollClanId(exclude);
  const names = Object.values(CLANS);
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    // slows down towards the end
    const delay = Math.floor(2 + i * i * 0.12);
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      const c = i === steps - 1 ? CLANS[finalId] : names[Math.floor(Math.random() * names.length)];
      showTitle(player, clanLabel(c), {
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
    showTitle(player, clanLabel(clan) + " Clan", {
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
export const refreshClanEffects = (player, force) => refreshEffects(player, force);

// Clan passives + active eye effects + stat-point effects, merged into one amplifier per effect.
function refreshEffects(player, force = false) {
  const clan = getClan(player);
  const merged = new Map(); // effect id -> amplifier
  const put = (id, amp) => merged.set(id, Math.max(merged.get(id) ?? -1, amp));
  for (const [id, amp] of clan?.effects ?? []) put(id, amp);
  const dojutsu = activeDojutsu.get(player.id);
  if (dojutsu) put("night_vision", 0);
  if (dojutsu === "mangekyo") put("strength", 0);
  if (dojutsu === "eternal") {
    put("strength", 1);
    put("speed", 0);
  }
  for (const [id, lv] of Object.entries(statEffectLevels(player))) {
    if (lv > 0) merged.set(id, (merged.has(id) ? merged.get(id) + 1 : 0) + lv - 1);
  }
  for (const [id, amp] of merged) {
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

// Turns off any active eye and removes the effects it gave (unless the clan has them passively).
function deactivateDojutsu(player) {
  const kind = activeDojutsu.get(player.id);
  if (!kind) return;
  activeDojutsu.delete(player.id);
  const passive = new Set((getClan(player)?.effects ?? []).map(([id]) => id));
  for (const id of ["night_vision", "strength"]) {
    if (passive.has(id)) continue;
    try {
      player.removeEffect(id);
    } catch {
      /* ignore */
    }
  }
}

const isSharinganActive = (p) => ["sharingan", "mangekyo", "eternal"].includes(activeDojutsu.get(p.id));
const isMangekyoActive = (p) => ["mangekyo", "eternal"].includes(activeDojutsu.get(p.id));

function amaterasu(p, pulses, dmg) {
  if (!isSharinganActive(p)) {
    p.onScreenDisplay.setActionBar("§7Activate your Sharingan first.");
    return false;
  }
  const t = targetInView(p, 24);
  if (!t) return noTarget(p);
  api.anim(p, "animation.aegis.eye_activate");
  api.sound(p.dimension, "mob.wither.shoot", p.location, 0.7, 0.6);
  sfx(p.dimension, "aegis.fire", t.location, 1.5, 0.6);
  impactFx(p.dimension, t.location, [0.15, 0.02, 0.1], 1);
  line(p, p.getHeadLocation(), api.add(t.location, { x: 0, y: 1, z: 0 }), "aegis:amaterasu");
  for (let i = 0; i < pulses; i++) {
    system.runTimeout(() => {
      if (!api.isValid(t)) return;
      for (let k = 0; k < 4; k++) {
        system.runTimeout(() => api.isValid(t) && api.particle(t.dimension, "aegis:amaterasu", t.location), k * 5);
      }
      api.hurt(t, dmg, p, "fire");
      try {
        t.setOnFire(8, true);
      } catch {
        /* ignore */
      }
    }, i * 20);
  }
  return true;
}

function toggleDojutsu(player, kind, label) {
  if (activeDojutsu.get(player.id) === kind) {
    deactivateDojutsu(player);
    player.onScreenDisplay.setActionBar(`§7${label} deactivated.`);
    return false; // no chakra cost for turning off
  }
  if (api.getChakra(player) < 10) {
    player.onScreenDisplay.setActionBar("§cNot enough chakra!");
    return false;
  }
  activeDojutsu.set(player.id, kind);
  refreshEffects(player, true);
  api.anim(player, "animation.aegis.eye_activate");
  chargeFx(player, kind === "byakugan" ? [0.85, 0.82, 1] : kind === "eternal" ? [0.6, 0.1, 0.55] : [0.85, 0.05, 0.08], 6);
  player.onScreenDisplay.setActionBar(`§c${label}!`);
  return true;
}

// Each entry: normal use and (optional) sneak use. cost = chakra, cd = ticks.
const ABILITIES = {
  // ---- Uchiha ----
  "aegis:sharingan": {
    clan: "uchiha",
    use: { name: "Sharingan", cost: 0, cd: 10, cast: (p) => toggleDojutsu(p, "sharingan", "Sharingan") },
    sneak: { name: "Amaterasu", cost: 50, cd: 300, cast: (p) => amaterasu(p, 6, 3) },
  },
  "aegis:eternal_mangekyo": {
    clan: "uchiha",
    use: { name: "Eternal Mangekyō Sharingan", cost: 0, cd: 10, cast: (p) => toggleDojutsu(p, "eternal", "Eternal Mangekyō Sharingan") },
    sneak: { name: "Amaterasu", cost: 30, cd: 140, cast: (p) => amaterasu(p, 8, 5) },
  },
  "aegis:mangekyo": {
    clan: "uchiha",
    use: { name: "Mangekyō Sharingan", cost: 0, cd: 10, cast: (p) => toggleDojutsu(p, "mangekyo", "Mangekyō Sharingan") },
    sneak: { name: "Amaterasu", cost: 40, cd: 200, cast: (p) => amaterasu(p, 8, 4) },
  },
  // ---- Hyuga ----
  "aegis:byakugan": {
    clan: "hyuga",
    use: { name: "Byakugan", cost: 0, cd: 10, cast: (p) => toggleDojutsu(p, "byakugan", "Byakugan") },
    sneak: {
      name: "Eight Trigrams Palm Rotation", cost: 30, cd: 160,
      cast: (p) => {
        api.anim(p, "animation.aegis.both_palms");
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          api.particle(p.dimension, "aegis:wind_gust", api.add(p.location, { x: Math.cos(a) * 2, y: 1, z: Math.sin(a) * 2 }));
        }
        api.sound(p.dimension, "aegis.wind", p.location, 1, 0.85);
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
        api.anim(p, "animation.aegis.almighty_push");
        impactFx(p.dimension, p.location, [0.7, 0.5, 1], 3);
        api.particle(p.dimension, "minecraft:huge_explosion_emitter", p.location);
        api.particle(p.dimension, "aegis:chakra_burst", api.add(p.location, { x: 0, y: 1, z: 0 }));
        for (let r = 1; r <= 8; r += 1.5) {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            api.particle(p.dimension, "aegis:wind_gust", api.add(p.location, { x: Math.cos(a) * r, y: 0.5, z: Math.sin(a) * r }));
          }
        }
        api.sound(p.dimension, "aegis.push", p.location, 1, 0.85);
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
        api.anim(p, "animation.aegis.pull");
        line(p, p.getHeadLocation(), t.location, "minecraft:portal_reverse_particle");
        const to = api.norm({ x: p.location.x - t.location.x, y: 0, z: p.location.z - t.location.z });
        api.knockback(t, to.x, to.z, 3, 0.4);
        api.sound(p.dimension, "aegis.pull", t.location, 1, 0.85);
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
          api.particle(pl.dimension, "aegis:chakra_aura", pl.location);
          api.particle(pl.dimension, "minecraft:villager_happy", api.add(pl.location, { x: 0, y: 1, z: 0 }));
        }
        api.sound(p.dimension, "aegis.heal", p.location, 1, 1.25);
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
        api.anim(p, "animation.aegis.chains_cast");
        for (const e of targets) {
          line(p, api.add(p.location, { x: 0, y: 1, z: 0 }), api.add(e.location, { x: 0, y: 1, z: 0 }), "minecraft:electric_spark_particle");
          eff(e, "slowness", 100, 255);
          eff(e, "weakness", 100, 2);
          api.hurt(e, 4, p);
        }
        api.sound(p.dimension, "random.anvil_land", p.location, 0.6, 1.5);
        sfx(p.dimension, "aegis.seal", p.location, 1.2, 1);
        impactFx(p.dimension, p.location, [1, 0.85, 0.3], 1.5);
        return true;
      },
    },
    // Four Symbols Seal: seal a weakened Tailed Beast alive, or open your own seal (bijuu.js).
    sneak: {
      name: "Four Symbols Seal", cost: 0, cd: 10,
      cast: (p) => {
        system.run(() => uzumakiSealMenu(p).catch(() => {}));
        return false; // the sealing menu handles its own chakra cost and cooldown
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
          api.castFireball(p, { x: d.x * c - d.z * s, y: d.y, z: d.x * s + d.z * c }, "animation.aegis.phoenix_breath", 10);
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
        api.anim(p, "animation.aegis.shadow_seal");
        chargeFx(p, [0.1, 0.1, 0.12], 9);
        api.sound(p.dimension, "aegis.shadow", p.location, 1.3, 1);
        for (let i = 0; i < 5; i++) {
          system.runTimeout(() => {
            if (api.isValid(t) && api.isValid(p)) line(p, api.add(p.location, { x: 0, y: 0.05, z: 0 }), api.add(t.location, { x: 0, y: 0.05, z: 0 }), "aegis:shadow");
          }, i * 20);
        }
        eff(t, "slowness", 120, 255);
        eff(t, "weakness", 120, 4);
        eff(t, "mining_fatigue", 120, 4);
        eff(p, "slowness", 120, 1); // you're tied together
        api.sound(p.dimension, "aegis.shadow", t.location, 1, 0.85);
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
        api.anim(p, "animation.aegis.expansion");
        chargeFx(p, [1, 0.85, 0.3], 9);
        api.particle(p.dimension, "aegis:smoke_puff", p.location);
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
        api.anim(p, "animation.aegis.insect_release");
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
        api.anim(p, "animation.aegis.fang_drill");
        const hit = new Set();
        for (let i = 1; i <= 12; i++) {
          system.runTimeout(() => {
            if (!api.isValid(p)) return;
            api.particle(p.dimension, "aegis:wind_gust", p.location);
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
          api.particle(p.dimension, "aegis:smoke_puff", wolf.location);
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
        api.anim(p, "animation.aegis.mind_seal");
        chargeFx(p, [0.4, 0.7, 1], 9);
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
  api.anim(p, "animation.aegis.earth_slam");
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
  api.sound(dim, "aegis.wood", p.location, 1, 0.85);
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

const rerollConfirm = new Map(); // playerId -> tick the confirmation expires

function useRerollScroll(player) {
  const now = system.currentTick;
  const confirmBy = rerollConfirm.get(player.id);
  if (confirmBy === undefined || confirmBy < now) {
    rerollConfirm.set(player.id, now + 100);
    const clan = getClan(player);
    player.sendMessage(
      `§eThis will replace your ${clan ? clanLabel(clan) + " Clan" : "clan"}§e (and any Mangekyō progress). Use the scroll again within 5s to confirm.`
    );
    return;
  }
  rerollConfirm.delete(player.id);
  const inv = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex;
  const it = inv?.getItem(slot);
  if (!it || it.typeId !== REROLL_ITEM) return;
  if (it.amount > 1) {
    it.amount -= 1;
    inv.setItem(slot, it);
  } else inv.setItem(slot, undefined);
  rollClan(player, getClanId(player)); // always a different clan
}

// Extra clan-item abilities from other modules (releases.js).
export function registerClanAbilities(map) {
  Object.assign(ABILITIES, map);
}

export function beginClanRoll(player) {
  if (!getClanId(player)) rollClan(player);
}

export function handleClanItemUse(player, itemStack) {
  if (itemStack.typeId === REROLL_ITEM) {
    useRerollScroll(player);
    return true;
  }
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
  if (move.cost) registerCast(player, `${itemStack.typeId}#${move.name}`, move.cost);
  noteCast(player);
  if (move.cost) api.setChakra(player, api.getChakra(player) - move.cost);
  api.gainJutsuXp(player, move.cost);
  api.startCooldown(player, key, Math.round(move.cd * (1 - 0.1 * mastery(player))));
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
      // new players roll after choosing their village (villages.js calls beginClanRoll)
      if (initialSpawn && getVillage(player)) system.runTimeout(() => api.isValid(player) && rollClan(player), 60);
      return;
    }
    applyNameTag(player);
    giveClanItem(player);
    refreshEffects(player, true);
  });

  // Sharingan: 30% (Mangekyō: 40%) chance to read and dodge an attack.
  // Mangekyō: Susanoo manifests when you drop below 30% health.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player") return;
    const kind = activeDojutsu.get(hurtEntity.id);
    if (isMangekyoActive(hurtEntity)) trySusanoo(hurtEntity, kind === "eternal");
    if (!isSharinganActive(hurtEntity) || Math.random() > ({ mangekyo: 0.4, eternal: 0.5 }[kind] ?? 0.3)) return;
    try {
      const health = hurtEntity.getComponent("minecraft:health");
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + damage));
      hurtEntity.onScreenDisplay.setActionBar("§cSharingan: §7attack predicted — dodged!");
      api.particle(hurtEntity.dimension, "aegis:smoke_puff", hurtEntity.location);
    } catch {
      /* ignore */
    }
  });

  // Sharingan growth: kills with the Sharingan active build toward the Mangekyō.
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    const killer = damageSource?.damagingEntity;
    if (killer?.typeId !== "minecraft:player" || killer.id === deadEntity.id) return;
    if (activeDojutsu.get(killer.id) !== "sharingan" || hasMangekyo(killer)) return;
    const gain = deadEntity.typeId === "minecraft:player" ? 10 : 1;
    const xp = (killer.getDynamicProperty(MS_XP_PROP) ?? 0) + gain;
    killer.setDynamicProperty(MS_XP_PROP, xp);
    if (xp >= MANGEKYO_XP) awakenMangekyo(killer);
    else if (Math.floor(xp / 10) > Math.floor((xp - gain) / 10)) {
      killer.onScreenDisplay.setActionBar(`§cYour Sharingan grows stronger... §7(${xp}/${MANGEKYO_XP})`);
    }
  });

  // Byakugan: Gentle Fist — melee hits deal bonus internal damage.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity.typeId !== "minecraft:player") return;
    if (activeDojutsu.get(damagingEntity.id) !== "byakugan") return;
    if (!api.canBeHit(hitEntity, damagingEntity)) return;
    api.hurt(hitEntity, 4, damagingEntity, "magic");
    eff(hitEntity, "weakness", 60, 0);
    api.particle(hitEntity.dimension, "aegis:chakra_burst", api.add(hitEntity.location, { x: 0, y: 1, z: 0 }));
  });

  // Dojutsu drain + Byakugan vision + passives.
  let tick = 0;
  system.runInterval(() => {
    tick++;
    for (const player of world.getAllPlayers()) {
      if (!getClanId(player)) continue;
      const kind = activeDojutsu.get(player.id);
      if (kind) {
        const drain = { sharingan: 2, mangekyo: 3, eternal: 1.5, byakugan: 1.5 }[kind] ?? 2; // per second
        const c = api.getChakra(player) - drain * 0.25;
        api.setChakra(player, c);
        if (c <= 0) {
          deactivateDojutsu(player);
          player.onScreenDisplay.setActionBar("§7Out of chakra — your eyes return to normal.");
        }
        if (kind === "byakugan" && tick % 4 === 0) {
          // mark every living thing within 40 blocks, even through walls
          for (const e of player.dimension.getEntities({ location: player.location, maxDistance: 40 })) {
            if (e.id === player.id || !e.getComponent("minecraft:health")) continue;
            api.particle(e.dimension, "aegis:byakugan_mark", api.add(e.location, { x: 0, y: 2.2, z: 0 }));
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
      const old = getClanId(player);
      removeClanItems(player);
      deactivateDojutsu(player);
      player.setDynamicProperty(CLAN_PROP, undefined);
      if (old) {
        player.setDynamicProperty(MS_XP_PROP, 0);
        player.setDynamicProperty(MS_PROP, false);
        player.setDynamicProperty(EMS_PROP, false);
      }
      rollClan(player);
    } else if (cmd === "eternal") {
      if (getClanId(player) !== "uchiha") player.sendMessage("§7Only the Uchiha can awaken the Eternal Mangekyō.");
      else {
        if (!hasMangekyo(player)) awakenMangekyo(player);
        awakenEternal(player);
      }
    } else if (cmd === "mangekyo") {
      if (getClanId(player) !== "uchiha") player.sendMessage("§7Only the Uchiha can awaken the Mangekyō.");
      else awakenMangekyo(player);
    } else if (cmd === "set" && CLANS[arg]) {
      setClan(player, arg);
      player.sendMessage(`§7Clan set to ${clanLabel(CLANS[arg])}§7.`);
    } else if (cmd === "info") {
      const clan = getClan(player);
      let text = clan ? `§7Clan: ${clanLabel(clan)} §7(${RARITY[clan.rarity].color}${RARITY[clan.rarity].label}§7)\n§7Perks: §f${clan.perks}` : "§7No clan yet.";
      if (getClanId(player) === "uchiha") {
        text += hasEternalMangekyo(player)
          ? "\n§5Eternal Mangekyō Sharingan: §fawakened"
          : hasMangekyo(player)
          ? "\n§cMangekyō Sharingan: §fawakened §7(the Uchiha Elder can awaken the Eternal Mangekyō at Lv 100)"
          : `\n§cMangekyō progress: §f${player.getDynamicProperty(MS_XP_PROP) ?? 0}/${MANGEKYO_XP}`;
      }
      player.sendMessage(text);
    } else {
      player.sendMessage(`§7Usage: /scriptevent aegis:clan <reroll | info | mangekyo | eternal | set <${Object.keys(CLANS).join("|")}>>`);
    }
  });
}

// ---------------------------------------------------------------------------
// Mangekyō Sharingan
// ---------------------------------------------------------------------------
function awakenMangekyo(player) {
  if (hasMangekyo(player)) return;
  player.setDynamicProperty(MS_PROP, true);
  deactivateDojutsu(player);
  removeClanItems(player);
  giveClanItem(player);
  transformCinematic(player, { color: [0.85, 0.05, 0.08], title: "§4Mangekyō Sharingan", subtitle: "§7Your eyes have awakened..." });
  api.sound(player.dimension, "mob.wither.spawn", player.location, 0.6, 1.2);
  api.particle(player.dimension, "aegis:susanoo_flame", player.location);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    api.particle(player.dimension, "aegis:amaterasu", api.add(player.location, { x: Math.cos(a) * 1.5, y: 0, z: Math.sin(a) * 1.5 }));
  }
  player.sendMessage("§cYou awakened the §4Mangekyō Sharingan§c! §7Stronger dodge, Strength, cheaper Amaterasu, and §5Susanoo§7 protects you at low health.");
  world.sendMessage(`§e${player.name} has awakened the §4Mangekyō Sharingan§e!`);
}

// Eternal Mangekyō: the next stage after the Mangekyō (trained at the Uchiha Clan Elder).
export function awakenEternal(player) {
  if (!hasMangekyo(player) || hasEternalMangekyo(player)) return false;
  player.setDynamicProperty(EMS_PROP, true);
  deactivateDojutsu(player);
  removeClanItems(player);
  giveClanItem(player);
  transformCinematic(player, { color: [0.6, 0.1, 0.55], title: "§5Eternal Mangekyō", subtitle: "§7Your eyes will never dim again" });
  api.sound(player.dimension, "mob.wither.spawn", player.location, 0.6, 0.9);
  api.particle(player.dimension, "aegis:susanoo_flame", player.location);
  player.sendMessage("§5Eternal Mangekyō Sharingan! §7Half the chakra drain, 50% dodge, Strength II + Speed, cheaper Amaterasu, and a stronger Susanoo every 30s.");
  world.sendMessage(`§e${player.name} has awakened the §5Eternal Mangekyō Sharingan§e!`);
  return true;
}

function trySusanoo(player, eternal = false) {
  try {
    const h = player.getComponent("minecraft:health");
    if (h.currentValue > h.effectiveMax * 0.3) return;
  } catch {
    return;
  }
  if (api.cooldownLeft(player, "susanoo") > 0 || api.getChakra(player) < 30) return;
  api.setChakra(player, api.getChakra(player) - 30);
  api.startCooldown(player, "susanoo", eternal ? 600 : 1200); // 30s / 60s
  eff(player, "resistance", eternal ? 200 : 120, 3);
  eff(player, "absorption", 300, 4);
  eff(player, "strength", 300, 1);
  eff(player, "regeneration", 100, 1);
  // The Susanoo ribcage model stays wrapped around you for 6 seconds.
  const model = api.spawnFx(player.dimension, "aegis:susanoo", undefined, player.location);
  api.follow(model, () => (api.isValid(player) ? player.location : undefined), 120, () => ({ x: 0, y: player.getRotation().y }));
  for (let t = 0; t < 12; t++) {
    system.runTimeout(() => api.isValid(player) && api.particle(player.dimension, "aegis:susanoo_flame", player.location), t * 10);
  }
  api.sound(player.dimension, "mob.warden.emerge", player.location, 0.8, 0.8);
  impactFx(player.dimension, player.location, [0.6, 0.2, 1], 2.5);
  sfx(player.dimension, "aegis.roar", player.location, 1.5, 1.2);
  showTitle(player, "§5Susanoo", { subtitle: "§7protects you", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 10 });
}
