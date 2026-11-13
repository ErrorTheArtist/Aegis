// Tailed Beast Mode v2 — the show: the transformation cinematic (shot list in jin_shots.js), the transformation roar,
// the nine Beast Arts and the beast-chakra punch. bijuu.js decides who is a Jinchūriki and who is transformed and calls
// in here; the cloak models and their "form" animation (tools/gen_jinchuriki.py) are timed to the same beats.
//
// Beast Arts (double-tap sneak while transformed; 30 chakra / 10 s, mastered 15 chakra / 6 s and 1.5× damage):
//   Shukaku  — Sand Coffin: sand engulfs the enemy you look at, then Sand Burial crushes them
//   Matatabi — Blue Fire: a cone of blue cat-fire
//   Isobu    — Coral Spikes: rings of coral burst out around you while a shell hardens over you
//   Son Goku — Lava Globs: three globs of lava
//   Kokuo    — Steam Rush: a boiling charge straight through everything in front of you
//   Saiken   — Acid Bubbles: a fan of corrosive bubbles
//   Chomei   — Scale Powder: you take flight and rain blinding scales on everyone below
//   Gyuki    — Ink & Lariat: an ink spray, then Killer B's lariat
//   Kurama   — Chakra Arms: two chakra claws reach out, grab the first enemy in reach, drag them in and slam them down

import { system } from "@minecraft/server";
import { FERAL, MASTERED } from "./jin_shots.js";
import { sfx, shake, impactFx, inCinematic, setCinematicBusy, fogFor } from "./cinematic.js";
import { showTitle } from "./hud.js";

let api;
export function initJinchuriki(helpers) {
  api = helpers;
}

const GOLD = [1, 0.8, 0.25];
const f3 = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;
const up = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });
const flat = (d) => api.norm({ x: d.x, y: 0, z: d.z });
const rotate = (d, a) => ({ x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y, z: d.x * Math.sin(a) + d.z * Math.cos(a) });
const isBig = (e) => e.typeId === "aegis:legend" || e.typeId === "aegis:akatsuki" || !!e.matches?.({ families: ["tailed_beast"] });

function cmd(p, c) {
  try {
    p.runCommand(c);
  } catch {
    /* ignore */
  }
}

function eff(e, id, ticks, amp = 0, show = false) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: show });
  } catch {
    /* ignore */
  }
}

function setFire(e, s) {
  try {
    e.setOnFire(s, true);
  } catch {
    /* ignore */
  }
}

function foes(player, pos, r) {
  try {
    return player.dimension.getEntities({ location: pos, maxDistance: r }).filter((e) => api.canBeHit(e, player));
  } catch {
    return [];
  }
}

function cone(player, range, minDot) {
  const d = player.getViewDirection();
  const head = player.getHeadLocation();
  return foes(player, player.location, range).filter((e) => api.dot(api.norm(api.sub(up(e.location, 1), head)), d) > minDot);
}

function lookTarget(player, range) {
  try {
    return player.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
  } catch {
    return undefined;
  }
}

// Direction from `from` to what the player aims at (an enemy in the crosshair, else straight ahead).
function aimFrom(player, from, range = 32) {
  const t = lookTarget(player, range);
  const point = t ? up(t.location, 1) : api.add(player.getHeadLocation(), api.scale(player.getViewDirection(), range));
  return api.norm(api.sub(point, from));
}

// ===========================================================================
// The transformation cinematic
// ===========================================================================
const fogTag = (player) => `aegis_jin_${String(player.id).replace(/[^0-9a-z]/gi, "").slice(-8)}`;

// A player who left mid-transformation gets their sky back when they return (cinematic.js resets the camera).
export function jinCleanup(player) {
  cmd(player, `fog @s remove ${fogTag(player)}`);
}
/**
 * Plays the Tailed Beast Mode transformation for `player` (≈5.3 s). b: the beast (bijuu.js BEASTS entry), mastered:
 * the golden Tailed Beast Chakra Mode version. isActive(): still transformed — if the cloak comes off, the film stops.
 * Returns true if the camera sequence ran (false: another cinematic owns the camera; the world effects still play).
 */
