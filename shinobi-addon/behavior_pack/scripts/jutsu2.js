// Second wave of jutsu scrolls: Great Fire Annihilation, Kirin, Water Prison, Vacuum Bullets,
// Earth Spikes, Chidori Sharp Spear, Thousand Needles of Death and the Eight Inner Gates.
// main.js merges these into its JUTSU table, so cost / cooldown / chakra checks work like every other scroll.

import { world, system } from "@minecraft/server";
import { impactFx, sfx, shake, chargeFx, castFx, aura } from "./cinematic.js";

let api;
const gates = new Map(); // playerId -> tick the Eight Gates end

const FIRE = [1, 0.45, 0.1];
const BOLT = [0.6, 0.85, 1];
const WATER = [0.3, 0.6, 1];
const ICE = [0.75, 0.92, 1];
const GATE = [0.35, 1, 0.45];

function eff(e, id, ticks, amp = 0, show = true) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: show });
  } catch {
    /* ignore */
  }
}

const flat = (d) => api.norm({ x: d.x, y: 0, z: d.z });
const isBig = (e) => e.typeId === "aegis:legend" || e.typeId === "aegis:akatsuki" || e.matches?.({ families: ["tailed_beast"] });

// The living thing you're looking at (within range), or undefined.
function lookTarget(player, range) {
  try {
    return player.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
  } catch {
    return undefined;
  }
}

// Highest solid block at or below `y` (searching a few blocks), returned as the air position on top of it.
function groundAt(dim, x, y, z) {
  for (let dy = 2; dy >= -4; dy--) {
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

// ---------------------------------------------------------------------------
// Fire Style: Great Fire Annihilation — a huge wall of fire rolls forward.
// ---------------------------------------------------------------------------
function castGreatFire(player) {
  const dim = player.dimension;
  const CHARGE = 16;
  api.anim(player, "animation.aegis.fireball_jutsu");
  chargeFx(player, FIRE, CHARGE, "aegis.charge");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = flat(player.getViewDirection());
    const side = { x: -d.z, y: 0, z: d.x };
    const origin = { ...player.location };
    const hits = new Map(); // entity id -> times burned
    sfx(dim, "aegis.fire", player.location, 2, 0.7);
    api.sound(dim, "mob.ghast.fireball", player.location, 1.5, 0.5);
    shake(dim, player.location, 0.35, 1.2, 20);
    for (let k = 0; k < 14; k++) {
      system.runTimeout(() => {
        const dist = 2 + k * 1.1;
        const half = 1.5 + k * 0.35;
        const centre = api.add(origin, api.scale(d, dist));
        for (let s = -half; s <= half; s += 1) {
          const p = api.add(centre, api.scale(side, s));
          api.particle(dim, "aegis:fire_trail", api.add(p, { x: 0, y: 0.4 + Math.random() * 1.6, z: 0 }), FIRE);
          if (Math.random() < 0.4) api.particle(dim, "aegis:cine_flame", api.add(p, { x: 0, y: 0.6, z: 0 }), FIRE);
        }
        if (k % 3 === 0) api.particle(dim, "aegis:fire_burst", api.add(centre, { x: 0, y: 1, z: 0 }), FIRE);
        if (!api.isValid(player)) return;
        for (const e of dim.getEntities({ location: centre, maxDistance: half + 1.5 })) {
          if (!api.canBeHit(e, player) || (hits.get(e.id) ?? 0) >= 3) continue;
          const rel = api.sub(e.location, centre);
          if (Math.abs(rel.x * d.x + rel.z * d.z) > 1.8) continue; // only things inside the wall
          hits.set(e.id, (hits.get(e.id) ?? 0) + 1);
          api.hurt(e, 6, player, "fire");
          try {
            e.setOnFire(6, true);
          } catch {
            /* ignore */
          }
          api.knockback(e, d.x, d.z, 0.6, 0.2);
        }
      }, k * 2);
    }
  }, CHARGE);
}

