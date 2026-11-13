// Third wave of jutsu scrolls — none of them clan-bound. Sold by the Jutsu Sensei, craftable from a blank scroll.
//   Fire:      Dragon Flame Bullet · Ash Pile Burning
//   Water:     Water Shark Bomb · Hiding in Mist · Exploding Water Shockwave
//   Wind:      Sickle Weasel · Pressure Damage
//   Lightning: Lightning Hound · Lightning Release Armour
//   Earth:     Earth Dragon Bullet · Headhunter Jutsu · Swamp of the Underworld
//   Ninjutsu:  Big Ball Rasengan · Explosive Tag Barrage
//   Taijutsu:  Leaf Hurricane · Dynamic Entry · Front Lotus   (melee: they scale with the Taijutsu stat)
//   Medical:   Chakra Scalpel          Genjutsu: Demonic Illusion — Hell Viewing
// main.js merges these into its JUTSU table (cost, cooldown, chakra and affinity all work like every scroll).

import { world, system, BlockPermutation } from "@minecraft/server";
import { impactFx, sfx, shake, chargeFx } from "./cinematic.js";
import { showTitle } from "./hud.js";
import { isEcho, drain, scriptedHit } from "./dmgutil.js";

let api;
const COL = {
  fire: [1, 0.45, 0.1], water: [0.3, 0.6, 1], wind: [0.75, 1, 0.85], bolt: [0.6, 0.85, 1], earth: [0.55, 0.42, 0.28],
  chakra: [0.45, 0.8, 1], scalpel: [0.45, 1, 0.75], genjutsu: [0.6, 0.2, 0.8], paper: [0.95, 0.9, 0.75], mist: [0.86, 0.9, 0.95],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eff(e, id, ticks, amp = 0, show = false) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: show });
  } catch {
    /* ignore */
  }
}
const up = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });
const flat = (d) => api.norm({ x: d.x, y: 0, z: d.z });
const fwdOf = (p) => flat(p.getViewDirection());
const at = (o, f, dist, side = 0, h = 0) => ({ x: o.x + f.x * dist - f.z * side, y: o.y + h, z: o.z + f.z * dist + f.x * side });
const isBig = (e) => e.typeId === "aegis:legend" || e.typeId === "aegis:akatsuki" || !!e.matches?.({ families: ["tailed_beast"] });
const rotate = (d, a) => ({ x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y, z: d.x * Math.sin(a) + d.z * Math.cos(a) });

function lookTarget(player, range) {
  try {
    return player.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
  } catch {
    return undefined;
  }
}

function foes(player, pos, r) {
  try {
    return player.dimension.getEntities({ location: pos, maxDistance: r }).filter((e) => api.canBeHit(e, player));
  } catch {
    return [];
  }
}

// Room for a body (feet and head) at pos?
function open(dim, pos) {
  try {
    const a = dim.getBlock(pos);
    const b = dim.getBlock(up(pos, 1));
    return !!a && !!b && (a.isAir || a.isLiquid) && (b.isAir || b.isLiquid);
  } catch {
    return false;
  }
}

function setFire(e, s) {
  try {
    e.setOnFire(s, true);
  } catch {
    /* ignore */
  }
}

function cmd(p, c) {
  try {
    p.runCommand(c);
  } catch {
    /* ignore */
  }
}

// ===========================================================================
// FIRE
// ===========================================================================
// Dragon Flame Bullet: a dragon of fire pours from the mouth, hunts the target, and scorches everything along the way.
function castDragonFlame(player) {
  const dim = player.dimension;
  const target = lookTarget(player, 30);
  api.anim(player, "animation.aegis.jutsu_breath");
  chargeFx(player, COL.fire, 10, "aegis.charge");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    const start = api.add(player.getHeadLocation(), api.scale(d, 1.6));
    sfx(dim, "aegis.fire_roar", player.location, 2.2, 0.8);
    shake(dim, player.location, 0.3, 0.6, 16);
    const scorched = new Set();
    api.launchProjectile(player, start, d, {
      orbEntity: "aegis:fire_dragon", faceDir: true, orbOffset: 0.5, speed: 0.95, maxAge: 44, home: target, turn: 0.12,
      damage: 16, radius: 4.2, knock: 1.4, fire: 7, trail: "aegis:fire_trail", burst: "aegis:fire_burst", color: COL.fire, hitRadius: 1.9,
      power: 1.8, sound: "random.explode",
      tick: (pr) => {
        if (pr.age % 3 === 0) api.particle(dim, "aegis:cine_flame", pr.pos, COL.fire);
        for (const e of foes(player, pr.pos, 2.2)) {
          if (scorched.has(e.id)) continue;
          scorched.add(e.id);
          api.hurt(e, 3, player, "fire");
          setFire(e, 4);
        }
      },
    });
  }, 10);
  return true;
}

// Ash Pile Burning: a cone of choking ash, then a click of the teeth — and it all goes up.
function castAshBurning(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.jutsu_breath");
  chargeFx(player, [0.3, 0.27, 0.26], 10);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const o = { ...player.location };
    const f = fwdOf(player);
    const cloud = [];
    for (let d = 2; d <= 9.5; d += 1.5) for (const s of [-1, 0, 1]) cloud.push(at(o, f, d, s * d * 0.35, 1 + d * 0.05));
    sfx(dim, "aegis.wind", o, 1.4, 0.55);
    for (let t = 0; t < 36; t += 4) system.runTimeout(() => cloud.forEach((p, i) => (i + t / 4) % 2 < 1 && api.particle(dim, "aegis:ash_cloud", p)), t);
    const inCone = (e) => {
      const v = api.sub(e.location, o);
      const dist = Math.hypot(v.x, v.z);
      return dist > 0.5 && dist < 10.5 && (v.x * f.x + v.z * f.z) / dist > 0.8;
    };
    for (let t = 2; t < 34; t += 6) {
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        for (const e of foes(player, o, 11)) {
          if (!inCone(e)) continue;
          eff(e, "blindness", 40, 0, true);
          eff(e, "slowness", 20, 1, true);
          if (e.typeId === "minecraft:player") e.onScreenDisplay?.setActionBar("§8You're choking on hot ash…");
        }
      }, t);
    }
    // the click of the teeth: everything in the ash ignites
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      api.sound(dim, "fire.ignite", player.location, 1.6, 0.8);
      sfx(dim, "aegis.fire_roar", at(o, f, 5), 2.6, 0.9);
      shake(dim, o, 0.55, 0.8, 24);
      cloud.forEach((p, i) => system.runTimeout(() => api.particle(dim, i % 2 ? "aegis:fire_burst" : "aegis:cine_flame", p, COL.fire), Math.floor(i / 3)));
      for (const e of foes(player, o, 11)) {
        if (!inCone(e)) continue;
        api.hurt(e, 14, player, "fire");
        setFire(e, 6);
      }
    }, 36);
  }, 10);
  return true;
}

