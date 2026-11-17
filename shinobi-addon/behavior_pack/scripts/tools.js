// Ninja tools & food (v1.55). Right-click a tool to use it; food is eaten like any food.
//   Smoke Bomb        — a cloud of smoke at your feet: you vanish (invisible + faster), enemies inside can't see
//   Flash Bomb        — thrown; bursts into a blinding flash (blindness, nausea, slowness) — no damage
//   Senbon            — a fan of three needles (sneak: poison-tipped)
//   Fūma Shuriken     — a giant windmill shuriken: out 14 blocks and back to your hand, cutting everything it passes
//   Explosive Kunai   — a kunai with a paper bomb: it goes off half a second after it lands
//   Flying Raijin Kunai — Minato's three-pronged kunai: an enemy it hits is marked, where it lands becomes a seal —
//                         Flying Thunder God (the scroll) takes you there
//   Ninja Wire        — snare the enemy you look at, pull them in and hold them for a moment
//   Food: Dango (heal + speed) · Food Pill (+80 chakra and strength, at a cost) · Blood Pill (regeneration + absorption)
//         · Ration Pill (fills you up) · Curry of Life (full heal, regeneration and strength — spicy!)
// Tools are used up one at a time (except the Fūma Shuriken and the Flying Raijin Kunai); creative players keep them.

import { world, system } from "@minecraft/server";
import { impactFx, sfx } from "./cinematic.js";
import { markFoe, setRaijinSpot } from "./jutsu4.js";

let api;
const GOLD = [1, 0.9, 0.4];
const STEEL = [0.85, 0.88, 0.95];
const up = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });
const flat = (d) => api.norm({ x: d.x, y: 0, z: d.z });
const rotate = (d, a) => ({ x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y, z: d.x * Math.sin(a) + d.z * Math.cos(a) });
const bar = (p, t) => p.onScreenDisplay?.setActionBar(t);

function eff(e, id, ticks, amp = 0, show = true) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: show });
  } catch {
    /* ignore */
  }
}

function foes(player, pos, r) {
  try {
    return player.dimension.getEntities({ location: pos, maxDistance: r }).filter((e) => e.id !== player.id && api.canBeHit(e, player));
  } catch {
    return [];
  }
}

function lookTarget(player, range) {
  try {
    return player.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
  } catch {
    return undefined;
  }
}

const creative = (p) => {
  try {
    return String(p.getGameMode()).toLowerCase() === "creative";
  } catch {
    return false;
  }
};

// Uses up one of the item in the player's hand (not in creative).
function useOne(player, typeId) {
  if (creative(player)) return;
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    const it = inv?.getItem(player.selectedSlotIndex);
    if (!it || it.typeId !== typeId) return;
    if (it.amount > 1) {
      it.amount -= 1;
      inv.setItem(player.selectedSlotIndex, it);
    } else inv.setItem(player.selectedSlotIndex, undefined);
  } catch {
    /* ignore */
  }
}

