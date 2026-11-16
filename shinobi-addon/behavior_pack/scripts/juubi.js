// The Ten-Tails (v1.54) — the strongest beast in the world. It's creative-only: it comes from its spawn egg and nothing
// else. No summoning scroll rolls it, no quest calls it, the Four Symbols Seal can't hold it, and survival players
// can't keep its egg (bans.js takes it off them). 5,000 HP, and it takes the one-rampage slot like any Tailed Beast.
//
// Its moves (every one scales with the target's level, like every boss):
//   • Giant Tailed Beast Bomb — a long charge at its mouth, then a huge bomb (9-block blast)
//   • Tail Slam               — rears up and slams, a shockwave through everything within 9 blocks
//   • Wood Spikes             — roots burst up under each target a moment after the ground cracks (step away!)
//   • Roar                    — slows and weakens everyone within 14 blocks
//   • Leap                    — jumps at a target who runs and lands with a crash
//   • Phase 2 at half health  — "The Ten-Tails awakens": tougher, faster, and a three-bomb barrage

import { world, system } from "@minecraft/server";
import { isGraced } from "./grace.js";
import { showTitle } from "./hud.js";
import { beastAwakenFx, aura, sfx } from "./cinematic.js";

export const JUUBI = "aegis:juubi";
const NAME = "§4The Ten-Tails§r";
const COLOR = [0.8, 0.12, 0.18];
const WOOD = [0.45, 0.32, 0.18];
const DIMENSIONS = ["overworld", "nether", "the_end"];
const POWER = 2.4; // its hits next to a nine-tails' (Kurama hits ×2.11)
const pw = (base) => Math.round(base * POWER);

let api;
const state = new Map(); // entity id -> { next, nextSlam, nextLeap, enraged }

function eff(entity, id, ticks, amp = 0, particles = true) {
  try {
    entity.addEffect(id, ticks, { amplifier: amp, showParticles: particles });
  } catch {
    /* ignore */
  }
}

// Players it can fight: not creative / spectator, not in a grace period.
export function juubiTargets(dim, loc, radius) {
  let list = [];
  try {
    list = dim.getPlayers({ location: loc, maxDistance: radius });
  } catch {
    return [];
  }
  return list.filter((p) => {
    try {
      const gm = String(p.getGameMode()).toLowerCase();
      return gm !== "creative" && gm !== "spectator" && !isGraced(p);
    } catch {
      return false;
    }
  });
}

function nearest(boss, radius = 48) {
  let best;
  let bestD = Infinity;
  for (const p of juubiTargets(boss.dimension, boss.location, radius)) {
    const d = api.sub(p.location, boss.location);
    const dist = d.x * d.x + d.y * d.y + d.z * d.z;
    if (dist < bestD) {
      bestD = dist;
      best = p;
    }
  }
  return best;
}

function mouthPos(boss) {
  const head = boss.getHeadLocation();
  const d = boss.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  return api.add(head, api.scale(h, 3));
}

function ring(dim, center, radius, id, color, points = 20) {
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    api.particle(dim, id, api.add(center, { x: Math.cos(a) * radius, y: 0.4, z: Math.sin(a) * radius }), color);
  }
}

// Hurts everything around `center` that it may hit (not other Tailed Beasts).
function blast(boss, center, radius, damage, knock, lift = 0.4, extra) {
  let hit = 0;
  for (const e of boss.dimension.getEntities({ location: center, maxDistance: radius })) {
    if (e.id === boss.id || !api.canBeHit(e, boss) || e.matches?.({ families: ["tailed_beast"] })) continue;
    api.hurt(e, damage, boss);
    if (knock) {
      const away = api.norm({ x: e.location.x - center.x, y: 0, z: e.location.z - center.z });
      api.knockback(e, away.x, away.z, knock, lift);
    }
    extra?.(e);
    hit++;
  }
  return hit;
}

