// Kekkei genkai releases — clan-bound jutsu only that clan can use:
//   Senju: Wood Release · Uchiha: Blaze Release · Yuki: Ice Release · Terumi: Lava & Boil Release
// plus the clan items of the newer clans (Yuki, Terumi, Hōzuki). main.js merges the scrolls into its JUTSU table
// (each has `clan`, which main.js checks) and clans.js registers the clan-item abilities.

import { world, system } from "@minecraft/server";
import { impactFx, sfx, shake, chargeFx, castFx, aura } from "./cinematic.js";

let api;
const WOOD = [0.55, 0.38, 0.2];
const BLACK = [0.12, 0.05, 0.18];
const ICE = [0.75, 0.92, 1];
const LAVA = [1, 0.32, 0.05];
const STEAM = [0.85, 0.9, 0.85];
const WATER = [0.3, 0.6, 1];

const boilStrength = new Map(); // player id -> end tick
const hydrified = new Map(); // player id -> end tick

function eff(e, id, ticks, amp = 0, show = true) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: show });
  } catch {
    /* ignore */
  }
}

const flat = (d) => api.norm({ x: d.x, y: 0, z: d.z });

function lookTarget(player, range) {
  try {
    return player.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
  } catch {
    return undefined;
  }
}

function enemiesNear(player, pos, r) {
  return player.dimension.getEntities({ location: pos, maxDistance: r }).filter((e) => api.canBeHit(e, player));
}

function groundAt(dim, x, y, z) {
  for (let dy = 3; dy >= -5; dy--) {
    try {
      const b = dim.getBlock({ x, y: y + dy, z });
      const below = dim.getBlock({ x, y: y + dy - 1, z });
      if (b?.isAir && below && !below.isAir && !below.isLiquid) return { x, y: y + dy, z };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Wood Release for anyone (Hashirama's reanimated body uses it): roots and trunks burst out of the ground around a
// spot and wither away again after `ticks`.
export function growWood(dim, center, radius = 3, count = 7, ticks = 100) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.8 + Math.random() * radius;
    const g = groundAt(dim, Math.floor(center.x + Math.cos(a) * r), Math.floor(center.y), Math.floor(center.z + Math.sin(a) * r));
    if (!g) continue;
    const h = 1 + Math.floor(Math.random() * 3);
    spots.push([g, "minecraft:mangrove_roots"]);
    for (let y = 1; y <= h; y++) spots.push([{ x: g.x, y: g.y + y, z: g.z }, "minecraft:oak_log"]);
    api.particle(dim, "aegis:cine_debris", g, WOOD);
  }
  const byHeight = new Map();
  for (const s of spots) byHeight.set(s[0].y, [...(byHeight.get(s[0].y) ?? []), s]);
  [...byHeight.keys()].sort((a, b) => a - b).forEach((y, i) => system.runTimeout(() => tempBlocks(dim, byHeight.get(y), ticks - i * 3), i * 3));
}

// Temporarily places blocks (only into air) and removes them later.
function tempBlocks(dim, spots, ticks) {
  const placed = [];
  for (const [l, type] of spots) {
    try {
      const b = dim.getBlock(l);
      if (b?.isAir) {
        b.setType(type);
        placed.push([l, type]);
      }
    } catch {
      /* ignore */
    }
  }
  system.runTimeout(() => {
    for (const [l, type] of placed) {
      try {
        const b = dim.getBlock(l);
        if (b?.typeId === type) b.setType("minecraft:air");
      } catch {
        /* ignore */
      }
      api.particle(dim, "aegis:dust", l);
    }
  }, ticks);
}

// ===========================================================================
// Wood Release (Senju)
// ===========================================================================
function castDeepForest(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.earth_slam");
  chargeFx(player, [0.4, 0.8, 0.3], 10, "aegis.seal");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const o = player.location;
    shake(dim, o, 0.45, 1.2, 24);
    api.sound(dim, "aegis.wood", o, 1.5, 0.85);
    const spots = [];
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 6;
      const g = groundAt(dim, Math.floor(o.x + Math.cos(a) * r), Math.floor(o.y), Math.floor(o.z + Math.sin(a) * r));
      if (!g) continue;
      const h = 2 + Math.floor(Math.random() * 3);
      spots.push([g, "minecraft:mangrove_roots"]);
      for (let y = 1; y <= h; y++) spots.push([{ x: g.x, y: g.y + y, z: g.z }, "minecraft:oak_log"]);
      api.particle(dim, "aegis:cine_debris", g, WOOD);
    }
    // trees grow upward over a second
    const byHeight = new Map();
    for (const s of spots) {
      const k = s[0].y;
      byHeight.set(k, [...(byHeight.get(k) ?? []), s]);
    }
    [...byHeight.keys()].sort((a, b) => a - b).forEach((y, i) => system.runTimeout(() => tempBlocks(dim, byHeight.get(y), 240 - i * 3), i * 3));
    for (const e of enemiesNear(player, o, 9)) {
      api.hurt(e, 8, player);
      eff(e, "slowness", 70, 255);
      eff(e, "weakness", 70, 2);
      api.particle(dim, "aegis:cine_debris", e.location, WOOD);
      if (e.typeId === "minecraft:player") e.onScreenDisplay?.setActionBar("§2Roots bind you!");
    }
    impactFx(dim, o, [0.4, 0.8, 0.3], 2);
  }, 10);
}