// ===========================================================================
// WATER
// ===========================================================================
// Water Shark Bomb: a shark of chakra-water swims at the target and bites.
function castWaterShark(player) {
  const dim = player.dimension;
  const target = lookTarget(player, 32);
  api.anim(player, "animation.aegis.water_seals");
  sfx(dim, "aegis.water", player.location, 1.4, 1.1);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    const start = api.add(player.getHeadLocation(), api.scale(d, 1.8));
    api.particle(dim, "aegis:water_splash", start, COL.water);
    api.launchProjectile(player, start, d, {
      orbEntity: "aegis:water_shark", faceDir: true, orbOffset: 0.5, speed: 0.9, maxAge: 50, home: target, turn: 0.2, custom: true, fire: 0,
      trail: "aegis:water_splash_foam", color: COL.water, hitRadius: 1.7,
      tick: (pr) => {
        if (pr.age % 3 === 0) api.particle(dim, "aegis:water_splash_jets", pr.pos, COL.water);
        if (pr.age % 8 === 0) api.sound(dim, "aegis.swish", pr.pos, 0.8, 0.7);
      },
      onHit: (pr) => {
        const c = pr.pos;
        api.particle(dim, "aegis:water_splash", c, COL.water);
        impactFx(dim, c, COL.water, 1.6);
        api.sound(dim, "aegis.water_burst", c, 1.8, 1);
        api.sound(dim, "aegis.hit_heavy", c, 1.2, 0.8);
        for (const e of foes(player, c, 3)) {
          const bitten = e.id === pr.hitEntity?.id;
          api.hurt(e, bitten ? 16 : 7, player);
          const a = api.norm(api.sub(e.location, c));
          api.knockback(e, a.x || pr.dir.x, a.z || pr.dir.z, bitten ? 1.8 : 1, 0.4);
          eff(e, "slowness", 60, 1, true);
        }
      },
    });
  }, 14);
  return true;
}

// Hiding in Mist: a thick mist rolls out around you. Enemies inside see nothing; you vanish into it.
const mists = []; // { dim, center, until, owner, fogged }
const MIST_R = 9;
function castHidingMist(player) {
  api.anim(player, "animation.aegis.hand_signs");
  sfx(player.dimension, "aegis.water", player.location, 1.2, 0.7);
  sfx(player.dimension, "aegis.wind", player.location, 1.2, 0.6);
  mists.push({ dim: player.dimension, center: { ...player.location }, until: system.currentTick + 200, owner: player.id, fogged: new Set() });
  player.onScreenDisplay.setActionBar("§bHidden in the mist… §7(10s)");
  return true;
}

function tickMists() {
  const now = system.currentTick;
  for (let i = mists.length - 1; i >= 0; i--) {
    const m = mists[i];
    const inside = new Set();
    const ended = now >= m.until;
    if (!ended) {
      if (now % 10 === 0) {
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * (MIST_R - 2);
          api.particle(m.dim, "aegis:mist_cloud", { x: m.center.x + Math.cos(a) * r, y: m.center.y, z: m.center.z + Math.sin(a) * r });
        }
      }
      const owner = world.getEntity(m.owner);
      let list = [];
      try {
        list = m.dim.getEntities({ location: m.center, maxDistance: MIST_R });
      } catch {
        list = [];
      }
      for (const e of list) {
        if (e.id === m.owner) {
          eff(e, "invisibility", 15);
          eff(e, "speed", 15, 0);
          continue;
        }
        if (!owner || !api.canBeHit(e, owner)) continue;
        eff(e, "blindness", 30, 0, true);
        if (e.typeId === "minecraft:player") {
          inside.add(e.id);
          if (!m.fogged.has(e.id)) {
            m.fogged.add(e.id);
            cmd(e, "fog @s push aegis:fog_mist aegis_mist");
          }
        }
      }
    }
    for (const id of [...m.fogged]) {
      if (inside.has(id)) continue;
      m.fogged.delete(id);
      const p = world.getEntity(id);
      if (p) cmd(p, "fog @s remove aegis_mist");
    }
    if (ended) mists.splice(i, 1);
  }
}

// Exploding Water Shockwave: a flood erupts from the mouth and rolls outward as a wall of water.
function castWaterShockwave(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.jutsu_breath");
  chargeFx(player, COL.water, 10, "aegis.charge");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const c = { ...player.location };
    sfx(dim, "aegis.water_burst", c, 3, 0.6);
    sfx(dim, "aegis.water", c, 2.5, 0.7);
    shake(dim, c, 0.8, 1.5, 32);
    eff(player, "water_breathing", 200);
    const hit = new Set();
    for (let k = 0; k <= 20; k++) {
      system.runTimeout(() => {
        const r = 1 + k * 0.5;
        const n = Math.max(6, Math.round(r * 2.2));
        for (let i = 0; i < n; i++) {
          if ((i + k) % 3) continue;
          const a = (i / n) * Math.PI * 2;
          api.particle(dim, "aegis:water_splash", { x: c.x + Math.cos(a) * r, y: c.y + 0.3, z: c.z + Math.sin(a) * r }, COL.water);
        }
        if (k % 4 === 0) api.particle(dim, "aegis:cine_ring", up(c, 0.1), COL.water);
        if (!api.isValid(player)) return;
        for (const e of foes(player, c, r + 0.8)) {
          if (hit.has(e.id)) continue;
          const dist = Math.hypot(e.location.x - c.x, e.location.z - c.z);
          if (dist < r - 1.2) continue;
          hit.add(e.id);
          api.hurt(e, 12, player);
          const a = api.norm({ x: e.location.x - c.x, y: 0, z: e.location.z - c.z });
          api.knockback(e, a.x, a.z, 2.6, 0.6);
          eff(e, "slowness", 100, 2, true);
        }
      }, k);
    }
  }, 10);
  return true;
}

