// Jutsu Clash cinematic — choreography and shot list. Pure data (no imports) so tools/cine_preview.py can render
// the storyboard offline from exactly what the game plays (python3 tools/cine_preview.py clash -o clash.png).
//
// The stage: M is the point on the ground midway between the fighters, the "f" axis runs from fighter A to
// fighter B, "p" points to the camera's side of that line (A's right hand, B's left — B plays every animation
// mirrored, so both jutsu hands face the camera), "h" is height.
// Anchors: "M" (stage), "A" / "B" (a fighter's feet; f = toward the opponent), "Ahead" / "Bhead" / "Ahand" / "Bhand"
// (that fighter's head or jutsu hand in their current pose), "W" / "L" (winner / loser, known after the burst).
// A position is [anchor, f, p, h, airFactor?] — h gets airFactor × the height the fighters meet at.

export const STAGE = {
  half: 6, // the fighters spring apart to at least this far from the middle
  runTo: 4.2, // they sprint to here, then leap
  strike: 1.45, // where each ends up, fists meeting in the middle
  air: 2.4, // how high they meet (0 when there's a ceiling)
  hit: 0.85, // height of the clash point above their feet
  back: 5.6, // where they're thrown to by the burst
};

export const T = {
  apart: 12,
  chargeA: 30,
  chargeB: 75,
  eyes: 120,
  black: 150,
  run: 155,
  leap: 185,
  impact: 205,
  burst: 250,
  land: 272,
  result: 286,
  release: 318,
  end: 322,
};

// Each fighter's path: d = distance from the middle, h = height. "start" / "H" / "air" / "back" are filled in per clash.
export const PATH = [
  { t: 0, d: "start", h: 0 },
  { t: T.apart, d: "H", h: 0, ease: "out", arc: 0.5 },
  { t: T.run, d: "H", h: 0 },
  { t: T.leap, d: STAGE.runTo, h: 0, ease: "in" },
  { t: T.impact, d: STAGE.strike, h: "air", ease: "out", arc: 0.5 },
  { t: T.burst, d: STAGE.strike, h: "air" },
  { t: T.land, d: "back", h: 0, ease: "out", arc: 1.3 },
];

// Which animation each fighter plays when. "charge" / "hold" / "run" have a version per jutsu family
// (clash_charge_chidori, clash_charge_orb …); fighter B gets the mirrored "_m" versions.
export const ANIMS = [
  [0, "both", "ready"],
  [T.chargeA, "A", "charge"],
  [T.chargeA + 46, "A", "hold"],
  [T.chargeB, "B", "charge"],
  [T.chargeB + 46, "B", "hold"],
  [T.run, "both", "run"],
  [T.leap, "both", "leap"],
  [T.impact, "both", "strike"],
  [T.burst, "both", "recoil"],
  [T.land, "both", "land"],
  [T.land + 10, "W", "rise"],
  [T.land + 12, "L", "kneel"],
];
export const FAMILY_ANIMS = ["charge", "hold", "run"];

// Where the jutsu hand and the head are in each pose: [toward the opponent, toward the camera side, height].
// (Measured from the animations with tools/cine_preview.py — re-measure if a pose changes.)
export const POSES = {
  ready: { hand: [0.32, 0.37, 0.7], head: [0.26, 0.04, 1.55] },
  charge_chidori: { hand: [0.15, 0.5, 0.46], head: [0.44, 0.05, 1.32] },
  charge_orb: { hand: [0.66, 0.09, 0.6], head: [0.46, -0.13, 1.3] },
  hold_chidori: { hand: [0.15, 0.5, 0.46], head: [0.44, 0.05, 1.32] },
  hold_orb: { hand: [-0.38, 0.51, 0.71], head: [0.39, 0.15, 1.35] },
  run_chidori: { hand: [-0.16, 0.47, 0.89], head: [0.6, 0, 1.34] },
  run_orb: { hand: [-0.18, 0.38, 1.17], head: [0.6, 0, 1.34] },
  leap: { hand: [-0.22, 0.13, 1.17], head: [0.67, 0.18, 1.48] },
  strike: { hand: [1.44, -0.31, 0.86], head: [0.93, -0.3, 1.26] },
  recoil: { hand: [0, 0.3, 1], head: [0, 0, 1.3] },
  land: { hand: [0.3, 0.4, 0.3], head: [0.5, 0, 1.0] },
  rise: { hand: [0, 0.35, 0.8], head: [0.05, 0, 1.6] },
  kneel: { hand: [0.3, 0.4, 0.3], head: [0.5, 0, 1.0] },
};

