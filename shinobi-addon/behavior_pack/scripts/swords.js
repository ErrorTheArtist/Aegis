// Legendary swords: 3D held models (resource pack attachables), a passive on every hit,
// and a right-click special with its own attack animation, slash arcs and particles.

import { world, system } from "@minecraft/server";
import { sameVillage } from "./villages.js";
import { impactFx, sfx } from "./cinematic.js";
import { RECORD_SLOT } from "./levels.js";

let api;

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------
function basis(player) {
  const d = player.getViewDirection();
  const f = api.norm({ x: d.x, y: 0, z: d.z });
  return { f, r: { x: -f.z, y: 0, z: f.x } };
}

// Horizontal sweeping arc in front of the player, drawn over a few ticks (right → left).
function arcSweep(player, color, { radius = 2.6, from = 80, to = -80, height = 1.2, ticks = 3, points = 18 } = {}) {
  const { f, r } = basis(player);
  const base = api.add(player.location, { x: 0, y: height, z: 0 });
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const a = ((from + (to - from) * t) * Math.PI) / 180;
    const p = api.add(base, api.add(api.scale(f, Math.cos(a) * radius), api.scale(r, Math.sin(a) * radius)));
    system.runTimeout(() => api.particle(player.dimension, "aegis:slash", p, color), Math.floor(t * ticks));
  }
}

// Vertical arc from above the head crashing down in front.
function arcOverhead(player, color, { radius = 2.8, ticks = 3, points = 18 } = {}) {
  const { f } = basis(player);
  const base = api.add(player.location, { x: 0, y: 1.4, z: 0 });
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const a = ((-10 + 130 * t) * Math.PI) / 180; // 0 = straight up, 90 = straight ahead
    const p = api.add(base, api.add(api.scale(f, Math.sin(a) * radius), { x: 0, y: Math.cos(a) * radius, z: 0 }));
    system.runTimeout(() => api.particle(player.dimension, "aegis:slash", p, color), Math.floor(t * ticks));
  }
}

// Full circle around the player.
function arcSpin(player, color, radius = 3.2, ticks = 8) {
  const base = api.add(player.location, { x: 0, y: 1.1, z: 0 });
  const points = 32;
  const { f, r } = basis(player);
  for (let i = 0; i < points; i++) {
    const t = i / points;
    const a = -t * Math.PI * 2;
    const p = api.add(base, api.add(api.scale(f, Math.cos(a) * radius), api.scale(r, Math.sin(a) * radius)));
    system.runTimeout(() => api.particle(player.dimension, "aegis:slash", p, color), Math.floor(t * ticks));
  }
}

// Small slash mark across a target hit in melee.
function hitMark(player, target, color) {
  const { r } = basis(player);
  const c = api.add(target.location, { x: 0, y: 1.1, z: 0 });
  for (let i = -3; i <= 3; i++) {
    api.particle(player.dimension, "aegis:slash", api.add(c, api.add(api.scale(r, i * 0.22), { x: 0, y: -i * 0.18, z: 0 })), color);
  }
}

function line(dim, from, to, id, color, step = 0.4) {
  const d = api.sub(to, from);
  const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) api.particle(dim, id, api.add(from, api.scale(d, i / n)), color);
}

function eff(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: true });
  } catch {
    /* ignore */
  }
}

function heal(player, amount) {
  try {
    const h = player.getComponent("minecraft:health");
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
  } catch {
    /* ignore */
  }
}

function targetsAround(player, center, radius) {
  return player.dimension.getEntities({ location: center, maxDistance: radius }).filter((e) => api.canBeHit(e, player));
}

function inFront(player, radius, minDot = 0.2) {
  const d = player.getViewDirection();
  return targetsAround(player, player.location, radius).filter(
    (e) => api.dot(api.norm(api.sub(e.location, player.location)), d) > minDot
  );
}