export function jinTransform(player, b, mastered, isActive) {
  const S = mastered ? MASTERED : FERAL;
  const T = S.T;
  const dim = player.dimension;
  const color = mastered ? GOLD : b.color;
  const base = { ...player.location };
  const fwd = flat(player.getViewDirection());
  const right = { x: -fwd.z, y: 0, z: fwd.x };
  const at = (f, r, h) => ({ x: base.x + fwd.x * f + right.x * r, y: base.y + h, z: base.z + fwd.z * f + right.z * r });
  const film = !inCinematic(player);
  const fog = fogTag(player);
  let ended = false;

  const end = () => {
    if (ended) return;
    ended = true;
    if (!film) return;
    setCinematicBusy(player.id, false);
    if (!api.isValid(player)) return;
    cmd(player, "camera @s clear");
    cmd(player, "inputpermission set @s movement enabled");
    cmd(player, "inputpermission set @s camera enabled");
    cmd(player, "hud @s reset");
    system.runTimeout(() => api.isValid(player) && cmd(player, `fog @s remove ${fog}`), 60);
  };
  const run = (fn, t) =>
    system.runTimeout(() => {
      if (ended) return;
      if (!api.isValid(player) || !isActive()) return end();
      fn();
    }, Math.max(1, Math.round(t)));

  // the shroud protects you while it forms
  eff(player, "resistance", T.release + 10, 4);
  if (film) {
    setCinematicBusy(player.id, true);
    cmd(player, "inputpermission set @s movement disabled");
    cmd(player, "inputpermission set @s camera disabled");
    cmd(player, "hud @s hide all");
    api.anim(player, S.ANIM, "aegis_cinematic");
    for (const s of S.SHOTS) {
      const go = () => cmd(player, `camera @s set minecraft:free${s.ease ? ` ease ${s.ease} in_out_sine` : ""} pos ${f3(at(...s.pos))} facing ${f3(at(...s.look))}`);
      if (s.t === 0) go();
      else run(go, s.t);
    }
  }

  // --- the seal burns (feral) / the calm before the flash (mastered)
  const belly = () => api.add(api.add(player.location, api.scale(flat(player.getViewDirection()), 0.34)), { x: 0, y: 0.95, z: 0 });
  if (mastered) sfx(dim, "aegis.jin_gold", base, 1.6, 0.9);
  for (let t = 1; t < T.erupt; t += 3) {
    run(() => {
      api.particle(dim, "aegis:jin_seal", belly(), color);
      if (t % 6 === 1) api.particle(dim, "aegis:jin_bubble", player.location, color);
    }, t);
  }
  for (const t of T.heart) {
    run(() => {
      sfx(dim, "aegis.heartbeat", player.location, 1.6, 1);
      if (film) cmd(player, "camerashake add @s 0.18 0.22 positional");
    }, t);
  }

  // --- the chakra erupts
  run(() => {
    const c = up(player.location, 1);
    sfx(dim, mastered ? "aegis.boom" : "aegis.jin_erupt", base, 2.4, mastered ? 1.2 : 1);
    sfx(dim, "aegis.transform", base, 2, mastered ? 1.15 : 0.9);
    api.particle(dim, "aegis:beast_burst", c, color);
    api.particle(dim, "aegis:cine_ring", player.location, color);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      api.particle(dim, "aegis:cine_pillar", { x: base.x + Math.cos(a) * 2.2, y: base.y, z: base.z + Math.sin(a) * 2.2 }, color);
    }
    shake(dim, base, mastered ? 0.4 : 0.65, 1.0, 20);
    if (film) {
      cmd(player, `fog @s push aegis:fog_${fogFor(color)} ${fog}`);
      const [r, g, bl] = color.map((v) => Math.round(v * 255));
      cmd(player, `camera @s fade time 0.03 0.06 0.3 color ${r} ${g} ${bl}`);
    }
  }, T.erupt);
  for (let t = T.erupt + 1; t < T.fours + 4; t += 2) {
    run(() => {
      api.particle(dim, "aegis:jin_bubble", player.location, color);
      if (t % 4 === 1) api.particle(dim, "aegis:beast_aura", player.location, color);
    }, t);
  }

  // --- down on all fours (feral) / standing in the flames (mastered)
  run(() => {
    api.particle(dim, mastered ? "aegis:cine_swirl" : "aegis:cine_debris", player.location, color);
    api.sound(dim, "aegis.land", player.location, 1.2, 0.7);
  }, T.fours);

  // --- the tails sprout, one by one (same order and rhythm as the cloak's form animation)
  const n = b.tails === 7 ? 4 : b.tails; // Chomei: one tail and three pairs of wings
  for (let k = 0; k < n; k++) {
    run(() => {
      const behind = api.add(player.location, api.add(api.scale(flat(player.getViewDirection()), -0.35), { x: 0, y: 0.9, z: 0 }));
      api.particle(dim, "aegis:jin_flare", behind, color);
      sfx(dim, "aegis.jin_tail", behind, 1.3, 0.78 + k * 0.05);
      if (film && k % 3 === 0) cmd(player, "camerashake add @s 0.12 0.15 positional");
    }, T.tails + k * T.tailGap);
  }
  for (let t = T.tails; t < T.coil; t += 4) run(() => api.particle(dim, "aegis:cine_swirl", player.location, color), t);

  // --- coil, then the ROAR
  run(() => sfx(dim, "aegis.inhale", player.location, 1.4, 0.65), T.coil);
  run(() => {
    const c = player.location;
    if (mastered) {
      sfx(dim, "aegis.jin_gold", c, 2.2, 1.25);
      sfx(dim, "aegis.boom", c, 2.4, 1.1);
    } else {
      sfx(dim, "aegis.roar", c, 3, 0.9);
      api.sound(dim, "mob.ravager.roar", c, 2, 0.7);
      sfx(dim, "aegis.boom", c, 2.4, 0.8);
    }
    for (let k = 0; k < 3; k++) system.runTimeout(() => api.particle(dim, "aegis:cine_ring", c, color), k * 4);
    api.particle(dim, "aegis:beast_burst", up(c, 1.4), color);
    api.particle(dim, "aegis:cine_debris", c);
    shake(dim, c, mastered ? 0.8 : 1.2, 1.3, 32);
    if (film) {
      const [r, g, bl] = color.map((v) => Math.round(v * 200));
      cmd(player, `camera @s fade time 0.02 0.04 0.22 color ${r} ${g} ${bl}`);
    }
    roarShockwave(player, b, mastered);
  }, T.roar);

  // --- the name
  run(() => {
    showTitle(player, mastered ? "§6§lTailed Beast Chakra Mode" : `${b.text}§lTailed Beast Mode`, {
      subtitle: `§7${b.name}, ${b.title}`, fadeInDuration: 3, stayDuration: 34, fadeOutDuration: 10,
    });
  }, T.title);
  system.runTimeout(end, T.release);
  return film;
}

