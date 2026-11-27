// Server automation: what lets Jujutsu Legacy run a multiplayer server by itself. Everything is on by default; each
// part can be switched off (Admin Panel -> Server automation, or /scriptevent jjk:auto <part> off).
//   welcome    a new player is greeted with how to play, the server's rules (the MOTD) and a starter kit; the MOTD
//              is shown again on every join.
//   sanctuary  the area around the world spawn (24 blocks) is safe ground: nobody can be hurt there or use a technique,
//              curses and monsters are kept out (bosses and villains are pushed back out), you heal and stay fed, and
//              only admins can build or break (survival players are in adventure mode inside it). Explosions can't
//              touch it either.
//   newcomer   a new sorcerer can't fight other players, or be hurt by them, for their first 20 minutes of play.
//              (Anyone who respawns also gets 5 s in which nothing can hurt them.)
//   daily      the first join of each day gives a Daily Blessing: XP for your grade, +10% for every day in a row (up
//              to +60%), and a Cursed Womb on every 7th day in a row.
//   tags       every player's grade shows above their name.
//   tips       a tip in chat every 10 minutes.
// Dropped-item clears, the Top Sorcerers sidebar and the server events are in upkeep.js; the vanilla bans in bans.js.

import { world, system } from "@minecraft/server";
import {
  getProp, setProp, worldProp, setWorldProp, isPlayer, alive, valid, gameMode, effect, tell, title, bar, now, V, fx, COLOR,
  safeSpots, pvpBlocks, pvpBlocked, isSafe, tp, cmd, health, ground, give,
} from "./core.js";
import { gradeOf, gradeLabel, xpOf, addXp } from "./grades.js";
import { statusHooks } from "./energy.js";
import { bansLine } from "./bans.js";

export const ADMIN_TAG = "jjk_admin";
export const isAdmin = (p) => {
  try {
    return p.hasTag(ADMIN_TAG) || p.isOp?.() === true;
  } catch {
    return false;
  }
};

// Every automated part, with its label in the Admin Panel. All on unless switched off.
export const AUTO = {
  welcome: "Welcome new players (how to play, the rules, a starter kit)",
  sanctuary: "Spawn sanctuary: nobody hurt, no techniques, no curses, no building",
  newcomer: "Newcomer protection: no PvP for a new player's first 20 minutes",
  daily: "Daily Blessing: XP for the first join of each day",
  tags: "Grade tags above players' names",
  tips: "A tip in chat every 10 minutes",
  clears: "Clear dropped items every 10 minutes",
  board: "Top Sorcerers on the sidebar",
  events: "Server events (outbreaks, Special Grade hunts, villain raids)",
};
export const on = (k) => worldProp(`auto_${k}`, true) !== false;
export function setOn(k, v) {
  if (k in AUTO) setWorldProp(`auto_${k}`, !!v);
}

// ---------------------------------------------------------------------------
// The sanctuary
// ---------------------------------------------------------------------------
export const SANCT_R = 24;
let sanctCache = { tick: -1, s: null };
// { x, y, z, dim, r } or null when it's switched off. y above 30000 means the world spawn has no set height: then only
// the horizontal distance counts.
export function sanctuary() {
  if (sanctCache.tick === now()) return sanctCache.s;
  let s = null;
  if (on("sanctuary")) {
    try {
      const at = worldProp("sanct_at", "");
      if (at) s = JSON.parse(at);
    } catch {
      s = null;
    }
    if (!s) {
      try {
        const sp = world.getDefaultSpawnLocation();
        s = { x: sp.x + 0.5, y: sp.y, z: sp.z + 0.5, dim: "minecraft:overworld" };
      } catch {
        s = null;
      }
    }
    if (s) s.r = Math.max(4, Math.min(128, Number(worldProp("sanct_r", SANCT_R)) || SANCT_R));
  }
  sanctCache = { tick: now(), s };
  return s;
}
// The sanctuary's centre (undefined: back to the world spawn) and radius.
export function setSanctuary(loc, dimId) {
  setWorldProp("sanct_at", loc ? JSON.stringify({ x: loc.x, y: loc.y, z: loc.z, dim: dimId }) : undefined);
  sanctCache.tick = -1;
}
export function setSanctuaryRadius(r) {
  setWorldProp("sanct_r", Math.max(4, Math.min(128, Math.round(r))));
  sanctCache.tick = -1;
}
export function inSanctuary(loc, dimId, s = sanctuary()) {
  if (!s || !loc || dimId !== s.dim) return false;
  const dx = loc.x - s.x;
  const dz = loc.z - s.z;
  if (dx * dx + dz * dz > s.r * s.r) return false;
  return s.y > 30000 || Math.abs(loc.y - s.y) <= s.r + 16;
}
const entityIn = (e, s) => {
  try {
    return inSanctuary(e.location, e.dimension?.id, s);
  } catch {
    return false;
  }
};
safeSpots.push((loc, dimId) => inSanctuary(loc, dimId));

