// Reanimation Jutsu: Edo Tensei — a forbidden scroll. Choose a fallen shinobi; a coffin rises from the earth and they
// fight beside you for 60 seconds with their own signature jutsu, then their soul returns to the afterlife.
// The body is an allied Genin wearing their skin; every jutsu it uses is cast in your name (it never hits you or your
// companions, and kills count for you).

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { impactFx, sfx, shake, inCinematic, setCinematicBusy } from "./cinematic.js";
import { getLevel } from "./levels.js";

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
// The summoning cinematic (caster's camera):
//   hand seals Tiger → Serpent → Dog → Dragon (close on the hands) → palms slam the ground, talismans spread →
//   ゴゴゴ the coffin rises from the earth → push in on the coffin → the lid falls → the reanimated shinobi stands
//   inside, ashen and cracked → pull back over the summoner's shoulder.
// Everyone nearby sees the coffin rise and open for real; only the caster's camera is taken over.
// ---------------------------------------------------------------------------
const SEALS = [["Tiger", "寅"], ["Serpent", "巳"], ["Dog", "戌"], ["Dragon", "辰"]];
const PAPER = [0.86, 0.82, 0.72];
const LID_FALLS = 62; // ticks after the coffin appears (matches animation.aegis.edo_coffin)

function cmd(p, c) {
  try {
    p.runCommand(c);
  } catch {
    /* ignore */
  }
}
const f3 = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;
function cam(p, pos, facing, ease = 0) {
  cmd(p, `camera @s set minecraft:free${ease > 0 ? ` ease ${ease} in_out_sine` : ""} pos ${f3(pos)} facing ${f3(facing)}`);
}

