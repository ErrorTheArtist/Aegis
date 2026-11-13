// Tailed Beasts: nine boss mobs with special attacks, a summoning scroll, and the
// Jinchūriki system — land the killing blow and the beast is sealed inside you.
//
// Commands (cheats on):
//   /scriptevent aegis:bijuu summon kurama   — summon a beast in front of you
//   /scriptevent aegis:bijuu seal kurama     — become that beast's Jinchūriki directly
//   /scriptevent aegis:bijuu release         — release your sealed beast
//   /scriptevent aegis:bijuu info            — show your sealed beast
//   /scriptevent aegis:bijuu master          — master your sealed beast instantly (testing)
//
// Uzumaki with 100 Chakra + 100 Vitality can seal a weakened beast alive (into themselves or another
// player) and, once they carry a beast, open the seal and master it through an inner trial.
//
// Jinchūriki get a wearable Tailed Beast Cloak (chest slot). Wearing it = Tailed Beast Mode: a transformation
// cinematic (jinchuriki.js + jin_shots.js), a chakra shroud with the beast's ears and tails (tools/gen_jinchuriki.py),
// strong buffs, beast-chakra punches, and two techniques:
//   hold sneak (~1.7 s)   — charge and fire a Tailed Beast Bomb (the orb grows as it charges)
//   double-tap sneak      — the beast's own Beast Art (Sand Coffin, Blue Fire, … Chakra Arms)
// Mastering the beast turns the cloak into its golden Tailed Beast Chakra Mode form.

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { transformCinematic, beastAwakenFx, impactFx, aura, sfx, inCinematic } from "./cinematic.js";
import { initJinchuriki, jinTransform, beastArt, beastPunch, jinCleanup } from "./jinchuriki.js";
import { getStat, gainXp } from "./levels.js";

const BIJUU_PROP = "aegis:bijuu";
const OLD_CLOAK_ITEM = "aegis:bijuu_cloak";
const cloakItemOf = (id, mastered = false) => `aegis:cloak_${id}${mastered ? "_m" : ""}`; // _m: Tailed Beast Chakra Mode
const isCloakItem = (typeId) => typeof typeId === "string" && (typeId.startsWith("aegis:cloak_") || typeId === OLD_CLOAK_ITEM);
const SCROLL_ITEM = "aegis:bijuu_scroll";
const DIMENSIONS = ["overworld", "nether", "the_end"];

// color = [r, g, b] 0..1 for particles. weight = summon chance (more tails = rarer).
export const BEASTS = {
  shukaku: { name: "Shukaku", title: "the One-Tailed Raccoon", tails: 1, text: "§e", color: [0.85, 0.7, 0.4], element: sandCoffin },
  matatabi: { name: "Matatabi", title: "the Two-Tailed Cat", tails: 2, text: "§9", color: [0.2, 0.5, 1.0], element: blueFireBreath },
  isobu: { name: "Isobu", title: "the Three-Tailed Turtle", tails: 3, text: "§3", color: [0.4, 0.85, 0.8], element: coralShockwave },
  son_goku: { name: "Son Goku", title: "the Four-Tailed Ape", tails: 4, text: "§c", color: [1.0, 0.35, 0.1], element: lavaRain },
  kokuo: { name: "Kokuo", title: "the Five-Tailed Horse", tails: 5, text: "§f", color: [0.95, 0.95, 0.95], element: steamCharge },
  saiken: { name: "Saiken", title: "the Six-Tailed Slug", tails: 6, text: "§a", color: [0.6, 0.95, 0.4], element: acidMist },
  chomei: { name: "Chomei", title: "the Seven-Tailed Beetle", tails: 7, text: "§2", color: [0.6, 1.0, 0.3], element: scalePowder },
  gyuki: { name: "Gyuki", title: "the Eight-Tailed Ox", tails: 8, text: "§5", color: [0.65, 0.3, 0.7], element: inkSpray },
  kurama: { name: "Kurama", title: "the Nine-Tailed Fox", tails: 9, text: "§6", color: [1.0, 0.45, 0.05], element: kuramaRoar },
};

// Extra effects while in Tailed Beast Mode, on top of the shared ones (the stronger amplifier wins).
const CLOAK_PERKS = {
  shukaku: [["resistance", 3]],                               // a skin of sand
  matatabi: [["fire_resistance", 0], ["speed", 2]],           // cat-quick, born of fire
  isobu: [["water_breathing", 0], ["resistance", 2]],         // the shell
  son_goku: [["fire_resistance", 0], ["strength", 3]],        // lava and an ape's strength
  kokuo: [["speed", 3]],                                      // a horse's speed
  saiken: [["water_breathing", 0], ["regeneration", 1]],      // the slug heals
  chomei: [["jump_boost", 3], ["slow_falling", 0]],           // wings
  gyuki: [["strength", 3], ["water_breathing", 0]],           // eight tentacles of muscle
  kurama: [["regeneration", 1], ["strength", 3]],             // the strongest of the nine
};
// Bonus hearts (Health Boost levels, added to the clan/Vitality ones by clans.js) while transformed.
const SHROUD_HEARTS = { normal: 2, mastered: 4 };

// Boss damage scales with tail count.
const pw = (b, base) => Math.round(base * (1.3 + b.tails * 0.09));

let api;
const bossState = new Map(); // entity id -> { next, enraged }
const cloakActive = new Set(); // player ids currently transformed
const bombCharge = new Map(); // player id -> { ticks, orb, done }

const beastIdOf = (entity) => entity?.typeId?.startsWith("aegis:") && BEASTS[entity.typeId.slice(6)] ? entity.typeId.slice(6) : undefined;
const fullName = (b) => `${b.text}${b.name}, ${b.title}§r`;

