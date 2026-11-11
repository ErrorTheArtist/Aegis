// Enemy ninja AI: rogue / Sound / Anbu ninja and the Akatsuki bosses (Itachi, Kisame, Deidara).
// Natural rogue ninja spawn at night; Akatsuki hunt players who carry a Tailed Beast.

import { world, system } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { NPC_TYPES, AKATSUKI, setupNpc } from "./npcs.js";
import { initLegends, legendTick, updateLegend } from "./legends.js";

const DIMENSIONS = ["overworld", "nether", "the_end"];
let api;
const state = new Map(); // entity id -> { next, subNext }

function eff(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: true });
  } catch {
    /* ignore */
  }
}

function survivalPlayersNear(dim, loc, r) {
  try {
    return dim.getPlayers({ location: loc, maxDistance: r }).filter((p) => {
      const gm = String(p.getGameMode()).toLowerCase();
      return gm !== "creative" && gm !== "spectator";
    });
  } catch {
    return [];
  }
}

function nearest(e, list) {
  let best;
  let bd = Infinity;
  for (const p of list) {
    const d = api.sub(p.location, e.location);
    const dist = d.x * d.x + d.y * d.y + d.z * d.z;
    if (dist < bd) {
      bd = dist;
      best = p;
    }
  }
  return best ? { target: best, dist: Math.sqrt(bd) } : undefined;
}

const chest = (e) => api.add(e.location, { x: 0, y: 1.2, z: 0 });
const aim = (from, to) => api.norm(api.sub(api.add(to.location, { x: 0, y: 1, z: 0 }), from));

function throwAt(e, t, opts) {
  const start = api.add(e.getHeadLocation(), api.scale(aim(e.getHeadLocation(), t), 1.2));
  api.launchProjectile(e, start, aim(start, t), { ignoreFamily: "ninja", ...opts });
}

