// Way of The Shinobi — Naruto add-on for Minecraft Bedrock.
// Chakra system, jutsu scrolls and ninja tools, driven by @minecraft/server.

import { world, system, ItemStack, MolangVariableMap } from "@minecraft/server";
import { initClans, applyNameTag, registerClanAbilities, getClanId, CLANS, clanMaxChakra, clanRegenMultiplier, handleClanItemUse, clanJutsuCostMultiplier } from "./clans.js";
import { initBijuu, bijuuChakraBonus, bijuuRegenMultiplier, handleBijuuItemUse, isTransformed, isBijuuMastered } from "./bijuu.js";
import { initSwords, handleSwordUse } from "./swords.js";
import { initHud } from "./hud.js";
import { initNpcs } from "./npcs.js";
import { initEnemies, spawnAkatsukiNear } from "./enemies.js";
import { initCompanions, handleSummonUse } from "./companions.js";
import { initSage, sageMultiplier } from "./sage.js";
import { initArmor, armorChakraBonus, armorRegenMultiplier, armorDamageMultiplier } from "./armor.js";
import { impactFx, castFx, sfx, shake, chargeFx } from "./cinematic.js";
import { makeJutsu2 } from "./jutsu2.js";
import { makeReleases } from "./releases.js";
import { initCurrency } from "./currency.js";
import { initQuests } from "./quests.js";
import { initNatures, natureCostMultiplier, natureDamageMultiplier, onJutsuCast, natureTag } from "./natures.js";
import { initLevels, handleRecordUse, levelChakraBonus, levelRegenMultiplier, ninjutsuMultiplier, cooldownMultiplier, gainJutsuXp, getLevel, xpInfo } from "./levels.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CHAKRA_PROP = "aegis:chakra";
const WELCOME_PROP = "aegis:welcomed";
const OWNER_PROP = "aegis:owner";

const BASE_MAX_CHAKRA = 100;
const getMaxChakra = (player) => clanMaxChakra(player, BASE_MAX_CHAKRA) + bijuuChakraBonus(player) + levelChakraBonus(player) + armorChakraBonus(player);
const REGEN_PER_SECOND = 4; // base regen
const HEADBAND_REGEN_BONUS = 1.5; // multiplier while wearing the headband
const FOCUS_REGEN_BONUS = 3; // multiplier while sneaking and standing still
const MAX_CLONES = 4;

const HUD_INTERVAL = 5; // ticks