function castWoodDragon(player) {
  const dim = player.dimension;
  const t = lookTarget(player, 24);
  const dest = t ? { ...t.location } : api.add(player.location, api.scale(flat(player.getViewDirection()), 14));
  api.anim(player, "animation.aegis.hand_signs");
  chargeFx(player, [0.4, 0.8, 0.3], 12, "aegis.seal");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const start = api.add(player.location, { x: 0, y: 0.5, z: 0 });
    const d = api.sub(dest, start);
    const side = flat({ x: -d.z, y: 0, z: d.x });
    api.sound(dim, "mob.ravager.roar", start, 1, 0.6);
    for (let k = 0; k <= 16; k++) {
      system.runTimeout(() => {
        const f = k / 16;
        const wave = Math.sin(f * Math.PI * 3) * 1.6;
        const p = api.add(api.add(start, api.scale(d, f)), api.add(api.scale(side, wave), { x: 0, y: Math.sin(f * Math.PI) * 2.5, z: 0 }));
        api.particle(dim, "aegis:cine_debris", p, WOOD);
        api.particle(dim, "aegis:dust", p);
        if (k % 4 === 0) api.sound(dim, "aegis.wood", p, 1, 0.85);
      }, k);
    }
    system.runTimeout(() => {
      api.particle(dim, "aegis:cine_ring", dest, [0.4, 0.8, 0.3]);
      impactFx(dim, dest, WOOD, 2);
      if (!api.isValid(player)) return;
      for (const e of enemiesNear(player, dest, 3)) {
        api.hurt(e, 14, player);
        eff(e, "slowness", 60, 255);
        // the dragon drinks their chakra
        if (e.typeId === "minecraft:player") {
          const stolen = Math.min(40, api.getChakra(e));
          api.setChakra(e, api.getChakra(e) - stolen);
          api.setChakra(player, api.getChakra(player) + stolen);
          e.onScreenDisplay?.setActionBar("§2The Wood Dragon drains your chakra!");
        } else {
          try {
            const h = player.getComponent("minecraft:health");
            h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 4));
          } catch {
            /* ignore */
          }
        }
      }
    }, 17);
  }, 12);
}