const SANCT_TAG = "jjk_sanct_mode"; // (we put them in adventure mode: we take them out of it)
function setMode(p, mode) {
  try {
    p.setGameMode(mode);
    return true;
  } catch {
    return cmd(p, `gamemode ${mode} @s`);
  }
}
const inside = new Set(); // players inside at the last check
function sanctuaryPlayers() {
  const s = sanctuary();
  for (const p of world.getAllPlayers()) {
    try {
      const isIn = !!s && alive(p) && entityIn(p, s);
      if (isIn) {
        effect(p, "resistance", 30, 4); // nothing hurts you
        effect(p, "regeneration", 30, 1); // you heal
        effect(p, "saturation", 2, 0); // and stay fed
        if (!inside.has(p.id)) {
          inside.add(p.id);
          bar(p, "§aYou entered the sanctuary §7— no fighting here; you heal while you rest.", 50);
        }
        if (!p.hasTag(SANCT_TAG) && !isAdmin(p) && gameMode(p) === "survival" && setMode(p, "adventure")) p.addTag(SANCT_TAG);
      } else {
        if (inside.delete(p.id)) bar(p, "§7You left the sanctuary.", 40);
        if (p.hasTag(SANCT_TAG)) {
          if (gameMode(p) === "adventure") setMode(p, "survival");
          p.removeTag(SANCT_TAG);
        }
      }
    } catch {
      /* ignore */
    }
  }
}

// Curses and monsters inside are exorcised; bosses and villains are pushed back out. Servants of a sorcerer stay.
const CURSE = /^jjk:(fly_head|lanky_curse|mouth_curse|eye_curse)$/;
const MONSTER = /^minecraft:(zombie|zombie_villager_v2|zombie_villager|husk|drowned|skeleton|stray|bogged|creeper|spider|cave_spider|witch|slime|phantom|pillager|vindicator|evoker|ravager|vex|endermite|silverfish|breeze|blaze|ghast|magma_cube|piglin_brute|hoglin|zoglin|wither_skeleton|guardian|elder_guardian|shulker)$/;
const BIG = new Set(["jjk:finger_bearer", "jjk:mahoraga"]);
function sanctuaryMobs() {
  const s = sanctuary();
  if (!s) return;
  let list = [];
  try {
    const dim = world.getDimension(s.dim);
    list = s.y > 30000
      ? dim.getEntities({ location: { x: s.x - s.r, y: -64, z: s.z - s.r }, volume: { x: s.r * 2, y: 384, z: s.r * 2 } })
      : dim.getEntities({ location: { x: s.x, y: s.y, z: s.z }, maxDistance: s.r + 18 });
  } catch {
    return;
  }
  for (const e of list) {
    try {
      if (isPlayer(e) || !entityIn(e, s)) continue;
      const t = e.typeId;
      const owned = !!getProp(e, "owner") && !e.hasTag("jjk_minion");
      if ((CURSE.test(t) || MONSTER.test(t)) && !owned) {
        fx(e.dimension, "jjk:smoke", V.add(e.location, { x: 0, y: 0.8, z: 0 }), COLOR.dark, 1);
        e.remove();
      } else if ((BIG.has(t) && !owned) || (t === "jjk:sorcerer" && getProp(e, "side") === "villain")) {
        const d = V.flat(V.sub(e.location, { x: s.x, y: e.location.y, z: s.z }));
        const to = { x: s.x + d.x * (s.r + 8), y: e.location.y + 4, z: s.z + d.z * (s.r + 8) };
        tp(e, ground(e.dimension, to, 40));
      }
    } catch {
      /* gone */
    }
  }
}