function viewTargets(player, range) {
  try {
    return player
      .getEntitiesFromViewDirection({ maxDistance: range })
      .map((h) => h.entity)
      .filter((e) => api.canBeHit(e, player));
  } catch {
    return [];
  }
}

// Dash forward and cut everything you pass through (each target once).
function dashThrough(player, { power = 3.5, ticks = 12, radius = 2.2, onHit, trail }) {
  const d = player.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  api.knockback(player, h.x, h.z, power, 0.15);
  const hit = new Set();
  for (let t = 1; t <= ticks; t++) {
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      trail?.();
      for (const e of targetsAround(player, player.location, radius)) {
        if (hit.has(e.id)) continue;
        hit.add(e.id);
        onHit(e);
      }
    }, t);
  }
}

// ---------------------------------------------------------------------------
// Swords
// ---------------------------------------------------------------------------
const C = {
  kusanagi: [0.6, 0.85, 1.0],
  samehada: [0.3, 0.5, 1.0],
  kubikiribocho: [1.0, 0.2, 0.2],
  hiramekarei: [0.3, 0.85, 1.0],
  kiba: [1.0, 0.95, 0.5],
  nuibari: [0.95, 0.95, 1.0],
  shibuki: [1.0, 0.55, 0.15],
  chakra_blades: [0.55, 1.0, 0.7],
};

