// Reanimation Jutsu: Edo Tensei — a forbidden scroll. Choose a fallen shinobi; a coffin rises from the earth and they
// fight beside you for 60 seconds with their own signature jutsu, then their soul returns to the afterlife.
// The body is an allied Genin wearing their skin; every jutsu it uses is cast in your name (it never hits you or your
// companions, and kills count for you).

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { impactFx, sfx, shake } from "./cinematic.js";
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

function reanimate(player, fig) {
  const F = FIGURES[fig];
  for (const [id, st] of [...bodies]) if (st.owner === player.id) crumble(id); // one at a time
  const dim = player.dimension;
  const d = player.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  const spot = add(player.location, api.scale(h, 3));
  api.anim(player, "animation.aegis.summon_slam");
  showTitle(player, "§8Reanimation Jutsu", { subtitle: `§7Edo Tensei — ${F.name}`, fadeInDuration: 4, stayDuration: 50, fadeOutDuration: 10 });
  sfx(dim, "aegis.seal", spot, 2, 0.6);
  sfx(dim, "aegis.charge", spot, 1.5, 0.6);
  shake(dim, spot, 0.4, 1.6, 20);
  // the coffin rises from the earth
  for (let t = 0; t < 30; t += 3) {
    system.runTimeout(() => {
      for (let y = 0; y < 2.2; y += 0.55) api.particle(dim, "aegis:cine_debris", up(spot, y * (t / 30)), [0.35, 0.28, 0.22]);
      api.particle(dim, "aegis:dust", spot);
      api.particle(dim, "aegis:slash", up(spot, 1 + Math.random()), [0.8, 0.78, 0.74]); // paper flakes
    }, t);
  }
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    let b;
    try {
      b = dim.spawnEntity("aegis:genin", spot);
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
    impactFx(dim, spot, F.color, 2);
    api.particle(dim, "aegis:smoke_puff", spot);
    bodies.set(b.id, { owner: player.id, fig, end: system.currentTick + LIFETIME, next: system.currentTick + 30 });
    world.sendMessage(`§8${player.name} used the forbidden Reanimation Jutsu — §f${F.name}§8 walks again.`);
  }, 30);
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
