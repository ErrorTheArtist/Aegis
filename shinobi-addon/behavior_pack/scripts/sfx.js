// Foley: the sounds of the body, cued from the animations. Every time a jutsu animation plays (for players, bosses
// and clash fighters alike) its hand seals snap, thrusts swish, leaps take off and land, the chest fills before a
// breath jutsu… The element / technique sounds themselves are played by each jutsu.
// Sounds come from tools/gen_jutsu_sounds.py. A cue is [ticks after the animation starts, sound, volume, pitch].

import { system } from "@minecraft/server";

const seals = (ticks, vol = 0.7) => ticks.map((t, i) => [t, "aegis.handsign", vol, 0.9 + (i % 3) * 0.1]);
const steps = (n, every = 4) => Array.from({ length: n }, (_, i) => [i * every, "aegis.step", 0.7, 0.9 + (i % 2) * 0.15]);

const CUES = {
  hand_signs: seals([4, 7, 9]),
  fireball_jutsu: [...seals([1, 3, 5]), [8, "aegis.inhale", 0.9, 1]],
  jutsu_breath: [[3, "aegis.inhale", 0.9, 1]],
  phoenix_breath: [[2, "aegis.leap", 0.8, 1.1], [19, "aegis.land", 0.8, 1.1]],
  ram_strike: [[3, "aegis.swish", 0.9, 0.9]],
  palm_thrust: [[2, "aegis.swish", 0.8, 1.1]],
  both_palms: [[3, "aegis.swish", 0.9, 0.85]],
  earth_slam: [[2, "aegis.leap", 0.9, 0.9], [7, "aegis.land", 1, 0.9]],
  throw_overhead: [[20, "aegis.swish", 1, 0.8]],
  substitution: seals([1], 0.8),
  clone_seal: [...seals([2], 0.9), [14, "aegis.poof", 0.9, 1]],
  body_flicker: seals([1], 0.7),
  wind_palm: [[1, "aegis.spin", 0.9, 1.1], [5, "aegis.swish", 0.9, 0.8]],
  water_seals: seals([1, 3, 5, 8, 10, 12], 0.6),
  summon_slam: [[7, "aegis.swish", 0.7, 1], [10, "aegis.land", 0.9, 1]],
  pull: [[7, "aegis.swish", 0.8, 1.2]],
  eye_activate: [[7, "aegis.eye", 1.1, 1]],
  shadow_seal: seals([2]),
  mind_seal: seals([3]),
  expansion: [[10, "aegis.land", 0.9, 0.8]],
  fang_drill: [[3, "aegis.spin", 1, 1.3], [8, "aegis.spin", 1, 1.4]],
  chains_cast: seals([3, 12]),
  kirin_call: [[26, "aegis.swish", 0.9, 0.7], [29, "aegis.land", 0.9, 1]],
  chidori_spear: [[10, "aegis.swish", 0.9, 1]],
  ice_seal: seals([3]),
  sword_slash: [[3, "aegis.swish", 0.9, 1.2]],
  sword_overhead: [[3, "aegis.leap", 0.8, 1.1], [8, "aegis.land", 0.8, 1.1]],
  sword_thrust: [[3, "aegis.swish", 0.9, 1.3]],
  sword_spin: [[1, "aegis.spin", 1, 1], [6, "aegis.spin", 0.8, 1.15]],
  sword_raise: [[13, "aegis.swish", 0.9, 0.9]],
  // M1 combos (the hit sound itself is played by m1.js)
  m1_jab: [[0, "aegis.swish", 0.6, 1.4]],
  m1_cross: [[0, "aegis.swish", 0.6, 1.25]],
  m1_kick: [[0, "aegis.swish", 0.8, 1]],
  m1_finisher: [[1, "aegis.leap", 0.7, 1.2], [8, "aegis.land", 0.6, 1.2]],
  m1_slash1: [[0, "aegis.swish", 0.8, 1.3]],
  m1_slash2: [[0, "aegis.swish", 0.8, 1.15]],
  m1_slash3: [[0, "aegis.swish", 0.9, 0.9], [3, "aegis.land", 0.6, 1.2]],
  // Jutsu Clash
  clash_charge_chidori: [[8, "aegis.swish", 0.8, 0.8]],
  clash_charge_orb: seals([3], 0.6),
  clash_run_chidori: steps(8),
  clash_run_orb: steps(8),
  clash_leap: [[0, "aegis.leap", 1.2, 0.9]],
  clash_recoil: [[0, "aegis.swish", 1, 0.7], [8, "aegis.spin", 0.8, 0.8]],
  clash_land: [[2, "aegis.land", 1.1, 0.95]],
};

export function animSfx(entity, animation) {
  const cues = CUES[String(animation).replace("animation.aegis.", "").replace(/_m$/, "")];
  if (!cues) return;
  for (const [t, id, volume, pitch] of cues) {
    const play = () => {
      try {
        entity.dimension.playSound(id, entity.location, { volume, pitch });
      } catch {
        /* entity gone */
      }
    };
    if (t <= 0) play();
    else system.runTimeout(play, t);
  }
}
