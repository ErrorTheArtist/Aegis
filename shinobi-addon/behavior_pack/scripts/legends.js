// Legendary bosses: Naruto, Sasuke, Tsunade, Sarutobi (Third Hokage) and Minato.
// They never spawn naturally — place an NPC Spawner and choose them. Each has a signature moveset and a
// second phase at half health. Called from enemies.js for entities of type aegis:legend.

import { world, system, ItemStack } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { impactFx, sfx, shake, aura, chargeFx } from "./cinematic.js";

export const LEGENDS = {
  naruto: { name: "§6Naruto Uzumaki", skin: 16, color: [1, 0.55, 0.1], phase: "Nine-Tails Chakra Mode",
    drops: [["aegis:sphere_scroll", 1, 1], ["aegis:rasenshuriken_scroll", 1, 0.3], ["aegis:clone_scroll", 1, 0.5]] },
  sasuke: { name: "§5Sasuke Uchiha", skin: 17, color: [0.55, 0.2, 0.9], phase: "Susanoo",
    drops: [["aegis:chidori_scroll", 1, 1], ["aegis:kusanagi", 1, 0.3], ["aegis:chidori_current_scroll", 1, 0.4]] },
  tsunade: { name: "§aTsunade", skin: 18, color: [0.4, 1, 0.5], phase: "Creation Rebirth",
    drops: [["aegis:mystical_palm_scroll", 1, 1], ["aegis:summon_slug_scroll", 1, 0.5], ["aegis:earth_wall_scroll", 1, 0.4]] },
  sarutobi: { name: "§cHiruzen Sarutobi", skin: 19, color: [1, 0.35, 0.15], phase: "Reaper Death Seal",
    drops: [["aegis:phoenix_scroll", 1, 1], ["aegis:great_fire_scroll", 1, 0.3], ["aegis:shuriken", 32, 1]] },
  minato: { name: "§eMinato Namikaze", skin: 20, color: [1, 0.9, 0.4], phase: "Flying Raijin Barrage",
    drops: [["aegis:flash_scroll", 1, 1], ["aegis:kunai", 16, 1], ["aegis:sphere_scroll", 1, 0.3]] },
};

let api;
const phase2 = new Set(); // entity ids that entered their second phase
const susanoo = new Map(); // sasuke entity id -> susanoo model

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const chest = (e) => add(e.location, { x: 0, y: 1.2, z: 0 });

function eff(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}

function dirTo(from, to) {
  return api.norm({ x: to.location.x - from.location.x, y: 0, z: to.location.z - from.location.z });
}

function behind(t, dist = 2) {
  const d = t.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  return { x: t.location.x - h.x * dist, y: t.location.y, z: t.location.z - h.z * dist };
}

function playersAround(dim, pos, r) {
  try {
    return dim.getPlayers({ location: pos, maxDistance: r }).filter((p) => {
      const gm = String(p.getGameMode()).toLowerCase();
      return gm !== "creative" && gm !== "spectator";
    });
  } catch {
    return [];
  }
}

function blast(boss, pos, r, dmg, knock = 1.5, extra) {
  for (const e of boss.dimension.getEntities({ location: pos, maxDistance: r })) {
    if (!api.canBeHit(e, boss) || e.typeId === "aegis:legend" || e.typeId === "aegis:hostile_ninja") continue;
    api.hurt(e, dmg, boss);
    const d = api.norm({ x: e.location.x - pos.x, y: 0, z: e.location.z - pos.z });
    api.knockback(e, d.x, d.z, knock, 0.5);
    extra?.(e);
  }
}

function shoot(boss, t, opts) {
  const start = add(boss.getHeadLocation(), api.scale(dirTo(boss, t), 1.2));
  const aim = api.norm(api.sub(add(t.location, { x: 0, y: 1, z: 0 }), start));
  api.launchProjectile(boss, start, aim, { ignoreFamily: "ninja", ...opts });
}

// Charge a dash at the target; the first enemy touched takes the hit.
function dashStrike(boss, t, color, dmg, windup, animName, power = 3.2) {
  api.anim(boss, animName ?? "animation.aegis.rasengan_form");
  chargeFx(boss, color, windup);
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    api.anim(boss, "animation.aegis.ram_strike");
    const d = dirTo(boss, t);
    api.knockback(boss, d.x, d.z, power, 0.2);
    let done = false;
    for (let i = 1; i <= 12; i++) {
      system.runTimeout(() => {
        if (done || !api.isValid(boss)) return;
        for (const e of boss.dimension.getEntities({ location: boss.location, maxDistance: 2.6 })) {
          if (!api.canBeHit(e, boss) || e.typeId === "aegis:legend" || e.typeId === "aegis:hostile_ninja") continue;
          done = true;
          api.hurt(e, dmg, boss);
          api.knockback(e, d.x, d.z, 2.8, 0.6);
          impactFx(boss.dimension, e.location, color, 2);
          return;
        }
      }, i);
    }
  }, windup);
}