const SWORDS = {
  // Sasuke's blade: a lightning-charged dash that cuts through everything in the way.
  "aegis:kusanagi": {
    id: "kusanagi", special: "Chidori Nagashi: Lightning Blade Dash", cost: 25, cd: 60,
    cast(p) {
      api.anim(p, "animation.aegis.sword_thrust");
      api.sound(p.dimension, "mob.bee.loop", p.location, 1, 2);
      api.sound(p.dimension, "ambient.weather.thunder", p.location, 0.4, 2);
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        dashThrough(p, {
          power: 3.8, ticks: 12,
          trail: () => {
            api.particle(p.dimension, "aegis:chidori", api.add(p.location, { x: 0, y: 1, z: 0 }));
            api.particle(p.dimension, "aegis:slash", api.add(p.location, { x: 0, y: 1.1, z: 0 }), C.kusanagi);
          },
          onHit: (e) => {
            api.hurt(e, 11, p);
            eff(e, "slowness", 60, 4); // paralysed by the current
            api.particle(p.dimension, "aegis:lightning_burst", api.add(e.location, { x: 0, y: 1, z: 0 }));
            api.sound(p.dimension, "ambient.weather.lightning.impact", e.location, 0.5, 1.6);
          },
        });
      }, 3);
    },
    onHit(p, t) {
      if (Math.random() < 0.3) {
        api.hurt(t, 3, p, "magic");
        api.particle(p.dimension, "aegis:chidori", api.add(t.location, { x: 0, y: 1, z: 0 }));
      }
    },
  },

  // Kisame's living sword: devours chakra.
  "aegis:samehada": {
    id: "samehada", text: "§9", special: "Chakra Feast", cost: 0, cd: 120,
    cast(p) {
      api.anim(p, "animation.aegis.sword_overhead");
      arcOverhead(p, C.samehada);
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        const targets = targetsAround(p, p.location, 5.5);
        api.particle(p.dimension, "aegis:beast_mist", p.location, C.samehada);
        api.sound(p.dimension, "mob.guardian.attack", p.location, 1, 0.6);
        let gained = 0;
        for (const e of targets) {
          api.hurt(e, 8, p);
          line(p.dimension, api.add(e.location, { x: 0, y: 1, z: 0 }), api.add(p.location, { x: 0, y: 1, z: 0 }), "aegis:slash", C.samehada, 0.6);
          if (e.typeId === "minecraft:player") api.setChakra(e, api.getChakra(e) - 20);
          gained += 12;
        }
        api.setChakra(p, api.getChakra(p) + gained);
        heal(p, targets.length * 2);
        if (targets.length) p.onScreenDisplay.setActionBar(`§9Samehada feasts! §7+${gained} chakra`);
      }, 7);
    },
    onHit(p, t) {
      if (t.typeId === "minecraft:player") api.setChakra(t, api.getChakra(t) - 6);
      api.setChakra(p, api.getChakra(p) + 4);
      api.particle(p.dimension, "aegis:chakra_aura", t.location);
    },
  },

  // Zabuza's cleaver: Silent Killing — a spinning cut, then vanish into the mist.
  "aegis:kubikiribocho": {
    id: "kubikiribocho", text: "§c", special: "Silent Killing", cost: 20, cd: 100,
    cast(p) {
      api.anim(p, "animation.aegis.sword_spin");
      arcSpin(p, C.kubikiribocho, 3.4, 9);
      api.sound(p.dimension, "item.trident.riptide_2", p.location, 1, 0.7);
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        for (const e of targetsAround(p, p.location, 4.8)) {
          api.hurt(e, 15, p);
          heal(p, 2);
          const away = api.norm({ x: e.location.x - p.location.x, y: 0, z: e.location.z - p.location.z });
          api.knockback(e, away.x, away.z, 1.4, 0.3);
          hitMark(p, e, C.kubikiribocho);
        }
        for (let i = 0; i < 4; i++) {
          api.particle(p.dimension, "aegis:smoke_puff", api.add(p.location, { x: (Math.random() - 0.5) * 6, y: 0, z: (Math.random() - 0.5) * 6 }));
        }
        eff(p, "invisibility", 70, 0); // Hidden Mist
        eff(p, "speed", 70, 1);
      }, 5);
    },
    onHit(p) {
      heal(p, 1); // drinks blood...
      repairHeld(p, 6); // ...and the iron in it mends the blade
    },
  },

  // Twin-handled blade that stores chakra and releases it as a giant hammer.
  "aegis:hiramekarei": {
    id: "hiramekarei", special: "Chakra Hammer", cost: 30, cd: 100,
    cast(p) {
      api.anim(p, "animation.aegis.sword_overhead");
      arcOverhead(p, C.hiramekarei, { radius: 4 });
      api.sound(p.dimension, "beacon.power", p.location, 1, 1.5);
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        const { f } = basis(p);
        const spot = api.add(p.location, api.scale(f, 4));
        api.particle(p.dimension, "aegis:chakra_burst", api.add(spot, { x: 0, y: 0.5, z: 0 }));
        api.particle(p.dimension, "aegis:beast_burst", spot, C.hiramekarei);
        api.particle(p.dimension, "minecraft:huge_explosion_emitter", spot);
        api.sound(p.dimension, "random.anvil_land", spot, 1, 0.5);
        for (const e of targetsAround(p, spot, 4.5)) {
          api.hurt(e, 16, p);
          const away = api.norm({ x: e.location.x - spot.x, y: 0, z: e.location.z - spot.z });
          api.knockback(e, away.x, away.z, 1.2, 0.9);
        }
      }, 8);
    },
    onHit(p, t) {
      if (Math.random() < 0.25) {
        api.hurt(t, 4, p, "magic");
        api.particle(p.dimension, "aegis:chakra_burst", api.add(t.location, { x: 0, y: 1, z: 0 }));
      }
    },
  },

  // The Fangs of Lightning: call a bolt down onto your target, chaining to others.
  "aegis:kiba": {
    id: "kiba", text: "§e", special: "Lightning Fang", cost: 30, cd: 80,
    cast(p) {
      const target = viewTargets(p, 30)[0];
      if (!target) {
        p.onScreenDisplay.setActionBar("§7No target in sight.");
        return false;
      }
      api.anim(p, "animation.aegis.sword_raise");
      api.sound(p.dimension, "ambient.weather.thunder", p.location, 0.8, 1.2);
      for (let i = 0; i < 12; i += 2) {
        system.runTimeout(() => api.isValid(p) && api.particle(p.dimension, "aegis:chidori", api.add(p.location, { x: 0, y: 2.6, z: 0 })), i);
      }
      system.runTimeout(() => {
        if (!api.isValid(target)) return;
        const top = api.add(target.location, { x: 0, y: 14, z: 0 });
        line(p.dimension, top, target.location, "aegis:chidori", undefined, 0.7);
        line(p.dimension, top, target.location, "aegis:slash", C.kiba, 0.5);
        api.particle(p.dimension, "aegis:lightning_burst", api.add(target.location, { x: 0, y: 1, z: 0 }));
        api.particle(p.dimension, "minecraft:huge_explosion_emitter", target.location);
        api.sound(p.dimension, "ambient.weather.lightning.impact", target.location, 1.5, 1);
        api.hurt(target, 18, p, "lightning");
        eff(target, "slowness", 30, 255);
        // chain lightning
        let n = 0;
        for (const e of targetsAround(p, target.location, 7)) {
          if (e.id === target.id || n >= 3) continue;
          n++;
          line(p.dimension, api.add(target.location, { x: 0, y: 1, z: 0 }), api.add(e.location, { x: 0, y: 1, z: 0 }), "aegis:chidori", undefined, 0.6);
          api.hurt(e, 8, p, "lightning");
        }
      }, 14);
    },
    onHit(p, t) {
      api.hurt(t, 3, p, "magic");
      api.particle(p.dimension, "aegis:chidori", api.add(t.location, { x: 0, y: 1, z: 0 }));
    },
    held(p) {
      if (Math.random() < 0.6) api.particle(p.dimension, "aegis:chidori", api.sub(api.handPos(p), { x: 0, y: 0.3, z: 0 }));
    },
  },

  // The Sewing Needle: pierce a whole line of enemies and stitch them together.
  "aegis:nuibari": {
    id: "nuibari", text: "§f", special: "Thread Stitch", cost: 20, cd: 80,
    cast(p) {
      const targets = viewTargets(p, 20);
      if (!targets.length) {
        p.onScreenDisplay.setActionBar("§7No target in sight.");
        return false;
      }
      api.anim(p, "animation.aegis.sword_thrust");
      api.sound(p.dimension, "item.trident.throw", p.location, 1, 1.5);
      system.runTimeout(() => {
        let prev = api.add(p.location, { x: 0, y: 1.2, z: 0 });
        let cx = 0, cz = 0;
        for (const e of targets) {
          const at = api.add(e.location, { x: 0, y: 1, z: 0 });
          line(p.dimension, prev, at, "aegis:thread", undefined, 0.3);
          prev = at;
          cx += e.location.x;
          cz += e.location.z;
          api.hurt(e, 9, p);
          eff(e, "slowness", 90, 255);
          eff(e, "weakness", 90, 1);
          hitMark(p, e, C.nuibari);
        }
        // pull the stitched targets together
        cx /= targets.length;
        cz /= targets.length;
        if (targets.length > 1) {
          for (const e of targets) {
            const to = api.norm({ x: cx - e.location.x, y: 0, z: cz - e.location.z });
            api.knockback(e, to.x, to.z, 1.2, 0.2);
          }
        }
        if (targets.length > 1) p.onScreenDisplay.setActionBar(`§fStitched §e${targets.length}§f enemies together!`);
      }, 4);
    },
    onHit(p, t) {
      eff(t, "slowness", 40, 1);
    },
  },

  // The Blastsword: a chain of explosive tags marching forward.
  "aegis:shibuki": {
    id: "shibuki", text: "§6", special: "Explosive Tag Chain", cost: 25, cd: 80,
    cast(p) {
      api.anim(p, "animation.aegis.sword_overhead");
      arcOverhead(p, C.shibuki);
      const { f } = basis(p);
      const origin = p.location;
      for (let k = 1; k <= 3; k++) {
        system.runTimeout(() => {
          if (!api.isValid(p)) return;
          const spot = api.add(origin, api.scale(f, 2.5 * k));
          api.particle(p.dimension, "aegis:fire_burst", api.add(spot, { x: 0, y: 0.6, z: 0 }));
          api.particle(p.dimension, "minecraft:huge_explosion_emitter", spot);
          api.sound(p.dimension, "random.explode", spot, 1, 1.1 + k * 0.1);
          for (const e of targetsAround(p, spot, 3)) {
            api.hurt(e, 10, p, "entityExplosion");
            const away = api.norm({ x: e.location.x - spot.x, y: 0, z: e.location.z - spot.z });
            api.knockback(e, away.x, away.z, 1.3, 0.5);
          }
        }, 6 + k * 4);
      }
    },
    onHit(p, t) {
      if (Math.random() < 0.25) {
        api.particle(p.dimension, "aegis:fire_burst", api.add(t.location, { x: 0, y: 1, z: 0 }));
        api.sound(p.dimension, "random.explode", t.location, 0.5, 1.6);
        for (const e of targetsAround(p, t.location, 2.2)) api.hurt(e, 4, p, "entityExplosion");
      }
    },
  },

  // Asuma's trench knife: wind chakra flow — fire a cutting wind blade.
  "aegis:chakra_blades": {
    id: "chakra_blades", text: "§a", special: "Flying Wind Blade", cost: 15, cd: 30,
    cast(p) {
      api.anim(p, "animation.aegis.sword_slash");
      arcSweep(p, C.chakra_blades);
      api.sound(p.dimension, "mob.breeze.wind_burst", p.location, 0.8, 1.4);
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        api.launchProjectile(p, api.add(p.getHeadLocation(), api.scale(p.getViewDirection(), 1.2)), p.getViewDirection(), {
          noOrb: true, speed: 1.8, maxAge: 14, damage: 12, radius: 2.2, knock: 1.5, fire: 0,
          trail: "aegis:slash", burst: "aegis:wind_gust", color: C.chakra_blades, hitRadius: 1.4, sound: "random.explode",
        });
      }, 3);
    },
    onHit(p, t) {
      api.hurt(t, 2, p, "magic");
    },
    held(p) {
      if (Math.random() < 0.35) api.particle(p.dimension, "aegis:slash", api.sub(api.handPos(p), { x: 0, y: 0.3, z: 0 }), C.chakra_blades);
    },
  },
};