// The roar at the end of the transformation: everything close is blasted back.
export function roarShockwave(player, b, mastered) {
  const c = player.location;
  const dmg = (mastered ? 10 : 6) + b.tails;
  for (const e of foes(player, c, 7)) {
    api.hurt(e, dmg, player);
    const a = api.norm({ x: e.location.x - c.x, y: 0, z: e.location.z - c.z });
    api.knockback(e, a.x, a.z, mastered ? 3 : 2.2, 0.55);
    eff(e, "slowness", 40, 1, true);
  }
}

// ===========================================================================
// Beast-chakra punches: every melee hit while transformed (added by the M1 combo)
// ===========================================================================
export function beastPunch(player, target, b, mastered) {
  const color = mastered ? GOLD : b.color;
  const dim = player.dimension;
  api.particle(dim, "aegis:beast_aura", up(target.location, 0.4), color);
  if (Math.random() < 0.35) api.particle(dim, "aegis:jin_flare", up(target.location, 1), color);
  return (2 + b.tails * 0.4) * (mastered ? 1.5 : 1);
}

// ===========================================================================
// Beast Arts
// ===========================================================================
function artSandCoffin(player, b, m, t) {
  const dim = player.dimension;
  const sand = b.color;
  api.anim(player, "animation.aegis.pull");
  sfx(dim, "aegis.earth", t.location, 1.5, 0.8);
  api.sound(dim, "dig.sand", t.location, 2, 0.7);
  eff(t, "slowness", 34, 255, true);
  eff(t, "weakness", 80, 1, true);
  if (t.typeId === "minecraft:player") t.onScreenDisplay?.setActionBar("§6Sand engulfs you!");
  for (let k = 0; k < 30; k += 3) {
    system.runTimeout(() => {
      if (!api.isValid(t)) return;
      api.particle(dim, "aegis:beast_mist", up(t.location, 0.4 + k * 0.04), sand);
      api.particle(dim, "aegis:dust", t.location);
    }, k);
  }
  system.runTimeout(() => {   // Sand Burial
    if (!api.isValid(t) || !api.isValid(player)) return;
    const c = t.location;
    api.particle(dim, "aegis:beast_burst", up(c, 1), sand);
    api.particle(dim, "aegis:cine_debris", c);
    api.sound(dim, "random.explode", c, 1, 0.7);
    shake(dim, c, 0.5, 0.5, 16);
    api.hurt(t, 14 * m, player);
    for (const e of foes(player, c, 3)) if (e.id !== t.id) api.hurt(e, 6 * m, player);
  }, 30);
}

