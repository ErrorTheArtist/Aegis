// Mahoraga — the Eight-Handled Sword Divergent Sila Divine General, the strongest shikigami of the Ten Shadows.
//
// No one has ever tamed it. A Ten Shadows sorcerer of Special Grade can try: the ritual (the technique's fifth move)
// calls Mahoraga out as a wild boss — 1600 health, a boss bar — that attacks everyone near it, its summoner first.
// Beat it ALONE and it's yours: from then on the same move calls it to fight beside you for 40 s. If anyone else lands
// a blow (another player, an NPC, someone else's shikigami) the ritual is void: Mahoraga can still be exorcised, but
// not tamed. If the summoner dies, leaves or runs (64 blocks), the ritual ends and Mahoraga sinks back into the shadows.
// Admins can call a wild one with /scriptevent jjk:mahoraga (no ritual: nobody can tame that one).
//
// Adaptation: Mahoraga adapts to whatever hurts it. Every kind of attack is counted on its own — each innate technique,
// melee (fists, swords, cursed tools), domain sure-hits, shikigami, arrows, fire... After enough damage of one kind the
// wheel over its head turns with a clang, Mahoraga heals 4%, and that kind does less from then on:
// 100% -> 65% -> 40% -> 20% -> 5% (fully adapted). Switch it up — or finish it before it adapts.
// Its own attacks: a sweep of the Sword of Extermination every few seconds (double against curses, +50% against a
// sorcerer whose technique it has fully adapted to) and a leap at anyone who keeps their distance. Below half health it
// moves faster and swings more often. (The model and the wheel: tools/gen_entities.py; jjk:turn turns the wheel.)

import { world, system, ItemStack } from "@minecraft/server";
import {
  getProp, setProp, isPlayer, alive, valid, health, fx, fxMust, shake, sound, mid, V, knock, effect, COLOR, foes, byId, tell, title, bar, ground, now,
  sideOf, look, tp, anim, nameOf, later,
} from "./core.js";
import { hurt, lastHit } from "./combat.js";
import { addXp } from "./grades.js";

export const MAHORAGA = "jjk:mahoraga";
export const ADAPT = [1, 0.65, 0.4, 0.2, 0.05]; // damage taken from a kind of attack, by how far it has adapted to it
export const STEP = 0.06; // (adapted) damage of one kind, as a share of its health, that turns the wheel — one more step each time
export const TAMED_TICKS = 800; // 40 s
const RITUAL_TICKS = 12000; // a ritual nobody finishes ends after 10 minutes

const names = {}; // technique id -> its name (techniques.js fills it in: no circular import)
export const nameKinds = (map) => Object.assign(names, map);
const FIXED = { melee: "fists and blades", domain: "domain sure-hits", shikigami: "shikigami", projectile: "arrows", fire: "fire",
  explosion: "explosions", magic: "magic" };

const family = (e, f) => {
  try {
    return !!e.getComponent("minecraft:type_family")?.hasTypeFamily(f);
  } catch {
    return false;
  }
};
const tagged = (e, t) => {
  try {
    return e.hasTag(t);
  } catch {
    return false;
  }
};

// What kind of attack a hit was, and what to call it: [kind, label].
export function kindOf(src, info) {
  const by = info?.caster ?? src?.damagingEntity;
  if (info?.how === "sure") return ["domain", FIXED.domain];
  if (info?.how === "technique" && by) {
    if (isPlayer(by)) {
      const t = getProp(by, "technique");
      return [t ?? "technique", names[t] ?? "a technique"];
    }
    if (by.typeId === "jjk:sorcerer") return [`npc:${getProp(by, "who")}`, `${nameOf(by)}§r's technique`];
    if (getProp(by, "owner")) return ["shikigami", FIXED.shikigami];
    return [by.typeId ?? "technique", "curses"];
  }
  if (by && !isPlayer(by) && getProp(by, "owner")) return ["shikigami", FIXED.shikigami];
  const cause = src?.cause ?? "none";
  if (cause === "entityAttack") return ["melee", FIXED.melee];
  if (cause === "projectile") return ["projectile", FIXED.projectile];
  if (/fire|lava/.test(cause)) return ["fire", FIXED.fire];
  if (/explosion/.test(cause)) return ["explosion", FIXED.explosion];
  if (/magic|wither/.test(cause)) return ["magic", FIXED.magic];
  return [cause, cause.replace(/_/g, " ")];
}

