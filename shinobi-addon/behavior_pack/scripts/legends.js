// Legendary bosses: Naruto, Sasuke, Tsunade, Sarutobi (Third Hokage), Minato — and the reanimated Madara Uchiha.
// v1.51: a legend for every other village too — Gaara (Sand), Zabuza (Mist), Killer B (Cloud), Ōnoki (Stone) and
// Hanzō of the Salamander (Rain).
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
  madara: { name: "§4Madara Uchiha §8[Edo Tensei]", skin: 29, color: [0.35, 0.45, 1], phase: "Perfect Susanoo", entrance: "§7returns from the dead!",
    drops: [["aegis:great_fire_scroll", 1, 1], ["aegis:ryo", 64, 1], ["aegis:ryo", 64, 1], ["aegis:phoenix_scroll", 1, 0.5],
      ["aegis:wood_dragon_scroll", 1, 0.35], ["aegis:edo_tensei_scroll", 1, 0.15]] },
  // ---- v1.51: the other villages' legends ----
  gaara: { name: "§6Gaara of the Desert", skin: 64, color: [0.86, 0.72, 0.45], phase: "Ultimate Defence: Shukaku Shield", village: "sand",
    entrance: "§7The sand begins to stir…",
    drops: [["aegis:wind_scroll", 1, 1], ["aegis:sand_gourd", 1, 0.35], ["aegis:pressure_damage_scroll", 1, 0.4], ["aegis:sand_headband", 1, 0.5]] },
  zabuza: { name: "§bZabuza Momochi", skin: 65, color: [0.6, 0.78, 0.95], phase: "Demon of the Hidden Mist", village: "mist",
    entrance: "§7steps out of the mist…",
    drops: [["aegis:hiding_mist_scroll", 1, 1], ["aegis:kubikiribocho", 1, 0.3], ["aegis:water_dragon_scroll", 1, 0.5], ["aegis:mist_headband", 1, 0.5]] },
  killer_bee: { name: "§eKiller B", skin: 66, color: [0.85, 0.3, 0.45], phase: "Eight-Tails Chakra Mode", village: "cloud",
    entrance: "§7drops in with a beat!",
    drops: [["aegis:lightning_hound_scroll", 1, 1], ["aegis:lightning_armor_scroll", 1, 0.4], ["aegis:bijuu_scroll", 1, 0.15], ["aegis:cloud_headband", 1, 0.5]] },
  onoki: { name: "§6Ōnoki §7the Third Tsuchikage", skin: 67, color: [0.92, 0.95, 1], phase: "Dust Release", village: "stone",
    entrance: "§7floats down from the sky!",
    drops: [["aegis:earth_dragon_scroll", 1, 1], ["aegis:earth_spikes_scroll", 1, 0.5], ["aegis:headhunter_scroll", 1, 0.4], ["aegis:stone_headband", 1, 0.5]] },
  hanzo: { name: "§5Hanzō of the Salamander", skin: 68, color: [0.55, 0.3, 0.75], phase: "Salamander's Venom", village: "rain",
    entrance: "§7The rain falls harder…",
    drops: [["aegis:water_prison_scroll", 1, 1], ["aegis:water_shockwave_scroll", 1, 0.4], ["aegis:ryo", 64, 1], ["aegis:rain_headband", 1, 0.5]] },
};
// v1.51 colours
const SAND = [0.86, 0.72, 0.45];
const MIST = [0.6, 0.78, 0.95];
const WATER = [0.3, 0.6, 1];
const BOLT = [0.6, 0.85, 1];
const GYUKI = [0.85, 0.3, 0.45];
const DUST = [0.92, 0.95, 1];
const ROCK = [0.6, 0.45, 0.3];
const VENOM = [0.55, 0.3, 0.75];
const WOOD = [0.45, 0.32, 0.18];
const reformed = new Set(); // Edo Madara: his body reforms once

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

function blast(boss, pos, r, dmg, knock = 1.5, extra, skip) {
  for (const e of boss.dimension.getEntities({ location: pos, maxDistance: r })) {
    if (!api.canBeHit(e, boss) || e.typeId === "aegis:legend" || e.typeId === "aegis:hostile_ninja" || skip?.has(e.id)) continue;
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

const rot = (d, a) => ({ x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y ?? 0, z: d.x * Math.sin(a) + d.z * Math.cos(a) });
const lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function heal(e, n) {
  try {
    const h = e.getComponent("minecraft:health");
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n));
  } catch {
    /* ignore */
  }
}

function hpOf(e) {
  try {
    return e.getComponent("minecraft:health").currentValue;
  } catch {
    return 0;
  }
}

// Several projectiles in a fan toward the target.
function fan(boss, t, n, step, opts) {
  const d = dirTo(boss, t);
  const start = boss.getHeadLocation();
  const dy = (t.location.y + 1 - start.y) / Math.max(2, flat(t.location, boss.location));
  for (let i = 0; i < n; i++) {
    const dir = rot({ x: d.x, y: dy, z: d.z }, (i - (n - 1) / 2) * step);
    api.launchProjectile(boss, add(start, { x: dir.x, y: 0, z: dir.z }), dir, { ignoreFamily: "ninja", ...opts });
  }
}

// Living-thing targets inside a radius (never the boss, its clones or other bosses).
function victims(boss, pos, r) {
  try {
    return boss.dimension.getEntities({ location: pos, maxDistance: r })
      .filter((e) => e.id !== boss.id && api.canBeHit(e, boss) && e.typeId !== "aegis:legend" && e.typeId !== "aegis:hostile_ninja");
  } catch {
    return [];
  }
}

const clonesOf = (boss) => {
  try {
    return boss.dimension.getEntities({ tags: [`aegis_lclone_${boss.id}`] }).length;
  } catch {
    return 0;
  }
};

