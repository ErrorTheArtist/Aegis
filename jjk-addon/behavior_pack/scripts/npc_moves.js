// Attacks only the cast uses (the rest of their arsenal is the players' own techniques — see sorcerers.js).
// Each is run(npc, target) and returns false if it couldn't be used.

import { V, fx, sound, task, foes, mid, knock, anim, COLOR, effect, spawnFx, removeFx, tp, valid, alive, ground, look, eye, later } from "./core.js";
import { hurt, blackFlashFx, BF_MULT, stun } from "./combat.js";
import { projectile } from "./projectile.js";

const near = (e, t, r) => alive(t) && V.dist(e.location, t.location) <= r;

// Yuji: a punch, and the cursed energy lands a beat later
function divergentFist(e, t) {
  if (!near(e, t, 4.5)) return false;
  anim(e, "black_flash");
  hurt(e, t, 8);
  fx(t.dimension, "jjk:burst", mid(t), COLOR.ce, 0.6);
  later(() => {
    if (!alive(t)) return;
    hurt(e, t, 7);
    fx(t.dimension, "jjk:ring", mid(t), COLOR.ce, 0.8);
    sound(t.dimension, "random.explode", t.location, 0.4, 1.7);
  }, 12);
  return true;
}

// Yuji, Yuta: a Black Flash, on purpose
function blackFlashStrike(e, t) {
  if (!near(e, t, 4.5)) return false;
  anim(e, "black_flash");
  hurt(e, t, 10 * BF_MULT);
  blackFlashFx(e, t);
  return true;
}

// Panda: Gorilla Core — one huge two-handed blow
function gorillaCore(e, t) {
  if (!near(e, t, 4)) return false;
  anim(e, "black_flash");
  for (const x of foes(e, e.location, 4)) {
    hurt(e, x, 12);
    const d = V.flat(V.sub(x.location, e.location));
    knock(x, d.x, d.z, 1.8, 0.5);
  }
  fx(e.dimension, "jjk:ring", e.location, COLOR.white, 1.5);
  sound(e.dimension, "mob.ravager.roar", e.location, 0.8, 1.3);
  return true;
}

// Mei Mei: Bird Strike — a crow dives into the target and bursts
function birdStrike(e, t) {
  if (!near(e, t, 30)) return false;
  const from = V.add(eye(e), { x: 0, y: 1, z: 0 });
  const dir = V.norm(V.sub(mid(t), from));
  sound(e.dimension, "mob.phantom.swoop", from, 1, 1.5);
  projectile(e, {
    from, dir, speed: 2.0, range: 32, radius: 1.3,
    trail: (pos) => fx(e.dimension, "jjk:orb", pos, COLOR.black, 0.7),
    onHit: (at) => {
      for (const x of foes(e, at, 3.5)) hurt(e, x, 16);
      fx(e.dimension, "jjk:burst", at, COLOR.dark, 1.6);
      fx(e.dimension, "jjk:spark", at, COLOR.gold, 1);
      sound(e.dimension, "random.explode", at, 1, 1.2);
    },
  });
  return true;
}

// Mei Mei: her battle-axe in a wide arc
function axeCleave(e, t) {
  if (!near(e, t, 4.5)) return false;
  anim(e, "tool_spin");
  for (const x of foes(e, e.location, 4.5)) hurt(e, x, 10);
  fx(e.dimension, "jjk:slash", mid(e), COLOR.white, 1.6);
  sound(e.dimension, "item.trident.throw", e.location, 1, 0.8);
  return true;
}

// Yuta: Rika manifests for a moment and tears into everything near
function rika(e, t) {
  if (!near(e, t, 8)) return false;
  anim(e, "summon");
  fx(e.dimension, "jjk:shell", mid(e), COLOR.dark, 1.2, { radius: 4 });
  sound(e.dimension, "mob.warden.roar", e.location, 1, 1.2);
  later(() => {
    for (const x of foes(e, e.location, 6)) {
      hurt(e, x, 18);
      fx(x.dimension, "jjk:spark", mid(x), COLOR.white, 1);
    }
    fx(e.dimension, "jjk:smoke", e.location, COLOR.dark, 2.4);
  }, 10);
  return true;
}

// Geto: Cursed Spirit Manipulation — releases two of the curses he has swallowed
function curseRelease(e, t) {
  if (!near(e, t, 20)) return false;
  anim(e, "summon");
  for (let i = 0; i < 2; i++) {
    const a = Math.random() * Math.PI * 2;
    const at = ground(e.dimension, { x: e.location.x + Math.cos(a) * 2, y: e.location.y + 2, z: e.location.z + Math.sin(a) * 2 }, 6);
    try {
      e.dimension.spawnEntity(i ? "jjk:lanky_curse" : "jjk:mouth_curse", at);
    } catch {
      /* ignore */
    }
    fx(e.dimension, "jjk:smoke", at, COLOR.dark, 1.2);
  }
  sound(e.dimension, "mob.wither.ambient", e.location, 0.8, 0.8);
  return true;
}