const roarAnim = (boss) => api.anim(boss, "animation.aegis.bijuu_roar", "aegis_roar");

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------
export function giantBomb(boss, target, charge = 40) {
  const dim = boss.dimension;
  roarAnim(boss);
  api.sound(dim, "mob.warden.sonic_charge", boss.location, 3, 0.45);
  sfx(dim, "aegis.charge", boss.location, 3, 0.6);
  for (let t = 0; t < charge; t += 5) system.runTimeout(() => api.isValid(boss) && aura(boss, COLOR, true), t);
  const orb = api.spawnFx(dim, "aegis:jutsu_orb", "aegis:as_bijuudama_big", mouthPos(boss));
  api.follow(orb, () => (api.isValid(boss) ? api.sub(mouthPos(boss), { x: 0, y: 0.25, z: 0 }) : undefined), charge);
  for (let i = 0; i < charge; i += 5) system.runTimeout(() => api.isValid(boss) && api.particle(dim, "aegis:bijuudama_charge", mouthPos(boss)), i);
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    const start = mouthPos(boss);
    const aim = api.isValid(target) ? api.add(target.location, { x: 0, y: 1, z: 0 }) : api.add(start, boss.getViewDirection());
    api.launchProjectile(boss, start, api.sub(aim, start), {
      speed: 1.2, maxAge: 70, damage: pw(14), radius: 9, knock: 3.5, fire: 0,
      orbEvent: "aegis:as_bijuudama_big", trail: "aegis:beast_aura", burst: "aegis:beast_burst", color: COLOR,
      hitRadius: 2.5, sound: "random.explode", ignoreFamily: "tailed_beast", power: 3,
    });
    api.sound(dim, "mob.warden.sonic_boom", start, 3, 0.55);
  }, charge);
}

export function tailSlam(boss) {
  const dim = boss.dimension;
  roarAnim(boss);
  api.sound(dim, "mob.ravager.roar", boss.location, 3, 0.5);
  ring(dim, boss.location, 4, "aegis:beast_aura", COLOR, 16); // the warning: it's about to slam
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    const at = { ...boss.location };
    api.particle(dim, "minecraft:huge_explosion_emitter", at);
    for (let k = 0; k < 3; k++) {
      system.runTimeout(() => {
        ring(dim, at, 3 + k * 3, "aegis:smoke_puff", undefined, 14);
        ring(dim, at, 3 + k * 3, "aegis:beast_aura", COLOR, 14);
      }, k * 3);
    }
    api.sound(dim, "random.explode", at, 3, 0.5);
    try {
      dim.runCommand(`camerashake add @a[x=${Math.floor(at.x)},y=${Math.floor(at.y)},z=${Math.floor(at.z)},r=20] 0.5 0.6 positional`);
    } catch {
      /* ignore */
    }
    blast(boss, at, 9, pw(7), 2.8, 0.6);
  }, 14);
}

// Roots burst up under every target in range, after a short warning — a target who keeps moving dodges them.
export function woodSpikes(boss, radius = 24) {
  const dim = boss.dimension;
  const marks = juubiTargets(dim, boss.location, radius).slice(0, 6).map((p) => ({ ...p.location }));
  if (!marks.length) return;
  roarAnim(boss);
  api.sound(dim, "mob.enderdragon.growl", boss.location, 2.5, 0.6);
  for (const at of marks) {
    api.particle(dim, "aegis:dust", at);
    sfx(dim, "aegis.earth_break", at, 1.2, 0.7);
    for (let t = 0; t < 14; t += 4) system.runTimeout(() => api.particle(dim, "aegis:wood_burst_dust", at, WOOD), t);
  }
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    for (const at of marks) {
      for (let y = 0; y < 3.5; y += 0.7) api.particle(dim, "aegis:wood_burst", api.add(at, { x: 0, y, z: 0 }), WOOD);
      sfx(dim, "aegis.earth_break", at, 2, 0.9);
      blast(boss, at, 2.6, pw(9), 0.3, 1.1, (e) => eff(e, "slowness", 60, 2));
    }
  }, 16);
}

export function roar(boss) {
  const dim = boss.dimension;
  roarAnim(boss);
  api.sound(dim, "mob.enderdragon.growl", boss.location, 4, 0.4);
  api.particle(dim, "aegis:beast_burst", api.add(boss.location, { x: 0, y: 3, z: 0 }), COLOR);
  for (let k = 0; k < 4; k++) system.runTimeout(() => api.isValid(boss) && ring(dim, boss.location, 3 + k * 3.5, "aegis:beast_aura", COLOR, 22), k * 3);
  blast(boss, boss.location, 14, pw(5), 2.2, 0.4, (e) => {
    eff(e, "slowness", 100, 1);
    eff(e, "weakness", 160, 1);
  });
}

