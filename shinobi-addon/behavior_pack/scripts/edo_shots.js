// Edo Tensei cinematic — the shot list. Pure data (no imports) so tools/cine_preview.py can render the storyboard
// offline from exactly what the game plays.
//
// Positions are (f, r, h): blocks in FRONT of the caster, to the caster's RIGHT, and ABOVE the caster's feet.
// Times are game ticks (20 per second) from the moment the jutsu starts. A shot with ease = 0 is a cut; with
// ease > 0 the camera glides there over that many seconds.
//
// Timeline: hand seals (Tiger 13 · Serpent 21 · Dog 29 · Dragon 37) → clap 52 → palms hit the ground 58 →
// the formula spreads → the coffin heaves out of the earth 65–108 → stillness → the lid creaks 132, falls 142,
// crashes 150 → the reanimated face → pull back, the caster stands 196.

export const SPOT = 4.2; // the coffin rises this many blocks in front of the caster

export const T = {
  seals: [13, 21, 29, 37],
  clap: 52,
  seal: 58, // palms slam: the ground formula appears
  coffin: 62, // the coffin entity spawns (rises 0.15–2.3 s later)
  risen: 108,
  creak: 132, // coffin + 3.5 s
  body: 140, // the reanimated body appears behind the lid, just before it falls
  fall: 142, // coffin + 4.0 s
  thud: 150, // coffin + 4.4 s
  reveal: 156,
  release: 208, // camera and movement return
  end: 212,
};

export const SHOTS = [
  { t: 0, name: "1 establish", pos: [3.0, 1.5, 0.6], look: [0, 0, 1.15] },
  { t: 1, pos: [2.3, 1.0, 0.95], look: [0, 0, 1.2], ease: 0.6 },
  { t: 13, name: "2 Tiger", pos: [1.9, 0.45, 1.5], look: [0.1, 0, 1.35] },
  { t: 21, name: "3 Serpent", pos: [0.7, -1.9, 1.4], look: [0.15, 0, 1.3] },
  { t: 29, name: "4 Dog", pos: [1.5, 1.4, 0.8], look: [0.1, 0, 1.35] },
  { t: 37, name: "5 Dragon", pos: [2.0, 0, 1.55], look: [0, 0, 1.4] },
  { t: 38, pos: [1.6, 0, 1.5], look: [0, 0, 1.4], ease: 0.4 },
  { t: 46, name: "6 clap + slam", pos: [1.0, 2.7, 0.5], look: [0.5, 0, 0.8] },
  { t: 60, name: "7 the formula spreads", pos: [1.2, 0, 7.4], look: [2.3, 0, 0] },
  { t: 61, pos: [1.7, 0, 6.6], look: [2.5, 0, 0], ease: 1.0 },
  { t: 80, name: "8 the coffin rises", pos: [1.5, 1.6, 0.25], look: [4.2, 0, 1.0] },
  { t: 81, pos: [1.4, 1.6, 0.3], look: [4.2, 0, 1.7], ease: 1.4 },
  { t: 110, name: "9 stillness", pos: [-1.9, 1.5, 1.5], look: [4.2, -0.4, 1.4] },
  { t: 111, pos: [-1.1, 1.3, 1.4], look: [4.2, -0.4, 1.4], ease: 1.6 },
  { t: 132, name: "10 the lid", pos: [2.0, 1.6, 1.4], look: [4.2, 0, 1.5] },
  { t: 133, pos: [2.2, 1.5, 1.45], look: [4.2, 0, 1.5], ease: 0.8 },
  { t: 152, name: "11 the reanimated", pos: [2.8, 0.25, 1.5], look: [4.2, 0, 1.6] },
  { t: 153, pos: [3.15, 0.12, 1.56], look: [4.2, 0, 1.6], ease: 1.6 },
  { t: 184, name: "12 pull back", pos: [-2.6, 1.7, 2.4], look: [3.2, 0, 1.2] },
  { t: 185, pos: [-3.0, 1.9, 2.7], look: [3.2, 0, 1.2], ease: 1.2 },
];

// On-screen text beats (the script fills in the name of the reanimated shinobi).
export const TEXT = [
  { t: 13, title: "§l§fTiger", subtitle: "§8寅", stay: 7 },
  { t: 21, title: "§l§fSerpent", subtitle: "§8巳", stay: 7 },
  { t: 29, title: "§l§fDog", subtitle: "§8戌", stay: 7 },
  { t: 37, title: "§l§fDragon", subtitle: "§8辰", stay: 8 },
  { t: 58, title: "§l§8Summoning Jutsu", subtitle: "§7Impure World Reincarnation", stay: 22 },
  { t: 84, title: " ", subtitle: "§8ゴ  ゴ  ゴ  ゴ", stay: 22 },
  { t: 156, title: "§l§8EDO TENSEI", subtitle: "§f{name} §7returns from the dead", stay: 28 },
];

// Frames the offline storyboard renders (tools/cine_preview.py).
export const STORYBOARD = [2, 10, 14, 22, 30, 42, 50, 54, 59, 64, 72, 82, 92, 106, 112, 128, 136, 145, 149, 153, 164, 180, 188, 206];
