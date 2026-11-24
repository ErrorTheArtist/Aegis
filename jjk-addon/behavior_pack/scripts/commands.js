// Admin commands (/scriptevent needs operator permission). The last word may name another player.
//   /scriptevent jjk:record                      open your Jujutsu Record
//   /scriptevent jjk:admin                       open the Admin Panel
//   /scriptevent jjk:technique limitless [name]  set an innate technique (limitless, shrine, ten_shadows,
//                                                cursed_speech, heavenly, blood, boogie, random)
//   /scriptevent jjk:grade 4 [name]              set a grade (0 = Grade 4 … 5 = Special Grade)
//   /scriptevent jjk:xp 500 [name]               give XP
//   /scriptevent jjk:finger 20 [name]            set Sukuna's Fingers eaten
//   /scriptevent jjk:ce [name]                   refill cursed energy and reset cooldowns
//   /scriptevent jjk:boss                        summon the Finger Bearer next to you
//   /scriptevent jjk:reset [name]                wipe a player (they awaken again)

import { world, system } from "@minecraft/server";
import { setProp, tell, isPlayer } from "./core.js";
import { GRADES, setXp, addXp, MAX_FINGERS, maxCE, applyStats } from "./grades.js";
import { setCE } from "./energy.js";
import { TECHNIQUES, setTechnique, pickTechnique, techniqueOf, resetCooldowns, syncItems, awaken } from "./techniques.js";
import { spawnFingerBearer } from "./curses.js";
import { openRecord, adminMenu } from "./record.js";

function say(src, text) {
  if (isPlayer(src)) tell(src, text);
  else {
    try {
      world.sendMessage(text);
    } catch {
      /* ignore */
    }
  }
}

// "<value> [player name]" -> [value, target]
function parse(src, message) {
  const words = String(message ?? "").trim().split(/\s+/).filter(Boolean);
  const value = words.shift();
  const name = words.join(" ");
  const target = name ? world.getAllPlayers().find((q) => q.name.toLowerCase() === name.toLowerCase()) : isPlayer(src) ? src : undefined;
  return [value, target, name];
}

export function runCommand(id, message, src) {
  const cmd = id.slice(4);
  if (cmd === "record") return isPlayer(src) && openRecord(src);
  if (cmd === "admin") return isPlayer(src) ? adminMenu(src) : say(src, "§7Run it as a player.");
  if (cmd === "boss") {
    if (!isPlayer(src)) return say(src, "§7Run it as a player.");
    spawnFingerBearer(src, true);
    return say(src, "§4The Finger Bearer has been summoned.");
  }
  const [value, q, name] = parse(src, message);
  const needsValue = ["technique", "grade", "xp", "finger"].includes(cmd);
  const target = needsValue ? q : parse(src, `x ${message ?? ""}`)[1];
  if (!target) return say(src, name ? `§cNo player called ${name}.` : "§cName a player.");
  switch (cmd) {
    case "technique": {
      const tech = value === "random" ? pickTechnique(techniqueOf(target)) : value;
      if (!TECHNIQUES[tech]) return say(src, `§cUnknown technique. Use: ${Object.keys(TECHNIQUES).join(", ")}, random`);
      resetCooldowns(target);
      setTechnique(target, tech, "reroll");
      return say(src, `§7${target.name} now has ${TECHNIQUES[tech].name}.`);
    }
    case "grade": {
      const g = Math.max(0, Math.min(GRADES.length - 1, parseInt(value, 10) || 0));
      setXp(target, GRADES[g].xp);
      syncItems(target);
      return say(src, `§7${target.name} is now ${GRADES[g].name}.`);
    }
    case "xp":
      addXp(target, parseInt(value, 10) || 0, "from an admin");
      return say(src, `§7Gave ${target.name} ${parseInt(value, 10) || 0} XP.`);
    case "finger":
      setProp(target, "fingers", Math.max(0, Math.min(MAX_FINGERS, parseInt(value, 10) || 0)));
      applyStats(target);
      return say(src, `§7${target.name} has eaten ${Math.max(0, Math.min(MAX_FINGERS, parseInt(value, 10) || 0))} fingers.`);
    case "ce":
      setCE(target, maxCE(target));
      resetCooldowns(target);
      return say(src, `§7Refilled ${target.name}.`);
    case "reset":
      for (const k of ["technique", "xp", "fingers", "ce", "black_flashes", "exorcised", "sorcerers_beaten", "moves_used", "hb"]) setProp(target, k, undefined);
      resetCooldowns(target);
      applyStats(target);
      awaken(target);
      return say(src, `§7${target.name} was reset and awakened again.`);
    default:
      return say(src, "§7Commands: jjk:record, admin, technique, grade, xp, finger, ce, boss, reset");
  }
}

export function initCommands() {
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (!id.startsWith("jjk:")) return;
    try {
      runCommand(id, message, sourceEntity);
    } catch {
      /* ignore */
    }
  });
}
