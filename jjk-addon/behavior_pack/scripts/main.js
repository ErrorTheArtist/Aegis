// Jujutsu Legacy — entry point. Wires every module together:
//   core.js        storage, maths, particles, sounds, targeting, the task runner
//   grades.js      Grade 4 → Special Grade, XP, Sukuna's Fingers, health
//   energy.js      cursed energy and the action-bar HUD
//   combat.js      technique damage, Black Flash, Infinity, stuns
//   domains.js     Domain Expansion, clashes, burnout, Simple Domain
//   tech_*.js      the seven innate techniques
//   techniques.js  awakening, move items, using a move, fingers, Cursed Wombs
//   curses.js      exorcism XP and drops, the Finger Bearer, night surges
//   record.js      the Jujutsu Record and the Admin Panel
//   commands.js    /scriptevent jjk:… admin commands

import { world, system } from "@minecraft/server";
import { initTasks, valid, isPlayer, health } from "./core.js";
import { initEnergy } from "./energy.js";
import { initCombat } from "./combat.js";
import { initDomains } from "./domains.js";
import { initTechniques, awaken, useMove, MOVES, syncItems, eatFinger, useWomb, techniqueOf } from "./techniques.js";
import { initHeavenly } from "./tech_heavenly.js";
import { initCurses } from "./curses.js";
import { openRecord } from "./record.js";
import { initCommands } from "./commands.js";
import { applyStats } from "./grades.js";

initTasks();
initEnergy();
initCombat();
initDomains();
initTechniques();
initHeavenly();
initCurses();
initCommands();

function ready(p, respawn) {
  if (!valid(p)) return;
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
});
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