// ---------------------------------------------------------------------------
// Jinchūriki data (used by main.js for chakra)
// ---------------------------------------------------------------------------
function sealedBeastId(player) {
  try {
    const id = player.getDynamicProperty(BIJUU_PROP);
    return typeof id === "string" && BEASTS[id] ? id : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// One Jinchūriki per Tailed Beast (world-wide registry, survives restarts and offline holders)
// ---------------------------------------------------------------------------
const holderKey = (id) => `aegis:jin_${id}`;
export function holderOf(id) {
  try {
    return JSON.parse(world.getDynamicProperty(holderKey(id)) ?? "null");
  } catch {
    return null;
  }
}
function setHolder(id, player) {
  world.setDynamicProperty(holderKey(id), player ? JSON.stringify({ id: player.id, name: player.name }) : undefined);
}
// May this player become the Jinchūriki of `id`?
function heldByOther(id, player) {
  const h = holderOf(id);
  return h && h.id !== player?.id ? h : null;
}
// Beasts that were spawned for a quest (or by other scripted fights) can be defeated but never sealed.
const unsealable = (e) => {
  try {
    return e.getDynamicProperty("aegis:no_seal") === true || e.getTags().some((t) => t.startsWith("aegis_q_"));
  } catch {
    return false;
  }
};

export function bijuuChakraBonus(player) {
  const b = BEASTS[sealedBeastId(player)];
  return b ? 50 + b.tails * 10 : 0;
}

// No natural chakra regen while in Tailed Beast Mode (and sneaking charges a bomb, not focus).
const MASTERED_PROP = "aegis:bijuu_mastered";
const DEATHS_PROP = "aegis:bijuu_deaths";
const MAX_DEATHS = 3;
export function isBijuuMastered(player) {
  try {
    return !!sealedBeastId(player) && player.getDynamicProperty(MASTERED_PROP) === true;
  } catch {
    return false;
  }
}

export function isTransformed(player) {
  return cloakActive.has(player.id);
}

// Effect levels clans.js merges into the player's long-lasting effects while they are transformed.
export function jinchurikiEffectLevels(player) {
  if (!cloakActive.has(player?.id)) return {};
  return { health_boost: isBijuuMastered(player) ? SHROUD_HEARTS.mastered : SHROUD_HEARTS.normal, night_vision: 1 };
}

// Extra damage on a melee hit while transformed (the M1 combo adds it to the punch) — 0 otherwise.
export function bijuuMeleeBonus(player, target) {
  if (!cloakActive.has(player?.id)) return 0;
  const b = BEASTS[sealedBeastId(player)];
  return b ? beastPunch(player, target, b, isBijuuMastered(player)) : 0;
}

export function bijuuRegenMultiplier(player) {
  return sealedBeastId(player) ? 1.3 : 1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eff(entity, id, ticks, amp = 0, particles = true) {
  try {
    entity.addEffect(id, ticks, { amplifier: amp, showParticles: particles });
  } catch {
    /* ignore */
  }
}

function playersNear(dim, loc, radius) {
  let list = [];
  try {
    list = dim.getPlayers({ location: loc, maxDistance: radius });
  } catch {
    return [];
  }
  return list.filter((p) => {
    try {
      const gm = String(p.getGameMode()).toLowerCase();
      return gm !== "creative" && gm !== "spectator";
    } catch {
      return true;
    }
  });
}

function nearestTarget(boss) {
  let best;
  let bestD = Infinity;
  for (const p of playersNear(boss.dimension, boss.location, 40)) {
    const d = api.sub(p.location, boss.location);
    const dist = d.x * d.x + d.y * d.y + d.z * d.z;
    if (dist < bestD) {
      bestD = dist;
      best = p;
    }
  }
  return best;
}

// Point in front of the beast's face.
function mouthPos(boss) {
  const head = boss.getHeadLocation();
  const d = boss.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  return api.add(head, api.scale(h, 2.2));
}

function ring(dim, center, radius, id, color, points = 20) {
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    api.particle(dim, id, api.add(center, { x: Math.cos(a) * radius, y: 0.4, z: Math.sin(a) * radius }), color);
  }
}

function blast(boss, center, radius, damage, knock, extra) {
  for (const e of boss.dimension.getEntities({ location: center, maxDistance: radius })) {
    if (!api.canBeHit(e, boss) || beastIdOf(e)) continue;
    api.hurt(e, damage, boss);
    const away = api.norm({ x: e.location.x - center.x, y: 0, z: e.location.z - center.z });
    if (knock) api.knockback(e, away.x, away.z, knock, 0.4);
    extra?.(e);
  }
}

function cone(boss, range, minDot) {
  const dir = boss.getViewDirection();
  return boss.dimension
    .getEntities({ location: boss.location, maxDistance: range })
    .filter((e) => api.canBeHit(e, boss) && !beastIdOf(e) && api.dot(api.norm(api.sub(e.location, boss.location)), dir) > minDot);
}

function roarAnim(boss) {
  api.anim(boss, "animation.aegis.bijuu_roar", "aegis_roar");
}

// ---------------------------------------------------------------------------
// Boss attacks
// ---------------------------------------------------------------------------
function tailedBeastBomb(boss, b, target) {
  const dim = boss.dimension;
  roarAnim(boss);
  api.sound(dim, "mob.warden.sonic_charge", boss.location, 2, 0.6);
  sfx(dim, "aegis.charge", boss.location, 2.5, 0.8);
  for (let t = 0; t < 28; t += 4) system.runTimeout(() => api.isValid(boss) && aura(boss, b.color, true), t);
  const CHARGE = 28;
  const orb = api.spawnFx(dim, "aegis:jutsu_orb", "aegis:as_bijuudama", mouthPos(boss));
  api.follow(orb, () => (api.isValid(boss) ? api.sub(mouthPos(boss), { x: 0, y: 0.25, z: 0 }) : undefined), CHARGE);
  for (let i = 0; i < CHARGE; i += 4) {
    system.runTimeout(() => api.isValid(boss) && api.particle(dim, "aegis:bijuudama_charge", mouthPos(boss)), i);
  }
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    const start = mouthPos(boss);
    const aim = api.isValid(target) ? api.add(target.location, { x: 0, y: 1, z: 0 }) : api.add(start, boss.getViewDirection());
    api.launchProjectile(boss, start, api.sub(aim, start), {
      speed: 1.3, maxAge: 60, damage: pw(b, 14), radius: 6, knock: 2.8, fire: 0,
      orbEvent: "aegis:as_bijuudama", trail: "aegis:beast_aura", burst: "aegis:beast_burst", color: b.color,
      hitRadius: 2, sound: "random.explode", ignoreFamily: "tailed_beast",
      power: 3,
    });
    api.sound(dim, "mob.warden.sonic_boom", start, 2, 0.7);
  }, CHARGE);
}

function roar(boss, b) {
  roarAnim(boss);
  api.sound(boss.dimension, "mob.enderdragon.growl", boss.location, 3, 0.7);
  api.particle(boss.dimension, "aegis:beast_burst", api.add(boss.location, { x: 0, y: 2, z: 0 }), b.color);
  ring(boss.dimension, boss.location, 5, "aegis:beast_aura", b.color);
  blast(boss, boss.location, 8, pw(b, 5), 2.4);
}

// 1 — Shukaku: Sand Coffin. Locks the target in sand, then crushes them.
function sandCoffin(boss, b, t) {
  const dim = boss.dimension;
  const spot = t.location;
  eff(t, "slowness", 60, 255);
  api.particle(dim, "aegis:beast_mist", spot, b.color);
  api.sound(dim, "dig.sand", spot, 2, 0.6);
  system.runTimeout(() => {
    api.particle(dim, "aegis:beast_burst", api.add(spot, { x: 0, y: 1, z: 0 }), b.color);
    api.sound(dim, "random.explode", spot, 1, 0.8);
    blast(boss, spot, 3.5, pw(b, 12), 0.5);
  }, 40);
}

// 2 — Matatabi: blue fire breath in a cone.
function blueFireBreath(boss, b) {
  const dim = boss.dimension;
  roarAnim(boss);
  const dir = boss.getViewDirection();
  const m = mouthPos(boss);
  for (let d = 1; d <= 14; d += 1.5) api.particle(dim, "aegis:beast_aura", api.add(m, api.scale(dir, d)), b.color);
  api.sound(dim, "mob.blaze.shoot", m, 2, 0.6);
  for (const e of cone(boss, 14, 0.6)) {
    api.hurt(e, pw(b, 10), boss, "fire");
    try {
      e.setOnFire(6, true);
    } catch {
      /* ignore */
    }
  }
}

// 3 — Isobu: coral shockwave rings.
function coralShockwave(boss, b) {
  const dim = boss.dimension;
  for (let k = 0; k < 4; k++) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      ring(dim, boss.location, 3 + k * 3, "aegis:beast_mist", b.color, 24);
      if (k === 0) api.sound(dim, "random.splash", boss.location, 3, 0.5);
    }, k * 5);
  }
  blast(boss, boss.location, 13, pw(b, 9), 2.2, (e) => eff(e, "slowness", 80, 2));
}

