// The v1.62 titles of legend — their scrolls (registered into main.js JUTSU through titles.js makeTitleJutsu) and their
// right-click gear (titles.js SPECIALS). Only the title's holder can use them (main.js checks `title`; titles.js denied()).
//   The Toad Sage ........ Summoning: Gamabunta · Sage Art: Goemon · Toad Summoning Contract (Frog Call)
//   The Slug Princess .... Strength of a Hundred Seal · Summoning: Katsuyu · Tsunade's Necklace (Heavenly Foot of Pain)
//   The White Snake ...... Eight Branches · White Snake Rebirth · Kusanagi Long Sword (a twelve-block thrust)
//   The Yellow Flash ..... Flying Thunder God: Strike · Rasengan Barrage · Minato's Tri-Pronged Kunai (throw, then warp to it)
//   The Green Beast ...... Night Guy · Evening Elephant · Guy's Nunchaku (Dynamic Entry)
//   The Copy Ninja ....... Kamui Raikiri · Lightning Hound V2 · Icha Icha Tactics (30 s of insight)
//   The Sage of Six Paths  Truth-Seeking Orbs · Six Paths Sage Mode · Shakujō of the Six Paths (a planetary pull)
//   Madara's Heir ........ Perfect Susanoo V2 · Tengai Shinsei · Madara's Gunbai (a ring of fire)

import { system } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { impactFx, chargeFx, shake, sfx } from "./cinematic.js";

let api; // main.js npcApi
let h; // titles.js helpers: foesNear, eff, ready, targetInView, lookPoint, noTarget, susanooFor, noteTeleport, setSixPaths, setInsight

const TOAD = [0.95, 0.45, 0.25];
const FIRE = [1, 0.5, 0.12];
const SLUG = [0.55, 0.8, 1];
const HEAL = [0.4, 1, 0.5];
const SNAKE = [0.6, 0.35, 0.8];
const FLASH = [1, 0.9, 0.35];
const RASEN = [0.45, 0.75, 1];
const NIGHT = [1, 0.2, 0.15];
const BEAST = [0.35, 0.95, 0.45];
const BOLT = [0.6, 0.85, 1];
const KAMUI = [0.6, 0.35, 0.95];
const SAGE = [1, 0.85, 0.35];
const ORB = [0.1, 0.08, 0.12];
const MADARA = [0.35, 0.45, 1];
const METEOR = [0.9, 0.45, 0.2];
const DEBUFFS = ["slowness", "weakness", "poison", "wither", "blindness", "nausea", "mining_fatigue", "hunger", "levitation", "darkness"];

const up = (pos, y = 1) => ({ x: pos.x, y: pos.y + y, z: pos.z });
const fwd = (p) => api.norm({ ...p.getViewDirection(), y: 0 });
const later = (ticks, fn) =>
  system.runTimeout(() => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }, ticks);