function artBlueFire(player, b, m) {
  const dim = player.dimension;
  const blue = b.color;
  api.anim(player, "animation.aegis.jutsu_breath");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    const head = player.getHeadLocation();
    const side = { x: -d.z, y: 0, z: d.x };
    sfx(dim, "aegis.fire_roar", head, 2, 1.25);
    api.sound(dim, "mob.blaze.shoot", head, 1.5, 0.7);
    for (let s = 1.5; s <= 10; s += 1.2) {
      for (const k of [-1, 0, 1]) api.particle(dim, k ? "aegis:beast_aura" : "aegis:cine_flame", api.add(head, api.add(api.scale(d, s), api.scale(side, k * s * 0.3))), blue);
    }
    for (const e of cone(player, 10, 0.55)) {
      api.hurt(e, 9 * m, player, "fire");
      setFire(e, 6);
    }
  }, 8);
}

function artCoral(player, b, m) {
  const dim = player.dimension;
  const coral = b.color;
  const c = { ...player.location };
  api.anim(player, "animation.aegis.earth_slam");
  eff(player, "resistance", 60, 2);
  const hit = new Set();
  for (let k = 0; k < 4; k++) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      const r = 2 + k * 1.4;
      const pts = 10 + k * 4;
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const p = { x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r };
        api.particle(dim, i % 2 ? "aegis:beast_aura" : "aegis:dust", p, coral);
      }
      api.particle(dim, "aegis:cine_ring", c, coral);
      sfx(dim, "aegis.ice_shatter", c, 1.4, 0.8 - k * 0.05);
      for (const e of foes(player, c, r + 0.8)) {
        if (hit.has(e.id)) continue;
        const dist = Math.hypot(e.location.x - c.x, e.location.z - c.z);
        if (dist < r - 1.6) continue;
        hit.add(e.id);
        api.hurt(e, 10 * m, player);
        const a = api.norm({ x: e.location.x - c.x, y: 0, z: e.location.z - c.z });
        api.knockback(e, a.x, a.z, 0.8, 0.7);
        eff(e, "slowness", 60, 2, true);
      }
    }, 6 + k * 3);
  }
}

