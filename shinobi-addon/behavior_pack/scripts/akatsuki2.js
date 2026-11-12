// The rest of the Akatsuki: Pain, Konan, Hidan (with his Jashin-ritual second form), Kakuzu, Sasori, Zetsu and Tobi.
// enemies.js merges MORE_MEMBER_AI into its MEMBER_AI table; initAkatsuki2 adds their passives
// (Hidan's curse & immortality, Kakuzu's hearts, Tobi's Kamui intangibility).

import { world, system } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { impactFx, sfx, shake, chargeFx } from "./cinematic.js";

let api;
const SKIN = { hidan: 23, hidan_jashin: 24, zetsu: 27 };
const curse = new Map(); // hidan id -> { target, until }
const ritual = new Map(); // hidan id -> end tick
const immortalUsed = new Set();

const member = (e) => {
  try {
    return e.getDynamicProperty("aegis:member");
  } catch {
    return undefined;
  }
};
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const up = (a, h) => ({ x: a.x, y: a.y + h, z: a.z });
const chest = (e) => up(e.location, 1.2);
const flatDir = (from, to) => api.norm({ x: to.location.x - from.location.x, y: 0, z: to.location.z - from.location.z });

function eff(e, id, ticks, amp = 0, show = true) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: show });
  } catch {
    /* ignore */
  }
}

function playersNear(dim, loc, r) {
  try {
    return dim.getPlayers({ location: loc, maxDistance: r }).filter((p) => {
      const gm = String(p.getGameMode()).toLowerCase();
      return gm !== "creative" && gm !== "spectator";
    });
  } catch {
    return [];
  }
}

function throwAt(e, t, opts) {
  const head = e.getHeadLocation();
  const aim = api.norm(api.sub(up(t.location, 1), head));
  api.launchProjectile(e, add(head, api.scale(aim, 1.2)), aim, { ignoreFamily: "ninja", ...opts });
}

function hp(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return h.currentValue / h.effectiveMax;
  } catch {
    return 1;
  }
}

function heal(e, frac) {
  try {
    const h = e.getComponent("minecraft:health");
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + h.effectiveMax * frac));
  } catch {
    /* ignore */
  }
}

function minions(e, tag, skin, name, n, life) {
  const have = e.dimension.getEntities({ tags: [tag] }).length;
  for (let i = 0; i < n - have; i++) {
    const a = Math.random() * Math.PI * 2;
    const at = add(e.location, { x: Math.cos(a) * 2.5, y: 0, z: Math.sin(a) * 2.5 });
    try {
      const c = e.dimension.spawnEntity("aegis:hostile_ninja", at);
      c.addTag(tag);
      c.setDynamicProperty("aegis:role", "rogue");
      c.setDynamicProperty("aegis:no_xp", true);
      c.setProperty("aegis:skin", skin);
      c.nameTag = name;
      c.triggerEvent("aegis:persist");
      api.particle(e.dimension, "aegis:smoke_puff", at);
      system.runTimeout(() => {
        if (api.isValid(c)) {
          api.particle(c.dimension, "aegis:smoke_puff", c.location);
          c.remove();
        }
      }, life);
    } catch {
      /* ignore */
    }
  }
}