function teleportStrike(boss, t, dmg, color) {
  api.particle(boss.dimension, "aegis:smoke_puff", boss.location);
  try {
    boss.teleport(behind(t), { facingLocation: t.location });
  } catch {
    return;
  }
  sfx(boss.dimension, "aegis.whoosh", boss.location, 1.2, 1.5);
  api.particle(boss.dimension, "aegis:cine_ring", boss.location, color);
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    api.anim(boss, "animation.aegis.sword_slash");
    api.hurt(t, dmg, boss);
    api.particle(boss.dimension, "aegis:slash", chest(t), color);
    sfx(boss.dimension, "aegis.slash", t.location, 1, 1.3);
  }, 4);
}

// ---------------------------------------------------------------------------
// Movesets — each returns the cooldown (ticks) until the next move.
// ---------------------------------------------------------------------------
const AI = {
  naruto(boss, t, dist, p2) {
    const r = Math.random();
    const clones = boss.dimension.getEntities({ tags: [`aegis_lclone_${boss.id}`] }).length;
    if (clones < 3 && r < 0.25) {
      api.anim(boss, "animation.aegis.clone_seal");
      sfx(boss.dimension, "aegis.whoosh", boss.location, 1.5, 1);
      for (let i = 0; i < 3 - clones; i++) {
        const a = Math.random() * Math.PI * 2;
        const at = add(boss.location, { x: Math.cos(a) * 2, y: 0, z: Math.sin(a) * 2 });
        try {
          const c = boss.dimension.spawnEntity("aegis:hostile_ninja", at);
          c.addTag(`aegis_lclone_${boss.id}`);
          c.setDynamicProperty("aegis:role", "rogue");
          c.setDynamicProperty("aegis:no_xp", true);
          c.setProperty("aegis:skin", 16);
          c.nameTag = "§6Naruto §7(Shadow Clone)";
          c.triggerEvent("aegis:persist");
          api.particle(boss.dimension, "aegis:smoke_puff", at);
          system.runTimeout(() => {
            if (api.isValid(c)) {
              api.particle(c.dimension, "aegis:smoke_puff", c.location);
              c.remove();
            }
          }, 400);
        } catch {
          /* ignore */
        }
      }
      return 70;
    }
    if (p2 && r < 0.5) {
      // Tailed Beast Bomb (Kurama mode)
      api.anim(boss, "animation.aegis.both_palms");
      chargeFx(boss, [1, 0.5, 0.1], 20, "aegis.charge");
      system.runTimeout(() => api.isValid(boss) && api.isValid(t) && shoot(boss, t, {
        speed: 1.2, maxAge: 50, damage: 24, radius: 5.5, knock: 2.5, fire: 0, orbEvent: "aegis:as_bijuudama",
        trail: "aegis:beast_aura", burst: "aegis:beast_burst", color: [1, 0.5, 0.1], hitRadius: 2, power: 2.5 }), 20);
      return 110;
    }
    if (r < 0.7 && dist > 6) {
      api.anim(boss, "animation.aegis.throw_overhead");
      chargeFx(boss, [0.8, 0.95, 1], 18, "aegis.rasengan");
      system.runTimeout(() => api.isValid(boss) && api.isValid(t) && shoot(boss, t, {
        orbEntity: "aegis:rasenshuriken", orbOffset: 0.4, speed: 1.1, maxAge: 40, damage: 18, radius: 5, knock: 1.6, fire: 0,
        trail: "aegis:wind_gust", burst: "aegis:chakra_burst", hitRadius: 2, color: [0.8, 0.95, 1] }), 18);
      return 100;
    }
    sfx(boss.dimension, "aegis.rasengan", boss.location, 1.3, 1);
    dashStrike(boss, t, [0.4, 0.75, 1], p2 ? 22 : 16, 12);
    return 70;
  },

  sasuke(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.3) {
      // Kirin: telegraphed lightning strike from the sky
      const spot = { ...t.location };
      api.anim(boss, "animation.aegis.sword_raise");
      sfx(boss.dimension, "aegis.charge", boss.location, 2, 1.2);
      for (let i = 0; i < 30; i += 5) system.runTimeout(() => api.particle(boss.dimension, "aegis:cine_ring", spot, [0.6, 0.85, 1]), i);
      showTitle(t, "§bKirin", { subtitle: "§7Get out from under it!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
      system.runTimeout(() => {
        if (!api.isValid(boss)) return;
        for (let y = 0; y < 12; y += 2) api.particle(boss.dimension, "aegis:cine_pillar", add(spot, { x: 0, y, z: 0 }), [0.6, 0.85, 1]);
        sfx(boss.dimension, "aegis.lightning", spot, 2.5, 0.8);
        impactFx(boss.dimension, spot, [0.6, 0.85, 1], 3);
        blast(boss, spot, 4.5, 24, 2);
      }, 32);
      return 140;
    }
    if (r < 0.4) {
      sfx(boss.dimension, "aegis.chidori", boss.location, 1.4, 1);
      dashStrike(boss, t, [0.6, 0.85, 1], p2 ? 22 : 16, 12, "animation.aegis.chidori_charge", 3.6);
      return 70;
    }
    if (r < 0.65) {
      api.anim(boss, "animation.aegis.eye_activate");
      sfx(boss.dimension, "aegis.fire", t.location, 1.5, 0.6);
      for (let i = 0; i < 5; i++) {
        system.runTimeout(() => {
          if (!api.isValid(t)) return;
          api.particle(t.dimension, "aegis:amaterasu", t.location);
          api.hurt(t, 3, boss, "fire");
          try {
            t.setOnFire(4, true);
          } catch {
            /* ignore */
          }
        }, i * 20);
      }
      return 120;
    }
    api.anim(boss, "animation.aegis.fireball_jutsu");
    chargeFx(boss, [1, 0.45, 0.1], 11);
    system.runTimeout(() => api.isValid(boss) && api.isValid(t) && shoot(boss, t, { damage: 12, radius: 4, knock: 1, fire: 5 }), 11);
    return 80;
  },

  tsunade(boss, t, dist, p2) {
    const r = Math.random();
    let hp = 1;
    try {
      const h = boss.getComponent("minecraft:health");
      hp = h.currentValue / h.effectiveMax;
    } catch {
      /* ignore */
    }
    if (hp < 0.7 && r < 0.2) {
      api.anim(boss, "animation.aegis.heal_palms");
      chargeFx(boss, [0.4, 1, 0.5], 10, "aegis.seal");
      eff(boss, "regeneration", 100, 2);
      return 120;
    }
    if (dist < 4.5) {
      // chakra-enhanced punch
      api.anim(boss, "animation.aegis.palm_thrust");
      system.runTimeout(() => {
        if (!api.isValid(boss) || !api.isValid(t)) return;
        const d = dirTo(boss, t);
        api.hurt(t, p2 ? 20 : 14, boss);
        api.knockback(t, d.x, d.z, 4.5, 0.8);
        impactFx(boss.dimension, t.location, [0.4, 1, 0.5], 2);
      }, 6);
      return 60;
    }
    // Heavenly heel drop: leap at the target and crack the ground
    api.anim(boss, "animation.aegis.earth_slam");
    const d = dirTo(boss, t);
    const flat = Math.hypot(t.location.x - boss.location.x, t.location.z - boss.location.z);
    api.knockback(boss, d.x, d.z, Math.min(4, 1 + flat * 0.2), 1.1);
    sfx(boss.dimension, "aegis.whoosh", boss.location, 1.5, 0.7);
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      impactFx(boss.dimension, boss.location, [0.6, 0.45, 0.3], 3);
      blast(boss, boss.location, 5.5, p2 ? 22 : 16, 2.2);
    }, 24);
    return 100;
  },

  sarutobi(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.25) {
      // Reaper Death Seal: a ghostly grip on the target's soul
      api.anim(boss, "animation.aegis.mind_seal");
      chargeFx(boss, [0.3, 0.2, 0.4], 14, "aegis.seal");
      system.runTimeout(() => {
        if (!api.isValid(t)) return;
        showTitle(t, "§5Reaper Death Seal", { subtitle: "§7Your strength is being torn away…", fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
        impactFx(t.dimension, t.location, [0.3, 0.2, 0.4], 2);
        api.hurt(t, 12, boss, "magic");
        for (const [id, amp] of [["weakness", 2], ["slowness", 2], ["mining_fatigue", 2], ["nausea", 0]]) {
          try {
            t.addEffect(id, 200, { amplifier: amp });
          } catch {
            /* ignore */
          }
        }
      }, 14);
      return 160;
    }
    if (r < 0.45) {
      // Shuriken Shadow Clone: a storm of shuriken
      api.anim(boss, "animation.aegis.hand_signs");
      sfx(boss.dimension, "aegis.whoosh", boss.location, 1.2, 1.4);
      for (let i = 0; i < 12; i++) {
        system.runTimeout(() => {
          if (!api.isValid(boss) || !api.isValid(t)) return;
          const spread = (Math.random() - 0.5) * 0.5;
          const d = dirTo(boss, t);
          const dir = { x: d.x * Math.cos(spread) - d.z * Math.sin(spread), y: (Math.random() - 0.4) * 0.2, z: d.x * Math.sin(spread) + d.z * Math.cos(spread) };
          api.launchProjectile(boss, add(boss.getHeadLocation(), dir), dir, { noOrb: true, speed: 1.8, maxAge: 16, damage: 4, radius: 1.2, knock: 0.2, fire: 0,
            trail: "aegis:slash", burst: "aegis:slash", color: [0.85, 0.85, 0.9], hitRadius: 1.1, ignoreFamily: "ninja", power: 0.3 });
        }, 8 + i);
      }
      return 80;
    }
    if (dist < 4.5) {
      // Enma's adamantine staff sweep
      api.anim(boss, "animation.aegis.sword_spin");
      system.runTimeout(() => api.isValid(boss) && (impactFx(boss.dimension, boss.location, [0.85, 0.75, 0.6], 1.5), blast(boss, boss.location, 4.5, 13, 2.2)), 6);
      return 60;
    }
    // Fire Style: Fire Dragon Flame Bullet
    api.anim(boss, "animation.aegis.phoenix_breath");
    chargeFx(boss, [1, 0.45, 0.1], 10);
    system.runTimeout(() => {
      if (!api.isValid(boss) || !api.isValid(t)) return;
      for (const ang of [-0.22, 0, 0.22]) {
        const d = dirTo(boss, t);
        const dir = { x: d.x * Math.cos(ang) - d.z * Math.sin(ang), y: 0, z: d.x * Math.sin(ang) + d.z * Math.cos(ang) };
        api.launchProjectile(boss, add(boss.getHeadLocation(), dir), dir, { damage: 9, radius: 3, knock: 0.8, fire: 4, ignoreFamily: "ninja" });
      }
    }, 10);
    return 90;
  },

  minato(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.35) {
      // Flying Raijin barrage: blink around the target, cut, finish with a Rasengan
      showTitle(t, "§eFlying Raijin", { subtitle: "§7He's everywhere at once!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
      for (let k = 0; k < 5; k++) system.runTimeout(() => api.isValid(boss) && api.isValid(t) && teleportStrike(boss, t, 6, [1, 0.9, 0.4]), k * 5);
      system.runTimeout(() => api.isValid(boss) && api.isValid(t) && dashStrike(boss, t, [0.4, 0.75, 1], 18, 4), 28);
      return 120;
    }
    if (r < 0.45) {
      teleportStrike(boss, t, p2 ? 12 : 9, [1, 0.9, 0.4]);
      return 45;
    }
    if (r < 0.7) {
      api.anim(boss, "animation.aegis.palm_thrust");
      for (let k = 0; k < 3; k++) {
        system.runTimeout(() => api.isValid(boss) && api.isValid(t) && shoot(boss, t, {
          noOrb: true, speed: 1.8, maxAge: 18, damage: 6, radius: 1.3, knock: 0.3, fire: 0, trail: "aegis:slash", burst: "aegis:slash",
          color: [1, 0.9, 0.4], hitRadius: 1.1, power: 0.4 }), k * 3);
      }
      return 50;
    }
    sfx(boss.dimension, "aegis.rasengan", boss.location, 1.3, 1);
    api.particle(boss.dimension, "aegis:smoke_puff", boss.location);
    try {
      boss.teleport(behind(t, 3), { facingLocation: t.location });
    } catch {
      /* ignore */
    }
    dashStrike(boss, t, [0.4, 0.75, 1], p2 ? 20 : 15, 8);
    return 80;
  },
};

// Second phase at half health.
function enterPhase2(boss, id) {
  const L = LEGENDS[id];
  phase2.add(boss.id);
  eff(boss, "strength", 999999, 1);
  eff(boss, "speed", 999999, 1);
  eff(boss, "resistance", 999999, 1);
  impactFx(boss.dimension, boss.location, L.color, 3);
  sfx(boss.dimension, "aegis.transform", boss.location, 2.5, 1);
  shake(boss.dimension, boss.location, 0.7, 1.2, 40);
  for (const p of playersAround(boss.dimension, boss.location, 48)) {
    showTitle(p, `${L.name}`, { subtitle: `§7${L.phase}!`, fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
  }
  if (id === "tsunade") {
    // Creation Rebirth: heals half her health once
    try {
      const h = boss.getComponent("minecraft:health");
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + h.effectiveMax * 0.5));
    } catch {
      /* ignore */
    }
  }
  if (id === "sasuke") {
    const model = api.spawnFx(boss.dimension, "aegis:susanoo", undefined, boss.location);
    if (model) susanoo.set(boss.id, model);
  }
}

// Runs every AI tick (twice a second): phase change + phase-2 aura.
export function legendTick(boss) {
  const id = boss.getDynamicProperty("aegis:member");
  const L = LEGENDS[id];
  if (!L) return;
  let hp = 1;
  try {
    const h = boss.getComponent("minecraft:health");
    hp = h.currentValue / h.effectiveMax;
  } catch {
    /* ignore */
  }
  if (!phase2.has(boss.id) && hp <= 0.5) enterPhase2(boss, id);
  if (phase2.has(boss.id)) aura(boss, L.color, id === "naruto");
}

// Picks and runs a move; returns the cooldown in ticks.
export function updateLegend(boss, target, dist) {
  const id = boss.getDynamicProperty("aegis:member");
  if (!LEGENDS[id] || !target) return 40;
  return AI[id](boss, target, dist, phase2.has(boss.id));
}

// Keeps Sasuke's Susanoo wrapped around him.
function tickSusanoo() {
  for (const [bid, model] of [...susanoo]) {
    const boss = world.getEntity(bid);
    if (!boss || !api.isValid(boss)) {
      api.removeFx(model);
      susanoo.delete(bid);
      continue;
    }
    if (!api.isValid(model)) {
      const m = api.spawnFx(boss.dimension, "aegis:susanoo", undefined, boss.location);
      if (m) susanoo.set(bid, m);
      continue;
    }
    try {
      model.teleport(boss.location, { rotation: { x: 0, y: boss.getRotation().y } });
    } catch {
      /* ignore */
    }
  }
}

export function initLegends(helpers) {
  api = helpers;
  system.runInterval(tickSusanoo, 1);

  // Entrance
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (entity.typeId !== "aegis:legend") return;
    system.runTimeout(() => {
      if (!api.isValid(entity)) return;
      const L = LEGENDS[entity.getDynamicProperty("aegis:member")];
      if (!L) return;
      impactFx(entity.dimension, entity.location, L.color, 2.5);
      sfx(entity.dimension, "aegis.transform", entity.location, 2, 1.1);
      for (const p of playersAround(entity.dimension, entity.location, 48)) {
        showTitle(p, L.name, { subtitle: "§7has appeared!", fadeInDuration: 3, stayDuration: 40, fadeOutDuration: 10 });
      }
    }, 3);
  });

  // Shadow clones vanish in a puff of smoke when hit (no loot, no XP).
  world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
    if (hurtEntity.typeId !== "aegis:hostile_ninja") return;
    let clone = false;
    try {
      clone = hurtEntity.getTags().some((t) => t.startsWith("aegis_lclone_"));
    } catch {
      return;
    }
    if (!clone) return;
    api.particle(hurtEntity.dimension, "aegis:smoke_puff", hurtEntity.location);
    sfx(hurtEntity.dimension, "aegis.whoosh", hurtEntity.location, 0.8, 1.6);
    system.run(() => api.isValid(hurtEntity) && hurtEntity.remove());
  });

  // Defeat: signature drops + announcement
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (deadEntity.typeId !== "aegis:legend") return;
    let id;
    try {
      id = deadEntity.getDynamicProperty("aegis:member");
    } catch {
      return;
    }
    const L = LEGENDS[id];
    phase2.delete(deadEntity.id);
    const model = susanoo.get(deadEntity.id);
    if (model) api.removeFx(model);
    susanoo.delete(deadEntity.id);
    if (!L) return;
    for (const [item, n, chance] of L.drops) {
      if (Math.random() > chance) continue;
      try {
        deadEntity.dimension.spawnItem(new ItemStack(item, n), deadEntity.location);
      } catch {
        /* ignore */
      }
    }
    for (const c of deadEntity.dimension.getEntities({ tags: [`aegis_lclone_${deadEntity.id}`] })) c.remove();
    const killer = damageSource?.damagingEntity;
    world.sendMessage(`§e${L.name}§e was defeated${killer?.typeId === "minecraft:player" ? ` by §f${killer.name}` : ""}§e!`);
  });
}
