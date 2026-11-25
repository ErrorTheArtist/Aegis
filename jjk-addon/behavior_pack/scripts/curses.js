// Cursed spirits: exorcism XP, drops, the Finger Bearer's fight, and the night.
//
// XP for an exorcism:  Grade 4 Fly Head 10 · Grade 3 Lanky Curse 25 · Grade 2 Gaping Curse 60 · Grade 1 Hundred-Eyed
// Curse 150 · Special Grade Finger Bearer 1000 · any other monster 3 · another sorcerer 100. Kills by your shikigami
// count as yours.
// Drops: the Finger Bearer always drops one of Sukuna's Fingers (half the time a Cursed Womb too); a Hundred-Eyed Curse
// sometimes drops either.
// Night: curses gather where sorcerers are — every 30 s at night each player with fewer than 4 curses nearby draws one
// or two, stronger the higher their grade. Grade 1 sorcerers may draw the Finger Bearer itself. It leaves again if no one
// comes within 64 blocks of it for a minute.
// The Finger Bearer (1500 health): a roar that blasts everyone around it, finger spikes, Fly Heads, and below half
// health a field of cursed energy that burns everyone near it.

import { world, system, ItemStack } from "@minecraft/server";
import {
  getProp, bump, isPlayer, alive, valid, health, fx, sound, mid, V, knock, effect, COLOR, foes, byId, worldProp, tell, ground, now, sideOf,
} from "./core.js";
import { addXp, gradeOf, G } from "./grades.js";
import { hurt } from "./combat.js";
import { projectile } from "./projectile.js";

export const CURSE_XP = {
  "jjk:fly_head": 10, "jjk:lanky_curse": 25, "jjk:mouth_curse": 60, "jjk:eye_curse": 150, "jjk:finger_bearer": 1000,
};
const CURSE_NAME = {
  "jjk:fly_head": "Grade 4 curse", "jjk:lanky_curse": "Grade 3 curse", "jjk:mouth_curse": "Grade 2 curse", "jjk:eye_curse": "Grade 1 curse",
  "jjk:finger_bearer": "Special Grade curse",
};
const MONSTER = /zombie|skeleton|spider|creeper|witch|pillager|vindicator|evoker|ravager|phantom|drowned|husk|stray|slime|magma_cube|blaze|ghast|piglin|hoglin|zoglin|enderman|endermite|silverfish|guardian|shulker|vex|wither|warden|breeze|bogged|cave_spider/;

function killer(src) {
  let k = src?.damagingEntity;
  if (k && !isPlayer(k)) {
    const owner = getProp(k, "owner");
    k = owner ? byId(owner) : undefined;
  }
  return isPlayer(k) ? k : undefined;
}

function drop(dim, loc, id, n = 1) {
  try {
    dim.spawnItem(new ItemStack(id, n), loc);
  } catch {
    /* ignore */
  }
}

function onDeath(dead, src) {
  const t = dead.typeId;
  const p = killer(src);
  const at = { ...dead.location };
  const dim = dead.dimension;
  if (t in CURSE_XP) {
    fx(dim, "jjk:smoke", V.add(at, { x: 0, y: 0.8, z: 0 }), COLOR.dark, t === "jjk:finger_bearer" ? 3 : 1.2);
    if (t === "jjk:finger_bearer") {
      drop(dim, at, "jjk:sukuna_finger");
      if (Math.random() < 0.5) drop(dim, at, "jjk:cursed_womb");
      sound(dim, "mob.wither.death", at, 0.8, 1.3);
      try {
        world.sendMessage(`§4✦ §fThe Finger Bearer has been exorcised${p ? ` by ${p.name}` : ""}§f.`);
      } catch {
        /* ignore */
      }
    } else if (t === "jjk:eye_curse") {
      if (Math.random() < 0.02) drop(dim, at, "jjk:sukuna_finger");
      if (Math.random() < 0.04) drop(dim, at, "jjk:cursed_womb");
    }
    if (p) {
      addXp(p, CURSE_XP[t], `exorcised a ${CURSE_NAME[t]}`);
      bump(p, "exorcised");
    }
    return;
  }
  if (!p) return;
  if (isPlayer(dead)) {
    if (dead.id === p.id) return;
    addXp(p, 100, `defeated ${dead.name}`);
    bump(p, "sorcerers_beaten");
  } else if (MONSTER.test(t)) addXp(p, 3);
}

