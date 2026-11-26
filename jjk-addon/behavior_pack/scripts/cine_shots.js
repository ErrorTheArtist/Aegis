// The cinematics' shot lists — Hollow Purple and every Domain Expansion, one each. Pure data (no imports), so the
// storyboards can be rendered offline from exactly what the game plays (tools/cine_board.py).
//
// Positions are [f, r, h]: blocks in FRONT of the caster, to the caster's RIGHT, and ABOVE the caster's feet, taken
// when the technique starts. Times are game ticks (20 a second). A shot with ease = 0 is a cut; with ease > 0 the
// camera glides there over that many seconds.
//   shots   the camera            text    titles (title, sub, stay ticks)        fades   fade to a colour and back
//   fog     the fog its watchers see from fogAt on (resource_pack/fogs; a domain's stays while you're inside it)
//   shakes  camera shakes         fx      particles in the world (id, at, size)  sounds  sounds in the world
// The caster watches from tick 0; players caught inside a domain watch from `victim` on (the domain is already
// opening around them). Every domain cinematic: the hand sign -> DOMAIN EXPANSION -> a flash in the domain's colour
// at 22 -> the domain revealed -> its name at 40 -> a last shot -> the camera comes back at `length`.

const SIGN = (colour, jp = "§f領域展開") => ({ t: 2, title: `${colour}§lDOMAIN EXPANSION`, sub: jp, stay: 16 });