function leap(boss, t) {
  const dim = boss.dimension;
  const d = api.sub(t.location, boss.location);
  const dist = Math.sqrt(d.x * d.x + d.z * d.z);
  const to = api.norm({ x: d.x, y: 0, z: d.z });
  roarAnim(boss);
  api.sound(dim, "mob.ravager.roar", boss.location, 3, 0.6);
  api.knockback(boss, to.x, to.z, Math.min(5.5, 1.2 + dist * 0.18), 1.1);
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    api.particle(dim, "aegis:beast_burst", boss.location, COLOR);
    api.particle(dim, "minecraft:huge_explosion_emitter", boss.location);
    ring(dim, boss.location, 4, "aegis:smoke_puff", undefined, 12);
    api.sound(dim, "random.explode", boss.location, 3, 0.55);
    blast(boss, boss.location, 7, pw(10), 2.6);
  }, 22);
}

// Phase 2: three bombs, one after another, at up to three targets.
function barrage(boss) {
  const targets = juubiTargets(boss.dimension, boss.location, 40).slice(0, 3);
  if (!targets.length) return;
  for (let k = 0; k < 3; k++) {
    system.runTimeout(() => {
      if (api.isValid(boss)) giantBomb(boss, targets[k % targets.length], 24);
    }, k * 30);
  }
}

// ---------------------------------------------------------------------------
// Brain (every 10 ticks)
// ---------------------------------------------------------------------------
function update(boss, now) {
  let st = state.get(boss.id);
  if (!st) {
    st = { next: now + 60, nextSlam: now + 20, nextLeap: now + 80, enraged: false };
    state.set(boss.id, st);
  }
  api.particle(boss.dimension, "aegis:beast_aura", boss.location, COLOR);
  if (!boss.getEffect?.("resistance")) eff(boss, "resistance", 999999, st.enraged ? 2 : 1, false);

  try {
    const h = boss.getComponent("minecraft:health");
    if (!st.enraged && h.currentValue <= h.effectiveMax * 0.5) {
      st.enraged = true;
      eff(boss, "strength", 999999, 2, false);
      eff(boss, "speed", 999999, 1, false);
      eff(boss, "resistance", 999999, 2, false);
      eff(boss, "regeneration", 200, 3, false);
      roar(boss);
      beastAwakenFx(boss, COLOR);
      st.next = now + 30;
      for (const p of boss.dimension.getPlayers({ location: boss.location, maxDistance: 64 })) {
        showTitle(p, NAME, { subtitle: "§cawakens!", fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 10 });
      }
    }
  } catch {
    /* ignore */
  }

  const target = nearest(boss);
  if (!target) return;
  const d = api.sub(target.location, boss.location);
  const dist = Math.sqrt(d.x * d.x + d.z * d.z);

  if (dist < 7 && now >= st.nextSlam) {
    tailSlam(boss);
    st.nextSlam = now + (st.enraged ? 40 : 70);
    return;
  }
  if (dist > 16 && now >= st.nextLeap) {
    leap(boss, target);
    st.nextLeap = now + (st.enraged ? 90 : 140);
    return;
  }
  if (now < st.next) return;
  const roll = Math.random();
  if (st.enraged && roll < 0.25) barrage(boss);
  else if (roll < 0.55) giantBomb(boss, target);
  else if (roll < 0.85) woodSpikes(boss);
  else roar(boss);
  st.next = now + Math.floor((st.enraged ? 55 : 85) * (0.8 + Math.random() * 0.4));
}

export function initJuubi(helpers) {
  api = helpers;
  system.runInterval(() => {
    const now = system.currentTick;
    for (const name of DIMENSIONS) {
      let list = [];
      try {
        list = world.getDimension(name).getEntities({ type: JUUBI });
      } catch {
        continue;
      }
      for (const boss of list) {
        try {
          update(boss, now);
        } catch {
          /* ignore one bad tick */
        }
      }
    }
  }, 10);

  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (entity.typeId !== JUUBI) return;
    system.runTimeout(() => {
      if (!api.isValid(entity)) return; // turned away by the one-rampage rule
      try {
        entity.nameTag = NAME;
      } catch {
        /* ignore */
      }
      roar(entity);
      beastAwakenFx(entity, COLOR);
      world.sendMessage(`${NAME}§c has appeared! §7(${Math.round(entity.location.x)}, ${Math.round(entity.location.z)})`);
    }, 6);
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== JUUBI) return;
    state.delete(deadEntity.id);
    try {
      api.particle(deadEntity.dimension, "aegis:beast_burst", api.add(deadEntity.location, { x: 0, y: 3, z: 0 }), COLOR);
      api.sound(deadEntity.dimension, "mob.enderdragon.death", deadEntity.location, 1, 0.8);
    } catch {
      /* ignore */
    }
    world.sendMessage(`${NAME}§7 has fallen.`);
  });
  world.afterEvents.entityRemove?.subscribe?.(({ removedEntityId }) => state.delete(removedEntityId));
}