// cost = chakra, cooldown = ticks
const JUTSU = {
  "aegis:fireball_scroll": { name: "Fire Style: Fireball Jutsu", cost: 25, cooldown: 40, cast: castFireball },
  "aegis:sphere_scroll": { name: "Rasengan", cost: 30, cooldown: 60, cast: castSphere },
  "aegis:substitution_scroll": { name: "Substitution Jutsu", cost: 20, cooldown: 100, cast: castSubstitution },
  "aegis:clone_scroll": { name: "Shadow Clone Jutsu", cost: 40, cooldown: 200, cast: castClones },
  "aegis:flash_scroll": { name: "Body Flicker", cost: 10, cooldown: 15, cast: castFlashStep },
  "aegis:wind_scroll": { name: "Wind Style: Great Breakthrough", cost: 15, cooldown: 30, cast: castGalePalm },
  "aegis:chidori_scroll": { name: "Chidori", cost: 35, cooldown: 80, cast: castChidori },
  "aegis:phoenix_scroll": { name: "Fire Style: Phoenix Sage Fire", cost: 30, cooldown: 60, cast: castPhoenix },
  "aegis:water_dragon_scroll": { name: "Water Style: Water Dragon Bullet", cost: 35, cooldown: 80, cast: castWaterDragon },
  "aegis:earth_wall_scroll": { name: "Earth Style: Earth Wall", cost: 25, cooldown: 200, cast: castEarthWall },
  "aegis:chidori_current_scroll": { name: "Lightning Style: Chidori Current", cost: 30, cooldown: 120, cast: castChidoriCurrent },
  "aegis:rasenshuriken_scroll": { name: "Wind Style: Rasenshuriken", cost: 60, cooldown: 240, cast: castRasenshuriken },
  "aegis:mystical_palm_scroll": { name: "Mystical Palm Technique", cost: 25, cooldown: 100, cast: castMysticalPalm },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const norm = (v) => {
  const l = len(v) || 1;
  return scale(v, 1 / l);
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function particle(dim, id, loc, color) {
  try {
    if (color) {
      const vars = new MolangVariableMap();
      vars.setColorRGB("variable.color", { red: color[0], green: color[1], blue: color[2] });
      dim.spawnParticle(id, loc, vars);
    } else dim.spawnParticle(id, loc);
  } catch {
    /* unknown particle or unloaded chunk — ignore */
  }
}

function sound(dim, id, loc, volume = 1, pitch = 1) {
  try {
    dim.playSound(id, loc, { volume, pitch });
  } catch {
    try {
      world.playSound(id, loc, { volume, pitch });
    } catch {
      /* ignore */
    }
  }
}

// applyKnockback changed signature in @minecraft/server 2.x — support both.
function knockback(entity, dirX, dirZ, horizontal, vertical) {
  try {
    entity.applyKnockback(dirX, dirZ, horizontal, vertical);
  } catch {
    try {
      entity.applyKnockback({ x: dirX * horizontal, z: dirZ * horizontal }, vertical);
    } catch {
      /* entity may not support knockback */
    }
  }
}

function hurt(target, amount, attacker, cause = "entityAttack") {
  // Ninjutsu stat boosts every scripted technique a player lands.
  if (attacker?.typeId === "minecraft:player") amount *= ninjutsuMultiplier(attacker) * sageMultiplier(attacker) * armorDamageMultiplier(attacker) * natureDamageMultiplier(attacker);
  try {
    target.applyDamage(amount, { cause, damagingEntity: attacker });
  } catch {
    try {
      target.applyDamage(amount);
    } catch {
      /* ignore */
    }
  }
}

function isValid(e) {
  try {
    return e && (typeof e.isValid === "function" ? e.isValid() : e.isValid);
  } catch {
    return false;
  }
}

function canBeHit(e, caster) {
  if (!isValid(e) || e.id === caster.id) return false;
  if (e.typeId === "minecraft:item" || e.typeId === "minecraft:xp_orb") return false;
  if (e.typeId === "aegis:jutsu_orb" || e.typeId === "aegis:susanoo") return false;
  // never hit friendly village NPCs with a player's techniques, nor your own clones / companions / summons
  if (e.typeId === "aegis:npc" && caster.typeId === "minecraft:player") return false;
  if (e.typeId.startsWith("aegis:")) {
    try {
      if (e.getDynamicProperty(OWNER_PROP) === caster.id) return false;
    } catch {
      /* ignore */
    }
  }
  return !!e.getComponent("minecraft:health");
}

// ---------------------------------------------------------------------------
// Visuals: player animations, effect models that follow things, lunges
// ---------------------------------------------------------------------------
function anim(entity, name, controller = "aegis_jutsu", stopExpression) {
  try {
    const opts = { blendOutTime: 0.15, controller };
    if (stopExpression) opts.stopExpression = stopExpression;
    entity.playAnimation(name, opts);
  } catch {
    /* ignore */
  }
}

// World position of the player's right hand (roughly).
function handPos(player) {
  const d = player.getViewDirection();
  const h = norm({ x: d.x, y: 0, z: d.z });
  const right = { x: -h.z, y: 0, z: h.x };
  return add(player.getHeadLocation(), add(add(scale(d, 0.7), scale(right, 0.35)), { x: 0, y: -0.45, z: 0 }));
}

function spawnFx(dim, typeId, event, loc) {
  try {
    const e = dim.spawnEntity(typeId, loc);
    if (event) e.triggerEvent(event);
    return e;
  } catch {
    return undefined;
  }
}

function removeFx(e) {
  try {
    if (isValid(e)) e.remove();
  } catch {
    /* ignore */
  }
}

// Effect models (Rasengan orb, Susanoo...) glued to a moving position every tick.
const followers = [];

function follow(entity, posFn, ticks, rotFn) {
  if (entity) followers.push({ entity, posFn, rotFn, until: system.currentTick + ticks });
}

function updateFollowers() {
  for (let i = followers.length - 1; i >= 0; i--) {
    const f = followers[i];
    const pos = isValid(f.entity) && system.currentTick < f.until ? f.posFn() : undefined;
    if (!pos) {
      removeFx(f.entity);
      followers.splice(i, 1);
      continue;
    }
    try {
      const rot = f.rotFn?.();
      f.entity.teleport(pos, rot ? { rotation: rot } : undefined);
    } catch {
      /* ignore */
    }
  }
}

// Dash forward; the first thing within `range` during the next `ticks` gets onHit().
function lungeStrike(player, { power = 3, range = 2.5, ticks = 12, onHit, trail }) {
  const dim = player.dimension;
  const d = player.getViewDirection();
  const h = norm({ x: d.x, y: 0, z: d.z });
  knockback(player, h.x, h.z, power, 0.2);
  let done = false;
  for (let t = 1; t <= ticks; t++) {
    system.runTimeout(() => {
      if (done || !isValid(player)) return;
      trail?.();
      const target = dim.getEntities({ location: player.location, maxDistance: range }).find((e) => canBeHit(e, player));
      if (!target) return;
      done = true;
      onHit(target);
    }, t);
  }
}

// ---------------------------------------------------------------------------
// Chakra
// ---------------------------------------------------------------------------
function getChakra(player) {
  const v = player.getDynamicProperty(CHAKRA_PROP);
  return typeof v === "number" ? v : getMaxChakra(player);
}

function setChakra(player, value) {
  player.setDynamicProperty(CHAKRA_PROP, Math.max(0, Math.min(getMaxChakra(player), value)));
}

function wearingHeadband(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    return eq?.getEquipment("Head")?.typeId === "aegis:headband";
  } catch {
    return false;
  }
}

function chakraBar(value, max) {
  const segments = 20;
  const filled = Math.round((value / max) * segments);
  return "§b" + "|".repeat(filled) + "§8" + "|".repeat(segments - filled);
}

function heldTypeId(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex)?.typeId;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Cooldowns
// ---------------------------------------------------------------------------
const cooldowns = new Map(); // `${playerId}|${itemId}` -> tick when ready

function cooldownLeft(player, itemId) {
  const ready = cooldowns.get(`${player.id}|${itemId}`) ?? 0;
  return Math.max(0, ready - system.currentTick);
}

function startCooldown(player, itemId, ticks) {
  const mult = player?.typeId === "minecraft:player" ? cooldownMultiplier(player) : 1;
  cooldowns.set(`${player.id}|${itemId}`, system.currentTick + Math.round(ticks * mult));
}

// ---------------------------------------------------------------------------
// Casting
// ---------------------------------------------------------------------------
world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
  if (!itemStack || player.typeId !== "minecraft:player") return;
  if (handleRecordUse(player, itemStack)) return;
  if (handleClanItemUse(player, itemStack)) return;
  if (handleBijuuItemUse(player, itemStack)) return;
  if (handleSwordUse(player, itemStack)) return;
  if (handleSummonUse(player, itemStack)) return;
  const jutsu = JUTSU[itemStack.typeId];
  if (!jutsu) return;

  // Kekkei genkai releases belong to one clan.
  if (jutsu.clan && getClanId(player) !== jutsu.clan) {
    const c = CLANS[jutsu.clan];
    player.onScreenDisplay.setActionBar(`§cOnly the ${c.color}${c.name} Clan§c can use ${jutsu.name.split(":")[0]}.`);
    sound(player.dimension, "note.bass", player.location, 0.6, 0.6);
    return;
  }
  const left = cooldownLeft(player, itemStack.typeId);
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7${jutsu.name} ready in §f${(left / 20).toFixed(1)}s`);
    return;
  }
  const cost = Math.round(jutsu.cost * clanJutsuCostMultiplier(player, itemStack.typeId) * natureCostMultiplier(player, itemStack.typeId));
  const chakra = getChakra(player);
  if (chakra < cost) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(chakra)}/${cost})`);
    sound(player.dimension, "note.bass", player.location, 0.6, 0.6);
    return;
  }

  // cast() returns false if the jutsu fizzled (e.g. no target) — no cost then.
  onJutsuCast(player, itemStack.typeId); // affinity damage boost starts before the jutsu lands
  const ok = jutsu.cast(player);
  if (ok === false) return;

  setChakra(player, chakra - cost);
  gainJutsuXp(player, cost);
  startCooldown(player, itemStack.typeId, jutsu.cooldown);
  player.onScreenDisplay.setActionBar(`§6${jutsu.name}!${natureTag(player, itemStack.typeId)}`);
});