function behind(attacker, dist = 2) {
  const d = attacker.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  return api.sub(attacker.location, api.scale(h, dist));
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------
const KUNAI = { noOrb: true, speed: 1.7, maxAge: 16, damage: 4, radius: 1.2, knock: 0.3, fire: 0, trail: "aegis:slash", burst: "aegis:slash", color: [0.9, 0.9, 0.95], hitRadius: 1.1, sound: "random.bowhit" };

const ROLE_AI = {
  rogue(e, t, dist) {
    if (dist > 4 && Math.random() < 0.7) {
      api.anim(e, "animation.aegis.palm_thrust");
      throwAt(e, t, KUNAI);
      api.sound(e.dimension, "random.bow", e.location, 0.8, 1.4);
      return 50;
    }
    api.anim(e, "animation.aegis.hand_signs");
    throwAt(e, t, { damage: 6, radius: 2.5, knock: 0.6, fire: 3 });
    api.sound(e.dimension, "mob.ghast.fireball", e.location, 0.8, 1);
    return 80;
  },
  sound(e, t, dist) {
    if (dist > 9) {
      throwAt(e, t, KUNAI);
      return 50;
    }
    api.anim(e, "animation.aegis.palm_thrust");
    const dir = e.getViewDirection();
    for (let d = 1; d <= 8; d++) api.particle(e.dimension, "aegis:wind_gust", api.add(e.getHeadLocation(), api.scale(dir, d)));
    api.sound(e.dimension, "mob.warden.sonic_boom", e.location, 0.5, 1.6);
    for (const p of survivalPlayersNear(e.dimension, e.location, 9)) {
      if (api.dot(api.norm(api.sub(p.location, e.location)), dir) < 0.5) continue;
      api.hurt(p, 4, e);
      const h = api.norm({ x: p.location.x - e.location.x, y: 0, z: p.location.z - e.location.z });
      api.knockback(p, h.x, h.z, 1.5, 0.4);
      eff(p, "nausea", 120, 0);
    }
    return 70;
  },
  anbu(e, t, dist) {
    if (dist > 3 && dist < 18) {
      api.particle(e.dimension, "aegis:smoke_puff", e.location);
      e.teleport(behind(t), { facingLocation: t.location });
      api.particle(e.dimension, "aegis:smoke_puff", e.location);
      api.sound(e.dimension, "mob.endermen.portal", e.location, 0.7, 1.6);
      system.runTimeout(() => {
        if (!api.isValid(e) || !api.isValid(t)) return;
        api.anim(e, "animation.aegis.sword_thrust");
        api.hurt(t, 6, e);
        api.particle(e.dimension, "aegis:slash", chest(t), [0.9, 0.9, 1]);
      }, 6);
      return 90;
    }
    throwAt(e, t, KUNAI);
    return 40;
  },
};

const MEMBER_AI = {
  itachi(e, t, dist) {
    const r = Math.random();
    if (r < 0.35) {
      // Amaterasu
      api.sound(e.dimension, "mob.wither.shoot", e.location, 0.7, 0.6);
      for (let i = 0; i < 5; i++) {
        system.runTimeout(() => {
          if (!api.isValid(t)) return;
          api.particle(t.dimension, "aegis:amaterasu", t.location);
          api.hurt(t, 3, e, "fire");
          try {
            t.setOnFire(4, true);
          } catch {
            /* ignore */
          }
        }, i * 20);
      }
      showTitle(t, "§4Amaterasu", { subtitle: "§7Black flames cling to you!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
      return 140;
    }
    if (r < 0.6) {
      // Tsukuyomi
      eff(t, "blindness", 60, 0);
      eff(t, "nausea", 160, 0);
      eff(t, "slowness", 60, 3);
      api.hurt(t, 6, e, "magic");
      showTitle(t, "§cTsukuyomi", { subtitle: "§7You are trapped in his genjutsu…", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10 });
      return 160;
    }
    api.anim(e, "animation.aegis.hand_signs");
    throwAt(e, t, { damage: 10, radius: 3.5, knock: 0.9, fire: 5 });
    api.sound(e.dimension, "mob.ghast.fireball", e.location, 1, 0.8);
    return 80;
  },
  kisame(e, t, dist) {
    if (Math.random() < 0.55 || dist > 6) {
      // Water Shark Bomb
      api.anim(e, "animation.aegis.both_palms");
      throwAt(e, t, { speed: 1.1, maxAge: 40, damage: 12, radius: 3.5, knock: 2.2, fire: 0, trail: "aegis:beast_mist", burst: "aegis:beast_burst", color: [0.2, 0.5, 1], hitRadius: 1.8, sound: "random.splash", orbEvent: "aegis:as_rasengan" });
      api.sound(e.dimension, "random.splash", e.location, 1, 0.6);
      return 90;
    }
    // Water Prison
    eff(t, "slowness", 60, 255);
    eff(t, "weakness", 80, 1);
    for (let i = 0; i < 3; i++) api.particle(t.dimension, "aegis:beast_mist", t.location, [0.3, 0.6, 1]);
    api.sound(t.dimension, "bucket.fill_water", t.location, 1, 0.7);
    showTitle(t, "§9Water Prison", { subtitle: "§7You can't move!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
    return 140;
  },
  deidara(e, t, dist) {
    if (dist < 6) {
      // keeps his distance
      const away = api.norm({ x: e.location.x - t.location.x, y: 0, z: e.location.z - t.location.z });
      api.knockback(e, away.x, away.z, 2.2, 0.8);
    }
    if (Math.random() < 0.6) {
      // C1 clay birds
      for (let k = 0; k < 3; k++) {
        system.runTimeout(() => {
          if (!api.isValid(e) || !api.isValid(t)) return;
          throwAt(e, t, { speed: 1.0, maxAge: 40, damage: 6, radius: 2.5, knock: 0.8, fire: 0, trail: "aegis:beast_aura", burst: "aegis:fire_burst", color: [1, 0.9, 0.7], hitRadius: 1.2, sound: "random.explode" });
        }, k * 6);
      }
      api.sound(e.dimension, "mob.parrot.fly", e.location, 1, 1);
      return 80;
    }
    // C3: telegraphed big blast where the target stands
    const spot = { ...t.location };
    for (let i = 0; i < 30; i += 5) {
      system.runTimeout(() => {
        for (let a = 0; a < 16; a++) {
          const ang = (a / 16) * Math.PI * 2;
          api.particle(e.dimension, "aegis:slash", api.add(spot, { x: Math.cos(ang) * 4.5, y: 0.3, z: Math.sin(ang) * 4.5 }), [1, 0.6, 0.2]);
        }
      }, i);
    }
    showTitle(t, "§6Art is an explosion!", { subtitle: "§7Get out of the circle!", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
    system.runTimeout(() => {
      if (!api.isValid(e)) return;
      api.particle(e.dimension, "aegis:fire_burst", api.add(spot, { x: 0, y: 1, z: 0 }));
      api.particle(e.dimension, "minecraft:huge_explosion_emitter", spot);
      api.sound(e.dimension, "random.explode", spot, 2, 0.6);
      for (const p of survivalPlayersNear(e.dimension, spot, 5)) api.hurt(p, 16, e, "entityExplosion");
    }, 32);
    return 160;
  },
};

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
function update(e, now) {
  let st = state.get(e.id);
  if (!st) {
    st = { next: now + 40, subNext: 0 };
    state.set(e.id, st);
  }
  const isLegend = e.typeId === "aegis:legend";
  if (isLegend) {
    try {
      legendTick(e);
    } catch {
      /* ignore */
    }
  }
  if (now < st.next) return;
  const isBoss = isLegend || e.typeId === "aegis:akatsuki";
  const found = nearest(e, survivalPlayersNear(e.dimension, e.location, isBoss ? 32 : 20));
  if (!found) return;
  let cd = 60;
  try {
    if (isLegend) cd = updateLegend(e, found.target, found.dist);
    else if (isBoss) cd = MEMBER_AI[e.getDynamicProperty("aegis:member") ?? "itachi"]?.(e, found.target, found.dist) ?? 60;
    else cd = ROLE_AI[e.getDynamicProperty("aegis:role") ?? "rogue"]?.(e, found.target, found.dist) ?? 60;
  } catch {
    /* ignore */
  }
  st.next = now + Math.round(cd * (0.8 + Math.random() * 0.4));
}

export function spawnAkatsukiNear(player, message) {
  const dim = player.dimension;
  const a = Math.random() * Math.PI * 2;
  const at = { x: player.location.x + Math.cos(a) * 22, y: player.location.y + 1, z: player.location.z + Math.sin(a) * 22 };
  try {
    const e = dim.spawnEntity("aegis:akatsuki", at);
    setupNpc(e, { type: "akatsuki", member: "random", skin: -1, name: "", count: 1, invuln: false });
    api.particle(dim, "aegis:smoke_puff", at);
    showTitle(player, "§cAkatsuki", { subtitle: message, stayDuration: 50 });
    api.sound(dim, "mob.wither.ambient", player.location, 0.6, 0.7);
  } catch {
    /* ignore */
  }
}

export function initEnemies(helpers) {
  api = helpers;
  initLegends(helpers);

  system.runInterval(() => {
    const now = system.currentTick;
    for (const name of DIMENSIONS) {
      let list = [];
      try {
        list = world.getDimension(name).getEntities({ families: ["ninja"] });
      } catch {
        continue;
      }
      for (const e of list) update(e, now);
    }
  }, 10);

  // Natural spawns: pick a faction; Akatsuki without a member get one.
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (entity.typeId !== "aegis:hostile_ninja" && entity.typeId !== "aegis:akatsuki") return;
    system.runTimeout(() => {
      if (!api.isValid(entity) || entity.getDynamicProperty("aegis:role")) return;
      if (entity.typeId === "aegis:akatsuki") {
        setupNpc(entity, { type: "akatsuki", member: "random", skin: -1, name: "", invuln: false }, { natural: true });
        for (const p of entity.dimension.getPlayers({ location: entity.location, maxDistance: 64 })) {
          p.sendMessage(`§c${entity.nameTag}§c of the Akatsuki has been sighted nearby…`);
        }
      } else {
        const r = Math.random();
        const type = r < 0.7 ? "rogue" : r < 0.9 ? "sound" : "anbu";
        entity.setDynamicProperty("aegis:role", type);
        entity.setProperty("aegis:skin", NPC_TYPES[type].skin);
        entity.triggerEvent(`aegis:tier_${NPC_TYPES[type].tier}`);
        entity.nameTag = NPC_TYPES[type].name;
      }
    }, 2);
  });

  // Substitution: ninja sometimes swap with a log and reappear behind their attacker.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (hurtEntity.typeId !== "aegis:hostile_ninja" && hurtEntity.typeId !== "aegis:akatsuki") return;
    const role = hurtEntity.getDynamicProperty("aegis:role");
    const member = hurtEntity.getDynamicProperty("aegis:member");
    const chance = member === "itachi" ? 0.3 : role === "anbu" ? 0.25 : role === "rogue" ? 0.15 : 0;
    const st = state.get(hurtEntity.id) ?? {};
    const attacker = damageSource?.damagingEntity;
    if (!attacker || Math.random() > chance || system.currentTick < (st.subNext ?? 0)) return;
    st.subNext = system.currentTick + 160;
    state.set(hurtEntity.id, st);
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
      api.particle(hurtEntity.dimension, "aegis:smoke_puff", hurtEntity.location);
      hurtEntity.teleport(behind(attacker, 2.5), { facingLocation: attacker.location });
      api.particle(hurtEntity.dimension, member === "itachi" ? "aegis:amaterasu" : "aegis:smoke_puff", hurtEntity.location);
      api.sound(hurtEntity.dimension, member === "itachi" ? "mob.bat.takeoff" : "random.pop", hurtEntity.location, 1, 0.6);
    } catch {
      /* ignore */
    }
  });

  // Kisame's Samehada drains chakra on hit.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== "aegis:akatsuki" || hitEntity?.typeId !== "minecraft:player") return;
    if (damagingEntity.getDynamicProperty("aegis:member") !== "kisame") return;
    api.setChakra(hitEntity, api.getChakra(hitEntity) - 15);
    hitEntity.onScreenDisplay.setActionBar("§9Samehada devours your chakra!");
  });

  // Akatsuki hunt Jinchūriki (every 5 minutes, 35% chance per Jinchūriki in the overworld).
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (!p.getDynamicProperty("aegis:bijuu") || p.dimension.id !== "minecraft:overworld" || Math.random() > 0.35) continue;
      spawnAkatsukiNear(p, "§7They've come for your Tailed Beast!");
    }
  }, 6000);

  for (const k of Object.keys(AKATSUKI)) if (!MEMBER_AI[k]) throw new Error(`missing AI for ${k}`);
}