// ---------------------------------------------------------------------------
// State (kept in memory; who summoned or owns it is also kept on the entity)
// ---------------------------------------------------------------------------
const state = new Map(); // mahoraga id -> { kinds: { kind: { level, taken, label } }, turn, slash, leap, idle, summoner, owner, void, until }
function fresh(m) {
  const owner = getProp(m, "owner");
  return { kinds: {}, turn: 0, slash: now() + 60, leap: now() + 140, idle: 0, summoner: getProp(m, "summoner"), owner,
    void: getProp(m, "void", false), until: now() + (owner ? TAMED_TICKS : RITUAL_TICKS) };
}
export function stateOf(m) {
  let st = state.get(m.id);
  if (!st) state.set(m.id, (st = fresh(m)));
  return st;
}
export const adaptation = (m, kind) => stateOf(m).kinds[kind]?.level ?? 0;

// ---------------------------------------------------------------------------
// Adaptation
// ---------------------------------------------------------------------------
function heal(m, n) {
  try {
    const h = health(m);
    if (h && h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n));
  } catch {
    /* ignore */
  }
}

function onHurt(m, src, damage) {
  const st = stateOf(m);
  const raw = lastHit.get(m.id);
  const info = raw && now() - raw.tick <= 1 ? raw : undefined;
  const [kind, label] = kindOf(src, info);
  const k = (st.kinds[kind] ??= { level: 0, taken: 0, label });
  const f = ADAPT[k.level];
  if (f < 1) heal(m, damage * (1 - f)); // what it has adapted to, it shrugs off
  witness(m, st, info?.caster ?? src?.damagingEntity);
  if (k.level >= ADAPT.length - 1) return;
  k.taken += damage * f;
  const max = health(m)?.effectiveMax ?? 1600;
  if (k.taken >= max * STEP * (k.level + 1)) {
    k.taken = 0;
    k.level++;
    turnWheel(m, st, k);
  }
}

function turnWheel(m, st, k) {
  st.turn = (st.turn + 1) % 1000;
  try {
    m.setProperty("jjk:turn", st.turn);
  } catch {
    /* ignore */
  }
  const h = health(m);
  if (h) heal(m, h.effectiveMax * 0.04);
  const dim = m.dimension;
  const top = V.add(m.location, { x: 0, y: 4.6, z: 0 });
  fx(dim, "jjk:ring", top, COLOR.gold, 1.4);
  fx(dim, "jjk:spark", top, COLOR.gold, 1.2);
  fxMust(dim, "jjk:flash", top, COLOR.gold, 1.2); // (the wheel turning: hard to miss)
  shake(dim, m.location, 0.25, 0.4, 16);
  sound(dim, "random.anvil_land", m.location, 1, 0.55);
  sound(dim, "block.bell.hit", m.location, 1, 0.5);
  const full = k.level >= ADAPT.length - 1;
  const text = full ? `§6The wheel turns. §fMahoraga has §cfully adapted§f to ${k.label}§f.`
    : `§6The wheel turns. §7Mahoraga is adapting to §f${k.label}§7 — it now takes ${Math.round(ADAPT[k.level] * 100)}% from it.`;
  for (const p of nearPlayers(m, 40)) tell(p, text);
}

function nearPlayers(m, r) {
  try {
    return m.dimension.getEntities({ location: m.location, maxDistance: r, type: "minecraft:player" });
  } catch {
    return [];
  }
}

// The ritual is the summoner's alone: anyone else's blow makes it void.
function witness(m, st, by) {
  if (!st.summoner || st.void || !by) return;
  let who = by;
  if (!isPlayer(who)) {
    const o = getProp(who, "owner");
    if (o) who = { id: o };
  }
  if (who.id === st.summoner) return;
  st.void = true;
  setProp(m, "void", true);
  const p = byId(st.summoner);
  if (p) tell(p, "§7Someone else joined the fight — §cthe ritual is void§7. Mahoraga can't be tamed this time.");
}

// ---------------------------------------------------------------------------
// Fighting
// ---------------------------------------------------------------------------
// Who it swings at: a wild one, anything that fights (Jujutsu High keeps out of a ritual); a tamed one, its master's enemies.
function fighter(m, st, e) {
  if (e.typeId === MAHORAGA) return false;
  if (st.owner) {
    if (isPlayer(e) || sideOf(e) === "ally" || (getProp(e, "owner") && !tagged(e, "jjk_minion"))) return false;
    return family(e, "monster") || family(e, "curse") || sideOf(e) === "villain";
  }
  if (sideOf(e) === "ally") return false;
  return isPlayer(e) || e.typeId === "jjk:sorcerer" || family(e, "monster") || family(e, "shikigami") || family(e, "curse");
}