// ---------------------------------------------------------------------------
// The Finger Bearer
// ---------------------------------------------------------------------------
const bossState = new Map(); // entity id -> { roar, spikes, spawn, field, fieldUntil }
const victims = (boss, r) => foes(boss, boss.location, r).filter((e) => isPlayer(e) || getProp(e, "owner") || sideOf(e) === "ally");

function bossTick(boss) {
  const s = bossState.get(boss.id) ?? { roar: now() + 100, spikes: now() + 60, spawn: now() + 200, field: now() + 300, fieldUntil: 0, idle: 0 };
  bossState.set(boss.id, s);
  const h = health(boss);
  const enraged = h && h.currentValue < h.effectiveMax * 0.5;
  const dim = boss.dimension;
  // nobody within 64 blocks for a minute: it sinks back into the dark
  const anyone = dim.getEntities({ location: boss.location, maxDistance: 64, type: "minecraft:player" }).some((q) => alive(q));
  s.idle = anyone ? 0 : s.idle + 10;
  if (s.idle >= 1200) {
    fx(dim, "jjk:smoke", boss.location, COLOR.dark, 3);
    bossState.delete(boss.id);
    try {
      boss.remove();
    } catch {
      /* ignore */
    }
    return;
  }
  const near = victims(boss, 24);
  if (!near.length) return;
  if (enraged) effect(boss, "speed", 30, 0);
  if (now() >= s.roar) { // Cursed Roar
    s.roar = now() + (enraged ? 100 : 160);
    sound(dim, "mob.ravager.roar", boss.location, 2, 0.5);
    fx(dim, "jjk:ring", boss.location, COLOR.red, 3);
    fx(dim, "jjk:shell", mid(boss), COLOR.blood, 1, { radius: 8 });
    for (const e of victims(boss, 8)) {
      hurt(boss, e, 10, { flat: true });
      const d = V.flat(V.sub(e.location, boss.location));
      knock(e, d.x, d.z, 2, 0.6);
      effect(e, "slowness", 60, 1);
    }
  }
  if (now() >= s.spikes) { // finger spikes at the nearest sorcerer
    s.spikes = now() + (enraged ? 70 : 120);
    const t = near.sort((a, b) => V.dist(a.location, boss.location) - V.dist(b.location, boss.location))[0];
    const from = V.add(boss.location, { x: 0, y: 2.6, z: 0 });
    const dir = V.norm(V.sub(mid(t), from));
    sound(dim, "mob.blaze.shoot", from, 1, 0.6);
    projectile(boss, {
      from, dir, speed: 1.2, range: 28, radius: 1.2, filter: (e) => isPlayer(e) || getProp(e, "owner"),
      trail: (pos) => fx(dim, "jjk:orb", pos, COLOR.blood, 0.8),
      onHit: (at, target) => {
        if (target) hurt(boss, target, 12, { flat: true });
        fx(dim, "jjk:burst", at, COLOR.blood, 1);
      },
    });
  }
  if (now() >= s.spawn) { // its brood
    s.spawn = now() + 400;
    const brood = dim.getEntities({ location: boss.location, maxDistance: 24, type: "jjk:fly_head" }).length;
    if (brood < 4) {
      for (let i = 0; i < 2; i++) {
        try {
          dim.spawnEntity("jjk:fly_head", V.add(boss.location, { x: Math.random() * 4 - 2, y: 1, z: Math.random() * 4 - 2 }));
        } catch {
          /* ignore */
        }
      }
      fx(dim, "jjk:smoke", boss.location, COLOR.dark, 2);
    }
  }
  if (enraged && now() >= s.field) { // a field of cursed energy
    s.field = now() + 600;
    s.fieldUntil = now() + 120;
    sound(dim, "mob.wither.spawn", boss.location, 0.6, 0.6);
    for (const e of near) if (isPlayer(e)) tell(e, "§4The Finger Bearer floods the area with cursed energy!");
  }
  if (now() < s.fieldUntil) {
    fx(dim, "jjk:shell", mid(boss), COLOR.blood, 0.8, { radius: 10 });
    for (const e of victims(boss, 10)) hurt(boss, e, 3, { flat: true });
  }
}