// --- Scripted projectiles (Fireball Jutsu, Flame Bullet, Tailed Beast Bombs). ---
const projectiles = [];

const FIREBALL = {
  speed: 1.35, maxAge: 30, damage: 9, radius: 3.5, knock: 0.8, fire: 5, orbEvent: "aegis:as_fireball",
  trail: "aegis:fire_trail", burst: "aegis:fire_burst", hitRadius: 1.6, sound: "random.explode",
};

// Launches a projectile from `start` along `dir`. opts override FIREBALL's defaults.
function launchProjectile(caster, start, dir, opts = {}) {
  const o = { ...FIREBALL, ...opts };
  const orb = o.noOrb ? undefined : spawnFx(caster.dimension, o.orbEntity ?? "aegis:jutsu_orb", o.orbEntity ? undefined : o.orbEvent, sub(start, { x: 0, y: o.orbOffset ?? 0.25, z: 0 }));
  projectiles.push({ caster, dim: caster.dimension, pos: start, dir: norm(dir), age: 0, orb, o });
}

// Fire Style: Fireball — seals, a deep inhale, then the fireball bursts out (launch synced to the exhale).
function castFireball(player, dir, animName = "animation.aegis.fireball_jutsu", delay = 12) {
  anim(player, animName);
  chargeFx(player, [1, 0.45, 0.1], delay);
  system.runTimeout(() => {
    if (!isValid(player)) return;
    const d = dir ?? player.getViewDirection();
    launchProjectile(player, add(player.getHeadLocation(), scale(d, 1.5)), d);
    sound(player.dimension, "mob.ghast.fireball", player.location, 1, 0.8);
    sfx(player.dimension, "aegis.fire", player.location, 1.2, 1);
  }, delay);
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    const o = pr.o;
    let hit = false;
    let fizzled = false;
    // Move in small sub-steps so it doesn't skip through walls.
    const steps = Math.max(1, Math.ceil(o.speed / 0.45));
    for (let step = 0; step < steps && !hit; step++) {
      pr.pos = add(pr.pos, scale(pr.dir, o.speed / steps));
      try {
        const block = pr.dim.getBlock(pr.pos);
        if (!block || (!block.isAir && !block.isLiquid)) hit = true;
        else if (block.isLiquid && o.fire) {
          particle(pr.dim, "minecraft:water_evaporation_bucket_emitter", pr.pos);
          sound(pr.dim, "random.fizz", pr.pos);
          fizzled = true;
          break;
        }
      } catch {
        hit = true; // unloaded chunk
      }
      if (!hit && isValid(pr.caster)) {
        const near = pr.dim.getEntities({ location: pr.pos, maxDistance: o.hitRadius });
        if (near.some((e) => canBeHit(e, pr.caster) && !(o.ignoreFamily && e.matches?.({ families: [o.ignoreFamily] })))) hit = true;
      }
    }
    if (fizzled) {
      removeFx(pr.orb);
      projectiles.splice(i, 1);
      continue;
    }
    particle(pr.dim, o.trail, pr.pos, o.color);
    if (isValid(pr.orb)) {
      try {
        pr.orb.teleport(sub(pr.pos, { x: 0, y: o.orbOffset ?? 0.25, z: 0 }));
      } catch {
        /* ignore */
      }
    }
    pr.age++;
    if (hit || pr.age > o.maxAge) {
      removeFx(pr.orb);
      explodeProjectile(pr);
      projectiles.splice(i, 1);
    }
  }
}