function heal(p, n) {
  try {
    const h = p.getComponent("minecraft:health");
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
const TOOLS = {
  "aegis:smoke_bomb": {
    cd: 200, consume: true,
    use(p) {
      const dim = p.dimension;
      const o = { ...p.location };
      sfx(dim, "aegis.poof", o, 1.4, 0.7);
      for (let t = 0; t < 100; t += 10) {
        system.runTimeout(() => {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t;
            api.particle(dim, "aegis:smoke_puff", { x: o.x + Math.cos(a) * 2.5, y: o.y + 0.3, z: o.z + Math.sin(a) * 2.5 });
          }
          api.particle(dim, "aegis:mist_cloud", up(o, 1));
          if (t % 20 === 0) for (const e of foes(p, o, 5)) eff(e, "blindness", 40, 0);
        }, t);
      }
      eff(p, "invisibility", 100, 0, false);
      eff(p, "speed", 100, 0, false);
      bar(p, "§7Smoke bomb! §8(you're hidden for 5 s)");
    },
  },
  "aegis:flash_bomb": {
    cd: 100, consume: true,
    use(p) {
      const dim = p.dimension;
      const d = p.getViewDirection();
      api.anim(p, "animation.aegis.throw_overhead");
      api.launchProjectile(p, api.add(p.getHeadLocation(), api.scale(d, 1.2)), d, {
        noOrb: true, speed: 1.1, maxAge: 20, custom: true, trail: "aegis:slash", color: [1, 1, 0.9], hitRadius: 1.2,
        onHit: (pr) => {
          api.particle(dim, "aegis:lightning_burst", pr.pos, [1, 1, 0.95]);
          api.particle(dim, "aegis:cine_ring", pr.pos, [1, 1, 0.95]);
          api.sound(dim, "firework.blast", pr.pos, 1.6, 1.4);
          if (!api.isValid(p)) return;
          for (const e of foes(p, pr.pos, 6)) {
            eff(e, "blindness", 100, 0);
            eff(e, "nausea", 60, 0);
            eff(e, "slowness", 60, 0);
          }
        },
      });
    },
  },
  "aegis:senbon": {
    cd: 10, consume: true,
    use(p) {
      const dim = p.dimension;
      const d = p.getViewDirection();
      const poison = p.isSneaking;
      api.anim(p, "animation.aegis.palm_thrust");
      api.sound(dim, "random.bow", p.location, 0.8, 1.8);
      for (const a of [-0.12, 0, 0.12]) {
        api.launchProjectile(p, api.add(p.getHeadLocation(), api.scale(d, 1.2)), rotate(d, a), {
          noOrb: true, speed: 2, maxAge: 14, custom: true, trail: "aegis:slash", color: STEEL, hitRadius: 1,
          onHit: (pr) => {
            const e = pr.hitEntity;
            if (!e || !api.isValid(e) || !api.isValid(p)) return;
            api.hurt(e, 3, p);
            eff(e, "slowness", 40, 0);
            if (poison) eff(e, "poison", 80, 0);
          },
        });
      }
    },
  },
  "aegis:fuma_shuriken": {
    cd: 60, consume: false,
    use(p) {
      const dim = p.dimension;
      const d = flat(p.getViewDirection());
      api.anim(p, "animation.aegis.throw_overhead");
      api.sound(dim, "aegis.wind_cut", p.location, 1.4, 0.7);
      let pos = up(p.location, 1.2);
      const hitOut = new Set();
      const hitBack = new Set();
      for (let t = 1; t <= 36; t++) {
        system.runTimeout(() => {
          if (!api.isValid(p)) return;
          const back = t > 14;
          if (!back) pos = api.add(pos, api.scale(d, 1));
          else {
            const home = up(p.location, 1.2);
            const v = api.sub(home, pos);
            const len = Math.hypot(v.x, v.y, v.z);
            if (len < 1.2) return; // caught
            pos = api.add(pos, api.scale(v, Math.min(1, 1.1 / len)));
          }
          api.particle(dim, "aegis:slash", pos, STEEL);
          if (t % 2 === 0) api.particle(dim, "aegis:wind_gust", pos, STEEL);
          const seen = back ? hitBack : hitOut;
          for (const e of foes(p, pos, 1.7)) {
            if (seen.has(e.id)) continue;
            seen.add(e.id);
            api.hurt(e, 8, p);
            api.particle(dim, "aegis:slash", up(e.location, 1), [1, 0.3, 0.3]);
          }
        }, t);
      }
    },
  },
  "aegis:explosive_kunai": {
    cd: 20, consume: true,
    use(p) {
      const dim = p.dimension;
      const d = p.getViewDirection();
      api.anim(p, "animation.aegis.throw_overhead");
      api.launchProjectile(p, api.add(p.getHeadLocation(), api.scale(d, 1.2)), d, {
        noOrb: true, speed: 1.6, maxAge: 24, custom: true, trail: "aegis:slash", color: [1, 0.8, 0.5], hitRadius: 1.1,
        onHit: (pr) => {
          const at = { ...pr.pos };
          api.particle(dim, "aegis:fire_trail", at, [1, 0.6, 0.2]);
          api.sound(dim, "random.fuse", at, 1, 1.2);
          system.runTimeout(() => {
            api.particle(dim, "minecraft:huge_explosion_emitter", at);
            api.particle(dim, "aegis:fire_burst", at, [1, 0.5, 0.1]);
            impactFx(dim, at, [1, 0.5, 0.1], 1.4);
            api.sound(dim, "random.explode", at, 1.2, 1);
            if (!api.isValid(p)) return;
            for (const e of foes(p, at, 3)) {
              api.hurt(e, 10, p, "entityExplosion");
              const a = flat(api.sub(e.location, at));
              api.knockback(e, a.x, a.z, 1.2, 0.4);
            }
          }, 10);
        },
      });
    },
  },
  "aegis:raijin_kunai": {
    cd: 40, consume: false,
    use(p) {
      const dim = p.dimension;
      const d = p.getViewDirection();
      api.anim(p, "animation.aegis.throw_overhead");
      api.sound(dim, "random.bow", p.location, 0.8, 1.4);
      api.launchProjectile(p, api.add(p.getHeadLocation(), api.scale(d, 1.2)), d, {
        noOrb: true, speed: 1.8, maxAge: 22, custom: true, trail: "aegis:slash", color: GOLD, hitRadius: 1.1,
        onHit: (pr) => {
          if (!api.isValid(p)) return;
          const e = pr.hitEntity;
          if (e && api.isValid(e)) {
            api.hurt(e, 4, p);
            markFoe(p, e);
            return;
          }
          const spot = api.sub(pr.pos, api.scale(d, 0.6));
          setRaijinSpot(p, dim, { x: spot.x, y: Math.floor(spot.y), z: spot.z });
          bar(p, "§eFlying Raijin Kunai planted §7— Flying Thunder God brings you here (5 minutes).");
        },
      });
    },
  },
  "aegis:ninja_wire": {
    cd: 60, consume: true,
    use(p) {
      const t = lookTarget(p, 12);
      if (!t) {
        bar(p, "§7Look at an enemy to snare them with wire.");
        return false;
      }
      const dim = p.dimension;
      api.anim(p, "animation.aegis.pull");
      api.sound(dim, "random.bow", p.location, 0.8, 0.6);
      const a = up(p.location, 1.2);
      const b = up(t.location, 1);
      for (let i = 0; i <= 10; i++) api.particle(dim, "aegis:thread", api.add(a, api.scale(api.sub(b, a), i / 10)), STEEL);
      const toward = flat(api.sub(p.location, t.location));
      api.knockback(t, toward.x, toward.z, 1.2, 0.2);
      api.hurt(t, 4, p);
      eff(t, "slowness", 50, 255);
      bar(p, "§7Wire snare!");
    },
  },
};

// ---------------------------------------------------------------------------
// Food (eaten like any food; the effects come when it's finished)
// ---------------------------------------------------------------------------
const FOOD = {
  "aegis:dango": (p) => {
    heal(p, 4);
    eff(p, "speed", 400, 0, false);
    bar(p, "§dDango! §7Sweet — and a spring in your step.");
  },
  "aegis:food_pill": (p) => {
    api.setChakra(p, api.getChakra(p) + 80);
    eff(p, "strength", 600, 0, false);
    eff(p, "hunger", 200, 1, false);
    bar(p, "§6Food Pill §a+80 chakra §7and strength… §8(your stomach complains)");
  },
  "aegis:blood_pill": (p) => {
    eff(p, "regeneration", 160, 1, false);
    eff(p, "absorption", 600, 1, false);
    bar(p, "§cBlood Pill §7— your blood surges back.");
  },
  "aegis:ration_pill": (p) => bar(p, "§eMilitary Ration Pill §7— a whole meal in one pill."),
  "aegis:curry_of_life": (p) => {
    try {
      const h = p.getComponent("minecraft:health");
      h.setCurrentValue(h.effectiveMax);
    } catch {
      /* ignore */
    }
    eff(p, "regeneration", 200, 1, false);
    eff(p, "strength", 1200, 0, false);
    eff(p, "nausea", 60, 0, false);
    api.particle(p.dimension, "aegis:fire_burst", up(p.location, 1.6), [1, 0.4, 0.1]);
    bar(p, "§cSO SPICY! §aThe Curry of Life restores you completely!");
  },
};

export const TOOL_IDS = Object.keys(TOOLS);
export const FOOD_IDS = Object.keys(FOOD);

export function initTools(helpers) {
  api = helpers;
  world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
    const tool = TOOLS[itemStack?.typeId];
    if (!tool || p?.typeId !== "minecraft:player") return;
    const key = `tool:${itemStack.typeId}`;
    const left = api.cooldownLeft(p, key);
    if (left > 0) return bar(p, `§7Ready in §f${(left / 20).toFixed(1)}s`);
    let used;
    try {
      used = tool.use(p);
    } catch {
      used = false;
    }
    if (used === false) return;
    api.startCooldown(p, key, tool.cd);
    if (tool.consume) useOne(p, itemStack.typeId);
  });
  world.afterEvents.itemCompleteUse.subscribe(({ source: p, itemStack }) => {
    const food = FOOD[itemStack?.typeId];
    if (!food || p?.typeId !== "minecraft:player") return;
    try {
      food(p);
    } catch {
      /* ignore */
    }
  });
}
