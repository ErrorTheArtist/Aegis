// Custom HUD: HP bar + chakra bar (top-left) and big titles, drawn by resource_pack/ui/hud_screen.json.
//
// The script sends the data to the UI through the title text, which JSON UI can read anywhere via
// the global #hud_title_text_string binding. The vanilla title is hidden while it carries this data.
//
// Layout of the encoded title (fixed width so the UI can cut it apart):
//   [0..2]   "AEG"  marker
//   [3..4]   HP fill, 00-50 (2% steps)
//   [5..6]   chakra fill, 00-50
//   [7..15]  HP text, e.g. "57/80    "
//   [16..24] chakra text, e.g. "180/240  "
//   [25..27] level, e.g. "12 "
//   [28..]   big title text currently on screen (may be empty)
//
// Everything that wants a big on-screen title must call showTitle() instead of
// onScreenDisplay.setTitle(); subtitles are shown on the action bar.

import { world, system } from "@minecraft/server";

const BUCKETS = 50;
const titles = new Map(); // player id -> { text, until }
const lastSent = new Map(); // player id -> { str, tick }
let api;

const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const bucket = (cur, max) => String(Math.max(0, Math.min(BUCKETS, Math.round((cur / Math.max(1, max)) * BUCKETS)))).padStart(2, "0");

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
  return (
    "AEG" +
    bucket(hp, hpMax) +
    bucket(ck, ckMax) +
    pad(`${hp}/${hpMax}`, 9) +
    pad(`${ck}/${ckMax}`, 9) +
    pad(String(api.getLevel(player)), 3) +
    tail
  );
}

function send(player, force = false) {
  const str = encode(player);
  const last = lastSent.get(player.id);
  const now = system.currentTick;
  // resend unchanged data every 2s so the HUD stays alive after the title element fades
  if (!force && last && last.str === str && now - last.tick < 40) return;
  try {
    player.onScreenDisplay.setTitle(str, { fadeInDuration: 0, stayDuration: 100, fadeOutDuration: 0 });
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