// ===========================================================================
// Blaze Release (Uchiha)
// ===========================================================================
function castKagutsuchi(player) {
  api.anim(player, "animation.aegis.eye_activate");
  castFx(player, [0.6, 0.1, 0.15], "aegis.fire");
  for (let i = 0; i < 3; i++) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      api.anim(player, "animation.aegis.palm_thrust");
      const d = player.getViewDirection();
      const ang = (i - 1) * 0.12;
      const dir = { x: d.x * Math.cos(ang) - d.z * Math.sin(ang), y: d.y, z: d.x * Math.sin(ang) + d.z * Math.cos(ang) };
      api.launchProjectile(player, api.add(player.getHeadLocation(), api.scale(dir, 1.2)), dir, {
        noOrb: true, speed: 1.7, maxAge: 26, damage: 9, radius: 2.2, knock: 0.5, fire: 8, hitRadius: 1.3,
        trail: "aegis:amaterasu", burst: "aegis:amaterasu", color: BLACK, sound: "mob.blaze.shoot", power: 0.8,
      });
    }, 10 + i * 5);
  }
}

function castBlackFlameBarrier(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.eye_activate");
  chargeFx(player, [0.6, 0.1, 0.15], 8, "aegis.fire");
  eff(player, "fire_resistance", 160, 0, false);
  for (let k = 0; k < 120; k += 5) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + k * 0.05;
        api.particle(dim, "aegis:amaterasu", api.add(player.location, { x: Math.cos(a) * 4, y: 0.2, z: Math.sin(a) * 4 }));
      }
      if (k % 10 !== 0) return;
      for (const e of enemiesNear(player, player.location, 4.6)) {
        api.hurt(e, 3, player, "fire");
        try {
          e.setOnFire(6, true);
        } catch {
          /* ignore */
        }
        const away = flat(api.sub(e.location, player.location));
        api.knockback(e, away.x, away.z, 0.6, 0.2);
      }
    }, 8 + k);
  }
}

// ===========================================================================
// Ice Release (Yuki)
// ===========================================================================
function castIceDragon(player) {
  api.anim(player, "animation.aegis.ice_seal");
  chargeFx(player, ICE, 14, "aegis.seal");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    api.launchProjectile(player, api.add(player.getHeadLocation(), api.scale(d, 1.8)), d, {
      orbEvent: "aegis:as_water", speed: 0.95, maxAge: 40, damage: 18, radius: 4.5, knock: 2, fire: 0, hitRadius: 2,
      trail: "minecraft:snowflake_particle", burst: "aegis:slash", color: ICE, sound: "aegis.ice", power: 2,
      effects: [["slowness", 100, 3], ["mining_fatigue", 100, 1]],
      onExplode: (pos, dim) => {
        for (let i = 0; i < 24; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 4;
          api.particle(dim, "aegis:slash", api.add(pos, { x: Math.cos(a) * r, y: Math.random() * 2.5, z: Math.sin(a) * r }), ICE);
        }
        api.particle(dim, "minecraft:snowflake_particle", pos);
      },
    });
    api.sound(player.dimension, "aegis.ice", player.location, 1, 0.85);
  }, 14);
}

// Yuki clan item
function iceMirrors(player) {
  const t = lookTarget(player, 16);
  if (!t) {
    player.onScreenDisplay.setActionBar("§7Look at a target within 16 blocks.");
    return false;
  }
  const dim = player.dimension;
  const c = { ...t.location };
  api.anim(player, "animation.aegis.ice_seal");
  castFx(player, ICE, "aegis.seal");
  api.sound(dim, "aegis.ice", c, 1, 1.25);
  const mirrors = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mirrors.push({ x: Math.cos(a) * 3, z: Math.sin(a) * 3 });
  }
  for (let k = 0; k < 60; k += 4) {
    system.runTimeout(() => {
      for (const m of mirrors) for (let y = 0; y < 3; y += 0.7) api.particle(dim, "aegis:slash", api.add(c, { x: m.x, y, z: m.z }), ICE);
    }, k);
  }
  for (let k = 10; k <= 60; k += 10) {
    system.runTimeout(() => {
      if (!api.isValid(t) || !api.isValid(player)) return;
      const m = mirrors[Math.floor(Math.random() * mirrors.length)];
      api.particle(dim, "aegis:slash", api.add(t.location, { x: m.x * 0.3, y: 1, z: m.z * 0.3 }), ICE);
      api.hurt(t, 3, player);
      eff(t, "slowness", 30, 3);
      api.sound(dim, "aegis.ice_shatter", t.location, 0.8, 1 + Math.random() * 0.2);
    }, k);
  }
  return true;
}

