// Tailed Beast Mode transformation cinematic — the shot list. Pure data (no imports) so tools/jin_preview.py can render
// the storyboard offline from exactly what the game plays.
//
// Positions are (f, r, h): blocks in FRONT of the Jinchūriki, to their RIGHT, and ABOVE their feet. Times are game
// ticks (20 per second) from the moment the cloak goes on. A shot with ease = 0 is a cut; with ease > 0 the camera
// glides there over that many seconds.
//
// Everything is timed with the player animation (animation.aegis.jin_transform / _m) and the cloak's own "form"
// animation (tools/gen_jinchuriki.py: the shroud bubbles up at 1.18–1.6 s, the ears pop at 1.62 s, the tails sprout
// from 2.05 s, one every 0.13 s), so the shroud forms and the tails grow in front of the camera.
//
// Feral (V1): the seal burns — ba-dum 8, BA-DUM 17 — the chakra erupts 24 → down on all fours 41 → the tails sprout
// 41+ → coil 67 → ROAR 72 (shockwave) → hero shot, title 78 → camera and movement return 106.
// Mastered: calm in the Ram seal → golden flash 24 → the flames rise, the tails sprout 41+ → a shout of power 72 →
// confident stance, title 78 → 106.

export const EQUIP_LAG = 1; // the cloak goes on about a tick before the cinematic starts

export const FERAL = {
  ANIM: "animation.aegis.jin_transform",
  T: { heart: [8, 17], erupt: 24, fours: 41, tails: 41, tailGap: 2.6, coil: 67, roar: 72, title: 78, release: 106 },
  SHOTS: [
    { t: 0, name: "1 the seal burns", pos: [1.9, 0.4, 0.7], look: [0.1, 0, 0.95] },
    { t: 1, pos: [1.6, 0.3, 0.72], look: [0.15, 0, 0.92], ease: 1.1 },
    { t: 24, name: "2 the chakra erupts", pos: [3.0, 1.7, 0.35], look: [0, 0, 1.3] },
    { t: 25, pos: [3.4, 2.0, 0.5], look: [0, 0, 1.2], ease: 0.8 },
    { t: 41, name: "3 on all fours", pos: [2.2, -1.9, 0.5], look: [0.2, 0, 0.6] },
    { t: 46, name: "4 the tails", pos: [-2.3, 1.2, 1.7], look: [0, 0, 1.0] },
    { t: 47, pos: [-1.9, 2.3, 1.5], look: [0, 0, 1.05], ease: 1.0 },
    { t: 67, name: "5 coil", pos: [2.4, 0.4, 0.55], look: [0, 0, 0.95] },
    { t: 72, name: "6 ROAR", pos: [3.2, 0.5, 0.45], look: [0, 0, 1.45] },
    { t: 73, pos: [3.7, 0.6, 0.5], look: [0, 0, 1.45], ease: 0.5 },
    { t: 89, name: "7 Tailed Beast Mode", pos: [3.5, -2.3, 1.35], look: [0, 0, 1.15] },
    { t: 90, pos: [4.1, -2.7, 1.65], look: [0, 0, 1.2], ease: 0.8 },
  ],
  BEATS: [4, 17, 24, 30, 41, 50, 60, 67, 72, 76, 89, 104],
};

export const MASTERED = {
  ANIM: "animation.aegis.jin_transform_m",
  T: { heart: [], erupt: 24, fours: 41, tails: 41, tailGap: 2.6, coil: 67, roar: 72, title: 78, release: 106 },
  SHOTS: [
    { t: 0, name: "1 calm", pos: [2.2, 0.6, 1.6], look: [0, 0, 1.5] },
    { t: 1, pos: [1.6, 0.4, 1.6], look: [0, 0, 1.55], ease: 1.1 },
    { t: 24, name: "2 golden flash", pos: [2.8, -1.6, 0.6], look: [0, 0, 1.3] },
    { t: 25, pos: [3.2, -1.9, 0.8], look: [0, 0, 1.25], ease: 0.8 },
    { t: 40, name: "3 the flames rise", pos: [-2.8, -1.5, 1.4], look: [0, 0, 1.3] },
    { t: 41, pos: [-2.2, 2.6, 1.8], look: [0, 0, 1.3], ease: 1.3 },
    { t: 68, name: "4 power", pos: [2.6, 0.3, 0.6], look: [0, 0, 1.45] },
    { t: 72, pos: [3.2, 0.4, 0.6], look: [0, 0, 1.45], ease: 0.4 },
    { t: 89, name: "5 Tailed Beast Chakra Mode", pos: [3.4, 2.2, 1.35], look: [0, 0, 1.15] },
    { t: 90, pos: [4.0, 2.6, 1.6], look: [0, 0, 1.2], ease: 0.8 },
  ],
  BEATS: [4, 18, 24, 32, 40, 52, 62, 68, 72, 78, 89, 104],
};