// ===========================================================================
// WIND
// ===========================================================================
// Sickle Weasel: a sweeping crescent of wind blades that cuts and throws everything in front of you.
function castSickleWeasel(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.wind_palm");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const o = { ...player.location };
    const f = fwdOf(player);
    sfx(dim, "aegis.wind", o, 1.8, 1.2);
    sfx(dim, "aegis.wind_cut", o, 1.4, 1);
    const hit = new Set();
    for (let k = 1; k <= 12; k++) {
      system.runTimeout(() => {
        const dist = k * 1.15;
        for (let s = -3; s <= 3; s++) {
          const dir = rotate(f, s * 0.22);
          const p = { x: o.x + dir.x * dist, y: o.y + 1, z: o.z + dir.z * dist };
          if ((s + k) % 2 === 0) api.particle(dim, "aegis:wind_gust", p);
          if (s === 0 || Math.abs(s) === 3) api.particle(dim, "aegis:slash", p, [0.9, 1, 0.95]);
        }
        if (!api.isValid(player)) return;
        for (const e of foes(player, o, dist + 1)) {
          if (hit.has(e.id)) continue;
          const v = api.sub(e.location, o);
          const d = Math.hypot(v.x, v.z);
          if (d < dist - 1.6 || d > dist + 0.8 || (v.x * f.x + v.z * f.z) / Math.max(d, 0.01) < 0.78) continue;
          hit.add(e.id);
          api.hurt(e, 10, player);
          api.knockback(e, f.x, f.z, 1.2, 0.75);
          api.particle(dim, "aegis:slash", up(e.location, 1), [0.9, 1, 0.95]);
        }
      }, k);
    }
  }, 5);
  return true;
}

// Pressure Damage: a huge ball of compressed wind, slow and heavy, that bursts across a wide area.
function castPressureDamage(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.both_palms");
  chargeFx(player, COL.wind, 14, "aegis.charge");
  for (let t = 0; t < 14; t += 3) system.runTimeout(() => api.isValid(player) && api.particle(dim, "aegis:wind_gust", api.handPos(player)), t);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    sfx(dim, "aegis.push", player.location, 1.4, 1.4);
    api.launchProjectile(player, api.add(player.getHeadLocation(), api.scale(d, 2)), d, {
      orbEvent: "aegis:as_rasengan", speed: 0.55, maxAge: 50, custom: true, fire: 0, trail: "aegis:wind_gust", color: COL.wind, hitRadius: 2.4,
      tick: (pr) => pr.age % 4 === 0 && api.particle(dim, "aegis:chakra_aura", pr.pos),
      onHit: (pr) => {
        const c = pr.pos;
        api.particle(dim, "aegis:beast_burst", c, COL.wind);
        api.particle(dim, "aegis:cine_ring", up(c, -0.8), COL.wind);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          api.particle(dim, "aegis:wind_gust", { x: c.x + Math.cos(a) * 3.5, y: c.y, z: c.z + Math.sin(a) * 3.5 });
        }
        sfx(dim, "aegis.push", c, 2.6, 0.9);
        api.sound(dim, "random.explode", c, 1.6, 0.8);
        shake(dim, c, 0.9, 0.9, 28);
        for (const e of foes(player, c, 7)) {
          api.hurt(e, 24, player);
          const a = api.norm(api.sub(e.location, c));
          api.knockback(e, a.x, a.z, 2.8, 0.7);
        }
      },
    });
  }, 14);
  return true;
}

// ===========================================================================
// LIGHTNING
// ===========================================================================
// Lightning Hound: a hound of lightning leaps from the hand and runs the target down; its bite arcs to the next foes.
function castLightningHound(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.chidori_charge");
  sfx(dim, "aegis.chidori", player.location, 1.3, 1);
  for (let i = 0; i < 12; i++) system.runTimeout(() => api.isValid(player) && api.particle(dim, "aegis:chidori", api.chidoriHand(player)), i);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const target = lookTarget(player, 30);
    const start = api.chidoriHand(player);
    sfx(dim, "aegis.hound", start, 1.6, 1);
    api.launchProjectile(player, start, flat(player.getViewDirection()), {
      orbEntity: "aegis:lightning_hound", faceDir: true, orbOffset: 0, speed: 1.1, maxAge: 44, home: target, homeY: 0.5, turn: 0.25,
      hug: true, hugHeight: 0.05, custom: true, fire: 0, trail: "aegis:chidori", color: COL.bolt, hitRadius: 1.6,
      tick: (pr) => {
        if (pr.age % 4 === 0) api.particle(dim, "aegis:cine_bolt", up(pr.pos, 0.6), COL.bolt);
        if (pr.age % 6 === 0) api.sound(dim, "aegis.lightning", pr.pos, 0.5, 1.4);
      },
      onHit: (pr) => {
        const c = up(pr.pos, 0.6);
        api.particle(dim, "aegis:lightning_burst", c);
        api.sound(dim, "aegis.thunder", c, 1.2, 1.5);
        const first = pr.hitEntity;
        if (first && api.isValid(first)) {
          api.hurt(first, 14, player, "lightning");
          eff(first, "slowness", 30, 4, true);
          if (first.typeId === "minecraft:player") first.onScreenDisplay?.setActionBar("§bParalysed!");
        }
        // the current jumps to the next two foes
        let from = first ?? { location: pr.pos };
        const done = new Set([first?.id]);
        for (let j = 0; j < 2; j++) {
          const next = foes(player, from.location, 6).find((e) => !done.has(e.id));
          if (!next) break;
          done.add(next.id);
          const a = up(from.location, 1);
          const b = up(next.location, 1);
          for (let s = 1; s <= 4; s++) api.particle(dim, "aegis:cine_bolt", { x: a.x + (b.x - a.x) * s / 4, y: a.y + (b.y - a.y) * s / 4, z: a.z + (b.z - a.z) * s / 4 }, COL.bolt);
          api.hurt(next, 6, player, "lightning");
          eff(next, "slowness", 20, 2, true);
          from = next;
        }
      },
    });
  }, 12);
  return true;
}

