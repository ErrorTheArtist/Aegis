// Reanimation Jutsu: Edo Tensei — a forbidden scroll. Choose a fallen shinobi; a coffin rises from the earth and they
// fight beside you for 60 seconds with their own signature jutsu, then their soul returns to the afterlife.
// The body is an allied Genin wearing their skin; every jutsu it uses is cast in your name (it never hits you or your
// companions, and kills count for you).

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { impactFx, sfx, shake, inCinematic, setCinematicBusy } from "./cinematic.js";
import { getLevel } from "./levels.js";
import { SPOT, T, SHOTS, TEXT } from "./edo_shots.js";

export const EDO_ITEM = "aegis:edo_tensei_scroll";
const COST = 100;
const COOLDOWN = 6000; // 5 min
const LIFETIME = 1200; // 60 s
const MIN_LEVEL = 40;

const FIGURES = {
  hiruzen: { name: "Hiruzen Sarutobi", skin: 19, color: [1, 0.45, 0.1], moves: ["fireDragon", "fireball"] },
  minato: { name: "Minato Namikaze", skin: 20, color: [1, 0.9, 0.4], moves: ["flash", "rasengan"] },
  itachi: { name: "Itachi Uchiha", skin: 12, color: [0.8, 0.1, 0.1], moves: ["amaterasu", "fireball"] },
  nagato: { name: "Nagato", skin: 21, color: [0.7, 0.55, 1], moves: ["push", "pull"] },
  deidara: { name: "Deidara", skin: 14, color: [1, 0.85, 0.5], moves: ["clay", "clay"] },
  sasori: { name: "Sasori", skin: 26, color: [0.6, 0.3, 0.7], moves: ["senbon", "senbon"] },
  kakuzu: { name: "Kakuzu", skin: 25, color: [0.4, 0.75, 0.4], moves: ["fireball", "wind"] },
  hashirama: { name: "Hashirama Senju", skin: 30, color: [0.4, 0.8, 0.3], moves: ["wood", "wood", "heal"] },
  tobirama: { name: "Tobirama Senju", skin: 31, color: [0.3, 0.6, 1], moves: ["waterDragon", "flash"] },
};
const IDS = Object.keys(FIGURES);

let api;
const bodies = new Map(); // entity id -> { owner, fig, end, next }
const pending = new Set(); // bodies still inside their coffin (mid-cinematic)

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const up = (a, h) => ({ x: a.x, y: a.y + h, z: a.z });
const dirTo = (a, b) => api.norm(api.sub(up(b.location, 1), up(a.location, 1.5)));
const flat = (a, b) => api.norm({ x: b.location.x - a.location.x, y: 0, z: b.location.z - a.location.z });

function eff(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}

function enemyNear(body, owner) {
  let best;
  let bd = 17 * 17;
  for (const e of body.dimension.getEntities({ location: body.location, maxDistance: 16, families: ["monster"] })) {
    if (!api.canBeHit(e, owner) || e.id === body.id) continue;
    const d = api.sub(e.location, body.location);
    const dist = d.x * d.x + d.y * d.y + d.z * d.z;
    if (dist < bd) {
      bd = dist;
      best = e;
    }
  }
  return best;
}