// ---------------------------------------------------------------------------
// Lightning Style: Kirin — call down a dragon of lightning on the spot you aim at.
// ---------------------------------------------------------------------------
function castKirin(player) {
  const dim = player.dimension;
  let spot;
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 48 });
    if (hit) spot = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 1, z: hit.block.location.z + 0.5 };
  } catch {
    /* none */
  }
  const ent = lookTarget(player, 48);
  if (ent) spot = { ...ent.location };
  if (!spot) {
    player.onScreenDisplay.setActionBar("§7Aim at the ground or a target (up to 48 blocks).");
    return false;
  }
  const DELAY = 30;
  api.anim(player, "animation.aegis.kirin_call");
  chargeFx(player, BOLT, DELAY, "aegis.charge");
  api.sound(dim, "ambient.weather.thunder", spot, 2, 0.6);
  for (let t = 0; t < DELAY; t += 4) {
    system.runTimeout(() => {
      api.particle(dim, "aegis:cine_ring", spot, BOLT);
      api.particle(dim, "aegis:cine_bolt", api.add(spot, { x: (Math.random() - 0.5) * 4, y: 8 + Math.random() * 6, z: (Math.random() - 0.5) * 4 }), BOLT);
    }, t);
  }
  system.runTimeout(() => {
    for (let y = 0; y < 24; y += 1.5) api.particle(dim, "aegis:cine_pillar", api.add(spot, { x: Math.sin(y) * 0.6, y, z: Math.cos(y) * 0.6 }), BOLT);
    api.particle(dim, "aegis:lightning_burst", api.add(spot, { x: 0, y: 1, z: 0 }));
    try {
      dim.spawnEntity("minecraft:lightning_bolt", spot);
    } catch {
      /* ignore */
    }
    sfx(dim, "aegis.lightning", spot, 3, 0.7);
    sfx(dim, "aegis.boom", spot, 2.5, 0.8);
    impactFx(dim, spot, BOLT, 4);
    shake(dim, spot, 1.2, 1.2, 40);
    if (!api.isValid(player)) return;
    for (const e of dim.getEntities({ location: spot, maxDistance: 5 })) {
      if (!api.canBeHit(e, player)) continue;
      api.hurt(e, 28, player, "lightning");
      const away = flat(api.sub(e.location, spot));
      api.knockback(e, away.x, away.z, 1.4, 0.8);
      eff(e, "slowness", 60, 3);
    }
  }, DELAY);
}

// ---------------------------------------------------------------------------
// Water Style: Water Prison — trap the target in a sphere of water.
// ---------------------------------------------------------------------------
function castWaterPrison(player) {
  const t = lookTarget(player, 12);
  if (!t) {
    player.onScreenDisplay.setActionBar("§7Look at a target within 12 blocks.");
    return false;
  }
  const dim = player.dimension;
  const at = { ...t.location };
  const dur = isBig(t) ? 40 : 100;
  api.anim(player, "animation.aegis.water_seals");
  castFx(player, WATER, "aegis.seal");
  api.sound(dim, "bucket.fill_water", at, 1.5, 0.6);
  if (t.typeId === "minecraft:player") t.onScreenDisplay?.setActionBar("§9You're caught in a Water Prison!");
  for (let k = 0; k <= dur; k += 2) {
    system.runTimeout(() => {
      if (!api.isValid(t)) return;
      try {
        t.teleport(at);
      } catch {
        /* ignore */
      }
      if (k % 4 === 0) {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          const b = Math.random() * Math.PI;
          api.particle(dim, "aegis:water_splash", api.add(at, { x: Math.cos(a) * Math.sin(b) * 1.4, y: 1 + Math.cos(b) * 1.4, z: Math.sin(a) * Math.sin(b) * 1.4 }));
        }
        api.particle(dim, "minecraft:bubble_column_up_particle", api.add(at, { x: 0, y: 0.5, z: 0 }));
      }
      if (k % 20 === 0 && k > 0 && api.isValid(player)) api.hurt(t, 3, player, "drowning");
    }, k);
  }
  eff(t, "slowness", dur, 6);
  eff(t, "weakness", dur, 2);
  system.runTimeout(() => api.isValid(t) && api.particle(dim, "aegis:water_splash", api.add(at, { x: 0, y: 1, z: 0 })), dur);
}

