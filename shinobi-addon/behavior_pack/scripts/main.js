// Shinobi Way — ninja add-on for Minecraft Bedrock.
// Chakra system, jutsu scrolls and ninja tools, driven by @minecraft/server.

import { world, system, ItemStack, MolangVariableMap } from "@minecraft/server";
import { initClans, clanMaxChakra, clanRegenMultiplier, handleClanItemUse, clanJutsuCostMultiplier } from "./clans.js";
import { initBijuu, bijuuChakraBonus, bijuuRegenMultiplier, handleBijuuItemUse, isTransformed } from "./bijuu.js";
import { initSwords, handleSwordUse } from "./swords.js";
import { initHud } from "./hud.js";
import { initNpcs } from "./npcs.js";
import { initEnemies, spawnAkatsukiNear } from "./enemies.js";
import { initCompanions, handleSummonUse } from "./companions.js";
import { initVillages } from "./villages.js";
import { initLevels, handleRecordUse, levelChakraBonus, levelRegenMultiplier, ninjutsuMultiplier, cooldownMultiplier, gainJutsuXp, getLevel } from "./levels.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CHAKRA_PROP = "aegis:chakra";
const WELCOME_PROP = "aegis:welcomed";
const OWNER_PROP = "aegis:owner";

const BASE_MAX_CHAKRA = 100;
const getMaxChakra = (player) => clanMaxChakra(player, BASE_MAX_CHAKRA) + bijuuChakraBonus(player) + levelChakraBonus(player);
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
  if (attacker?.typeId === "minecraft:player") amount *= ninjutsuMultiplier(attacker);
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

  const left = cooldownLeft(player, itemStack.typeId);
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7${jutsu.name} ready in §f${(left / 20).toFixed(1)}s`);
    return;
  }
  const cost = Math.round(jutsu.cost * clanJutsuCostMultiplier(player, itemStack.typeId));
  const chakra = getChakra(player);
  if (chakra < cost) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(chakra)}/${cost})`);
    sound(player.dimension, "note.bass", player.location, 0.6, 0.6);
    return;
  }

  // cast() returns false if the jutsu fizzled (e.g. no target) — no cost then.
  const ok = jutsu.cast(player);
  if (ok === false) return;

  setChakra(player, chakra - cost);
  gainJutsuXp(player, cost);
  startCooldown(player, itemStack.typeId, jutsu.cooldown);
  player.onScreenDisplay.setActionBar(`§6${jutsu.name}!`);
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
  const orb = o.noOrb ? undefined : spawnFx(caster.dimension, "aegis:jutsu_orb", o.orbEvent, sub(start, { x: 0, y: o.orbOffset ?? 0.25, z: 0 }));
  projectiles.push({ caster, dim: caster.dimension, pos: start, dir: norm(dir), age: 0, orb, o });
}

function castFireball(player, dir = player.getViewDirection()) {
  anim(player, "animation.aegis.hand_signs");
  launchProjectile(player, add(player.getHeadLocation(), scale(dir, 1.5)), dir);
  sound(player.dimension, "mob.ghast.fireball", player.location, 1, 0.8);
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
  }
}

// --- Rasengan: form the spinning orb in your palm, then drive it into the first thing you reach. ---
function castSphere(player) {
  const dim = player.dimension;
  const CHARGE = 14;
  anim(player, "animation.aegis.rasengan_hold");
  const orb = spawnFx(dim, "aegis:jutsu_orb", "aegis:as_rasengan", handPos(player));
  follow(orb, () => (isValid(player) ? sub(handPos(player), { x: 0, y: 0.25, z: 0 }) : undefined), CHARGE + 14);
  sound(dim, "item.trident.riptide_1", player.location, 0.7, 1.6);
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
    anim(player, "animation.aegis.palm_thrust");
    sound(dim, "mob.breeze.wind_burst", player.location, 0.6, 1.4);
    lungeStrike(player, {
      power: 2.6, range: 2.6, ticks: 14,
      onHit: (target) => {
        const center = add(target.location, { x: 0, y: 1, z: 0 });
        particle(dim, "aegis:chakra_burst", center);
        particle(dim, "minecraft:huge_explosion_emitter", center);
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
  anim(player, "animation.aegis.hand_signs");
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
  anim(player, "animation.aegis.hand_signs");
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
}

// --- Wind Style: Great Breakthrough: blast everything in front of you away. ---
function castGalePalm(player) {
  const dim = player.dimension;
  const dir = player.getViewDirection();
  const head = player.getHeadLocation();
  anim(player, "animation.aegis.palm_thrust");
  for (let d = 1; d <= 8; d++) {
    particle(dim, "aegis:wind_gust", add(head, scale(dir, d)));
  }
  sound(dim, "mob.breeze.wind_burst", head, 1, 1);
  sound(dim, "mob.enderdragon.flap", head, 1, 0.6);

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
  sound(dim, "ambient.weather.thunder", player.location, 0.5, 1.8);
  sound(dim, "mob.bee.loop", player.location, 1, 2); // the "thousand birds" chirp
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
    anim(player, "animation.aegis.palm_thrust");
    lungeStrike(player, {
      power: 3.6, range: 2.6, ticks: 14,
      onHit: (target) => {
        hurt(target, 13, player);
        const kb = norm({ x: target.location.x - player.location.x, y: 0, z: target.location.z - player.location.z });
        knockback(target, kb.x, kb.z, 1.5, 0.4);
        particle(dim, "aegis:lightning_burst", add(target.location, { x: 0, y: 1, z: 0 }));
        sound(dim, "ambient.weather.lightning.impact", target.location, 0.8, 1.4);
      },
    });
  }, CHARGE);
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
    let rate = isTransformed(player) ? 0 : REGEN_PER_SECOND * clanRegenMultiplier(player) * bijuuRegenMultiplier(player) * levelRegenMultiplier(player);
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
      "§6=== Naruto: Shinobi Way ===",
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

initHud({ getChakra, getMaxChakra, getLevel });

const npcApi = {
  add, sub, scale, norm, dot, particle, sound, knockback, hurt, isValid, canBeHit,
  getChakra, setChakra, cooldownLeft, startCooldown, anim, handPos, launchProjectile, gainJutsuXp,
};
initNpcs({ ...npcApi, spawnAkatsukiNear: (p, msg) => spawnAkatsukiNear(p, msg) });
initEnemies(npcApi);
initCompanions(npcApi);
initVillages(npcApi);