// ===========================================================================
export const MORE_MEMBER_AI = {
  // ---- Pain (Deva Path) ----
  pain(e, t, dist) {
    const r = Math.random();
    if (hp(e) < 0.5 && r < 0.3) {
      // Chibaku Tensei: lift the target into the air with a sphere of debris, then crush them back down
      api.anim(e, "animation.aegis.almighty_push");
      showTitle(t, "§5Chibaku Tensei", { subtitle: "§7The earth itself rises around you…", fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
      sfx(e.dimension, "aegis.charge", t.location, 2, 0.6);
      eff(t, "levitation", 40, 3);
      for (let k = 0; k < 40; k += 4) system.runTimeout(() => {
        if (!api.isValid(t)) return;
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          const b = Math.random() * Math.PI;
          api.particle(t.dimension, "aegis:cine_debris", add(t.location, { x: Math.cos(a) * Math.sin(b) * 3, y: 1 + Math.cos(b) * 3, z: Math.sin(a) * Math.sin(b) * 3 }), [0.55, 0.5, 0.45]);
        }
        api.particle(t.dimension, "aegis:dust", t.location);
      }, k);
      system.runTimeout(() => {
        if (!api.isValid(t) || !api.isValid(e)) return;
        try {
          t.removeEffect("levitation");
        } catch {
          /* ignore */
        }
        api.knockback(t, 0, 0, 0, -3);
        impactFx(t.dimension, t.location, [0.6, 0.4, 0.9], 3);
        api.hurt(t, 18, e);
      }, 44);
      return 200;
    }
    if (dist < 7 || r < 0.35) {
      // Shinra Tensei: everything is blasted away
      api.anim(e, "animation.aegis.almighty_push");
      chargeFx(e, [0.75, 0.6, 1], 8, "aegis.charge");
      system.runTimeout(() => {
        if (!api.isValid(e)) return;
        impactFx(e.dimension, e.location, [0.75, 0.6, 1], 3);
        api.particle(e.dimension, "aegis:cine_ring", e.location, [0.85, 0.75, 1]);
        sfx(e.dimension, "aegis.boom", e.location, 2, 0.8);
        shake(e.dimension, e.location, 0.8, 1, 24);
        for (const p of playersNear(e.dimension, e.location, 9)) {
          const d = flatDir(e, p);
          api.hurt(p, 12, e);
          api.knockback(p, d.x, d.z, 3.6, 0.9);
          showTitle(p, "§dShinra Tensei", { subtitle: "§7Almighty Push", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 6 });
        }
      }, 8);
      return 110;
    }
    // Bansho Ten'in: yank the target in, then strike
    api.anim(e, "animation.aegis.pull");
    showTitle(t, "§dBanshō Ten'in", { subtitle: "§7Universal Pull", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 6 });
    const d = flatDir(t, e);
    api.knockback(t, d.x, d.z, Math.min(4.5, dist * 0.32), 0.35);
    for (let i = 0; i <= 10; i++) api.particle(e.dimension, "aegis:slash", add(chest(e), api.scale(api.sub(chest(t), chest(e)), i / 10)), [0.85, 0.75, 1]);
    system.runTimeout(() => {
      if (!api.isValid(e) || !api.isValid(t)) return;
      api.anim(e, "animation.aegis.palm_thrust");
      api.hurt(t, 10, e);
      const k = flatDir(e, t);
      api.knockback(t, k.x, k.z, 2, 0.5);
      impactFx(e.dimension, t.location, [0.75, 0.6, 1], 1.5);
    }, 12);
    return 100;
  },

  // ---- Konan ----
  konan(e, t, dist) {
    const r = Math.random();
    if (r < 0.3) {
      // Paper wings: rise up and rain paper bombs
      api.anim(e, "animation.aegis.both_palms");
      eff(e, "levitation", 26, 1, false);
      eff(e, "slow_falling", 120, 0, false);
      for (let k = 0; k < 30; k += 3) system.runTimeout(() => api.isValid(e) && api.particle(e.dimension, "aegis:slash", up(e.location, 1.3), [1, 1, 1]), k);
      for (let i = 0; i < 4; i++) {
        system.runTimeout(() => {
          if (!api.isValid(e) || !api.isValid(t)) return;
          throwAt(e, t, { speed: 1.1, maxAge: 40, damage: 8, radius: 3, knock: 0.8, fire: 0, trail: "aegis:slash", burst: "aegis:fire_burst", color: [1, 1, 1], hitRadius: 1.3, sound: "random.explode" });
        }, 26 + i * 6);
      }
      return 120;
    }
    if (r < 0.6) {
      // Paper butterfly swarm
      showTitle(t, "§9Paper Butterflies", { subtitle: "§7A storm of paper cuts around you", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 6 });
      sfx(t.dimension, "aegis.whoosh", t.location, 1.4, 1.5);
      for (let k = 0; k < 80; k += 10) {
        system.runTimeout(() => {
          if (!api.isValid(t) || !api.isValid(e)) return;
          for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            api.particle(t.dimension, "aegis:slash", add(t.location, { x: Math.cos(a) * 1.2, y: 0.5 + Math.random() * 1.5, z: Math.sin(a) * 1.2 }), [0.85, 0.75, 1]);
          }
          api.hurt(t, 2, e);
          eff(t, "blindness", 25, 0);
        }, k);
      }
      return 130;
    }
    // Paper shuriken storm
    api.anim(e, "animation.aegis.palm_thrust");
    for (let i = 0; i < 6; i++) {
      system.runTimeout(() => {
        if (!api.isValid(e) || !api.isValid(t)) return;
        const head = e.getHeadLocation();
        const aim = api.norm(api.sub(up(t.location, 1), head));
        const s = (Math.random() - 0.5) * 0.3;
        const dir = { x: aim.x * Math.cos(s) - aim.z * Math.sin(s), y: aim.y, z: aim.x * Math.sin(s) + aim.z * Math.cos(s) };
        api.launchProjectile(e, add(head, dir), dir, { noOrb: true, speed: 1.8, maxAge: 18, damage: 4, radius: 1.2, knock: 0.3, fire: 0,
          trail: "aegis:slash", burst: "aegis:slash", color: [1, 1, 1], hitRadius: 1.1, ignoreFamily: "ninja", power: 0.3 });
      }, i * 2);
    }
    return 60;
  },

  // ---- Hidan ----
  hidan(e, t, dist) {
    const c = curse.get(e.id);
    const cursed = c && c.target === t.id && c.until > system.currentTick;
    if (cursed && !ritual.has(e.id) && Math.random() < 0.6) {
      startRitual(e, t);
      return 200;
    }
    if (ritual.has(e.id)) {
      // inside the circle he stabs himself — and the wound appears on his victim
      api.anim(e, "animation.aegis.sword_thrust");
      api.particle(e.dimension, "aegis:slash", chest(e), [0.8, 0.05, 0.05]);
      sfx(e.dimension, "aegis.slash", e.location, 1.2, 0.7);
      api.hurt(e, 4, undefined, "magic");
      return 40;
    }
    if (dist < 4.5) {
      // triple-bladed scythe sweep; a cut draws the blood he needs for the ritual
      api.anim(e, "animation.aegis.sword_spin");
      system.runTimeout(() => {
        if (!api.isValid(e)) return;
        for (const p of playersNear(e.dimension, e.location, 4.5)) {
          api.hurt(p, 9, e);
          api.particle(p.dimension, "aegis:slash", chest(p), [0.8, 0.05, 0.05]);
          curse.set(e.id, { target: p.id, until: system.currentTick + 400 });
          p.sendMessage("§4Hidan licks your blood from his scythe… §7(Jashin ritual incoming!)");
        }
      }, 6);
      return 60;
    }
    // throws the scythe on its cable
    api.anim(e, "animation.aegis.throw_overhead");
    throwAt(e, t, { noOrb: true, speed: 1.6, maxAge: 18, damage: 8, radius: 1.5, knock: 0.5, fire: 0, trail: "aegis:slash", burst: "aegis:slash",
      color: [0.8, 0.05, 0.05], hitRadius: 1.2, power: 0.5,
      onExplode: () => api.isValid(t) && curse.set(e.id, { target: t.id, until: system.currentTick + 400 }) });
    return 70;
  },

  // ---- Kakuzu ----
  kakuzu(e, t, dist) {
    const r = Math.random();
    if (r < 0.34) {
      // Fire mask: Zukokku
      api.anim(e, "animation.aegis.jutsu_breath");
      chargeFx(e, [1, 0.45, 0.1], 10);
      system.runTimeout(() => api.isValid(e) && api.isValid(t) && throwAt(e, t, { speed: 1.1, damage: 13, radius: 4, knock: 1.2, fire: 6 }), 10);
      return 90;
    }
    if (r < 0.67 && dist < 12) {
      // Wind mask: Pressure Damage
      api.anim(e, "animation.aegis.both_palms");
      const dir = flatDir(e, t);
      for (let d = 1; d <= 11; d++) api.particle(e.dimension, "aegis:wind_gust", add(up(e.location, 1.3), api.scale(dir, d)));
      sfx(e.dimension, "aegis.whoosh", e.location, 2, 0.6);
      for (const p of playersNear(e.dimension, e.location, 12)) {
        const v = flatDir(e, p);
        if (v.x * dir.x + v.z * dir.z < 0.6) continue;
        api.hurt(p, 10, e);
        api.knockback(p, v.x, v.z, 3, 0.5);
      }
      return 100;
    }
    // Lightning mask: False Darkness — a spear of lightning
    api.anim(e, "animation.aegis.chidori_spear");
    system.runTimeout(() => {
      if (!api.isValid(e) || !api.isValid(t)) return;
      const a = chest(e);
      const b = chest(t);
      for (let i = 0; i <= 16; i++) api.particle(e.dimension, "aegis:chidori", add(a, api.scale(api.sub(b, a), i / 16)));
      api.particle(t.dimension, "aegis:lightning_burst", b);
      sfx(e.dimension, "aegis.lightning", t.location, 1.6, 1);
      api.hurt(t, 12, e, "lightning");
      eff(t, "slowness", 40, 3);
    }, 12);
    return 100;
  },

  // ---- Sasori ----
  sasori(e, t, dist) {
    const r = Math.random();
    if (r < 0.3) {
      // Puppet army
      api.anim(e, "animation.aegis.hand_signs");
      sfx(e.dimension, "aegis.seal", e.location, 1.2, 1.2);
      for (let k = 0; k < 20; k += 4) system.runTimeout(() => api.isValid(e) && api.particle(e.dimension, "aegis:slash", up(e.location, 1.2), [0.6, 0.85, 1]), k);
      minions(e, `aegis_puppet_${e.id}`, 11, "§cPuppet", 3, 600);
      return 140;
    }
    if (r < 0.55) {
      // Iron Sand: a telegraphed rain of black spikes
      const spot = { ...t.location };
      showTitle(t, "§8Iron Sand", { subtitle: "§7Get out from under it!", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 5 });
      for (let k = 0; k < 24; k += 4) system.runTimeout(() => api.particle(e.dimension, "aegis:cine_ring", spot, [0.25, 0.25, 0.3]), k);
      system.runTimeout(() => {
        if (!api.isValid(e)) return;
        for (let i = 0; i < 18; i++) api.particle(e.dimension, "aegis:slash", add(spot, { x: (Math.random() - 0.5) * 6, y: Math.random() * 3, z: (Math.random() - 0.5) * 6 }), [0.2, 0.2, 0.25]);
        api.particle(e.dimension, "aegis:dust", spot);
        sfx(e.dimension, "aegis.impact", spot, 1.5, 0.8);
        for (const p of playersNear(e.dimension, spot, 3.5)) {
          api.hurt(p, 12, e);
          eff(p, "slowness", 60, 2);
        }
      }, 26);
      return 120;
    }
    // Poisoned senbon
    api.anim(e, "animation.aegis.palm_thrust");
    for (let i = 0; i < 5; i++) {
      system.runTimeout(() => {
        if (!api.isValid(e) || !api.isValid(t)) return;
        throwAt(e, t, { noOrb: true, speed: 1.9, maxAge: 16, damage: 3, radius: 1.2, knock: 0.1, fire: 0, trail: "aegis:slash", burst: "aegis:slash",
          color: [0.55, 0.25, 0.7], hitRadius: 1.0, power: 0.3, effects: [["poison", 100, 1]] });
      }, i * 2);
    }
    return 60;
  },

  // ---- Zetsu ----
  zetsu(e, t, dist) {
    const r = Math.random();
    if (r < 0.35) {
      // Sink into the ground… and come up behind the target
      api.particle(e.dimension, "aegis:dust", e.location);
      api.particle(e.dimension, "aegis:shadow", e.location);
      eff(e, "invisibility", 24, 0, false);
      sfx(e.dimension, "aegis.whoosh", e.location, 1, 0.5);
      system.runTimeout(() => {
        if (!api.isValid(e) || !api.isValid(t)) return;
        const d = t.getViewDirection();
        const h = api.norm({ x: d.x, y: 0, z: d.z });
        try {
          e.teleport(api.sub(t.location, api.scale(h, 2)), { facingLocation: t.location });
        } catch {
          /* ignore */
        }
        api.particle(e.dimension, "aegis:dust", e.location);
        api.anim(e, "animation.aegis.palm_thrust");
        api.hurt(t, 8, e);
      }, 22);
      return 90;
    }
    if (r < 0.6) {
      // Spore clones (White Zetsu)
      api.anim(e, "animation.aegis.clone_seal");
      minions(e, `aegis_spore_${e.id}`, SKIN.zetsu, "§fWhite Zetsu", 2, 500);
      return 130;
    }
    if (dist < 5) {
      // Grab and drain chakra
      api.anim(e, "animation.aegis.pull");
      api.hurt(t, 4, e);
      if (t.typeId === "minecraft:player") {
        api.setChakra(t, api.getChakra(t) - 30);
        t.onScreenDisplay?.setActionBar("§aZetsu drains your chakra!");
      }
      heal(e, 0.03);
      for (let i = 0; i <= 8; i++) api.particle(e.dimension, "aegis:slash", add(chest(t), api.scale(api.sub(chest(e), chest(t)), i / 8)), [0.4, 0.9, 0.4]);
      return 70;
    }
    throwAt(e, t, { noOrb: true, speed: 1.6, maxAge: 18, damage: 5, radius: 1.3, knock: 0.3, fire: 0, trail: "aegis:slash", burst: "aegis:slash", color: [0.4, 0.9, 0.4], hitRadius: 1.1 });
    return 50;
  },

  // ---- Tobi ----
  tobi(e, t, dist) {
    const r = Math.random();
    if (r < 0.35) {
      // Kamui: warp the target away
      const spot = { ...t.location };
      showTitle(t, "§6Kamui", { subtitle: "§7Space twists around you…", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 6 });
      for (let k = 0; k < 18; k += 3) system.runTimeout(() => api.particle(e.dimension, "aegis:cine_swirl", spot, [0.6, 0.3, 0.9]), k);
      sfx(e.dimension, "aegis.charge", spot, 1.4, 1.3);
      system.runTimeout(() => {
        if (!api.isValid(t) || !api.isValid(e)) return;
        if (Math.hypot(t.location.x - spot.x, t.location.z - spot.z) > 2.5) return; // dodged
        const a = Math.random() * Math.PI * 2;
        const to = { x: t.location.x + Math.cos(a) * 9, y: t.location.y + 1, z: t.location.z + Math.sin(a) * 9 };
        try {
          const b1 = t.dimension.getBlock(to);
          const b2 = t.dimension.getBlock(up(to, 1));
          if (b1?.isAir && b2?.isAir) t.teleport(to);
        } catch {
          /* ignore */
        }
        api.particle(t.dimension, "aegis:cine_swirl", t.location, [0.6, 0.3, 0.9]);
        api.hurt(t, 9, e, "magic");
        eff(t, "nausea", 100, 0);
      }, 18);
      return 140;
    }
    if (r < 0.55 && dist > 4) {
      // warps right next to the target
      api.particle(e.dimension, "aegis:cine_swirl", e.location, [0.6, 0.3, 0.9]);
      try {
        const d = flatDir(t, e);
        e.teleport(add(t.location, api.scale(d, 2)), { facingLocation: t.location });
      } catch {
        /* ignore */
      }
      api.particle(e.dimension, "aegis:cine_swirl", e.location, [0.6, 0.3, 0.9]);
      api.anim(e, "animation.aegis.palm_thrust");
      api.hurt(t, 7, e);
      return 60;
    }
    // Great Fireball
    api.anim(e, "animation.aegis.fireball_jutsu");
    chargeFx(e, [1, 0.45, 0.1], 12);
    system.runTimeout(() => api.isValid(e) && api.isValid(t) && throwAt(e, t, { speed: 1.2, damage: 12, radius: 4, knock: 1, fire: 6 }), 12);
    return 90;
  },
};

