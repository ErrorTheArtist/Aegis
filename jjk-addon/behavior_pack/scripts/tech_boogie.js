// Boogie Woogie (Todo's technique): clap, and two things swap places.
//   Boogie Woogie            swap places with whoever you're looking at (24 blocks).
//   Feint                    clap without swapping: everyone around flinches; you get a burst of speed.
//   Clap Barrage             (Grade 2) swap and strike, up to four times.
//   Vibe Swap: Black Flash   (Grade 1) swap in and land a guaranteed Black Flash.

import { V, fx, sound, task, aimed, foes, mid, anim, COLOR, effect, bar, tp, valid, alive } from "./core.js";
import { hurt, blackFlashed, BF_MULT } from "./combat.js";

function clap(p) {
  anim(p, "clap");
  sound(p.dimension, "random.click", p.location, 1, 0.5);
  sound(p.dimension, "block.bell.hit", p.location, 0.3, 1.8);
}

export function swap(p, t) {
  const a = { ...p.location };
  const b = { ...t.location };
  let rp;
  let rt;
  try {
    rp = p.getRotation();
    rt = t.getRotation();
  } catch {
    /* ignore */
  }
  if (p.dimension.id !== t.dimension.id) return false;
  tp(p, b, rp ? { rotation: rp } : undefined);
  tp(t, a, rt ? { rotation: rt } : undefined);
  for (const at of [a, b]) {
    fx(p.dimension, "jjk:ring", at, COLOR.gold, 0.9);
    fx(p.dimension, "jjk:spark", V.add(at, { x: 0, y: 1, z: 0 }), COLOR.gold, 0.6);
  }
  const d = V.flat(V.sub(b, a));
  fx(p.dimension, "jjk:streak", V.add(b, { x: 0, y: 1, z: 0 }), COLOR.gold, 0.8, { dx: d.x, dy: 0, dz: d.z }); // (the clap's after-image)
  sound(p.dimension, "mob.shulker.teleport", b, 0.8, 1.3);
  return true;
}

function swapMove(p) {
  const t = aimed(p, 24, 0.97);
  if (!t) {
    bar(p, "§7Look at someone to swap with.");
    return false;
  }
  clap(p);
  return swap(p, t);
}

function feint(p) {
  clap(p);
  for (const e of foes(p, p.location, 8)) {
    effect(e, "nausea", 60, 0);
    effect(e, "slowness", 20, 1);
    fx(e.dimension, "jjk:ring", e.location, COLOR.gold, 0.5);
  }
  effect(p, "speed", 40, 2);
  fx(p.dimension, "jjk:ring", p.location, COLOR.gold, 1.4);
  return true;
}

function barrage(p) {
  const list = foes(p, p.location, 12).sort((a, b) => V.dist(a.location, p.location) - V.dist(b.location, p.location));
  if (!list.length) {
    bar(p, "§7No one close enough for a barrage.");
    return false;
  }
  let n = 0;
  task((age) => {
    if (!alive(p)) return false;
    if (age % 10 !== 0) return true;
    const alive_ = list.filter((e) => alive(e));
    if (!alive_.length || n >= 4) return false;
    const t = alive_[n % alive_.length];
    clap(p);
    swap(p, t);
    hurt(p, t, 6);
    fx(t.dimension, "jjk:spark", mid(t), COLOR.gold, 1);
    n++;
    return n < 4;
  }, 50);
  return true;
}

function vibeSwap(p) {
  const t = aimed(p, 24, 0.97);
  if (!t) {
    bar(p, "§7Look at someone to swap with.");
    return false;
  }
  clap(p);
  swap(p, t);
  task((age) => {
    if (age < 3) return true;
    if (valid(t) && alive(p)) {
      anim(p, "black_flash");
      hurt(p, t, 10 * BF_MULT);
      blackFlashed(p, t);
    }
    return false;
  }, 5);
  return true;
}

export const BOOGIE = {
  boogie_swap: { name: "Boogie Woogie", cost: 10, cd: 1.5, grade: 0, run: swapMove, info: "Swap places with whoever you look at (24 blocks)." },
  boogie_feint: { name: "Feint", cost: 15, cd: 8, grade: 0, run: feint, info: "Everyone within 8 blocks reels; you get Speed III for 2 s." },
  clap_barrage: { name: "Clap Barrage", cost: 40, cd: 15, grade: 2, run: barrage, info: "Up to 4 swaps among enemies within 12 blocks, 6 damage each." },
  black_flash_swap: { name: "Vibe Swap: Black Flash", cost: 60, cd: 25, grade: 4, run: vibeSwap, info: "Swap in and land a guaranteed Black Flash (25)." },
};