function heldStack(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Worn swords. Scroll away from a legendary sword and it is slung across your back (it moves to the off-hand slot,
// where its model is drawn on the body instead of in the hand). Scroll back to its now-empty hotbar slot and it is
// drawn again. Only one sword is worn at a time, and only if the off hand is free.
//   /scriptevent aegis:sheath off | on   — keep swords in the hotbar instead
// ---------------------------------------------------------------------------
const SHEATH_OFF = "aegis:sheath_off";
const HOME = "aegis:sheath_slot"; // the hotbar slot a worn sword came from
const lastHeld = new Map(); // player id -> { slot, typeId } while holding a legendary sword

function sheathTick() {
  for (const p of world.getAllPlayers()) {
    try {
      wear(p);
    } catch {
      /* ignore */
    }
  }
}

function wear(p) {
  const inv = p.getComponent("minecraft:inventory")?.container;
  const eq = p.getComponent("minecraft:equippable");
  if (!inv || !eq) return;
  const sel = p.selectedSlotIndex;
  const held = inv.getItem(sel);
  const off = eq.getEquipment("Offhand");
  const home = p.getDynamicProperty(HOME);

  // draw: back on the slot it came from, with nothing in hand. A sword put away from the last hotbar slot before v1.47
  // can't go back there (the Shinobi Record owns it now): it's drawn into whichever empty slot you select instead.
  if (off && SWORDS[off.typeId] && !held && (home === sel || (home === RECORD_SLOT && sel !== RECORD_SLOT))) {
    inv.setItem(sel, off);
    if (inv.getItem(sel)?.typeId === off.typeId) {
      eq.setEquipment("Offhand", undefined);
      p.setDynamicProperty(HOME, undefined);
      api.sound(p.dimension, "aegis.draw", p.location, 0.9, 1);
      lastHeld.set(p.id, { slot: sel, typeId: off.typeId });
    }
    return;
  }
  if (home !== undefined && !(off && SWORDS[off.typeId])) p.setDynamicProperty(HOME, undefined); // it was moved by hand

  // put away: the sword you were holding a moment ago is still in its slot, you've scrolled off it, the off hand is free
  const was = lastHeld.get(p.id);
  if (was && was.slot !== sel && !off && !p.getDynamicProperty(SHEATH_OFF)) {
    const it = inv.getItem(was.slot);
    if (it && it.typeId === was.typeId) {
      eq.setEquipment("Offhand", it);
      if (eq.getEquipment("Offhand")?.typeId === it.typeId) {
        inv.setItem(was.slot, undefined);
        p.setDynamicProperty(HOME, was.slot);
        api.sound(p.dimension, "aegis.sheathe", p.location, 0.9, 1);
      }
    }
  }
  if (held && SWORDS[held.typeId]) lastHeld.set(p.id, { slot: sel, typeId: held.typeId });
  else lastHeld.delete(p.id);
}

// ---------------------------------------------------------------------------
// Carrying poses: while you hold Samehada it rests across the back of your neck, your arm raised to its grip (like
// Kisame); the Kusanagi is held sheathed across your body, ready to draw. The pose steps aside for every swing (the
// animation fades out while the arm swings, and each hit or sword special stops it) and comes back a moment later.
// The Kusanagi's scabbard hides while you swing (the attachable), so the blade is drawn for the strike.
// ---------------------------------------------------------------------------
const POSES = { "aegis:samehada": "animation.aegis.hold_samehada", "aegis:kusanagi": "animation.aegis.hold_kusanagi" };
const posed = new Map(); // player id -> the sword their pose is playing for
const lastSwing = new Map(); // player id -> tick of their last hit or sword special
const POSE_AFTER = 14; // ticks after a strike before the pose returns

function poseTick() {
  const now = system.currentTick;
  for (const p of world.getAllPlayers()) {
    const id = heldStack(p)?.typeId;
    const want = POSES[id];
    if (!want) {
      posed.delete(p.id); // its stop expression has already ended it
      continue;
    }
    if (posed.get(p.id) === id || now - (lastSwing.get(p.id) ?? -1e9) < POSE_AFTER) continue;
    try {
      p.playAnimation(want, { controller: "aegis_sword_pose", blendOutTime: 0.25, stopExpression: `!q.is_item_name_any('slot.weapon.mainhand', 0, '${id}')` });
      posed.set(p.id, id);
    } catch {
      /* ignore */
    }
  }
}

function clearPose(p) {
  lastSwing.set(p.id, system.currentTick);
  if (!posed.delete(p.id)) return;
  try {
    p.playAnimation("animation.aegis.sword_pose_clear", { controller: "aegis_sword_pose", blendOutTime: 0.1 });
  } catch {
    /* ignore */
  }
}

function repairHeld(player, amount) {
  try {
    const inv = player.getComponent("minecraft:inventory").container;
    const it = inv.getItem(player.selectedSlotIndex);
    const dur = it?.getComponent("minecraft:durability");
    if (!dur || dur.damage <= 0) return;
    dur.damage = Math.max(0, dur.damage - amount);
    inv.setItem(player.selectedSlotIndex, it);
  } catch {
    /* ignore */
  }
}

export function handleSwordUse(player, itemStack) {
  const s = SWORDS[itemStack.typeId];
  if (s && (lastCast.get(player.id) ?? -99) > system.currentTick - 6 && lastCast.get(player.id) !== system.currentTick) return true;
  if (s) lastCast.set(player.id, system.currentTick);
  if (!s) return false;
  const key = itemStack.typeId;
  const left = api.cooldownLeft(player, key);
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7${s.special} ready in §f${(left / 20).toFixed(1)}s`);
    return true;
  }
  const cost = s.cost ?? 0;
  if (api.getChakra(player) < cost) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(api.getChakra(player))}/${cost})`);
    return true;
  }
  clearPose(player); // the special's own animation takes the arms
  if (s.cast(player) === false) return true;
  sfx(player.dimension, "aegis.slash", player.location, 1.3, 0.9 + Math.random() * 0.2);
  if (["hiramekarei", "shibuki", "kiba", "kubikiribocho", "samehada"].includes(s.id)) {
    system.runTimeout(() => api.isValid(player) && impactFx(player.dimension, player.location, C[s.id], 1.5), 8);
  }
  if (cost) api.setChakra(player, api.getChakra(player) - cost);
  api.gainJutsuXp(player, cost);
  api.startCooldown(player, key, s.cd);
  player.onScreenDisplay.setActionBar(`§l${s.text ?? "§b"}${s.special}!`);
  return true;
}