// ---------------------------------------------------------------------------
// Newcomers, respawns
// ---------------------------------------------------------------------------
export const NEWCOMER_SECS = 1200;
export const protectedLeft = (p) => (on("newcomer") ? Number(getProp(p, "newcomer", 0)) || 0 : 0);
export function setProtection(p, secs) {
  setProp(p, "newcomer", secs > 0 ? Math.round(secs) : undefined);
}
pvpBlocks.push((a, b) => protectedLeft(a) > 0 || protectedLeft(b) > 0);
const warned = new Map(); // attacker id -> tick
function undoPvp({ hurtEntity: v, damageSource, damage }) {
  const a = damageSource?.damagingEntity;
  if (!(damage > 0) || !isPlayer(v) || !isPlayer(a) || a.id === v.id || !pvpBlocked(a, v)) return;
  const h = health(v);
  if (h && h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
  effect(v, "resistance", 40, 4); // (and the next blows do nothing)
  if (now() - (warned.get(a.id) ?? -1e9) < 60) return;
  warned.set(a.id, now());
  const why = isSafe(a) || isSafe(v) ? "§aNo fighting in the sanctuary." : protectedLeft(a) > 0 ? "§aYou're under newcomer protection: you can't fight players yet."
    : `§a${v.name} is under newcomer protection.`;
  bar(a, why, 40);
}

// ---------------------------------------------------------------------------
// Joining: the welcome, the MOTD, the Daily Blessing
// ---------------------------------------------------------------------------
export const motd = () => String(worldProp("motd", "") || "");
function welcome(p) {
  const lines = [`§5✦ §fWelcome to the server, §d${p.name}§f!`,
    "§7• Your moves are items: §fright-click§7 one to use it.",
    "§7• Right-click the §fJujutsu Record§7 for everything else: your technique, grade, settings and this server.",
    "§7• Curses come out at night. Exorcise them to climb from Grade 4 to Special Grade."];
  const s = sanctuary();
  if (s) lines.push(`§7• The ${s.r} blocks around spawn are a §asanctuary§7: nobody can fight there, and you heal.`);
  if (protectedLeft(p) > 0) lines.push("§7• For your first 20 minutes no player can hurt you — or be hurt by you.");
  const b = bansLine();
  if (b) lines.push(`§7• ${b} on this server.`);
  if (motd()) lines.push(`§d✦ ${motd()}`);
  for (const l of lines) tell(p, l);
  give(p, "minecraft:bread", 16); // the starter kit
  give(p, "minecraft:torch", 16);
}
// Called on every join (main.js). Returns true for a first join.
export function joined(p) {
  if (getProp(p, "joined")) {
    if (motd()) system.runTimeout(() => valid(p) && tell(p, `§d✦ ${motd()}`), 130);
    return false;
  }
  setProp(p, "joined", Date.now());
  if (on("newcomer") && xpOf(p) < 100) setProtection(p, NEWCOMER_SECS);
  if (on("welcome")) system.runTimeout(() => valid(p) && welcome(p), 150);
  return true;
}

const DAILY_XP = [60, 120, 250, 400, 600, 900]; // by grade
const DAY = 86400000;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10); // (UTC)
export const nextDailyIn = () => DAY - (Date.now() % DAY); // ms until the next day starts
export function dailyBlessing(p) {
  if (!on("daily") || !alive(p) || !getProp(p, "technique")) return false;
  const today = dayOf(Date.now());
  const last = getProp(p, "daily_day", "");
  if (last === today) return false;
  const streak = last === dayOf(Date.now() - DAY) ? Number(getProp(p, "daily_streak", 0)) + 1 : 1;
  setProp(p, "daily_day", today);
  setProp(p, "daily_streak", streak);
  const xp = Math.round(DAILY_XP[gradeOf(p)] * (1 + 0.1 * Math.min(6, streak - 1)));
  addXp(p, xp, "Daily Blessing", true);
  const womb = streak % 7 === 0;
  if (womb) give(p, "jjk:cursed_womb", 1);
  title(p, "§6Daily Blessing", `§7Day ${streak} in a row · +${xp} XP${womb ? " · a Cursed Womb" : ""}`, 50);
  return true;
}