function sweep(m, st, hit, fwd, enraged) {
  st.slash = now() + (enraged ? 60 : 90);
  const dim = m.dimension;
  for (const e of hit) {
    let dmg = 12;
    if (family(e, "curse")) dmg *= 2; // the Sword of Extermination is positive energy: deadly to curses
    if (isPlayer(e) && adaptation(m, getProp(e, "technique")) >= ADAPT.length - 1) dmg *= 1.5; // it has your measure
    hurt(m, e, dmg, { flat: true });
    const d = V.flat(V.sub(e.location, m.location));
    knock(e, d.x, d.z, 1.2, 0.35);
  }
  fx(dim, "jjk:slash", V.add(m.location, { x: fwd.x * 2.2, y: 2.2, z: fwd.z * 2.2 }), COLOR.white, 2.4);
  sound(dim, "item.trident.throw", m.location, 1, 0.5);
}

function leap(m, st, t, enraged) {
  st.leap = now() + (enraged ? 140 : 200);
  const dim = m.dimension;
  const d = V.flat(V.sub(t.location, m.location));
  const land = ground(dim, { x: t.location.x - d.x * 2, y: t.location.y + 2, z: t.location.z - d.z * 2 }, 6);
  fx(dim, "jjk:smoke", m.location, COLOR.grey, 1.6);
  tp(m, land, { facingLocation: mid(t) });
  for (const e of foes(m, land, 4)) {
    if (!fighter(m, st, e)) continue;
    hurt(m, e, 8, { flat: true });
    const k = V.flat(V.sub(e.location, land));
    knock(e, k.x, k.z, 1, 0.6);
  }
  fx(dim, "jjk:ring", land, COLOR.white, 2.2);
  fx(dim, "jjk:smoke", land, COLOR.grey, 2);
  sound(dim, "random.explode", land, 0.8, 0.7);
}

function dismiss(m, st, why) {
  state.delete(m.id);
  const p = byId(st.owner ?? st.summoner);
  if (why && p) tell(p, why);
  try {
    fx(m.dimension, "jjk:smoke", m.location, COLOR.dark, 3);
    sound(m.dimension, "mob.wither.ambient", m.location, 0.8, 0.5);
    m.remove();
  } catch {
    /* ignore */
  }
}

function tick(m) {
  const st = stateOf(m);
  const dim = m.dimension;
  const master = st.owner ?? st.summoner;
  if (master) {
    const p = byId(master);
    const gone = !p || !alive(p) || p.dimension?.id !== dim.id || V.dist(p.location, m.location) > 64;
    if (gone || now() >= st.until) {
      return dismiss(m, st, st.owner ? "§7Mahoraga returns to your shadow." : gone ? "§7The ritual ends with its summoner: Mahoraga sinks back into the shadows."
        : "§7The ritual ran too long: Mahoraga sinks back into the shadows.");
    }
  } else {
    // a wild one nobody called: if no one comes near for a minute, it leaves
    st.idle = nearPlayers(m, 64).some((q) => alive(q)) ? 0 : st.idle + 10;
    if (st.idle >= 1200) return dismiss(m, st);
  }
  const h = health(m);
  const enraged = !st.owner && h && h.currentValue < h.effectiveMax * 0.5;
  if (enraged) effect(m, "speed", 30, 1);
  const near = foes(m, m.location, 22).filter((e) => fighter(m, st, e));
  if (!near.length) return;
  const dist = (e) => V.dist(e.location, m.location);
  if (now() >= st.slash) {
    const fwd = V.flat(look(m));
    const hit = near.filter((e) => {
      if (dist(e) > 5.5) return false;
      const to = V.flat(V.sub(e.location, m.location));
      return dist(e) < 2.5 || to.x * fwd.x + to.z * fwd.z > 0.1;
    });
    if (hit.length) sweep(m, st, hit, fwd, enraged);
  }
  if (now() >= st.leap) {
    const far = near.filter((e) => dist(e) >= 7 && dist(e) <= 20).sort((a, b) => dist(a) - dist(b))[0];
    if (far) leap(m, st, far, enraged);
  }
}