// Clones that vanish when hit (the shadow-clone rule in initLegends) and on their own after 20 seconds.
function clones(boss, skin, name, max, puff = "aegis:smoke_puff") {
  api.anim(boss, "animation.aegis.clone_seal");
  sfx(boss.dimension, "aegis.whoosh", boss.location, 1.5, 1);
  for (let i = clonesOf(boss); i < max; i++) {
    const a = Math.random() * Math.PI * 2;
    const at = add(boss.location, { x: Math.cos(a) * 2, y: 0, z: Math.sin(a) * 2 });
    try {
      const c = boss.dimension.spawnEntity("aegis:hostile_ninja", at);
      c.addTag(`aegis_lclone_${boss.id}`);
      c.setDynamicProperty("aegis:role", "rogue");
      c.setDynamicProperty("aegis:no_xp", true);
      c.setProperty("aegis:skin", skin);
      c.nameTag = name;
      c.triggerEvent("aegis:persist");
      api.particle(boss.dimension, puff, at);
      system.runTimeout(() => {
        if (api.isValid(c)) {
          api.particle(c.dimension, puff, c.location);
          c.remove();
        }
      }, 400);
    } catch {
      /* ignore */
    }
  }
}

function warnAll(boss, pos, r, title, subtitle) {
  for (const p of playersAround(boss.dimension, pos, r)) showTitle(p, title, { subtitle, fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 5 });
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
      for (let i = 0; i < 12; i++) system.runTimeout(() => api.isValid(boss) && api.particle(boss.dimension, "aegis:chidori", api.chidoriHand(boss)), i);
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

  madara(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.22) {
      meteor(boss, t);
      return 160;
    }
    if (dist < 4.5 && r < 0.6) {
      // Uchiha Return: the gunbai sweeps everything away
      api.anim(boss, "animation.aegis.sword_spin");
      system.runTimeout(() => {
        if (!api.isValid(boss)) return;
        impactFx(boss.dimension, boss.location, [0.85, 0.85, 0.95], 2);
        api.particle(boss.dimension, "aegis:wind_gust", add(boss.location, { x: 0, y: 1, z: 0 }));
        blast(boss, boss.location, 5, p2 ? 18 : 14, 3.2);
      }, 6);
      return 60;
    }
    if (r < 0.45) {
      woodLine(boss, t);
      return 100;
    }
    if (r < 0.75 && dist > 5) {
      fireAnnihilation(boss, t, p2);
      return 110;
    }
    susanooSlash(boss, t, p2);
    return 70;
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

  // --- Gaara (Sand): the sand does everything — and often blocks your blows (see initLegends) ---
  gaara(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.22) {
      sandFuneral(boss, t);
      return 150;
    }
    if (r < 0.32 && dist < 16) {
      sandCoffin(boss, t, p2);
      return 110;
    }
    if (dist < 4.5) {
      // a fist of sand
      api.anim(boss, "animation.aegis.palm_thrust");
      sfx(boss.dimension, "dig.sand", boss.location, 1.2, 0.7);
      system.runTimeout(() => {
        if (!api.isValid(boss) || !api.isValid(t)) return;
        const d = dirTo(boss, t);
        api.particle(boss.dimension, "aegis:earth_burst", chest(t));
        api.particle(boss.dimension, "aegis:dust", t.location);
        api.hurt(t, p2 ? 16 : 12, boss);
        api.knockback(t, d.x, d.z, 3.2, 0.6);
      }, 6);
      return 55;
    }
    if (r < 0.66) {
      sandShuriken(boss, t, p2);
      return 60;
    }
    sandWave(boss, t, p2);
    return 100;
  },

  // --- Zabuza (Mist): the Hidden Mist, silent killing, water jutsu and the Kubikiribōchō ---
  zabuza(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.18 && clonesOf(boss) < 2) {
      clones(boss, LEGENDS.zabuza.skin, "§bZabuza §7(Water Clone)", 2, "aegis:water_splash");
      return 60;
    }
    if (r < (p2 ? 0.4 : 0.25)) {
      hiddenMist(boss, t, p2);
      return 130;
    }
    if (dist < 4.5) {
      cleaverSweep(boss, p2);
      return 60;
    }
    if (r < 0.55 && dist > 6) {
      waterDragon(boss, t);
      return 100;
    }
    if (r < 0.75 && dist < 10) {
      waterPrison(boss, t, p2);
      return 110;
    }
    sfx(boss.dimension, "aegis.whoosh", boss.location, 1.2, 0.8);
    dashStrike(boss, t, MIST, p2 ? 19 : 15, 10, "animation.aegis.sword_raise", 3.4);
    return 70;
  },

  // --- Killer B (Cloud): Lariat, seven swords, octopus ink — and the Eight-Tails ---
  killer_bee(boss, t, dist, p2) {
    const r = Math.random();
    if (Math.random() < 0.3) rap(boss);
    if (p2 && r < 0.25) {
      bijuuBomb(boss, t, GYUKI);
      return 110;
    }
    if (p2 && r < 0.5) {
      octopusHold(boss, t);
      return 100;
    }
    if (dist < 4.5 && r < 0.75) {
      swordDance(boss, p2);
      return 70;
    }
    if (r < 0.45 && dist > 5) {
      inkShot(boss, t);
      return 60;
    }
    lariat(boss, t, p2);
    return 75;
  },

  // --- Ōnoki (Stone): Added Weight Rock, Flight, earth — and Dust Release. Mind his back. ---
  onoki(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.25) {
      dustRelease(boss, t);
      backPain(boss, 0.4);
      return 160;
    }
    if (r < 0.22) {
      addedWeight(boss, t);
      return 100;
    }
    if (dist < 4.5) {
      rockFist(boss, t, p2);
      return 55;
    }
    if (r < 0.55 && dist > 6) {
      flightBarrage(boss, t, p2);
      backPain(boss, 0.25);
      return 110;
    }
    rockLine(boss, t, p2);
    return 100;
  },

  // --- Hanzō (Rain): the salamander's poison and the chain-sickle ---
  hanzo(boss, t, dist, p2) {
    const r = Math.random();
    if (p2 && r < 0.22) {
      venomRain(boss);
      return 140;
    }
    if (r < 0.3) {
      poisonMist(boss, t, p2);
      return 120;
    }
    if (dist < 4.5) {
      sickleSlash(boss, p2);
      return 55;
    }
    if (r < 0.65 && dist < 13) {
      chainSickle(boss, t, p2);
      return 80;
    }
    poisonFan(boss, t, p2);
    return 75;
  },
};

