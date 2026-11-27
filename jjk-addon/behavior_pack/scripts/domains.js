// Domain Expansion (Grade 1): your innate domain made real for a few seconds. Everyone inside who isn't protected is
// hit by its sure-hit effect — no dodging, and Infinity doesn't help.
//   Unlimited Void        (Limitless)   barrier, radius 12, 8 s: everyone inside is frozen and takes +50% from you
//   Malevolent Shrine     (Shrine)      no barrier, radius 14, 10 s: endless slashes, and a Cleave every 1.5 s
//   Chimera Shadow Garden (Ten Shadows) barrier, radius 12, 10 s: they sink and slow; you get faster and tougher,
//                                       and two Divine Dogs rise out of the shadows
//   Time Cell Moon Palace (Projection)  barrier, radius 12, 9 s: whoever moves inside takes 5 damage every second
//   Coffin of the Iron Mountain (Disaster Flames)  barrier, radius 12, 10 s: 3 damage a second, and everyone burns
//   Self-Embodiment of Perfection (Idle Transfiguration)  barrier, radius 11, 9 s: 3 a second, slowed and sick —
//                                       and a final 12 to whoever is still inside at the end
//   Idle Death Gamble     (Idle Death Gamble)  barrier, radius 12, 10 s: hurts no one; spins for a JACKPOT
//                                       (1 in 4 every 2 s) — a jackpot closes it with no burnout
//   Horizon of the Captivating Skandha  (Disaster Tides, Cursed Spirits only)  barrier, radius 12, 9 s: shikigami fish
//                                       bite everyone inside for 3 a second and slow them
// Those five live in their technique's own module (registerDomain).
// It costs 70% of your maximum cursed energy. When it ends your technique burns out for 15 s (Reverse Cursed
// Technique and Simple Domain still work).
// Two domains that overlap CLASH: the stronger sorcerer (grade, cursed energy left, fingers, a little luck) keeps
// theirs, the other one collapses and burns out.
// Simple Domain (Grade 2): 8 s in which no sure-hit can touch you — at the cost of moving slowly.
// Heavenly Restriction has no cursed energy for a domain to lock on to: sure-hits never touch them.
// Every domain opens with its own cinematic (cinematic.js, shot lists in cine_shots.js): the caster watches it all,
// players caught inside watch the domain revealed around them. From the reveal on, everyone inside sees the world
// through the domain's own fog (resource_pack/fogs/jjk_<kind>.json) until they leave or it closes.

import { world, system } from "@minecraft/server";
import {
  now, V, valid, alive, isPlayer, fx, fxMust, sound, title, tell, bar, effect, clearEffect, spawnFx, removeFx, foes, mid, COLOR, look,
  getProp, health, anim, ground, nameOf, cmd, isSafe,
} from "./core.js";
import { CINE } from "./cine_shots.js";
import { play } from "./cinematic.js";
import { gradeOf, fingersOf, maxCE } from "./grades.js";
import { getCE, isHeavenly, statusHooks } from "./energy.js";
import { hurt, stun, dmgHooks, infinityBlockers, suppressInfinity, capBoss } from "./combat.js";

export const DOMAIN_COST = 0.7; // of max CE
export const BURNOUT = 300; // ticks
export const REVEAL = 22; // ticks after it opens: the flash in its cinematic, when its fog rolls in
export const KINDS = {
  void: { name: "Unlimited Void", tech: "limitless", radius: 12, ticks: 160, color: COLOR.blue, dome: "void" },
  shrine: { name: "Malevolent Shrine", tech: "shrine", radius: 14, ticks: 200, color: COLOR.red, dome: null },
  garden: { name: "Chimera Shadow Garden", tech: "ten_shadows", radius: 12, ticks: 200, color: COLOR.shadow, dome: "garden" },
};

const CUSTOM = {}; // kind -> { tick(d, victims, every, k, age), end(d, why) } — domains added by technique modules
// A technique module adds its own domain: def = { name, tech, radius, ticks, color, dome (barrier texture) or null }.
export function registerDomain(kind, def, tick, end) {
  KINDS[kind] = def;
  CUSTOM[kind] = { tick, end };
}

