// Nindō — your ninja way. Every shinobi rolls one when they join (after their clan and chakra nature). Each nindō
// has real advantages and real drawbacks, wired into chakra, damage dealt and taken, chakra costs, cooldowns, XP,
// healing, Sage Mode and the Eight Gates. Rarer nindō are stronger, with milder drawbacks.
//
//   /scriptevent aegis:nindo              — show your nindō
//   /scriptevent aegis:nindo list         — every nindō and its odds
//   /scriptevent aegis:nindo reroll       — roll again (admins / testing)
//   /scriptevent aegis:nindo set <id>     — set one (e.g. never_give_up)
//   /scriptevent aegis:nindo clear        — remove it (rolled again on the next join)

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { getVillage } from "./villages.js";
import { JUTSU_NATURE } from "./natures.js";
import { boostHit, isEcho, healBack, drain } from "./dmgutil.js";

const PROP = "aegis:nindo";
const PHOENIX_PROP = "aegis:phoenix_at"; // real time (ms) the rebirth is ready again — survives restarts
const PHOENIX_COOLDOWN = 10 * 60 * 1000;

export const RARITY = {
  common: { label: "Common", color: "§f", weight: 6 },
  uncommon: { label: "Uncommon", color: "§a", weight: 4 },
  rare: { label: "Rare", color: "§9", weight: 2.6 },
  epic: { label: "Epic", color: "§5", weight: 2 },
  legendary: { label: "Legendary", color: "§6", weight: 1.5 },
};