function explodeProjectile(pr) {
  const o = pr.o;
  sound(pr.dim, o.sound, pr.pos, 1, o.radius > 4 ? 0.6 : 1.2);
  particle(pr.dim, o.burst, pr.pos, o.color);
  if (!o.noOrb) particle(pr.dim, "minecraft:huge_explosion_emitter", pr.pos);
  impactFx(pr.dim, pr.pos, o.color ?? (o.fire ? [1, 0.45, 0.1] : [0.6, 0.8, 1]), o.power ?? o.radius / 3.5);
  if (!isValid(pr.caster)) return;
  for (const e of pr.dim.getEntities({ location: pr.pos, maxDistance: o.radius })) {
    if (!canBeHit(e, pr.caster)) continue;
    if (o.ignoreFamily && e.matches?.({ families: [o.ignoreFamily] })) continue;
    hurt(e, o.damage, pr.caster, o.fire ? "fire" : "entityExplosion");
    if (o.fire) {
      try {
        e.setOnFire(o.fire, true);
      } catch {
        /* ignore */
      }
    }
    const away = norm(sub(e.location, pr.pos));
    knockback(e, away.x, away.z, o.knock, 0.35 + o.knock * 0.2);
    for (const [id, ticks, amp] of o.effects ?? []) {
      try {
        e.addEffect(id, ticks, { amplifier: amp });
      } catch {
        /* ignore */
      }
    }
  }
  o.onExplode?.(pr.pos, pr.dim, pr.caster);
}

// --- Rasengan: form the spinning orb in your palm, then drive it into the first thing you reach. ---
function castSphere(player) {
  const dim = player.dimension;
  const CHARGE = 14;
  anim(player, "animation.aegis.rasengan_form");
  chargeFx(player, [0.4, 0.75, 1], CHARGE);
  const orb = spawnFx(dim, "aegis:jutsu_orb", "aegis:as_rasengan", handPos(player));
  follow(orb, () => (isValid(player) ? sub(handPos(player), { x: 0, y: 0.25, z: 0 }) : undefined), CHARGE + 14);
  sfx(dim, "aegis.rasengan", player.location, 1.3, 1);
  for (let i = 0; i < CHARGE + 14; i++) {
    system.runTimeout(() => {
      if (!isValid(player)) return;
      const hp = handPos(player);
      particle(dim, "aegis:rasengan", hp);
      particle(dim, "aegis:rasengan_core", hp);
    }, i);
  }
  system.runTimeout(() => {
    if (!isValid(player)) return;
    anim(player, "animation.aegis.ram_strike");
    sound(dim, "mob.breeze.wind_burst", player.location, 0.6, 1.4);
    lungeStrike(player, {
      power: 2.6, range: 2.6, ticks: 14,
      onHit: (target) => {
        const center = add(target.location, { x: 0, y: 1, z: 0 });
        particle(dim, "aegis:chakra_burst", center);
        particle(dim, "minecraft:huge_explosion_emitter", center);
        impactFx(dim, target.location, [0.4, 0.75, 1], 2);
        sound(dim, "random.explode", center, 0.7, 1.6);
        hurt(target, 14, player);
        const d = player.getViewDirection();
        const h = norm({ x: d.x, y: 0, z: d.z });
        knockback(target, h.x, h.z, 3.2, 0.7);
        removeFx(orb);
      },
    });
  }, CHARGE);
  return true;
}

// --- Substitution: the next hit within 8s is negated and you vanish behind the attacker. ---
const substitutionArmed = new Map(); // playerId -> tick it expires

function castSubstitution(player) {
  substitutionArmed.set(player.id, system.currentTick + 160);
  anim(player, "animation.aegis.substitution");
  particle(player.dimension, "aegis:chakra_aura", player.location);
  sound(player.dimension, "random.pop", player.location, 1, 0.6);
  player.sendMessage("§7[Substitution] Ready — the next hit you take will be avoided (8s).");
}

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
  if (hurtEntity.typeId !== "minecraft:player") return;
  const expires = substitutionArmed.get(hurtEntity.id);
  if (!expires) return;
  substitutionArmed.delete(hurtEntity.id);
  if (system.currentTick > expires) return;

  const player = hurtEntity;
  const dim = player.dimension;
  const oldLoc = player.location;

  // Undo the damage.
  try {
    const health = player.getComponent("minecraft:health");
    health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + damage));
  } catch {
    /* ignore */
  }

  // Poof: smoke where we stood.
  particle(dim, "aegis:smoke_puff", oldLoc);
  sound(dim, "mob.endermen.portal", oldLoc, 1, 1.4);

  // Reappear behind the attacker (or step back if there isn't one).
  const attacker = damageSource?.damagingEntity;
  let dest;
  let facing;
  if (attacker && isValid(attacker) && attacker.dimension.id === dim.id) {
    const look = attacker.getViewDirection();
    const back = norm({ x: look.x, y: 0, z: look.z });
    dest = sub(attacker.location, scale(back, 2));
    facing = attacker.location;
  } else {
    const look = player.getViewDirection();
    const back = norm({ x: look.x, y: 0, z: look.z });
    dest = sub(oldLoc, scale(back, 5));
  }
  if (isSafeSpot(dim, dest)) {
    try {
      player.teleport(dest, facing ? { facingLocation: facing } : undefined);
      particle(dim, "aegis:smoke_puff", dest);
    } catch {
      /* ignore */
    }
  }
  player.onScreenDisplay.setActionBar("§6Substitution!");
});

function isSafeSpot(dim, loc) {
  try {
    const feet = dim.getBlock(loc);
    const head = dim.getBlock(add(loc, { x: 0, y: 1, z: 0 }));
    return !!feet && !!head && (feet.isAir || feet.isLiquid) && (head.isAir || head.isLiquid);
  } catch {
    return false;
  }
}