// Every move is cast in the owner's name.
const MOVES = {
  fireball(b, o, t, c) {
    api.anim(b, "animation.aegis.fireball_jutsu");
    system.runTimeout(() => api.isValid(b) && api.isValid(t) && api.launchProjectile(o, add(up(b.location, 1.5), dirTo(b, t)), dirTo(b, t), { damage: 10, radius: 3.5, knock: 0.9, fire: 5 }), 10);
  },
  fireDragon(b, o, t) {
    api.anim(b, "animation.aegis.phoenix_breath");
    system.runTimeout(() => {
      if (!api.isValid(b) || !api.isValid(t)) return;
      const d = dirTo(b, t);
      for (const a of [-0.2, 0, 0.2]) {
        const dir = { x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y, z: d.x * Math.sin(a) + d.z * Math.cos(a) };
        api.launchProjectile(o, add(up(b.location, 1.5), dir), dir, { damage: 8, radius: 3, knock: 0.8, fire: 4 });
      }
    }, 10);
  },
  flash(b, o, t, c) {
    api.particle(b.dimension, "aegis:smoke_puff", b.location);
    try {
      const d = flat(t, b);
      b.teleport(add(t.location, api.scale(d, -1.5)), { facingLocation: t.location });
    } catch {
      /* ignore */
    }
    api.particle(b.dimension, "aegis:cine_ring", b.location, c);
    system.runTimeout(() => {
      if (!api.isValid(t)) return;
      api.anim(b, "animation.aegis.sword_slash");
      api.hurt(t, 10, o);
      api.particle(t.dimension, "aegis:slash", up(t.location, 1.2), c);
    }, 4);
  },
  rasengan(b, o, t) {
    api.anim(b, "animation.aegis.rasengan_form");
    try {
      b.teleport(add(t.location, api.scale(flat(t, b), 1.6)), { facingLocation: t.location });
    } catch {
      /* ignore */
    }
    system.runTimeout(() => {
      if (!api.isValid(b) || !api.isValid(t)) return;
      api.anim(b, "animation.aegis.ram_strike");
      api.hurt(t, 14, o);
      const d = flat(b, t);
      api.knockback(t, d.x, d.z, 2.6, 0.5);
      impactFx(t.dimension, t.location, [0.4, 0.75, 1], 1.5);
    }, 12);
  },
  amaterasu(b, o, t) {
    api.anim(b, "animation.aegis.eye_activate");
    sfx(t.dimension, "aegis.fire", t.location, 1.4, 0.6);
    for (let i = 0; i < 5; i++) {
      system.runTimeout(() => {
        if (!api.isValid(t)) return;
        api.particle(t.dimension, "aegis:amaterasu", t.location);
        api.hurt(t, 3, o, "fire");
        try {
          t.setOnFire(4, true);
        } catch {
          /* ignore */
        }
      }, i * 20);
    }
  },
  push(b, o, t, c) {
    api.anim(b, "animation.aegis.almighty_push");
    impactFx(b.dimension, b.location, c, 2);
    for (const e of b.dimension.getEntities({ location: b.location, maxDistance: 7, families: ["monster"] })) {
      if (!api.canBeHit(e, o) || e.id === b.id) continue;
      api.hurt(e, 8, o);
      const d = flat(b, e);
      api.knockback(e, d.x, d.z, 3, 0.7);
    }
  },
  pull(b, o, t) {
    api.anim(b, "animation.aegis.pull");
    const d = flat(t, b);
    api.knockback(t, d.x, d.z, 2.5, 0.3);
    system.runTimeout(() => api.isValid(t) && api.hurt(t, 9, o), 10);
  },
  clay(b, o, t) {
    api.anim(b, "animation.aegis.palm_thrust");
    for (let k = 0; k < 2; k++) {
      system.runTimeout(() => {
        if (!api.isValid(b) || !api.isValid(t)) return;
        api.launchProjectile(o, add(up(b.location, 1.5), dirTo(b, t)), dirTo(b, t), { noOrb: true, speed: 1.0, maxAge: 40, damage: 8, radius: 3, knock: 0.9, fire: 0,
          trail: "aegis:beast_aura", burst: "aegis:fire_burst", color: [1, 0.9, 0.7], hitRadius: 1.2, sound: "random.explode" });
      }, k * 8);
    }
  },
  senbon(b, o, t) {
    api.anim(b, "animation.aegis.palm_thrust");
    for (let k = 0; k < 4; k++) {
      system.runTimeout(() => {
        if (!api.isValid(b) || !api.isValid(t)) return;
        api.launchProjectile(o, add(up(b.location, 1.5), dirTo(b, t)), dirTo(b, t), { noOrb: true, speed: 1.9, maxAge: 16, damage: 3, radius: 1.2, knock: 0.1, fire: 0,
          trail: "aegis:slash", burst: "aegis:slash", color: [0.55, 0.25, 0.7], hitRadius: 1.0, power: 0.3, effects: [["poison", 100, 1]] });
      }, k * 2);
    }
  },
  // Wood Release: roots erupt under every enemy near the target and bind them
  wood(b, o, t) {
    api.anim(b, "animation.aegis.earth_slam");
    const dim = b.dimension;
    system.runTimeout(() => {
      if (!api.isValid(t)) return;
      for (const e of dim.getEntities({ location: t.location, maxDistance: 5, families: ["monster"] })) {
        if (!api.canBeHit(e, o) || e.id === b.id) continue;
        for (let y = 0; y < 2.5; y += 0.6) api.particle(dim, "aegis:cine_debris", up(e.location, y), [0.45, 0.32, 0.18]);
        api.hurt(e, 9, o);
        eff(e, "slowness", 60, 6);
      }
      api.particle(dim, "aegis:dust", t.location);
      sfx(dim, "aegis.impact", t.location, 1, 0.6);
    }, 10);
  },
  // Hashirama's healing: patches up the summoner
  heal(b, o, t, c) {
    api.anim(b, "animation.aegis.heal_palms");
    api.particle(o.dimension, "aegis:heal", o.location);
    try {
      const h = o.getComponent("minecraft:health");
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 6));
    } catch {
      /* ignore */
    }
    MOVES.wood(b, o, t, c);
  },
  // Water Release: Water Dragon Bullet
  waterDragon(b, o, t) {
    api.anim(b, "animation.aegis.hand_signs");
    system.runTimeout(() => {
      if (!api.isValid(b) || !api.isValid(t)) return;
      api.launchProjectile(o, add(up(b.location, 1.5), dirTo(b, t)), dirTo(b, t), { noOrb: true, speed: 1.1, maxAge: 36, damage: 12, radius: 3.2, knock: 1.6, fire: 0,
        trail: "aegis:water_splash", burst: "aegis:water_splash", color: [0.3, 0.6, 1], hitRadius: 1.6 });
    }, 12);
  },
  wind(b, o, t) {
    api.anim(b, "animation.aegis.both_palms");
    const dir = flat(b, t);
    for (let d = 1; d <= 9; d++) api.particle(b.dimension, "aegis:wind_gust", add(up(b.location, 1.2), api.scale(dir, d)));
    for (const e of b.dimension.getEntities({ location: b.location, maxDistance: 10, families: ["monster"] })) {
      if (!api.canBeHit(e, o) || e.id === b.id) continue;
      const v = flat(b, e);
      if (v.x * dir.x + v.z * dir.z < 0.6) continue;
      api.hurt(e, 9, o);
      api.knockback(e, v.x, v.z, 2.5, 0.4);
    }
  },
};