function iceDome(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.both_palms");
  api.sound(dim, "aegis.ice", player.location, 1.2, 0.85);
  impactFx(dim, player.location, ICE, 1.8);
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI * 0.5;
    api.particle(dim, "aegis:slash", api.add(player.location, { x: Math.cos(a) * Math.cos(b) * 6, y: Math.sin(b) * 6, z: Math.sin(a) * Math.cos(b) * 6 }), ICE);
  }
  for (const e of enemiesNear(player, player.location, 6)) {
    api.hurt(e, 5, player);
    eff(e, "slowness", 70, 255);
    eff(e, "weakness", 70, 2);
    api.particle(dim, "minecraft:snowflake_particle", api.add(e.location, { x: 0, y: 1, z: 0 }));
  }
  return true;
}

// ===========================================================================
// Lava & Boil Release (Terumi)
// ===========================================================================
function castLavaGlobs(player) {
  api.anim(player, "animation.aegis.jutsu_breath");
  chargeFx(player, LAVA, 12, "aegis.fire");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    for (let i = 0; i < 3; i++) {
      const ang = (i - 1) * 0.18;
      const dir = { x: d.x * Math.cos(ang) - d.z * Math.sin(ang), y: d.y + 0.05, z: d.x * Math.sin(ang) + d.z * Math.cos(ang) };
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        api.launchProjectile(player, api.add(player.getHeadLocation(), api.scale(dir, 1.3)), dir, {
          orbEvent: "aegis:as_fireball", speed: 1.05, maxAge: 30, damage: 10, radius: 3, knock: 0.6, fire: 7, hitRadius: 1.6,
          trail: "minecraft:lava_particle", burst: "aegis:fire_burst", color: LAVA, sound: "aegis.lava", power: 1.2,
          effects: [["weakness", 80, 1]],
          onExplode: (pos, dim) => {
            for (let k = 0; k < 4; k++) api.particle(dim, "minecraft:lava_particle", api.add(pos, { x: Math.random() - 0.5, y: 0.3, z: Math.random() - 0.5 }));
          },
        });
      }, i * 4);
    }
    api.sound(player.dimension, "aegis.lava", player.location, 1, 0.85);
  }, 12);
}

function castBoilStrength(player) {
  api.anim(player, "animation.aegis.power_up");
  chargeFx(player, STEAM, 12, "aegis.aura");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    boilStrength.set(player.id, system.currentTick + 300);
    eff(player, "strength", 300, 1, false);
    eff(player, "resistance", 300, 0, false);
    impactFx(player.dimension, player.location, STEAM, 1.5);
    api.sound(player.dimension, "random.fizz", player.location, 1.5, 0.5);
    player.onScreenDisplay.setActionBar("§fBoil Release: Unrivalled Strength — your blows burst with steam!");
  }, 12);
}

