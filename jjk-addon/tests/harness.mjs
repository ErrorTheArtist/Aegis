// Test world for the mock tests: entities with health, effects, hurt cooldowns and inventories; after-events are
// queued and delivered at the end of each tick (like the game); tick(n) runs intervals and timeouts.
import { system, world, __subs, ItemStack } from "@minecraft/server";
import { readFileSync, existsSync } from "node:fs";
export { answers } from "@minecraft/server-ui";
export const H = (globalThis.H = { players: [], entities: [], worldMsgs: [], particles: [], sounds: [], drops: [], blocks: new Map(), time: 1000, dims: {}, queue: [], cmds: [] });
const BASE = 1_700_000_000_000;
Date.now = () => BASE + system.currentTick * 50;
const FAM = (t) => t === "minecraft:player" ? ["player", "mob"]
  : /jjk:(fly_head|lanky_curse|mouth_curse|eye_curse|finger_bearer)/.test(t) ? ["curse", "monster", "mob"]
  : /divine_dog/.test(t) ? ["shikigami", "mob"]
  : t === "jjk:mahoraga" ? ["mahoraga", "special_grade", "monster", "mob"]
  : /jjk:(orb|domain_dome|shrine|nue|max_elephant)/.test(t) ? ["jjk_fx"]
  : /zombie|skeleton/.test(t) ? ["monster", "mob"] : ["mob"];