// Damage modifiers are multipliers. `dmg` = everything you deal, `tech` = jutsu / clan abilities / sword specials /
// anything scripted, `melee` = {fist, blade} for M1 hits, `thrown` = kunai & shuriken. Any of them can be a function
// of the fight context: { low, ally, alone, airborne, targetLow, phoenixCharging, wet }.
export const NINDOS = {
  // ---------------------------------------------------------------- common
  fast_feet: {
    name: "Fast Feet", rarity: "common", line: "Nobody catches what they can't see.",
    pros: ["Speed I at all times", "Body Flicker costs half the chakra and recharges twice as fast"],
    cons: ["You take 10% more damage"],
    effects: [["speed", 0]], costItem: { "aegis:flash_scroll": 0.5 }, cdItem: { "aegis:flash_scroll": 0.5 }, taken: 1.1,
  },
  heavy_handed: {
    name: "Heavy Handed", rarity: "common", line: "One good hit is worth ten clever ones.",
    pros: ["Fists and blades hit 30% harder", "Your melee hits knock enemies back"],
    cons: ["Jutsu and clan abilities cost 20% more chakra"],
    melee: { fist: 1.3, blade: 1.3 }, knock: 0.7, cost: { jutsu: 1.2, clan: 1.2 },
  },
  iron_body: {
    name: "Iron Body", rarity: "common", line: "Let them hit. I'm still standing.",
    pros: ["You take 15% less damage", "Fall damage is cut by 40%"],
    cons: ["Slowness I at all times"],
    taken: 0.85, takenCause: { fall: 0.6 }, effects: [["slowness", 0]],
  },
  clever: {
    name: "Clever", rarity: "common", line: "What a drag… but I already worked out how this ends.",
    pros: ["All jutsu, clan abilities and sword specials recharge 20% faster", "+10% XP"],
    cons: ["Fists and blades deal 20% less damage"],
    cd: { jutsu: 0.8, clan: 0.8, sword: 0.8 }, xp: 1.1, melee: { fist: 0.8, blade: 0.8 },
  },
  self_love: {
    name: "Self Love", rarity: "common", line: "I fight for myself, and only myself.",
    pros: ["Fighting with no ally within 12 blocks: +15% damage, 10% less damage taken", "Alone, you heal half a heart every 4s"],
    cons: ["With an ally nearby you deal 15% less damage"],
    dmg: (c) => (c.alone ? 1.15 : 0.85), taken: (c) => (c.alone ? 0.9 : 1), selfHeal: true,
  },
  soaked_in_dread: {
    name: "Soaked in Dread", rarity: "common", line: "Fear keeps you alive. Mostly.",
    pros: ["15% chance to evade any hit completely", "When you're hit you get Speed II for 2s"],
    cons: ["You deal 10% less damage", "Below 30% health you're shaken (Weakness I)"],
    evade: 0.15, fleeSpeed: true, dmg: 0.9, shaken: true,
  },
  deep_reserves: {
    name: "Deep Reserves", rarity: "common", line: "My chakra doesn't run dry.",
    pros: ["+60 max chakra", "Chakra regenerates 15% faster"],
    cons: ["All jutsu, clan abilities and sword specials take 15% longer to recharge"],
    maxChakra: 60, regen: 1.15, cd: { jutsu: 1.15, clan: 1.15, sword: 1.15 },
  },
  revenge: {
    name: "Revenge", rarity: "common", line: "I'll repay every wound.",
    pros: ["After you're hit, your next attack within 5s deals +50% of the damage you took (up to +10)",
      "+15% damage against whoever hurt you last (for 15s)"],
    cons: ["You can't focus chakra (sneaking still gives no extra regen)"],
    revenge: true, noFocus: true,
  },
  // ---------------------------------------------------------------- uncommon
  will_of_water: {
    name: "Will of Water", rarity: "uncommon", line: "Water takes the shape of whatever stands against it.",
    pros: ["Water Release jutsu cost 25% less chakra and deal 20% more damage", "Water Breathing at all times",
      "In water you take 20% less damage"],
    cons: ["Fire Release jutsu cost 30% more chakra", "Fire and lava hurt you 20% more"],
    natureCost: { water: 0.75, fire: 1.3 }, natureDmg: { water: 1.2 }, effects: [["water_breathing", 0]],
    taken: (c) => (c.wet ? 0.8 : 1), takenCause: { fire: 1.2, fire_tick: 1.2, lava: 1.2 },
  },
  will_of_leaf: {
    name: "Will of Leaf", rarity: "uncommon", line: "Where the leaves grow, I grow stronger.",
    pros: ["On natural ground (grass, dirt, leaves, wood…) chakra regenerates 50% faster",
      "Standing still on natural ground gives Regeneration I"],
    cons: ["On stone, sand and everything else chakra regenerates 25% slower"],
    regen: (c) => (c.nature ? 1.5 : 0.75), leafRegen: true,
  },
  combat_medic: {
    name: "Combat Medic", rarity: "uncommon", line: "Nobody dies on my watch.",
    pros: ["Healing jutsu heal 50% more and cost 30% less chakra", "Out of combat for 8s: Regeneration I"],
    cons: ["You deal 15% less damage"],
    heal: 1.5, healCost: 0.7, restRegen: true, dmg: 0.85,
  },
  weapon_prodigy: {
    name: "Weapon Prodigy", rarity: "uncommon", line: "Every weapon in the scroll, and I can use them all.",
    pros: ["Kunai and shuriken hit 50% harder", "Sword specials recharge 25% faster", "Blades hit 10% harder"],
    cons: ["Scroll jutsu cost 20% more chakra"],
    thrown: 1.5, cd: { sword: 0.75 }, melee: { blade: 1.1 }, cost: { jutsu: 1.2 },
  },
  unyielding_blade: {
    name: "Unyielding Blade", rarity: "uncommon", line: "My sword doesn't bend, and neither do I.",
    pros: ["Blades hit 25% harder", "Sword specials cost 30% less chakra and recharge 20% faster"],
    cons: ["Bare-handed hits deal 30% less damage", "Scroll jutsu cost 15% more chakra"],
    melee: { blade: 1.25, fist: 0.7 }, cost: { sword: 0.7, jutsu: 1.15 }, cd: { sword: 0.8 },
  },
  a_b_teamwork: {
    name: "A-B Teamwork", rarity: "uncommon", line: "Two brothers, one combo. Wheee!",
    pros: ["With an ally (village-mate or your companion) within 10 blocks: +20% damage, 10% less damage taken"],
    cons: ["Alone you deal 15% less damage"],
    dmg: (c) => (c.ally ? 1.2 : 0.85), taken: (c) => (c.ally ? 0.9 : 1),
  },
  sky_pillar: {
    name: "Sky Pillar", rarity: "uncommon", line: "The fight is decided from above.",
    pros: ["Jump Boost II at all times", "No fall damage", "+30% damage while you're in the air"],
    cons: ["You take 10% more damage"],
    effects: [["jump_boost", 1]], takenCause: { fall: 0 }, dmg: (c) => (c.airborne ? 1.3 : 1), taken: 1.1,
  },
  reaper: {
    name: "Reaper", rarity: "uncommon", line: "Every soul I take feeds the next swing.",
    pros: ["Every kill restores 1.5 hearts and 15 chakra", "+20% damage to targets below 30% health"],
    cons: ["Chakra regenerates 20% slower", "You take 10% more damage"],
    reap: { hp: 3, chakra: 15 }, dmg: (c) => (c.targetLow ? 1.2 : 1), regen: 0.8, taken: 1.1,
  },
  // ---------------------------------------------------------------- rare
  will_of_fire: {
    name: "Will of Fire", rarity: "rare", line: "Where leaves dance, the fire burns.",
    pros: ["Fire Release jutsu cost 25% less chakra and deal 25% more damage", "Fire Resistance at all times",
      "With an ally within 10 blocks: +10% damage"],
    cons: ["Water Release jutsu cost 30% more chakra"],
    natureCost: { fire: 0.75, water: 1.3 }, natureDmg: { fire: 1.25 }, effects: [["fire_resistance", 0]],
    dmg: (c) => (c.ally ? 1.1 : 1),
  },
  never_give_up: {
    name: "Never Give Up", rarity: "rare", line: "I don't go back on my word. That's my nindō!",
    pros: ["Below 35% health: +35% damage, 20% less damage taken, double chakra regen"],
    cons: ["-15% XP (a late bloomer)"],
    dmg: (c) => (c.low ? 1.35 : 1), taken: (c) => (c.low ? 0.8 : 1), regen: (c) => (c.low ? 2 : 1), xp: 0.85,
  },
  awakening_of_youth: {
    name: "Awakening of Youth", rarity: "rare", line: "The springtime of youth never ends!",
    pros: ["Fists and blades hit 15% harder", "The Eight Gates stay open 50% longer", "Speed II while sprinting"],
    cons: ["Hunger I at all times (you burn through food)"],
    melee: { fist: 1.15, blade: 1.15 }, gates: 1.5, sprintSpeed: true, effects: [["hunger", 0]],
  },
  inner_sage: {
    name: "Inner Sage", rarity: "rare", line: "Nature's energy flows to those who are still.",
    pros: ["Sage Mode without Sage Training", "Natural energy gathers twice as fast and Sage Mode lasts 50% longer",
      "Focusing chakra (sneaking still) works 50% better"],
    cons: ["Chakra regenerates 20% slower while you move"],
    sage: { free: true, gather: 0.5, duration: 1.5 }, focus: 1.5, regenMoving: 0.8,
  },
  passing_the_will: {
    name: "Passing the Will", rarity: "rare", line: "What I learned lives on in them.",
    pros: ["Your companions and summons deal 30% more damage", "Allies within 16 blocks also get 20% of the XP you earn",
      "When you fall, allies within 20 blocks gain Strength I and Regeneration I for 30s"],
    cons: ["You deal 10% less damage yourself"],
    allyDmg: 1.3, shareXp: 0.2, lastWill: true, dmg: 0.9,
  },
  // ---------------------------------------------------------------- epic
  genius: {
    name: "Genius", rarity: "epic", line: "Seen once, mastered. That's the difference between us.",
    pros: ["Jutsu and clan abilities cost 20% less chakra", "Techniques deal 15% more damage"],
    cons: ["Fists and blades deal 20% less damage", "You take 10% more damage"],
    cost: { jutsu: 0.8, clan: 0.8 }, tech: 1.15, melee: { fist: 0.8, blade: 0.8 }, taken: 1.1,
  },
  top_physique: {
    name: "Top Physique", rarity: "epic", line: "I can't use ninjutsu — so I became the best without it.",
    pros: ["Fists and blades hit 40% harder (taijutsu scrolls too)", "Taijutsu scrolls cost 25% less chakra",
      "Speed I, Jump Boost I and +2 hearts at all times"],
    cons: ["Jutsu and clan abilities cost 50% more chakra", "Techniques deal 25% less damage"],
    melee: { fist: 1.4, blade: 1.4 }, effects: [["speed", 0], ["jump_boost", 0], ["health_boost", 0]],
    cost: { jutsu: 1.5, clan: 1.5, taijutsu: 0.75 }, tech: 0.75,
  },
  // ---------------------------------------------------------------- legendary
  prodigy: {
    name: "Prodigy", rarity: "legendary", line: "A once-in-a-generation talent.",
    pros: ["+30% XP", "All jutsu, clan abilities and sword specials recharge 15% faster and cost 10% less chakra"],
    cons: ["A frail body: chakra regenerates 20% slower"],
    xp: 1.3, cd: { jutsu: 0.85, clan: 0.85, sword: 0.85 }, cost: { jutsu: 0.9, clan: 0.9, sword: 0.9 }, regen: 0.8,
  },
  phoenix_of_rebirth: {
    name: "Phoenix of Rebirth", rarity: "legendary", line: "From the ashes, I rise again.",
    pros: ["Once every 10 minutes, a hit that leaves you under 25% health makes you rise in flames: back to 70% health, Regeneration II, and a blast that burns enemies within 5 blocks",
      "Fire Resistance at all times"],
    cons: ["While your rebirth recharges you deal 15% less damage"],
    phoenix: true, effects: [["fire_resistance", 0]], dmg: (c) => (c.phoenixCharging ? 0.85 : 1),
  },
};
const IDS = Object.keys(NINDOS);
const SWORD_KEY = /kusanagi|samehada|kubikiribocho|hiramekarei|kiba|nuibari|shibuki|chakra_blades/;
const HEAL_KEY = /mystical_palm|Healing/;
const NATURE_GROUND = /grass|dirt|leaves|log|wood|moss|podzol|mycelium|mud|farmland|fern|flower|vine|bamboo|mangrove|roots|hay/;