// --- Gaara --------------------------------------------------------------------
// Sand Coffin: the sand gathers where the target stood, then closes; in the second phase Sand Burial crushes whoever it caught.
function sandCoffin(boss, t, p2) {
  const dim = boss.dimension;
  const spot = { ...t.location };
  api.anim(boss, "animation.aegis.palm_thrust");
  sfx(dim, "aegis.earth", spot, 1.2, 1.3);
  showTitle(t, "§6Sand Coffin", { subtitle: "§7The sand is closing in — move!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
  for (let k = 0; k < 18; k += 3) {
    system.runTimeout(() => {
      api.particle(dim, "aegis:cine_ring", spot, SAND);
      api.particle(dim, "aegis:dust", add(spot, { x: (Math.random() - 0.5) * 2, y: 0.2, z: (Math.random() - 0.5) * 2 }));
    }, k);
  }
  const caught = new Set();
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    for (let y = 0; y < 2.4; y += 0.6) api.particle(dim, "aegis:earth_burst", add(spot, { x: 0, y, z: 0 }));
    sfx(dim, "dig.sand", spot, 2, 0.6);
    blast(boss, spot, 2.6, p2 ? 16 : 13, 0.2, (e) => {
      caught.add(e.id);
      eff(e, "slowness", 60, 5);
      eff(e, "mining_fatigue", 60, 2);
      if (e.typeId === "minecraft:player") e.onScreenDisplay?.setActionBar("§6The sand holds you fast!");
    });
  }, 18);
  if (!p2) return;
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    let crushed = false;
    for (const id of caught) {
      const e = world.getEntity(id);
      if (!e || !api.isValid(e) || flat(e.location, spot) > 3.5) continue;
      crushed = true;
      api.hurt(e, 18, boss);
      api.particle(dim, "aegis:earth_burst", chest(e));
      if (e.typeId === "minecraft:player") showTitle(e, "§6Sand Burial", { subtitle: "§7Crushed by the sand!", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 5 });
    }
    if (crushed) {
      impactFx(dim, spot, SAND, 2);
      sfx(dim, "aegis.impact", spot, 2, 0.5);
    }
  }, 40);
}

// Sand Shuriken: a fan of hardened sand.
function sandShuriken(boss, t, p2) {
  api.anim(boss, "animation.aegis.throw_overhead");
  sfx(boss.dimension, "aegis.wind", boss.location, 1, 1.4);
  system.runTimeout(() => api.isValid(boss) && api.isValid(t) && fan(boss, t, p2 ? 7 : 5, 0.14, {
    noOrb: true, speed: 1.6, maxAge: 24, damage: 5, radius: 1.5, knock: 0.4, fire: 0, trail: "aegis:dust", burst: "aegis:earth_burst",
    color: SAND, hitRadius: 1.2, power: 0.4, sound: "dig.sand" }), 8);
}

// Sand Tsunami: a wave of sand rolls out toward the target and sweeps everyone along.
function sandWave(boss, t, p2) {
  const dim = boss.dimension;
  const o = { ...boss.location };
  const d = dirTo(boss, t);
  api.anim(boss, "animation.aegis.both_palms");
  chargeFx(boss, SAND, 10, "aegis.earth");
  const hit = new Set();
  for (let i = 2; i <= 18; i += 2) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      const at = add(o, { x: d.x * i, y: 0, z: d.z * i });
      for (const side of [-1.5, 0, 1.5]) api.particle(dim, "aegis:earth_burst", add(at, { x: -d.z * side, y: 0.4, z: d.x * side }));
      api.particle(dim, "aegis:dust", at);
      if (i % 4 === 0) sfx(dim, "dig.sand", at, 1.5, 0.6);
      blast(boss, at, 2.6, p2 ? 13 : 10, 0, (e) => {
        hit.add(e.id);
        api.knockback(e, d.x, d.z, 2.2, 0.55);
      }, hit);
    }, 10 + i);
  }
}

// Phase 2 — Sand Waterfall Funeral: the ground around the target becomes a tidal wave of sand.
function sandFuneral(boss, t) {
  const dim = boss.dimension;
  const spot = { ...t.location };
  api.anim(boss, "animation.aegis.earth_slam");
  sfx(dim, "aegis.charge", boss.location, 2, 0.6);
  warnAll(boss, spot, 32, "§6Sand Waterfall Funeral", "§7A tidal wave of sand — get clear!");
  for (let k = 0; k < 36; k += 4) {
    system.runTimeout(() => {
      const rr = 1 + k / 6;
      for (let a = 0; a < 6; a++) api.particle(dim, "aegis:dust", add(spot, { x: Math.cos(a + k) * rr, y: 0.2, z: Math.sin(a + k) * rr }));
      api.particle(dim, "aegis:cine_ring", spot, SAND);
    }, k);
  }
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    for (let y = 0; y < 8; y += 2) api.particle(dim, "aegis:cine_pillar", add(spot, { x: 0, y, z: 0 }), SAND);
    for (let a = 0; a < 8; a++) api.particle(dim, "aegis:earth_burst", add(spot, { x: Math.cos(a) * 4, y: 0.5, z: Math.sin(a) * 4 }));
    sfx(dim, "aegis.earth", spot, 3, 0.5);
    shake(dim, spot, 0.8, 1.2, 32);
    blast(boss, spot, 6.5, 24, 2.4, (e) => eff(e, "slowness", 80, 3));
  }, 38);
}