function crumble(id, why) {
  const st = bodies.get(id);
  bodies.delete(id);
  const b = world.getEntity(id);
  if (b && api.isValid(b)) {
    api.particle(b.dimension, "aegis:dust", b.location);
    api.particle(b.dimension, "aegis:smoke_puff", b.location);
    api.particle(b.dimension, "aegis:cine_debris", b.location, [0.75, 0.72, 0.68]);
    sfx(b.dimension, "aegis.seal", b.location, 1.2, 0.7);
    b.remove();
  }
  const o = st && world.getEntity(st.owner);
  if (o && api.isValid(o) && why) o.sendMessage(why);
}

async function chooseAndReanimate(player) {
  const f = new ActionFormData()
    .title("§l§8Reanimation Jutsu: Edo Tensei")
    .body(`§7Bring a fallen shinobi back from the dead to fight for you for 60 seconds.\n§8(${COST} chakra · Lv ${MIN_LEVEL} · forbidden jutsu)`);
  for (const id of IDS) f.button(`§f${FIGURES[id].name}`);
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  const fig = IDS[r.selection];
  if (api.getChakra(player) < COST) return player.sendMessage(`§cNot enough chakra (${COST} needed).`);
  api.setChakra(player, api.getChakra(player) - COST);
  api.startCooldown(player, EDO_ITEM, COOLDOWN);
  reanimate(player, fig);
}

// ---------------------------------------------------------------------------
// The summoning cinematic. The shot list (camera, timing, text) lives in edo_shots.js and is storyboarded offline
// with tools/cine_preview.py; this function plays it and drives everything that happens in the world:
//
//   hand seals Tiger → Serpent → Dog → Dragon, one cut per seal → the clap → both palms hit the ground and the
//   summoning formula races across it (aegis:edo_seal) → the earth cracks and the coffin heaves out in three jerks,
//   rubble flying (aegis:edo_coffin) → stillness → the lid creaks, falls and crashes down → cut to black → the
//   reanimated shinobi, head bowed in the dark of the coffin, twitches, lifts their head → pull back.
//
// Everyone nearby sees and hears all of it; only the caster's camera is taken over (and only if no other cinematic
// already has it). The caster can't move and can't be hurt until it ends.
// ---------------------------------------------------------------------------
const PAPER = [0.86, 0.82, 0.72];
const SEAL_PITCH = [1.0, 0.9, 1.1, 0.8];