// ---------------------------------------------------------------------------
// Hidan's Jashin ritual: he draws the circle, turns black and white, and every wound he takes appears on his victim.
// ---------------------------------------------------------------------------
function startRitual(e, t) {
  const end = system.currentTick + 220;
  ritual.set(e.id, end);
  try {
    e.setProperty("aegis:skin", SKIN.hidan_jashin);
  } catch {
    /* ignore */
  }
  api.anim(e, "animation.aegis.power_up");
  impactFx(e.dimension, e.location, [0.8, 0.05, 0.05], 2);
  sfx(e.dimension, "aegis.transform", e.location, 2, 0.7);
  eff(e, "slowness", 220, 2, false);
  showTitle(t, "§4Jashin Ritual", { subtitle: "§7Every wound he takes, you take too!", fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 10 });
  for (const p of playersNear(e.dimension, e.location, 32)) p.sendMessage("§4Hidan has completed the ritual! §7Hurting him now hurts his cursed victim — break his focus or get away!");
  for (let k = 0; k < 220; k += 10) {
    system.runTimeout(() => {
      if (!api.isValid(e) || !ritual.has(e.id)) return;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        api.particle(e.dimension, "aegis:slash", add(e.location, { x: Math.cos(a) * 1.8, y: 0.1, z: Math.sin(a) * 1.8 }), [0.8, 0.05, 0.05]);
      }
      api.particle(e.dimension, "aegis:slash", up(e.location, 0.12), [0.8, 0.05, 0.05]);
    }, k);
  }
  system.runTimeout(() => endRitual(e), 220);
}