function artLava(player, b, m) {
  const dim = player.dimension;
  const lava = b.color;
  api.anim(player, "animation.aegis.palm_thrust");
  sfx(dim, "aegis.lava", player.location, 1.6, 0.9);
  [-0.12, 0, 0.12].forEach((a, i) => {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      const from = api.handPos(player);
      const dir = rotate(aimFrom(player, from), a);
      api.launchProjectile(player, api.add(from, api.scale(dir, 0.8)), dir, {
        orbEvent: "aegis:as_fireball", speed: 1.1, maxAge: 30, damage: 8 * m, radius: 2.6, knock: 0.9, fire: 5,
        trail: "aegis:fire_trail", burst: "aegis:fire_burst", color: lava, hitRadius: 1.7, power: 1.2, sound: "aegis.lava",
      });
    }, 4 + i * 3);
  });
}

function artSteamRush(player, b, m) {
  const dim = player.dimension;
  const steam = b.color;
  const d = flat(player.getViewDirection());
  api.anim(player, "animation.aegis.ram_strike");
  sfx(dim, "aegis.water_burst", player.location, 1.6, 0.7);
  api.sound(dim, "random.fizz", player.location, 1.5, 0.6);
  api.knockback(player, d.x, d.z, 4.2, 0.25);
  eff(player, "resistance", 20, 2);
  const hit = new Set();
  for (let k = 1; k <= 12; k++) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      api.particle(dim, "aegis:beast_mist", up(player.location, 0.8), steam);
      if (k % 2) api.particle(dim, "aegis:smoke_puff", player.location);
      for (const e of foes(player, player.location, 2.6)) {
        if (hit.has(e.id)) continue;
        hit.add(e.id);
        api.hurt(e, 10 * m, player);
        api.knockback(e, d.x, d.z, 2.6, 0.6);
        setFire(e, 3);
        impactFx(dim, e.location, steam, 1);
      }
    }, k);
  }
}

function artAcid(player, b, m) {
  const dim = player.dimension;
  const acid = b.color;
  api.anim(player, "animation.aegis.jutsu_breath");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const from = api.add(player.getHeadLocation(), { x: 0, y: -0.35, z: 0 });
    const d = aimFrom(player, from);
    sfx(dim, "aegis.water", player.location, 1.4, 1.3);
    for (const a of [-0.3, -0.15, 0, 0.15, 0.3]) {
      const dir = rotate(d, a);
      api.launchProjectile(player, api.add(from, api.scale(dir, 1.0)), dir, {
        noOrb: true, custom: true, fire: 0, speed: 0.75, maxAge: 26, hitRadius: 1.6, trail: "aegis:jin_bubble", color: acid,
        onHit: (pr) => {
          api.particle(dim, "aegis:beast_mist", pr.pos, acid);
          api.sound(dim, "random.fizz", pr.pos, 1, 1.4);
          for (const e of foes(player, pr.pos, 2.4)) {
            api.hurt(e, 5 * m, player, "magic");
            eff(e, "poison", 80, 1, true);
            eff(e, "slowness", 60, 0, true);
          }
        },
      });
    }
  }, 8);
}