// Lightning Release Armour: lightning wraps the body — faster, stronger, tougher; strikers get shocked back.
const armored = new Map(); // player id -> tick it ends
function castLightningArmor(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.lightning_burst");
  sfx(dim, "aegis.thunder", player.location, 1.6, 1.3);
  sfx(dim, "aegis.chidori", player.location, 1.2, 0.8);
  impactFx(dim, player.location, COL.bolt, 1.6);
  for (const [id, amp] of [["speed", 1], ["strength", 0], ["resistance", 0], ["haste", 1]]) eff(player, id, 300, amp);
  armored.set(player.id, system.currentTick + 300);
  showTitle(player, "§b§lLightning Armour", { subtitle: "§715 seconds", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 10 });
  return true;
}

function tickArmor() {
  const now = system.currentTick;
  for (const [id, until] of [...armored]) {
    const p = world.getEntity(id);
    if (!p || now >= until) {
      armored.delete(id);
      if (p) p.onScreenDisplay?.setActionBar("§7The lightning armour fades.");
      continue;
    }
    const l = p.location;
    api.particle(p.dimension, "aegis:chidori", { x: l.x + (Math.random() - 0.5) * 0.9, y: l.y + 0.3 + Math.random() * 1.5, z: l.z + (Math.random() - 0.5) * 0.9 });
    if (now % 12 === 0) api.particle(p.dimension, "aegis:cine_bolt", up(l, 1), COL.bolt);
  }
}

// ===========================================================================
// EARTH
// ===========================================================================
// Earth Dragon Bullet: a dragon of rock rises from the ground and spits three mud bullets.
function castEarthDragon(player) {
  const dim = player.dimension;
  const target = lookTarget(player, 30);
  api.anim(player, "animation.aegis.earth_slam");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const f = fwdOf(player);
    const spot0 = at(player.location, f, 2.6);
    const gy = api.surfaceY(dim, spot0);
    const spot = { x: spot0.x, y: gy ?? Math.floor(player.location.y), z: spot0.z };
    let dragon;
    try {
      dragon = dim.spawnEntity("aegis:earth_dragon", spot);
      dragon.teleport(spot, { facingLocation: target ? up(target.location, 0) : at(spot, f, 6) });
    } catch {
      dragon = undefined;
    }
    api.particle(dim, "aegis:earth_burst", spot);
    sfx(dim, "aegis.earth", spot, 1.8, 0.9);
    shake(dim, spot, 0.4, 0.6, 16);
    for (const t of [16, 24, 32]) {
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        const mouth = { x: spot.x + f.x * 1.3, y: spot.y + 2.1, z: spot.z + f.z * 1.3 };
        const aim = target && api.isValid(target) ? api.norm(api.sub(up(target.location, 1), mouth)) : { x: f.x, y: -0.05, z: f.z };
        api.sound(dim, "aegis.earth_break", mouth, 1.2, 1.2);
        api.launchProjectile(player, mouth, aim, {
          noOrb: true, speed: 1.2, maxAge: 30, damage: 9, radius: 2.6, knock: 1.1, fire: 0, trail: "aegis:dust", burst: "aegis:earth_burst",
          color: COL.earth, hitRadius: 1.3, power: 1.2, sound: "aegis.earth_break", effects: [["slowness", 60, 1]],
        });
      }, t);
    }
    system.runTimeout(() => {
      api.particle(dim, "aegis:dust", spot);
      sfx(dim, "aegis.earth", spot, 1.2, 1.2);
    }, 60);
    system.runTimeout(() => {
      try {
        if (dragon && api.isValid(dragon)) dragon.remove();
      } catch {
        /* ignore */
      }
    }, 74);
  }, 7);
  return true;
}

// Headhunter Jutsu: you sink into the earth, drag your target in up to the knees from below, and come up behind them.
function castHeadhunter(player) {
  const target = lookTarget(player, 16);
  if (!target) {
    player.onScreenDisplay.setActionBar("§7Look at an enemy within 16 blocks.");
    return false;
  }
  const dim = player.dimension;
  api.anim(player, "animation.aegis.earth_slam");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    api.particle(dim, "aegis:earth_burst", player.location);
    sfx(dim, "aegis.earth", player.location, 1.4, 1.1);
    eff(player, "invisibility", 18);
    eff(player, "resistance", 18, 4);
  }, 6);
  system.runTimeout(() => {
    if (!api.isValid(player) || !api.isValid(target)) return;
    const t = target;
    api.particle(dim, "aegis:earth_burst", t.location);
    sfx(dim, "aegis.earth_break", t.location, 1.8, 0.8);
    api.hurt(t, 10, player);
    eff(t, "slowness", 60, 6, true);
    eff(t, "mining_fatigue", 60, 2, true);
    if (t.typeId === "minecraft:player") t.onScreenDisplay?.setActionBar("§6You've been dragged into the earth!");
    for (let k = 0; k < 60; k += 10) system.runTimeout(() => api.isValid(t) && api.particle(dim, "aegis:dust", t.location), k);
    // come up behind them (or in front, if there's a wall behind)
    try {
      const look = flat(t.getViewDirection());
      let spot = { x: t.location.x - look.x * 1.6, y: t.location.y, z: t.location.z - look.z * 1.6 };
      if (!open(dim, spot)) {
        const back = flat(api.sub(player.location, t.location));
        spot = { x: t.location.x + back.x * 1.4, y: t.location.y, z: t.location.z + back.z * 1.4 };
      }
      player.teleport(spot, { facingLocation: up(t.location, 1.2) });
    } catch {
      /* ignore */
    }
    api.particle(dim, "aegis:dust", player.location);
    api.anim(player, "animation.aegis.m1_finisher");
  }, 14);
  system.runTimeout(() => {
    if (!api.isValid(player) || !api.isValid(target)) return;
    api.hurt(target, 6, player, "entityAttack", "fist");
    api.particle(dim, "aegis:slash", up(target.location, 1.2), [1, 0.95, 0.8]);
    api.sound(dim, "aegis.hit_heavy", target.location, 1.2, 1);
  }, 18);
  return true;
}