const active = []; // { kind, def, caster, center, dim, start, until, fx: [entities] }
const burnout = new Map(); // player id -> tick
const simple = new Map(); // player id -> tick
let summonDogs = () => {}; // set by the Ten Shadows technique (avoids a circular import)
export const setDogSummoner = (f) => (summonDogs = f);

export const burnedOut = (p) => Math.max(0, (burnout.get(p.id) ?? 0) - now());
export const inSimpleDomain = (p) => (simple.get(p.id) ?? 0) > now();
export const domainOf = (p) => active.find((d) => d.caster.id === p.id);
export const activeDomains = () => active;
export function setBurnout(p, ticks) {
  burnout.set(p.id, now() + ticks);
}
export const insideDomain = (d, e) => inside(d, e);
export const shielded = (d, e) => protectedFrom(d, e); // (sure-hits never touch them)
function inside(d, e) {
  return e.dimension?.id === d.dim.id && V.dist(e.location, d.center) <= d.def.radius;
}
// Immune to a sure-hit: Heavenly Restriction, a Simple Domain, or standing in your own domain.
function protectedFrom(d, e) {
  if (isPlayer(e) && (isHeavenly(e) || inSimpleDomain(e))) return true;
  return active.some((o) => o !== d && o.caster.id === e.id && inside(o, e));
}
function power(p) {
  if (!isPlayer(p)) return getProp(p, "grade", 4) + 1 + Math.random() * 1.5; // a character NPC: its grade, at full strength
  return gradeOf(p) + getCE(p) / Math.max(1, maxCE(p)) + fingersOf(p) * 0.05 + Math.random() * 1.5;
}

function announce(d, text, sub, skip) {
  for (const p of world.getAllPlayers()) {
    if (p.id !== skip?.id && (inside(d, p) || p.id === d.caster.id)) title(p, text, sub, 40);
  }
}

// The domain's atmosphere: its fog for everyone inside, from the reveal until they leave or it closes.
const fogged = new Map(); // player id -> the domain whose fog they see
function atmosphere(d) {
  if (now() - d.start < REVEAL) return;
  for (const p of world.getAllPlayers()) {
    const isIn = inside(d, p);
    const cur = fogged.get(p.id);
    if (isIn && !cur) {
      cmd(p, `fog @s push jjk:fog_${d.kind} jjk_domain`);
      fogged.set(p.id, d);
    } else if (!isIn && cur === d) clearFog(p);
  }
}
function clearFog(p) {
  fogged.delete(p.id);
  cmd(p, "fog @s remove jjk_domain");
}

