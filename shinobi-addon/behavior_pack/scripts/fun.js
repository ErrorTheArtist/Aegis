// Fun & games (v1.63).
//   Hit combos      — every hit you land within 2.5 s of the last one counts; the counter shows on your action bar
//                     (10, 25, 50 and 100 hits get a callout). Just for the thrill — there's nothing to farm.
//   Kill streaks    — defeat enemies within 6 s of each other: Double Kill, Triple Kill, Quadra Kill, Ninja Rampage
//                     (5), Unstoppable (8), Legendary Shinobi (12). From the second kill on, every kill of the streak
//                     pays +10% XP per step (+100% at most); Legendary Shinobi also drops a Mystery Scroll.
//   Backstab        — melee from behind an enemy hits 25% harder (m1.js).
//   Mystery Scroll  — right-click to unroll it: a random reward (Ryō, XP Shards, a jutsu scroll, ramen, ninja tools…
//                     rarely a Bloodline Reroll Scroll or a jackpot).
//   Treasure Toad   — every 6–10 minutes a golden toad hops out near someone and runs for it. Catch it within a minute:
//                     Ryō, a Mystery Scroll and maybe an XP Shard.
//   Eating contest  — Ramen Shop → Eating Contest: as many bowls as you can in 30 seconds. Prizes, a personal best and
//                     a server record.
//   Emotes          — Shinobi Record → Fun & Games → Emotes.
//   A Thousand Years of Death — the Jutsu Sensei's prank jutsu.
// Rewards follow the server's economy (questRyo / price). Admins switch the toads and the streak callouts off in
// Server Settings.
//   /scriptevent aegis:fun                 — your fun stats
//   /scriptevent aegis:fun toad            — a Treasure Toad near you (admins)
//   /scriptevent aegis:fun mystery [n]     — Mystery Scrolls (admins)

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { addRyo, fmtRyo, questRyo, price } from "./currency.js";
import { giveShards } from "./xpshards.js";
import { gainXp } from "./levels.js";
import { isEcho } from "./dmgutil.js";
import { movementOn } from "./movement.js";

export const MYSTERY = "aegis:mystery_scroll";
export const CONTEST_RAMEN = "aegis:contest_ramen";
export const TOAD = "aegis:treasure_toad";
export const CONTEST_SECONDS = 30;
const STATS = "aegis:fun"; // player: { toads, bowls, bells, streak, combo, contests, scrolls }
const RECORD = "aegis:ramen_record"; // world: { name, bowls }
const TOADS_OFF = "aegis:toads_off";
const CALLS_OFF = "aegis:streak_calls_off";
const ENEMY = new Set(["aegis:hostile_ninja", "aegis:akatsuki", "aegis:legend", "aegis:juubi",
  ...["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"].map((b) => `aegis:${b}`)]);

let api;

// ---------------------------------------------------------------------------
// Settings and stats
// ---------------------------------------------------------------------------
export const toadsOn = () => world.getDynamicProperty(TOADS_OFF) !== true;
export const setToads = (on) => world.setDynamicProperty(TOADS_OFF, on ? undefined : true);
export const streakCallsOn = () => world.getDynamicProperty(CALLS_OFF) !== true;
export const setStreakCalls = (on) => world.setDynamicProperty(CALLS_OFF, on ? undefined : true);

