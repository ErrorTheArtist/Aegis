// Tailed Beasts: nine boss mobs with special attacks, a summoning scroll, and the
// Jinchūriki system — land the killing blow and the beast is sealed inside you.
//
// Commands (cheats on):
//   /scriptevent aegis:bijuu summon kurama   — summon a beast in front of you
//   /scriptevent aegis:bijuu seal kurama     — become that beast's Jinchūriki directly
//   /scriptevent aegis:bijuu release         — release your sealed beast
//   /scriptevent aegis:bijuu info            — show your sealed beast

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";

const BIJUU_PROP = "aegis:bijuu";
const CLOAK_ITEM = "aegis:bijuu_cloak";
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

let api;
const bossState = new Map(); // entity id -> { next, enraged }
const cloakActive = new Set(); // player ids

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

export function bijuuChakraBonus(player) {
  const b = BEASTS[sealedBeastId(player)];
  return b ? 50 + b.tails * 10 : 0;
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
  const CHARGE = 40;
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
      speed: 1.1, maxAge: 60, damage: 12 + b.tails * 1.5, radius: 5.5, knock: 2.5, fire: 0,
      orbEvent: "aegis:as_bijuudama", trail: "aegis:beast_aura", burst: "aegis:beast_burst", color: b.color,
      hitRadius: 2, sound: "random.explode", ignoreFamily: "tailed_beast",
    });
    api.sound(dim, "mob.warden.sonic_boom", start, 2, 0.7);
  }, CHARGE);
}