let api;
const ctxCache = new Map(); // player id -> { ally, nature, still, tick }
const lastHurt = new Map(); // player id -> tick they last took damage
const revenge = new Map(); // player id -> { bonus, until, foe, foeUntil }
const lastNature = new Map(); // player id -> { nature, until } of the last scroll cast
const phoenixWarned = new Set();

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------
export function getNindoId(player) {
  try {
    const v = player.getDynamicProperty(PROP);
    return NINDOS[v] ? v : undefined;
  } catch {
    return undefined;
  }
}
const of = (p) => (p?.typeId === "minecraft:player" ? NINDOS[getNindoId(p)] : undefined);
export const nindoLabel = (id) => {
  const n = NINDOS[id];
  return n ? `${RARITY[n.rarity].color}${n.name}` : "§8none";
};
const val = (v, c) => (typeof v === "function" ? v(c) : v ?? 1);

function hpFrac(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return h.currentValue / h.effectiveMax;
  } catch {
    return 1;
  }
}

function phoenixCharging(p) {
  return Date.now() < Number(p.getDynamicProperty(PHOENIX_PROP) ?? 0);
}

function context(p, target) {
  const c = ctxCache.get(p.id) ?? {};
  let airborne = false;
  let wet = false;
  try {
    airborne = !p.isOnGround;
    wet = !!p.isInWater;
  } catch {
    /* ignore */
  }
  return {
    low: hpFrac(p) < 0.35, ally: !!c.ally, alone: !c.ally, nature: !!c.nature, airborne, wet,
    targetLow: target ? hpFrac(target) < 0.3 : false, phoenixCharging: phoenixCharging(p),
  };
}