// --- Zabuza -------------------------------------------------------------------
// Hidden Mist Jutsu → Silent Killing: a blinding fog rolls in, he vanishes, and strikes from behind.
function hiddenMist(boss, t, p2) {
  const dim = boss.dimension;
  const c = { ...boss.location };
  api.anim(boss, "animation.aegis.hand_signs");
  sfx(dim, "aegis.water", c, 1.4, 0.6);
  for (const p of playersAround(dim, c, 24)) {
    showTitle(p, "§bHidden Mist Jutsu", { subtitle: "§7You can't see a thing…", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
    eff(p, "blindness", 90, 0);
  }
  for (let k = 0; k < 80; k += 8) {
    system.runTimeout(() => {
      for (let a = 0; a < 8; a++) api.particle(dim, "aegis:mist_cloud", add(c, { x: Math.cos(a) * (2 + k / 16), y: 0.6, z: Math.sin(a) * (2 + k / 16) }));
    }, k);
  }
  eff(boss, "invisibility", 50, 0);
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    showTitle(t, "§bSilent Killing", { subtitle: "§7…right behind you.", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 5 });
    teleportStrike(boss, t, p2 ? 20 : 16, MIST);
    system.runTimeout(() => {
      try {
        if (api.isValid(boss)) boss.removeEffect("invisibility");
      } catch {
        /* ignore */
      }
    }, 6);
  }, 40);
}

// The Kubikiribōchō sweeps round him — and drinks the blood it spills.
function cleaverSweep(boss, p2) {
  api.anim(boss, "animation.aegis.sword_spin");
  sfx(boss.dimension, "aegis.slash", boss.location, 1.5, 0.6);
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    impactFx(boss.dimension, boss.location, MIST, 1.5);
    let drank = 0;
    blast(boss, boss.location, 4.6, p2 ? 18 : 14, 2.4, (e) => {
      drank += p2 ? 6 : 4;
      api.particle(e.dimension, "aegis:slash", chest(e), [0.8, 0.15, 0.15]);
    });
    if (drank) heal(boss, drank);
  }, 6);
}

function waterDragon(boss, t) {
  api.anim(boss, "animation.aegis.water_seals");
  chargeFx(boss, WATER, 14, "aegis.water");
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    api.anim(boss, "animation.aegis.both_palms");
    shoot(boss, t, { orbEvent: "aegis:as_water", speed: 1.0, maxAge: 40, damage: 15, radius: 4.2, knock: 2.6, fire: 0, trail: "aegis:water_splash",
      burst: "aegis:water_splash", hitRadius: 2, sound: "aegis.water_burst", effects: [["slowness", 60, 2]], color: WATER });
  }, 14);
}

// Water Prison: a sphere of water holds the target in place for four seconds — hurt him enough and it bursts.
function waterPrison(boss, t, p2) {
  const dim = boss.dimension;
  api.anim(boss, "animation.aegis.water_seals");
  sfx(dim, "aegis.water", t.location, 1.4, 0.7);
  showTitle(t, "§bWater Prison", { subtitle: "§7Hit him hard to break free!", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 5 });
  const hp0 = hpOf(boss);
  eff(boss, "slowness", 80, 6); // he has to keep a hand in the prison
  let open = true;
  for (let k = 0; k < 80; k += 5) {
    system.runTimeout(() => {
      if (!open || !api.isValid(boss) || !api.isValid(t)) return;
      if (hpOf(boss) < hp0 - 20) {
        open = false;
        try {
          boss.removeEffect("slowness");
          for (const id of ["slowness", "mining_fatigue", "weakness"]) t.removeEffect(id);
        } catch {
          /* ignore */
        }
        api.particle(dim, "aegis:water_splash", chest(t));
        if (t.typeId === "minecraft:player") t.onScreenDisplay?.setActionBar("§bThe Water Prison bursts — you're free!");
        return;
      }
      const a = k * 0.16;
      api.particle(dim, "aegis:water_splash", add(t.location, { x: Math.cos(a) * 1.1, y: 1, z: Math.sin(a) * 1.1 }));
      eff(t, "slowness", 10, 6);
      eff(t, "mining_fatigue", 10, 2);
      eff(t, "weakness", 10, 1);
      if (k % 20 === 0) api.hurt(t, p2 ? 4 : 3, boss, "drowning"); // (water breathing keeps you safe)
    }, k);
  }
}

// --- Killer B -----------------------------------------------------------------
const RAPS = [
  "♪ Eight tails, one host — I'm the one you fear the most! ♪",
  "♪ Seven swords spinning, no chance you're winning! ♪",
  "♪ Lightning in my fist — you're the next on my list! ♪",
  "♪ Ink in your eyes, now ain't that a surprise! ♪",
  "♪ You're too slow, let the Octopus show! ♪",
  "♪ Cloud Village pride — there's nowhere to hide! ♪",
];

function rap(boss) {
  const line = RAPS[Math.floor(Math.random() * RAPS.length)];
  for (const p of playersAround(boss.dimension, boss.location, 24)) p.onScreenDisplay?.setActionBar(`§eKiller B: §f${line}`);
}