function artScales(player, b, m) {
  const dim = player.dimension;
  const green = b.color;
  api.anim(player, "animation.aegis.lightning_burst");
  sfx(dim, "aegis.wind", player.location, 1.6, 1.3);
  api.sound(dim, "mob.bee.aggressive", player.location, 1.5, 0.8);
  eff(player, "levitation", 12, 6);
  system.runTimeout(() => api.isValid(player) && eff(player, "slow_falling", 120, 0), 10);
  for (let k = 0; k < 40; k += 4) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      api.particle(dim, "aegis:jin_bubble", player.location, green);
      api.particle(dim, "aegis:chakra_aura", player.location);
    }, k);
  }
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const c = player.location;
    for (let k = 0; k < 5; k++) api.particle(dim, "aegis:beast_mist", { x: c.x + (Math.random() - 0.5) * 6, y: c.y - 2 - Math.random() * 2, z: c.z + (Math.random() - 0.5) * 6 }, green);
    sfx(dim, "aegis.wind", c, 1.4, 0.8);
    for (const e of foes(player, c, 7)) {
      api.hurt(e, 6 * m, player);
      eff(e, "blindness", 60, 0, true);
      eff(e, "weakness", 80, 0, true);
    }
  }, 12);
}

function artInkLariat(player, b, m) {
  const dim = player.dimension;
  const ink = [0.12, 0.06, 0.16];
  api.anim(player, "animation.aegis.jutsu_breath");
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    const d = player.getViewDirection();
    const head = player.getHeadLocation();
    sfx(dim, "aegis.water", head, 1.4, 0.6);
    for (let s = 1; s <= 7; s += 1) api.particle(dim, "aegis:beast_mist", api.add(head, api.scale(d, s)), ink);
    for (const e of cone(player, 7, 0.6)) {
      api.hurt(e, 5 * m, player);
      eff(e, "blindness", 60, 0, true);
    }
  }, 6);
  system.runTimeout(() => {   // Lariat!
    if (!api.isValid(player)) return;
    api.anim(player, "animation.aegis.ram_strike");
    player.onScreenDisplay?.setActionBar(`${b.text}§lLariat!`);
    api.lungeStrike(player, {
      power: 3.6, range: 2.8, ticks: 14,
      trail: () => api.particle(dim, "aegis:beast_aura", player.location, b.color),
      onHit: (t) => {
        api.hurt(t, 14 * m, player, "entityAttack", "fist");
        const h = flat(player.getViewDirection());
        if (!isBig(t)) api.knockback(t, h.x, h.z, 3, 0.9);
        impactFx(dim, t.location, b.color, 1.8);
        api.sound(dim, "aegis.hit_heavy", t.location, 1.6, 0.8);
      },
    });
  }, 16);
}