export function funStats(p) {
  try {
    return { toads: 0, bowls: 0, bells: 0, streak: 0, combo: 0, contests: 0, scrolls: 0, ...JSON.parse(p.getDynamicProperty(STATS) ?? "{}") };
  } catch {
    return { toads: 0, bowls: 0, bells: 0, streak: 0, combo: 0, contests: 0, scrolls: 0 };
  }
}
export function bumpFun(p, key, by = 1, best = false) {
  const s = funStats(p);
  s[key] = best ? Math.max(s[key] ?? 0, by) : (s[key] ?? 0) + by;
  try {
    p.setDynamicProperty(STATS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s[key];
}
export function ramenRecord() {
  try {
    return JSON.parse(world.getDynamicProperty(RECORD) ?? "null");
  } catch {
    return null;
  }
}

function give(p, id, n = 1) {
  let left = new ItemStack(id, n);
  try {
    left = p.getComponent("minecraft:inventory")?.container?.addItem(left);
  } catch {
    /* fall through: drop it */
  }
  if (left) {
    try {
      p.dimension.spawnItem(left, p.location);
    } catch {
      /* ignore */
    }
  }
}
function takeAll(p, id) {
  let n = 0;
  try {
    const inv = p.getComponent("minecraft:inventory")?.container;
    for (let i = 0; i < (inv?.size ?? 0); i++) {
      const it = inv.getItem(i);
      if (it?.typeId !== id) continue;
      n += it.amount;
      inv.setItem(i, undefined);
    }
  } catch {
    /* ignore */
  }
  return n;
}
function useHeld(p, id) {
  try {
    const inv = p.getComponent("minecraft:inventory")?.container;
    const it = inv?.getItem(p.selectedSlotIndex);
    if (it?.typeId !== id) return false;
    if (it.amount > 1) {
      it.amount -= 1;
      inv.setItem(p.selectedSlotIndex, it);
    } else inv.setItem(p.selectedSlotIndex, undefined);
    return true;
  } catch {
    return false;
  }
}
const ownerOf = (e) => {
  if (!e) return undefined;
  if (e.typeId === "minecraft:player") return e;
  try {
    const o = world.getEntity(e.getDynamicProperty("aegis:owner"));
    return o?.typeId === "minecraft:player" ? o : undefined;
  } catch {
    return undefined;
  }
};

// ---------------------------------------------------------------------------
// Hit combos
// ---------------------------------------------------------------------------
const combos = new Map(); // player id -> { n, tick }
const COMBO_GAP = 50;
const comboColor = (n) => (n >= 50 ? "§d" : n >= 25 ? "§c" : n >= 10 ? "§6" : "§e");
export function noteHit(p) {
  const now = system.currentTick;
  const c = combos.get(p.id);
  const n = c && now - c.tick <= COMBO_GAP ? c.n + 1 : 1;
  combos.set(p.id, { n, tick: now });
  if (n >= 3) p.onScreenDisplay?.setActionBar(`${comboColor(n)}§l${n} HIT COMBO`);
  if (n === 10 || n === 25 || n === 50 || n === 100) {
    api.sound(p.dimension, "random.orb", p.location, 1, 0.8 + Math.min(0.8, n / 100));
    api.particle(p.dimension, "aegis:cine_ring", p.location, [1, 0.85, 0.3]);
  }
  if (n >= 5 && n % 5 === 0 && n > funStats(p).combo) bumpFun(p, "combo", n, true);
  return n;
}
export const comboOf = (p) => {
  const c = combos.get(p.id);
  return c && system.currentTick - c.tick <= COMBO_GAP ? c.n : 0;
};

// ---------------------------------------------------------------------------
// Kill streaks
// ---------------------------------------------------------------------------
const streaks = new Map(); // player id -> { n, tick, crowned }
const STREAK_GAP = 120;
export const CALLS = { 2: "§eDouble Kill!", 3: "§6Triple Kill!", 4: "§cQuadra Kill!", 5: "§4Ninja Rampage!", 8: "§5Unstoppable!", 12: "§dLegendary Shinobi!" };
function isEnemy(e) {
  if (ENEMY.has(e.typeId)) return true;
  try {
    return !!e.matches?.({ families: ["monster"] });
  } catch {
    return false;
  }
}
function killXp(e) {
  try {
    if (e.getDynamicProperty("aegis:no_xp")) return 0;
    return Math.max(2, Math.round(e.getComponent("minecraft:health").effectiveMax * 3));
  } catch {
    return 5;
  }
}
export function noteKill(p, dead) {
  const now = system.currentTick;
  const s = streaks.get(p.id);
  const n = s && now - s.tick <= STREAK_GAP ? s.n + 1 : 1;
  const crowned = s && n > 1 ? s.crowned : false;
  streaks.set(p.id, { n, tick: now, crowned });
  if (n < 2) return n;
  const bonus = Math.round(killXp(dead) * Math.min(1, 0.1 * (n - 1)));
  if (bonus > 0) gainXp(p, bonus, true);
  const call = CALLS[n];
  if (call) {
    if (n >= 5) showTitle(p, `§l${call}`, { subtitle: `§7${n} in a row · +${Math.min(100, (n - 1) * 10)}% XP`, fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 8 });
    else p.onScreenDisplay?.setActionBar(`§l${call}§r §7+${(n - 1) * 10}% XP`);
    api.sound(p.dimension, n >= 5 ? "random.levelup" : "random.orb", p.location, 0.8, 0.9 + n * 0.05);
  } else if (n > 12 && n % 5 === 0) p.onScreenDisplay?.setActionBar(`§d§l${n} KILL STREAK`);
  if (n === 12 && !crowned) {
    streaks.get(p.id).crowned = true;
    give(p, MYSTERY);
    p.sendMessage("§dLegendary Shinobi! §7Twelve in a row — a §dMystery Scroll§7 is yours.");
    if (streakCallsOn()) world.sendMessage(`§d§l${p.name}§r§d is a Legendary Shinobi — 12 enemies in a row!`);
  }
  if (n > funStats(p).streak) bumpFun(p, "streak", n, true);
  return n;
}

// ---------------------------------------------------------------------------
// Backstab (m1.js): melee from behind hits 25% harder
// ---------------------------------------------------------------------------
export function backstabMultiplier(attacker, target) {
  if (attacker?.typeId !== "minecraft:player" || !target || target.id === attacker.id) return 1;
  try {
    const v = target.getViewDirection();
    const to = { x: attacker.location.x - target.location.x, z: attacker.location.z - target.location.z };
    const l = Math.hypot(to.x, to.z);
    const lv = Math.hypot(v.x, v.z);
    if (l < 0.01 || lv < 0.01) return 1;
    if ((v.x * to.x + v.z * to.z) / (l * lv) > -0.5) return 1; // not behind (within 120° of where it's looking)
  } catch {
    return 1;
  }
  attacker.onScreenDisplay?.setActionBar("§c§lBackstab! §r§7+25%");
  api.particle(attacker.dimension, "aegis:slash", { x: target.location.x, y: target.location.y + 1.2, z: target.location.z }, [0.9, 0.2, 0.2]);
  return 1.25;
}

// ---------------------------------------------------------------------------
// Mystery Scrolls
// ---------------------------------------------------------------------------
const JUTSU_POOL = ["aegis:fireball_scroll", "aegis:water_dragon_scroll", "aegis:wind_scroll", "aegis:chidori_scroll", "aegis:earth_wall_scroll",
  "aegis:clone_scroll", "aegis:sphere_scroll", "aegis:flash_scroll", "aegis:substitution_scroll", "aegis:phoenix_scroll", "aegis:mud_river_scroll",
  "aegis:thousand_years_scroll"];
const nice = (id) => id.replace("aegis:", "").replace(/_scroll$/, "").split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
// [weight, give(p) → what it was, rare?]
export const PRIZES = [
  [26, (p) => { const r = questRyo(1000); addRyo(p, r, true); return `§6${fmtRyo(r)}`; }],
  [10, (p) => { const r = questRyo(4000); addRyo(p, r, true); return `§6a pile of Ryō: ${fmtRyo(r)}`; }],
  [1, (p) => { const r = questRyo(25000); addRyo(p, r, true); return `§6§lTHE JACKPOT: ${fmtRyo(r)}`; }, true],
  [16, (p) => { giveShards(p, 1); return "§ban XP Shard"; }],
  [4, (p) => { giveShards(p, 3); return "§bthree XP Shards"; }],
  [14, (p) => { const id = JUTSU_POOL[Math.floor(Math.random() * JUTSU_POOL.length)]; give(p, id); return `§aa jutsu scroll: ${nice(id)}`; }],
  [10, (p) => { give(p, "aegis:ramen", 3); return "§eIchiraku Ramen ×3"; }],
  [6, (p) => { give(p, "aegis:chakra_pill", 5); return "§3Soldier Pills ×5"; }],
  [5, (p) => { give(p, "aegis:explosive_kunai", 8); return "§cExplosive Kunai ×8"; }],
  [5, (p) => { give(p, "aegis:smoke_bomb", 4); return "§7Smoke Bombs ×4"; }],
  [3, (p) => { give(p, MYSTERY, 2); return "§dtwo more Mystery Scrolls!"; }],
  [2, (p) => { give(p, "aegis:reroll_scroll"); return "§d§la Bloodline Reroll Scroll"; }, true],
];
const TEASE = ["§6Ryō…", "§bXP Shard…", "§aRasengan…", "§eRamen…", "§cExplosive Kunai…", "§dReroll Scroll…", "§6Jackpot…", "§3Soldier Pills…", "§aChidori…"];
export function rollPrize(p, r = Math.random()) {
  const total = PRIZES.reduce((s, [w]) => s + w, 0);
  let x = r * total;
  for (const [w, fn, rare] of PRIZES) {
    x -= w;
    if (x < 0) return { text: fn(p), rare: !!rare };
  }
  return { text: PRIZES[0][1](p), rare: false };
}
const rolling = new Set();
export function openMystery(p) {
  if (rolling.has(p.id)) return false;
  if (!useHeld(p, MYSTERY)) return false;
  rolling.add(p.id);
  bumpFun(p, "scrolls");
  api.sound(p.dimension, "item.book.page_turn", p.location, 1, 1);
  for (let k = 0; k < 10; k++) {
    system.runTimeout(() => {
      if (!api.isValid(p)) return;
      showTitle(p, "§d§l?", { subtitle: TEASE[(k * 4 + Math.floor(Math.random() * 3)) % TEASE.length], fadeInDuration: 0, stayDuration: 6, fadeOutDuration: 0 });
      api.sound(p.dimension, "random.click", p.location, 0.6, 0.8 + k * 0.08);
    }, 2 + k * (3 + Math.floor(k / 3)));
  }
  system.runTimeout(() => {
    rolling.delete(p.id);
    if (!api.isValid(p)) return;
    const { text, rare } = rollPrize(p);
    showTitle(p, "§d§lMystery Scroll", { subtitle: `§f${text}`, fadeInDuration: 0, stayDuration: 50, fadeOutDuration: 12 });
    p.sendMessage(`§dMystery Scroll: §f${text}`);
    api.sound(p.dimension, rare ? "random.totem" : "random.levelup", p.location, 0.9, 1.1);
    api.particle(p.dimension, "aegis:cine_ring", p.location, [0.85, 0.45, 1]);
    if (rare) world.sendMessage(`§d✦ ${p.name}§d unrolled a Mystery Scroll: §f${text}§d!`);
  }, 52);
  return true;
}

// ---------------------------------------------------------------------------
// Treasure Toad
// ---------------------------------------------------------------------------
const toads = new Map(); // toad id -> { until, near, dim }
let nextToad = 1200 * 3; // the first one a few minutes after the server starts
const TOAD_SECONDS = 60;
export function spawnToad(near, dist = 12) {
  const dim = near.dimension;
  let at;
  for (let k = 0; k < 10 && !at; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = dist + Math.random() * 5;
    const x = near.location.x + Math.cos(a) * r;
    const z = near.location.z + Math.sin(a) * r;
    const y = api.surfaceY(dim, { x, y: near.location.y, z });
    if (y !== undefined && Math.abs(y - near.location.y) < 12) at = { x, y, z };
  }
  if (!at) return undefined;
  let toad;
  try {
    toad = dim.spawnEntity(TOAD, at);
  } catch {
    return undefined;
  }
  toads.set(toad.id, { until: system.currentTick + TOAD_SECONDS * 20, near: near.id, dim: dim.id });
  api.particle(dim, "aegis:cine_pillar", at, [1, 0.82, 0.25]);
  api.sound(dim, "random.orb", at, 1.5, 0.6);
  for (const q of dim.getPlayers({ location: at, maxDistance: 48 })) {
    showTitle(q, "§6✦ Treasure Toad! ✦", { subtitle: "§7a golden toad is hopping away — catch it!", fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
    q.sendMessage(`§6✦ A Treasure Toad hopped out near §f${Math.round(at.x)}, ${Math.round(at.z)}§6! Catch it within a minute.`);
  }
  return toad;
}
function toadTick() {
  const now = system.currentTick;
  for (const [id, t] of [...toads]) {
    const toad = world.getEntity(id);
    if (!toad || !api.isValid(toad)) {
      toads.delete(id);
      if (now >= t.until - 5) world.getAllPlayers().find((q) => q.id === t.near)?.sendMessage("§7The Treasure Toad got away…");
      continue;
    }
    if (now % 40 === 0) {
      api.particle(toad.dimension, "aegis:cine_ring", toad.location, [1, 0.82, 0.25]);
      api.sound(toad.dimension, "mob.frog.ambient", toad.location, 1, 1.4);
    }
    if (now > t.until + 40) {
      try {
        toad.remove();
      } catch {
        /* ignore */
      }
    }
  }
  if (!toadsOn() || toads.size || now < nextToad) return;
  nextToad = now + (6 + Math.random() * 4) * 1200;
  const players = world.getAllPlayers().filter((q) => q.dimension.id === "minecraft:overworld");
  if (players.length) spawnToad(players[Math.floor(Math.random() * players.length)]);
}
export function caughtToad(p, toad) {
  toads.delete(toad?.id);
  const r = questRyo(5000);
  addRyo(p, r, true);
  give(p, MYSTERY);
  const shard = Math.random() < 0.4;
  if (shard) giveShards(p, 1);
  const n = bumpFun(p, "toads");
  showTitle(p, "§6Caught it!", { subtitle: `§f+${fmtRyo(r)}, a Mystery Scroll${shard ? ", an XP Shard" : ""}`, fadeInDuration: 2, stayDuration: 40, fadeOutDuration: 10 });
  api.sound(p.dimension, "random.levelup", p.location, 1, 1.3);
  if (toad) api.particle(toad.dimension, "aegis:cine_pillar", toad.location, [1, 0.82, 0.25]);
  world.sendMessage(`§6✦ ${p.name}§6 caught a Treasure Toad! §8(${n} so far)`);
}

// ---------------------------------------------------------------------------
// The eating contest (Ramen Shop)
// ---------------------------------------------------------------------------
const contests = new Map(); // player id -> { start, end, bowls }
export const contestFee = () => price(300);
export const contestPrize = (bowls) => (bowls >= 10 ? questRyo(bowls * bowls * 12) : 0);
export const inContest = (p) => contests.has(p.id);
export function startEatingContest(p) {
  if (contests.has(p.id)) {
    p.sendMessage("§7You're already in the middle of a contest — eat!");
    return false;
  }
  takeAll(p, CONTEST_RAMEN);
  give(p, CONTEST_RAMEN, 48);
  const now = system.currentTick;
  const c = { start: now + 60, end: now + 60 + CONTEST_SECONDS * 20, bowls: 0 };
  contests.set(p.id, c);
  bumpFun(p, "contests");
  p.sendMessage(`§eIchiraku Eating Contest! §7Eat as many bowls of §eContest Ramen§7 as you can in ${CONTEST_SECONDS} seconds. 10 bowls wins a prize; 20 a Mystery Scroll.`);
  ["§c3", "§62", "§e1"].forEach((t, k) => system.runTimeout(() => {
    if (!api.isValid(p)) return;
    showTitle(p, `§l${t}`, { subtitle: "§7get ready…", fadeInDuration: 0, stayDuration: 16, fadeOutDuration: 2 });
    api.sound(p.dimension, "note.pling", p.location, 1, 0.8 + k * 0.2);
  }, k * 20));
  system.runTimeout(() => {
    if (!api.isValid(p)) return;
    showTitle(p, "§a§lEAT!", { subtitle: "§7as fast as you can!", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 6 });
    api.sound(p.dimension, "random.levelup", p.location, 1, 1.5);
  }, 60);
  for (let t = 70; t < 60 + CONTEST_SECONDS * 20; t += 10) {
    system.runTimeout(() => {
      const cur = contests.get(p.id);
      if (!cur || !api.isValid(p)) return;
      p.onScreenDisplay?.setActionBar(`§e§l${cur.bowls} bowls §r§7· ${Math.max(0, Math.ceil((cur.end - system.currentTick) / 20))} s left`);
    }, t);
  }
  system.runTimeout(() => finishContest(p), 60 + CONTEST_SECONDS * 20);
  return true;
}
export function noteBowl(p) {
  const c = contests.get(p.id);
  if (!c || system.currentTick < c.start || system.currentTick > c.end) return false;
  c.bowls++;
  if (c.bowls % 5 === 0) api.sound(p.dimension, "random.burp", p.location, 1, 1);
  return true;
}
export function finishContest(p) {
  const c = contests.get(p.id);
  if (!c) return undefined;
  contests.delete(p.id);
  if (!api.isValid(p)) return c.bowls;
  takeAll(p, CONTEST_RAMEN);
  const bowls = c.bowls;
  const prize = contestPrize(bowls);
  if (prize) addRyo(p, prize, true);
  if (bowls >= 20) give(p, MYSTERY);
  const best = funStats(p).bowls;
  if (bowls > best) bumpFun(p, "bowls", bowls, true);
  const rec = ramenRecord();
  const record = bowls >= 10 && (!rec || bowls > rec.bowls);
  if (record) {
    world.setDynamicProperty(RECORD, JSON.stringify({ name: p.name, bowls }));
    give(p, MYSTERY);
    world.sendMessage(`§e🍜 ${p.name}§e set a new Ichiraku record: §f${bowls} bowls§e in ${CONTEST_SECONDS} seconds!`);
  }
  showTitle(p, `§e§l${bowls} bowls!`, { subtitle: prize ? `§f+${fmtRyo(prize)}${bowls >= 20 ? " and a Mystery Scroll" : ""}${record ? " · §6a new server record!" : ""}` : "§7ten bowls wins a prize — try again!",
    fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 12 });
  p.sendMessage(`§eEating contest: §f${bowls} bowls§e.${prize ? ` §6+${fmtRyo(prize)}` : " §7(10 bowls wins a prize)"}${bowls > best ? " §a(a personal best!)" : ""}`);
  api.sound(p.dimension, prize ? "random.levelup" : "note.bass", p.location, 1, 1);
  return bowls;
}

// ---------------------------------------------------------------------------
// Emotes and the Fun & Games page (Shinobi Record)
// ---------------------------------------------------------------------------
export const EMOTES = [
  ["nice_guy", "§aNice Guy Pose", "Might Guy's thumbs-up — teeth sparkle included"],
  ["wave", "§eWave", "hello there"],
  ["bow", "§fBow", "show some respect"],
  ["victory", "§6Victory", "jump for joy"],
  ["laugh", "§cLaugh", "can't hold it in"],
  ["meditate", "§bMeditate", "sit and gather natural energy"],
  ["hand_signs", "§7Hand Signs", "Ram, Tiger, Snake…"],
];
export function playEmote(p, id) {
  const anim = id === "hand_signs" ? "animation.aegis.hand_signs" : `animation.aegis.emote_${id}`;
  api.anim(p, anim, "aegis_jutsu", "q.is_moving");
  const at = { x: p.location.x, y: p.location.y + 1.9, z: p.location.z };
  if (id === "nice_guy") {
    system.runTimeout(() => api.isValid(p) && api.particle(p.dimension, "aegis:cine_bolt", at, [1, 1, 1]), 14);
    system.runTimeout(() => api.isValid(p) && api.sound(p.dimension, "random.orb", p.location, 1, 2), 14);
  } else if (id === "victory") api.sound(p.dimension, "random.levelup", p.location, 0.6, 1.4);
  else if (id === "laugh") api.sound(p.dimension, "mob.villager.yes", p.location, 1, 1.3);
  else if (id === "meditate") for (let t = 0; t < 80; t += 20) system.runTimeout(() => api.isValid(p) && api.particle(p.dimension, "aegis:chakra_aura", p.location), t);
}
export async function emotesMenu(p, back) {
  const f = new ActionFormData().title("§lEmotes").body("§7Everyone around you sees it. Moving ends it.");
  for (const [, label, hint] of EMOTES) f.button(`${label}\n§r§8${hint}`);
  f.button("§l« Back");
  const r = await f.show(p);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection >= EMOTES.length) return back?.();
  playEmote(p, EMOTES[r.selection][0]);
}
export async function funMenu(p, back) {
  const s = funStats(p);
  const rec = ramenRecord();
  const body = [
    "§fYour fun & games",
    `§7Treasure Toads caught: §6${s.toads}`,
    `§7Eating contest best: §e${s.bowls} bowls§7 · server record: ${rec ? `§e${rec.bowls}§7 (${rec.name})` : "§8none yet"}`,
    `§7Bells taken from Kakashi: §b${s.bells}`,
    `§7Best kill streak: §c${s.streak}§7 · best hit combo: §6${s.combo}`,
    `§7Mystery Scrolls unrolled: §d${s.scrolls}`,
    "",
    "§fMove like a ninja" + (movementOn() ? "" : " §8(switched off on this server)"),
    "§7· §bChakra Leap§7 — jump again in mid-air (8 chakra).",
    "§7· §bWall Running§7 — hold jump against a wall or a tree to run up it.",
    "§7· §bWater Walking§7 — run across water; sneak to sink.",
    "§8(each can be switched off in Settings)",
    "",
    "§fThings to do",
    "§7· a §6Treasure Toad§7 hops out every few minutes — catch it for Ryō and a §dMystery Scroll§7",
    "§7· §eRamen Shop → Eating Contest§7 — as many bowls as you can in 30 seconds",
    "§7· §bKakashi's Bell Test§7 — a world event: grab a bell from him before time runs out",
    "§7· kill streaks, hit combos and §cbackstabs§7 (+25% from behind)",
  ].join("\n");
  const r = await new ActionFormData().title("§l§dFun & Games").body(body).button("§aEmotes\n§r§8wave, bow, the Nice Guy Pose…").button("§l« Back").show(p);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection === 0) return emotesMenu(p, () => funMenu(p, back));
  return back?.();
}

// ---------------------------------------------------------------------------
// The prank jutsu
// ---------------------------------------------------------------------------
export function makeFunJutsu(helpers) {
  api = helpers;
  return {
    // Hidden Leaf Secret Technique: A Thousand Years of Death — two fingers, from behind, and up they go.
    "aegis:thousand_years_scroll": { name: "A Thousand Years of Death", cost: 10, cooldown: 200, cast(p) {
      let t;
      try {
        t = p.getEntitiesFromViewDirection({ maxDistance: 4 }).map((h) => h.entity).find((e) => api.canBeHit(e, p));
      } catch {
        t = undefined;
      }
      if (!t) {
        p.onScreenDisplay?.setActionBar("§7Get right behind someone first.");
        return false;
      }
      api.anim(p, "animation.aegis.thousand_years");
      const d = api.norm({ x: t.location.x - p.location.x, y: 0, z: t.location.z - p.location.z });
      system.runTimeout(() => {
        if (!api.isValid(t)) return;
        api.hurt(t, 2, p, "entityAttack", "fist");
        api.knockback(t, d.x, d.z, 0.4, 1.7);
        api.particle(t.dimension, "aegis:smoke_puff", t.location);
        api.particle(t.dimension, "aegis:cine_ring", t.location, [1, 0.5, 0.8]);
        api.sound(t.dimension, "random.pop", t.location, 1.5, 0.5);
        api.sound(t.dimension, "mob.cat.hit", t.location, 1.2, 1.6);
        if (t.typeId === "minecraft:player") showTitle(t, "§d§l!!!", { subtitle: "§7A THOUSAND YEARS OF DEATH!", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 8 });
        p.onScreenDisplay?.setActionBar("§dA Thousand Years of Death!");
      }, 6); // (on the animation's thrust)
      return true;
    } },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function initFun(helpers) {
  api = helpers;
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    const p = damageSource?.damagingEntity;
    if (p?.typeId !== "minecraft:player" || !hurtEntity || hurtEntity.id === p.id || damage <= 0) return;
    if (isEcho(hurtEntity, damage)) return;
    noteHit(p);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (!deadEntity || deadEntity.typeId === "minecraft:player") return;
    const p = ownerOf(damageSource?.damagingEntity);
    if (!p) return;
    try {
      if (deadEntity.typeId === TOAD) return caughtToad(p, deadEntity);
      if (isEnemy(deadEntity)) noteKill(p, deadEntity);
    } catch {
      /* ignore */
    }
  });
  world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
    if (p?.typeId === "minecraft:player" && itemStack?.typeId === MYSTERY) openMystery(p);
  });
  world.afterEvents.itemCompleteUse.subscribe(({ source: p, itemStack }) => {
    if (p?.typeId === "minecraft:player" && itemStack?.typeId === CONTEST_RAMEN) noteBowl(p);
  });
  system.runInterval(toadTick, 20);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: by }) => {
    if (id !== "aegis:fun" || by?.typeId !== "minecraft:player") return;
    const [cmd, arg] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    if (cmd === "toad") return void (spawnToad(by, 8) ? undefined : by.sendMessage("§7No open ground nearby for a toad."));
    if (cmd === "mystery") return give(by, MYSTERY, Math.max(1, Math.min(64, Number(arg) || 1)));
    const s = funStats(by);
    by.sendMessage(`§dFun & games: §7toads §6${s.toads}§7 · best contest §e${s.bowls}§7 · bells §b${s.bells}§7 · best streak §c${s.streak}§7 · best combo §6${s.combo}§7 · Mystery Scrolls §d${s.scrolls}`);
  });
}