// Lightning Release: Lariat — a charging arm wrapped in lightning.
function lariat(boss, t, p2) {
  sfx(boss.dimension, "aegis.thunder", boss.location, 1.2, 1.4);
  api.particle(boss.dimension, "aegis:lightning_burst", chest(boss));
  dashStrike(boss, t, BOLT, p2 ? 22 : 17, 10, "animation.aegis.lightning_burst", 3.8);
}

// Acrobat: seven swords spinning in a whirlwind of cuts.
function swordDance(boss, p2) {
  api.anim(boss, "animation.aegis.sword_spin");
  for (let k = 0; k < 3; k++) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      for (let a = 0; a < 6; a++) api.particle(boss.dimension, "aegis:slash", add(boss.location, { x: Math.cos(a + k) * 2.4, y: 1.1, z: Math.sin(a + k) * 2.4 }), [0.9, 0.9, 1]);
      sfx(boss.dimension, "aegis.slash", boss.location, 1.2, 1.2 + k * 0.1);
      blast(boss, boss.location, 4.2, p2 ? 9 : 7, 1.0);
    }, 4 + k * 6);
  }
}

// Octopus ink: blinds and slows whoever it splashes.
function inkShot(boss, t) {
  api.anim(boss, "animation.aegis.jutsu_breath");
  sfx(boss.dimension, "aegis.water", boss.location, 1.2, 0.6);
  system.runTimeout(() => api.isValid(boss) && api.isValid(t) && shoot(boss, t, {
    noOrb: true, speed: 1.3, maxAge: 30, damage: 7, radius: 3.2, knock: 0.6, fire: 0, trail: "aegis:shadow", burst: "aegis:smoke_puff",
    color: [0.08, 0.08, 0.12], hitRadius: 1.6, power: 0.6, sound: "aegis.water", effects: [["blindness", 60, 0], ["slowness", 60, 1]] }), 8);
}

function bijuuBomb(boss, t, color) {
  api.anim(boss, "animation.aegis.both_palms");
  chargeFx(boss, color, 20, "aegis.charge");
  system.runTimeout(() => api.isValid(boss) && api.isValid(t) && shoot(boss, t, {
    speed: 1.2, maxAge: 50, damage: 24, radius: 5.5, knock: 2.5, fire: 0, orbEvent: "aegis:as_bijuudama",
    trail: "aegis:beast_aura", burst: "aegis:beast_burst", color, hitRadius: 2, power: 2.5 }), 20);
}

// Phase 2 — Octopus Hold: eight tentacles burst up round the target and slam down.
function octopusHold(boss, t) {
  const dim = boss.dimension;
  const spot = { ...t.location };
  api.anim(boss, "animation.aegis.earth_slam");
  sfx(dim, "aegis.charge", boss.location, 1.6, 0.7);
  showTitle(t, "§dOctopus Hold", { subtitle: "§7Tentacles all around you — move!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
  for (let k = 0; k < 20; k += 4) {
    system.runTimeout(() => {
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4;
        api.particle(dim, "aegis:cine_pillar", add(spot, { x: Math.cos(ang) * 3, y: k / 6, z: Math.sin(ang) * 3 }), GYUKI);
      }
    }, k);
  }
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    impactFx(dim, spot, GYUKI, 2.5);
    sfx(dim, "aegis.impact", spot, 2, 0.5);
    shake(dim, spot, 0.6, 0.8, 24);
    blast(boss, spot, 3.6, 18, 1.4, (e) => eff(e, "slowness", 60, 2));
  }, 22);
}

// --- Ōnoki --------------------------------------------------------------------
// He's not as young as he was: after a big jutsu his back sometimes gives out — a moment to strike.
function backPain(boss, chance) {
  if (Math.random() > chance) return;
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    eff(boss, "slowness", 60, 10);
    eff(boss, "weakness", 60, 2);
    sfx(boss.dimension, "aegis.impact", boss.location, 0.6, 1.6);
    for (const p of playersAround(boss.dimension, boss.location, 24)) p.onScreenDisplay?.setActionBar("§6Ōnoki: §fOw, ow — my back! §7(now's your chance)");
  }, 70);
}

// Added Weight Rock: a touch of earth chakra makes the target so heavy they can barely move.
function addedWeight(boss, t) {
  api.anim(boss, "animation.aegis.palm_thrust");
  chargeFx(boss, ROCK, 8, "aegis.earth");
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    api.particle(t.dimension, "aegis:earth_burst", t.location);
    api.particle(t.dimension, "aegis:cine_ring", t.location, ROCK);
    api.hurt(t, 6, boss);
    for (const [id, amp] of [["slowness", 4], ["mining_fatigue", 2], ["weakness", 1]]) eff(t, id, 120, amp);
    showTitle(t, "§6Added Weight Rock", { subtitle: "§7You're suddenly impossibly heavy!", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 5 });
  }, 10);
}

function rockFist(boss, t, p2) {
  api.anim(boss, "animation.aegis.palm_thrust");
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    const d = dirTo(boss, t);
    api.hurt(t, p2 ? 18 : 14, boss);
    api.knockback(t, d.x, d.z, 4.0, 0.7);
    impactFx(boss.dimension, t.location, ROCK, 1.5);
    api.particle(boss.dimension, "aegis:earth_burst", chest(t));
  }, 6);
}