function artChakraArms(player, b, m) {
  const dim = player.dimension;
  const col = b.color;
  const REACH = 14;
  const d = player.getViewDirection();
  const from = api.handPos(player);
  api.anim(player, "animation.aegis.palm_thrust");
  sfx(dim, "aegis.push", from, 1.4, 0.8);
  let caught;
  const grab = (e) => {
    api.sound(dim, "aegis.pull", e.location, 1.4, 0.9);
    if (e.typeId === "minecraft:player") e.onScreenDisplay?.setActionBar("§6A claw of chakra has you!");
    const big = isBig(e);
    for (let j = 1; j <= 6; j++) {
      system.runTimeout(() => {
        if (!api.isValid(e) || !api.isValid(player)) return;
        api.particle(dim, "aegis:beast_aura", up(e.location, 0.8), col);
        if (big) return; // too big to drag — the claws just hold on
        const dest = api.add(player.location, api.scale(flat(player.getViewDirection()), 2.2));
        const p = e.location;
        const u = j / 6;
        try {
          e.teleport({ x: p.x + (dest.x - p.x) * u, y: p.y + (dest.y + 1.2 - p.y) * u * 0.6, z: p.z + (dest.z - p.z) * u }, { keepVelocity: false });
        } catch {
          /* ignore */
        }
      }, j);
    }
    system.runTimeout(() => {   // slammed into the ground
      if (!api.isValid(e) || !api.isValid(player)) return;
      api.anim(player, "animation.aegis.summon_slam");
      api.hurt(e, 14 * m, player);
      if (!big) api.knockback(e, 0, 0, 0, 0.8);
      impactFx(dim, e.location, col, 2);
      api.particle(dim, "aegis:cine_ring", e.location, col);
      api.particle(dim, "aegis:cine_debris", e.location);
      shake(dim, e.location, 0.7, 0.6, 20);
    }, 9);
  };
  for (let k = 1; k <= 4; k++) {
    system.runTimeout(() => {
      if (caught || !api.isValid(player)) return;
      const len = (REACH * k) / 4;
      for (let s = (k - 1) * 3.5; s <= len; s += 0.7) {
        api.particle(dim, "aegis:beast_aura", api.add(from, api.scale(d, s)), col);
        api.particle(dim, "aegis:beast_aura", api.add(api.add(from, { x: -d.z * 0.6, y: 0, z: d.x * 0.6 }), api.scale(d, s)), col);
      }
      api.particle(dim, "aegis:jin_flare", api.add(from, api.scale(d, len)), col);
      for (const e of foes(player, api.add(from, api.scale(d, len / 2)), len / 2 + 2)) {
        const v = api.sub(up(e.location, 0.9), from);
        const along = api.dot(v, d);
        if (along < 0 || along > len + 0.8) continue;
        const perp = api.sub(v, api.scale(d, along));
        if (Math.hypot(perp.x, perp.y, perp.z) > 1.8) continue;
        caught = e;
        break;
      }
      if (caught) grab(caught);
    }, k);
  }
  system.runTimeout(() => {   // nothing caught: the claws smash the ground at full reach
    if (caught || !api.isValid(player)) return;
    const end = api.add(from, api.scale(d, REACH));
    impactFx(dim, end, col, 1.4);
    for (const e of foes(player, end, 3)) {
      api.hurt(e, 8 * m, player);
      const a = api.norm(api.sub(e.location, end));
      api.knockback(e, a.x, a.z, 1.4, 0.5);
    }
  }, 6);
}

export const ARTS = {
  shukaku: { name: "Sand Coffin", cast: artSandCoffin, range: 24 },
  matatabi: { name: "Blue Fire", cast: artBlueFire },
  isobu: { name: "Coral Spikes", cast: artCoral },
  son_goku: { name: "Lava Globs", cast: artLava },
  kokuo: { name: "Steam Rush", cast: artSteamRush },
  saiken: { name: "Acid Bubbles", cast: artAcid },
  chomei: { name: "Scale Powder", cast: artScales },
  gyuki: { name: "Ink & Lariat", cast: artInkLariat },
  kurama: { name: "Chakra Arms", cast: artChakraArms },
};
export const ART_COST = { normal: 30, mastered: 15 };
export const ART_COOLDOWN = { normal: 200, mastered: 120 };

// Double-tap sneak while transformed. Returns true if the art went off.
export function beastArt(player, bid, b, mastered) {
  const art = ARTS[bid];
  if (!art) return false;
  const left = api.cooldownLeft(player, "beast_art");
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7${art.name} ready in §f${(left / 20).toFixed(1)}s`);
    return false;
  }
  const cost = mastered ? ART_COST.mastered : ART_COST.normal;
  if (api.getChakra(player) < cost) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra for ${art.name} (${cost})`);
    return false;
  }
  const target = art.range ? lookTarget(player, art.range) : undefined;
  if (art.range && !target) {
    player.onScreenDisplay.setActionBar(`§7${art.name}: look at an enemy within ${art.range} blocks.`);
    return false;
  }
  art.cast(player, b, mastered ? 1.5 : 1, target, mastered);
  api.setChakra(player, api.getChakra(player) - cost);
  api.startCooldown(player, "beast_art", mastered ? ART_COOLDOWN.mastered : ART_COOLDOWN.normal);
  api.gainJutsuXp?.(player, cost);
  player.onScreenDisplay.setActionBar(`${mastered ? "§6" : b.text}§l${art.name}!`);
  return true;
}
