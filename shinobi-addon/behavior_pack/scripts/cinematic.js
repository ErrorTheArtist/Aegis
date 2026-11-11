// Cinematic effects (inspired by anime transformation sequences):
//  - transformCinematic: camera orbit + lightning pillars + debris + anime flames → cut to black →
//    reveal with a burst, coloured sky, spinning ground vortex and lightning streaks.
//  - beastAwakenFx: Tailed Beast awakening / rage.
//  - impactFx: shockwave ring, debris, flames, screen shake and a boom for big hits.
//  - aura: the vortex + streaks that stay under you while transformed.
// Uses /camera, /camerashake, /fog and /inputpermission through the script API (no cheats needed).

import { world, system, MolangVariableMap } from "@minecraft/server";
import { showTitle } from "./hud.js";

const busy = new Set(); // players currently in a cinematic

function cmd(entity, command) {
  try {
    entity.runCommand(command);
  } catch {
    try {
      entity.runCommandAsync(command);
    } catch {
      /* ignore */
    }
  }
}

function fx(dim, id, loc, color) {
  try {
    if (color) {
      const v = new MolangVariableMap();
      v.setColorRGB("variable.color", { red: color[0], green: color[1], blue: color[2] });
      dim.spawnParticle(id, loc, v);
    } else dim.spawnParticle(id, loc);
  } catch {
    /* unloaded / unknown particle */
  }
}

export function sfx(dim, id, loc, volume = 1, pitch = 1) {
  try {
    dim.playSound(id, loc, { volume, pitch });
  } catch {
    /* ignore */
  }
}

const valid = (e) => {
  try {
    return typeof e.isValid === "function" ? e.isValid() : e.isValid;
  } catch {
    return false;
  }
};
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const f3 = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;
const rgb255 = (c) => c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(" ");

export function shake(dim, pos, intensity = 0.3, seconds = 0.5, radius = 24) {
  try {
    for (const p of dim.getPlayers({ location: pos, maxDistance: radius })) {
      cmd(p, `camerashake add @s ${Math.min(4, intensity).toFixed(2)} ${seconds.toFixed(2)} positional`);
    }
  } catch {
    /* ignore */
  }
}

function camera(p, pos, facing, ease = 0) {
  cmd(p, `camera @s set minecraft:free${ease > 0 ? ` ease ${ease} in_out_sine` : ""} pos ${f3(pos)} facing ${f3(facing)}`);
}

export function fogFor(color) {
  const [r, g, b] = color;
  if (r > 0.8 && g > 0.6 && b < 0.4) return "orange";
  if (r > 0.7 && g < 0.5 && b < 0.4) return g > 0.3 ? "orange" : "red";
  if (g > r && g > b) return "green";
  if (b > r && b > g) return r > 0.45 ? "purple" : "blue";
  if (r > 0.5 && b > 0.5) return "purple";
  if (r < 0.25 && g < 0.25 && b < 0.25) return "dark";
  return "red";
}

function pushFog(p, name, tag) {
  cmd(p, `fog @s push aegis:fog_${name} ${tag}`);
}
function popFog(p, tag) {
  cmd(p, `fog @s remove ${tag}`);
}

// Spinning vortex + lightning streaks around an entity (call every few ticks).
export function aura(entity, color, strong = false) {
  if (!valid(entity)) return;
  const dim = entity.dimension;
  fx(dim, "aegis:cine_swirl", entity.location, color);
  if (strong || Math.random() < 0.5) fx(dim, "aegis:cine_bolt", add(entity.location, { x: 0, y: 1.1, z: 0 }), color);
}