function endRitual(e) {
  ritual.delete(e.id);
  curse.delete(e.id); // the blood is spent — he has to cut someone again for another ritual
  if (!api.isValid(e)) return;
  try {
    e.setProperty("aegis:skin", SKIN.hidan);
  } catch {
    /* ignore */
  }
}

export function initAkatsuki2(helpers) {
  api = helpers;

  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (hurtEntity.typeId !== "aegis:akatsuki" || damage <= 0) return;
    const who = member(hurtEntity);
    const attacker = damageSource?.damagingEntity;
    if (who === "hidan") {
      // ritual: the curse carries the wound to the victim
      const c = curse.get(hurtEntity.id);
      if (ritual.has(hurtEntity.id) && c) {
        const victim = world.getEntity(c.target);
        if (victim && api.isValid(victim)) {
          api.hurt(victim, damage, undefined, "magic");
          api.particle(victim.dimension, "aegis:slash", chest(victim), [0.8, 0.05, 0.05]);
          victim.onScreenDisplay?.setActionBar("§4The curse! Hidan's wound opens on your body!");
        }
      }
      // immortal: refuses to die once
      if (hp(hurtEntity) < 0.12 && !immortalUsed.has(hurtEntity.id)) {
        immortalUsed.add(hurtEntity.id);
        heal(hurtEntity, 0.4);
        for (const p of playersNear(hurtEntity.dimension, hurtEntity.location, 32)) p.sendMessage("§4Hidan: §f\"Hah! I'm immortal, you idiot!\"");
        impactFx(hurtEntity.dimension, hurtEntity.location, [0.8, 0.05, 0.05], 1.5);
      }
    } else if (who === "kakuzu") {
      // five hearts: tears out a spare heart when he's about to fall
      const left = Number(hurtEntity.getDynamicProperty("aegis:hearts") ?? 4);
      if (hp(hurtEntity) < 0.15 && left > 0) {
        hurtEntity.setDynamicProperty("aegis:hearts", left - 1);
        heal(hurtEntity, 0.55);
        impactFx(hurtEntity.dimension, hurtEntity.location, [0.3, 0.6, 0.3], 1.5);
        sfx(hurtEntity.dimension, "aegis.roar", hurtEntity.location, 1.5, 1.2);
        for (const p of playersNear(hurtEntity.dimension, hurtEntity.location, 32)) {
          showTitle(p, "§2Kakuzu", { subtitle: `§7consumes a heart… §f${left - 1}§7 left`, fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 8 });
        }
      }
    } else if (who === "tobi" && attacker && Math.random() < 0.4) {
      // Kamui: the attack passes straight through him
      try {
        const h = hurtEntity.getComponent("minecraft:health");
        h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
      } catch {
        /* ignore */
      }
      api.particle(hurtEntity.dimension, "aegis:cine_swirl", hurtEntity.location, [0.6, 0.3, 0.9]);
      if (attacker.typeId === "minecraft:player") attacker.onScreenDisplay?.setActionBar("§6Your attack passed right through him…");
    }
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== "aegis:akatsuki") return;
    curse.delete(deadEntity.id);
    ritual.delete(deadEntity.id);
    immortalUsed.delete(deadEntity.id);
    for (const tag of [`aegis_puppet_${deadEntity.id}`, `aegis_spore_${deadEntity.id}`]) {
      try {
        for (const m of deadEntity.dimension.getEntities({ tags: [tag] })) m.remove();
      } catch {
        /* ignore */
      }
    }
  });
}