// Earth spikes burst out of the ground in a line toward the target and toss whoever they catch.
function rockLine(boss, t, p2) {
  const dim = boss.dimension;
  const o = { ...boss.location };
  const d = dirTo(boss, t);
  api.anim(boss, "animation.aegis.earth_slam");
  chargeFx(boss, ROCK, 10, "aegis.earth");
  const hit = new Set();
  for (let i = 2; i <= 16; i += 2) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      const at = add(o, { x: d.x * i, y: 0, z: d.z * i });
      for (let y = 0; y < 2.5; y += 0.8) api.particle(dim, "aegis:earth_burst", add(at, { x: 0, y, z: 0 }));
      api.particle(dim, "aegis:dust", at);
      if (i % 4 === 0) sfx(dim, "aegis.earth", at, 1, 0.8);
      blast(boss, at, 2.1, p2 ? 15 : 12, 0, (e) => {
        hit.add(e.id);
        api.knockback(e, 0, 0, 0, 1.0);
      }, hit);
    }, 12 + i);
  }
}

// Flight: he floats up out of reach and rains rock down on the target.
function flightBarrage(boss, t, p2) {
  sfx(boss.dimension, "aegis.whoosh", boss.location, 1.4, 0.8);
  eff(boss, "levitation", 22, 4);
  system.runTimeout(() => eff(boss, "slow_falling", 80, 0), 22);
  for (let k = 0; k < (p2 ? 4 : 3); k++) {
    system.runTimeout(() => {
      if (!api.isValid(boss) || !api.isValid(t)) return;
      api.anim(boss, "animation.aegis.palm_thrust");
      shoot(boss, t, { noOrb: true, speed: 1.4, maxAge: 30, damage: 9, radius: 2.8, knock: 1.2, fire: 0, trail: "aegis:dust", burst: "aegis:earth_burst",
        color: ROCK, hitRadius: 1.4, power: 0.8, sound: "aegis.earth" });
    }, 24 + k * 7);
  }
}

// Phase 2 — Dust Release, Detachment of the Primitive World: a cube of light grows round the target, then erases what's in it.
const CUBE = [-1, 0, 1].flatMap((x) => [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((z) => [x, y, z])))
  .filter((p) => p.filter((v) => v !== 0).length >= 2); // the corners and the middle of each edge
function dustRelease(boss, t) {
  const dim = boss.dimension;
  const spot = add(t.location, { x: 0, y: 1, z: 0 });
  api.anim(boss, "animation.aegis.both_palms");
  chargeFx(boss, DUST, 30, "aegis.charge");
  warnAll(boss, spot, 32, "§fDust Release", "§7Get out of the cube — now!");
  for (let k = 0; k < 36; k += 3) {
    system.runTimeout(() => {
      const h = 0.6 + (k / 36) * 2.2;
      for (const [x, y, z] of CUBE) api.particle(dim, "aegis:cine_bolt", add(spot, { x: x * h, y: y * h, z: z * h }), DUST);
      api.particle(dim, "aegis:cine_ring", add(spot, { x: 0, y: -1, z: 0 }), DUST);
    }, k);
  }
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    for (let y = -1; y < 4; y += 1) api.particle(dim, "aegis:cine_pillar", add(spot, { x: 0, y, z: 0 }), DUST);
    impactFx(dim, spot, DUST, 3);
    sfx(dim, "aegis.lightning", spot, 2.5, 1.6);
    shake(dim, spot, 0.8, 1, 32);
    blast(boss, spot, 3.4, 30, 0.3);
  }, 38);
}

// --- Hanzō --------------------------------------------------------------------
// The salamander's poison: a cloud of venom settles where the target stands.
function poisonMist(boss, t, p2) {
  const dim = boss.dimension;
  const spot = { ...t.location };
  const r = p2 ? 5 : 3.5;
  api.anim(boss, "animation.aegis.jutsu_breath");
  sfx(dim, "aegis.wind", boss.location, 1.2, 0.5);
  showTitle(t, "§5Salamander Poison", { subtitle: "§7Don't breathe the mist!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
  for (let k = 0; k < 100; k += 10) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      for (let a = 0; a < 6; a++) api.particle(dim, "aegis:beast_mist", add(spot, { x: Math.cos(a + k) * r * 0.6, y: 0.5, z: Math.sin(a + k) * r * 0.6 }), VENOM);
      api.particle(dim, "aegis:swamp_bubble", spot);
      for (const e of victims(boss, spot, r)) {
        eff(e, "poison", 50, p2 ? 1 : 0);
        api.hurt(e, 1, boss, "magic");
      }
    }, k);
  }
}

// Kusarigama: the chain wraps the target and drags them in for the sickle.
function chainSickle(boss, t, p2) {
  const dim = boss.dimension;
  api.anim(boss, "animation.aegis.chains_cast");
  sfx(dim, "aegis.whoosh", boss.location, 1.2, 1.2);
  const from = chest(boss);
  const to = chest(t);
  for (let i = 1; i <= 8; i++) system.runTimeout(() => api.particle(dim, "aegis:slash", lerp(from, to, i / 8), [0.7, 0.7, 0.76]), i);
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    const d = dirTo(t, boss);
    api.knockback(t, d.x, d.z, 2.6, 0.35);
    api.hurt(t, 6, boss);
    eff(t, "poison", 60, 0);
    sfx(dim, "aegis.impact", t.location, 1, 1.4);
    if (t.typeId === "minecraft:player") t.onScreenDisplay?.setActionBar("§5The chain drags you in!");
  }, 9);
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    api.anim(boss, "animation.aegis.sword_slash");
    if (flat(t.location, boss.location) < 4.5) {
      api.hurt(t, p2 ? 12 : 9, boss);
      api.particle(dim, "aegis:slash", chest(t), VENOM);
      sfx(dim, "aegis.slash", t.location, 1, 1.1);
    }
  }, 18);
}

function sickleSlash(boss, p2) {
  api.anim(boss, "animation.aegis.sword_slash");
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    api.particle(boss.dimension, "aegis:slash", chest(boss), VENOM);
    sfx(boss.dimension, "aegis.slash", boss.location, 1.2, 0.9);
    blast(boss, boss.location, 3.8, p2 ? 15 : 12, 1.6, (e) => eff(e, "poison", 60, p2 ? 1 : 0));
  }, 5);
}