export const CINE = {
  // Gojo — Unlimited Void: the hand sign, a push in on his face, a white-out, then the void: endless stars.
  void: {
    name: "Unlimited Void", length: 62, victim: 24, fog: "void", fogAt: 22, color: [0.55, 0.8, 1],
    shots: [
      { t: 0, name: "1 the sign", pos: [1.35, 1.0, 1.2], look: [0.1, 0, 1.6] },
      { t: 1, pos: [1.15, 0.75, 1.32], look: [0.05, 0, 1.62], ease: 0.8 },
      { t: 16, name: "2 his face", pos: [1.0, 0.22, 2.0], look: [0, 0, 1.64] },
      { t: 17, pos: [0.88, 0.18, 1.96], look: [0, 0, 1.64], ease: 0.4 },
      { t: 26, name: "3 the void opens", pos: [-6.5, 5.5, 6], look: [0, 0, 1] },
      { t: 27, pos: [-3.5, 7.5, 5], look: [0, 0, 1], ease: 1.2 },
      { t: 46, name: "4 infinity", pos: [-2.2, 0.8, 1.9], look: [6, 0, 1.6] },
      { t: 47, pos: [-1.6, 0.6, 1.85], look: [6, 0, 1.6], ease: 0.8 },
    ],
    text: [SIGN("§b"), { t: 40, title: "§b§lUNLIMITED VOID", sub: "§f無量空処", stay: 22 }],
    fades: [{ t: 21, in: 0.1, hold: 0.2, out: 0.6, color: [0.92, 0.96, 1] }],
    shakes: [{ t: 24, power: 0.35, secs: 0.6 }],
    fx: [
      { t: 0, id: "glyph", at: [0, 0, 0.05] }, { t: 10, id: "aura", at: [0, 0, 0] }, { t: 22, id: "flash", at: [1, 0, 1.6], size: 2 },
      { t: 24, id: "pillar", at: [0, 0, 0], size: 1.4 }, { t: 24, id: "shell", at: [0, 0, 1], vars: { radius: 12 } },
      { t: 26, id: "stars", at: [0, 0, 3], vars: { radius: 10 } }, { t: 34, id: "stars", at: [3, 2, 3], vars: { radius: 9 } },
      { t: 42, id: "stars", at: [-2, -3, 3], vars: { radius: 10 } }, { t: 50, id: "stars", at: [4, -2, 2], vars: { radius: 8 } },
    ],
    sounds: [{ t: 0, id: "beacon.activate", pitch: 1.4 }, { t: 21, id: "beacon.power", pitch: 0.6, volume: 1.4 }, { t: 24, id: "mob.warden.sonic_charge", pitch: 0.6 }],
  },

  // Sukuna — Malevolent Shrine: looking up at him, the shrine rising behind, the world filling with cuts.
  shrine: {
    name: "Malevolent Shrine", length: 62, victim: 24, fog: "shrine", fogAt: 22, color: [1, 0.2, 0.18],
    shots: [
      { t: 0, name: "1 looking up", pos: [2.6, -0.7, 0.35], look: [0, 0, 1.6] },
      { t: 1, pos: [2.2, -0.4, 0.5], look: [0, 0, 1.6], ease: 1.0 },
      { t: 14, name: "2 the shrine rises", pos: [5, 3.5, 1.2], look: [-7, 0, 4] },
      { t: 15, pos: [4.4, 2.2, 1.6], look: [-7, 0, 4.5], ease: 0.6 },
      { t: 26, name: "3 everything is cut", pos: [4, 6, 3.5], look: [-2, 0, 2] },
      { t: 27, pos: [0, 8, 4.5], look: [-3, 0, 2], ease: 1.3 },
      { t: 46, name: "4 the King", pos: [1.6, 0.3, 1.55], look: [0, 0, 1.6] },
      { t: 47, pos: [1.3, 0.2, 1.6], look: [0, 0, 1.62], ease: 0.8 },
    ],
    text: [SIGN("§4", "§c領域展開"), { t: 40, title: "§4§lMALEVOLENT SHRINE", sub: "§c伏魔御廚子", stay: 22 }],
    fades: [{ t: 21, in: 0.08, hold: 0.15, out: 0.5, color: [0.55, 0, 0] }],
    shakes: [{ t: 16, power: 0.25, secs: 1.0 }, { t: 24, power: 0.5, secs: 0.8 }],
    fx: [
      { t: 0, id: "glyph", at: [0, 0, 0.05] }, { t: 16, id: "debris", at: [-7, 0, 0], size: 1.6 }, { t: 22, id: "flash", at: [1, 0, 1.6], size: 2 },
      { t: 26, id: "slash", at: [2, 3, 1.5], size: 1.4 }, { t: 28, id: "slash", at: [-1, -4, 2], size: 1.6 }, { t: 30, id: "slash", at: [4, -2, 1], size: 1.2 },
      { t: 32, id: "slash", at: [-3, 2, 2.5], size: 1.8 }, { t: 34, id: "slash", at: [1, 5, 1.2], size: 1.3 }, { t: 36, id: "slash", at: [3, 0, 2.2], size: 1.6 },
      { t: 38, id: "slash", at: [-2, -2, 1], size: 1.4 }, { t: 41, id: "slash", at: [5, 3, 2], size: 1.7 }, { t: 44, id: "slash", at: [0, -5, 1.8], size: 1.5 },
      { t: 30, id: "ring", at: [0, 0, 0.1], size: 4 }, { t: 46, id: "blood", at: [2, 1, 1.2] },
    ],
    sounds: [{ t: 0, id: "mob.wither.ambient", pitch: 0.6 }, { t: 14, id: "mob.wither.spawn", pitch: 0.7, volume: 0.8 },
      { t: 26, id: "item.trident.throw", pitch: 1.6 }, { t: 32, id: "item.trident.throw", pitch: 1.4 }, { t: 38, id: "item.trident.throw", pitch: 1.7 }],
  },

  // Megumi — Chimera Shadow Garden: the shadow spreads across the ground, the world sinks into ink.
  garden: {
    name: "Chimera Shadow Garden", length: 62, victim: 24, fog: "garden", fogAt: 22, color: [0.45, 0.25, 0.75],
    shots: [
      { t: 0, name: "1 the sign", pos: [1.8, 0.6, 1.2], look: [0, 0, 1.3] },
      { t: 1, pos: [1.5, 0.5, 1.25], look: [0, 0, 1.3], ease: 0.6 },
      { t: 12, name: "2 the shadow spreads", pos: [5, 1.5, 0.25], look: [0, 0, 0.4] },
      { t: 13, pos: [4, 1, 0.2], look: [0, 0, 0.6], ease: 0.8 },
      { t: 26, name: "3 from above", pos: [0.5, 0.5, 11], look: [0, 0, 0] },
      { t: 27, pos: [0.5, 3, 9], look: [0, 0, 0.5], ease: 1.2 },
      { t: 46, name: "4 the dogs", pos: [-2.5, -1.2, 1.4], look: [4, 0, 1] },
      { t: 47, pos: [-2, -0.8, 1.5], look: [4, 0, 1], ease: 0.8 },
    ],
    text: [SIGN("§5", "§d領域展開"), { t: 40, title: "§5§lCHIMERA SHADOW GARDEN", sub: "§d嵌合暗翳庭", stay: 22 }],
    fades: [{ t: 21, in: 0.12, hold: 0.25, out: 0.55, color: [0.05, 0.02, 0.08] }],
    shakes: [{ t: 24, power: 0.3, secs: 0.6 }],
    fx: [
      { t: 0, id: "glyph", at: [0, 0, 0.05] }, { t: 12, id: "ring", at: [0, 0, 0.1], size: 2 }, { t: 16, id: "ring", at: [0, 0, 0.1], size: 3.5 },
      { t: 20, id: "ring", at: [0, 0, 0.1], size: 5 }, { t: 14, id: "smoke", at: [2, 1, 0.2], size: 1.4 }, { t: 24, id: "shell", at: [0, 0, 1], vars: { radius: 12 } },
      { t: 28, id: "smoke", at: [3, -2, 0.2], size: 1.6 }, { t: 36, id: "smoke", at: [-2, 3, 0.2], size: 1.6 }, { t: 46, id: "smoke", at: [4, 0, 0.3], size: 1.8 },
    ],
    sounds: [{ t: 0, id: "mob.wolf.growl", pitch: 0.7 }, { t: 12, id: "bubble.pop", pitch: 0.5, volume: 1.4 }, { t: 21, id: "mob.wither.spawn", pitch: 1.3, volume: 0.6 }],
  },

  // Naoya — Time Cell Moon Palace: frame-by-frame cuts round him (24 a second), a white-out, the moon.
  moon: {
    name: "Time Cell Moon Palace", length: 62, victim: 24, fog: "moon", fogAt: 22, color: [0.92, 0.94, 1],
    shots: [
      { t: 0, name: "1 frame", pos: [1.8, 1.2, 1.4], look: [0, 0, 1.5] },
      { t: 4, name: "2 frame", pos: [1.6, -1.3, 1.2], look: [0, 0, 1.5] },
      { t: 8, name: "3 frame", pos: [-1.8, 1.0, 1.6], look: [0, 0, 1.4] },
      { t: 12, name: "4 frame", pos: [2.4, 0, 0.8], look: [0, 0, 1.5] },
      { t: 16, name: "5 frame", pos: [0.8, 2.2, 2.0], look: [0, 0, 1.3] },
      { t: 20, name: "6 frame", pos: [1.4, 0, 1.6], look: [0, 0, 1.6] },
      { t: 26, name: "7 the moon palace", pos: [9, 3, 6], look: [0, 0, 1.2] },
      { t: 27, pos: [7, -2, 4.5], look: [0, 0, 1.2], ease: 1.3 },
      { t: 46, name: "8 24 frames", pos: [1.6, 0.5, 1.55], look: [0, 0, 1.6] },
      { t: 47, pos: [1.25, 0.3, 1.6], look: [0, 0, 1.6], ease: 0.8 },
    ],
    text: [SIGN("§f", "§7領域展開"), { t: 40, title: "§f§lTIME CELL MOON PALACE", sub: "§7時胞月宮殿", stay: 22 }],
    fades: [
      { t: 4, in: 0.02, hold: 0.02, out: 0.08, color: [1, 1, 1] }, { t: 8, in: 0.02, hold: 0.02, out: 0.08, color: [1, 1, 1] },
      { t: 12, in: 0.02, hold: 0.02, out: 0.08, color: [1, 1, 1] }, { t: 16, in: 0.02, hold: 0.02, out: 0.08, color: [1, 1, 1] },
      { t: 21, in: 0.1, hold: 0.2, out: 0.6, color: [0.96, 0.96, 1] },
    ],
    shakes: [{ t: 24, power: 0.3, secs: 0.5 }],
    fx: [
      { t: 0, id: "glyph", at: [0, 0, 0.05] }, { t: 4, id: "ring", at: [0, 0, 1], size: 1 }, { t: 8, id: "ring", at: [0, 0, 1], size: 1.3 },
      { t: 12, id: "ring", at: [0, 0, 1], size: 1.6 }, { t: 16, id: "ring", at: [0, 0, 1], size: 2 }, { t: 22, id: "flash", at: [1, 0, 1.6], size: 2 },
      { t: 24, id: "shell", at: [0, 0, 1], vars: { radius: 12 } }, { t: 30, id: "streak", at: [2, 0, 1.2], vars: { dx: 1, dy: 0, dz: 0 } },
      { t: 36, id: "streak", at: [-2, 1, 1.2], vars: { dx: 0, dy: 0, dz: 1 } },
    ],
    sounds: [{ t: 4, id: "random.click", pitch: 1.8 }, { t: 8, id: "random.click", pitch: 1.8 }, { t: 12, id: "random.click", pitch: 1.8 },
      { t: 16, id: "random.click", pitch: 1.8 }, { t: 21, id: "beacon.power", pitch: 1.6 }, { t: 30, id: "mob.phantom.swoop", pitch: 2 }],
  },

  // Jogo — Coffin of the Iron Mountain: the ground cracks and smoulders, an orange flash, the volcano.
  volcano: {
    name: "Coffin of the Iron Mountain", length: 62, victim: 24, fog: "volcano", fogAt: 22, color: [1, 0.5, 0.12],
    shots: [
      { t: 0, name: "1 the eye", pos: [1.4, -0.3, 1.5], look: [0, 0, 1.55] },
      { t: 1, pos: [1.2, -0.2, 1.55], look: [0, 0, 1.55], ease: 0.8 },
      { t: 10, name: "2 the ground cracks", pos: [3, 2.5, 0.6], look: [0, 0, 0.2] },
      { t: 11, pos: [2.6, 2, 0.8], look: [0, 0, 0.2], ease: 0.9 },
      { t: 26, name: "3 the volcano", pos: [8, -4, 0.3], look: [0, 0, 3] },
      { t: 27, pos: [6, -6, 0.8], look: [0, 0, 3.5], ease: 1.3 },
      { t: 46, name: "4 everything burns", pos: [2.0, 1.2, 1.2], look: [0, 0, 1.5] },
      { t: 47, pos: [1.6, 0.9, 1.3], look: [0, 0, 1.55], ease: 0.8 },
    ],
    text: [SIGN("§6", "§c領域展開"), { t: 40, title: "§6§lCOFFIN OF THE IRON MOUNTAIN", sub: "§c蓋棺鉄囲山", stay: 22 }],
    fades: [{ t: 21, in: 0.08, hold: 0.2, out: 0.5, color: [1, 0.42, 0.08] }],
    shakes: [{ t: 10, power: 0.2, secs: 0.6 }, { t: 24, power: 0.6, secs: 1.0 }],
    fx: [
      { t: 0, id: "glyph", at: [0, 0, 0.05] }, { t: 10, id: "debris", at: [1.5, 1, 0.1] }, { t: 12, id: "ember", at: [1, 1, 0.2] },
      { t: 14, id: "ring", at: [0, 0, 0.1], size: 2.5 }, { t: 18, id: "ember", at: [2, -1, 0.2] }, { t: 22, id: "flash", at: [1, 0, 1.6], size: 2 },
      { t: 24, id: "shell", at: [0, 0, 1], vars: { radius: 12 } }, { t: 26, id: "burst", at: [3, 3, 0.5], size: 1.6 }, { t: 30, id: "ember", at: [4, -2, 0.3], size: 1.5 },
      { t: 34, id: "burst", at: [-3, 2, 0.5], size: 1.6 }, { t: 38, id: "ember", at: [-2, -3, 0.3], size: 1.5 }, { t: 42, id: "burst", at: [5, -1, 0.5], size: 1.4 },
      { t: 48, id: "ember", at: [1, 1, 0.3], size: 1.2 },
    ],
    sounds: [{ t: 0, id: "mob.blaze.breathe", pitch: 0.6 }, { t: 10, id: "random.explode", pitch: 0.5, volume: 0.6 }, { t: 21, id: "random.explode", pitch: 0.4, volume: 1.4 },
      { t: 26, id: "mob.ghast.fireball", pitch: 0.6 }, { t: 34, id: "fire.ignite", pitch: 0.6 }],
  },

  // Mahito — Self-Embodiment of Perfection: his hands up close, the dark, then a slow circle round him.
  perfection: {
    name: "Self-Embodiment of Perfection", length: 62, victim: 24, fog: "perfection", fogAt: 22, color: [0.42, 0.5, 0.95],
    shots: [
      { t: 0, name: "1 the hands", pos: [1.25, 0.35, 1.25], look: [0, 0, 1.45] },
      { t: 1, pos: [1.05, 0.3, 1.3], look: [0, 0, 1.48], ease: 0.9 },
      { t: 12, name: "2 his smile", pos: [1.8, 2.2, 1.6], look: [0, 0, 1.45] },
      { t: 13, pos: [1.4, 2.4, 1.55], look: [0, 0, 1.5], ease: 0.8 },
      { t: 26, name: "3 the domain", pos: [-3, 2, 2.5], look: [0, 0, 1.2] },
      { t: 27, pos: [-2, -3, 2.2], look: [0, 0, 1.2], ease: 1.4 },
      { t: 46, name: "4 perfection", pos: [1.5, -0.4, 1.5], look: [0, 0, 1.6] },
      { t: 47, pos: [1.2, -0.3, 1.58], look: [0, 0, 1.6], ease: 0.8 },
    ],
    text: [SIGN("§9", "§b領域展開"), { t: 40, title: "§9§lSELF-EMBODIMENT OF PERFECTION", sub: "§b自閉円頓裹", stay: 22 }],
    fades: [{ t: 21, in: 0.1, hold: 0.25, out: 0.55, color: [0.08, 0.06, 0.2] }],
    shakes: [{ t: 24, power: 0.3, secs: 0.6 }],
    fx: [
      { t: 0, id: "glyph", at: [0, 0, 0.05] }, { t: 6, id: "aura", at: [0, 0, 0] }, { t: 14, id: "smoke", at: [0.5, 0.5, 1], size: 1.2 },
      { t: 22, id: "flash", at: [1, 0, 1.6], size: 2 }, { t: 24, id: "shell", at: [0, 0, 1], vars: { radius: 11 } },
      { t: 28, id: "aura", at: [2, 2, 0] }, { t: 34, id: "spark", at: [-1, 2, 1.4] }, { t: 40, id: "aura", at: [-2, -2, 0] }, { t: 50, id: "spark", at: [1, -1, 1.5] },
    ],
    sounds: [{ t: 0, id: "mob.zombie.unfect", pitch: 0.6 }, { t: 21, id: "mob.elderguardian.curse", pitch: 1.2, volume: 0.6 }, { t: 40, id: "mob.zombie.unfect", pitch: 0.5 }],
  },

  // Hakari — Idle Death Gamble: the reels spin (four cuts round him), a green flash, the pachinko parlour.
  jackpot: {
    name: "Idle Death Gamble", length: 62, victim: 24, fog: "jackpot", fogAt: 22, color: [0.4, 1, 0.55],
    shots: [
      { t: 0, name: "1 the sign", pos: [2.0, 0.8, 1.4], look: [0, 0, 1.5] },
      { t: 1, pos: [1.7, 0.6, 1.45], look: [0, 0, 1.5], ease: 0.5 },
      { t: 10, name: "2 reel", pos: [2.2, 0, 1.3], look: [0, 0, 1.4] },
      { t: 14, name: "3 reel", pos: [0, 2.2, 1.3], look: [0, 0, 1.4] },
      { t: 18, name: "4 reel", pos: [-2.2, 0, 1.3], look: [0, 0, 1.4] },
      { t: 22, name: "5 reel", pos: [0, -2.2, 1.3], look: [0, 0, 1.4] },
      { t: 26, name: "6 the parlour", pos: [7, 5, 4], look: [0, 0, 1.2] },
      { t: 27, pos: [8, -3, 3.5], look: [0, 0, 1.2], ease: 1.3 },
      { t: 46, name: "7 feel the fever", pos: [1.8, 0.8, 1.4], look: [0, 0, 1.55] },
      { t: 47, pos: [1.4, 0.5, 1.5], look: [0, 0, 1.58], ease: 0.8 },
    ],
    text: [SIGN("§a", "§2領域展開"), { t: 40, title: "§a§lIDLE DEATH GAMBLE", sub: "§2坐殺博徒", stay: 22 }],
    fades: [{ t: 23, in: 0.06, hold: 0.15, out: 0.5, color: [0.3, 1, 0.45] }],
    shakes: [{ t: 24, power: 0.25, secs: 0.5 }],
    fx: [
      { t: 0, id: "glyph", at: [0, 0, 0.05] }, { t: 10, id: "spark", at: [0, 0, 1.5] }, { t: 14, id: "spark", at: [0, 0, 1.5] },
      { t: 18, id: "spark", at: [0, 0, 1.5] }, { t: 22, id: "spark", at: [0, 0, 1.5] }, { t: 24, id: "flash", at: [1, 0, 1.6], size: 2 },
      { t: 24, id: "shell", at: [0, 0, 1], vars: { radius: 12 } }, { t: 28, id: "burst", at: [3, 3, 2], size: 1.4 }, { t: 34, id: "burst", at: [-3, 2, 2.5], size: 1.4 },
      { t: 40, id: "burst", at: [4, -3, 2], size: 1.4 }, { t: 46, id: "burst", at: [0, 0, 3], size: 1.6 },
    ],
    sounds: [{ t: 10, id: "random.click", pitch: 1.2 }, { t: 14, id: "random.click", pitch: 1.3 }, { t: 18, id: "random.click", pitch: 1.4 },
      { t: 22, id: "random.click", pitch: 1.5 }, { t: 24, id: "random.levelup", pitch: 1.4 }, { t: 30, id: "random.orb", pitch: 1.8 }],
  },

  // Gojo — Hollow Purple: from behind as Blue and Red close in, face to face between them, from the side as they merge
  // in front of him, a purple flash, alongside it as it tears away, and back behind him down the empty path.
  purple: {
    name: "Hollow Purple", length: 50, fog: "purple", fogAt: 13, color: [0.72, 0.36, 1],
    shots: [
      { t: 0, name: "1 Blue and Red", pos: [-2.6, 0, 2.3], look: [3, 0, 1.4] },
      { t: 1, pos: [-2.2, 0, 2.15], look: [3, 0, 1.45], ease: 0.3 },
      { t: 6, name: "2 face to face", pos: [5.0, 0, 1.35], look: [0.6, 0, 1.6] },
      { t: 7, pos: [4.4, 0, 1.45], look: [0.6, 0, 1.6], ease: 0.5 },
      { t: 13, name: "3 they merge", pos: [1.4, 3.4, 1.8], look: [1.2, 0, 1.6] },
      { t: 14, pos: [1.4, 2.9, 1.72], look: [1.2, 0, 1.6], ease: 0.3 },
      { t: 20, name: "4 Hollow Purple", pos: [3, 5, 1.6], look: [10, 0, 1.5] },
      { t: 21, pos: [14, 6, 2.2], look: [24, 0, 1.5], ease: 1.0 },
      { t: 40, name: "5 the empty path", pos: [-3.5, 0.8, 2.4], look: [12, 0, 1.2] },
      { t: 41, pos: [-3, 0.4, 2.2], look: [12, 0, 1.2], ease: 0.6 },
    ],
    text: [{ t: 8, title: "§5§lHOLLOW PURPLE", sub: "§d虚式「茈」", stay: 22 }],
    fades: [{ t: 18, in: 0.05, hold: 0.1, out: 0.35, color: [0.72, 0.36, 1] }],
    shakes: [{ t: 20, power: 0.6, secs: 0.8 }],
    fx: [
      { t: 0, id: "vortex", at: [1.6, 0, 1.6], vars: { radius: 2.5 } }, { t: 6, id: "vortex", at: [1.6, 0, 1.6], vars: { radius: 2 } },
      { t: 12, id: "vortex", at: [1.6, 0, 1.6], vars: { radius: 1.5 } }, { t: 19, id: "flash", at: [1.6, 0, 1.6], size: 2 },
      { t: 20, id: "pillar", at: [1.6, 0, 0], size: 1.2 }, { t: 20, id: "ring", at: [0, 0, 0.1], size: 2.5 },
    ],
    sounds: [{ t: 0, id: "beacon.activate", pitch: 0.8 }, { t: 13, id: "mob.warden.sonic_charge", pitch: 1.5 }],
  },
};