// Called by the technique's domain move after its cost is paid. Returns false if it fails to form.
export function expand(p, kind) {
  const def = KINDS[kind];
  if (domainOf(p)) {
    bar(p, "§cYour domain is already open.");
    return false;
  }
  const center = { ...p.location };
  const d = { kind, def, caster: p, center, dim: p.dimension, start: now(), until: now() + def.ticks, fx: [] };
  anim(p, "domain_sign");
  if (!CINE[kind]) { // (a domain with no cinematic of its own)
    sound(d.dim, "mob.wither.spawn", center, 0.5, 1.4);
    sound(d.dim, "beacon.activate", center, 1, 0.6);
    fx(d.dim, "jjk:shell", V.add(center, { x: 0, y: 1, z: 0 }), def.color, 1.4, { radius: def.radius });
  }
  // clash with any domain that overlaps this one
  for (const o of [...active]) {
    if (o.dim.id !== d.dim.id || V.dist(o.center, center) > o.def.radius + def.radius) continue;
    const mine = power(p);
    const theirs = power(o.caster);
    for (const q of [p, o.caster]) title(q, "§5§lDOMAIN CLASH", `§f${def.name} §7vs §f${o.def.name}`, 40);
    fx(d.dim, "jjk:shell", V.add(o.center, { x: 0, y: 1, z: 0 }), o.def.color, 1.4, { radius: o.def.radius });
    sound(d.dim, "random.explode", center, 1, 0.5);
    if (mine >= theirs) {
      tell(o.caster, `§5Your domain was overwhelmed by ${nameOf(p)}'s ${def.name}!`);
      collapse(o, "§cYour domain shattered in the clash.");
    } else {
      tell(p, `§5${nameOf(o.caster)}'s ${o.def.name} overwhelms yours!`);
      setBurnout(p, BURNOUT);
      bar(p, `§cYour domain failed to form. §7Burnout: ${BURNOUT / 20}s`, 60);
      return true; // the cost is still paid
    }
  }
  // the barrier (or, for the Shrine, the shrine itself behind you)
  if (def.dome) {
    const dome = spawnFx(d.dim, "jjk:domain_dome", ground(d.dim, center), `jjk:as_${def.dome}`);
    if (dome) d.fx.push(dome);
  } else {
    const back = V.flat(look(p));
    const at = ground(d.dim, { x: center.x - back.x * 7, y: center.y, z: center.z - back.z * 7 });
    const shrine = spawnFx(d.dim, "jjk:shrine", at);
    if (shrine) {
      try {
        shrine.teleport(at, { facingLocation: center });
      } catch {
        /* ignore */
      }
      d.fx.push(shrine);
    }
  }
  if (kind === "garden") summonDogs(p, true);
  active.push(d);
  let filmed = false;
  try {
    filmed = play(kind, p, {
      radius: def.radius + 4,
      until: () => active.includes(d),
      victims: () => world.getAllPlayers().filter((q) => q.id !== p.id && inside(d, q) && !isSafe(q)),
    });
  } catch {
    /* (a domain opens whatever happens to its cinematic) */
  }
  announce(d, "§5§lDOMAIN EXPANSION", `§f${def.name}`, filmed ? p : null);
  try {
    world.sendMessage(`§5✦ §f${nameOf(p)} §7opened their domain: §f${def.name}`);
  } catch {
    /* ignore */
  }
  return true;
}

export function collapse(d, why) {
  const i = active.indexOf(d);
  if (i < 0) return;
  active.splice(i, 1);
  try {
    CUSTOM[d.kind]?.end?.(d, why);
  } catch {
    /* ignore */
  }
  for (const e of d.fx) removeFx(e);
  for (const [id, o] of [...fogged]) {
    if (o !== d) continue;
    const q = world.getAllPlayers().find((x) => x.id === id);
    if (q) clearFog(q);
    else fogged.delete(id);
  }
  fxMust(d.dim, "jjk:shell", V.add(d.center, { x: 0, y: 1, z: 0 }), COLOR.grey, 1, { radius: d.def.radius });
  fxMust(d.dim, "jjk:flash", V.add(d.center, { x: 0, y: 1.5, z: 0 }), d.def.color, 1.6);
  sound(d.dim, "random.glass", d.center, 1, 0.6);
  if (valid(d.caster) && d.noBurnout) {
    bar(d.caster, why ?? "§7Your domain closes.", 50);
  } else if (valid(d.caster)) {
    setBurnout(d.caster, BURNOUT);
    if (d.kind === "garden") clearEffect(d.caster, "speed");
    bar(d.caster, `${why ?? "§7Your domain closes."} §cBurnout: ${BURNOUT / 20}s §7(no technique)`, 70);
  }
}

// Inverted Spear of Heaven: a domain's caster stabbed by it loses the domain on the spot.
export function breakDomain(p) {
  const d = domainOf(p);
  if (!d) return false;
  collapse(d, "§cYour domain was nullified!");
  return true;
}