// Swamp of the Underworld: the ground turns to a sucking swamp of mud for 8 seconds. The blocks are put back after.
const SWAMP_OK = /^minecraft:(grass_block|dirt|coarse_dirt|rooted_dirt|podzol|mycelium|sand|red_sand|gravel|stone|andesite|diorite|granite|moss_block|clay|dirt_path|grass_path|snow)$/;
const RESTORE_PROP = "aegis:swamp_restore";
const swamps = []; // { dim, center, until, owner, blocks }

function saveRestore() {
  const all = swamps.flatMap((s) => s.blocks.map((b) => ({ ...b, d: s.dim.id })));
  try {
    world.setDynamicProperty(RESTORE_PROP, all.length ? JSON.stringify(all) : undefined);
  } catch {
    /* too big — the in-memory restore still runs */
  }
}

function restore(list) {
  for (const b of list) {
    try {
      const dim = world.getDimension(b.d);
      const blk = dim.getBlock(b);
      if (blk?.typeId === "minecraft:mud") blk.setPermutation(BlockPermutation.resolve(b.t, b.s ?? {}));
    } catch {
      /* chunk unloaded — try again on the next start */
    }
  }
}

function castSwamp(player) {
  const dim = player.dimension;
  let center;
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 20 });
    if (hit) center = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 1, z: hit.block.location.z + 0.5 };
  } catch {
    center = undefined;
  }
  if (!center) center = at(player.location, fwdOf(player), 6);
  api.anim(player, "animation.aegis.summon_slam");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const blocks = [];
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        if (dx * dx + dz * dz > 18) continue;
        const p = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
        const gy = api.surfaceY(dim, p);
        if (gy === undefined) continue;
        try {
          const blk = dim.getBlock({ x: p.x, y: gy - 1, z: p.z });
          if (!blk || !SWAMP_OK.test(blk.typeId)) continue;
          blocks.push({ x: p.x, y: gy - 1, z: p.z, t: blk.typeId, s: blk.permutation.getAllStates() });
          blk.setType("minecraft:mud");
        } catch {
          /* ignore */
        }
      }
    }
    const sw = { dim, center, until: system.currentTick + 160, owner: player.id, blocks };
    swamps.push(sw);
    saveRestore();
    sfx(dim, "aegis.earth", center, 1.8, 0.7);
    sfx(dim, "aegis.lava", center, 1.2, 0.5);
    shake(dim, center, 0.4, 0.6, 18);
  }, 10);
  return true;
}

function tickSwamps() {
  const now = system.currentTick;
  for (let i = swamps.length - 1; i >= 0; i--) {
    const s = swamps[i];
    if (now >= s.until) {
      restore(s.blocks.map((b) => ({ ...b, d: s.dim.id })));
      swamps.splice(i, 1);
      saveRestore();
      api.particle(s.dim, "aegis:dust", s.center);
      continue;
    }
    if (now % 20 === 0) {
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 3.5;
        const p = { x: s.center.x + Math.cos(a) * r, y: s.center.y, z: s.center.z + Math.sin(a) * r };
        api.particle(s.dim, "aegis:swamp_mud", p);
        api.particle(s.dim, "aegis:swamp_bubble", p);
      }
      if (now % 40 === 0) api.sound(s.dim, "aegis.lava", s.center, 0.8, 0.5);
    }
    const owner = world.getEntity(s.owner);
    if (!owner || now % 10 !== 0) continue;
    for (const e of foes(owner, s.center, 4.5)) {
      eff(e, "slowness", 20, 3, true);
      eff(e, "weakness", 20, 1, true);
      const v = api.norm({ x: s.center.x - e.location.x, y: 0, z: s.center.z - e.location.z });
      api.knockback(e, v.x, v.z, 0.18, 0);
      if (now % 20 === 0) api.hurt(e, 1.5, owner, "magic");
      if (e.typeId === "minecraft:player" && now % 40 === 0) e.onScreenDisplay?.setActionBar("§6The swamp is dragging you down…");
    }
  }
}