// ---------------------------------------------------------------------------
// Hooks used by the rest of the add-on
// ---------------------------------------------------------------------------
// Damage a player deals. kind: "tech" (jutsu, clan abilities, sword specials), "fist", "blade", "thrown".
export function nindoDamage(attacker, target, amount, kind = "tech") {
  const n = of(attacker);
  if (!n) return amount;
  const c = context(attacker, target);
  let m = val(n.dmg, c);
  if (kind === "tech") {
    m *= val(n.tech, c);
    const ln = lastNature.get(attacker.id);
    if (ln && system.currentTick <= ln.until && n.natureDmg?.[ln.nature]) m *= n.natureDmg[ln.nature];
  } else if (kind === "thrown") m *= val(n.thrown, c);
  else m *= val(n.melee?.[kind], c);
  let out = amount * m;
  if (n.revenge) {
    const r = revenge.get(attacker.id);
    const now = system.currentTick;
    if (r) {
      if (r.foe === target?.id && now <= r.foeUntil) out *= 1.15;
      if (r.bonus > 0 && now <= r.until) {
        out += r.bonus;
        r.bonus = 0;
        api?.particle(attacker.dimension, "aegis:slash", { x: target.location.x, y: target.location.y + 1.2, z: target.location.z }, [0.9, 0.1, 0.1]);
      }
    }
  }
  return out;
}

