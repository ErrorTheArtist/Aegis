// Custom HUD: HP / chakra / XP bars, level and points (top-left), drawn by resource_pack/ui/hud_screen.json.
//
// The data travels in the title + subtitle text, which JSON UI reads anywhere via the global
// #hud_title_text_string / #hud_subtitle_text_string bindings. The UI only *compares the start* of
// these strings (the one string operation that is reliable) and shows the strings whole:
//
//   title:    "AEG" + HP fill code (2) + XP fill code (2) + "§f" + "HP 57/80"
//   subtitle: "AEC" + chakra fill code (2) + "§f" + "CK 180/240\n§eLevel 12\n§f340/625\n§6Points 13"
//
// The labels are black by default, so "AEGxxyy" / "AECxx" render black on a black tab at the left
// end of each bar (invisible), and "§f" switches the rest to white. Fill codes: 0..50 -> "aa".."by".
//
// Big titles (level up, clan reveal…) are shown as normal Minecraft titles for their duration;
// the HUD steps aside during that time. Always use showTitle() instead of onScreenDisplay.setTitle().

import { world, system } from "@minecraft/server";
import { getRyo } from "./currency.js";

const BUCKETS = 50;
const titles = new Map(); // player id -> { text, subtitle, until, shown }
const lastSent = new Map(); // player id -> { str, tick }
let api;

const code = (b) => String.fromCharCode(97 + Math.floor(b / 26)) + String.fromCharCode(97 + (b % 26));
const bucket = (cur, max) => code(Math.max(0, Math.min(BUCKETS, Math.round((cur / Math.max(1, max)) * BUCKETS))));

export function showTitle(player, text, opts = {}) {
  if (!player) return;
  const fadeIn = opts.fadeInDuration ?? 10;
  const stay = opts.stayDuration ?? 70;
  const fadeOut = opts.fadeOutDuration ?? 20;
  titles.set(player.id, { text: String(text), subtitle: opts.subtitle ?? "", until: system.currentTick + fadeIn + stay + fadeOut, fadeIn, stay, fadeOut });
  try {
    player.onScreenDisplay.setTitle(String(text), { subtitle: opts.subtitle ?? "", fadeInDuration: fadeIn, stayDuration: stay, fadeOutDuration: fadeOut });
  } catch {
    /* ignore */
  }
  lastSent.delete(player.id);
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
  const { xp, need, points } = api.xpInfo(player);
  const xpCode = need > 0 ? bucket(xp, need) : code(BUCKETS);
  return {
    title: "AEG" + bucket(hp, hpMax) + xpCode + "§f" + `HP ${hp}/${hpMax}`,
    subtitle: "AEC" + bucket(ck, ckMax) + "§f" + `CK ${ck}/${ckMax}\n§eLevel ${api.getLevel(player)}\n§f${need > 0 ? `${xp}/${need} XP` : "MAX"}\n§6Points ${points}\n§6Ryō ${getRyo(player).toLocaleString("en-US")}`,
  };
}

function send(player, force = false) {
  const t = titles.get(player.id);
  if (t && system.currentTick <= t.until) return; // a real title is on screen
  if (t) titles.delete(player.id);
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