// --- Shadow Clone Jutsu: summon allies that fight hostile mobs for 30 seconds. ---
function castClones(player) {
  const dim = player.dimension;
  const existing = dim
    .getEntities({ type: "aegis:chakra_clone" })
    .filter((e) => e.getDynamicProperty(OWNER_PROP) === player.id);
  const room = MAX_CLONES - existing.length;
  if (room <= 0) {
    player.onScreenDisplay.setActionBar(`§7You already have ${MAX_CLONES} clones out.`);
    return false;
  }
  const count = Math.min(2, room);
  anim(player, "animation.aegis.clone_seal");
  chargeFx(player, [1, 1, 1], 9, "aegis.whoosh");
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    let loc = add(player.location, { x: Math.cos(a) * 1.5, y: 0, z: Math.sin(a) * 1.5 });
    if (!isSafeSpot(dim, loc)) loc = player.location;
    try {
      const clone = dim.spawnEntity("aegis:chakra_clone", loc);
      clone.setDynamicProperty(OWNER_PROP, player.id);
      clone.nameTag = `${player.name}'s Shadow Clone`;
      particle(dim, "aegis:smoke_puff", loc);
    } catch {
      /* ignore */
    }
  }
  sound(dim, "random.pop", player.location, 1, 0.5);
  return true;
}

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId !== "aegis:chakra_clone") return;
  try {
    particle(deadEntity.dimension, "aegis:smoke_puff", deadEntity.location);
  } catch {
    /* ignore */
  }
});

// Hitting your own clone dispels it.
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  if (hitEntity.typeId === "aegis:chakra_clone" && damagingEntity.typeId === "minecraft:player") {
    if (hitEntity.getDynamicProperty(OWNER_PROP) === damagingEntity.id) {
      particle(hitEntity.dimension, "aegis:smoke_puff", hitEntity.location);
      try {
        hitEntity.triggerEvent("aegis:dispel");
      } catch {
        hitEntity.remove();
      }
    }
  }
});

// --- Body Flicker: a burst of speed in the direction you're looking. ---
function castFlashStep(player) {
  anim(player, "animation.aegis.body_flicker");
  const dir = player.getViewDirection();
  const h = norm({ x: dir.x, y: 0, z: dir.z });
  knockback(player, h.x, h.z, 3.0, Math.max(0.25, dir.y * 0.8));
  try {
    player.addEffect("slow_falling", 30, { amplifier: 0, showParticles: false });
  } catch {
    /* ignore */
  }
  particle(player.dimension, "aegis:smoke_puff", player.location);
  sound(player.dimension, "mob.enderdragon.flap", player.location, 0.8, 1.6);
  sfx(player.dimension, "aegis.whoosh", player.location, 1.2, 1.3);
}

// --- Wind Style: Great Breakthrough: blast everything in front of you away. ---
function castGalePalm(player) {
  const dim = player.dimension;
  const dir = player.getViewDirection();
  const head = player.getHeadLocation();
  anim(player, "animation.aegis.wind_palm");
  for (let d = 1; d <= 8; d++) {
    particle(dim, "aegis:wind_gust", add(head, scale(dir, d)));
  }
  sound(dim, "mob.breeze.wind_burst", head, 1, 1);
  sound(dim, "mob.enderdragon.flap", head, 1, 0.6);
  sfx(dim, "aegis.whoosh", head, 1.5, 0.8);
  castFx(player, [0.6, 1, 0.75]);
  shake(dim, head, 0.2, 0.4, 12);

  for (const e of dim.getEntities({ location: head, maxDistance: 9 })) {
    if (!canBeHit(e, player)) continue;
    const to = sub(e.location, player.location);
    if (dot(norm(to), dir) < 0.55) continue; // only a cone in front
    const h = norm({ x: to.x, y: 0, z: to.z });
    knockback(e, h.x, h.z, 2.6, 0.55);
    hurt(e, 3, player);
  }
}

// --- Chidori: lightning gathers in your hand, then you lunge; the first thing you hit takes it all. ---
function castChidori(player) {
  const dim = player.dimension;
  const CHARGE = 14;
  anim(player, "animation.aegis.chidori_charge");
  chargeFx(player, [0.6, 0.85, 1], CHARGE);
  sound(dim, "ambient.weather.thunder", player.location, 0.5, 1.8);
  sfx(dim, "aegis.chidori", player.location, 1.4, 1); // the "thousand birds" chirp
  for (let i = 0; i < CHARGE + 14; i++) {
    system.runTimeout(() => {
      if (!isValid(player)) return;
      const hand = sub(handPos(player), { x: 0, y: 0.25, z: 0 });
      particle(dim, "aegis:chidori", hand);
      if (i % 4 === 0) particle(dim, "minecraft:electric_spark_particle", hand);
    }, i);
  }
  system.runTimeout(() => {
    if (!isValid(player)) return;
    anim(player, "animation.aegis.ram_strike");
    lungeStrike(player, {
      power: 3.6, range: 2.6, ticks: 14,
      onHit: (target) => {
        hurt(target, 13, player);
        const kb = norm({ x: target.location.x - player.location.x, y: 0, z: target.location.z - player.location.z });
        knockback(target, kb.x, kb.z, 1.5, 0.4);
        particle(dim, "aegis:lightning_burst", add(target.location, { x: 0, y: 1, z: 0 }));
        sound(dim, "ambient.weather.lightning.impact", target.location, 0.8, 1.4);
        sfx(dim, "aegis.lightning", target.location, 1.5, 1);
        impactFx(dim, target.location, [0.6, 0.85, 1], 2);
      },
    });
  }, CHARGE);
}