// ---------------------------------------------------------------------------
// Wind Style: Vacuum Bullets — five compressed air bullets in quick succession.
// ---------------------------------------------------------------------------
function castVacuum(player) {
  api.anim(player, "animation.aegis.jutsu_breath");
  chargeFx(player, [0.75, 1, 0.85], 8);
  for (let i = 0; i < 5; i++) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      const d = player.getViewDirection();
      const spread = { x: (Math.random() - 0.5) * 0.06, y: (Math.random() - 0.5) * 0.04, z: (Math.random() - 0.5) * 0.06 };
      const dir = api.norm(api.add(d, spread));
      api.launchProjectile(player, api.add(player.getHeadLocation(), api.scale(dir, 1.2)), dir, {
        noOrb: true, speed: 1.9, maxAge: 22, damage: 6, radius: 1.8, knock: 1.4, fire: 0, hitRadius: 1.2,
        trail: "aegis:wind_gust", burst: "aegis:wind_gust", color: [0.75, 1, 0.85], sound: "mob.breeze.wind_burst", power: 0.6,
      });
      api.sound(player.dimension, "mob.breeze.shoot", player.location, 0.8, 1.3 + i * 0.05);
    }, 8 + i * 3);
  }
}

// ---------------------------------------------------------------------------
// Earth Style: Earth Spikes — a line of stone spikes rips out of the ground.
// ---------------------------------------------------------------------------
function castEarthSpikes(player) {
  const dim = player.dimension;
  const d = flat(player.getViewDirection());
  const origin = { ...player.location };
  const placed = [];
  const hit = new Set();
  api.anim(player, "animation.aegis.earth_slam");
  chargeFx(player, [0.65, 0.5, 0.3], 7);
  system.runTimeout(() => {
    api.sound(dim, "dig.stone", origin, 1.2, 0.5);
    shake(dim, origin, 0.3, 0.8, 16);
    for (let k = 1; k <= 14; k++) {
      system.runTimeout(() => {
        const p = api.add(origin, api.scale(d, 1 + k));
        const g = groundAt(dim, Math.floor(p.x), Math.floor(origin.y), Math.floor(p.z));
        if (!g) return;
        try {
          const b = dim.getBlock(g);
          if (b?.isAir) {
            b.setType("minecraft:pointed_dripstone");
            placed.push(g);
          }
        } catch {
          /* ignore */
        }
        api.particle(dim, "aegis:dust", g);
        api.particle(dim, "aegis:cine_debris", g, [0.6, 0.5, 0.4]);
        if (k % 2 === 0) api.sound(dim, "break.pointed_dripstone", g, 1, 0.6 + Math.random() * 0.3);
        if (!api.isValid(player)) return;
        for (const e of dim.getEntities({ location: api.add(g, { x: 0.5, y: 0, z: 0.5 }), maxDistance: 1.9 })) {
          if (!api.canBeHit(e, player) || hit.has(e.id)) continue;
          hit.add(e.id);
          api.hurt(e, 10, player);
          api.knockback(e, d.x, d.z, 0.4, 1.1);
          eff(e, "slowness", 60, 2);
        }
      }, k);
    }
  }, 7);
  system.runTimeout(() => {
    for (const l of placed) {
      try {
        const b = dim.getBlock(l);
        if (b?.typeId === "minecraft:pointed_dripstone") b.setType("minecraft:air");
      } catch {
        /* ignore */
      }
      api.particle(dim, "aegis:dust", l);
    }
  }, 80);
}