function onDeath(m, src) {
  const st = state.get(m.id) ?? fresh(m);
  state.delete(m.id);
  if (st.owner) return; // a tamed Mahoraga fell: it will answer the next call
  let k = src?.damagingEntity;
  if (k && !isPlayer(k)) {
    const o = getProp(k, "owner");
    k = o ? byId(o) : undefined;
  }
  let dim;
  let at;
  try {
    dim = m.dimension;
    at = { ...m.location };
    fx(dim, "jjk:burst", V.add(at, { x: 0, y: 2, z: 0 }), COLOR.white, 3);
    fx(dim, "jjk:smoke", at, COLOR.dark, 3);
    sound(dim, "mob.wither.death", at, 0.8, 0.7);
  } catch {
    /* ignore */
  }
  if (st.summoner && !st.void && isPlayer(k) && k.id === st.summoner) {
    setProp(k, "mahoraga", true);
    title(k, "§6§lMAHORAGA TAMED", "§fThe ritual is complete — it answers your call now", 80);
    tell(k, "§6✦ §fUse the ritual move again: Mahoraga fights beside you for 40 s.");
    addXp(k, 3000, "tamed Mahoraga");
    try {
      world.sendMessage(`§6✦ §f${k.name} has tamed the Divine General §6Mahoraga§f!`);
    } catch {
      /* ignore */
    }
    return;
  }
  if (!isPlayer(k)) return;
  addXp(k, 1500, "exorcised Mahoraga");
  try {
    world.sendMessage(`§6✦ §fThe Divine General Mahoraga was exorcised by ${k.name}.`);
    if (dim) dim.spawnItem(new ItemStack("jjk:cursed_womb", 1), at);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Calling it
// ---------------------------------------------------------------------------
// opts.summoner: a ritual (it attacks everyone; beaten by them alone, it's theirs). opts.owner: a tamed one, for 40 s.
export function spawnMahoraga(dim, at, opts = {}) {
  let m;
  try {
    m = dim.spawnEntity(MAHORAGA, at);
  } catch {
    return undefined;
  }
  if (opts.summoner) setProp(m, "summoner", opts.summoner.id);
  if (opts.owner) {
    setProp(m, "owner", opts.owner.id);
    const tameIt = () => {
      try {
        m.triggerEvent("jjk:tamed");
        m.nameTag = `§f${nameOf(opts.owner)}'s Mahoraga`;
        m.getComponent("minecraft:tameable")?.tame(opts.owner);
      } catch {
        /* ignore */
      }
    };
    tameIt();
    later(() => valid(m) && tameIt(), 2); // (again, in case its spawn event made it wild after the first one)
  }
  state.set(m.id, fresh(m));
  fx(dim, "jjk:shell", V.add(at, { x: 0, y: 2, z: 0 }), COLOR.shadow, 1.6, { radius: 5 });
  fx(dim, "jjk:smoke", at, COLOR.dark, 3);
  sound(dim, "mob.wither.spawn", at, 1, 0.6);
  sound(dim, "block.bell.hit", at, 1, 0.4);
  return m;
}

// The Ten Shadows' fifth move.
export function ritual(p) {
  for (const [id, st] of state) {
    if ((st.summoner === p.id || st.owner === p.id) && valid(byId(id))) {
      bar(p, "§cMahoraga is already here.");
      return false;
    }
  }
  const dim = p.dimension;
  const f = V.flat(look(p));
  const at = ground(dim, { x: p.location.x + f.x * 6, y: p.location.y + 2, z: p.location.z + f.z * 6 }, 8);
  anim(p, "summon");
  if (getProp(p, "mahoraga", false)) {
    if (!spawnMahoraga(dim, at, { owner: p })) return false;
    title(p, "§f§lMAHORAGA", "§7The Divine General fights beside you", 40);
    return true;
  }
  if (!spawnMahoraga(dim, at, { summoner: p })) return false;
  title(p, "§f§lWITH THIS TREASURE I SUMMON", "§7Eight-Handled Sword Divergent Sila Divine General §fMahoraga", 60);
  tell(p, "§6The exorcism ritual has begun. §7Beat Mahoraga §falone§7 and it's yours — if anyone else lands a blow, the ritual is void.");
  try {
    world.sendMessage(`§6✦ §f${p.name} §7has begun the Ten Shadows ritual: §fMahoraga§7 has appeared!`);
  } catch {
    /* ignore */
  }
  return true;
}

export function initMahoraga() {
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
    if (hurtEntity?.typeId !== MAHORAGA || !(damage > 0)) return;
    try {
      onHurt(hurtEntity, damageSource, damage);
    } catch {
      /* ignore */
    }
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (deadEntity?.typeId !== MAHORAGA) return;
    try {
      onDeath(deadEntity, damageSource);
    } catch {
      /* ignore */
    }
  });
  system.runInterval(() => {
    for (const id of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
      let list = [];
      try {
        list = world.getDimension(id).getEntities({ type: MAHORAGA });
      } catch {
        continue;
      }
      for (const m of list) {
        if (!valid(m)) continue;
        try {
          tick(m);
        } catch {
          /* ignore */
        }
      }
    }
  }, 10);
}
export const _state = { state, onHurt, tick };