// --- Fire Style: Phoenix Sage Fire — a fan of small fireballs. ---
function castPhoenix(player) {
  anim(player, "animation.aegis.phoenix_breath");
  chargeFx(player, [1, 0.45, 0.1], 9);
  system.runTimeout(() => {
    if (!isValid(player)) return;
    const d = player.getViewDirection();
    const start = add(player.getHeadLocation(), scale(d, 1.2));
    for (let i = 0; i < 5; i++) {
      const ang = (i - 2) * 0.16 + (Math.random() - 0.5) * 0.06;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const dir = { x: d.x * c - d.z * sn, y: d.y + (Math.random() - 0.5) * 0.08, z: d.x * sn + d.z * c };
      system.runTimeout(() => {
        if (!isValid(player)) return;
        launchProjectile(player, start, dir, { noOrb: true, speed: 1.3, maxAge: 26, damage: 5, radius: 2.2, knock: 0.4, fire: 4, trail: "aegis:fire_trail", burst: "aegis:fire_burst" });
      }, i * 2);
    }
    sound(player.dimension, "mob.blaze.shoot", player.location, 1, 1.2);
    sfx(player.dimension, "aegis.fire", player.location, 1.4, 1.1);
  }, 9);
}

// --- Water Style: Water Dragon Bullet — a heavy water orb that crashes and slows. ---
function castWaterDragon(player) {
  anim(player, "animation.aegis.water_seals");
  chargeFx(player, [0.3, 0.6, 1], 14);
  sound(player.dimension, "bucket.fill_water", player.location, 1, 0.8);
  for (let t = 0; t < 12; t += 3) system.runTimeout(() => isValid(player) && particle(player.dimension, "aegis:water_splash", add(player.location, { x: 0, y: 0.2, z: 0 })), t);
  system.runTimeout(() => {
    if (!isValid(player)) return;
    anim(player, "animation.aegis.both_palms");
    const d = player.getViewDirection();
    launchProjectile(player, add(player.getHeadLocation(), scale(d, 1.8)), d, {
      orbEvent: "aegis:as_water", speed: 1.0, maxAge: 40, damage: 14, radius: 4.2, knock: 2.6, fire: 0,
      trail: "aegis:water_splash", burst: "aegis:water_splash", hitRadius: 2, sound: "random.splash", effects: [["slowness", 60, 2]], color: [0.3, 0.6, 1],
    });
    sound(player.dimension, "random.splash", player.location, 1, 0.6);
  }, 14);
}

// --- Earth Style: Earth Wall — a mud-brick wall erupts in front of you for 15s. ---
function castEarthWall(player) {
  const dim = player.dimension;
  const d = player.getViewDirection();
  const fwd = Math.abs(d.x) > Math.abs(d.z) ? { x: Math.sign(d.x), z: 0 } : { x: 0, z: Math.sign(d.z) };
  const side = { x: -fwd.z, z: fwd.x };
  const base = { x: Math.floor(player.location.x) + fwd.x * 3, y: Math.floor(player.location.y), z: Math.floor(player.location.z) + fwd.z * 3 };
  const spots = [];
  for (let s2 = -3; s2 <= 3; s2++) for (let y = 0; y < 4; y++) spots.push({ x: base.x + side.x * s2, y: base.y + y, z: base.z + side.z * s2 });
  if (!spots.some((l) => dim.getBlock(l)?.isAir)) return false;
  anim(player, "animation.aegis.earth_slam");
  chargeFx(player, [0.65, 0.5, 0.3], 7);
  sound(dim, "dig.stone", player.location, 1, 0.5);
  const placed = [];
  system.runTimeout(() => {
    for (const l of spots) {
      system.runTimeout(() => {
        try {
          const b = dim.getBlock(l);
          if (b?.isAir) {
            b.setType("minecraft:mud_bricks");
            placed.push(l);
          }
        } catch {
          /* ignore */
        }
      }, (l.y - base.y) * 2);
    }
    particle(dim, "aegis:dust", { x: base.x + 0.5, y: base.y, z: base.z + 0.5 });
    particle(dim, "minecraft:huge_explosion_emitter", { x: base.x + 0.5, y: base.y, z: base.z + 0.5 });
    impactFx(dim, { x: base.x + 0.5, y: base.y, z: base.z + 0.5 }, [0.6, 0.45, 0.3], 1.5);
    sound(dim, "random.explode", base, 0.6, 0.5);
    for (const e of dim.getEntities({ location: { x: base.x + 0.5, y: base.y, z: base.z + 0.5 }, maxDistance: 4 })) {
      if (!canBeHit(e, player)) continue;
      hurt(e, 6, player);
      knockback(e, fwd.x, fwd.z, 1.2, 0.9);
    }
  }, 7);
  system.runTimeout(() => {
    for (const l of placed) {
      try {
        const b = dim.getBlock(l);
        if (b?.typeId === "minecraft:mud_bricks") b.setType("minecraft:air");
      } catch {
        /* ignore */
      }
    }
    particle(dim, "aegis:dust", { x: base.x + 0.5, y: base.y, z: base.z + 0.5 });
  }, 300);
}