// ---------------------------------------------------------------------------
// Lightning Style: Chidori Sharp Spear — the Chidori stretches into a long blade that pierces everything in line.
// ---------------------------------------------------------------------------
function castChidoriSpear(player) {
  const dim = player.dimension;
  const CHARGE = 10;
  api.anim(player, "animation.aegis.chidori_spear");
  chargeFx(player, BOLT, CHARGE);
  sfx(dim, "aegis.chidori", player.location, 1.3, 1.2);
  for (let i = 0; i < CHARGE; i++) {
    system.runTimeout(() => api.isValid(player) && api.particle(dim, "aegis:chidori", api.chidoriHand(player)), i);
  }
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    const start = api.sub(api.handPos(player), { x: 0, y: 0.2, z: 0 });
    let len = 16;
    for (let s = 1; s <= 16; s += 0.5) {
      try {
        const b = dim.getBlock(api.add(start, api.scale(d, s)));
        if (b && !b.isAir && !b.isLiquid) {
          len = s;
          break;
        }
      } catch {
        len = s;
        break;
      }
    }
    const hit = new Set();
    for (let t = 0; t < 6; t++) {
      system.runTimeout(() => {
        for (let s = 0.5; s <= len; s += 0.6) {
          const p = api.add(start, api.scale(d, s));
          const j = { x: (Math.random() - 0.5) * 0.25, y: (Math.random() - 0.5) * 0.25, z: (Math.random() - 0.5) * 0.25 };
          api.particle(dim, "aegis:chidori", api.add(p, j));
          if (!api.isValid(player)) continue;
          for (const e of dim.getEntities({ location: p, maxDistance: 1.3 })) {
            if (!api.canBeHit(e, player) || hit.has(e.id)) continue;
            hit.add(e.id);
            api.hurt(e, 12, player, "lightning");
            eff(e, "slowness", 50, 4);
            api.particle(dim, "aegis:lightning_burst", api.add(e.location, { x: 0, y: 1, z: 0 }));
          }
        }
      }, t);
    }
    api.particle(dim, "aegis:lightning_burst", api.add(start, api.scale(d, len)));
    sfx(dim, "aegis.lightning", player.location, 1.5, 1.2);
    api.sound(dim, "ambient.weather.lightning.impact", api.add(start, api.scale(d, len)), 0.7, 1.6);
    impactFx(dim, api.add(start, api.scale(d, len)), BOLT, 1.2);
  }, CHARGE);
}

// ---------------------------------------------------------------------------
// Ice Style: Thousand Needles of Death — a ring of ice needles closes in on the target.
// ---------------------------------------------------------------------------
function castIceNeedles(player) {
  const dim = player.dimension;
  const t = lookTarget(player, 18);
  const centre = t ? { ...t.location } : api.add(player.location, api.scale(flat(player.getViewDirection()), 7));
  api.anim(player, "animation.aegis.ice_seal");
  castFx(player, ICE, "aegis.seal");
  api.sound(dim, "random.glass", centre, 0.6, 1.6);
  const N = 18;
  const needles = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    needles.push({ x: Math.cos(a) * 3.5, y: 0.4 + (i % 3) * 0.7, z: Math.sin(a) * 3.5 });
  }
  // form
  for (let k = 0; k < 12; k += 2) {
    system.runTimeout(() => {
      for (const n of needles) api.particle(dim, "aegis:slash", api.add(centre, n), ICE);
      api.particle(dim, "minecraft:snowflake_particle", api.add(centre, { x: 0, y: 1, z: 0 }));
    }, k);
  }
  // close in
  for (let k = 0; k < 6; k++) {
    system.runTimeout(() => {
      const f = 1 - (k + 1) / 6;
      for (const n of needles) api.particle(dim, "aegis:slash", api.add(centre, { x: n.x * f, y: n.y, z: n.z * f }), ICE);
    }, 12 + k);
  }
  system.runTimeout(() => {
    api.sound(dim, "random.glass", centre, 1.2, 0.8);
    impactFx(dim, centre, ICE, 1.5);
    if (!api.isValid(player)) return;
    for (const e of dim.getEntities({ location: centre, maxDistance: 3.2 })) {
      if (!api.canBeHit(e, player)) continue;
      api.hurt(e, 16, player);
      eff(e, "slowness", 100, 3);
      eff(e, "mining_fatigue", 100, 1);
      try {
        e.extinguishFire?.();
      } catch {
        /* ignore */
      }
    }
  }, 18);
}