// ===========================================================================
// NINJUTSU
// ===========================================================================
// Big Ball Rasengan: a Rasengan several times the size — slower to form, and it craters the ground.
function castBigRasengan(player) {
  const dim = player.dimension;
  const CHARGE = 18;
  api.anim(player, "animation.aegis.rasengan_form");
  chargeFx(player, COL.chakra, CHARGE, "aegis.charge");
  sfx(dim, "aegis.rasengan", player.location, 1.6, 0.7);
  // the big orb (2.4x the Rasengan model, centred 0.6 above its origin) sits just in front of the hand
  const ballAt = () => api.add(api.handPos(player), api.scale(fwdOf(player), 0.35));
  const orb = api.spawnFx(dim, "aegis:jutsu_orb", "aegis:as_big_rasengan", ballAt());
  api.follow(orb, () => (api.isValid(player) ? api.sub(ballAt(), { x: 0, y: 0.6, z: 0 }) : undefined), CHARGE + 16);
  const ring = (t) => {
    if (!api.isValid(player)) return;
    const h = ballAt();
    for (let k = 0; k < 4; k++) {
      const a = t * 0.9 + (k * Math.PI) / 2;
      api.particle(dim, "aegis:rasengan", { x: h.x + Math.cos(a) * 0.55, y: h.y + Math.sin(a * 0.7) * 0.35, z: h.z + Math.sin(a) * 0.55 });
    }
    api.particle(dim, "aegis:rasengan_core", h);
  };
  for (let t = 0; t < CHARGE + 16; t++) system.runTimeout(() => ring(t), t);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    api.anim(player, "animation.aegis.ram_strike");
    api.lungeStrike(player, {
      power: 3, range: 3, ticks: 16,
      onHit: (target) => {
        const c = target.location;
        api.particle(dim, "aegis:beast_burst", up(c, 1), COL.chakra);
        api.particle(dim, "aegis:chakra_burst", up(c, 1));
        api.particle(dim, "aegis:cine_ring", up(c, 0.1), COL.chakra);
        api.particle(dim, "aegis:earth_burst", c);
        impactFx(dim, c, COL.chakra, 2.6);
        sfx(dim, "aegis.impact", c, 2.4, 0.8);
        api.sound(dim, "random.explode", c, 1.4, 1);
        shake(dim, c, 0.9, 0.9, 28);
        const look = flat(player.getViewDirection());
        for (const e of foes(player, c, 4.5)) {
          const main = e.id === target.id;
          api.hurt(e, main ? 34 : 18, player);
          const a = main ? look : api.norm({ x: e.location.x - c.x, y: 0, z: e.location.z - c.z });
          api.knockback(e, a.x, a.z, main ? 3.6 : 2.2, main ? 0.75 : 0.85);
          eff(e, "slowness", 30, main ? 4 : 2, true);
        }
        api.removeFx(orb);
      },
    });
  }, CHARGE);
  return true;
}

// Explosive Tag Barrage: three tags fly out, stick to whatever they hit, hiss — and go off one after another.
function castExplosiveTags(player) {
  const dim = player.dimension;
  const target = lookTarget(player, 24);
  api.anim(player, "animation.aegis.palm_thrust");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const from = api.handPos(player);
    const aim = target && api.isValid(target) ? api.norm(api.sub(up(target.location, 0.9), from)) : player.getViewDirection();
    api.sound(dim, "aegis.swish", player.location, 1, 1.4);
    [-0.16, 0, 0.16].forEach((a, i) => {
      const dir = rotate(aim, a);
      api.launchProjectile(player, api.add(from, api.scale(dir, 0.6)), dir, {
        noOrb: true, custom: true, speed: 1.5, maxAge: 16, hitRadius: 1.4, trail: "aegis:slash", color: COL.paper,
        onHit: (pr) => stickTag(player, pr.pos, pr.hitEntity, 24 + i * 10), // staggered so every blast lands
      });
    });
  }, 3);
  return true;
}

function stickTag(player, pos, stuckTo, fuse) {
  const dim = player.dimension;
  const where = () => (stuckTo && api.isValid(stuckTo) ? up(stuckTo.location, 1) : pos);
  api.sound(dim, "random.fuse", where(), 0.8, 1.2);
  for (let t = 0; t < fuse; t += 3) {
    system.runTimeout(() => {
      const p = where();
      api.particle(dim, "aegis:fire_trail_embers", p);
      api.particle(dim, "aegis:slash", p, [1, 0.3, 0.2]);
    }, t);
  }
  system.runTimeout(() => {
    const c = where();
    api.particle(dim, "aegis:fire_burst", c, COL.fire);
    api.sound(dim, "random.explode", c, 1.1, 1.3);
    shake(dim, c, 0.35, 0.3, 16);
    if (!api.isValid(player)) return;
    for (const e of foes(player, c, 3)) {
      api.hurt(e, 6, player, "entityExplosion");
      const a = api.norm(api.sub(e.location, c));
      api.knockback(e, a.x, a.z, 1, 0.35);
    }
  }, fuse);
}

// ===========================================================================
// TAIJUTSU (melee techniques: they scale with the Taijutsu stat instead of Ninjutsu)
// ===========================================================================
// Leaf Hurricane: a leaping spin kick that hits everything around you.
function castLeafHurricane(player) {
  const dim = player.dimension;
  api.anim(player, "animation.aegis.leaf_hurricane");
  for (let t = 4; t <= 14; t += 2) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      const a = t * 0.7;
      api.particle(dim, "aegis:wind_gust", { x: player.location.x + Math.cos(a) * 1.4, y: player.location.y + 0.8, z: player.location.z + Math.sin(a) * 1.4 });
      if (t % 4 === 0) api.particle(dim, "aegis:wind_gust_leaves", up(player.location, 1));
    }, t);
  }
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const c = player.location;
    for (const e of foes(player, c, 3.3)) {
      api.hurt(e, 8, player, "entityAttack", "fist");
      const a = api.norm({ x: e.location.x - c.x, y: 0, z: e.location.z - c.z });
      api.knockback(e, a.x, a.z, 1.5, 0.35);
      api.particle(dim, "aegis:slash", up(e.location, 1.1), [1, 0.95, 0.8]);
      api.sound(dim, "aegis.hit", e.location, 1, 1.1);
    }
  }, 8);
  return true;
}

// Dynamic Entry: a flying kick across the battlefield into whoever you're looking at.
function castDynamicEntry(player) {
  const dim = player.dimension;
  const target = lookTarget(player, 16);
  api.anim(player, "animation.aegis.dynamic_entry");
  player.onScreenDisplay.setActionBar("§a§lDynamic Entry!");
  let dir = fwdOf(player);
  let power = 2.6;
  if (target) {
    const v = api.sub(target.location, player.location);
    dir = flat(v);
    power = Math.min(4.2, 1.4 + Math.hypot(v.x, v.z) * 0.32);
  }
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    api.knockback(player, dir.x, dir.z, power, 0.45);
    eff(player, "resistance", 20, 1);
    let done = false;
    for (let t = 1; t <= 14; t++) {
      system.runTimeout(() => {
        if (done || !api.isValid(player)) return;
        if (t % 2 === 0) api.particle(dim, "aegis:wind_gust", up(player.location, 0.8));
        const hit = foes(player, player.location, 2.2)[0];
        if (!hit) return;
        done = true;
        api.hurt(hit, 12, player, "entityAttack", "fist");
        api.knockback(hit, dir.x, dir.z, 2.8, 0.5);
        impactFx(dim, hit.location, [0.6, 1, 0.5], 1.4);
        api.sound(dim, "aegis.hit_heavy", hit.location, 1.4, 1);
      }, t);
    }
  }, 3);
  return true;
}