// Geto: Maximum: Uzumaki — every curse he holds, compressed into one spiralling blast
function uzumaki(e, t) {
  if (!near(e, t, 24)) return false;
  anim(e, "purple");
  const dim = e.dimension;
  task((age) => {
    if (!alive(e)) return false;
    if (age < 14) {
      if (age % 2 === 0) fx(dim, "jjk:implode", V.add(eye(e), V.mul(look(e), 1.5)), COLOR.shadow, 1, { radius: 2.5 });
      return true;
    }
    const from = V.add(eye(e), V.mul(look(e), 1.5));
    const dir = valid(t) ? V.norm(V.sub(mid(t), from)) : look(e);
    const hit = new Set();
    for (let d = 1; d <= 22; d += 1) {
      const at = V.add(from, V.mul(dir, d));
      for (const x of foes(e, at, 2.2)) {
        if (hit.has(x.id)) continue;
        hit.add(x.id);
        hurt(e, x, 24);
      }
      if (d % 2 === 0) fx(dim, "jjk:burst", at, COLOR.shadow, 0.8);
    }
    sound(dim, "random.explode", from, 1.2, 0.6);
    return false;
  }, 16);
  return true;
}

// Mahito: Idle Transfiguration — a touch that reshapes the soul
function idleTransfiguration(e, t) {
  if (!near(e, t, 3.5)) return false;
  anim(e, "point");
  hurt(e, t, 14);
  effect(t, "nausea", 120, 0);
  effect(t, "slowness", 80, 1);
  fx(t.dimension, "jjk:aura", t.location, COLOR.shadow, 1.6);
  sound(t.dimension, "mob.zombie.unfect", t.location, 0.8, 0.7);
  return true;
}

// Mahito: spikes burst from his body
function soulSpikes(e, t) {
  if (!near(e, t, 4)) return false;
  for (const x of foes(e, e.location, 4)) {
    hurt(e, x, 10);
    const d = V.flat(V.sub(x.location, e.location));
    knock(x, d.x, d.z, 1, 0.3);
  }
  fx(e.dimension, "jjk:spark", mid(e), COLOR.grey, 1.8);
  sound(e.dimension, "random.anvil_land", e.location, 0.5, 0.6);
  return true;
}

// Jogo: ember insects — little bugs of flame that burst on contact
function emberInsects(e, t) {
  if (!near(e, t, 24)) return false;
  anim(e, "point");
  const from = V.add(eye(e), V.mul(look(e), 1));
  for (const off of [-0.25, 0, 0.25]) {
    const d = V.norm(V.sub(mid(t), from));
    const dir = V.norm({ x: d.x + off * d.z, y: d.y + 0.05, z: d.z - off * d.x });
    projectile(e, {
      from, dir, speed: 1.4, range: 26, radius: 1.2,
      trail: (pos) => fx(e.dimension, "jjk:orb", pos, COLOR.fire, 0.6),
      onHit: (at, x) => {
        if (x) {
          hurt(e, x, 8);
          try {
            x.setOnFire(4, true);
          } catch {
            /* ignore */
          }
        }
        fx(e.dimension, "jjk:burst", at, COLOR.fire, 0.7);
      },
    });
  }
  sound(e.dimension, "mob.blaze.shoot", from, 1, 1);
  return true;
}

// Jogo: Maximum: Meteor — a burning mountain falls on them
function meteor(e, t) {
  if (!near(e, t, 24)) return false;
  anim(e, "domain_sign");
  const dim = e.dimension;
  const spot = ground(dim, t.location, 8);
  const top = V.add(spot, { x: 0, y: 16, z: 0 });
  const rock = spawnFx(dim, "jjk:orb", top, "jjk:as_fire");
  sound(dim, "mob.ghast.warn", spot, 1.4, 0.6);
  task((age) => {
    const u = Math.min(1, age / 20);
    if (valid(rock)) tp(rock, { x: spot.x, y: top.y - 15 * u * u, z: spot.z });
    if (age % 4 === 0) fx(dim, "jjk:ring", spot, COLOR.fire, 2.5 - u);
    if (age < 20) return true;
    for (const x of foes(e, spot, 6)) {
      hurt(e, x, 24);
      try {
        x.setOnFire(6, true);
      } catch {
        /* ignore */
      }
    }
    fx(dim, "jjk:burst", spot, COLOR.fire, 3);
    fx(dim, "jjk:smoke", spot, COLOR.dark, 3);
    sound(dim, "random.explode", spot, 1.6, 0.5);
    removeFx(rock);
    return false;
  }, 24);
  return true;
}

// Toji: speed — he closes any gap in an instant
function burst(e, t) {
  if (!alive(t) || V.dist(e.location, t.location) < 4) return false;
  const d = V.flat(V.sub(t.location, e.location));
  tp(e, { x: t.location.x - d.x * 1.5, y: t.location.y, z: t.location.z - d.z * 1.5 }, { facingLocation: mid(t) });
  fx(e.dimension, "jjk:smoke", e.location, COLOR.grey, 0.8);
  sound(e.dimension, "mob.phantom.swoop", e.location, 0.6, 1.8);
  stun(t, 6);
  return true;
}

export const NPC_MOVES = {
  divergent_fist: divergentFist,
  black_flash_strike: blackFlashStrike,
  gorilla_core: gorillaCore,
  bird_strike: birdStrike,
  axe_cleave: axeCleave,
  rika,
  curse_release: curseRelease,
  uzumaki,
  idle_transfiguration: idleTransfiguration,
  soul_spikes: soulSpikes,
  ember_insects: emberInsects,
  meteor,
  burst,
};
export const NPC_MOVE_NAMES = {
  divergent_fist: "Divergent Fist", black_flash_strike: "Black Flash", gorilla_core: "Gorilla Core", bird_strike: "Bird Strike",
  axe_cleave: "Axe Cleave", rika: "Rika", curse_release: "Curse Release", uzumaki: "Maximum: Uzumaki", idle_transfiguration: "Idle Transfiguration",
  soul_spikes: "Soul Spikes", ember_insects: "Ember Insects", meteor: "Maximum: Meteor", burst: "Burst",
};
