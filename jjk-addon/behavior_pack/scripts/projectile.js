// Moving things: projectiles (Red, Fuga, the Finger Bearer's spikes) and effect entities that follow a path.

import { task, valid, V, solidAt, foes, mid, tp, removeFx } from "./core.js";

// Flies from `from` along `dir` at `speed` blocks a tick until it hits a wall, an enemy of `owner` (within `radius` of
// its centre) or runs `range` blocks. trail(pos, age) runs every tick; onHit(pos, target?) once at the end.
export function projectile(owner, { from, dir, speed, range, radius = 1.2, entity, trail, onHit, filter }) {
  const dim = owner.dimension;
  let pos = { ...from };
  let travelled = 0;
  const finish = (at, target) => {
    removeFx(entity);
    try {
      onHit?.(at, target);
    } catch {
      /* ignore */
    }
  };
  task((age) => {
    if (!valid(owner)) {
      removeFx(entity);
      return false;
    }
    const step = Math.min(speed, range - travelled);
    const n = Math.max(1, Math.ceil(step / 0.5));
    for (let i = 0; i < n; i++) {
      pos = V.add(pos, V.mul(dir, step / n));
      travelled += step / n;
      if (solidAt(dim, pos)) {
        finish(pos);
        return false;
      }
      const hit = closestFoe(owner, pos, radius, filter);
      if (hit) {
        finish(pos, hit);
        return false;
      }
    }
    if (entity) tp(entity, pos);
    try {
      trail?.(pos, age);
    } catch {
      /* ignore */
    }
    if (travelled >= range - 1e-6) {
      finish(pos);
      return false;
    }
    return true;
  }, Math.ceil(range / speed) + 5);
}

export function closestFoe(owner, pos, radius, filter) {
  let best;
  let bd = 1e9;
  for (const e of foes(owner, pos, radius + 1.2)) {
    if (filter && !filter(e)) continue;
    const d = V.dist(mid(e), pos);
    if (d <= radius && d < bd) {
      best = e;
      bd = d;
    }
  }
  return best;
}

// Everyone of owner's enemies within `width` of the segment a→b (measured to their middle).
export function alongLine(owner, a, b, width) {
  const len = V.dist(a, b);
  const c = V.mul(V.add(a, b), 0.5);
  return foes(owner, c, len / 2 + width + 1.5).filter((e) => V.segment(mid(e), a, b).d <= width);
}