// Shockwave for big hits.
export function impactFx(dim, pos, color = [1, 0.5, 0.1], power = 1) {
  fx(dim, "aegis:cine_ring", pos, color);
  fx(dim, "aegis:cine_flame", add(pos, { x: 0, y: 0.6, z: 0 }), color);
  if (power >= 1) {
    fx(dim, "aegis:cine_debris", pos);
    fx(dim, "aegis:cine_bolt", add(pos, { x: 0, y: 1, z: 0 }), color);
  }
  if (power >= 2) {
    system.runTimeout(() => fx(dim, "aegis:cine_ring", pos, color), 4);
    fx(dim, "aegis:cine_swirl", pos, color);
  }
  sfx(dim, power >= 2 ? "aegis.boom" : "aegis.impact", pos, Math.min(2.5, 0.8 + power * 0.5), power >= 2 ? 0.9 : 1.1);
  shake(dim, pos, 0.12 * power, 0.25 + 0.15 * power, 10 + power * 8);
}

// Elemental wind-up while a jutsu charges: vortex under the feet, chakra streaks and puffs.
export function chargeFx(player, color, ticks = 12, sound) {
  if (!valid(player)) return;
  if (sound) sfx(player.dimension, sound, player.location, 1.2, 1);
  for (let t = 0; t < ticks; t += 3) {
    system.runTimeout(() => {
      if (!valid(player)) return;
      const dim = player.dimension;
      fx(dim, "aegis:cine_swirl", player.location, color);
      fx(dim, "aegis:cine_bolt", add(player.location, { x: 0, y: 1, z: 0 }), color);
      if (t % 6 === 0) fx(dim, "aegis:beast_aura", player.location, color);
    }, t);
  }
  system.runTimeout(() => valid(player) && fx(player.dimension, "aegis:cine_flame", add(player.location, { x: 0, y: 1, z: 0 }), color), Math.max(0, ticks - 2));
}

// Quick cast flourish for regular jutsu.
export function castFx(player, color, sound) {
  if (!valid(player)) return;
  fx(player.dimension, "aegis:cine_ring", player.location, color);
  if (sound) sfx(player.dimension, sound, player.location, 1, 1);
}

// Tailed Beast awakening / rage: lightning pillars, vortex, tinted sky for nearby players, roar.
export function beastAwakenFx(boss, color) {
  if (!valid(boss)) return;
  const dim = boss.dimension;
  const center = { ...boss.location };
  sfx(dim, "aegis.roar", center, 3, 0.8);
  sfx(dim, "aegis.transform", center, 2.5, 0.8);
  shake(dim, center, 0.8, 1.6, 48);
  let players = [];
  try {
    players = dim.getPlayers({ location: center, maxDistance: 48 });
  } catch {
    /* ignore */
  }
  const tag = `aegis_beast_${Math.floor(Math.random() * 1e6)}`;
  for (const p of players) pushFog(p, fogFor(color), tag);
  for (let t = 0; t < 50; t += 3) {
    system.runTimeout(() => {
      if (!valid(boss)) return;
      const c = boss.location;
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * 3;
        fx(dim, "aegis:cine_pillar", add(c, { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }), color);
      }
      fx(dim, "aegis:cine_swirl", c, color);
      if (t % 9 === 0) fx(dim, "aegis:cine_debris", c);
      if (t % 12 === 0) fx(dim, "aegis:cine_flame", add(c, { x: 0, y: 2, z: 0 }), color);
    }, t);
  }
  system.runTimeout(() => {
    for (const p of players) if (valid(p)) popFog(p, tag);
  }, 120);
}

/**
 * Full transformation sequence (≈4.5s). Locks movement, takes over the camera, then gives it back.
 * opts: { color: [r,g,b], title, subtitle, fog (name), keepFogTicks }
 */