// 4 — Son Goku: lava rain around the target.
function lavaRain(boss, b, t) {
  const dim = boss.dimension;
  const center = t.location;
  for (let i = 0; i < 7; i++) {
    system.runTimeout(() => {
      const spot = api.add(center, { x: (Math.random() - 0.5) * 8, y: 0, z: (Math.random() - 0.5) * 8 });
      api.particle(dim, "aegis:fire_burst", spot);
      api.particle(dim, "aegis:beast_burst", spot, b.color);
      api.sound(dim, "bucket.empty_lava", spot, 1.5, 0.8);
      if (api.isValid(boss)) {
        blast(boss, spot, 3, pw(b, 7), 0.5, (e) => {
          try {
            e.setOnFire(5, true);
          } catch {
            /* ignore */
          }
        });
      }
    }, i * 6);
  }
}

// 5 — Kokuo: steam-powered charge.
function steamCharge(boss, b, t) {
  const dim = boss.dimension;
  const to = api.norm({ x: t.location.x - boss.location.x, y: 0, z: t.location.z - boss.location.z });
  api.particle(dim, "aegis:smoke_puff", boss.location);
  api.sound(dim, "random.fizz", boss.location, 3, 0.5);
  api.knockback(boss, to.x, to.z, 4, 0.3);
  const hit = new Set();
  for (let i = 1; i <= 14; i++) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      api.particle(dim, "aegis:beast_mist", boss.location, b.color);
      for (const e of dim.getEntities({ location: boss.location, maxDistance: 4 })) {
        if (hit.has(e.id) || !api.canBeHit(e, boss) || beastIdOf(e)) continue;
        hit.add(e.id);
        api.hurt(e, pw(b, 14), boss);
        api.knockback(e, to.x, to.z, 2.5, 0.6);
      }
    }, i);
  }
}

// 6 — Saiken: acid mist around itself.
function acidMist(boss, b) {
  const dim = boss.dimension;
  for (let k = 0; k < 4; k++) {
    system.runTimeout(() => {
      if (!api.isValid(boss)) return;
      for (let i = 0; i < 6; i++) {
        api.particle(dim, "aegis:beast_mist", api.add(boss.location, { x: (Math.random() - 0.5) * 12, y: 0.5, z: (Math.random() - 0.5) * 12 }), b.color);
      }
      blast(boss, boss.location, 9, pw(b, 3), 0, (e) => {
        eff(e, "poison", 100, 1);
        eff(e, "weakness", 100, 1);
      });
    }, k * 15);
  }
  api.sound(dim, "mob.slime.big", boss.location, 3, 0.5);
}

// 7 — Chomei: lifts into the air and showers blinding scale powder.
function scalePowder(boss, b) {
  const dim = boss.dimension;
  eff(boss, "levitation", 30, 3, false);
  system.runTimeout(() => api.isValid(boss) && eff(boss, "slow_falling", 80, 0, false), 30);
  api.sound(dim, "mob.bee.loop", boss.location, 3, 0.6);
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    for (let i = 0; i < 10; i++) {
      api.particle(dim, "aegis:beast_mist", api.add(boss.location, { x: (Math.random() - 0.5) * 16, y: -1 - Math.random() * 3, z: (Math.random() - 0.5) * 16 }), b.color);
    }
    for (const p of playersNear(dim, boss.location, 14)) {
      api.hurt(p, pw(b, 6), boss);
      eff(p, "blindness", 80, 0);
      eff(p, "nausea", 120, 0);
    }
  }, 30);
}

// 8 — Gyuki: ink spray cone.
function inkSpray(boss, b) {
  const dim = boss.dimension;
  roarAnim(boss);
  const dir = boss.getViewDirection();
  const m = mouthPos(boss);
  for (let d = 1; d <= 14; d += 1.5) api.particle(dim, "aegis:beast_mist", api.add(m, api.scale(dir, d)), [0.05, 0.02, 0.08]);
  api.sound(dim, "mob.squid.ink_squirt", m, 3, 0.5);
  for (const e of cone(boss, 14, 0.55)) {
    api.hurt(e, pw(b, 8), boss);
    eff(e, "blindness", 100, 0);
    eff(e, "slowness", 100, 2);
  }
}

// 9 — Kurama: a chakra-charged roar that blasts everything away and sets it ablaze.
function kuramaRoar(boss, b) {
  const dim = boss.dimension;
  roarAnim(boss);
  api.sound(dim, "mob.enderdragon.growl", boss.location, 4, 0.5);
  for (let k = 0; k < 5; k++) {
    system.runTimeout(() => api.isValid(boss) && ring(dim, boss.location, 2 + k * 3, "aegis:beast_aura", b.color, 28), k * 3);
  }
  api.particle(dim, "aegis:beast_burst", api.add(boss.location, { x: 0, y: 2, z: 0 }), b.color);
  blast(boss, boss.location, 16, pw(b, 10), 3.5, (e) => {
    eff(e, "weakness", 160, 1);
    try {
      e.setOnFire(4, true);
    } catch {
      /* ignore */
    }
  });
}

// Close range: a spinning tail sweep around the beast.
function tailSwipe(boss, b) {
  const dim = boss.dimension;
  api.sound(dim, "mob.ravager.attack", boss.location, 2, 0.6);
  ring(dim, boss.location, 3, "aegis:beast_aura", b.color, 18);
  ring(dim, boss.location, 5, "aegis:wind_gust", undefined, 18);
  blast(boss, boss.location, 6.5, pw(b, 7), 2.4);
}

// Long range: leaps at a fleeing target and slams down.
function leapSlam(boss, b, t) {
  const dim = boss.dimension;
  const d = api.sub(t.location, boss.location);
  const dist = Math.sqrt(d.x * d.x + d.z * d.z);
  const to = api.norm({ x: d.x, y: 0, z: d.z });
  roarAnim(boss);
  api.sound(dim, "mob.ravager.roar", boss.location, 2, 0.7);
  api.knockback(boss, to.x, to.z, Math.min(5, 1.2 + dist * 0.18), 1.0);
  system.runTimeout(() => {
    if (!api.isValid(boss)) return;
    api.particle(dim, "aegis:beast_burst", boss.location, b.color);
    api.particle(dim, "minecraft:huge_explosion_emitter", boss.location);
    ring(dim, boss.location, 4, "aegis:smoke_puff", undefined, 12);
    api.sound(dim, "random.explode", boss.location, 2, 0.6);
    blast(boss, boss.location, 7, pw(b, 10), 2.6);
  }, 22);
}