// Venom spat in a fan.
function poisonFan(boss, t, p2) {
  api.anim(boss, "animation.aegis.jutsu_breath");
  chargeFx(boss, VENOM, 10);
  system.runTimeout(() => api.isValid(boss) && api.isValid(t) && fan(boss, t, p2 ? 5 : 3, 0.18, {
    noOrb: true, speed: 1.2, maxAge: 30, damage: 7, radius: 2.4, knock: 0.6, fire: 0, trail: "aegis:beast_mist", burst: "aegis:smoke_puff",
    color: VENOM, hitRadius: 1.4, power: 0.6, sound: "aegis.wind", effects: [["poison", 80, 1]] }), 10);
}

// Phase 2 — Venom Rain: poison falls like rain all around him.
function venomRain(boss) {
  const dim = boss.dimension;
  const c = { ...boss.location };
  api.anim(boss, "animation.aegis.sword_raise");
  sfx(dim, "aegis.charge", c, 1.6, 0.6);
  warnAll(boss, c, 24, "§5Venom Rain", "§7Get out from under the cloud!");
  for (let k = 0; k < 80; k += 4) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      for (let n = 0; n < 6; n++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * 7;
        api.particle(dim, "aegis:cine_bolt", add(c, { x: Math.cos(a) * rr, y: 3 + Math.random() * 3, z: Math.sin(a) * rr }), VENOM);
      }
      if (k % 16 === 0) api.particle(dim, "aegis:beast_mist", add(c, { x: 0, y: 5, z: 0 }), VENOM);
      if (k % 12 === 0) {
        for (const e of victims(boss, c, 7)) {
          api.hurt(e, 3, boss, "magic");
          eff(e, "poison", 60, 1);
        }
      }
    }, 12 + k);
  }
}

// --- Madara ------------------------------------------------------------------
// Great Fire Annihilation: a wall of flame in a wide fan.
function fireAnnihilation(boss, t, p2) {
  api.anim(boss, "animation.aegis.phoenix_breath");
  chargeFx(boss, [1, 0.45, 0.1], 16, "aegis.charge");
  for (const p of playersAround(boss.dimension, boss.location, 32)) showTitle(p, "§cGreat Fire Annihilation", { subtitle: "§7Get behind cover!", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 5 });
  system.runTimeout(() => {
    if (!api.isValid(boss) || !api.isValid(t)) return;
    sfx(boss.dimension, "aegis.fire", boss.location, 2.5, 0.5);
    const d = dirTo(boss, t);
    const n = p2 ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 0.16;
      const dir = { x: d.x * Math.cos(a) - d.z * Math.sin(a), y: -0.03, z: d.x * Math.sin(a) + d.z * Math.cos(a) };
      api.launchProjectile(boss, add(boss.getHeadLocation(), dir), dir, { speed: 0.9, maxAge: 40, damage: 7, radius: 2.4, knock: 1.1, fire: 5, ignoreFamily: "ninja" });
    }
  }, 16);
}

// Wood Release: roots burst out of the ground in a line toward the target and bind whoever they catch.
function woodLine(boss, t) {
  api.anim(boss, "animation.aegis.earth_slam");
  chargeFx(boss, [0.4, 0.8, 0.3], 12, "aegis.seal");
  const o = { ...boss.location };
  const d = dirTo(boss, t);
  const dim = boss.dimension;
  const caught = new Set(); // the roots grab each target once
  for (let i = 2; i <= 16; i += 2) system.runTimeout(() => api.particle(dim, "aegis:cine_ring", add(o, { x: d.x * i, y: 0.1, z: d.z * i }), [0.4, 0.8, 0.3]), i);
  for (let i = 2; i <= 16; i += 2) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      const at = add(o, { x: d.x * i, y: 0, z: d.z * i });
      for (let y = 0; y < 3; y += 0.7) api.particle(dim, "aegis:wood_burst", add(at, { x: 0, y, z: 0 }), WOOD);
      api.particle(dim, "aegis:dust", at);
      if (i % 4 === 0) sfx(dim, "aegis.impact", at, 1, 0.6);
      blast(boss, at, 2.2, 13, 0.6, (e) => {
        caught.add(e.id);
        eff(e, "slowness", 50, 6);
        if (e.typeId === "minecraft:player") e.onScreenDisplay?.setActionBar("§2Wood Release — the roots bind you!");
      }, caught);
    }, 20 + i);
  }
}

// Tengai Shinsei: a meteor falls on the target's position. Telegraphed for 3 seconds.
function meteor(boss, t) {
  const dim = boss.dimension;
  const spot = { ...t.location };
  api.anim(boss, "animation.aegis.sword_raise");
  sfx(dim, "aegis.charge", boss.location, 2.5, 0.5);
  for (const p of playersAround(dim, spot, 48)) showTitle(p, "§4Tengai Shinsei", { subtitle: "§7A meteor is falling — RUN!", fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
  const sky = add(spot, { x: 14, y: 34, z: 10 });
  for (let k = 0; k < 60; k += 3) {
    system.runTimeout(() => {
      const f = k / 60;
      const at = { x: sky.x + (spot.x - sky.x) * f, y: sky.y + (spot.y - sky.y) * f, z: sky.z + (spot.z - sky.z) * f };
      api.particle(dim, "aegis:cine_flame", at, [1, 0.45, 0.1]);
      api.particle(dim, "aegis:beast_aura", at, [0.5, 0.4, 0.35]);
      api.particle(dim, "aegis:cine_debris", at, [0.4, 0.35, 0.3]);
      if (k % 6 === 0) api.particle(dim, "aegis:cine_ring", spot, [1, 0.3, 0.15]);
    }, k);
  }
  system.runTimeout(() => sfx(dim, "aegis.whoosh", spot, 3, 0.4), 40);
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    impactFx(dim, spot, [1, 0.5, 0.2], 4);
    for (let y = 0; y < 10; y += 2) api.particle(dim, "aegis:cine_pillar", add(spot, { x: 0, y, z: 0 }), [1, 0.5, 0.2]);
    sfx(dim, "random.explode", spot, 4, 0.5);
    shake(dim, spot, 1, 2, 40);
    blast(boss, spot, 8, 30, 3, (e) => {
      try {
        e.setOnFire(5, true);
      } catch {
        /* ignore */
      }
    });
  }, 60);
}