export const SHOTS = [
  { t: 0, name: "1 standoff", pos: ["M", 0, 12, 4], look: ["M", 0, 0, 1] },
  { t: 1, pos: ["M", 0, 8.5, 1.8], look: ["M", 0, 0, 1.2], ease: 1.4 },
  { t: T.chargeA, name: "2 A gathers chakra", pos: ["A", 2.8, 1.9, 0.6], look: ["A", 0.2, 0, 1.1] },
  { t: T.chargeA + 1, pos: ["A", 2.2, 1.3, 0.9], look: ["A", 0.2, 0, 1.1], ease: 1.2 },
  { t: T.chargeA + 26, name: "3 A's jutsu", pos: ["Ahand", 1.3, 1.6, 0.6], look: ["Ahand", 0, 0, 0.3] },
  { t: T.chargeA + 27, pos: ["Ahand", 1.0, 1.3, 0.5], look: ["Ahand", 0, 0, 0.3], ease: 0.9 },
  { t: T.chargeB, name: "4 B gathers chakra", pos: ["B", 2.8, 1.9, 0.6], look: ["B", 0.2, 0, 1.1] },
  { t: T.chargeB + 1, pos: ["B", 2.2, 1.3, 0.9], look: ["B", 0.2, 0, 1.1], ease: 1.2 },
  { t: T.chargeB + 26, name: "5 B's jutsu", pos: ["Bhand", 1.3, 1.6, 0.6], look: ["Bhand", 0, 0, 0.3] },
  { t: T.chargeB + 27, pos: ["Bhand", 1.0, 1.3, 0.5], look: ["Bhand", 0, 0, 0.3], ease: 0.9 },
  { t: T.eyes, name: "6 A's eyes", pos: ["Ahead", 1.3, 0.3, 0.05], look: ["Ahead", 0, 0, 0] },
  { t: T.eyes + 1, pos: ["Ahead", 1.1, 0.25, 0.05], look: ["Ahead", 0, 0, 0], ease: 0.5 },
  { t: T.eyes + 11, name: "7 B's eyes", pos: ["Bhead", 1.3, 0.3, 0.05], look: ["Bhead", 0, 0, 0] },
  { t: T.eyes + 12, pos: ["Bhead", 1.1, 0.25, 0.05], look: ["Bhead", 0, 0, 0], ease: 0.5 },
  { t: T.eyes + 20, name: "8 A's eyes", pos: ["Ahead", 0.85, 0.2, 0.03], look: ["Ahead", 0, 0, 0] },
  { t: T.eyes + 26, name: "9 B's eyes", pos: ["Bhead", 0.85, 0.2, 0.03], look: ["Bhead", 0, 0, 0] },
  { t: T.run, name: "10 A runs", pos: ["A", 1.6, 2.4, 0.7], look: ["A", 0.4, 0, 1.0], track: true },
  { t: T.run + 15, name: "11 B runs", pos: ["B", 1.6, 2.4, 0.7], look: ["B", 0.4, 0, 1.0], track: true },
  { t: T.leap, name: "12 the leap", pos: ["M", 0, 6.5, 0.4], look: ["M", 0, 0, 0.4, 1] },
  { t: T.leap + 1, pos: ["M", 0, 4.6, 0.8], look: ["M", 0, 0, 0.7, 1], ease: 1.0 },
  { t: T.impact, name: "13 impact", pos: ["M", 0, 3.4, 1.3, 1], look: ["M", 0, 0, 0.9, 1] },
  { t: T.impact + 1, pos: ["M", 0, 2.5, 1.1, 1], look: ["M", 0, 0, 0.9, 1], ease: 0.7 },
  { t: T.impact + 18, name: "14 past A, at B", pos: ["A", -0.3, 1.25, 1.6], look: ["Bhead", 0, 0, 0] },
  { t: T.impact + 19, pos: ["A", -0.1, 1.1, 1.55], look: ["Bhead", 0, 0, 0], ease: 0.6 },
  { t: T.impact + 32, name: "15 past B, at A", pos: ["B", -0.3, 1.25, 1.6], look: ["Ahead", 0, 0, 0] },
  { t: T.impact + 33, pos: ["B", -0.1, 1.1, 1.55], look: ["Ahead", 0, 0, 0], ease: 0.6 },
  { t: T.burst, name: "16 the burst", pos: ["M", 0, 14, 4], look: ["M", 0, 0, 2] },
  { t: T.burst + 1, pos: ["M", 0, 8, 10], look: ["M", 0, 0, 0], ease: 1.7 },
  { t: T.result, name: "17 who's left standing", pos: ["W", -1.6, 0.9, 1.8], look: ["L", 0, 0, 0.7], even: { pos: ["M", 0, 9, 1.3], look: ["M", 0, 0, 0.9] } },
  { t: T.result + 1, pos: ["W", -2.0, 1.1, 1.9], look: ["L", 0, 0, 0.7], ease: 1.4, even: { pos: ["M", 0, 7.5, 1.2], look: ["M", 0, 0, 0.9] } },
];

// Frames the offline storyboard renders.
export const STORYBOARD = [4, 22, 34, 50, 62, 80, 104, 124, 133, 141, 147, 160, 176, 190, 202, 207, 218, 228, 244, 252, 262, 280, 292, 314];