function cmd(p, c) {
  try {
    p.runCommand(c);
  } catch {
    /* ignore */
  }
}
const f3 = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;

function endFilm(player) {
  setCinematicBusy(player.id, false);
  if (!api.isValid(player)) return;
  cmd(player, "camera @s clear");
  cmd(player, "inputpermission set @s movement enabled");
  cmd(player, "inputpermission set @s camera enabled");
  cmd(player, "hud @s reset");
  cmd(player, "fog @s remove aegis_edo");
}

function reanimate(player, fig) {
  const F = FIGURES[fig];
  for (const [id, st] of [...bodies]) if (st.owner === player.id) crumble(id); // one at a time
  const dim = player.dimension;
  const base = { ...player.location };
  const d = player.getViewDirection();
  const fwd = api.norm({ x: d.x, y: 0, z: d.z });
  const right = { x: -fwd.z, y: 0, z: fwd.x };
  const at = (f, r, h) => ({ x: base.x + fwd.x * f + right.x * r, y: base.y + h, z: base.z + fwd.z * f + right.z * r });
  const spot = at(SPOT, 0, 0);
  const film = !inCinematic(player); // never fight another cinematic over the camera
  const run = (fn, t) => system.runTimeout(() => api.isValid(player) && fn(), Math.max(1, t));
  const world_ = (fn, t) => system.runTimeout(fn, Math.max(1, t)); // world effects finish even if the caster leaves
  let coffin;
  let body;

  // ---- the caster ----
  api.anim(player, "animation.aegis.edo_tensei");
  eff(player, "resistance", T.release + 10, 4); // untouchable while the jutsu is woven
  if (film) {
    setCinematicBusy(player.id, true);
    cmd(player, "inputpermission set @s movement disabled");
    cmd(player, "inputpermission set @s camera disabled");
    cmd(player, "hud @s hide all");
    cmd(player, "fog @s push aegis:fog_dark aegis_edo");
    try {
      player.playSound("aegis.edo_drone", { volume: 0.9 });
    } catch {
      /* ignore */
    }
    for (const s of SHOTS) {
      const go = () => cmd(player, `camera @s set minecraft:free${s.ease ? ` ease ${s.ease} in_out_sine` : ""} pos ${f3(at(...s.pos))} facing ${f3(at(...s.look))}`);
      if (s.t === 0) go();
      else run(go, s.t);
    }
    for (const x of TEXT) {
      run(() => showTitle(player, x.title, { subtitle: x.subtitle.replace("{name}", F.name), fadeInDuration: x.t < T.seal ? 0 : 3, stayDuration: x.stay, fadeOutDuration: x.t < T.seal ? 2 : 10 }), x.t);
    }
    run(() => cmd(player, "camera @s fade time 0.05 0.1 0.25 color 0 0 0"), T.thud); // cut to black as the lid lands
    system.runTimeout(() => endFilm(player), T.release);
  } else {
    showTitle(player, "§8Reanimation Jutsu", { subtitle: `§7Edo Tensei — ${F.name}`, fadeInDuration: 4, stayDuration: 50, fadeOutDuration: 10 });
  }

  // ---- hand seals + clap ----
  T.seals.forEach((t, i) =>
    run(() => {
      sfx(dim, "aegis.edo_seal", base, 1.1, SEAL_PITCH[i]);
      api.particle(dim, "aegis:chakra_aura", at(0.45, 0, 1.25));
    }, t));
  run(() => {
    sfx(dim, "aegis.edo_clap", base, 1.4, 1);
    api.particle(dim, "aegis:chakra_burst", at(0.5, 0, 1.3), [0.75, 0.7, 0.85]);
  }, T.clap);

  // ---- palms hit the ground: the formula spreads ----
  world_(() => {
    try {
      const seal = dim.spawnEntity("aegis:edo_seal", { x: base.x, y: base.y, z: base.z });
      seal.teleport(base, { facingLocation: { x: spot.x, y: base.y, z: spot.z } });
      world_(() => api.isValid(seal) && seal.remove(), 176);
    } catch {
      /* ignore */
    }
    sfx(dim, "aegis.edo_gong", base, 1.6, 1);
    sfx(dim, "aegis.impact", base, 1, 0.7);
    shake(dim, base, 0.5, 0.7, 20);
    api.particle(dim, "aegis:dust", at(0.6, 0, 0));
    api.particle(dim, "aegis:cine_ring", at(0.4, 0, 0.05), [0.2, 0.18, 0.2]);
    for (let k = 1; k <= 8; k++) world_(() => api.particle(dim, "aegis:slash", at((SPOT * k) / 8, (Math.random() - 0.5) * 0.8, 0.15), PAPER), k);
  }, T.seal);

  // ---- the coffin heaves out of the earth (three jerks, then it settles) ----
  world_(() => {
    try {
      coffin = dim.spawnEntity("aegis:edo_coffin", spot);
      coffin.teleport(spot, { facingLocation: { x: base.x, y: spot.y, z: base.z } });
    } catch {
      coffin = undefined;
    }
    sfx(dim, "aegis.edo_rumble", spot, 2.2, 1);
    for (const [t, power] of [[3, 0.55], [16, 0.5], [29, 0.6]]) {
      world_(() => {
        shake(dim, spot, power, 0.45, 24);
        api.particle(dim, "aegis:dust", spot);
        api.particle(dim, "aegis:cine_debris", spot, [0.36, 0.3, 0.24]);
        api.particle(dim, "aegis:smoke_puff", { x: spot.x, y: spot.y + 0.3, z: spot.z });
        api.sound(dim, "dig.gravel", spot, 1.4, 0.5);
      }, t);
    }
    for (let t = 3; t < 44; t += 4) world_(() => api.particle(dim, "aegis:dust", spot), t);
    world_(() => {
      shake(dim, spot, 0.4, 0.3, 20);
      for (const [f, r] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) api.particle(dim, "aegis:dust", { x: spot.x + fwd.x * f + right.x * r, y: spot.y, z: spot.z + fwd.z * f + right.z * r });
    }, T.risen - T.coffin);
    // much later it sinks back into the ground
    world_(() => {
      sfx(dim, "aegis.edo_rumble", spot, 1.2, 1.25);
      for (let t = 0; t < 28; t += 4) world_(() => api.particle(dim, "aegis:dust", spot), t);
    }, 180);
    world_(() => {
      try {
        if (coffin && api.isValid(coffin)) coffin.remove();
      } catch {
        /* ignore */
      }
    }, 210);
  }, T.coffin);

  // ---- the lid ----
  world_(() => sfx(dim, "aegis.edo_creak", spot, 1.6, 0.9), T.creak);
  world_(() => sfx(dim, "aegis.edo_creak", spot, 1.3, 1.15), T.creak + 7);

  // the reanimated body appears behind the lid just before it falls, dead still
  run(() => {
    try {
      body = dim.spawnEntity("aegis:genin", spot);
      body.teleport(spot, { facingLocation: { x: base.x, y: spot.y + 1.6, z: base.z } });
    } catch {
      body = undefined;
      return;
    }
    const b = body;
    pending.add(b.id);
    b.setDynamicProperty("aegis:owner", player.id);
    b.setDynamicProperty("aegis:reanimated", fig);
    b.setDynamicProperty("aegis:no_xp", true);
    b.setDynamicProperty("aegis:mode", "follow");
    try {
      b.getComponent("minecraft:tameable")?.tame(player);
    } catch {
      /* fall back to the follow catch-up */
    }
    try {
      b.triggerEvent("aegis:tamed");
      b.triggerEvent("aegis:wander");
      b.triggerEvent("aegis:vulnerable");
      b.setProperty("aegis:skin", F.skin);
    } catch {
      /* ignore */
    }
    eff(b, "slowness", T.release - T.body + 12, 255); // stands in the coffin until the cinematic ends
    eff(b, "resistance", T.release - T.body + 12, 4);
    eff(b, "health_boost", LIFETIME + 100, 4);
    eff(b, "regeneration", LIFETIME + 100, 1);
    eff(b, "strength", LIFETIME + 100, 2);
    eff(b, "fire_resistance", LIFETIME + 100, 0);
    try {
      const hc = b.getComponent("minecraft:health");
      hc.setCurrentValue(hc.effectiveMax);
    } catch {
      /* ignore */
    }
    system.runTimeout(() => api.isValid(b) && api.anim(b, "animation.aegis.edo_awaken"), 2);
  }, T.body - 2);

  world_(() => {
    sfx(dim, "aegis.edo_thud", at(SPOT - 1.6, 0, 0), 2.2, 1);
    shake(dim, spot, 0.7, 0.5, 24);
    for (const f of [0.9, 1.8, 2.7]) {
      api.particle(dim, "aegis:dust", at(SPOT - 0.6 - f, 0.7, 0));
      api.particle(dim, "aegis:dust", at(SPOT - 0.6 - f, -0.7, 0));
    }
    api.particle(dim, "aegis:smoke_puff", at(SPOT - 2, 0, 0.2));
  }, T.thud);

  // ---- the reveal ----
  world_(() => {
    const b = body;
    if (!b || !api.isValid(b)) return;
    pending.delete(b.id);
    if (!api.isValid(player)) return b.remove(); // the summoner is gone: so is the soul
    b.nameTag = `§8[Edo Tensei] §f${F.name}`;
    eff(b, "resistance", LIFETIME, 1);
    eff(b, "speed", LIFETIME, 0);
    sfx(dim, "aegis.edo_gong", spot, 1.3, 1.5);
    for (let k = 0; k < T.release - T.reveal; k += 4) system.runTimeout(() => api.isValid(b) && api.particle(dim, "aegis:edo_ash", b.location), k);
    bodies.set(b.id, { owner: player.id, fig, end: system.currentTick + LIFETIME, next: system.currentTick + (T.release - T.reveal) + 8 });
    world.sendMessage(`§8${player.name} used the forbidden Reanimation Jutsu — §f${F.name}§8 walks again.`);
  }, T.reveal);
}