// Right-click fires itemStartUse/itemUse; both route here, de-duplicated.
const lastCast = new Map();
function trigger(player, itemStack) {
  if (!itemStack || !SWORDS[itemStack.typeId]) return false;
  const now = system.currentTick;
  if ((lastCast.get(player.id) ?? -99) > now - 6) return true;
  lastCast.set(player.id, now);
  return handleSwordUse(player, itemStack);
}

export function initSwords(helpers) {
  api = helpers;

  world.afterEvents.itemStartUse.subscribe(({ source, itemStack }) => {
    if (source?.typeId === "minecraft:player") trigger(source, itemStack);
  });

  // Backup trigger (works everywhere, incl. mobile): sneak + hit an enemy with the sword.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== "minecraft:player" || !damagingEntity.isSneaking) return;
    const it = heldStack(damagingEntity);
    if (it && SWORDS[it.typeId]) system.run(() => trigger(damagingEntity, it));
  });

  // Passive effects + slash marks on every melee hit.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== "minecraft:player") return;
    const s = SWORDS[heldStack(damagingEntity)?.typeId];
    if (!s || !api.isValid(hitEntity) || sameVillage(damagingEntity, hitEntity)) return;
    hitMark(damagingEntity, hitEntity, C[s.id]);
    api.sound(damagingEntity.dimension, "item.trident.hit", hitEntity.location, 0.5, 1.4);
    try {
      s.onHit?.(damagingEntity, hitEntity);
    } catch {
      /* ignore */
    }
  });

  // Carrying poses step aside for every hit
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => {
    if (damagingEntity?.typeId === "minecraft:player") clearPose(damagingEntity);
  });
  system.runInterval(poseTick, 4);
  world.afterEvents.playerSpawn.subscribe(({ player }) => posed.delete(player.id));

  // Putting a sword away / drawing it
  system.runInterval(sheathTick, 2);
  world.afterEvents.playerSpawn.subscribe(({ player }) => lastHeld.delete(player.id));
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:sheath" || p?.typeId !== "minecraft:player") return;
    const off = String(message ?? "").trim().toLowerCase() === "off";
    p.setDynamicProperty(SHEATH_OFF, off ? true : undefined);
    p.sendMessage(off ? "§7Swords stay in your hotbar when you switch away from them." : "§7Swords go on your back when you switch away from them.");
  });

  // Ambient effects while a sword is held.
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      const s = SWORDS[heldStack(p)?.typeId];
      if (s?.held) {
        try {
          s.held(p);
        } catch {
          /* ignore */
        }
      }
    }
  }, 4);
}