// ---------------------------------------------------------------------------
// Grade tags, tips
// ---------------------------------------------------------------------------
export const tagOf = (p) => `${gradeLabel(p)}§r\n§f${p.name}`;
function tags() {
  const want = on("tags");
  for (const p of world.getAllPlayers()) {
    try {
      if (want && getProp(p, "technique")) {
        const t = tagOf(p);
        if (p.nameTag !== t) p.nameTag = t;
      } else if (String(p.nameTag ?? "").includes("\n")) p.nameTag = p.name; // (ours: take it off)
    } catch {
      /* ignore */
    }
  }
}
export const TIPS = [
  "Sneak and stand still to recover cursed energy twice as fast.",
  "Any punch can land a Black Flash: 2.5x damage, CE back, and 30 s in the zone.",
  "Two domains that overlap clash: the stronger sorcerer keeps theirs.",
  "Simple Domain (Grade 2) keeps a domain's sure-hit off you.",
  "Right-click the Jujutsu Record: your moves, the grades, Binding Vows, settings — and this server.",
  "Right-click a Jujutsu High sorcerer to talk, and to spar for XP. A spar can't kill you.",
  "Curses gather around sorcerers at night; the higher your grade, the stronger they are.",
  "Log in every day for a Daily Blessing. Every 7th day in a row brings a Cursed Womb.",
  "A Cursed Womb rerolls your innate technique, within what your clan's blood allows.",
  "A Binding Vow trades something for something: more damage for more risk, faster moves for more CE.",
  "The sanctuary around spawn is safe ground: nobody fights there, and you heal while you rest.",
  "Every half hour there's a server event: a curse outbreak, a Special Grade hunt or a villain raid.",
];
let tipAt = 0;
export function tip() {
  const t = TIPS[tipAt++ % TIPS.length];
  try {
    world.sendMessage(`§8[§5Tip§8] §7${t}`);
  } catch {
    /* ignore */
  }
  return t;
}

export function initServer() {
  system.runInterval(sanctuaryPlayers, 10);
  system.runInterval(sanctuaryMobs, 40);
  system.runInterval(tags, 100);
  system.runInterval(() => on("tips") && world.getAllPlayers().length > 0 && tip(), 12000);
  // newcomer protection counts down in play time
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      const left = Number(getProp(p, "newcomer", 0)) || 0;
      if (left <= 0) continue;
      setProtection(p, left - 1);
      if (left === 1 && on("newcomer")) tell(p, "§7Your newcomer protection is over: other players can fight you now. §8(The sanctuary is always safe.)");
    }
  }, 20);
  // the Daily Blessing also reaches whoever is online when a new day starts
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) dailyBlessing(p);
  }, 1200);
  world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      undoPvp(ev);
    } catch {
      /* ignore */
    }
  });
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) effect(player, "resistance", 100, 4); // 5 s in which nothing can hurt you
  });
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => inside.delete(playerId));
  // explosions never break the sanctuary
  world.beforeEvents.explosion?.subscribe?.((ev) => {
    const s = sanctuary();
    if (!s || ev.dimension?.id !== s.dim) return;
    try {
      const blocks = ev.getImpactedBlocks();
      const keep = blocks.filter((b) => !inSanctuary(b.location, s.dim, s));
      if (keep.length !== blocks.length) ev.setImpactedBlocks(keep);
    } catch {
      /* ignore */
    }
  });
  statusHooks.push((p) => {
    const left = protectedLeft(p);
    if (left > 0) return `§aNEW ${Math.ceil(left / 60)}m`;
    return inside.has(p.id) ? "§aSANCTUARY" : "";
  });
}
export const _server = { inside, SANCT_TAG };