// Chakra cost. kind: "jutsu" (scrolls), "clan", "sword". key: the scroll id / ability key.
export function nindoCostMultiplier(player, kind, key = "") {
  const n = of(player);
  if (!n) return 1;
  let m = n.cost?.[kind] ?? 1;
  if (n.costItem?.[key]) m *= n.costItem[key];
  if (n.healCost && HEAL_KEY.test(key)) m *= n.healCost;
  const nature = JUTSU_NATURE[key];
  if (nature && n.natureCost?.[nature]) m *= n.natureCost[nature];
  return m;
}

export function nindoCooldownMultiplier(player, key = "") {
  const n = of(player);
  if (!n || key === "aegis:return_home") return 1;
  const kind = SWORD_KEY.test(key) ? "sword" : key.includes("#") ? "clan" : "jutsu";
  return (n.cd?.[kind] ?? 1) * (n.cdItem?.[key] ?? 1);
}

export const nindoXpMultiplier = (p) => of(p)?.xp ?? 1;
export const nindoChakraBonus = (p) => of(p)?.maxChakra ?? 0;
export const nindoHealMultiplier = (p) => of(p)?.heal ?? 1;
export const nindoGatesMultiplier = (p) => of(p)?.gates ?? 1;
export const nindoSage = (p) => of(p)?.sage;
export const nindoEffects = (p) => of(p)?.effects ?? [];

// Chakra regen multiplier (applied every regen tick); `moving` = not standing still.
export function nindoRegenMultiplier(p, moving) {
  const n = of(p);
  if (!n) return 1;
  let m = val(n.regen, context(p));
  if (moving && n.regenMoving) m *= n.regenMoving;
  return m;
}

// Multiplier on the focus bonus (sneaking still). 0 = can't focus.
export function nindoFocusMultiplier(p) {
  const n = of(p);
  if (!n) return 1;
  return n.noFocus ? 0 : n.focus ?? 1;
}

// Called for every scroll cast (the nature boost for Will of Fire / Water follows it for 5s).
export function nindoOnCast(p, itemId) {
  const nature = JUTSU_NATURE[itemId];
  if (nature) lastNature.set(p.id, { nature, until: system.currentTick + 100 });
  else lastNature.delete(p.id);
}

// XP: the multiplier, and Passing the Will's share for nearby allies (they don't pass it on again).
export function nindoShareXp(player, amount, give) {
  const n = of(player);
  if (!n?.shareXp || amount < 1) return;
  for (const a of allies(player, 16)) if (a.typeId === "minecraft:player") give(a, amount * n.shareXp);
}