const MAXHP = { "minecraft:player": 20, "jjk:fly_head": 14, "jjk:lanky_curse": 30, "jjk:mouth_curse": 70, "jjk:eye_curse": 180, "jjk:finger_bearer": 1500,
  "minecraft:zombie": 20, "jjk:divine_dog_white": 40, "jjk:divine_dog_black": 40, "minecraft:iron_golem": 100, "jjk:mahoraga": 1600 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
// the real behaviour file of the character NPCs: its "jjk:as_<who>" events apply their component groups here
const SORC_BP = process.env.JJK_ROOT && existsSync(`${process.env.JJK_ROOT}/behavior_pack/entities/sorcerer.json`)
  ? JSON.parse(readFileSync(`${process.env.JJK_ROOT}/behavior_pack/entities/sorcerer.json`, "utf8"))["minecraft:entity"] : null;
function applyEvent(e, x) {
  if (!SORC_BP || e.typeId !== "jjk:sorcerer") return;
  const ev = SORC_BP.events[x];
  if (!ev) return;
  for (const [k, v] of Object.entries(ev.set_property ?? {})) if (typeof v === "number") e._props["P:" + k] = v;
  for (const g of ev.add?.component_groups ?? []) {
    const grp = SORC_BP.component_groups[g] ?? {};
    if (grp["minecraft:health"]) { e._max = grp["minecraft:health"].max; e._hp = grp["minecraft:health"].value; }
    if (grp["minecraft:type_family"]) e._families = grp["minecraft:type_family"].family;
    if (grp["minecraft:movement"]?.value === 0) e._stay = true;
  }
}
let nid = 0;
const now = () => system.currentTick;
export function mkEntity(typeId, loc, dimId = "minecraft:overworld") {
  const e = {
    id: "e" + ++nid, typeId, location: { ...loc }, _valid: true, _props: {}, _tags: new Set(), _effects: {}, _families: FAM(typeId), nameTag: "",
    _hp: MAXHP[typeId] ?? 20, _max: MAXHP[typeId] ?? 20, _rot: { x: 0, y: 0 }, _view: { x: 0, y: 0, z: 1 }, _anims: [], _events: [], _kb: [], _dmgLog: [],
    _lastHurt: -99, _lastDmg: 0, _dim: dimId, _fire: 0, _cmds: [],
    get dimension() { return H.dim(this._dim); },
    isValid() { return this._valid; },
    getComponent(c) {
      if (c === "minecraft:health") {
        return { get currentValue() { return e._hp; }, get effectiveMax() { return e._max + (e.getEffect("health_boost") ? 4 * (e._effects.health_boost.amplifier + 1) : 0); },
          setCurrentValue(v) { e._hp = Math.max(0, Math.min(this.effectiveMax, v)); return true; }, resetToMaxValue() { e._hp = this.effectiveMax; } };
      }
      if (c === "minecraft:inventory" && e._inv) return { container: e._inv };
      if (c === "minecraft:tameable" && /divine_dog/.test(e.typeId)) return { tame: (p) => { e._owner = p.id; e._events.push("jjk:tamed"); return true; } };
      if (c === "minecraft:type_family") return { hasTypeFamily: (f) => e._families.includes(f) };
      return undefined;
    },
    getDynamicProperty: (k) => e._props[k],
    setDynamicProperty: (k, v) => { if (v === undefined) delete e._props[k]; else e._props[k] = v; },
    addTag: (t) => e._tags.add(t), removeTag: (t) => e._tags.delete(t), hasTag: (t) => e._tags.has(t), getTags: () => [...e._tags],
    addEffect(id, dur, o = {}) { e._effects[id] = { amplifier: o.amplifier ?? 0, until: now() + dur }; return true; },
    getEffect(id) { const x = e._effects[id]; return x && x.until > now() ? { amplifier: x.amplifier, duration: x.until - now(), typeId: id } : undefined; },
    removeEffect(id) { delete e._effects[id]; return true; },
    applyDamage(amount, opts = {}) {
      if (!e._valid || e._hp <= 0) return false;
      let a = amount;
      const r = e.getEffect("resistance");
      if (r) a *= Math.max(0, 1 - 0.2 * (r.amplifier + 1));
      let applied = a;
      // Bedrock's hurt cooldown: for 10 ticks after a hit only damage above that hit's lands (the difference); after that, a new window
      if (now() - e._lastHurt < 10) { if (a <= e._lastDmg) return false; applied = a - e._lastDmg; e._lastDmg = a; }
      else { e._lastHurt = now(); e._lastDmg = a; }
      e._hp -= applied;
      e._dmgLog.push({ amount, applied, by: opts.damagingEntity?.id, cause: opts.cause, tick: now() });
      const src = { cause: opts.cause ?? "none", damagingEntity: opts.damagingEntity };
      H.queue.push(["w.entityHurt", { hurtEntity: e, damageSource: src, damage: applied }]);
      if (e._hp <= 0) { e._hp = 0; H.queue.push(["w.entityDie", { deadEntity: e, damageSource: src }]); if (e.typeId !== "minecraft:player") e._valid = false; }
      return true;
    },
    applyKnockback(dx, dz, h, v) { e._kb.push([dx, dz, h, v]); },
    teleport(l, o) { e.location = { ...l }; if (o?.rotation) e._rot = o.rotation; },
    remove() { e._valid = false; },
    triggerEvent(x) { e._events.push(x); applyEvent(e, x); },
    getProperty(k) { return e._props["P:" + k]; }, setProperty(k, v) { e._props["P:" + k] = v; },
    playAnimation(a) { e._anims.push(a.replace("animation.jjk.", "")); },
    setOnFire(s) { e._fire = s; return true; },
    runCommand(c) { e._cmds.push(c); H.cmds.push([e.id, c, now()]); return { successCount: 1 }; },
    getViewDirection: () => e._view, getHeadLocation: () => ({ x: e.location.x, y: e.location.y + 1.62, z: e.location.z }), getRotation: () => e._rot,
    getEntitiesFromViewDirection(o = {}) {
      const from = e.getHeadLocation(); const d = e._view; const out = [];
      for (const t of H.entities) {
        if (!t._valid || t === e || t._families.includes("jjk_fx") || t._dim !== e._dim) continue;
        const m = { x: t.location.x, y: t.location.y + 0.9, z: t.location.z };
        const v = { x: m.x - from.x, y: m.y - from.y, z: m.z - from.z };
        const along = v.x * d.x + v.y * d.y + v.z * d.z;
        if (along < 0 || along > (o.maxDistance ?? 64)) continue;
        const off = Math.hypot(v.x - d.x * along, v.y - d.y * along, v.z - d.z * along);
        if (off < 0.9) out.push({ entity: t, distance: along });
      }
      return out.sort((a, b) => a.distance - b.distance);
    },
  };
  return e;
}
export function mkPlayer(name, loc = { x: 0, y: 64, z: 0 }) {
  const p = mkEntity("minecraft:player", loc);
  const slots = Array(36).fill(undefined);
  p.name = name; p.isSneaking = false; p.selectedSlotIndex = 0; p._msgs = []; p._bars = []; p._titles = []; p._cds = {}; p._mode = "survival";
  p._inv = { size: 36, getItem: (i) => slots[i], setItem: (i, v) => { slots[i] = v; }, addItem: (s) => { const i = slots.indexOf(undefined); if (i < 0) return s; slots[i] = s; return undefined; }, _slots: slots };
  p.sendMessage = (m) => p._msgs.push(String(m));
  p.onScreenDisplay = { setActionBar: (t) => p._bars.push(String(t)), setTitle: (t, o) => p._titles.push(`${t} | ${o?.subtitle ?? ""}`) };
  p.getGameMode = () => p._mode; p.startItemCooldown = (c, t) => { p._cds[c] = t; }; p.isOp = () => false;
  H.players.push(p); H.entities.push(p);
  return p;
}
export function spawn(typeId, loc) { const e = mkEntity(typeId, loc); H.entities.push(e); return e; }
H.dim = (id = "minecraft:overworld") => (H.dims[id] ||= {
  id,
  getEntities(o = {}) {
    return H.entities.filter((e) => e._valid && e._dim === id && (!o.location || o.maxDistance === undefined || dist(e.location, o.location) <= o.maxDistance)
      && (!o.type || o.type === e.typeId) && (!o.families || o.families.every((f) => e._families.includes(f)))
      && (!o.excludeFamilies || !o.excludeFamilies.some((f) => e._families.includes(f))) && (!o.tags || o.tags.every((t) => e._tags.has(t))));
  },
  getPlayers: (o = {}) => H.players.filter((p) => p._valid && p._dim === id && (!o.location || o.maxDistance === undefined || dist(p.location, o.location) <= o.maxDistance)),
  spawnEntity(t, l) { const e = mkEntity(t, l, id); H.entities.push(e); return e; },
  spawnParticle(pid, l, m) { H.particles.push({ id: pid, l, v: m?.v }); },
  playSound(s) { H.sounds.push(s); },
  spawnItem(stack) { H.drops.push(stack.typeId); return {}; },
  getBlock(l) { const k = `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`; const t = H.blocks.get(k) ?? (Math.floor(l.y) < 64 ? "minecraft:stone" : "minecraft:air");
    return { typeId: t, isAir: t === "minecraft:air", isLiquid: false, setType(nt) { H.blocks.set(k, nt); } }; },
});
export async function flushEvents() {
  for (let guard = 0; H.queue.length && guard < 5000; guard++) {
    const [n, ev] = H.queue.shift();
    for (const f of __subs[n] ?? []) f(ev);
  }
}
export async function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    system.currentTick++;
    for (const it of [...system._intervals]) if (system.currentTick % it.per === 0) it.f();
    const due = system._timeouts.filter((t) => t.at <= system.currentTick);
    system._timeouts = system._timeouts.filter((t) => t.at > system.currentTick);
    for (const t of due) t.f();
    await flushEvents();
    await new Promise((r) => setImmediate(r));
  }
}
export async function fire(name, ev) { for (const f of __subs[name] ?? []) f(ev); await flushEvents(); await new Promise((r) => setImmediate(r)); }
export async function use(p, item) { await fire("w.itemUse", { source: p, itemStack: new ItemStack(item) }); }
export async function melee(p, t, dmg = 5) { t.applyDamage(dmg, { cause: "entityAttack", damagingEntity: p }); await flushEvents(); }
export function inv(p) { return p._inv._slots.filter(Boolean).map((s) => s.typeId); }
export const hp = (e) => Math.round(e._hp * 100) / 100;
let fails = 0;
export function check(label, cond, extra = "") { if (cond) console.log("ok  ", label); else { fails++; console.log("FAIL", label, extra); } }
export function done() { console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exitCode = fails ? 1 : 0; }
export { system, world };