// Terumi clan item
function meltingApparition(player) {
  const dim = player.dimension;
  const d = flat(player.getViewDirection());
  api.anim(player, "animation.aegis.phoenix_breath");
  chargeFx(player, LAVA, 8, "aegis.fire");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    api.sound(dim, "aegis.lava", player.location, 1.5, 0.85);
    for (let s = 1; s <= 8; s++) {
      system.runTimeout(() => {
        for (let k = -2; k <= 2; k++) {
          const ang = k * 0.12;
          const dir = { x: d.x * Math.cos(ang) - d.z * Math.sin(ang), y: 0, z: d.x * Math.sin(ang) + d.z * Math.cos(ang) };
          const p = api.add(api.add(player.location, { x: 0, y: 1.2 - s * 0.08, z: 0 }), api.scale(dir, s));
          api.particle(dim, "minecraft:lava_particle", p);
          api.particle(dim, "aegis:fire_trail", p, LAVA);
        }
      }, s);
    }
    for (const e of enemiesNear(player, player.location, 9)) {
      const rel = api.sub(e.location, player.location);
      const dist = Math.hypot(rel.x, rel.z);
      if (dist < 0.1 || (rel.x * d.x + rel.z * d.z) / dist < 0.75) continue; // only inside the cone
      api.hurt(e, 9, player, "fire");
      try {
        e.setOnFire(6, true);
      } catch {
        /* ignore */
      }
      eff(e, "weakness", 100, 1);
    }
  }, 8);
  return true;
}

function skilledMist(player) {
  const dim = player.dimension;
  const centre = { ...player.location };
  api.anim(player, "animation.aegis.jutsu_breath");
  api.sound(dim, "random.fizz", centre, 1.5, 0.4);
  for (let k = 0; k < 120; k += 5) {
    system.runTimeout(() => {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 6;
        api.particle(dim, "aegis:beast_mist", api.add(centre, { x: Math.cos(a) * r, y: Math.random() * 2, z: Math.sin(a) * r }), [0.75, 0.9, 0.6]);
      }
      if (k % 20 !== 0 || !api.isValid(player)) return;
      for (const e of enemiesNear(player, centre, 6)) {
        api.hurt(e, 2, player, "magic");
        eff(e, "weakness", 40, 1);
        eff(e, "poison", 40, 0);
      }
    }, k);
  }
  return true;
}

// ===========================================================================
// Hōzuki clan item: Water Gun / Hydrification
// ===========================================================================
function waterGun(player) {
  api.anim(player, "animation.aegis.palm_thrust");
  const d = player.getViewDirection();
  api.launchProjectile(player, api.add(player.getHeadLocation(), api.scale(d, 1.2)), d, {
    noOrb: true, speed: 2.2, maxAge: 18, damage: 8, radius: 1.3, knock: 0.9, fire: 0, hitRadius: 1.1,
    trail: "aegis:water_splash", burst: "aegis:water_splash", color: WATER, sound: "aegis.water_burst", power: 0.5,
  });
  api.sound(player.dimension, "aegis.water_burst", player.location, 0.8, 1.25);
  return true;
}

function hydrification(player) {
  hydrified.set(player.id, system.currentTick + 120);
  eff(player, "speed", 120, 1, false);
  api.anim(player, "animation.aegis.substitution");
  api.particle(player.dimension, "aegis:water_splash", api.add(player.location, { x: 0, y: 1, z: 0 }));
  api.sound(player.dimension, "aegis.water", player.location, 1.2, 0.85);
  player.onScreenDisplay.setActionBar("§9Hydrification — attacks pass straight through you!");
  return true;
}

// ===========================================================================
export const RELEASE_SCROLLS = {
  senju: [["aegis:wood_forest_scroll", "Wood Release: Deep Forest Emergence", 40, 30], ["aegis:wood_dragon_scroll", "Wood Release: Wood Dragon", 56, 60]],
  uchiha: [["aegis:blaze_spears_scroll", "Blaze Release: Kagutsuchi Spears", 40, 40], ["aegis:blaze_barrier_scroll", "Blaze Release: Black Flame Barrier", 56, 70]],
  yuki: [["aegis:ice_needles_scroll", "Ice Release: Thousand Needles of Death", 22, 30], ["aegis:ice_dragon_scroll", "Ice Release: Black Dragon Blizzard", 40, 50]],
  terumi: [["aegis:lava_globs_scroll", "Lava Release: Lava Globs", 36, 35], ["aegis:boil_strength_scroll", "Boil Release: Unrivalled Strength", 40, 50]],
};

