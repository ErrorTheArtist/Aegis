// Cinematics: Hollow Purple and each of the seven Domain Expansions has its own. What happens when (the camera, the
// titles, fades, shakes, particles and sounds) is data in cine_shots.js, storyboarded offline by tools/cine_board.py;
// this module plays it. The camera is Minecraft's free camera moved by commands from script (/camera,
// /camerashake, /fog, /inputpermission, /hud — no cheats needed).
//
//   Who watches: the caster (a player) from the start; players caught inside a domain from its `victim` tick, as the
//   domain is revealed around them (a character NPC's domain too). Nobody is pulled out of another cinematic, and
//   players in creative or spectator are left alone unless they cast it.
//   The world's side of it (particles, sounds, shakes) plays once for everyone near, watched or not.
//   While watching you can't walk, turn or use moves, the HUD is hidden, and a caster takes 60% less damage.
//   Death, leaving and respawning hand the camera back at once; a watchdog frees anyone a broken cinematic would
//   have left stuck (and anyone who left the game in the middle of one gets their camera back when they return).
//   Off switches: Record -> Settings (your own) and Admin Panel -> Server settings (everyone's).

import { world, system } from "@minecraft/server";
import { CINE } from "./cine_shots.js";
import { now, V, valid, isPlayer, getProp, setProp, worldProp, gameMode, title, effect, fxMust, sound, task, look, cmd, shake } from "./core.js";

const TAG = "jjk_cine"; // (the fog stack id of a cinematic's fog)
const busy = new Map(); // player id -> { film (token of the cinematic they watch), until (tick) }
export const inCinematic = (p) => busy.has(p?.id);
export const cinematicsOn = (p) => worldProp("cinematics", true) !== false && !getProp(p, "cine_off", false);
const f3 = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;
const rgb = (c) => c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(" ");

// [f, r, h] -> a world position: blocks in front of the subject, to its right and above its feet, at the start.
// Shots are framed on a player (eyes 1.62 blocks up); a character NPC is drawn at its own scale with its eyes 1.72
// blocks up at scale 1, so its heights are raised to match.
export function framer(subject, dir) {
  const base = { ...subject.location };
  const fwd = V.flat(dir ?? look(subject));
  const right = { x: -fwd.z, y: 0, z: fwd.x };
  let k = 1;
  if (!isPlayer(subject)) {
    try {
      k = Math.max(0.8, Math.min(1.6, (1.72 * (subject.getComponent("minecraft:scale")?.value ?? 1)) / 1.62));
    } catch {
      /* ignore */
    }
  }
  return (f, r, h) => ({ x: base.x + fwd.x * f + right.x * r, y: base.y + h * k, z: base.z + fwd.z * f + right.z * r });
}

// Every beat of a cinematic, by tick (built once per cinematic).
const timelines = {};
function timeline(kind) {
  if (timelines[kind]) return timelines[kind];
  const c = CINE[kind];
  const T = Array.from({ length: c.length + 1 }, () => ({ shots: [], text: [], fades: [], fx: [], sounds: [], shakes: [] }));
  for (const key of ["shots", "text", "fades", "fx", "sounds", "shakes"]) {
    for (const x of c[key] ?? []) if (x.t >= 0 && x.t <= c.length) T[x.t][key].push(x);
  }
  return (timelines[kind] = T);
}

function lock(p, film, until) {
  busy.set(p.id, { film, until });
  setProp(p, "cine", true);
  cmd(p, "inputpermission set @s movement disabled");
  cmd(p, "inputpermission set @s camera disabled");
  cmd(p, "hud @s hide all");
}
// Hands the camera, movement and HUD back.
export function release(p) {
  busy.delete(p?.id);
  if (!valid(p)) return;
  setProp(p, "cine", undefined);
  cmd(p, "camera @s clear");
  cmd(p, "inputpermission set @s movement enabled");
  cmd(p, "inputpermission set @s camera enabled");
  cmd(p, "hud @s reset");
  cmd(p, `fog @s remove ${TAG}`);
}
function shoot(p, s, at, cut) {
  const ease = !cut && s.ease > 0 ? ` ease ${s.ease} in_out_sine` : "";
  cmd(p, `camera @s set minecraft:free${ease} pos ${f3(at(...s.pos))} facing ${f3(at(...s.look))}`);
}