export function handleEdoUse(player, itemStack) {
  if (itemStack?.typeId !== EDO_ITEM) return false;
  if (getLevel(player) < MIN_LEVEL) {
    player.onScreenDisplay.setActionBar(`§cThis forbidden jutsu needs level ${MIN_LEVEL}.`);
    return true;
  }
  const left = api.cooldownLeft(player, EDO_ITEM);
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7Edo Tensei ready in §f${Math.ceil(left / 20)}s`);
    return true;
  }
  system.run(() => chooseAndReanimate(player).catch(() => {}));
  return true;
}

export function initEdoTensei(helpers) {
  api = helpers;
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [id, st] of [...bodies]) {
      const b = world.getEntity(id);
      const o = world.getEntity(st.owner);
      if (!b || !api.isValid(b)) {
        bodies.delete(id);
        continue;
      }
      if (now >= st.end || !o || !api.isValid(o)) {
        crumble(id, `§7The soul of §f${FIGURES[st.fig].name}§7 returns to the afterlife.`);
        continue;
      }
      if (now % 20 === 0) api.particle(b.dimension, "aegis:edo_ash", b.location);
      if (now < st.next) continue;
      const t = enemyNear(b, o);
      if (!t) {
        st.next = now + 20;
        continue;
      }
      const F = FIGURES[st.fig];
      const move = F.moves[Math.floor(Math.random() * F.moves.length)];
      try {
        MOVES[move](b, o, t, F.color);
      } catch {
        /* ignore */
      }
      st.next = now + 50 + Math.floor(Math.random() * 30);
    }
  }, 10);

  // a reanimated body nobody is holding here any more (server restarted, summoner vanished mid-jutsu) turns to dust
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      let list = [];
      try {
        list = p.dimension.getEntities({ type: "aegis:genin", location: p.location, maxDistance: 64 });
      } catch {
        continue;
      }
      for (const e of list) {
        try {
          if (!e.getDynamicProperty("aegis:reanimated") || bodies.has(e.id) || pending.has(e.id)) continue;
          api.particle(e.dimension, "aegis:dust", e.location);
          e.remove();
        } catch {
          /* ignore */
        }
      }
    }
  }, 100);

  // a destroyed body crumbles instead of dropping anything
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (bodies.has(deadEntity.id)) crumble(deadEntity.id, `§7The reanimated body of §f${FIGURES[bodies.get(deadEntity.id)?.fig]?.name ?? "your ally"}§7 was destroyed.`);
  });
}