// --- Lightning Style: Chidori Current — lightning bursts out of your whole body. ---
function castChidoriCurrent(player) {
  const dim = player.dimension;
  anim(player, "animation.aegis.lightning_burst");
  chargeFx(player, [0.6, 0.85, 1], 6);
  sound(dim, "mob.bee.loop", player.location, 1, 2);
  system.runTimeout(() => {
    if (!isValid(player)) return;
    sound(dim, "ambient.weather.thunder", player.location, 0.6, 1.8);
    for (let k = 1; k <= 5; k++) {
      system.runTimeout(() => {
        if (!isValid(player)) return;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          particle(dim, "aegis:chidori", add(player.location, { x: Math.cos(a) * k, y: 0.6 + Math.random(), z: Math.sin(a) * k }));
        }
      }, k);
    }
    particle(dim, "aegis:lightning_burst", add(player.location, { x: 0, y: 1, z: 0 }));
    sfx(dim, "aegis.lightning", player.location, 1.6, 0.9);
    impactFx(dim, player.location, [0.6, 0.85, 1], 2);
    for (const e of dim.getEntities({ location: player.location, maxDistance: 5.5 })) {
      if (!canBeHit(e, player)) continue;
      hurt(e, 8, player, "lightning");
      try {
        e.addEffect("slowness", 50, { amplifier: 4 });
        e.addEffect("weakness", 80, { amplifier: 1 });
      } catch {
        /* ignore */
      }
      particle(dim, "aegis:chidori", add(e.location, { x: 0, y: 1, z: 0 }));
    }
  }, 6);
}

// --- Wind Style: Rasenshuriken — form the shuriken overhead, hurl it, and it erupts into a storm of wind blades. ---
function castRasenshuriken(player) {
  const dim = player.dimension;
  const CHARGE = 21;
  anim(player, "animation.aegis.throw_overhead");
  chargeFx(player, [0.8, 0.95, 1], 21);
  const above = () => add(player.getHeadLocation(), { x: 0, y: 1.3, z: 0 });
  const model = spawnFx(dim, "aegis:rasenshuriken", undefined, above());
  follow(model, () => (isValid(player) ? sub(above(), { x: 0, y: 0.4, z: 0 }) : undefined), CHARGE);
  sound(dim, "mob.breeze.idle_ground", player.location, 1, 1.4);
  for (let t = 0; t < CHARGE; t += 3) {
    system.runTimeout(() => {
      if (!isValid(player)) return;
      particle(dim, "aegis:wind_gust", above());
      particle(dim, "aegis:rasengan", above());
    }, t);
  }
  system.runTimeout(() => {
    if (!isValid(player)) return;
    removeFx(model);
    const d = player.getViewDirection();
    launchProjectile(player, add(above(), scale(d, 1)), d, {
      orbEntity: "aegis:rasenshuriken", orbOffset: 0.4, speed: 1.15, maxAge: 40, damage: 22, radius: 6, knock: 1.6, fire: 0,
      trail: "aegis:wind_gust", burst: "aegis:chakra_burst", hitRadius: 2.2, sound: "random.explode",
      onExplode: (pos, pdim, caster) => {
        // the sphere of micro wind blades lingers and keeps cutting
        for (let k = 0; k < 5; k++) {
          system.runTimeout(() => {
            for (let i = 0; i < 18; i++) {
              const a = Math.random() * Math.PI * 2;
              const r = Math.random() * 5;
              particle(pdim, "aegis:slash", add(pos, { x: Math.cos(a) * r, y: (Math.random() - 0.3) * 4, z: Math.sin(a) * r }), [0.85, 0.95, 1]);
            }
            particle(pdim, "aegis:wind_gust", pos);
            if (!isValid(caster)) return;
            for (const e of pdim.getEntities({ location: pos, maxDistance: 5.5 })) if (canBeHit(e, caster)) hurt(e, 4, caster, "magic");
          }, k * 5);
        }
        sound(pdim, "mob.breeze.wind_burst", pos, 2, 0.6);
      },
    });
    sound(dim, "mob.breeze.shoot", player.location, 1, 0.8);
  }, CHARGE);
}

// --- Medical: Mystical Palm Technique — heal the ally you're looking at (or yourself). ---
function castMysticalPalm(player) {
  let target = player;
  try {
    const hit = player.getEntitiesFromViewDirection({ maxDistance: 6 }).map((h) => h.entity)
      .find((e) => e.typeId === "minecraft:player" || e.typeId === "aegis:genin" || e.getDynamicProperty?.(OWNER_PROP) === player.id);
    if (hit) target = hit;
  } catch {
    /* heal self */
  }
  anim(player, "animation.aegis.heal_palms");
  chargeFx(player, [0.3, 1, 0.4], 9);
  sound(player.dimension, "beacon.ambient", player.location, 1, 1.6);
  sfx(player.dimension, "aegis.seal", player.location, 1, 1.3);
  castFx(player, [0.3, 1, 0.4]);
  for (let t = 0; t <= 20; t += 4) {
    system.runTimeout(() => {
      if (!isValid(target)) return;
      particle(target.dimension, "aegis:heal", target.location);
      try {
        const h = target.getComponent("minecraft:health");
        h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 2));
      } catch {
        /* ignore */
      }
    }, t);
  }
  try {
    target.addEffect("regeneration", 100, { amplifier: 1 });
  } catch {
    /* ignore */
  }
  if (target !== player) player.onScreenDisplay.setActionBar(`§aHealing ${target.nameTag || target.name || "your ally"}…`);
}

// ---------------------------------------------------------------------------
// Chakra pill
// ---------------------------------------------------------------------------
world.afterEvents.itemCompleteUse.subscribe(({ source: player, itemStack }) => {
  if (itemStack?.typeId !== "aegis:chakra_pill") return;
  setChakra(player, getChakra(player) + 50);
  try {
    player.addEffect("speed", 200, { amplifier: 0 });
  } catch {
    /* ignore */
  }
  player.onScreenDisplay.setActionBar("§a+50 Chakra");
  sound(player.dimension, "random.levelup", player.location, 0.5, 1.6);
});