function tickDomain(d) {
  const p = d.caster;
  const age = now() - d.start;
  if (!alive(p) || p.dimension?.id !== d.dim.id || V.dist(p.location, d.center) > d.def.radius + 6) return collapse(d, "§7You left your domain.");
  if (now() >= d.until) return collapse(d);
  const victims = foes(p, d.center, d.def.radius, d.dim).filter((e) => !protectedFrom(d, e));
  const every = (n) => age % n === 0;
  if (every(10)) atmosphere(d);
  const k = isPlayer(p) ? 1 : 0.5; // a character NPC's sure-hit lands at half strength
  if (d.kind === "void") {
    for (const e of victims) {
      if (every(10)) {
        stun(e, 14);
        suppressInfinity(e, 14);
      }
      if (every(20)) {
        hurt(p, e, 2 * k, { sure: true });
        fx(d.dim, "jjk:aura", e.location, COLOR.white, 1.5);
      }
    }
    if (every(20)) fx(d.dim, "jjk:shell", V.add(d.center, { x: 0, y: 1, z: 0 }), COLOR.white, 0.6, { radius: 3 });
  } else if (d.kind === "shrine") {
    for (const e of victims) {
      if (every(10)) {
        hurt(p, e, 4 * k, { sure: true });
        fx(d.dim, "jjk:slash", mid(e), COLOR.white, 0.8);
        fx(d.dim, "jjk:blood", mid(e), COLOR.blood, 0.6);
      }
      if (every(30)) {
        const max = health(e)?.effectiveMax ?? 20;
        hurt(p, e, (6 + Math.min(15, max * 0.05)) * k, { sure: true });
        fx(d.dim, "jjk:slash", mid(e), COLOR.red, 1.3);
      }
    }
    if (every(4)) {
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * d.def.radius;
        fx(d.dim, "jjk:slash", { x: d.center.x + Math.cos(a) * r, y: d.center.y + 0.5 + Math.random() * 3, z: d.center.z + Math.sin(a) * r },
          Math.random() < 0.5 ? COLOR.white : COLOR.red, 0.9 + Math.random());
      }
      if (every(20)) sound(d.dim, "item.trident.throw", d.center, 0.8, 1.6);
    }
    if (every(40)) fx(d.dim, "jjk:ring", d.center, COLOR.red, d.def.radius / 3);
  } else if (CUSTOM[d.kind]) {
    CUSTOM[d.kind].tick(d, victims, every, k, age);
  } else if (d.kind === "garden") {
    for (const e of victims) {
      if (every(20)) {
        hurt(p, e, 2 * k, { sure: true });
        effect(e, "slowness", 25, 2);
        fx(d.dim, "jjk:smoke", e.location, COLOR.dark, 1);
      }
    }
    if (every(20)) {
      effect(p, "speed", 30, 1);
      effect(p, "resistance", 30, 0);
    }
  }
}

export function initDomains() {
  system.runInterval(() => {
    for (const d of [...active]) {
      try {
        tickDomain(d);
      } catch {
        collapse(d);
      }
    }
  }, 1);
  // Simple Domain: a faint ring under your feet while it lasts
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (inSimpleDomain(p)) fx(p.dimension, "jjk:ring", p.location, COLOR.teal, 0.6);
    }
  }, 10);
  // +50% from the Void's caster to everyone frozen inside it
  dmgHooks.push((caster, target) => {
    const d = domainOf(caster);
    return d && d.kind === "void" && inside(d, target) ? 1.5 : 1;
  });
  infinityBlockers.push((p) => burnedOut(p) > 0);
  statusHooks.push((p) => {
    const d = domainOf(p);
    if (d) return `§5DOMAIN ${Math.ceil((d.until - now()) / 20)}s`;
    const b = burnedOut(p);
    if (b) return `§cBURNOUT ${Math.ceil(b / 20)}s`;
    return inSimpleDomain(p) ? "§3SIMPLE DOMAIN" : "";
  });
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => {
    for (const d of [...active]) if (d.caster.id === playerId) collapse(d);
    fogged.delete(playerId);
  });
  // (a domain's fog never outlives it: not after a respawn, nor in a world reopened while one was open — whoever is
  // still inside gets it back at the next check)
  world.afterEvents.playerSpawn.subscribe(({ player }) => clearFog(player));
}

export function startSimpleDomain(p, ticks = 160) {
  simple.set(p.id, now() + ticks);
  effect(p, "slowness", ticks, 1);
  fx(p.dimension, "jjk:ring", p.location, COLOR.teal, 1.2);
  sound(p.dimension, "item.shield.block", p.location, 1, 0.7);
  anim(p, "stance");
}
export const _state = { active, burnout, simple, capBoss, fogged };
