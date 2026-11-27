// Admin commands (/scriptevent needs operator permission). The last word may name another player.
//   /scriptevent jjk:record                      open your Jujutsu Record
//   /scriptevent jjk:admin                       open the Admin Panel
//   /scriptevent jjk:technique limitless [name]  set an innate technique (limitless, shrine, ten_shadows, heavenly,
//                                                projection, cursed_speech, blood, disaster_flames, idle_death_gamble,
//                                                cursed_spirit, idle_transfiguration, straw_doll, ratio, boogie, random)
//   /scriptevent jjk:grade 4 [name]              set a grade (0 = Grade 4 … 5 = Special Grade)
//   /scriptevent jjk:xp 500 [name]               give XP
//   /scriptevent jjk:finger 20 [name]            set Sukuna's Fingers eaten
//   /scriptevent jjk:ce [name]                   refill cursed energy and reset cooldowns
//   /scriptevent jjk:clan zenin [name]           set a clan (gojo, zenin, kamo, inumaki, clanless); a technique their
//                                                new clan's blood doesn't allow is rerolled
//   /scriptevent jjk:boss                        summon the Finger Bearer next to you
//   /scriptevent jjk:mahoraga                    summon a wild Mahoraga next to you (no ritual: nobody can tame it)
//   /scriptevent jjk:tame_mahoraga [name]        let a Ten Shadows sorcerer skip the ritual (or "off" to undo it)
//   /scriptevent jjk:summon gojo [stay]          summon a character next to you (stay: they don't move — for a hub)
//   /scriptevent jjk:reset [name]                wipe a player (they're born and awaken again)
//   /scriptevent jjk:cinematics off              cinematics on/off for everyone (each player can also switch theirs off)
//   /scriptevent jjk:vfx light                   fewer particles for slower devices ("full" to go back)
//   /scriptevent jjk:cinematic void              watch a cinematic without casting anything (void, shrine, garden, moon,
//                                                volcano, perfection, jackpot, purple)
// Running the server (all of it is automatic; these change it):
//   /scriptevent jjk:auto                        what's on (welcome, sanctuary, newcomer, daily, tags, tips, clears,
//                                                board, events)
//   /scriptevent jjk:auto tips off               switch one part off (or on)
//   /scriptevent jjk:bans                        what's banned; jjk:bans armour off switches a group (armour, redstone,
//                                                bundles) off or on
//   /scriptevent jjk:ban totem_of_undying        ban any item by hand (jjk:unban <item> allows it again)
//   /scriptevent jjk:sanctuary here 32           move the spawn sanctuary to where you stand (and its radius); "spawn"
//                                                puts it back on the world spawn, a number alone sets the radius
//   /scriptevent jjk:motd Be nice!               the message everyone sees when they join ("off" removes it)
//   /scriptevent jjk:event outbreak              start a server event now: outbreak, hunt or raid
//   /scriptevent jjk:clear                       clear every dropped item now
//   /scriptevent jjk:protection off [name]       end a player's newcomer protection (or give minutes: jjk:protection 20)
//   /scriptevent jjk:credits                     who made this add-on