// ---------------------------------------------------------------------------
// Kunai: drop back as an item when it sticks into a block, so you can pick it up.
// ---------------------------------------------------------------------------
world.afterEvents.projectileHitBlock.subscribe((ev) => {
  if (ev.projectile?.typeId !== "aegis:kunai") return;
  try {
    ev.dimension.spawnItem(new ItemStack("aegis:kunai", 1), ev.location);
  } catch {
    /* ignore */
  }
});

// ---------------------------------------------------------------------------
// Tick loops
// ---------------------------------------------------------------------------
system.runInterval(() => {
  updateProjectiles();
  updateFollowers();
}, 1);

const lastPos = new Map();
const running = new Set();

system.runInterval(() => {
  const now = system.currentTick;
  for (const [id, exp] of substitutionArmed) if (now > exp) substitutionArmed.delete(id);

  for (const player of world.getAllPlayers()) {
    const chakra = getChakra(player);
    const max = getMaxChakra(player);

    // Regeneration
    let rate = isTransformed(player) && !isBijuuMastered(player) ? 0 : REGEN_PER_SECOND * clanRegenMultiplier(player) * bijuuRegenMultiplier(player) * levelRegenMultiplier(player) * armorRegenMultiplier(player);
    if (wearingHeadband(player)) rate *= HEADBAND_REGEN_BONUS;

    const prev = lastPos.get(player.id);
    const loc = player.location;
    lastPos.set(player.id, loc);
    const still = prev && Math.abs(prev.x - loc.x) < 0.05 && Math.abs(prev.z - loc.z) < 0.05;
    const focusing = player.isSneaking && still && chakra < max && !isTransformed(player);
    const held = heldTypeId(player);

    // Ninja run: arms swept back while sprinting.
    const sprinting = !!player.isSprinting;
    if (sprinting && !running.has(player.id)) {
      running.add(player.id);
      anim(player, "animation.aegis.ninja_run", "aegis_run", "!q.is_sprinting");
    } else if (!sprinting) running.delete(player.id);
    if (focusing) {
      rate *= FOCUS_REGEN_BONUS;
      particle(player.dimension, "aegis:chakra_aura", loc);
    }

    const next = Math.min(max, chakra + rate * (HUD_INTERVAL / 20));
    if (next !== chakra) setChakra(player, next);

    // Chakra / HP / level are drawn on the custom HUD bars (hud.js); just hint while focusing.
    if (focusing) player.onScreenDisplay.setActionBar("§3Focusing chakra...");
  }
}, HUD_INTERVAL);

// ---------------------------------------------------------------------------
// Welcome message
// ---------------------------------------------------------------------------
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn || player.getDynamicProperty(WELCOME_PROP)) return;
  player.setDynamicProperty(WELCOME_PROP, true);
  player.sendMessage(
    [
      "§6=== Way of The Shinobi ===",
      "§7Craft §fBlank Scrolls§7 (paper + stick) and add a catalyst + lapis to learn jutsu.",
      "§7Right-click a jutsu scroll to cast it. Each jutsu costs §bchakra§7.",
      "§7Sneak and stand still to §3focus§7 and regenerate chakra faster.",
      "§7Wear a §fHidden Leaf Headband§7 for faster regen. Eat §aSoldier Pills§7 for a boost.",
      "§eYour clan is about to be decided... good luck!",
    ].join("\n")
  );
});

// ---------------------------------------------------------------------------
// Clans (see clans.js)
// ---------------------------------------------------------------------------
initClans({
  add, sub, scale, norm, dot, particle, sound, knockback, hurt, isValid, canBeHit, isSafeSpot,
  getChakra, setChakra, getMaxChakra, cooldownLeft, startCooldown, castFireball, gainJutsuXp,
  anim, handPos, spawnFx, removeFx, follow, lungeStrike,
});

initBijuu({
  add, sub, scale, norm, dot, particle, sound, knockback, hurt, isValid, canBeHit, isSafeSpot,
  getChakra, setChakra, getMaxChakra, cooldownLeft, startCooldown, anim, handPos, spawnFx, removeFx,
  follow, launchProjectile,
});

initSwords({
  add, sub, scale, norm, dot, particle, sound, knockback, hurt, isValid, canBeHit,
  getChakra, setChakra, cooldownLeft, startCooldown, anim, handPos, launchProjectile, gainJutsuXp,
});

initLevels({ add, particle, sound, getChakra, setChakra });

initHud({ getChakra, getMaxChakra, getLevel, xpInfo });

const npcApi = {
  add, sub, scale, norm, dot, particle, sound, knockback, hurt, isValid, canBeHit,
  getChakra, setChakra, cooldownLeft, startCooldown, anim, handPos, launchProjectile, gainJutsuXp, spawnFx, removeFx,
};
Object.assign(JUTSU, makeJutsu2(npcApi));
{
  const rel = makeReleases(npcApi);
  Object.assign(JUTSU, rel.jutsu);
  registerClanAbilities(rel.abilities);
}
initNatures(npcApi);
initCurrency(npcApi);
initQuests(npcApi);
initNpcs({ ...npcApi, spawnAkatsukiNear: (p, msg) => spawnAkatsukiNear(p, msg) });
initEnemies(npcApi);
initCompanions(npcApi);
initSage({ ...npcApi, getMaxChakra });
initArmor({ ...npcApi, refreshName: applyNameTag });