// Susanoo blade: a giant chakra sword comes down on the target.
function susanooSlash(boss, t, p2) {
  api.anim(boss, "animation.aegis.sword_slash");
  const spot = { ...t.location };
  api.particle(boss.dimension, "aegis:cine_ring", spot, [0.35, 0.45, 1]);
  sfx(boss.dimension, "aegis.slash", boss.location, 1.5, 0.6);
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    for (let y = 0; y < 6; y += 1.5) api.particle(boss.dimension, "aegis:susanoo_flame", add(spot, { x: 0, y, z: 0 }), [0.35, 0.45, 1]);
    api.particle(boss.dimension, "aegis:slash", add(spot, { x: 0, y: 1.2, z: 0 }), [0.35, 0.45, 1]);
    impactFx(boss.dimension, spot, [0.35, 0.45, 1], 2);
    blast(boss, spot, 3.5, p2 ? 22 : 16, 2);
  }, 10);
}

// The reanimated body reforms once from the brink of death.
function edoReform(boss) {
  reformed.add(boss.id);
  const dim = boss.dimension;
  try {
    const h = boss.getComponent("minecraft:health");
    h.setCurrentValue(h.effectiveMax * 0.45);
  } catch {
    /* ignore */
  }
  for (let k = 0; k < 30; k += 3) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      api.particle(dim, "aegis:slash", add(boss.location, { x: (Math.random() - 0.5) * 2, y: Math.random() * 2, z: (Math.random() - 0.5) * 2 }), [0.8, 0.78, 0.74]);
      api.particle(dim, "aegis:dust", boss.location);
    }, k);
  }
  sfx(dim, "aegis.seal", boss.location, 2, 0.6);
  for (const p of playersAround(dim, boss.location, 48)) {
    showTitle(p, "§8The body reforms…", { subtitle: "§7Ash and paper rebuild the reanimated Madara", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
  }
}

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
  if (id === "sasuke" || id === "madara") {
    const model = api.spawnFx(boss.dimension, "aegis:susanoo", undefined, boss.location);
    if (model) susanoo.set(boss.id, model);
  }
  if (id === "gaara") {
    // the Shukaku Shield: a wall of sand rises round him
    for (let a = 0; a < 12; a++) api.particle(boss.dimension, "aegis:earth_burst", add(boss.location, { x: Math.cos(a / 1.9) * 2, y: 0.5, z: Math.sin(a / 1.9) * 2 }));
    sfx(boss.dimension, "dig.sand", boss.location, 2, 0.5);
  }
  if (id === "zabuza") clones(boss, L.skin, "§bZabuza §7(Water Clone)", 2, "aegis:water_splash");
  if (id === "killer_bee") eff(boss, "regeneration", 200, 1); // the Eight-Tails' chakra
  if (id === "hanzo") {
    // a burst of venom
    for (let a = 0; a < 8; a++) api.particle(boss.dimension, "aegis:beast_mist", add(boss.location, { x: Math.cos(a) * 2.5, y: 0.8, z: Math.sin(a) * 2.5 }), VENOM);
    blast(boss, boss.location, 5, 8, 1.5, (e) => eff(e, "poison", 100, 1));
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
  if (id === "madara" && hp <= 0.12 && !reformed.has(boss.id)) edoReform(boss);
  if (phase2.has(boss.id)) aura(boss, L.color, id === "naruto" || id === "killer_bee");
  if (id === "hanzo") {
    try {
      if (boss.getEffect("poison")) boss.removeEffect("poison"); // the salamander's master is immune to its venom
    } catch {
      /* ignore */
    }
    // Salamander's Venom: in the second phase, poison seeps from him onto anyone close
    if (phase2.has(boss.id)) for (const e of victims(boss, boss.location, 2.8)) eff(e, "poison", 40, 0);
  }
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
        showTitle(p, L.name, { subtitle: L.entrance ?? "§7has appeared!", fadeInDuration: 3, stayDuration: 40, fadeOutDuration: 10 });
      }
    }, 3);
  });

  // Gaara — Shield of Sand: the sand often blocks a blow outright (more often behind the Shukaku Shield).
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (hurtEntity.typeId !== "aegis:legend" || damage <= 0) return;
    try {
      if (hurtEntity.getDynamicProperty("aegis:member") !== "gaara") return;
      if (Math.random() > (phase2.has(hurtEntity.id) ? 0.4 : 0.25)) return;
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
    } catch {
      return;
    }
    api.particle(hurtEntity.dimension, "aegis:earth_burst", chest(hurtEntity));
    api.particle(hurtEntity.dimension, "aegis:cine_ring", hurtEntity.location, SAND);
    sfx(hurtEntity.dimension, "dig.sand", hurtEntity.location, 1.2, 0.8);
    const by = damageSource?.damagingEntity;
    if (by?.typeId === "minecraft:player") by.onScreenDisplay?.setActionBar("§6The sand blocks your attack!");
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
    reformed.delete(deadEntity.id);
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