// ---------------------------------------------------------------------------
// Boss brain (runs every 10 ticks)
// ---------------------------------------------------------------------------
function updateBoss(boss, now) {
  const id = beastIdOf(boss);
  const b = BEASTS[id];
  let st = bossState.get(boss.id);
  if (!st) {
    st = { next: now + 40, nextSwipe: now, nextLeap: now + 60, enraged: false };
    bossState.set(boss.id, st);
  }
  // Chakra aura + natural toughness
  api.particle(boss.dimension, "aegis:beast_aura", boss.location, b.color);
  if (beingSealed.has(boss.id)) return; // bound by sealing chains
  if (!boss.getEffect?.("resistance")) eff(boss, "resistance", 999999, st.enraged ? 1 : 0, false);

  // Phase 2 at half health
  try {
    const h = boss.getComponent("minecraft:health");
    if (!st.enraged && h.currentValue <= h.effectiveMax * 0.5) {
      st.enraged = true;
      eff(boss, "strength", 999999, 2, false);
      eff(boss, "speed", 999999, 1, false);
      eff(boss, "resistance", 999999, 1, false);
      eff(boss, "regeneration", 200, 2, false);
      roar(boss, b);
      beastAwakenFx(boss, b.color);
      st.next = now; // attacks right away
      for (const p of playersNear(boss.dimension, boss.location, 48)) {
        showTitle(p, `${b.text}${b.name}`, { subtitle: "§cis enraged!", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
      }
    }
  } catch {
    /* ignore */
  }

  const target = nearestTarget(boss);
  if (!target) return;
  const d = api.sub(target.location, boss.location);
  const dist = Math.sqrt(d.x * d.x + d.z * d.z);

  // Reactive moves on their own cooldowns
  if (dist < 6 && now >= st.nextSwipe) {
    tailSwipe(boss, b);
    st.nextSwipe = now + (st.enraged ? 30 : 50);
  } else if (dist > 14 && now >= st.nextLeap) {
    leapSlam(boss, b, target);
    st.nextLeap = now + (st.enraged ? 80 : 130);
  }

  if (now < st.next) return;
  const roll = Math.random();
  if (roll < 0.4) tailedBeastBomb(boss, b, target);
  else if (roll < 0.9) b.element(boss, b, target);
  else roar(boss, b);

  const base = Math.max(40, 90 - b.tails * 5);
  st.next = now + Math.floor(base * (st.enraged ? 0.6 : 1) * (0.8 + Math.random() * 0.4));
}

// ---------------------------------------------------------------------------
// Summoning
// ---------------------------------------------------------------------------
function rollBeastId() {
  // a beast sealed inside a Jinchūriki can't be summoned (unless every beast is taken)
  let entries = Object.entries(BEASTS).filter(([id]) => !holderOf(id)).map(([id, b]) => [id, 10 - b.tails]);
  if (!entries.length) entries = Object.entries(BEASTS).map(([id, b]) => [id, 10 - b.tails]);
  const total = entries.reduce((s, [, wt]) => s + wt, 0);
  let r = Math.random() * total;
  for (const [id, wt] of entries) {
    r -= wt;
    if (r <= 0) return id;
  }
  return "shukaku";
}

function summonBeast(player, id) {
  const b = BEASTS[id];
  const dim = player.dimension;
  const d = player.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  const spot = api.add(player.location, api.scale(h, 8));
  api.sound(dim, "mob.wither.spawn", spot, 1.5, 0.7);
  for (let i = 0; i < 60; i += 5) {
    system.runTimeout(() => {
      ring(dim, spot, 3 - i / 30, "aegis:beast_aura", b.color, 16);
      api.particle(dim, "aegis:bijuudama_charge", api.add(spot, { x: 0, y: 1.5, z: 0 }));
    }, i);
  }
  for (const p of playersNear(dim, spot, 64)) {
    showTitle(p, "§4The seal weakens...", { subtitle: "§7a Tailed Beast stirs", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
  }
  system.runTimeout(() => {
    try {
      const boss = dim.spawnEntity(`aegis:${id}`, spot);
      roar(boss, b);
      beastAwakenFx(boss, b.color);
      api.particle(dim, "aegis:beast_burst", api.add(spot, { x: 0, y: 2, z: 0 }), b.color);
    } catch {
      /* ignore */
    }
    world.sendMessage(`§c${fullName(b)}§c has been released!`);
    try {
      for (const p of dim.getPlayers({ location: spot, maxDistance: 64 })) {
        showTitle(p, `${b.text}${b.name}`, { subtitle: `§7${b.title}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
      }
    } catch {
      /* ignore */
    }
  }, 60);
}

function useSummonScroll(player) {
  try {
    for (const name of DIMENSIONS) {
      const dim = world.getDimension(name);
      if (dim.id !== player.dimension.id) continue;
      const near = dim.getEntities({ location: player.location, maxDistance: 64, families: ["tailed_beast"] });
      if (near.length) {
        player.onScreenDisplay.setActionBar("§cA Tailed Beast is already rampaging nearby!");
        return;
      }
    }
  } catch {
    /* ignore */
  }
  const inv = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex;
  const it = inv?.getItem(slot);
  if (!it || it.typeId !== SCROLL_ITEM) return;
  if (it.amount > 1) {
    it.amount -= 1;
    inv.setItem(slot, it);
  } else inv.setItem(slot, undefined);
  api.anim(player, "animation.aegis.summon_slam");
  summonBeast(player, rollBeastId());
}

// ---------------------------------------------------------------------------
// Jinchūriki
// ---------------------------------------------------------------------------
function hasItem(player, typeId) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return true;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === typeId) return true;
  return chestItem(player)?.typeId === typeId;
}

function chestItem(player) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment("Chest");
  } catch {
    return undefined;
  }
}

function freshCloak(typeId) {
  const stack = new ItemStack(typeId, 1);
  stack.keepOnDeath = true;
  return stack;
}

// Turns this player's cloak of the other form (V1 ↔ mastered) into `want`, in the inventory and on the chest.
function swapCloak(player, id, want) {
  const forms = [cloakItemOf(id, false), cloakItemOf(id, true)];
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (inv) {
      for (let i = 0; i < inv.size; i++) {
        const t = inv.getItem(i)?.typeId;
        if (t !== want && forms.includes(t)) inv.setItem(i, freshCloak(want));
      }
    }
    const worn = chestItem(player)?.typeId;
    if (worn !== want && forms.includes(worn)) player.getComponent("minecraft:equippable").setEquipment("Chest", freshCloak(want));
  } catch {
    /* ignore */
  }
}

function giveCloak(player) {
  const id = sealedBeastId(player);
  if (!id) return;
  const want = cloakItemOf(id, isBijuuMastered(player));
  swapCloak(player, id, want);
  if (hasItem(player, want)) return;
  try {
    player.getComponent("minecraft:inventory").container.addItem(freshCloak(want));
  } catch {
    /* inventory full — retried on next spawn */
  }
}

function removeCloak(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (inv) for (let i = 0; i < inv.size; i++) if (isCloakItem(inv.getItem(i)?.typeId)) inv.setItem(i, undefined);
  if (isCloakItem(chestItem(player)?.typeId)) {
    try {
      player.getComponent("minecraft:equippable").setEquipment("Chest", undefined);
    } catch {
      /* ignore */
    }
  }
}

// Takes the cloak off and puts it back in the inventory (or drops it if full).
function unequipCloak(player) {
  const item = chestItem(player);
  if (!item) return;
  try {
    player.getComponent("minecraft:equippable").setEquipment("Chest", undefined);
    const left = player.getComponent("minecraft:inventory").container.addItem(item);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    /* ignore */
  }
}

export function sealInto(player, id, sealer) {
  const b = BEASTS[id];
  const other = heldByOther(id, player);
  if (other) {
    const msg = `§c${fullName(b)}§c already has a Jinchūriki: §f${other.name}§c. A Tailed Beast can only be sealed into one person.`;
    player.sendMessage(msg);
    if (sealer && sealer.id !== player.id) sealer.sendMessage(msg);
    return false;
  }
  const previous = sealedBeastId(player);
  if (previous && previous !== id && holderOf(previous)?.id === player.id) setHolder(previous, null);
  setHolder(id, player);
  endTransformation(player);
  removeCloak(player);
  player.setDynamicProperty(BIJUU_PROP, id);
  player.setDynamicProperty(MASTERED_PROP, false);
  player.setDynamicProperty(DEATHS_PROP, 0);
  giveCloak(player);
  showTitle(player, "§6Jinchūriki", { subtitle: `§7${b.text}${b.name}§7 is sealed within you`, fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 20 });
  api.sound(player.dimension, "ui.toast.challenge_complete", player.location, 1, 0.8);
  api.particle(player.dimension, "aegis:beast_burst", api.add(player.location, { x: 0, y: 1, z: 0 }), b.color);
  player.sendMessage(
    `§6You are now the Jinchūriki of ${fullName(b)}§6!\n§7+${bijuuChakraBonus(player)} max chakra, faster regen.\n§7Wear the §fTailed Beast Cloak§7 (chest slot) to enter §6Tailed Beast Mode§7. While transformed, §fhold sneak§7 to charge a §5Tailed Beast Bomb§7.`
  );
  if (sealer && sealer.id !== player.id) world.sendMessage(`§6${sealer.name}§e sealed ${fullName(b)}§e into §6${player.name}§e!`);
  else world.sendMessage(`§e${player.name} sealed ${fullName(b)}§e and became its Jinchūriki!`);
  return true;
}

function release(player) {
  const id = sealedBeastId(player);
  if (id && holderOf(id)?.id === player.id) setHolder(id, null);
  endTransformation(player);
  removeCloak(player);
  player.setDynamicProperty(BIJUU_PROP, undefined);
  player.setDynamicProperty(MASTERED_PROP, false);
}

function startTransformation(player, b) {
  cloakActive.add(player.id);
  sneak.delete(player.id);
  api.refreshEffects?.(player); // the shroud's extra hearts and beast eyes (merged by clans.js)
  jinTransform(player, b, isBijuuMastered(player), () => cloakActive.has(player.id));
}

function endTransformation(player) {
  const was = cloakActive.delete(player.id);
  const ch = bombCharge.get(player.id);
  if (ch) api.removeFx(ch.orb);
  bombCharge.delete(player.id);
  sneak.delete(player.id);
  if (!was) return;
  try {
    player.removeEffect("health_boost");
    player.removeEffect("night_vision");
  } catch {
    /* ignore */
  }
  api.refreshEffects?.(player); // back to the clan / Vitality levels
}

// ---------------------------------------------------------------------------
// Sneak input while transformed (checked every tick): a double tap is the Beast Art, a hold charges the bomb.
// ---------------------------------------------------------------------------
const sneak = new Map(); // player id -> { down, since, taps: [ticks], art }
const joinedAt = new Map(); // player id -> tick they (re)spawned
const TAP_WINDOW = 9;    // two presses within this many ticks
const HOLD_BOMB = 8;     // the bomb starts charging after holding this long

function updateSneak(player, b) {
  const now = system.currentTick;
  const s = sneak.get(player.id) ?? { down: false, since: 0, taps: [], art: false };
  sneak.set(player.id, s);
  if (player.isSneaking && !s.down) {
    s.down = true;
    s.since = now;
    s.taps = s.taps.filter((t) => now - t <= TAP_WINDOW);
    s.taps.push(now);
    if (s.taps.length >= 2 && !inCinematic(player)) {
      s.taps = [];
      s.art = true; // this press was the art, not a bomb
      beastArt(player, sealedBeastId(player), b, isBijuuMastered(player));
    }
  } else if (!player.isSneaking && s.down) {
    s.down = false;
    s.art = false;
  }
}

// Held long enough for the bomb (and not the second press of a double tap)?
function holdingForBomb(player) {
  const s = sneak.get(player.id);
  return !!s && s.down && !s.art && system.currentTick - s.since >= HOLD_BOMB && !inCinematic(player);
}

// Hold sneak while transformed: the orb forms and grows for 1.25 s (three stages), then fires.
const BOMB_CHARGE = 25;
const BOMB = { normal: { cost: 60, cd: 280, dmg: 40, radius: 7 }, mastered: { cost: 30, cd: 160, dmg: 60, radius: 9 } };
const BOMB_STAGES = [[0, "aegis:bomb_grow_1", 0.55], [10, "aegis:bomb_grow_2", 1.0], [20, "aegis:bomb_grow_3", 1.6]];
function updateBombCharge(player, b) {
  let ch = bombCharge.get(player.id);
  if (!holdingForBomb(player)) {
    if (ch) api.removeFx(ch.orb);
    bombCharge.delete(player.id);
    return;
  }
  if (ch?.done) return;
  const mastered = isBijuuMastered(player);
  const stats = mastered ? BOMB.mastered : BOMB.normal;
  const front = () => api.add(player.getHeadLocation(), api.add(api.scale(player.getViewDirection(), 2.6), { x: 0, y: 0.7, z: 0 }));
  if (!ch) {
    const left = api.cooldownLeft(player, "bijuudama");
    if (left > 0 || api.getChakra(player) < stats.cost) {
      player.onScreenDisplay.setActionBar(left > 0 ? `§7Tailed Beast Bomb ready in §f${(left / 20).toFixed(1)}s` : `§cNot enough chakra for a Tailed Beast Bomb (${stats.cost})`);
      bombCharge.set(player.id, { done: true });
      return;
    }
    ch = { ticks: 0, scale: 0.55, orb: api.spawnFx(player.dimension, "aegis:jutsu_orb", "aegis:bomb_grow_1", front()) };
    api.follow(ch.orb, () => (api.isValid(player) && bombCharge.get(player.id)?.orb === ch.orb ? api.sub(front(), { x: 0, y: 0.25 * ch.scale, z: 0 }) : undefined), BOMB_CHARGE + 20);
    api.anim(player, "animation.aegis.rasengan_hold");
    api.sound(player.dimension, "mob.warden.sonic_charge", player.location, 1, 0.9);
    bombCharge.set(player.id, ch);
  }
  ch.ticks += 5;
  const stage = BOMB_STAGES.find(([t]) => t > 0 && t === ch.ticks); // the orb grows
  if (stage) {
    try {
      ch.orb?.triggerEvent(stage[1]);
    } catch {
      /* ignore */
    }
    ch.scale = stage[2];
    api.sound(player.dimension, "aegis.charge", player.location, 0.8, 0.8 + stage[2] * 0.3);
  }
  api.particle(player.dimension, "aegis:bijuudama_charge", front());
  if (ch.ticks % 10 === 0) aura(player, mastered ? [1, 0.8, 0.25] : b.color, true);
  player.onScreenDisplay.setActionBar(`§5Charging Tailed Beast Bomb ${"§d■".repeat(ch.ticks / 5)}${"§8■".repeat(Math.max(0, (BOMB_CHARGE - ch.ticks) / 5))}`);
  if (ch.ticks < BOMB_CHARGE) return;

  ch.done = true;
  api.removeFx(ch.orb);
  api.setChakra(player, api.getChakra(player) - stats.cost);
  api.startCooldown(player, "bijuudama", stats.cd);
  api.anim(player, "animation.aegis.both_palms");
  const big = mastered ? 2.1 : 1.6;
  // fly from the orb toward whatever the crosshair is on (the orb hangs above the eyes)
  const start = front();
  let aim = api.add(player.getHeadLocation(), api.scale(player.getViewDirection(), 30));
  try {
    const hit = player.getEntitiesFromViewDirection({ maxDistance: 40 }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
    if (hit) aim = api.add(hit.location, { x: 0, y: 1, z: 0 });
    else {
      const blk = player.getBlockFromViewDirection({ maxDistance: 40 });
      if (blk) aim = api.add(blk.block.location, { x: 0.5, y: 0.5, z: 0.5 });
    }
  } catch {
    /* keep the straight line */
  }
  api.launchProjectile(player, start, api.sub(aim, start), {
    speed: 1.5, maxAge: 50, damage: stats.dmg, radius: stats.radius, knock: 3, fire: 0,
    orbEvent: mastered ? "aegis:as_bijuudama_big" : "aegis:bomb_grow_3", orbOffset: 0.25 * big,
    trail: "aegis:beast_aura", burst: "aegis:beast_burst", color: b.color, hitRadius: 1.4 + big * 0.5, sound: "random.explode",
    power: mastered ? 3.6 : 3,
  });
  api.sound(player.dimension, "mob.warden.sonic_boom", player.location, 1.5, 0.9);
  player.onScreenDisplay.setActionBar("§5Tailed Beast Bomb!");
}

// Every 5 ticks: wearing your own cloak = Tailed Beast Mode.
function updateCloak(player) {
  const worn = chestItem(player)?.typeId;
  const id = sealedBeastId(player);
  if (!isCloakItem(worn)) {
    if (cloakActive.has(player.id)) {
      endTransformation(player);
      player.onScreenDisplay.setActionBar("§7You return to normal.");
    }
    return;
  }
  if (!id || (worn !== cloakItemOf(id, false) && worn !== cloakItemOf(id, true))) {
    unequipCloak(player);
    player.onScreenDisplay.setActionBar("§cThis chakra rejects you — it isn't your Tailed Beast.");
    return;
  }
  const mastered = isBijuuMastered(player);
  if (worn !== cloakItemOf(id, mastered)) {
    swapCloak(player, id, cloakItemOf(id, mastered)); // mastered since (or mastery reset): the other form
    return;
  }
  const b = BEASTS[id];
  if (!cloakActive.has(player.id)) {
    if (system.currentTick - (joinedAt.get(player.id) ?? -1e9) < 40) return; // let the join reset run first
    if (api.getChakra(player) < 20) {
      unequipCloak(player);
      player.onScreenDisplay.setActionBar("§cNot enough chakra to transform!");
      return;
    }
    startTransformation(player, b);
  }
  let drain = mastered ? 0 : 2; // per second — a mastered beast lends its chakra freely
  try {
    if (!mastered && player.getDynamicProperty("aegis:clan") === "uzumaki") drain = 1; // Uzumaki chakra
  } catch {
    /* ignore */
  }
  if (inCinematic(player)) drain = 0; // not while the shroud is still forming
  const c = api.getChakra(player) - drain * 0.25;
  api.setChakra(player, c);
  if (c <= 0) {
    endTransformation(player);
    unequipCloak(player);
    player.onScreenDisplay.setActionBar("§7Out of chakra — the transformation fades.");
    return;
  }
  // short effects, refreshed while transformed so they end on their own (hearts and night vision: clans.js)
  eff(player, "strength", 30, mastered ? 3 : 2, false);
  eff(player, "speed", 30, mastered ? 2 : 1, false);
  eff(player, "resistance", 30, mastered ? 2 : 1, false);
  eff(player, "jump_boost", 30, mastered ? 2 : 1, false);
  eff(player, "regeneration", 30, mastered ? 1 : 0, false);
  if (mastered) eff(player, "fire_resistance", 30, 0, false);
  for (const [effect, amp] of CLOAK_PERKS[id] ?? []) eff(player, effect, 30, amp, false);
  api.particle(player.dimension, "aegis:beast_aura", player.location, b.color);
  if (system.currentTick % 10 < 5) api.particle(player.dimension, "aegis:jin_bubble", player.location, mastered ? [1, 0.85, 0.3] : b.color);
  if (mastered) api.particle(player.dimension, "aegis:beast_aura", player.location, [1, 0.85, 0.3]);
  if (system.currentTick % 10 < 5) aura(player, mastered ? [1, 0.8, 0.25] : b.color);
  updateBombCharge(player, b);
}

export function handleBijuuItemUse(player, itemStack) {
  if (itemStack.typeId === SCROLL_ITEM) {
    useSummonScroll(player);
    return true;
  }
  return false; // cloaks are worn (chest slot), not used
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function initBijuu(helpers) {
  api = helpers;
  initJinchuriki(helpers);

  // Boss AI every 10 ticks
  system.runInterval(() => {
    const now = system.currentTick;
    for (const name of DIMENSIONS) {
      let bosses = [];
      try {
        bosses = world.getDimension(name).getEntities({ families: ["tailed_beast"] });
      } catch {
        continue;
      }
      for (const boss of bosses) {
        if (beastIdOf(boss)) {
          try {
            updateBoss(boss, now);
          } catch {
            /* ignore one bad tick */
          }
        }
      }
    }
  }, 10);

  system.runInterval(tickTrials, 20);

  // A Jinchūriki who dies 3 times loses their Tailed Beast: it breaks free where they fell.
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== "minecraft:player") return;
    const player = deadEntity;
    const id = sealedBeastId(player);
    if (!id || trials.has(player.id)) return;
    const b = BEASTS[id];
    const deaths = Number(player.getDynamicProperty(DEATHS_PROP) ?? 0) + 1;
    if (deaths < MAX_DEATHS) {
      player.setDynamicProperty(DEATHS_PROP, deaths);
      player.sendMessage(`§cThe seal holding ${fullName(b)}§c weakens… §7(${deaths}/${MAX_DEATHS} deaths — at ${MAX_DEATHS} it breaks free)`);
      return;
    }
    const dim = player.dimension;
    const at = { ...player.location };
    release(player);
    player.setDynamicProperty(DEATHS_PROP, 0);
    player.sendMessage(`§4The seal broke! ${fullName(b)}§4 has escaped — your Jinchūriki powers are gone.`);
    world.sendMessage(`§c${fullName(b)}§c broke free from ${player.name}'s seal!`);
    system.runTimeout(() => {
      try {
        const boss = dim.spawnEntity(`aegis:${id}`, at);
        roar(boss, b);
        beastAwakenFx(boss, b.color);
      } catch {
        /* unloaded — the beast is simply gone */
      }
    }, 20);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId === "minecraft:player" && trials.has(deadEntity.id)) endTrial(deadEntity.id, "§cYou fell. The seal closes again…");
  });

  // Tailed Beast Mode upkeep every 5 ticks
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      try {
        updateCloak(player);
      } catch {
        /* ignore */
      }
    }
  }, 5);
  // Every tick: the transformation starts the moment the cloak goes on (in step with the cloak's form animation),
  // and the sneak taps / holds of transformed players are read.
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      try {
        if (cloakActive.has(player.id)) {
          const b = BEASTS[sealedBeastId(player)];
          if (b) updateSneak(player, b);
        } else if (isCloakItem(chestItem(player)?.typeId) && sealedBeastId(player)) {
          updateCloak(player);
        }
      } catch {
        /* ignore */
      }
    }
  }, 1);

  // Killing blow seals the beast.
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    const id = beastIdOf(deadEntity);
    if (!id) return;
    bossState.delete(deadEntity.id);
    for (const [pid, tr] of trials) {
      if (tr.entityId !== deadEntity.id) continue;
      trials.delete(pid);
      const owner = world.getAllPlayers().find((p) => p.id === pid);
      if (owner) masterBeast(owner);
      return;
    }
    const b = BEASTS[id];
    try {
      api.particle(deadEntity.dimension, "aegis:beast_burst", api.add(deadEntity.location, { x: 0, y: 2, z: 0 }), b.color);
      api.sound(deadEntity.dimension, "mob.enderdragon.death", deadEntity.location, 1, 1.2);
    } catch {
      /* ignore */
    }
    let killer = damageSource?.damagingEntity;
    if (killer?.typeId === "aegis:chakra_clone") {
      try {
        killer = world.getEntity(killer.getDynamicProperty("aegis:owner"));
      } catch {
        killer = undefined;
      }
    }
    if (unsealable(deadEntity)) {
      if (killer?.typeId === "minecraft:player") killer.sendMessage(`§7${fullName(b)}§7's chakra scatters — this beast can't be sealed.`);
      return;
    }
    if (killer?.typeId === "minecraft:player") {
      if (!sealInto(killer, id)) world.sendMessage(`§7${fullName(b)}§7 was defeated, but its chakra returns to ${holderOf(id)?.name ?? "its Jinchūriki"}.`);
    } else world.sendMessage(`§7${fullName(b)}§7 was defeated, but no one sealed it.`);
  });

  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    const mine = sealedBeastId(player);
    if (mine && !holderOf(mine)) setHolder(mine, player);
    joinedAt.set(player.id, system.currentTick);
    if (initialSpawn) {
      endTransformation(player); // back on the server: wearing the cloak transforms again, with its cinematic
      jinCleanup(player);
    }
  });

  world.afterEvents.playerSpawn.subscribe(({ player }) => {
    // swap the old single cloak item for the beast-specific wearable one
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (inv) for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === OLD_CLOAK_ITEM) inv.setItem(i, undefined);
    giveCloak(player);
  });

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:bijuu" || sourceEntity?.typeId !== "minecraft:player") return;
    const player = sourceEntity;
    const [cmd, arg] = message.trim().toLowerCase().split(/\s+/);
    if (cmd === "summon" && BEASTS[arg]) summonBeast(player, arg);
    else if (cmd === "summon") summonBeast(player, rollBeastId());
    else if (cmd === "seal" && BEASTS[arg]) sealInto(player, arg);
    else if (cmd === "master") {
      if (sealedBeastId(player)) masterBeast(player);
      else player.sendMessage("§7Seal a beast first.");
    }
    else if (cmd === "release") {
      release(player);
      player.sendMessage("§7Your Tailed Beast has been released.");
    } else if (cmd === "holders") {
      const lines = Object.entries(BEASTS).map(([bid, b]) => `${fullName(b)}§7: ${holderOf(bid)?.name ? `§f${holderOf(bid).name}` : "§8free"}`);
      player.sendMessage(`§6Jinchūriki\n${lines.join("\n")}`);
    } else if (cmd === "free" && BEASTS[arg]) {
      // admin: free a beast whose Jinchūriki left the server for good
      setHolder(arg, null);
      player.sendMessage(`§7${fullName(BEASTS[arg])}§7 has no Jinchūriki now.`);
    } else if (cmd === "info") {
      const b = BEASTS[sealedBeastId(player)];
      player.sendMessage(b ? `§7Sealed within you: ${fullName(b)}${isBijuuMastered(player) ? " §6(mastered)" : ""} §7— seal: ${MAX_DEATHS - Number(player.getDynamicProperty(DEATHS_PROP) ?? 0)}/${MAX_DEATHS} lives left` : "§7No Tailed Beast is sealed within you.");
    } else {
      player.sendMessage(`§7Usage: /scriptevent aegis:bijuu <summon [beast] | seal <beast> | master | release | info | holders | free <beast>>\n§7Beasts: ${Object.keys(BEASTS).join(", ")}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Uzumaki Sealing Jutsu (Four Symbols Seal) — seal a weakened beast alive
// ---------------------------------------------------------------------------
const SEAL_COST = 150;
const SEAL_TICKS = 60;
const beingSealed = new Set(); // beast entity ids
const GOLD = [1, 0.85, 0.3];

const isUzumaki = (p) => {
  try {
    return p.getDynamicProperty("aegis:clan") === "uzumaki";
  } catch {
    return false;
  }
};

function beastInSight(player) {
  try {
    const hit = player.getEntitiesFromViewDirection({ maxDistance: 32 }).map((h) => h.entity).find((e) => beastIdOf(e));
    if (hit) return hit;
  } catch {
    /* ignore */
  }
  return player.dimension.getEntities({ location: player.location, maxDistance: 16, families: ["tailed_beast"] }).find((e) => beastIdOf(e));
}

// Entry point (Uzumaki: sneak + use the Sealing Chains).
export async function uzumakiSealMenu(player) {
  if (!isUzumaki(player)) return player.sendMessage("§cOnly the Uzumaki know this sealing jutsu.");
  const beast = beastInSight(player);
  if (!beast) return openSealMenu(player);

  const chakraStat = getStat(player, "chakra");
  const vitStat = getStat(player, "vitality");
  if (chakraStat < 100 || vitStat < 100) {
    return player.sendMessage(`§cThe Four Symbols Seal needs §f100 Chakra§c and §f100 Vitality§c stats §7(you: ${chakraStat} / ${vitStat})`);
  }
  if (beingSealed.has(beast.id)) return;
  if (unsealable(beast)) return player.sendMessage("§cThis beast's chakra is unstable — it can't be sealed.");
  const taken = holderOf(beastIdOf(beast));
  if (taken) return player.sendMessage(`§c${fullName(BEASTS[beastIdOf(beast)])}§c already has a Jinchūriki: §f${taken.name}§c.`);
  let hp = 1;
  try {
    const h = beast.getComponent("minecraft:health");
    hp = h.currentValue / h.effectiveMax;
  } catch {
    /* ignore */
  }
  const b = BEASTS[beastIdOf(beast)];
  if (hp > 0.5) return player.sendMessage(`§c${b.name} is too strong to seal — weaken it below half health first §7(${Math.round(hp * 100)}%)`);
  const left = api.cooldownLeft(player, "uzumaki_seal");
  if (left > 0) return player.sendMessage(`§7The sealing jutsu is ready in ${(left / 20).toFixed(0)}s.`);
  if (api.getChakra(player) < SEAL_COST) return player.sendMessage(`§cNot enough chakra (${SEAL_COST} needed).`);

  const others = player.dimension.getPlayers({ location: player.location, maxDistance: 16 }).filter((p) => p.id !== player.id);
  const form = new ActionFormData()
    .title("§6Four Symbols Seal")
    .body(`§7Seal ${fullName(b)}§7 alive. Who becomes its Jinchūriki?\n§8(Replaces any beast they already carry.)`)
    .button("§6Seal it into myself");
  for (const o of others) form.button(`§eSeal it into ${o.name}`);
  const r = await form.show(player);
  if (r.canceled || r.selection === undefined) return;
  const target = r.selection === 0 ? player : others[r.selection - 1];
  if (!target || !api.isValid(beast)) return;
  sealRitual(player, beast, target);
}

function sealRitual(sealer, beast, target) {
  const id = beastIdOf(beast);
  const b = BEASTS[id];
  const dim = beast.dimension;
  beingSealed.add(beast.id);
  api.setChakra(sealer, api.getChakra(sealer) - SEAL_COST);
  api.startCooldown(sealer, "uzumaki_seal", 1200);
  api.anim(sealer, "animation.aegis.hand_signs");
  showTitle(sealer, "§6Four Symbols Seal", { subtitle: `§7Binding ${b.name}…`, fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 10 });
  api.sound(dim, "random.anvil_land", beast.location, 1, 0.6);
  sfx(dim, "aegis.seal", beast.location, 2, 0.9);

  const fail = (why) => {
    beingSealed.delete(beast.id);
    if (api.isValid(sealer)) sealer.sendMessage(`§cThe seal broke: ${why}`);
  };
  for (let t = 0; t <= SEAL_TICKS; t += 5) {
    system.runTimeout(() => {
      if (!beingSealed.has(beast.id)) return;
      if (!api.isValid(beast)) return fail("the beast is gone.");
      if (!api.isValid(sealer) || !api.isValid(target)) return fail("the sealer or vessel left.");
      const d = api.sub(beast.location, sealer.location);
      if (d.x * d.x + d.y * d.y + d.z * d.z > 40 * 40) return fail("you moved too far away.");
      // golden chains from the sealer and the vessel into the beast
      const mid = api.add(beast.location, { x: 0, y: 2, z: 0 });
      for (const from of [sealer, target]) {
        const a = api.add(from.location, { x: 0, y: 1, z: 0 });
        const dd = api.sub(mid, a);
        for (let i = 0; i <= 12; i++) api.particle(dim, "aegis:slash", api.add(a, api.scale(dd, i / 12)), GOLD);
      }
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + t * 0.2;
        api.particle(dim, "aegis:slash", api.add(beast.location, { x: Math.cos(ang) * 3, y: 0.5 + (t / SEAL_TICKS) * 3, z: Math.sin(ang) * 3 }), GOLD);
      }
      try {
        beast.addEffect("slowness", 20, { amplifier: 255, showParticles: false });
        beast.addEffect("weakness", 20, { amplifier: 10, showParticles: false });
      } catch {
        /* ignore */
      }
      if (t < SEAL_TICKS) return;
      // sealed!
      beingSealed.delete(beast.id);
      bossState.delete(beast.id);
      let maxHp = 1000;
      try {
        maxHp = beast.getComponent("minecraft:health").effectiveMax;
      } catch {
        /* ignore */
      }
      api.particle(dim, "aegis:beast_burst", mid, b.color);
      api.particle(dim, "aegis:beast_burst", mid, GOLD);
      api.sound(dim, "mob.enderdragon.growl", mid, 2, 0.6);
      impactFx(dim, beast.location, GOLD, 3);
      if (heldByOther(id, target)) return fail(`${b.name} already has a Jinchūriki.`);
      beast.remove();
      api.particle(target.dimension, "aegis:beast_burst", api.add(target.location, { x: 0, y: 1, z: 0 }), GOLD);
      sealInto(target, id, sealer);
      gainXp(sealer, maxHp * 3);
    }, t);
  }
}

// ---------------------------------------------------------------------------
// Opening the seal: an Uzumaki Jinchūriki faces the dark half of their beast.
// Win and the beast is mastered (Tailed Beast Mode with no drain, regen, stronger buffs and bombs).
// ---------------------------------------------------------------------------
const trials = new Map(); // player id -> { entityId, deadline, dim }
const TRIAL_SECONDS = 240;

async function openSealMenu(player) {
  const id = sealedBeastId(player);
  if (!id) return player.sendMessage("§7No Tailed Beast in sight — and none sealed inside you.");
  if (isBijuuMastered(player)) return player.sendMessage(`§6You and ${BEASTS[id].name} already fight as one.`);
  if (trials.has(player.id)) return player.sendMessage("§cYou are already facing your beast!");
  const b = BEASTS[id];
  const r = await new MessageFormData()
    .title("§6Open the Seal")
    .body(`Open the seal and face the dark half of ${b.name}?\n\nDefeat it within ${TRIAL_SECONDS / 60} minutes to master ${b.name}:\n§7- Tailed Beast Mode costs no chakra and regen keeps working\n§7- Strength III, Resistance III, Regeneration\n§7- Tailed Beast Bomb: 40 chakra, 10s cooldown, bigger blast\n\n§cIf you fall, the seal closes again.`)
    .button1("§6Open the seal")
    .button2("Not yet")
    .show(player);
  if (r.selection !== 0) return;
  startTrial(player, id);
}

function startTrial(player, id) {
  const b = BEASTS[id];
  const dim = player.dimension;
  const d = player.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  const at = api.add(player.location, api.scale(h, 10));
  try {
    const e = dim.spawnEntity(`aegis:${id}`, at);
    e.nameTag = `§8Dark ${b.name}`;
    e.setDynamicProperty("aegis:trial_of", player.id);
    try {
      const hc = e.getComponent("minecraft:health");
      hc.setCurrentValue(Math.round(hc.effectiveMax * 0.6));
    } catch {
      /* ignore */
    }
    api.particle(dim, "aegis:beast_burst", api.add(at, { x: 0, y: 2, z: 0 }), [0.15, 0.05, 0.2]);
    trials.set(player.id, { entityId: e.id, deadline: system.currentTick + TRIAL_SECONDS * 20, dim: dim.id });
    showTitle(player, "§8The Seal Opens", { subtitle: `§7Defeat the dark half of ${b.name}!`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
    api.sound(dim, "mob.wither.spawn", player.location, 0.8, 0.6);
  } catch {
    player.sendMessage("§cThe seal wouldn't open here.");
  }
}

function endTrial(pid, message) {
  const tr = trials.get(pid);
  if (!tr) return;
  trials.delete(pid);
  try {
    world.getEntity(tr.entityId)?.remove();
  } catch {
    /* ignore */
  }
  const p = world.getAllPlayers().find((x) => x.id === pid);
  if (p) showTitle(p, "§cTrial failed", { subtitle: message, stayDuration: 50 });
}

function tickTrials() {
  for (const [pid, tr] of [...trials]) {
    const p = world.getAllPlayers().find((x) => x.id === pid);
    if (!p) {
      endTrial(pid, "");
      continue;
    }
    const left = Math.ceil((tr.deadline - system.currentTick) / 20);
    if (left <= 0) endTrial(pid, "§7Time ran out. The seal closes again…");
    else p.onScreenDisplay.setActionBar(`§8Inner trial §7— §f${left}s`);
  }
}

function masterBeast(player) {
  const id = sealedBeastId(player);
  if (!id) return;
  const b = BEASTS[id];
  player.setDynamicProperty(MASTERED_PROP, true);
  swapCloak(player, id, cloakItemOf(id, true)); // the cloak becomes Tailed Beast Chakra Mode
  transformCinematic(player, { color: [1, 0.8, 0.25], title: `§6${b.name} Mastered`, subtitle: "§7Your Tailed Beast now fights alongside you" });
  api.particle(player.dimension, "aegis:beast_burst", api.add(player.location, { x: 0, y: 1, z: 0 }), GOLD);
  api.particle(player.dimension, "aegis:beast_burst", api.add(player.location, { x: 0, y: 1, z: 0 }), b.color);
  api.sound(player.dimension, "ui.toast.challenge_complete", player.location, 1, 0.7);
  player.sendMessage(`§6You opened the seal and mastered ${fullName(b)}§6! §7Your cloak became §6Tailed Beast Chakra Mode§7: no chakra drain, stronger buffs, a cheaper and bigger Tailed Beast Bomb, and a faster Beast Art.`);
  world.sendMessage(`§e${player.name} has fully mastered ${fullName(b)}§e!`);
}
