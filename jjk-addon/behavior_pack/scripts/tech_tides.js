// Disaster Tides (Dagon's technique) — Cursed Spirits only. The sea, and everything that lives in it.
//   Death Swarm      a school of shikigami fish surges at who you aim at (or 10 blocks ahead): three bites of 4.
//   Tidal Wave       a wave rolls 8 blocks out in front of you: 7 damage, swept away, fires put out.
//   Undertow         (Grade 2) the tide drags everyone within 10 blocks to you: 6 damage, slowed and heavy for 3 s.
//   Horizon of the Captivating Skandha   (Grade 1) Domain Expansion: a beach without end, radius 12, 9 s. Shikigami fish
//                    bite everyone inside, 3 a second, and slow them; you move fast and breathe water.

import { V, eye, look, fx, fxMust, sound, task, aimed, foes, inCone, mid, anim, COLOR, effect, alive, rayEnd, knock } from "./core.js";
import { hurt } from "./combat.js";
import { expand, registerDomain } from "./domains.js";

const SEA = COLOR.water;
const FOAM = [0.85, 0.95, 1];

function swarm(p) {
  anim(p, "point");
  const dim = p.dimension;
  const t = aimed(p, 14);
  const point = t ? mid(t) : rayEnd(dim, eye(p), look(p), 10).at;
  const at = () => (t && alive(t) ? mid(t) : point);
  const d = look(p);
  fx(dim, "jjk:streak", V.add(eye(p), V.mul(d, 1.2)), SEA, 1, { dx: -d.x, dy: -d.y, dz: -d.z }); // (rushing out ahead)
  sound(dim, "bucket.empty_water", p.location, 1, 1.2);
  task((age) => {
    if (!alive(p)) return false;
    if (age % 4 === 0) fx(dim, "jjk:fish", at(), SEA, 1);
    if (age % 10 === 5) { // three bites, a hurt-cooldown apart
      for (const e of foes(p, at(), 2.6, dim)) {
        hurt(p, e, 4);
        fx(dim, "jjk:blood", mid(e), COLOR.blood, 0.4);
      }
      sound(dim, "mob.fish.flop", at(), 1, 0.8);
    }
    return age < 26;
  }, 30);
  return true;
}

function wave(p) {
  anim(p, "point");
  const dim = p.dimension;
  const f = V.flat(look(p));
  const start = { ...p.location };
  for (const e of inCone(p, 8, 0.55)) {
    hurt(p, e, 7);
    knock(e, f.x, f.z, 2.2, 0.45);
    try {
      e.extinguishFire?.(true);
    } catch {
      /* ignore */
    }
  }
  task((age) => {
    const at = V.add(start, { x: f.x * (1.5 + age * 1.1), y: 0.6, z: f.z * (1.5 + age * 1.1) });
    fx(dim, "jjk:smoke", at, FOAM, 1.1);
    fx(dim, "jjk:burst", at, SEA, 0.7);
    return age < 6;
  }, 8);
  sound(dim, "random.splash", start, 1.2, 0.7);
  return true;
}

function undertow(p) {
  anim(p, "summon");
  const dim = p.dimension;
  const c = { ...p.location };
  fxMust(dim, "jjk:ring", c, SEA, 3);
  fx(dim, "jjk:vortex", V.add(c, { x: 0, y: 1, z: 0 }), SEA, 1.5, { radius: 6 });
  for (const e of foes(p, c, 10, dim)) {
    const d = V.sub(c, e.location);
    const l = Math.hypot(d.x, d.z) || 1;
    knock(e, d.x / l, d.z / l, Math.min(2.4, l * 0.28), 0.2);
    hurt(p, e, 6);
    effect(e, "slowness", 60, 2);
    effect(e, "mining_fatigue", 60, 1);
    fx(dim, "jjk:fish", mid(e), SEA, 0.8);
  }
  sound(dim, "ambient.underwater.enter", c, 1, 0.6);
  return true;
}

registerDomain("tides", { name: "Horizon of the Captivating Skandha", tech: "disaster_tides", radius: 12, ticks: 180, color: SEA, dome: "tides" },
  (d, victims, every, k) => {
    if (every(20)) {
      for (const e of victims) {
        hurt(d.caster, e, 3 * k, { sure: true });
        effect(e, "slowness", 25, 1);
        fx(d.dim, "jjk:fish", mid(e), SEA, 1);
      }
      effect(d.caster, "speed", 30, 1);
      effect(d.caster, "water_breathing", 40, 0);
    }
    if (every(60)) sound(d.dim, "random.splash", d.center, 0.8, 0.6);
  },
  () => {});

export const DISASTER_TIDES = {
  tide_swarm: { name: "Death Swarm", cost: 22, cd: 7, grade: 0, run: swarm,
    info: "A school of shikigami fish surges at who you aim at (or 10 blocks ahead): three bites of 4." },
  tide_wave: { name: "Tidal Wave", cost: 25, cd: 9, grade: 0, run: wave, info: "A wave rolls 8 blocks out in front of you: 7 damage, swept away, fires put out." },
  tide_undertow: { name: "Undertow", cost: 40, cd: 18, grade: 2, run: undertow, info: "Everyone within 10 blocks is dragged to you: 6 damage, slowed and heavy for 3 s." },
  horizon_skandha: { name: "Domain Expansion: Horizon of the Captivating Skandha", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "tides"),
    info: "Radius 12, 9 s: shikigami fish bite everyone inside for 3 a second and slow them; you move fast and breathe water." },
};
