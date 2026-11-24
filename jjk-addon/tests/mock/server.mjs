// A mock of @minecraft/server 1.16.0 — just enough of the world for Jujutsu Legacy's scripts.
const subs = {};
const ev = (n) => ({ subscribe: (f) => { (subs[n] ||= []).push(f); return f; }, unsubscribe() {} });
const proxy = (pre) => new Proxy({}, { get: (_, k) => ev(pre + String(k)) });
export const __subs = subs;
const wprops = {};
export const world = {
  afterEvents: proxy("w."), beforeEvents: proxy("wb."),
  getAllPlayers: () => (globalThis.H?.players ?? []).filter((p) => p._valid),
  sendMessage: (m) => globalThis.H?.worldMsgs.push(String(m)),
  getDynamicProperty: (k) => wprops[k],
  setDynamicProperty: (k, v) => { if (v === undefined) delete wprops[k]; else wprops[k] = v; },
  getEntity: (id) => globalThis.H?.entities.find((e) => e.id === id && e._valid),
  getDimension: (id) => globalThis.H?.dim(id),
  getTimeOfDay: () => globalThis.H?.time ?? 1000,
  gameRules: { pvp: true },
};
export const system = {
  currentTick: 0, afterEvents: proxy("s."), beforeEvents: proxy("sb."), _intervals: [], _timeouts: [], _nextId: 1,
  runInterval(f, per = 1) { const id = this._nextId++; this._intervals.push({ id, f, per: Math.max(1, per || 1) }); return id; },
  runTimeout(f, d = 1) { const id = this._nextId++; this._timeouts.push({ id, f, at: this.currentTick + Math.max(1, d || 1) }); return id; },
  run(f) { return this.runTimeout(f, 1); },
  clearRun(id) { this._intervals = this._intervals.filter((i) => i.id !== id); this._timeouts = this._timeouts.filter((t) => t.id !== id); },
};
export class ItemStack { constructor(t, n = 1) { this.typeId = t.includes(":") ? t : "minecraft:" + t; this.amount = n; this.lockMode = "none"; this.keepOnDeath = false; } }
export const ItemLockMode = { inventory: "inventory", slot: "slot", none: "none" };
export class MolangVariableMap { constructor() { this.v = {}; } setColorRGB(k, c) { this.v[k] = c; } setFloat(k, x) { if (typeof x !== "number" || Number.isNaN(x)) throw new Error("setFloat " + k + " " + x); this.v[k] = x; } }