import { world, system } from "@minecraft/server";
import { setProp, setWorldProp, worldProp, tell, isPlayer } from "./core.js";
import { CINE } from "./cine_shots.js";
import { play, inCinematic } from "./cinematic.js";
import { AUTO, on, setOn, sanctuary, setSanctuary, setSanctuaryRadius, setProtection, protectedLeft } from "./server.js";
import { GROUPS, groupOn, setGroup, banItem, extraBans } from "./bans.js";
import { startEvent, clearItems, EVENTS } from "./upkeep.js";
import { GRADES, setXp, addXp, MAX_FINGERS, maxCE, applyStats } from "./grades.js";
import { setCE } from "./energy.js";
import { TECHNIQUES, setTechnique, techniqueOf, resetCooldowns, syncItems, awaken } from "./techniques.js";
import { CLANS, BOUND, ensureClan, rollTechnique, canInherit } from "./clans.js";
import { creditLine } from "./credits.js";
import { spawnFingerBearer } from "./curses.js";
import { openRecord, adminMenu } from "./record.js";
import { spawnMahoraga } from "./mahoraga.js";
import { CAST, spawnSorcerer, nameOfCast } from "./sorcerers.js";

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
  if (cmd === "credits") return say(src, creditLine());
  if (cmd === "record") return isPlayer(src) && openRecord(src);
  if (cmd === "admin") return isPlayer(src) ? adminMenu(src) : say(src, "§7Run it as a player.");
  if (cmd === "summon") {
    if (!isPlayer(src)) return say(src, "§7Run it as a player.");
    const [who, how] = String(message ?? "").trim().split(/\s+/);
    if (!CAST[who]) return say(src, `§cWho? Use: ${Object.keys(CAST).join(", ")}`);
    spawnSorcerer(src.dimension, who, { x: src.location.x + 2, y: src.location.y, z: src.location.z + 2 }, { stay: how === "stay" });
    return say(src, `§7Summoned ${nameOfCast(who)}${how === "stay" ? " (staying put)" : ""}.`);
  }
  if (cmd === "boss") {
    if (!isPlayer(src)) return say(src, "§7Run it as a player.");
    spawnFingerBearer(src, true);
    return say(src, "§4The Finger Bearer has been summoned.");
  }
  if (cmd === "mahoraga") {
    if (!isPlayer(src)) return say(src, "§7Run it as a player.");
    spawnMahoraga(src.dimension, { x: src.location.x + 4, y: src.location.y, z: src.location.z + 4 });
    return say(src, "§6Mahoraga has been summoned. §7(No ritual: it can't be tamed.)");
  }
  if (cmd === "tame_mahoraga") {
    const words = String(message ?? "").trim().split(/\s+/).filter(Boolean);
    const off = words[0] === "off";
    if (off) words.shift();
    const who = words.length ? world.getAllPlayers().find((q) => q.name.toLowerCase() === words.join(" ").toLowerCase()) : isPlayer(src) ? src : undefined;
    if (!who) return say(src, "§cName a player.");
    setProp(who, "mahoraga", off ? undefined : true);
    return say(src, off ? `§7${who.name} no longer commands Mahoraga.` : `§7${who.name} has tamed Mahoraga (the Ten Shadows' ritual now calls it to fight for them).`);
  }
  if (cmd === "cinematics" || cmd === "vfx") {
    const v = String(message ?? "").trim().toLowerCase();
    if (cmd === "cinematics") {
      if (v !== "on" && v !== "off") return say(src, "§7Use: jjk:cinematics on|off");
      setWorldProp("cinematics", v === "on");
      return say(src, `§7Cinematics are ${v === "on" ? "on" : "off"} for everyone.`);
    }
    if (v !== "light" && v !== "full") return say(src, "§7Use: jjk:vfx light|full");
    setWorldProp("vfx_light", v === "light");
    return say(src, v === "light" ? "§7Light effects: fewer particles." : "§7Full effects.");
  }
  if (cmd === "cinematic") {
    if (!isPlayer(src)) return say(src, "§7Run it as a player.");
    const kind = String(message ?? "").trim().toLowerCase();
    if (!CINE[kind]) return say(src, `§cWhich one? Use: ${Object.keys(CINE).join(", ")}`);
    if (inCinematic(src)) return say(src, "§7You're already watching one.");
    return play(kind, src) || say(src, "§7Cinematics are switched off (Record -> Settings, or the server's).");
  }
  const words = String(message ?? "").trim().split(/\s+/).filter(Boolean);
  if (cmd === "auto") {
    const [part, state] = words;
    if (part && !AUTO[part]) return say(src, `§cWhich part? ${Object.keys(AUTO).join(", ")}`);
    if (part && state) {
      setOn(part, state !== "off");
      return say(src, `§7${AUTO[part]}: ${on(part) ? "§aon" : "§coff"}`);
    }
    return say(src, Object.keys(AUTO).map((k) => `§7${k}: ${on(k) ? "§aon" : "§coff"}`).join("\n"));
  }
  if (cmd === "bans") {
    const [group, state] = words;
    if (group && !GROUPS[group]) return say(src, `§cWhich group? ${Object.keys(GROUPS).join(", ")}`);
    if (group && state) setGroup(group, state !== "off");
    const list = Object.keys(GROUPS).map((k) => `§7${k}: ${groupOn(k) ? "§cbanned" : "§aallowed"}`);
    if (extraBans().length) list.push(`§7by hand: §c${extraBans().join(", ")}`);
    return say(src, list.join("\n"));
  }
  if (cmd === "ban" || cmd === "unban") return say(src, banItem(words[0], cmd === "ban"));
  if (cmd === "sanctuary") {
    const [a, b] = words;
    if (a === "off" || a === "on") setOn("sanctuary", a === "on");
    else if (a === "spawn") setSanctuary(undefined);
    else if (a === "here") {
      if (!isPlayer(src)) return say(src, "§7Run it as a player.");
      setSanctuary({ x: src.location.x, y: src.location.y, z: src.location.z }, src.dimension.id);
      if (Number(b) > 0) setSanctuaryRadius(Number(b));
    } else if (Number(a) > 0) setSanctuaryRadius(Number(a));
    const s = sanctuary();
    return say(src, s ? `§7The sanctuary: §a${s.r} blocks around ${Math.round(s.x)}, ${Math.round(s.y > 30000 ? 0 : s.y)}, ${Math.round(s.z)}§7 (${s.dim.replace("minecraft:", "")}).`
      : "§7The sanctuary is §coff§7.");
  }
  if (cmd === "motd") {
    const text = String(message ?? "").trim();
    setWorldProp("motd", text && text !== "off" ? text.slice(0, 200) : undefined);
    return say(src, text && text !== "off" ? `§7Everyone joining will see: §d✦ ${worldProp("motd", "")}` : "§7The join message is off.");
  }
  if (cmd === "event") {
    const kind = words[0];
    if (!EVENTS[kind]) return say(src, `§7Use: jjk:event ${Object.keys(EVENTS).join("|")}`);
    const started = startEvent(kind);
    return say(src, started ? `§7Started: ${EVENTS[started]}.` : "§7Nothing started: an event is already on, or nobody it could happen to (outside the sanctuary, awakened).");
  }
  if (cmd === "clear") return clearItems(true);
  if (cmd === "protection") {
    const [v, ...rest] = words;
    const who = rest.length ? world.getAllPlayers().find((x) => x.name.toLowerCase() === rest.join(" ").toLowerCase()) : isPlayer(src) ? src : undefined;
    if (!who) return say(src, "§cName a player.");
    setProtection(who, v === "off" ? 0 : Math.max(0, Number(v) || 20) * 60);
    return say(src, protectedLeft(who) > 0 ? `§7${who.name} is protected from other players for ${Math.ceil(protectedLeft(who) / 60)} min.` : `§7${who.name} has no newcomer protection now.`);
  }
  const [value, q, name] = parse(src, message);
  const needsValue = ["technique", "grade", "xp", "finger", "clan"].includes(cmd);
  const target = needsValue ? q : parse(src, `x ${message ?? ""}`)[1];
  if (!target) return say(src, name ? `§cNo player called ${name}.` : "§cName a player.");
  switch (cmd) {
    case "technique": {
      const tech = value === "random" ? rollTechnique(ensureClan(target), techniqueOf(target)) : value;
      if (!TECHNIQUES[tech]) return say(src, `§cUnknown technique. Use: ${Object.keys(TECHNIQUES).join(", ")}, random`);
      resetCooldowns(target);
      setTechnique(target, tech, "reroll");
      return say(src, `§7${target.name} now has ${TECHNIQUES[tech].name}${BOUND[tech] ? ` (and is of the ${CLANS[BOUND[tech]].name} clan)` : ""}.`);
    }
    case "clan": {
      if (!CLANS[value]) return say(src, `§cUnknown clan. Use: ${Object.keys(CLANS).join(", ")}`);
      setProp(target, "clan", value);
      let note = "";
      if (techniqueOf(target) && !canInherit(value, techniqueOf(target))) {
        resetCooldowns(target);
        setTechnique(target, rollTechnique(value, techniqueOf(target)), "reroll");
        note = ` Their old technique isn't in that blood: they now have ${TECHNIQUES[techniqueOf(target)].name}.`;
      }
      applyStats(target);
      return say(src, `§7${target.name} is now of the ${CLANS[value].name} clan.${note}`);
    }
    case "grade": {
      const g = Math.max(0, Math.min(GRADES.length - 1, parseInt(value, 10) || 0));
      setXp(target, GRADES[g].xp);
      syncItems(target);
      return say(src, `§7${target.name} is now ${GRADES[g].name}.`);
    }
    case "xp":
      addXp(target, parseInt(value, 10) || 0, "from an admin", true);
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
      for (const k of ["technique", "clan", "xp", "fingers", "ce", "black_flashes", "exorcised", "sorcerers_beaten", "moves_used", "hb", "vow", "vow_at",
        "mahoraga", "spirits"]) setProp(target, k, undefined);
      resetCooldowns(target);
      applyStats(target);
      awaken(target);
      return say(src, `§7${target.name} was reset and awakened again.`);
    default:
      return say(src, "§7Commands: jjk:record, admin, technique, clan, grade, xp, finger, ce, boss, mahoraga, tame_mahoraga, summon, reset, cinematics, vfx, cinematic, auto, bans, ban, unban, sanctuary, motd, event, clear, protection, credits");
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