export function transformCinematic(player, opts) {
  if (!valid(player) || busy.has(player.id)) return false;
  busy.add(player.id);
  const color = opts.color ?? [1, 0.4, 0.1];
  const fog = opts.fog ?? fogFor(color);
  const dim = player.dimension;
  const base = { ...player.location };
  const d = player.getViewDirection();
  const fwd = (() => {
    const l = Math.hypot(d.x, d.z) || 1;
    return { x: d.x / l, y: 0, z: d.z / l };
  })();
  const at = (deg, dist, h) => {
    const a = (deg * Math.PI) / 180;
    const x = fwd.x * Math.cos(a) - fwd.z * Math.sin(a);
    const z = fwd.x * Math.sin(a) + fwd.z * Math.cos(a);
    return { x: base.x + x * dist, y: base.y + h, z: base.z + z * dist };
  };
  const chest = add(base, { x: 0, y: 1.2, z: 0 });
  const head = add(base, { x: 0, y: 1.6, z: 0 });
  const tag = `aegis_cine_${player.id.replace(/[^0-9a-z]/gi, "").slice(-8)}`;
  const run = (fn, t) =>
    system.runTimeout(() => {
      if (valid(player)) fn();
    }, t);

  cmd(player, "inputpermission set @s movement disabled");
  try {
    player.playAnimation("animation.aegis.power_up", { controller: "aegis_cinematic", blendOutTime: 0.3 });
  } catch {
    /* ignore */
  }
  // Phase 1 (0–36): orbiting camera, lightning pillars, debris, anime flames, rising charge.
  camera(player, at(35, 4.6, 1.8), chest);
  run(() => camera(player, at(-10, 4.0, 1.4), chest, 1.2), 2);
  run(() => camera(player, at(-55, 3.4, 1.0), head, 1.0), 26);
  sfx(dim, "aegis.charge", base, 1.6, 1);
  for (let t = 0; t < 36; t += 3) {
    run(() => {
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.8 + Math.random() * 2;
        fx(dim, "aegis:cine_pillar", add(base, { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }), color);
      }
      fx(dim, "aegis:cine_bolt", chest, color);
      if (t % 9 === 0) fx(dim, "aegis:cine_debris", base);
      if (t === 12 || t === 24) fx(dim, "aegis:cine_flame", chest, color);
      if (t % 12 === 0) sfx(dim, "aegis.lightning", base, 1.2, 0.9 + Math.random() * 0.3);
    }, t);
  }
  run(() => shake(dim, base, 0.25, 1.6, 16), 4);
  // Phase 2 (36–46): cut to black.
  run(() => {
    cmd(player, `camera @s fade time 0.25 0.4 0.6 color 0 0 0`);
    sfx(dim, "aegis.boom", base, 2, 0.7);
  }, 36);
  run(() => camera(player, at(0, 2.9, 1.0), head), 44);
  // Phase 3 (46+): reveal.
  run(() => {
    pushFog(player, fog, tag);
    sfx(dim, "aegis.transform", base, 2.2, 1);
    shake(dim, base, 0.7, 1.4, 20);
    fx(dim, "aegis:beast_burst", chest, color);
    fx(dim, "aegis:cine_ring", base, color);
    fx(dim, "aegis:cine_debris", base);
    for (let k = 0; k < 3; k++) fx(dim, "aegis:cine_flame", add(chest, { x: 0, y: k * 0.5, z: 0 }), color);
    if (opts.title) showTitle(player, opts.title, { subtitle: opts.subtitle, fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 15 });
  }, 46);
  run(() => camera(player, at(20, 6, 2.4), chest, 2.2), 50);
  for (let t = 46; t < 92; t += 3) {
    run(() => {
      fx(dim, "aegis:cine_swirl", player.location, color);
      fx(dim, "aegis:cine_bolt", add(player.location, { x: 0, y: 1.1, z: 0 }), color);
      if (t % 12 === 0) fx(dim, "aegis:cine_flame", add(player.location, { x: 0, y: 1, z: 0 }), color);
    }, t);
  }
  sfx(dim, "aegis.aura", base, 1, 1);
  const finish = () => {
    busy.delete(player.id);
    if (!valid(player)) return;
    cmd(player, "camera @s clear");
    cmd(player, "inputpermission set @s movement enabled");
  };
  system.runTimeout(finish, 92);
  system.runTimeout(() => valid(player) && popFog(player, tag), 92 + (opts.keepFogTicks ?? 60));
  return true;
}

export const inCinematic = (p) => busy.has(p?.id);

// Safety: if a player leaves mid-cinematic, give everything back when they return.
world.afterEvents.playerSpawn.subscribe(({ player }) => {
  busy.delete(player.id);
  cmd(player, "camera @s clear");
  cmd(player, "inputpermission set @s movement enabled");
});