// Enemies in front of `p`: within `range`, inside the cone whose half-angle has cosine `cos`.
function cone(p, range, cos) {
  const f = fwd(p);
  return h.foesNear(p, p.location, range).filter((e) => {
    const d = api.norm({ x: e.location.x - p.location.x, y: 0, z: e.location.z - p.location.z });
    return d.x * f.x + d.z * f.z >= cos || Math.hypot(e.location.x - p.location.x, e.location.z - p.location.z) < 1.5;
  });
}
function health(e) {
  try {
    return e.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
}
function heal(e, fraction) {
  const hp = health(e);
  if (hp && hp.currentValue > 0) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + hp.effectiveMax * fraction));
}
function cleanse(e) {
  for (const id of DEBUFFS) {
    try {
      if (e.getEffect(id)) e.removeEffect(id);
    } catch {
      /* ignore */
    }
  }
}
function burn(e, seconds) {
  try {
    e.setOnFire(seconds, true);
  } catch {
    /* ignore */
  }
}
const ownedBy = (e, p) => {
  try {
    return e.getDynamicProperty("aegis:owner") === p.id;
  } catch {
    return false;
  }
};
// A safe spot to warp to: `pos` if the body fits there, else stepped back toward `from`.
function safeSpot(dim, pos, from) {
  for (let k = 0; k <= 4; k++) {
    const at = k === 0 ? pos : api.add(pos, api.scale(api.norm(api.sub(from, pos)), k * 0.8));
    try {
      const feet = dim.getBlock(at);
      const head = dim.getBlock(up(at));
      if (feet && head && (feet.isAir || feet.isLiquid) && (head.isAir || head.isLiquid)) return at;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}
function warp(p, pos, faceTo) {
  try {
    p.teleport(pos, faceTo ? { facingLocation: faceTo } : undefined);
    return true;
  } catch {
    return false;
  }
}

// The boss summons: Gamabunta and Katsuyu — the normal summon grown three times bigger ("aegis:giant", gen_npcs.py).
function giant(p, typeId, name, at) {
  for (const e of p.dimension.getEntities({ families: ["summon"] })) if (ownedBy(e, p)) e.remove(); // one summon at a time
  let e;
  try {
    e = p.dimension.spawnEntity(typeId, at);
  } catch {
    return undefined;
  }
  e.setDynamicProperty("aegis:owner", p.id);
  try {
    e.triggerEvent("aegis:giant");
  } catch {
    /* ignore */
  }
  let tamed = false;
  try {
    tamed = !!e.getComponent("minecraft:tameable")?.tame(p);
  } catch {
    tamed = false;
  }
  if (!tamed) {
    try {
      e.triggerEvent("aegis:tamed");
    } catch {
      /* ignore */
    }
  }
  e.nameTag = `${p.name}'s ${name}`;
  return e;
}
// Smoke, a thud and a shockwave where a giant lands.
function landing(p, at, color, radius, damage) {
  const dim = p.dimension;
  for (let k = 0; k < 4; k++) api.particle(dim, "aegis:smoke_puff", api.add(at, { x: (k % 2 ? 1.5 : -1.5), y: 0.5 + k * 0.6, z: (k < 2 ? 1.5 : -1.5) }));
  api.particle(dim, "minecraft:huge_explosion_emitter", at);
  impactFx(dim, at, color, 3);
  shake(dim, at, 1.2, 1, 28);
  sfx(dim, "aegis.summon", at, 2, 0.6);
  api.sound(dim, "random.explode", at, 1.5, 0.5);
  for (const e of h.foesNear(p, at, radius)) {
    api.hurt(e, damage, p);
    const away = api.norm({ x: e.location.x - at.x, y: 0, z: e.location.z - at.z });
    api.knockback(e, away.x, away.z, 3, 0.8);
  }
}

export function makeLegendJutsu(helpers, titleHelpers) {
  api = helpers;
  h = titleHelpers;
  return {
    // ---------------------------------------------------------------- The Toad Sage
    "aegis:gamabunta_scroll": { title: "toad_sage", name: "Summoning: Gamabunta", cost: 140, cooldown: 1200, cast(p) {
      const at = h.lookPoint(p, 10);
      api.anim(p, "animation.aegis.summon_slam");
      chargeFx(p, TOAD, 10, "aegis.charge");
      later(10, () => {
        if (!api.isValid(p)) return;
        const toad = giant(p, "aegis:summon_toad", "§aGamabunta", at);
        landing(p, at, TOAD, 7, 30);
        showTitle(p, "§aSummoning: Gamabunta", { subtitle: "§7the Toad Boss answers", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
        if (!toad) return;
        // Gamabunta's dosu: a sweep of the blade every two seconds
        for (let t = 40; t <= 800; t += 40) {
          later(t, () => {
            if (!api.isValid(toad) || !api.isValid(p)) return;
            const foes = h.foesNear(p, toad.location, 9);
            if (!foes.length) return;
            sfx(toad.dimension, "aegis.slash", toad.location, 1.6, 0.5);
            for (const e of foes) {
              api.particle(e.dimension, "aegis:slash", up(e.location, 1.2), TOAD);
              api.hurt(e, 14, p);
            }
          });
        }
      });
      return true;
    } },
    "aegis:goemon_scroll": { title: "toad_sage", name: "Sage Art: Goemon", cost: 110, cooldown: 600, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.jutsu_breath");
      chargeFx(p, FIRE, 10, "aegis.inhale");
      later(10, () => sfx(dim, "aegis.fire_roar", p.location, 2, 0.7));
      for (let k = 0; k < 10; k++) {
        later(10 + k * 3, () => {
          if (!api.isValid(p)) return;
          const o = p.getHeadLocation();
          const d = p.getViewDirection();
          for (let i = 2; i <= 14; i += 2) {
            const j = i * 0.12;
            const at = api.add(o, { x: d.x * i + (Math.random() - 0.5) * j, y: d.y * i + (Math.random() - 0.5) * j, z: d.z * i + (Math.random() - 0.5) * j });
            api.particle(dim, i % 4 ? "aegis:fire_burst" : "aegis:cine_flame", at, FIRE);
            if (i % 6 === 0) api.particle(dim, "aegis:wind_gust", at);
          }
          const f = fwd(p);
          for (const e of cone(p, 15, 0.8)) {
            api.hurt(e, 6, p, "fire");
            burn(e, 5);
            api.knockback(e, f.x, f.z, 0.4, 0.1);
          }
        });
      }
      return true;
    } },

    // ---------------------------------------------------------------- The Slug Princess
    "aegis:hundred_seal_scroll": { title: "slug_princess", name: "Strength of a Hundred Seal", cost: 120, cooldown: 1200, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.power_up");
      sfx(dim, "aegis.seal", p.location, 1.5, 0.7);
      heal(p, 0.5);
      cleanse(p);
      for (const [id, a] of [["strength", 1], ["resistance", 1], ["regeneration", 1]]) h.eff(p, id, 600, a);
      api.particle(dim, "aegis:heal_seal", up(p.location, 1.8));
      api.particle(dim, "aegis:chakra_burst", up(p.location), [0.6, 0.3, 0.9]);
      for (let k = 0; k < 3; k++) later(k * 4, () => api.particle(dim, "aegis:cine_ring", p.location, HEAL));
      showTitle(p, "§2Strength of a Hundred Seal", { subtitle: "§7the seal on your brow releases — 30 seconds", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
      return true;
    } },
    "aegis:katsuyu_scroll": { title: "slug_princess", name: "Summoning: Katsuyu", cost: 130, cooldown: 1200, cast(p) {
      const at = h.lookPoint(p, 8);
      api.anim(p, "animation.aegis.summon_slam");
      chargeFx(p, SLUG, 10, "aegis.charge");
      later(10, () => {
        if (!api.isValid(p)) return;
        const slug = giant(p, "aegis:summon_slug", "§2Katsuyu", at);
        landing(p, at, SLUG, 6, 18);
        showTitle(p, "§2Summoning: Katsuyu", { subtitle: "§7she heals all who fight beside you", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
        if (!slug) return;
        for (let t = 40; t <= 800; t += 40) {
          later(t, () => {
            if (!api.isValid(slug) || !api.isValid(p)) return;
            // heals you and your allies near you, and washes away their ailments
            for (const q of p.dimension.getPlayers({ location: p.location, maxDistance: 14 })) {
              if (q.id !== p.id && api.canBeHit(q, p)) continue; // not enemies
              heal(q, 0.06);
              cleanse(q);
              api.particle(q.dimension, "aegis:heal", up(q.location));
            }
            // …and spits acid at your enemies
            for (const e of h.foesNear(p, slug.location, 9)) {
              api.hurt(e, 8, p, "magic");
              h.eff(e, "poison", 60, 1);
              api.particle(e.dimension, "aegis:beast_mist", e.location, [0.6, 0.95, 0.4]);
            }
          });
        }
      });
      return true;
    } },

    // ---------------------------------------------------------------- The White Snake
    "aegis:eight_branches_scroll": { title: "white_snake", name: "Eight Branches Technique", cost: 110, cooldown: 600, cast(p) {
      const foes = cone(p, 14, 0.5);
      if (!foes.length) return h.noTarget(p);
      const dim = p.dimension;
      api.anim(p, "animation.aegis.both_palms");
      sfx(dim, "aegis.summon", p.location, 1.5, 0.6);
      api.particle(dim, "aegis:smoke_puff", p.location);
      for (let k = 0; k < 8; k++) {
        later(6 + k * 4, () => {
          if (!api.isValid(p)) return;
          const alive = foes.filter((e) => api.isValid(e));
          const e = alive[k % Math.max(1, alive.length)];
          if (!e) return;
          // the serpent's body from you to its prey, then the bite
          const a = up(p.location);
          const b = up(e.location);
          const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 1.5));
          for (let i = 1; i < n; i++) api.particle(dim, "aegis:cine_swirl", api.add(a, api.scale(api.sub(b, a), i / n)), SNAKE);
          api.particle(dim, "aegis:slash", b, SNAKE);
          api.sound(dim, "mob.silverfish.hit", b, 1, 0.5);
          api.hurt(e, 10, p);
          h.eff(e, "poison", 100, 1);
        });
      }
      return true;
    } },
    "aegis:snake_rebirth_scroll": { title: "white_snake", name: "White Snake Rebirth", cost: 90, cooldown: 900, cast(p) {
      const dim = p.dimension;
      heal(p, 0.6);
      cleanse(p);
      h.eff(p, "resistance", 200, 1);
      h.eff(p, "speed", 100, 1);
      api.particle(dim, "aegis:smoke_puff", p.location);
      api.particle(dim, "aegis:heal", up(p.location));
      api.particle(dim, "aegis:cine_swirl", p.location, [0.95, 0.95, 1]);
      api.sound(dim, "mob.silverfish.say", p.location, 1.2, 0.5);
      showTitle(p, "§5White Snake Rebirth", { subtitle: "§7you slough off your wounds", fadeInDuration: 2, stayDuration: 25, fadeOutDuration: 8 });
      return true;
    } },

    // ---------------------------------------------------------------- The Yellow Flash
    "aegis:raijin_strike_scroll": { title: "yellow_flash", name: "Flying Thunder God: Strike", cost: 70, cooldown: 200, cast(p) {
      const t = h.targetInView(p, 28);
      if (!t) return h.noTarget(p);
      const dim = p.dimension;
      const from = { ...p.location };
      const away = api.norm({ x: t.location.x - from.x, y: 0, z: t.location.z - from.z });
      const spot = safeSpot(dim, api.add(t.location, api.scale(away, 1.6)), t.location) ?? safeSpot(dim, api.sub(t.location, api.scale(away, 1.6)), from);
      if (!spot) return h.noTarget(p);
      api.particle(dim, "aegis:cine_bolt", up(from), FLASH);
      api.particle(dim, "aegis:smoke_puff", from);
      warp(p, spot, up(t.location));
      sfx(dim, "aegis.whoosh", spot, 1.4, 1.6);
      api.particle(dim, "aegis:cine_bolt", up(spot), FLASH);
      api.anim(p, "animation.aegis.sword_slash");
      later(2, () => {
        if (!api.isValid(p) || !api.isValid(t)) return;
        api.particle(dim, "aegis:slash", up(t.location, 1.2), FLASH);
        sfx(dim, "aegis.slash", t.location, 1.3, 1.2);
        api.hurt(t, 20, p); // (the Yellow Flash: double damage on the first blow after a teleport)
        api.knockback(t, -away.x, -away.z, 1.4, 0.3);
      });
      return true;
    } },
    "aegis:rasengan_barrage_scroll": { title: "yellow_flash", name: "Rasengan Barrage", cost: 100, cooldown: 400, cast(p) {
      const t = h.targetInView(p, 30);
      api.anim(p, "animation.aegis.rasengan_form");
      chargeFx(p, RASEN, 6, "aegis.rasengan");
      for (let k = 0; k < 5; k++) {
        later(6 + k * 5, () => {
          if (!api.isValid(p)) return;
          const d = p.getViewDirection();
          const side = api.norm({ x: -d.z, y: 0, z: d.x });
          const off = (k - 2) * 0.45;
          api.launchProjectile(p, api.add(api.add(p.getHeadLocation(), api.scale(d, 1.3)), api.scale(side, off)), d, {
            orbEvent: "aegis:as_rasengan", speed: 1.6, maxAge: 30, damage: 12, radius: 2.5, knock: 1.2, fire: 0,
            trail: "aegis:rasengan", burst: "aegis:chakra_burst", color: RASEN, hitRadius: 1.4, power: 0.8, sound: "aegis.rasengan",
            home: t, turn: 0.12 });
          sfx(p.dimension, "aegis.rasengan", p.location, 0.8, 1.2 + k * 0.05);
        });
      }
      return true;
    } },

    // ---------------------------------------------------------------- The Green Beast
    "aegis:night_guy_scroll": { title: "green_beast", name: "Eight Gates: Night Guy", cost: 160, cooldown: 2400, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.gates_release");
      chargeFx(p, NIGHT, 20, "aegis.gates");
      h.eff(p, "resistance", 40, 3);
      for (let k = 0; k < 4; k++) later(k * 5, () => api.isValid(p) && api.particle(dim, "aegis:beast_aura", p.location, NIGHT));
      showTitle(p, "§cEight Gates: Night Guy", { subtitle: "§7the Gate of Death opens", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 8 });
      later(20, () => {
        if (!api.isValid(p)) return;
        api.anim(p, "animation.aegis.dynamic_entry");
        sfx(dim, "aegis.boom", p.location, 2, 0.6);
        api.lungeStrike(p, { power: 5.5, range: 3.2, ticks: 16,
          trail: () => {
            api.particle(dim, "aegis:cine_flame", up(p.location), NIGHT);
            api.particle(dim, "aegis:fire_trail", up(p.location, 0.6), NIGHT);
          },
          onHit: (t) => {
            const f = fwd(p);
            api.hurt(t, 90, p, "entityAttack", "fist");
            api.knockback(t, f.x, f.z, 4, 1);
            impactFx(dim, t.location, NIGHT, 3);
            shake(dim, t.location, 1.4, 1, 30);
            sfx(dim, "aegis.impact", t.location, 2, 0.5);
          } });
      });
      // the price: a body spent
      later(40, () => {
        if (!api.isValid(p)) return;
        h.eff(p, "slowness", 200, 1);
        h.eff(p, "weakness", 200, 0);
        p.onScreenDisplay?.setActionBar("§7Your body is spent…");
      });
      return true;
    } },
    "aegis:evening_elephant_scroll": { title: "green_beast", name: "Eight Gates: Evening Elephant", cost: 120, cooldown: 600, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.gates_release");
      chargeFx(p, BEAST, 8, "aegis.gates");
      for (let k = 0; k < 5; k++) {
        later(8 + k * 6, () => {
          if (!api.isValid(p)) return;
          api.anim(p, k % 2 ? "animation.aegis.m1_cross" : "animation.aegis.m1_jab");
          const f = fwd(p);
          for (let i = 1; i <= 8; i += 1.5) api.particle(dim, "aegis:wind_gust", api.add(p.location, { x: f.x * i, y: 1.2, z: f.z * i }));
          api.particle(dim, "aegis:cine_ring", api.add(p.location, { x: f.x * 8, y: 0.2, z: f.z * 8 }), [0.9, 0.95, 1]);
          sfx(dim, "aegis.impact", p.location, 1.4, 0.7 + k * 0.08);
          for (const e of cone(p, 9, 0.6)) {
            api.hurt(e, 14, p, "entityAttack", "fist");
            api.knockback(e, f.x, f.z, 2.2, 0.4);
          }
        });
      }
      return true;
    } },

    // ---------------------------------------------------------------- The Copy Ninja
    "aegis:kamui_raikiri_scroll": { title: "copy_ninja", name: "Kamui Raikiri", cost: 110, cooldown: 500, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.chidori_charge");
      chargeFx(p, BOLT, 10, "aegis.chidori");
      later(10, () => {
        if (!api.isValid(p)) return;
        sfx(dim, "aegis.chidori", p.location, 1.5, 0.8);
        api.lungeStrike(p, { power: 4.2, range: 2.8, ticks: 14,
          trail: () => {
            api.particle(dim, "aegis:chidori", up(p.location));
            api.particle(dim, "aegis:cine_swirl", up(p.location), KAMUI);
          },
          onHit: (t) => {
            api.hurt(t, 34, p, "lightning");
            impactFx(dim, t.location, BOLT, 2);
            sfx(dim, "aegis.thunder", t.location, 1.5, 1);
            // …and Kamui tears the space around the wound
            for (let k = 0; k < 3; k++) later(k * 4, () => api.isValid(t) && api.particle(dim, "aegis:cine_swirl", up(t.location), KAMUI));
            h.eff(t, "levitation", 20, 2);
            h.eff(t, "slowness", 80, 3);
          } });
      });
      return true;
    } },
    "aegis:lightning_hound_v2_scroll": { title: "copy_ninja", name: "Lightning Hound V2", cost: 90, cooldown: 400, cast(p) {
      const t = h.targetInView(p, 30);
      api.anim(p, "animation.aegis.lightning_burst");
      sfx(p.dimension, "aegis.hound", p.location, 1.5, 1);
      for (let k = 0; k < 3; k++) {
        later(4 + k * 4, () => {
          if (!api.isValid(p)) return;
          const d = fwd(p);
          const side = { x: -d.z, y: 0, z: d.x };
          const start = api.add(api.add(p.location, { x: d.x * 1.5, y: 0.6, z: d.z * 1.5 }), api.scale(side, (k - 1) * 0.9));
          api.launchProjectile(p, start, api.norm(api.add(d, api.scale(side, (k - 1) * 0.25))), {
            noOrb: true, speed: 1.3, maxAge: 40, damage: 14, radius: 2.2, knock: 0.6, fire: 0,
            trail: "aegis:chidori", burst: "aegis:lightning_burst", color: BOLT, hitRadius: 1.3, power: 0.7, sound: "aegis.thunder",
            effects: [["slowness", 40, 2]], home: t, turn: 0.2, hug: true, hugHeight: 0.6 });
        });
      }
      return true;
    } },

    // ---------------------------------------------------------------- The Sage of Six Paths
    "aegis:truth_seeking_scroll": { title: "six_paths", name: "Truth-Seeking Orbs", cost: 130, cooldown: 900, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.eye_activate");
      sfx(dim, "aegis.seal", p.location, 1.4, 0.5);
      showTitle(p, "§6Truth-Seeking Orbs", { subtitle: "§7six orbs answer your will — 20 seconds", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
      const orbAt = (k, t) => {
        const a = (k / 6) * Math.PI * 2 + t * 0.05;
        return api.add(p.location, { x: Math.cos(a) * 1.3, y: 2.1 + Math.sin(a * 2) * 0.15, z: Math.sin(a) * 1.3 });
      };
      for (let t = 0; t < 400; t += 5) {
        later(t, () => {
          if (!api.isValid(p)) return;
          for (let k = 0; k < 6; k++) api.particle(p.dimension, "aegis:shadow", orbAt(k, t), ORB);
          if (t % 20) return;
          const foe = h.foesNear(p, p.location, 18).sort((a, b) => Math.hypot(a.location.x - p.location.x, a.location.z - p.location.z) - Math.hypot(b.location.x - p.location.x, b.location.z - p.location.z))[0];
          if (!foe) return;
          const from = orbAt((t / 20) % 6, t);
          api.launchProjectile(p, from, api.norm(api.sub(up(foe.location), from)), {
            noOrb: true, speed: 1.8, maxAge: 25, damage: 14, radius: 2, knock: 0.8, fire: 0,
            trail: "aegis:shadow", burst: "aegis:beast_burst", color: ORB, hitRadius: 1.2, power: 0.6, sound: "aegis.impact",
            home: foe, turn: 0.3 });
        });
      }
      return true;
    } },
    "aegis:six_paths_mode_scroll": { title: "six_paths", name: "Six Paths Sage Mode", cost: 150, cooldown: 2400, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.power_up");
      h.setSixPaths(p, 1200); // +25% damage, chakra regen ×2
      for (const [id, a] of [["speed", 1], ["resistance", 0], ["jump_boost", 1]]) h.eff(p, id, 1200, a);
      impactFx(dim, p.location, SAGE, 2.5);
      sfx(dim, "aegis.transform", p.location, 1.5, 0.8);
      showTitle(p, "§6Six Paths Sage Mode", { subtitle: "§7+25% damage · chakra regen ×2 · 60 seconds", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
      for (let t = 0; t < 1200; t += 40) later(t, () => api.isValid(p) && api.particle(p.dimension, "aegis:beast_aura", p.location, SAGE));
      return true;
    } },

    // ---------------------------------------------------------------- Madara's Heir
    "aegis:susanoo_v2_scroll": { title: "madara_heir", name: "Perfect Susanoo V2", cost: 160, cooldown: 1200, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.eye_activate");
      sfx(dim, "aegis.transform", p.location, 1.6, 0.6);
      impactFx(dim, p.location, MADARA, 2.5);
      shake(dim, p.location, 1, 1, 24);
      // the first sweep of the great blade
      later(6, () => {
        if (!api.isValid(p)) return;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          api.particle(dim, "aegis:susanoo_flame", api.add(p.location, { x: Math.cos(a) * 6, y: 1, z: Math.sin(a) * 6 }), MADARA);
        }
        for (const e of h.foesNear(p, p.location, 9)) {
          api.hurt(e, 30, p);
          const away = api.norm({ x: e.location.x - p.location.x, y: 0, z: e.location.z - p.location.z });
          api.knockback(e, away.x, away.z, 3, 0.6);
        }
      });
      h.susanooFor(p, 25, true);
      return true;
    } },
    "aegis:tengai_shinsei_scroll": { title: "madara_heir", name: "Tengai Shinsei", cost: 180, cooldown: 2400, cast(p) {
      const dim = p.dimension;
      const target = h.lookPoint(p, 40);
      const start = api.add(target, { x: -12, y: 36, z: -6 });
      api.anim(p, "animation.aegis.both_palms");
      sfx(dim, "aegis.edo_rumble", target, 3, 0.5);
      for (const q of dim.getPlayers({ location: target, maxDistance: 40 })) {
        showTitle(q, "§4Tengai Shinsei", { subtitle: q.id === p.id ? "§7the sky answers you" : "§7a meteor is falling — run!", fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 8 });
      }
      for (let k = 0; k <= 20; k++) {
        later(k * 2, () => {
          const at = api.add(start, api.scale(api.sub(target, start), k / 20));
          api.particle(dim, "aegis:cine_debris", at, [0.45, 0.35, 0.3]);
          api.particle(dim, "aegis:fire_trail", at, METEOR);
          if (k % 4 === 0) api.particle(dim, "aegis:lava_burst", at);
        });
      }
      later(42, () => {
        sfx(dim, "random.explode", target, 4, 0.4);
        impactFx(dim, target, METEOR, 4);
        shake(dim, target, 1.5, 1.5, 40);
        for (let k = 0; k < 3; k++) api.particle(dim, "minecraft:huge_explosion_emitter", api.add(target, { x: (k - 1) * 2.5, y: 1, z: (k % 2) * 2 - 1 }));
        api.particle(dim, "aegis:earth_burst", target);
        if (!api.isValid(p)) return;
        for (const e of h.foesNear(p, target, 9)) {
          api.hurt(e, 60, p, "fire");
          burn(e, 6);
          const away = api.norm({ x: e.location.x - target.x, y: 0, z: e.location.z - target.z });
          api.knockback(e, away.x, away.z, 4, 1);
        }
      });
      return true;
    } },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Right-click gear
// ---------------------------------------------------------------------------------------------------------------------
export function makeLegendSpecials(helpers, titleHelpers) {
  api = helpers;
  h = titleHelpers;
  return {
    // The Toad Sage — Sage Art: Frog Call, a croak that stuns everything around you
    "aegis:toad_contract"(p) {
      if (!h.ready(p, "toad_contract", 300)) return;
      const dim = p.dimension;
      api.anim(p, "animation.aegis.both_palms");
      api.sound(dim, "mob.frog.ambient", p.location, 3, 0.4);
      sfx(dim, "aegis.boom", p.location, 1.5, 0.7);
      for (let k = 0; k < 3; k++) later(k * 3, () => api.particle(dim, "aegis:cine_ring", p.location, TOAD));
      for (const e of h.foesNear(p, p.location, 10)) {
        api.hurt(e, 18, p, "magic");
        h.eff(e, "slowness", 60, 3);
        h.eff(e, "nausea", 100, 0);
        const away = api.norm({ x: e.location.x - p.location.x, y: 0, z: e.location.z - p.location.z });
        api.knockback(e, away.x, away.z, 1.5, 0.4);
      }
    },
    // The Slug Princess — Heavenly Foot of Pain: leap, then crash down heel-first
    "aegis:tsunade_necklace"(p) {
      if (!h.ready(p, "tsunade_necklace", 200)) return;
      const dim = p.dimension;
      const f = fwd(p);
      api.anim(p, "animation.aegis.earth_slam");
      api.knockback(p, f.x, f.z, 1.2, 1.1);
      sfx(dim, "aegis.leap", p.location, 1.3, 0.8);
      let landed = false;
      const slam = () => {
        if (landed || !api.isValid(p)) return;
        landed = true;
        const at = { ...p.location };
        impactFx(dim, at, HEAL, 2.5);
        shake(dim, at, 1.3, 0.8, 24);
        api.particle(dim, "aegis:earth_burst", at);
        api.particle(dim, "aegis:cine_debris", at, [0.5, 0.42, 0.34]);
        sfx(dim, "aegis.earth_break", at, 2, 0.7);
        for (const e of h.foesNear(p, at, 6)) {
          api.hurt(e, 26, p, "entityAttack", "fist");
          h.eff(e, "slowness", 40, 2);
          const away = api.norm({ x: e.location.x - at.x, y: 0, z: e.location.z - at.z });
          api.knockback(e, away.x, away.z, 2.5, 0.7);
        }
      };
      for (let t = 6; t <= 30; t++) later(t, () => (t === 30 || p.isOnGround) && slam());
    },
    // The White Snake — the Kusanagi stretches twelve blocks and pierces everything in its line
    "aegis:long_kusanagi"(p) {
      if (!h.ready(p, "long_kusanagi", 120)) return;
      const dim = p.dimension;
      const o = p.getHeadLocation();
      const d = p.getViewDirection();
      api.anim(p, "animation.aegis.sword_thrust");
      sfx(dim, "aegis.slash", p.location, 1.4, 0.7);
      const hit = new Map();
      for (let i = 1; i <= 12; i += 0.75) {
        const at = api.add(o, api.scale(d, i));
        if (i % 1.5 < 0.75) api.particle(dim, "aegis:slash", at, SNAKE);
        try {
          for (const e of dim.getEntities({ location: at, maxDistance: 1.3 })) if (api.canBeHit(e, p)) hit.set(e.id, e);
        } catch {
          /* ignore */
        }
      }
      for (const e of hit.values()) {
        api.hurt(e, 22, p);
        h.eff(e, "poison", 80, 1);
        h.eff(e, "slowness", 40, 1);
      }
    },
    // The Yellow Flash — throw the marked kunai, and be where it lands
    "aegis:minato_kunai"(p) {
      if (!h.ready(p, "aegis:minato_kunai", 160)) return; // (half that for the Yellow Flash)
      const dim = p.dimension;
      const d = p.getViewDirection();
      api.anim(p, "animation.aegis.throw_overhead");
      api.sound(dim, "random.bow", p.location, 1, 1.4);
      api.launchProjectile(p, api.add(p.getHeadLocation(), d), d, {
        noOrb: true, speed: 2.2, maxAge: 18, damage: 6, radius: 1.2, knock: 0.2, fire: 0,
        trail: "aegis:slash", burst: "aegis:lightning_burst", color: FLASH, hitRadius: 1.1, power: 0.3, sound: "aegis.whoosh",
        onExplode: (pos, dm, caster) => {
          if (!api.isValid(caster) || caster.dimension.id !== dm.id) return;
          const spot = safeSpot(dm, api.sub(pos, api.scale(d, 0.6)), caster.location);
          if (!spot) return;
          api.particle(dm, "aegis:cine_bolt", up(caster.location), FLASH);
          warp(caster, spot);
          h.noteTeleport(caster);
          api.particle(dm, "aegis:cine_bolt", up(spot), FLASH);
          api.particle(dm, "aegis:cine_ring", spot, FLASH);
          sfx(dm, "aegis.slash", spot, 1.3, 1.3);
          for (const e of h.foesNear(caster, spot, 3.5)) {
            api.particle(dm, "aegis:slash", up(e.location, 1.2), FLASH);
            api.hurt(e, 14, caster);
          }
        } });
    },
    // The Green Beast — Dynamic Entry
    "aegis:guy_nunchaku"(p) {
      if (!h.ready(p, "guy_nunchaku", 100)) return;
      const dim = p.dimension;
      api.anim(p, "animation.aegis.dynamic_entry");
      sfx(dim, "aegis.leap", p.location, 1.3, 1.1);
      api.lungeStrike(p, { power: 3.8, range: 2.6, ticks: 12,
        trail: () => api.particle(dim, "aegis:dust", p.location),
        onHit: (t) => {
          const f = fwd(p);
          api.hurt(t, 20, p, "entityAttack", "fist");
          api.knockback(t, f.x, f.z, 3, 0.6);
          impactFx(dim, t.location, BEAST, 1.5);
          sfx(dim, "aegis.hit_heavy", t.location, 1.5, 0.8);
        } });
    },
    // The Copy Ninja — Icha Icha Tactics: 30 seconds of insight (−50% chakra, −30% cooldowns)
    "aegis:icha_icha"(p) {
      if (!h.ready(p, "icha_icha", 1800)) return;
      h.setInsight(p, 600);
      api.sound(p.dimension, "item.book.page_turn", p.location, 1.2, 1);
      api.particle(p.dimension, "aegis:cine_ring", p.location, [1, 0.55, 0.7]);
      showTitle(p, "§aIcha Icha Tactics", { subtitle: "§7insight — jutsu cost half the chakra and recharge 30% faster for 30 s", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 8 });
    },
    // The Sage of Six Paths — the Shakujō drags every enemy in, then the pull detonates
    "aegis:six_paths_staff"(p) {
      if (!h.ready(p, "six_paths_staff", 200)) return;
      const dim = p.dimension;
      const f = fwd(p);
      const core = api.add(p.location, { x: f.x * 6, y: 1.5, z: f.z * 6 });
      api.anim(p, "animation.aegis.sword_raise");
      sfx(dim, "aegis.pull", core, 1.6, 0.6);
      for (let t = 0; t <= 20; t += 2) {
        later(t, () => {
          api.particle(dim, "aegis:beast_mist", core, ORB);
          if (!api.isValid(p)) return;
          for (const e of h.foesNear(p, core, 12)) {
            const to = api.norm({ x: core.x - e.location.x, y: 0, z: core.z - e.location.z });
            api.knockback(e, to.x, to.z, 0.8, 0.15);
          }
        });
      }
      later(24, () => {
        api.sound(dim, "random.explode", core, 1.5, 0.7);
        impactFx(dim, core, SAGE, 2);
        if (!api.isValid(p)) return;
        for (const e of h.foesNear(p, core, 4)) api.hurt(e, 24, p);
      });
    },
    // Madara's Heir — Uchiha Flame Formation: a ring of fire bursts out around you
    "aegis:gunbai_v2"(p) {
      if (!h.ready(p, "gunbai_v2", 160)) return;
      const dim = p.dimension;
      api.anim(p, "animation.aegis.sword_spin");
      sfx(dim, "aegis.fire_roar", p.location, 1.6, 0.8);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        for (const r of [3.5, 7]) api.particle(dim, r > 4 ? "aegis:cine_flame" : "aegis:fire_burst", api.add(p.location, { x: Math.cos(a) * r, y: 0.6, z: Math.sin(a) * r }), FIRE);
      }
      for (const e of h.foesNear(p, p.location, 7)) {
        api.hurt(e, 18, p, "fire");
        burn(e, 4);
        const away = api.norm({ x: e.location.x - p.location.x, y: 0, z: e.location.z - p.location.z });
        api.knockback(e, away.x, away.z, 2, 0.5);
      }
    },
  };
}