// Front Lotus: kick them into the air, follow them up, wrap them and drive them head-first into the ground.
// Your own body takes a beating too.
function castFrontLotus(player) {
  const target = lookTarget(player, 4.5);
  if (!target) {
    player.onScreenDisplay.setActionBar("§7Get within 4 blocks of an enemy.");
    return false;
  }
  const dim = player.dimension;
  const big = isBig(target);
  // where they'll be driven into — taken now, while they still stand on it (they fly ~10 blocks up)
  const ground = api.surfaceY(dim, target.location) ?? Math.floor(target.location.y);
  api.anim(player, "animation.aegis.front_lotus");
  eff(player, "slow_falling", 50);
  eff(player, "resistance", 50, 1);
  // the launching kick
  system.runTimeout(() => {
    if (!api.isValid(player) || !api.isValid(target)) return;
    api.hurt(target, 4, player, "entityAttack", "fist");
    if (!big) api.knockback(target, 0, 0, 0, 1.4);
    api.particle(dim, "aegis:slash", up(target.location, 1), [1, 0.95, 0.8]);
    api.sound(dim, "aegis.hit", target.location, 1.2, 0.9);
    api.knockback(player, 0, 0, 0, 1.2);
  }, 3);
  // wrapped up and spinning down
  for (let t = 12; t <= 20; t++) {
    system.runTimeout(() => {
      if (!api.isValid(player) || !api.isValid(target)) return;
      const tl = target.location;
      const u = (t - 12) / 8;
      const y = big ? tl.y : tl.y + (ground - tl.y) * u;
      try {
        if (!big) target.teleport({ x: tl.x, y, z: tl.z }, { keepVelocity: false });
        player.teleport({ x: tl.x + 0.3, y: y + (big ? 2 : 1.2), z: tl.z }, { facingLocation: up({ x: tl.x, y, z: tl.z }, 0.5), keepVelocity: false });
      } catch {
        /* ignore */
      }
      api.particle(dim, "aegis:wind_gust", { x: tl.x, y: y + 1, z: tl.z });
      if (t % 2 === 0) api.particle(dim, "aegis:slash", { x: tl.x, y: y + 1, z: tl.z }, [0.98, 0.95, 0.88]);
    }, t);
  }
  // SLAM
  system.runTimeout(() => {
    if (!api.isValid(player) || !api.isValid(target)) return;
    const c = target.location;
    api.hurt(target, 20, player, "entityAttack", "fist");
    api.particle(dim, "aegis:earth_burst", c);
    api.particle(dim, "aegis:cine_ring", up(c, 0.1), [1, 0.85, 0.6]);
    impactFx(dim, c, [1, 0.8, 0.5], 2.2);
    api.sound(dim, "aegis.hit_heavy", c, 1.6, 0.8);
    api.sound(dim, "aegis.land", c, 1.4, 0.9);
    shake(dim, c, 0.9, 0.8, 24);
    try {
      player.teleport({ x: c.x + 1.2, y: c.y, z: c.z }, { facingLocation: up(c, 0.5), keepVelocity: false });
    } catch {
      /* ignore */
    }
    drain(player, 3); // the strain on your own body
    player.onScreenDisplay.setActionBar("§aFront Lotus! §7(your body aches)");
  }, 21);
  return true;
}

// ===========================================================================
// MEDICAL & GENJUTSU
// ===========================================================================
// Chakra Scalpel: blades of chakra on the hands. For 10s your punches also cut muscle and tendon.
const scalpels = new Map(); // player id -> tick it ends
function castChakraScalpel(player) {
  api.anim(player, "animation.aegis.ice_seal");
  sfx(player.dimension, "aegis.heal", player.location, 1.2, 1.6);
  api.particle(player.dimension, "aegis:heal", player.location);
  scalpels.set(player.id, system.currentTick + 200);
  player.onScreenDisplay.setActionBar("§aChakra Scalpel §7— your hits cut (10s)");
  return true;
}

function tickScalpels() {
  const now = system.currentTick;
  for (const [id, until] of [...scalpels]) {
    const p = world.getEntity(id);
    if (!p || now >= until) {
      scalpels.delete(id);
      continue;
    }
    if (now % 3 === 0) api.particle(p.dimension, "aegis:slash", api.handPos(p), COL.scalpel);
  }
}

