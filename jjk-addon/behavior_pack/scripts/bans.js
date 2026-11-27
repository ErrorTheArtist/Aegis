// Vanilla bans: this is a sorcerers' server. Vanilla armour, redstone and bundles are switched off, so cursed energy
// is what counts (and nobody lags the server with contraptions or dupes with bundles). Every other vanilla item stays:
// weapons, tools, food, blocks, farming. Each group can be switched back on (Admin Panel -> Server automation).
//   armour    every helmet, chestplate, leggings and boots, and the turtle shell
//   redstone  redstone dust, blocks and ore, and every contraption part: torches, repeaters, comparators, observers,
//             pistons, dispensers, droppers, hoppers, levers, lamps, detectors, targets, sculk sensors, crafters,
//             powered rails, TNT
//   bundles   bundles of every colour
//   + anything an admin bans by hand (/scriptevent jjk:ban <item id>)
// How it's kept: banned items leave survival players' inventories and armour slots within 2 s (they're told what went),
// using or placing one is cancelled, banned items dropped on the ground vanish, and redstone already in the world
// can't be switched. Creative and spectator players are left alone (builders, admins).

import { world, system } from "@minecraft/server";
import { worldProp, setWorldProp, isPlayer, gameMode, now, tell } from "./core.js";

const MATERIALS = ["leather", "chainmail", "iron", "golden", "diamond", "netherite", "copper"];
const PIECES = ["helmet", "chestplate", "leggings", "boots"];
export const GROUPS = {
  armour: {
    name: "Vanilla armour", prop: "ban_armour",
    ids: [...MATERIALS.flatMap((m) => PIECES.map((p) => `minecraft:${m}_${p}`)), "minecraft:turtle_helmet"],
    patterns: [],
  },
  redstone: {
    name: "Redstone", prop: "ban_redstone",
    ids: ["minecraft:redstone", "minecraft:redstone_block", "minecraft:redstone_ore", "minecraft:deepslate_redstone_ore",
      "minecraft:redstone_torch", "minecraft:repeater", "minecraft:comparator", "minecraft:observer", "minecraft:piston",
      "minecraft:sticky_piston", "minecraft:dispenser", "minecraft:dropper", "minecraft:hopper", "minecraft:lever",
      "minecraft:redstone_lamp", "minecraft:daylight_detector", "minecraft:target", "minecraft:tripwire_hook",
      "minecraft:sculk_sensor", "minecraft:calibrated_sculk_sensor", "minecraft:crafter", "minecraft:powered_rail",
      "minecraft:detector_rail", "minecraft:activator_rail", "minecraft:tnt", "minecraft:tnt_minecart",
      "minecraft:hopper_minecart", "minecraft:trapped_chest"],
    patterns: [/^minecraft:\w*copper_bulb$/],
  },
  bundles: { name: "Bundles", prop: "ban_bundles", ids: ["minecraft:bundle"], patterns: [/^minecraft:\w+_bundle$/] },
};
for (const g of Object.values(GROUPS)) g.set = new Set(g.ids);
// placed redstone that can't be switched while redstone is banned
const SWITCHES = [/:lever$/, /_repeater$|:repeater$/, /comparator$/, /daylight_detector/, /:crafter$/, /:dispenser$/, /:dropper$/, /:hopper$/];

export const groupOn = (key) => worldProp(GROUPS[key].prop, true) !== false;
export function setGroup(key, on) {
  setWorldProp(GROUPS[key].prop, !!on);
  conf.tick = -1;
}
export function extraBans() {
  return String(worldProp("bans_extra", "")).split(",").map((s) => s.trim()).filter(Boolean);
}
// Returns a message for the admin.
export function banItem(id, on) {
  id = String(id ?? "").trim().toLowerCase();
  if (!id) return "§7Name an item, e.g. §fminecraft:totem_of_undying";
  if (!id.includes(":")) id = `minecraft:${id}`;
  if (id.startsWith("jjk:")) return "§cJujutsu Legacy's own items can't be banned.";
  const list = new Set(extraBans());
  if (on) list.add(id);
  else list.delete(id);
  setWorldProp("bans_extra", [...list].join(","));
  conf.tick = -1;
  return on ? `§7Banned §f${id}§7.` : `§7§f${id}§7 is allowed again (unless one of the groups bans it).`;
}

