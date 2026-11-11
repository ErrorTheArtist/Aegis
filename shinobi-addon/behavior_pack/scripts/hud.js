// Custom HUD: HP bar + chakra bar (top-left) and big titles, drawn by resource_pack/ui/hud_screen.json.
//
// The script sends the data to the UI through the title text, which JSON UI can read anywhere via
// the global #hud_title_text_string binding. The vanilla title is hidden while it carries this data.
//
// Layout (fixed width; fill levels are two-letter codes so the UI never mistakes them for numbers):
//   title:    "AEG" + HP fill (2) + HP text (9) + level (3) + unspent points (4) + big title text (rest)
//   subtitle: "AEC" + chakra fill (2) + XP fill (2) + chakra text (9) + XP text (13)
// HP and chakra fills are found by comparing only the start of a string; XP cuts its code out.
// Fill codes: 0..50 -> "aa".."by".
//
// Everything that wants a big on-screen title must call showTitle() instead of
// onScreenDisplay.setTitle(); subtitles are shown on the action bar.

import { world, system } from "@minecraft/server";

const BUCKETS = 50;
const titles = new Map(); // player id -> { text, until }
const lastSent = new Map(); // player id -> { str, tick }
let api;

const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const code = (b) => String.fromCharCode(97 + Math.floor(b / 26)) + String.fromCharCode(97 + (b % 26));
const bucket = (cur, max) => code(Math.max(0, Math.min(BUCKETS, Math.round((cur / Math.max(1, max)) * BUCKETS))));

export function showTitle(player, text, opts = {}) {
  if (!player) return;
  const ticks = (opts.fadeInDuration ?? 10) + (opts.stayDuration ?? 70) + (opts.fadeOutDuration ?? 20);
  titles.set(player.id, { text: String(text).replace(/\n/g, " "), until: system.currentTick + ticks });
  if (opts.subtitle) {
    try {
      player.onScreenDisplay.setActionBar(opts.subtitle);
    } catch {
      /* ignore */
    }
  }
  send(player, true);
}

function encode(player) {
  let hp = 20;
  let hpMax = 20;
  try {
    const h = player.getComponent("minecraft:health");
    hp = Math.max(0, Math.ceil(h.currentValue));
    hpMax = Math.max(1, Math.round(h.effectiveMax));
  } catch {
    /* ignore */
  }
  const ck = Math.floor(api.getChakra(player));
  const ckMax = Math.round(api.getMaxChakra(player));
  const t = titles.get(player.id);
  const tail = t && system.currentTick <= t.until ? t.text : "";
  const { xp, need, points } = api.xpInfo(player);
  return {
    title: "AEG" + bucket(hp, hpMax) + pad(`${hp}/${hpMax}`, 9) + pad(String(api.getLevel(player)), 3) + pad(String(points), 4) + tail,
    subtitle: "AEC" + bucket(ck, ckMax) + (need > 0 ? bucket(xp, need) : code(BUCKETS)) + pad(`${ck}/${ckMax}`, 9) + pad(need > 0 ? `${xp}/${need}` : "MAX", 13),
  };
}

function send(player, force = false) {
  const { title, subtitle } = encode(player);
  const str = title + "|" + subtitle;
  const last = lastSent.get(player.id);
  const now = system.currentTick;
  // resend unchanged data every 2s so the HUD stays alive after the title element fades
  if (!force && last && last.str === str && now - last.tick < 40) return;
  try {
    player.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 0, stayDuration: 100, fadeOutDuration: 0 });
    lastSent.set(player.id, { str, tick: now });
  } catch {
    /* ignore */
  }
}

export function initHud(helpers) {
  api = helpers;
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) send(player);
  }, 3);
  world.afterEvents.playerSpawn.subscribe(({ player }) => send(player, true));
}