function findBossSpot(p) {
  const a = Math.random() * Math.PI * 2;
  const r = 20 + Math.random() * 8;
  return ground(p.dimension, { x: p.location.x + Math.cos(a) * r, y: p.location.y + 8, z: p.location.z + Math.sin(a) * r }, 30);
}

export function spawnFingerBearer(p, quiet = false) {
  const at = quiet ? V.add(p.location, { x: 3, y: 0, z: 3 }) : findBossSpot(p);
  try {
    const b = p.dimension.spawnEntity("jjk:finger_bearer", at);
    fx(p.dimension, "jjk:shell", V.add(at, { x: 0, y: 1.5, z: 0 }), COLOR.blood, 1, { radius: 4 });
    sound(p.dimension, "mob.wither.spawn", at, 1, 0.8);
    if (!quiet) {
      try {
        world.sendMessage(`§4✦ §fA §4Special Grade§f curse has appeared near ${p.name}...`);
      } catch {
        /* ignore */
      }
    }
    return b;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Night surges
// ---------------------------------------------------------------------------
const SURGE = [
  ["jjk:fly_head", "jjk:fly_head", "jjk:lanky_curse"],
  ["jjk:fly_head", "jjk:lanky_curse", "jjk:lanky_curse", "jjk:mouth_curse"],
  ["jjk:lanky_curse", "jjk:mouth_curse", "jjk:mouth_curse", "jjk:eye_curse"],
  ["jjk:mouth_curse", "jjk:mouth_curse", "jjk:eye_curse"],
  ["jjk:mouth_curse", "jjk:eye_curse", "jjk:eye_curse"],
  ["jjk:eye_curse", "jjk:eye_curse", "jjk:mouth_curse"],
];
function isNight() {
  try {
    const t = world.getTimeOfDay();
    return t >= 13000 && t <= 23000;
  } catch {
    return false;
  }
}
function surge() {
  if (!worldProp("surges", true) || !isNight()) return;
  for (const p of world.getAllPlayers()) {
    if (!alive(p) || !getProp(p, "technique") || p.dimension?.id !== "minecraft:overworld") continue;
    let near = 0;
    try {
      near = p.dimension.getEntities({ location: p.location, maxDistance: 40, families: ["curse"] }).length;
    } catch {
      /* ignore */
    }
    if (near >= 4) continue;
    const g = gradeOf(p);
    const pool = SURGE[g];
    const n = 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 12;
      const at = ground(p.dimension, { x: p.location.x + Math.cos(a) * r, y: p.location.y + 10, z: p.location.z + Math.sin(a) * r }, 30);
      try {
        p.dimension.spawnEntity(pool[Math.floor(Math.random() * pool.length)], at);
      } catch {
        /* unloaded */
      }
    }
    // the Finger Bearer itself (Grade 1+, one at a time in the world)
    if (g >= G.ONE && worldProp("boss_spawns", true) && Math.random() < 0.03) {
      let bosses = 0;
      try {
        bosses = p.dimension.getEntities({ type: "jjk:finger_bearer" }).length;
      } catch {
        /* ignore */
      }
      if (!bosses) spawnFingerBearer(p);
    }
  }
}

export function initCurses() {
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      onDeath(deadEntity, damageSource);
    } catch {
      /* ignore */
    }
    bossState.delete(deadEntity?.id);
  });
  system.runInterval(() => {
    for (const dim of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
      let list = [];
      try {
        list = world.getDimension(dim).getEntities({ type: "jjk:finger_bearer" });
      } catch {
        continue;
      }
      for (const b of list) {
        if (!valid(b)) continue;
        try {
          bossTick(b);
        } catch {
          /* ignore */
        }
      }
    }
  }, 10);
  system.runInterval(surge, 600);
}
export const _test = { onDeath, bossTick, surge, bossState };