// Plays cinematic `kind` around `subject` (the caster). opts:
//   dir      the direction it's framed on (default: where the subject looks)
//   victims  () => players who join at the cinematic's `victim` tick
//   until    () => false ends it early (its domain collapsed, its caster died)
//   radius   how far its camera shakes reach (default 16)
// Returns true when the caster is watching it.
export function play(kind, subject, opts = {}) {
  const c = CINE[kind];
  if (!c || !valid(subject)) return false;
  const T = timeline(kind);
  const dim = subject.dimension;
  const at = framer(subject, opts.dir);
  const center = at(0, 0, 1);
  const film = {};
  const viewers = new Set();
  const join = (p, age, cast) => {
    if (!isPlayer(p) || !valid(p) || busy.has(p.id) || !cinematicsOn(p)) return;
    if (!cast && /creative|spectator/.test(gameMode(p))) return;
    lock(p, film, now() + (c.length - age) + 20);
    viewers.add(p);
    if (age > 0) { // joining part-way: straight to the shot that's running, flashing in from its colour
      let s;
      for (const x of c.shots) if (x.t < age) s = x;
      if (s) shoot(p, s, at, true);
      let fade;
      for (const x of c.fades ?? []) if (x.t < age) fade = x;
      cmd(p, `camera @s fade time 0 0.15 0.45 color ${rgb(fade?.color ?? c.color)}`);
      if (c.fog && age > (c.fogAt ?? 0)) cmd(p, `fog @s push jjk:fog_${c.fog} ${TAG}`);
    }
  };
  const end = () => {
    for (const p of viewers) if (busy.get(p.id)?.film === film) release(p);
    viewers.clear();
  };
  if (isPlayer(subject)) {
    join(subject, 0, true);
    if (viewers.has(subject)) effect(subject, "resistance", c.length + 5, 2);
  }
  const filmed = viewers.has(subject);
  task((age) => {
    try {
      if (opts.until && !opts.until()) return end(), false;
      if (age === c.victim && opts.victims) for (const p of opts.victims()) join(p, age, false);
      const b = T[Math.min(age, c.length)];
      for (const p of [...viewers]) {
        if (!valid(p) || busy.get(p.id)?.film !== film) {
          viewers.delete(p);
          continue;
        }
        for (const s of b.shots) shoot(p, s, at, false);
        for (const x of b.text) title(p, x.title, x.sub ?? "", x.stay ?? 30);
        for (const f of b.fades) cmd(p, `camera @s fade time ${f.in} ${f.hold} ${f.out} color ${rgb(f.color ?? c.color)}`);
        if (c.fog && age === (c.fogAt ?? 0)) cmd(p, `fog @s push jjk:fog_${c.fog} ${TAG}`);
      }
      // the world's side: everyone near sees and hears it
      for (const x of b.fx) fxMust(dim, `jjk:${x.id}`, at(...x.at), x.color ?? c.color, x.size ?? 1, x.vars);
      for (const x of b.sounds) sound(dim, x.id, center, x.volume ?? 1, x.pitch ?? 1);
      for (const x of b.shakes) shake(dim, center, x.power, x.secs, opts.radius ?? 16);
      if (age >= c.length) return end(), false;
      return true;
    } catch {
      end();
      return false;
    }
  }, c.length + 5);
  return filmed;
}

export function initCinematics() {
  const fresh = (p) => {
    if (busy.has(p.id) || getProp(p, "cine", false)) release(p);
  };
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (isPlayer(deadEntity) && busy.has(deadEntity.id)) release(deadEntity);
  });
  world.afterEvents.playerSpawn.subscribe(({ player }) => fresh(player));
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => busy.delete(playerId));
  // the watchdog
  system.runInterval(() => {
    if (!busy.size) return;
    for (const p of world.getAllPlayers()) if ((busy.get(p.id)?.until ?? Infinity) < now()) release(p);
  }, 20);
  // (after /reload, nobody is still watching anything)
  system.runTimeout(() => {
    for (const p of world.getAllPlayers()) if (!busy.has(p.id) && getProp(p, "cine", false)) release(p);
  }, 20);
}
export const _cine = { busy };