// The rules, read once a tick (items appear often: every one is checked).
let conf = { tick: -1, groups: [], extra: new Set() };
function rules() {
  if (conf.tick !== now()) conf = { tick: now(), groups: Object.keys(GROUPS).filter(groupOn), extra: new Set(extraBans()) };
  return conf;
}
// Which group bans this item (or "extra"), or null.
export function bannedBy(id) {
  if (!id || id.startsWith("jjk:")) return null;
  const r = rules();
  for (const key of r.groups) {
    const g = GROUPS[key];
    if (g.set.has(id) || g.patterns.some((x) => x.test(id))) return key;
  }
  return r.extra.has(id) ? "extra" : null;
}
export const isBanned = (id) => bannedBy(id) !== null;
// A sentence for players: what this server bans.
export function bansLine() {
  const on = Object.keys(GROUPS).filter(groupOn).map((k) => GROUPS[k].name.toLowerCase());
  const n = extraBans().length;
  if (!on.length) return n ? `${n} item${n === 1 ? " is" : "s are"} banned` : "";
  const list = on.length > 1 ? `${on.slice(0, -1).join(", ")} and ${on.at(-1)}` : on[0];
  return `${list[0].toUpperCase()}${list.slice(1)}${n ? ` (and ${n} more item${n === 1 ? "" : "s"})` : ""} ${on.length > 1 || n ? "are" : "is"} banned`;
}

const exempt = (p) => /creative|spectator/.test(gameMode(p));
const nice = (id) => id.replace(/^minecraft:/, "").replace(/_/g, " ");
const told = new Map(); // player id -> tick
function report(p, names) {
  if (!names.length || now() - (told.get(p.id) ?? -1e9) < 200) return;
  told.set(p.id, now());
  const shown = [...new Set(names)];
  tell(p, `§c${bansLine()} on this server §7— removed: §f${shown.slice(0, 4).join(", ")}${shown.length > 4 ? "…" : ""}§7. Your cursed energy is your armour.`);
}

// Takes every banned item off one player. Returns how many stacks went.
export function sweep(p) {
  const gone = [];
  try {
    const inv = p.getComponent("minecraft:inventory")?.container;
    for (let i = 0; inv && i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it && isBanned(it.typeId)) {
        inv.setItem(i, undefined);
        gone.push(nice(it.typeId));
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const eq = p.getComponent("minecraft:equippable");
    for (const slot of ["Head", "Chest", "Legs", "Feet", "Offhand"]) {
      const it = eq?.getEquipment(slot);
      if (it && isBanned(it.typeId)) {
        eq.setEquipment(slot, undefined);
        gone.push(nice(it.typeId));
      }
    }
  } catch {
    /* ignore */
  }
  report(p, gone);
  return gone.length;
}

export function initBans() {
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) if (!exempt(p)) sweep(p);
  }, 40);
  // using a banned item (eating, throwing, equipping from the hand...)
  world.beforeEvents.itemUse.subscribe((ev) => {
    if (isPlayer(ev.source) && isBanned(ev.itemStack?.typeId) && !exempt(ev.source)) ev.cancel = true;
  });
  // placing a banned block, or switching redstone that's already in the world
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (exempt(ev.player)) return;
    if (isBanned(ev.itemStack?.typeId)) {
      ev.cancel = true;
      return;
    }
    const id = ev.block?.typeId ?? "";
    if (groupOn("redstone") && id.startsWith("minecraft:") && SWITCHES.some((r) => r.test(id))) {
      ev.cancel = true;
      system.run(() => {
        try {
          ev.player.onScreenDisplay.setActionBar("§7Redstone is switched off on this server.");
        } catch {
          /* ignore */
        }
      });
    }
  });
  // banned items lying on the ground (a zombie's helmet, mined redstone) vanish
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    try {
      if (entity?.typeId !== "minecraft:item") return;
      if (isBanned(entity.getComponent("minecraft:item")?.itemStack?.typeId)) entity.remove();
    } catch {
      /* ignore */
    }
  });
}
