// Attacks only the cast uses (the rest of their arsenal is the players' own techniques — see sorcerers.js).
// Each is run(npc, target) and returns false if it couldn't be used.

import { V, fx, sound, foes, mid, knock, anim, COLOR, tp, alive, eye, later } from "./core.js";
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
  burst,
};
export const NPC_MOVE_NAMES = {
  divergent_fist: "Divergent Fist", black_flash_strike: "Black Flash", gorilla_core: "Gorilla Core", bird_strike: "Bird Strike",
  axe_cleave: "Axe Cleave", rika: "Rika", burst: "Burst",
};