function reanimate(player, fig) {
  const F = FIGURES[fig];
  for (const [id, st] of [...bodies]) if (st.owner === player.id) crumble(id); // one at a time
  const dim = player.dimension;
  const base = { ...player.location };
  const d = player.getViewDirection();
  const fwd = api.norm({ x: d.x, y: 0, z: d.z });
  const right = { x: -fwd.z, y: 0, z: fwd.x };
  const at = (f, r, h, o = base) => ({ x: o.x + fwd.x * f + right.x * r, y: o.y + h, z: o.z + fwd.z * f + right.z * r });
  const spot = at(3.8, 0, 0); // far enough that the falling lid lands just short of the summoner
  const film = !inCinematic(player); // never fight another cinematic over the camera
  const run = (fn, t) => system.runTimeout(() => api.isValid(player) && fn(), t);
  const T = film ? { slam: 34, coffin: 38 } : { slam: 0, coffin: 4 };
  const open = T.coffin + LID_FALLS;

  if (film) {
    setCinematicBusy(player.id, true);
    cmd(player, "inputpermission set @s movement disabled");
    eff(player, "resistance", open + 40, 4); // untouchable while the camera is away
    // 1) the hand seals, close on the hands
    api.anim(player, "animation.aegis.hand_signs");
    cam(player, at(1.5, 0.35, 1.55), at(0.2, 0, 1.25));
    run(() => cam(player, at(1.15, -0.45, 1.45), at(0.2, 0, 1.3), 1.4), 1);
    SEALS.forEach(([name, kanji], i) =>
      run(() => {
        showTitle(player, `§l§f${name}`, { subtitle: `§8${kanji}`, fadeInDuration: 0, stayDuration: 7, fadeOutDuration: 2 });
        sfx(dim, "aegis.seal", base, 0.9, 0.8 + i * 0.12);
        api.particle(dim, "aegis:chakra_aura", at(0.5, 0, 1.2));
      }, 2 + i * 8));
  }

  // 2) palms to the ground: talismans spread toward the spot
  run(() => {
    api.anim(player, "animation.aegis.summon_slam");
    if (film) {
      cam(player, at(1.6, 3.4, 0.6), at(1.8, 0, 0.9));
      showTitle(player, "§l§8Summoning", { subtitle: "§7Impure World Reincarnation", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
    }
    sfx(dim, "aegis.seal", base, 2, 0.55);
    shake(dim, base, 0.3, 0.6, 16);
    for (let k = 0; k <= 10; k++) {
      const f = k / 10;
      system.runTimeout(() => {
        const p = { x: base.x + (spot.x - base.x) * f, y: base.y + 0.1, z: base.z + (spot.z - base.z) * f };
        api.particle(dim, "aegis:slash", p, PAPER);
        api.particle(dim, "aegis:cine_ring", p, [0.25, 0.22, 0.2]);
      }, k);
    }
  }, T.slam);

  // 3) ゴゴゴ — the coffin rises from the earth
  run(() => {
    let coffin;
    try {
      coffin = dim.spawnEntity("aegis:edo_coffin", spot);
      coffin.teleport(spot, { facingLocation: { x: base.x, y: spot.y, z: base.z } });
    } catch {
      coffin = undefined;
    }
    if (film) showTitle(player, " ", { subtitle: "§8ゴ  ゴ  ゴ  ゴ", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10 });
    sfx(dim, "aegis.charge", spot, 2, 0.45);
    shake(dim, spot, 0.45, 1.6, 20);
    for (let t = 0; t < 32; t += 3) {
      system.runTimeout(() => {
        api.particle(dim, "aegis:dust", spot);
        api.particle(dim, "aegis:cine_debris", spot, [0.35, 0.28, 0.22]);
        if (t % 6 === 0) api.sound(dim, "dig.stone", spot, 1.2, 0.5);
      }, t);
    }
    // the coffin crumbles back to dust a while after it opened
    system.runTimeout(() => {
      try {
        if (coffin && api.isValid(coffin)) {
          api.particle(dim, "aegis:dust", spot);
          api.particle(dim, "aegis:cine_debris", spot, [0.4, 0.3, 0.2]);
          coffin.remove();
        }
      } catch {
        /* ignore */
      }
    }, LID_FALLS + 100);
  }, T.coffin);

  if (film) {
    // over the shoulder as it rises, then push in on the coffin
    run(() => cam(player, at(-1.4, 0.9, 2.1), at(3.8, 0, 1.4), 0.6), T.coffin + 4);
    run(() => cam(player, at(1.0, 1.9, 1.7), at(3.8, 0, 1.4), 2.6), T.coffin + 16);
    run(() => cam(player, at(2.0, 1.9, 1.3), at(3.8, 0, 1.5)), T.coffin + 50); // front diagonal: the lid falls past, not through, the lens
    run(() => cam(player, at(1.8, 2.3, 1.4), at(3.8, 0, 1.5), 1.2), T.coffin + 51);
  }

  // 4) the lid falls: the reanimated shinobi stands inside
  run(() => {
    sfx(dim, "random.anvil_land", spot, 0.7, 0.5);
    sfx(dim, "aegis.impact", spot, 1.2, 0.6);
    api.particle(dim, "aegis:dust", at(1.6, 0, 0.1));
    api.particle(dim, "aegis:dust", at(2.6, 0, 0.1));
    api.particle(dim, "aegis:smoke_puff", at(2.6, 0, 0.6));
    let b;
    try {
      b = dim.spawnEntity("aegis:genin", spot);
      b.teleport(spot, { facingLocation: { x: base.x, y: spot.y + 1.6, z: base.z } });
    } catch {
      return;
    }
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
    b.nameTag = `§8[Edo Tensei] §f${F.name}`;
    eff(b, "slowness", 30, 255); // a moment of stillness in the coffin
    eff(b, "health_boost", LIFETIME, 4);
    eff(b, "regeneration", LIFETIME, 1);
    eff(b, "strength", LIFETIME, 2);
    eff(b, "resistance", LIFETIME, 1);
    eff(b, "fire_resistance", LIFETIME, 0);
    eff(b, "speed", LIFETIME, 0);
    try {
      const hc = b.getComponent("minecraft:health");
      hc.setCurrentValue(hc.effectiveMax);
    } catch {
      /* ignore */
    }
    for (let k = 0; k < 20; k += 2) system.runTimeout(() => api.isValid(b) && api.particle(dim, "aegis:slash", up(b.location, 0.4 + Math.random() * 1.6), PAPER), k);
    bodies.set(b.id, { owner: player.id, fig, end: system.currentTick + LIFETIME, next: system.currentTick + 40 });
    world.sendMessage(`§8${player.name} used the forbidden Reanimation Jutsu — §f${F.name}§8 walks again.`);
  }, open);

  if (film) {
    run(() => {
      showTitle(player, "§l§8EDO TENSEI", { subtitle: `§f${F.name} §7returns from the dead`, fadeInDuration: 3, stayDuration: 45, fadeOutDuration: 12 });
      impactFx(dim, spot, F.color, 1.2);
      sfx(dim, "aegis.transform", spot, 1.4, 0.6);
    }, open + 6);
    run(() => cam(player, at(-2.4, 1.0, 2.5), at(3.0, 0, 1.2), 1.0), open + 22);
    const finish = () => {
      setCinematicBusy(player.id, false);
      if (!api.isValid(player)) return;
      cmd(player, "camera @s clear");
      cmd(player, "inputpermission set @s movement enabled");
    };
    system.runTimeout(finish, open + 40);
  } else {
    showTitle(player, "§8Reanimation Jutsu", { subtitle: `§7Edo Tensei — ${F.name}`, fadeInDuration: 4, stayDuration: 50, fadeOutDuration: 10 });
  }
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
      if (now % 20 === 0) api.particle(b.dimension, "aegis:slash", up(b.location, 0.6 + Math.random() * 1.4), [0.8, 0.78, 0.74]);
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

  // a destroyed body crumbles instead of dropping anything
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (bodies.has(deadEntity.id)) crumble(deadEntity.id, `§7The reanimated body of §f${FIGURES[bodies.get(deadEntity.id)?.fig]?.name ?? "your ally"}§7 was destroyed.`);
  });
}
