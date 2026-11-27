// Jujutsu Legacy — entry point. Wires every module together:
//   credits.js     who made it (shown to everyone; can't be switched off)
//   core.js        storage, maths, particles, sounds, targeting, the task runner
//   clans.js       Gojo, Zen'in, Kamo, Inumaki and the clanless: which techniques run in whose blood
//   grades.js      Grade 4 → Special Grade, XP, Sukuna's Fingers, health
//   energy.js      cursed energy and the action-bar HUD
//   combat.js      technique damage, Black Flash, Infinity, stuns
//   domains.js     Domain Expansion, clashes, burnout, Simple Domain, each domain's fog
//   cinematic.js   the cinematics of Hollow Purple and every domain (their shot lists: cine_shots.js)
//   tech_*.js      the fourteen innate techniques; servants.js the curses some of them call to fight
//   vows.js        Binding Vows: one trade-off at a time
//   mahoraga.js    the Ten Shadows' Divine General: the ritual, adaptation, the wheel
//   techniques.js  awakening, move items, using a move, fingers, Cursed Wombs
//   curses.js      exorcism XP and drops, the Finger Bearer, night surges
//   sorcerers.js   the cast: Jujutsu High allies (talk, spar) and villain bosses; npc_moves.js their own attacks
//   bans.js        vanilla bans: armour, redstone, bundles
//   server.js      server automation: welcome, the spawn sanctuary, newcomer protection, Daily Blessings, grade tags, tips
//   upkeep.js      dropped-item clears, the Top Sorcerers sidebar, server events
//   record.js      the Jujutsu Record and the Admin Panel
//   commands.js    /scriptevent jjk:… admin commands

import { world, system } from "@minecraft/server";
import { initTasks, valid, isPlayer, health, tell } from "./core.js";
import { creditsIntact, creditLine, tamperedLine } from "./credits.js";
import { ensureClan } from "./clans.js";
import { initEnergy, statusHooks } from "./energy.js";
import { initCombat } from "./combat.js";
import { initDomains } from "./domains.js";
import { initCinematics } from "./cinematic.js";
import { initTechniques, awaken, useMove, MOVES, syncItems, eatFinger, useWomb, techniqueOf } from "./techniques.js";
import { initHeavenly } from "./tech_heavenly.js";
import { initCurses } from "./curses.js";
import { openRecord } from "./record.js";
import { initCommands } from "./commands.js";
import { initSorcerers } from "./sorcerers.js";
import { applyStats } from "./grades.js";
import { initMahoraga } from "./mahoraga.js";
import { initBans } from "./bans.js";
import { initServer, joined, dailyBlessing } from "./server.js";
import { initUpkeep } from "./upkeep.js";

initTasks();
initEnergy();
initCombat();
initDomains();
initCinematics();
initTechniques();
initHeavenly();
initCurses();
initCommands();
initSorcerers();
initMahoraga();
initBans();
initServer();
initUpkeep();

function ready(p, respawn) {
  if (!valid(p)) return;
  if (techniqueOf(p)) ensureClan(p); // (players from before clans: the clan their technique came from)
  if (!techniqueOf(p)) awaken(p);
  applyStats(p);
  syncItems(p);
  if (respawn) {
    try {
      health(p)?.resetToMaxValue();
    } catch {
      /* ignore */
    }
  }
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  system.runTimeout(() => ready(player, !initialSpawn), initialSpawn ? 60 : 5);
  if (initialSpawn) {
    joined(player); // (a first join: the welcome and newcomer protection; otherwise the MOTD)
    system.runTimeout(() => valid(player) && dailyBlessing(player), 220);
  }
  // the credits, every time someone joins
  if (initialSpawn) system.runTimeout(() => valid(player) && tell(player, creditsIntact() ? creditLine() : tamperedLine()), 100);
});
// a copy with its credits edited out says so, every two minutes, to everyone
system.runInterval(() => {
  if (creditsIntact()) return;
  try {
    world.sendMessage(tamperedLine());
  } catch {
    /* ignore */
  }
}, 2400);
statusHooks.push(() => (creditsIntact() ? "" : "§cMODIFIED COPY"));
// (players already online when the scripts load: /reload)
system.runTimeout(() => {
  for (const p of world.getAllPlayers()) ready(p, false);
}, 40);

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (!isPlayer(source) || !itemStack?.typeId?.startsWith("jjk:")) return;
  const id = itemStack.typeId.slice(4);
  try {
    if (id === "jujutsu_record") openRecord(source);
    else if (id === "sukuna_finger") eatFinger(source);
    else if (id === "cursed_womb") useWomb(source);
    else if (MOVES[id]) useMove(source, id);
  } catch {
    /* ignore */
  }
});