// ---------------------------------------------------------------------------
// Allies: village-mates (or, with no village, any other player) and the player's own companions / summons
// ---------------------------------------------------------------------------
function allies(p, r) {
  const out = [];
  const v = getVillage(p);
  try {
    for (const e of p.dimension.getEntities({ location: p.location, maxDistance: r })) {
      if (e.id === p.id) continue;
      if (e.typeId === "minecraft:player") {
        const ev = getVillage(e);
        if ((v && ev === v) || (!v && !ev)) out.push(e);
      } else if (e.getDynamicProperty?.("aegis:owner") === p.id) out.push(e);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function onNatureGround(p) {
  try {
    const b = p.dimension.getBlock({ x: Math.floor(p.location.x), y: Math.floor(p.location.y - 0.2), z: Math.floor(p.location.z) });
    return !!b && NATURE_GROUND.test(b.typeId);
  } catch {
    return false;
  }
}

function eff(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Rolling
// ---------------------------------------------------------------------------
function pick() {
  const total = IDS.reduce((s, id) => s + RARITY[NINDOS[id].rarity].weight, 0);
  let r = Math.random() * total;
  for (const id of IDS) {
    r -= RARITY[NINDOS[id].rarity].weight;
    if (r <= 0) return id;
  }
  return IDS[IDS.length - 1];
}

export function nindoText(id) {
  const n = NINDOS[id];
  const R = RARITY[n.rarity];
  return [
    `${R.color}§l${n.name}§r §8(${R.color}${R.label}§8)`,
    `§7§o"${n.line}"`,
    ...n.pros.map((t) => `§a+ §f${t}`),
    ...n.cons.map((t) => `§c- §7${t}`),
  ].join("\n");
}

export function setNindo(player, id) {
  player.setDynamicProperty(PROP, id);
  player.setDynamicProperty(PHOENIX_PROP, undefined);
  api?.refreshEffects?.(player);
}

function rollNindo(player, announce = true) {
  const id = pick();
  setNindo(player, id);
  const n = NINDOS[id];
  const R = RARITY[n.rarity];
  showTitle(player, `${R.color}§l${n.name}`, { subtitle: `§7Your nindō · ${R.color}${R.label}`, fadeInDuration: 8, stayDuration: 70, fadeOutDuration: 15 });
  player.sendMessage(`§7Your nindō — your ninja way — is:\n${nindoText(id)}\n§8(Shinobi Record → Nindō)`);
  const big = n.rarity === "epic" || n.rarity === "legendary";
  try {
    player.playSound(big ? "ui.toast.challenge_complete" : "random.levelup", { volume: 1, pitch: 1.1 });
    api?.particle(player.dimension, "aegis:chakra_burst", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
  } catch {
    /* ignore */
  }
  if (announce && big) world.sendMessage(`§e${player.name}§7's nindō is ${R.color}§l${n.name}§r §8(${R.color}${R.label}§8)§7!`);
  return id;
}

export function beginNindoRoll(player) {
  if (!getNindoId(player)) rollNindo(player);
}

export async function nindoMenu(player) {
  const id = getNindoId(player);
  const f = new ActionFormData().title("§lNindō");
  f.body(id ? nindoText(id) : "§7You haven't found your ninja way yet.");
  f.button("Close");
  await f.show(player);
}

// ---------------------------------------------------------------------------
// Phoenix of Rebirth
// ---------------------------------------------------------------------------
function rebirth(p) {
  p.setDynamicProperty(PHOENIX_PROP, Date.now() + PHOENIX_COOLDOWN);
  phoenixWarned.delete(p.id);
  try {
    const h = p.getComponent("minecraft:health");
    h.setCurrentValue(Math.max(h.currentValue, h.effectiveMax * 0.7));
  } catch {
    /* ignore */
  }
  eff(p, "regeneration", 100, 1);
  eff(p, "fire_resistance", 600, 0);
  const dim = p.dimension;
  const at = p.location;
  for (const id of ["aegis:fire_burst", "aegis:cine_flame", "aegis:cine_ring"]) api.particle(dim, id, { x: at.x, y: at.y + (id === "aegis:cine_ring" ? 0 : 1), z: at.z }, [1, 0.5, 0.1]);
  api.sound(dim, "aegis.fire_roar", at, 1.6, 1);
  api.sound(dim, "aegis.transform", at, 1.2, 1.3);
  for (const e of dim.getEntities({ location: at, maxDistance: 5 })) {
    if (e.id === p.id || !api.canBeHit(e, p)) continue;
    api.hurt(e, 8, p, "fire");
    try {
      e.setOnFire(4, true);
    } catch {
      /* ignore */
    }
  }
  showTitle(p, "§6§lPhoenix of Rebirth", { subtitle: "§7You rise from the ashes", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 12 });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function initNindos(helpers) {
  api = helpers;

  // Existing players (and anyone who missed it) roll on their next join, once they have a village.
  world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (getNindoId(player) || !getVillage(player)) return;
    system.runTimeout(() => api.isValid(player) && getVillage(player) && beginNindoRoll(player), 320);
  });

  // Damage taken (players with a nindō) and the attacker-side bonuses that don't go through api.hurt / the M1 combo.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity: victim, damage, damageSource }) => {
    if (!(damage > 0) || isEcho(victim, damage)) return;
    const now = system.currentTick;
    const cause = damageSource?.cause;
    let attacker = damageSource?.damagingEntity;

    // kunai / shuriken thrown by a player
    const proj = damageSource?.damagingProjectile?.typeId;
    if ((proj === "aegis:kunai" || proj === "aegis:shuriken") && of(attacker)) {
      const total = nindoDamage(attacker, victim, damage, "thrown");
      if (total > damage) boostHit(victim, damage, total, attacker, "projectile");
      else healBack(victim, damage - total);
    }
    // companions and summons of a Passing the Will player
    if (attacker && attacker.typeId !== "minecraft:player") {
      let owner;
      try {
        owner = world.getEntity(attacker.getDynamicProperty("aegis:owner"));
      } catch {
        owner = undefined;
      }
      const m = of(owner)?.allyDmg;
      if (m && victim.id !== owner.id) boostHit(victim, damage, damage * m, attacker);
    }

    // the victim's nindō
    const n = of(victim);
    if (!n) return;
    let h;
    try {
      h = victim.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
    } catch {
      return;
    }
    lastHurt.set(victim.id, now);
    if (n.evade && Math.random() < n.evade && cause !== "fall" && cause !== "void") {
      healBack(victim, damage);
      api.particle(victim.dimension, "aegis:smoke_puff", victim.location);
      victim.onScreenDisplay?.setActionBar("§7Evaded!");
      if (n.fleeSpeed) eff(victim, "speed", 40, 1);
      return;
    }
    const c = context(victim);
    let m = val(n.taken, c) * (n.takenCause?.[cause] ?? 1);
    if (m < 1) healBack(victim, damage * (1 - m));
    else if (m > 1) drain(victim, damage * (m - 1));
    if (n.fleeSpeed) eff(victim, "speed", 40, 1);
    if (n.revenge && cause !== "fall") {
      const r = revenge.get(victim.id) ?? {};
      r.bonus = Math.min(10, (r.until >= now ? r.bonus : 0) + damage * 0.5);
      r.until = now + 100;
      if (attacker && attacker.id !== victim.id) {
        r.foe = attacker.id;
        r.foeUntil = now + 300;
      }
      revenge.set(victim.id, r);
    }
    if (n.phoenix && hpFrac(victim) < 0.25 && !phoenixCharging(victim)) rebirth(victim);
  });

  // Reaper: kills feed you. Passing the Will: your fall strengthens your allies.
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    let k = damageSource?.damagingEntity;
    if (k && k.typeId !== "minecraft:player") {
      try {
        k = world.getEntity(k.getDynamicProperty("aegis:owner"));
      } catch {
        k = undefined;
      }
    }
    const kn = of(k);
    if (kn?.reap && deadEntity.id !== k.id) {
      healBack(k, kn.reap.hp);
      try {
        api.setChakra(k, api.getChakra(k) + kn.reap.chakra);
      } catch {
        /* ignore */
      }
      api.particle(k.dimension, "aegis:beast_aura", k.location, [0.6, 0.05, 0.1]);
    }
    const dn = of(deadEntity);
    if (dn?.lastWill) {
      const allyList = allies(deadEntity, 20).filter((a) => a.typeId === "minecraft:player");
      for (const a of allyList) {
        eff(a, "strength", 600, 0);
        eff(a, "regeneration", 600, 0);
        a.sendMessage(`§e${deadEntity.name}§7's will lives on in you. §8(Strength I, Regeneration I — 30s)`);
        api.particle(a.dimension, "aegis:chakra_aura", a.location, [1, 0.8, 0.3]);
      }
    }
  });

  // Conditions that are checked over time
  system.runInterval(() => {
    const now = system.currentTick;
    for (const p of world.getAllPlayers()) {
      const n = of(p);
      if (!n) continue;
      const prev = ctxCache.get(p.id);
      const loc = p.location;
      const still = prev?.loc && Math.abs(prev.loc.x - loc.x) < 0.05 && Math.abs(prev.loc.z - loc.z) < 0.05;
      const c = { ally: allies(p, n.selfHeal ? 12 : 10).length > 0, nature: n.leafRegen ? onNatureGround(p) : false, loc: { ...loc } };
      ctxCache.set(p.id, c);
      const frac = hpFrac(p);
      if (n.selfHeal && !c.ally && now % 80 < 10 && frac < 1) healBack(p, 1);
      if (n.shaken && frac < 0.3) eff(p, "weakness", 30, 0);
      if (n.leafRegen && c.nature && still) eff(p, "regeneration", 30, 0);
      if (n.restRegen && now - (lastHurt.get(p.id) ?? -1e9) > 160) eff(p, "regeneration", 30, 0);
      if (n.sprintSpeed && p.isSprinting) eff(p, "speed", 20, 1);
      if (n.phoenix && !phoenixCharging(p) && p.getDynamicProperty(PHOENIX_PROP) && !phoenixWarned.has(p.id)) {
        phoenixWarned.add(p.id);
        p.onScreenDisplay?.setActionBar("§6Your flames are rekindled — the Phoenix can rise again.");
      }
    }
    if (now % 1200 < 10) {
      for (const m of [ctxCache, lastHurt, revenge, lastNature]) for (const id of [...m.keys()]) if (!world.getEntity(id)) m.delete(id);
    }
  }, 10);

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:nindo" || p?.typeId !== "minecraft:player") return;
    const [cmd, arg] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    if (cmd === "reroll") return void rollNindo(p, false);
    if (cmd === "clear") {
      p.setDynamicProperty(PROP, undefined);
      return p.sendMessage("§7Nindō cleared — a new one is rolled on your next join.");
    }
    if (cmd === "set") {
      if (!NINDOS[arg]) return p.sendMessage(`§cUnknown nindō. §7Ids: ${IDS.join(", ")}`);
      setNindo(p, arg);
      return p.sendMessage(`§7Nindō set:\n${nindoText(arg)}`);
    }
    if (cmd === "list") {
      const total = IDS.reduce((s, x) => s + RARITY[NINDOS[x].rarity].weight, 0);
      return p.sendMessage(IDS.map((x) => `${nindoLabel(x)} §8${x} · ${((RARITY[NINDOS[x].rarity].weight / total) * 100).toFixed(1)}%`).join("\n"));
    }
    const mine = getNindoId(p);
    p.sendMessage(mine ? nindoText(mine) : "§7You have no nindō yet.");
  });
}