// ---------------------------------------------------------------------------
// Eight Inner Gates Release — open the gates: huge taijutsu power for 20s, then exhaustion.
// ---------------------------------------------------------------------------
function castEightGates(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.gates_release");
  chargeFx(player, GATE, 14, "aegis.aura");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    impactFx(dim, player.location, GATE, 2.5);
    sfx(dim, "aegis.transform", player.location, 1.8, 1.2);
    api.particle(dim, "aegis:cine_pillar", player.location, GATE);
    eff(player, "strength", 400, 2, false);
    eff(player, "speed", 400, 2, false);
    eff(player, "jump_boost", 400, 1, false);
    eff(player, "haste", 400, 1, false);
    eff(player, "resistance", 400, 0, false);
    gates.set(player.id, system.currentTick + 400);
    player.onScreenDisplay.setActionBar("§aEight Inner Gates — Gate of Opening… Gate of Pain… Open!");
  }, 14);
}

function tickGates() {
  const now = system.currentTick;
  for (const [id, end] of [...gates]) {
    const p = world.getEntity(id);
    if (!p || !api.isValid(p)) {
      gates.delete(id);
      continue;
    }
    if (now >= end) {
      gates.delete(id);
      // the price: exhaustion
      eff(p, "slowness", 200, 1);
      eff(p, "weakness", 200, 1);
      eff(p, "hunger", 200, 1);
      try {
        const h = p.getComponent("minecraft:health");
        if (h.currentValue > 6) h.setCurrentValue(h.currentValue - 4);
      } catch {
        /* ignore */
      }
      p.onScreenDisplay.setActionBar("§7The gates close… your body is exhausted.");
      continue;
    }
    if (now % 5 === 0) aura(p, GATE, false);
    if (now % 10 === 0) api.particle(p.dimension, "aegis:chakra_aura", p.location, GATE);
  }
}

export const isGatesOpen = (p) => gates.has(p.id);

export function makeJutsu2(helpers) {
  api = helpers;
  system.runInterval(tickGates, 1);

  // While the gates are open every punch lands like a cannon.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== "minecraft:player" || !gates.has(damagingEntity.id) || !api.isValid(hitEntity)) return;
    const d = flat(api.sub(hitEntity.location, damagingEntity.location));
    api.knockback(hitEntity, d.x, d.z, 1.8, 0.45);
    impactFx(hitEntity.dimension, api.add(hitEntity.location, { x: 0, y: 1, z: 0 }), GATE, 0.8);
    sfx(hitEntity.dimension, "aegis.impact", hitEntity.location, 1, 1.1);
  });

  return {
    "aegis:great_fire_scroll": { name: "Fire Style: Great Fire Annihilation", cost: 55, cooldown: 200, cast: castGreatFire },
    "aegis:kirin_scroll": { name: "Lightning Style: Kirin", cost: 80, cooldown: 400, cast: castKirin },
    "aegis:water_prison_scroll": { name: "Water Style: Water Prison", cost: 35, cooldown: 240, cast: castWaterPrison },
    "aegis:vacuum_scroll": { name: "Wind Style: Vacuum Bullets", cost: 30, cooldown: 60, cast: castVacuum },
    "aegis:earth_spikes_scroll": { name: "Earth Style: Earth Spikes", cost: 35, cooldown: 100, cast: castEarthSpikes },
    "aegis:chidori_spear_scroll": { name: "Lightning Style: Chidori Sharp Spear", cost: 40, cooldown: 100, cast: castChidoriSpear },
    "aegis:ice_needles_scroll": { name: "Ice Release: Thousand Needles of Death", cost: 45, cooldown: 160, clan: "yuki", cast: castIceNeedles },
    "aegis:eight_gates_scroll": { name: "Eight Inner Gates Release", cost: 50, cooldown: 1200, cast: castEightGates },
  };
}