function roar(boss, b) {
  roarAnim(boss);
  api.sound(boss.dimension, "mob.enderdragon.growl", boss.location, 3, 0.7);
  api.particle(boss.dimension, "aegis:beast_burst", api.add(boss.location, { x: 0, y: 2, z: 0 }), b.color);
  ring(boss.dimension, boss.location, 5, "aegis:beast_aura", b.color);
  blast(boss, boss.location, 7, 4, 2.2);
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
    blast(boss, spot, 3, 12, 0.5);
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
    api.hurt(e, 10, boss, "fire");
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
  blast(boss, boss.location, 12, 8, 2.0, (e) => eff(e, "slowness", 80, 2));
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
        blast(boss, spot, 2.5, 7, 0.5, (e) => {
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
        api.hurt(e, 14, boss);
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
      blast(boss, boss.location, 8, 3, 0, (e) => {
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
      api.hurt(p, 6, boss);
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
    api.hurt(e, 8, boss);
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
  blast(boss, boss.location, 15, 10, 3.5, (e) => {
    eff(e, "weakness", 160, 1);
    try {
      e.setOnFire(4, true);
    } catch {
      /* ignore */
    }
  });
}

// ---------------------------------------------------------------------------
// Boss brain
// ---------------------------------------------------------------------------
function updateBoss(boss, now) {
  const id = beastIdOf(boss);
  const b = BEASTS[id];
  let st = bossState.get(boss.id);
  if (!st) {
    st = { next: now + 60, enraged: false };
    bossState.set(boss.id, st);
  }
  // Chakra aura
  api.particle(boss.dimension, "aegis:beast_aura", boss.location, b.color);

  // Phase 2 at half health
  try {
    const h = boss.getComponent("minecraft:health");
    if (!st.enraged && h.currentValue <= h.effectiveMax * 0.5) {
      st.enraged = true;
      eff(boss, "strength", 999999, 1, false);
      eff(boss, "speed", 999999, 0, false);
      roar(boss, b);
      for (const p of playersNear(boss.dimension, boss.location, 48)) {
        p.onScreenDisplay.setTitle(`${b.text}${b.name}`, { subtitle: "§cis enraged!", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
      }
    }
  } catch {
    /* ignore */
  }

  if (now < st.next) return;
  const target = nearestTarget(boss);
  if (!target) return;

  const roll = Math.random();
  if (roll < 0.35) tailedBeastBomb(boss, b, target);
  else if (roll < 0.85) b.element(boss, b, target);
  else roar(boss, b);

  const base = Math.max(90, 200 - b.tails * 10);
  st.next = now + Math.floor(base * (st.enraged ? 0.6 : 1) * (0.8 + Math.random() * 0.4));
}

// ---------------------------------------------------------------------------
// Summoning
// ---------------------------------------------------------------------------
function rollBeastId() {
  const entries = Object.entries(BEASTS).map(([id, b]) => [id, 10 - b.tails]);
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
    p.onScreenDisplay.setTitle("§4The seal weakens...", { subtitle: "§7a Tailed Beast stirs", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
  }
  system.runTimeout(() => {
    try {
      const boss = dim.spawnEntity(`aegis:${id}`, spot);
      roar(boss, b);
      api.particle(dim, "aegis:beast_burst", api.add(spot, { x: 0, y: 2, z: 0 }), b.color);
    } catch {
      /* ignore */
    }
    world.sendMessage(`§c${fullName(b)}§c has been released!`);
    try {
      for (const p of dim.getPlayers({ location: spot, maxDistance: 64 })) {
        p.onScreenDisplay.setTitle(`${b.text}${b.name}`, { subtitle: `§7${b.title}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
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
  api.anim(player, "animation.aegis.hand_signs");
  summonBeast(player, rollBeastId());
}

// ---------------------------------------------------------------------------
// Jinchūriki
// ---------------------------------------------------------------------------
function hasItem(player, typeId) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return true;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === typeId) return true;
  return false;
}

function giveCloak(player) {
  if (!sealedBeastId(player) || hasItem(player, CLOAK_ITEM)) return;
  try {
    const stack = new ItemStack(CLOAK_ITEM, 1);
    stack.lockMode = ItemLockMode.inventory;
    stack.keepOnDeath = true;
    player.getComponent("minecraft:inventory").container.addItem(stack);
  } catch {
    /* inventory full — retried on next spawn */
  }
}

function removeCloak(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === CLOAK_ITEM) inv.setItem(i, undefined);
}

function sealInto(player, id) {
  const b = BEASTS[id];
  cloakActive.delete(player.id);
  removeCloak(player);
  player.setDynamicProperty(BIJUU_PROP, id);
  giveCloak(player);
  player.onScreenDisplay.setTitle("§6Jinchūriki", { subtitle: `§7${b.text}${b.name}§7 is sealed within you`, fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 20 });
  api.sound(player.dimension, "ui.toast.challenge_complete", player.location, 1, 0.8);
  api.particle(player.dimension, "aegis:beast_burst", api.add(player.location, { x: 0, y: 1, z: 0 }), b.color);
  player.sendMessage(
    `§6You are now the Jinchūriki of ${fullName(b)}§6!\n§7+${bijuuChakraBonus(player)} max chakra, faster regen.\n§7Use the §fTailed Beast Cloak§7 to enter cloak mode (Strength, Speed, Resistance). Sneak + use while cloaked for a §5Tailed Beast Bomb§7.`
  );
  world.sendMessage(`§e${player.name} sealed ${fullName(b)}§e and became its Jinchūriki!`);
}

function release(player) {
  cloakActive.delete(player.id);
  removeCloak(player);
  player.setDynamicProperty(BIJUU_PROP, undefined);
}

function toggleCloak(player) {
  const b = BEASTS[sealedBeastId(player)];
  if (cloakActive.has(player.id)) {
    cloakActive.delete(player.id);
    player.onScreenDisplay.setActionBar("§7Cloak released.");
    return;
  }
  if (api.getChakra(player) < 20) {
    player.onScreenDisplay.setActionBar("§cNot enough chakra!");
    return;
  }
  cloakActive.add(player.id);
  api.particle(player.dimension, "aegis:beast_burst", api.add(player.location, { x: 0, y: 1, z: 0 }), b.color);
  api.sound(player.dimension, "mob.enderdragon.growl", player.location, 0.6, 1.4);
  player.onScreenDisplay.setActionBar(`${b.text}${b.name}'s Chakra Cloak!`);
}

function playerBeastBomb(player) {
  const b = BEASTS[sealedBeastId(player)];
  if (!cloakActive.has(player.id)) {
    player.onScreenDisplay.setActionBar("§7Enter cloak mode first.");
    return;
  }
  const left = api.cooldownLeft(player, "bijuudama");
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7Tailed Beast Bomb ready in §f${(left / 20).toFixed(1)}s`);
    return;
  }
  if (api.getChakra(player) < 80) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(api.getChakra(player))}/80)`);
    return;
  }
  api.setChakra(player, api.getChakra(player) - 80);
  api.startCooldown(player, "bijuudama", 600);
  const dim = player.dimension;
  const CHARGE = 24;
  api.anim(player, "animation.aegis.rasengan_hold");
  const front = () => api.add(player.getHeadLocation(), api.add(api.scale(player.getViewDirection(), 2.5), { x: 0, y: 0.6, z: 0 }));
  const orb = api.spawnFx(dim, "aegis:jutsu_orb", "aegis:as_bijuudama", front());
  api.follow(orb, () => (api.isValid(player) ? api.sub(front(), { x: 0, y: 0.25, z: 0 }) : undefined), CHARGE);
  api.sound(dim, "mob.warden.sonic_charge", player.location, 1, 0.9);
  for (let i = 0; i < CHARGE; i += 4) system.runTimeout(() => api.isValid(player) && api.particle(dim, "aegis:bijuudama_charge", front()), i);
  system.runTimeout(() => {
    if (!api.isValid(player)) return;
    api.anim(player, "animation.aegis.both_palms");
    api.launchProjectile(player, front(), player.getViewDirection(), {
      speed: 1.4, maxAge: 50, damage: 30, radius: 5.5, knock: 2.5, fire: 0,
      orbEvent: "aegis:as_bijuudama", trail: "aegis:beast_aura", burst: "aegis:beast_burst", color: b.color,
      hitRadius: 2, sound: "random.explode",
    });
    api.sound(dim, "mob.warden.sonic_boom", player.location, 1.5, 0.9);
  }, CHARGE);
  player.onScreenDisplay.setActionBar("§5Tailed Beast Bomb!");
}

export function handleBijuuItemUse(player, itemStack) {
  if (itemStack.typeId === SCROLL_ITEM) {
    useSummonScroll(player);
    return true;
  }
  if (itemStack.typeId === CLOAK_ITEM) {
    if (!sealedBeastId(player)) {
      player.onScreenDisplay.setActionBar("§7No Tailed Beast is sealed within you.");
      return true;
    }
    if (player.isSneaking) playerBeastBomb(player);
    else toggleCloak(player);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function initBijuu(helpers) {
  api = helpers;

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

  // Cloak upkeep every 5 ticks
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      if (!cloakActive.has(player.id)) continue;
      const b = BEASTS[sealedBeastId(player)];
      if (!b) {
        cloakActive.delete(player.id);
        continue;
      }
      let drain = 3; // per second
      try {
        if (player.getDynamicProperty("aegis:clan") === "uzumaki") drain = 1.5; // Uzumaki chakra
      } catch {
        /* ignore */
      }
      const c = api.getChakra(player) - drain * 0.25;
      api.setChakra(player, c);
      if (c <= 0) {
        cloakActive.delete(player.id);
        player.onScreenDisplay.setActionBar("§7Out of chakra — the cloak fades.");
        continue;
      }
      // short effects, refreshed while the cloak is up so they end on their own
      eff(player, "strength", 30, 1, false);
      eff(player, "speed", 30, 1, false);
      eff(player, "resistance", 30, 0, false);
      eff(player, "jump_boost", 30, 1, false);
      api.particle(player.dimension, "aegis:beast_aura", player.location, b.color);
    }
  }, 5);

  // Killing blow seals the beast.
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    const id = beastIdOf(deadEntity);
    if (!id) return;
    bossState.delete(deadEntity.id);
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
    if (killer?.typeId === "minecraft:player") sealInto(killer, id);
    else world.sendMessage(`§7${fullName(b)}§7 was defeated, but no one sealed it.`);
  });

  world.afterEvents.playerSpawn.subscribe(({ player }) => giveCloak(player));

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "aegis:bijuu" || sourceEntity?.typeId !== "minecraft:player") return;
    const player = sourceEntity;
    const [cmd, arg] = message.trim().toLowerCase().split(/\s+/);
    if (cmd === "summon" && BEASTS[arg]) summonBeast(player, arg);
    else if (cmd === "summon") summonBeast(player, rollBeastId());
    else if (cmd === "seal" && BEASTS[arg]) sealInto(player, arg);
    else if (cmd === "release") {
      release(player);
      player.sendMessage("§7Your Tailed Beast has been released.");
    } else if (cmd === "info") {
      const b = BEASTS[sealedBeastId(player)];
      player.sendMessage(b ? `§7Sealed within you: ${fullName(b)}` : "§7No Tailed Beast is sealed within you.");
    } else {
      player.sendMessage(`§7Usage: /scriptevent aegis:bijuu <summon [beast] | seal <beast> | release | info>\n§7Beasts: ${Object.keys(BEASTS).join(", ")}`);
    }
  });
}