export function makeReleases(helpers) {
  api = helpers;

  // Unrivalled Strength punches; Hydrification ticks.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== "minecraft:player" || !boilStrength.has(damagingEntity.id) || !api.isValid(hitEntity)) return;
    const d = flat(api.sub(hitEntity.location, damagingEntity.location));
    api.knockback(hitEntity, d.x, d.z, 2.5, 0.5);
    api.hurt(hitEntity, 3, damagingEntity, "fire");
    api.particle(hitEntity.dimension, "aegis:beast_mist", api.add(hitEntity.location, { x: 0, y: 1, z: 0 }), STEAM);
    api.sound(hitEntity.dimension, "random.fizz", hitEntity.location, 0.8, 0.8);
  });
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player" || !hydrified.has(hurtEntity.id)) return;
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
      api.particle(hurtEntity.dimension, "aegis:water_splash", api.add(hurtEntity.location, { x: 0, y: 1, z: 0 }));
    } catch {
      /* ignore */
    }
  });
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [map, color] of [[boilStrength, STEAM], [hydrified, WATER]]) {
      for (const [id, end] of [...map]) {
        const p = world.getEntity(id);
        if (!p || !api.isValid(p) || now >= end) {
          map.delete(id);
          continue;
        }
        if (now % 6 === 0) {
          if (map === hydrified) api.particle(p.dimension, "aegis:water_splash", api.add(p.location, { x: 0, y: 0.8, z: 0 }));
          else aura(p, color, false);
        }
      }
    }
  }, 2);

  return {
    jutsu: {
      "aegis:wood_forest_scroll": { name: "Wood Release: Deep Forest Emergence", cost: 50, cooldown: 300, clan: "senju", cast: castDeepForest },
      "aegis:wood_dragon_scroll": { name: "Wood Release: Wood Dragon", cost: 60, cooldown: 360, clan: "senju", cast: castWoodDragon },
      "aegis:blaze_spears_scroll": { name: "Blaze Release: Kagutsuchi Spears", cost: 45, cooldown: 160, clan: "uchiha", cast: castKagutsuchi },
      "aegis:blaze_barrier_scroll": { name: "Blaze Release: Black Flame Barrier", cost: 55, cooldown: 400, clan: "uchiha", cast: castBlackFlameBarrier },
      "aegis:ice_dragon_scroll": { name: "Ice Release: Black Dragon Blizzard", cost: 50, cooldown: 240, clan: "yuki", cast: castIceDragon },
      "aegis:lava_globs_scroll": { name: "Lava Release: Lava Globs", cost: 45, cooldown: 180, clan: "terumi", cast: castLavaGlobs },
      "aegis:boil_strength_scroll": { name: "Boil Release: Unrivalled Strength", cost: 40, cooldown: 600, clan: "terumi", cast: castBoilStrength },
    },
    abilities: {
      "aegis:ice_mirrors": {
        clan: "yuki",
        use: { name: "Demonic Mirroring Ice Crystals", cost: 45, cd: 240, cast: iceMirrors },
        sneak: { name: "Ice Dome", cost: 35, cd: 200, cast: iceDome },
      },
      "aegis:lava_boil": {
        clan: "terumi",
        use: { name: "Lava Release: Melting Apparition", cost: 40, cd: 160, cast: meltingApparition },
        sneak: { name: "Boil Release: Skilled Mist Technique", cost: 45, cd: 300, cast: skilledMist },
      },
      "aegis:hydrification": {
        clan: "hozuki",
        use: { name: "Water Gun", cost: 15, cd: 20, cast: waterGun },
        sneak: { name: "Hydrification", cost: 30, cd: 300, cast: hydrification },
      },
    },
  };
}