// Demonic Illusion — Hell Viewing: the target sees their worst fear. Reeling, half-blind and weak for 6s
// (bosses shake it off in 3s).
function castHellViewing(player) {
  const target = lookTarget(player, 18);
  if (!target) {
    player.onScreenDisplay.setActionBar("§7Look at an enemy within 18 blocks.");
    return false;
  }
  const dim = player.dimension;
  api.anim(player, "animation.aegis.hand_signs");
  sfx(dim, "aegis.shadow", player.location, 1.2, 0.7);
  system.runTimeout(() => {
    if (!api.isValid(target)) return;
    const dur = isBig(target) ? 60 : 120;
    api.particle(dim, "aegis:cine_swirl", target.location, COL.genjutsu);
    api.particle(dim, "aegis:beast_mist", up(target.location, 1), COL.genjutsu);
    sfx(dim, "aegis.eye", target.location, 1.2, 0.7);
    for (const [id, amp] of [["nausea", 0], ["weakness", 1], ["slowness", 1], ["blindness", 0]]) eff(target, id, dur, amp, true);
    if (target.typeId === "minecraft:player") {
      eff(target, "darkness", dur, 0, true);
      showTitle(target, "§5§lHell Viewing", { subtitle: "§7Your worst fear stares back at you…", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
      cmd(target, "fog @s push aegis:fog_dark aegis_genjutsu");
      cmd(target, "camerashake add @s 0.3 2 rotational");
      system.runTimeout(() => api.isValid(target) && cmd(target, "fog @s remove aegis_genjutsu"), dur);
    }
  }, 10);
  return true;
}

// ===========================================================================
export function makeJutsu3(helpers) {
  api = helpers;
  system.runInterval(() => {
    tickMists();
    tickArmor();
    tickScalpels();
    tickSwamps();
  }, 1);

  // swamps left half-made by a restart are put back
  system.run(() => {
    try {
      const left = JSON.parse(world.getDynamicProperty(RESTORE_PROP) ?? "[]");
      if (left.length) {
        restore(left);
        world.setDynamicProperty(RESTORE_PROP, undefined);
      }
    } catch {
      /* ignore */
    }
  });

  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (damageSource?.cause !== "entityAttack" || isEcho(hurtEntity, damage)) return;
    const scripted = scriptedHit(hurtEntity, damageSource);
    if (scripted && scripted.kind !== "fist") return; // only real swings and taijutsu are melee
    const a = damageSource.damagingEntity;
    const now = system.currentTick;
    // Lightning Armour: strikers get shocked, and your own blows crackle after impact
    if ((armored.get(hurtEntity.id) ?? 0) > now && a && a.id !== hurtEntity.id && api.canBeHit(a, hurtEntity)) {
      api.hurt(a, 5, hurtEntity, "lightning");
      eff(a, "slowness", 30, 2, true);
      api.particle(a.dimension, "aegis:lightning_burst", up(a.location, 1));
    }
    if (a?.typeId === "minecraft:player" && (armored.get(a.id) ?? 0) > now && api.canBeHit(hurtEntity, a)) {
      system.runTimeout(() => api.isValid(hurtEntity) && api.hurt(hurtEntity, 4, a, "lightning"), 11);
      api.particle(a.dimension, "aegis:chidori", up(hurtEntity.location, 1));
    }
    // Chakra Scalpel: cut muscle and tendon
    if (a?.typeId === "minecraft:player" && (scalpels.get(a.id) ?? 0) > now && api.canBeHit(hurtEntity, a)) {
      eff(hurtEntity, "slowness", 100, 2, true);
      eff(hurtEntity, "weakness", 100, 1, true);
      api.particle(a.dimension, "aegis:slash", up(hurtEntity.location, 1.1), COL.scalpel);
      system.runTimeout(() => api.isValid(hurtEntity) && api.hurt(hurtEntity, 5, a, "magic", "fist"), 11);
    }
  });

  world.afterEvents.playerSpawn.subscribe(({ player }) => {
    cmd(player, "fog @s remove aegis_mist");
    cmd(player, "fog @s remove aegis_genjutsu");
  });

  return {
    "aegis:dragon_flame_scroll": { name: "Fire Style: Dragon Flame Bullet", cost: 45, cooldown: 160, cast: castDragonFlame },
    "aegis:ash_burning_scroll": { name: "Fire Style: Ash Pile Burning", cost: 40, cooldown: 200, cast: castAshBurning },
    "aegis:water_shark_scroll": { name: "Water Style: Water Shark Bomb", cost: 35, cooldown: 100, cast: castWaterShark },
    "aegis:hiding_mist_scroll": { name: "Water Style: Hiding in Mist", cost: 30, cooldown: 400, cast: castHidingMist },
    "aegis:water_shockwave_scroll": { name: "Water Style: Exploding Water Shockwave", cost: 60, cooldown: 500, cast: castWaterShockwave },
    "aegis:sickle_weasel_scroll": { name: "Wind Style: Sickle Weasel", cost: 30, cooldown: 90, cast: castSickleWeasel },
    "aegis:pressure_damage_scroll": { name: "Wind Style: Pressure Damage", cost: 55, cooldown: 260, cast: castPressureDamage },
    "aegis:lightning_hound_scroll": { name: "Lightning Style: Lightning Hound", cost: 40, cooldown: 140, cast: castLightningHound },
    "aegis:lightning_armor_scroll": { name: "Lightning Style: Lightning Release Armour", cost: 50, cooldown: 700, cast: castLightningArmor },
    "aegis:earth_dragon_scroll": { name: "Earth Style: Earth Dragon Bullet", cost: 35, cooldown: 120, cast: castEarthDragon },
    "aegis:headhunter_scroll": { name: "Earth Style: Headhunter Jutsu", cost: 30, cooldown: 160, cast: castHeadhunter },
    "aegis:swamp_scroll": { name: "Earth Style: Swamp of the Underworld", cost: 45, cooldown: 320, cast: castSwamp },
    "aegis:big_rasengan_scroll": { name: "Big Ball Rasengan", cost: 50, cooldown: 160, cast: castBigRasengan },
    "aegis:explosive_tags_scroll": { name: "Explosive Tag Barrage", cost: 15, cooldown: 100, cast: castExplosiveTags },
    "aegis:leaf_hurricane_scroll": { name: "Taijutsu: Leaf Hurricane", cost: 15, cooldown: 40, kind: "taijutsu", cast: castLeafHurricane },
    "aegis:dynamic_entry_scroll": { name: "Taijutsu: Dynamic Entry", cost: 15, cooldown: 80, kind: "taijutsu", cast: castDynamicEntry },
    "aegis:front_lotus_scroll": { name: "Taijutsu: Front Lotus", cost: 30, cooldown: 240, kind: "taijutsu", cast: castFrontLotus },
    "aegis:chakra_scalpel_scroll": { name: "Medical: Chakra Scalpel", cost: 25, cooldown: 200, cast: castChakraScalpel },
    "aegis:hell_viewing_scroll": { name: "Genjutsu: Hell Viewing", cost: 25, cooldown: 200, cast: castHellViewing },
  };
}
