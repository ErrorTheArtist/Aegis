// Domain Expansion (Grade 1): your innate domain made real for a few seconds. Everyone inside who isn't protected is
// hit by its sure-hit effect — no dodging, and Infinity doesn't help.
//   Unlimited Void        (Limitless)   barrier, radius 12, 8 s: everyone inside is frozen and takes +50% from you
//   Malevolent Shrine     (Shrine)      no barrier, radius 14, 10 s: endless slashes, and a Cleave every 1.5 s
//   Chimera Shadow Garden (Ten Shadows) barrier, radius 12, 10 s: they sink and slow; you get faster and tougher,
//                                       and two Divine Dogs rise out of the shadows
// It costs 70% of your maximum cursed energy. When it ends your technique burns out for 15 s (Reverse Cursed
// Technique and Simple Domain still work).
// Two domains that overlap CLASH: the stronger sorcerer (grade, cursed energy left, fingers, a little luck) keeps
// theirs, the other one collapses and burns out.
// Simple Domain (Grade 2): 8 s in which no sure-hit can touch you — at the cost of moving slowly.
// Heavenly Restriction has no cursed energy for a domain to lock on to: sure-hits never touch them.

import { world, system } from "@minecraft/server";
import {
  now, V, valid, alive, isPlayer, fx, sound, title, tell, bar, effect, clearEffect, spawnFx, removeFx, foes, mid, COLOR, look,
  getProp, health, anim, ground,
} from "./core.js";
import { gradeOf, fingersOf, maxCE } from "./grades.js";
import { getCE, isHeavenly, statusHooks } from "./energy.js";
import { hurt, stun, dmgHooks, infinityBlockers, suppressInfinity, capBoss } from "./combat.js";

export const DOMAIN_COST = 0.7; // of max CE
export const BURNOUT = 300; // ticks
export const KINDS = {
  void: { name: "Unlimited Void", tech: "limitless", radius: 12, ticks: 160, color: COLOR.blue, dome: "void" },
  shrine: { name: "Malevolent Shrine", tech: "shrine", radius: 14, ticks: 200, color: COLOR.red, dome: null },
  garden: { name: "Chimera Shadow Garden", tech: "ten_shadows", radius: 12, ticks: 200, color: COLOR.shadow, dome: "garden" },
};

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
function inside(d, e) {
  return e.dimension?.id === d.dim.id && V.dist(e.location, d.center) <= d.def.radius;
}
// Immune to a sure-hit: Heavenly Restriction, a Simple Domain, or standing in your own domain.
function protectedFrom(d, e) {
  if (isPlayer(e) && (isHeavenly(e) || inSimpleDomain(e))) return true;
  return active.some((o) => o !== d && o.caster.id === e.id && inside(o, e));
}
function power(p) {
  return gradeOf(p) + getCE(p) / Math.max(1, maxCE(p)) + fingersOf(p) * 0.05 + Math.random() * 1.5;
}

function announce(d, text, sub) {
  for (const p of world.getAllPlayers()) {
    if (inside(d, p) || p.id === d.caster.id) title(p, text, sub, 40);
  }
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
  sound(d.dim, "mob.wither.spawn", center, 0.5, 1.4);
  sound(d.dim, "beacon.activate", center, 1, 0.6);
  fx(d.dim, "jjk:shell", V.add(center, { x: 0, y: 1, z: 0 }), def.color, 1.4, { radius: def.radius });
  // clash with any domain that overlaps this one
  for (const o of [...active]) {
    if (o.dim.id !== d.dim.id || V.dist(o.center, center) > o.def.radius + def.radius) continue;
    const mine = power(p);
    const theirs = power(o.caster);
    for (const q of [p, o.caster]) title(q, "§5§lDOMAIN CLASH", `§f${def.name} §7vs §f${o.def.name}`, 40);
    fx(d.dim, "jjk:shell", V.add(o.center, { x: 0, y: 1, z: 0 }), o.def.color, 1.4, { radius: o.def.radius });
    sound(d.dim, "random.explode", center, 1, 0.5);
    if (mine >= theirs) {
      tell(o.caster, `§5Your domain was overwhelmed by ${p.name}'s ${def.name}!`);
      collapse(o, "§cYour domain shattered in the clash.");
    } else {
      tell(p, `§5${o.caster.name}'s ${o.def.name} overwhelms yours!`);
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
  announce(d, "§5§lDOMAIN EXPANSION", `§f${def.name}`);
  try {
    world.sendMessage(`§5✦ §f${p.name} §7opened their domain: §f${def.name}`);
  } catch {
    /* ignore */
  }
  return true;
}

export function collapse(d, why) {
  const i = active.indexOf(d);
  if (i < 0) return;
  active.splice(i, 1);
  for (const e of d.fx) removeFx(e);
  fx(d.dim, "jjk:shell", V.add(d.center, { x: 0, y: 1, z: 0 }), COLOR.grey, 1, { radius: d.def.radius });
  sound(d.dim, "random.glass", d.center, 1, 0.6);
  if (valid(d.caster)) {
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
  if (d.kind === "void") {
    for (const e of victims) {
      if (every(10)) {
        stun(e, 14);
        suppressInfinity(e, 14);
      }
      if (every(20)) {
        hurt(p, e, 2, { sure: true });
        fx(d.dim, "jjk:aura", e.location, COLOR.white, 1.5);
      }
    }
    if (every(20)) fx(d.dim, "jjk:shell", V.add(d.center, { x: 0, y: 1, z: 0 }), COLOR.white, 0.6, { radius: 3 });
  } else if (d.kind === "shrine") {
    for (const e of victims) {
      if (every(10)) {
        hurt(p, e, 4, { sure: true });
        fx(d.dim, "jjk:slash", mid(e), COLOR.white, 0.8);
        fx(d.dim, "jjk:blood", mid(e), COLOR.blood, 0.6);
      }
      if (every(30)) {
        const max = health(e)?.effectiveMax ?? 20;
        hurt(p, e, 6 + Math.min(15, max * 0.05), { sure: true });
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
  } else if (d.kind === "garden") {
    for (const e of victims) {
      if (every(20)) {
        hurt(p, e, 2, { sure: true });
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
  });
}

export function startSimpleDomain(p, ticks = 160) {
  simple.set(p.id, now() + ticks);
  effect(p, "slowness", ticks, 1);
  fx(p.dimension, "jjk:ring", p.location, COLOR.teal, 1.2);
  sound(p.dimension, "item.shield.block", p.location, 1, 0.7);
  anim(p, "stance");
}
export const _state = { active, burnout, simple, capBoss };
