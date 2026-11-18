// Vanilla item bans (v1.54): this is a shinobi server — vanilla weapons and armour, redstone, bundles and a few
// game-breakers are switched off, so the add-on's gear is what counts. Every vanilla item that's useful for living —
// blocks, tools (pickaxes, axes, shovels, hoes), food, building and farming — stays.
//   • banned items are taken out of players' inventories and armour slots within a couple of seconds
//     (creative and spectator players are left alone);
//   • using one (drawing a bow, raising a shield, eating a totem…) is cancelled;
//   • redstone already placed in the world can't be operated (levers, buttons, repeaters, comparators…).
// Creative-only items (the Ten-Tails' spawn egg) are taken off survival players too, whether or not the bans are on.
//   /scriptevent aegis:vanilla           — show whether the bans are on
//   /scriptevent aegis:vanilla off | on  — allow / ban them again (admins)

import { world, system } from "@minecraft/server";

const OFF = "aegis:vanilla_allowed";
const MATERIALS = ["leather", "chainmail", "iron", "golden", "diamond", "netherite", "copper"];
const BANNED = new Set([
  // armour
  ...MATERIALS.flatMap((m) => ["helmet", "chestplate", "leggings", "boots"].map((p) => `minecraft:${m}_${p}`)),
  "minecraft:turtle_helmet", "minecraft:elytra", "minecraft:shield", "minecraft:wolf_armor",
  // weapons
  ...["wooden", "stone", "iron", "golden", "diamond", "netherite", "copper"].map((m) => `minecraft:${m}_sword`),
  "minecraft:bow", "minecraft:crossbow", "minecraft:trident", "minecraft:mace", "minecraft:arrow", "minecraft:tipped_arrow",
  "minecraft:spectral_arrow", "minecraft:wind_charge", "minecraft:totem_of_undying",
  // redstone & contraptions
  "minecraft:redstone", "minecraft:redstone_block", "minecraft:redstone_torch", "minecraft:repeater", "minecraft:comparator",
  "minecraft:piston", "minecraft:sticky_piston", "minecraft:observer", "minecraft:dispenser", "minecraft:dropper", "minecraft:hopper",
  "minecraft:lever", "minecraft:tripwire_hook", "minecraft:daylight_detector", "minecraft:target", "minecraft:redstone_lamp",
  "minecraft:tnt", "minecraft:tnt_minecart", "minecraft:hopper_minecart", "minecraft:powered_rail", "minecraft:detector_rail",
  "minecraft:activator_rail", "minecraft:sculk_sensor", "minecraft:calibrated_sculk_sensor", "minecraft:crafter",
  "minecraft:trapped_chest", "minecraft:lightning_rod", "minecraft:end_crystal", "minecraft:respawn_anchor",
  // satchels
  "minecraft:bundle",
]);
const BANNED_PATTERNS = [/^minecraft:\w+_bundle$/, /^minecraft:\w+_button$/, /^minecraft:\w+_pressure_plate$/, /^minecraft:\w*copper_bulb$/];
// placed redstone that can't be operated
const BLOCK_USE = [/lever$/, /_button$/, /repeater$/, /comparator$/, /daylight_detector/, /:crafter$/, /:dispenser$/, /:dropper$/, /:hopper$/];

// Creative-only: nobody keeps these outside creative, even with the vanilla bans off.
export const CREATIVE_ONLY = new Set(["aegis:juubi_spawn_egg"]);
export const isBanned = (id) => !!id && id.startsWith("minecraft:") && (BANNED.has(id) || BANNED_PATTERNS.some((r) => r.test(id)));
const allowed = () => !!world.getDynamicProperty(OFF);
export const vanillaBanned = () => !allowed();
// on = vanilla weapons, armour, redstone and bundles are banned (the default)
export function setVanillaBan(on) {
  world.setDynamicProperty(OFF, on ? undefined : true);
  world.sendMessage(on ? "§cVanilla weapons, armour, redstone and bundles are disabled again." : "§eVanilla weapons, armour, redstone and bundles are allowed again.");
}
const lastTold = new Map(); // player id -> tick
const exempt = (p) => {
  try {
    const gm = String(p.getGameMode()).toLowerCase();
    return gm === "creative" || gm === "spectator";
  } catch {
    return false;
  }
};

function tell(p, names, creativeOnly) {
  if (creativeOnly) p.sendMessage("§cThe Ten-Tails' spawn egg is creative-only §7— it was taken away.");
  if (!names.length || system.currentTick - (lastTold.get(p.id) ?? -1e9) < 200) return;
  lastTold.set(p.id, system.currentTick);
  p.sendMessage(`§cVanilla weapons, armour, redstone and bundles are disabled on this server §7— removed: §f${[...new Set(names)].slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}§7. Use shinobi gear from the Weaponsmith.`);
}

const nice = (id) => id.replace("minecraft:", "").replace(/_/g, " ");

// Takes every banned item off one player (only the creative-only ones when `vanilla` is false). Returns how many stacks went.
export function sweep(p, vanilla = true) {
  const bad = (id) => CREATIVE_ONLY.has(id) || (vanilla && isBanned(id));
  const gone = [];
  let egg = false;
  try {
    const inv = p.getComponent("minecraft:inventory")?.container;
    for (let i = 0; inv && i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it && bad(it.typeId)) {
        inv.setItem(i, undefined);
        if (CREATIVE_ONLY.has(it.typeId)) egg = true;
        else gone.push(nice(it.typeId));
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const eq = p.getComponent("minecraft:equippable");
    for (const slot of ["Head", "Chest", "Legs", "Feet", "Offhand"]) {
      const it = eq?.getEquipment(slot);
      if (it && bad(it.typeId)) {
        eq.setEquipment(slot, undefined);
        if (CREATIVE_ONLY.has(it.typeId)) egg = true;
        else gone.push(nice(it.typeId));
      }
    }
  } catch {
    /* ignore */
  }
  if (gone.length || egg) tell(p, gone, egg);
  return gone.length + (egg ? 1 : 0);
}

export function initBans() {
  system.runInterval(() => {
    const vanilla = !allowed();
    for (const p of world.getAllPlayers()) if (!exempt(p)) sweep(p, vanilla);
  }, 40);

  world.beforeEvents.itemUse.subscribe((ev) => {
    const id = ev.itemStack?.typeId;
    if (!(CREATIVE_ONLY.has(id) || (!allowed() && isBanned(id))) || exempt(ev.source)) return;
    ev.cancel = true;
  });

  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (CREATIVE_ONLY.has(ev.itemStack?.typeId) && !exempt(ev.player)) {
      ev.cancel = true; // a survival player can't hatch the Ten-Tails
      return;
    }
    if (allowed() || exempt(ev.player)) return;
    const id = ev.block?.typeId ?? "";
    if (!id.startsWith("minecraft:") || !BLOCK_USE.some((r) => r.test(id))) return;
    ev.cancel = true;
    system.run(() => ev.player.onScreenDisplay?.setActionBar("§7Redstone is switched off on this server."));
  });

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:vanilla") return;
    const cmd = String(message ?? "").trim().toLowerCase();
    if (cmd === "off" || cmd === "on") return setVanillaBan(cmd === "on");
    const msg = allowed() ? "§7Vanilla items are §aallowed§7. §f/scriptevent aegis:vanilla on§7 to ban them." :
      "§7Vanilla weapons, armour, redstone and bundles are §cbanned§7. §f/scriptevent aegis:vanilla off§7 to allow them.";
    if (p?.typeId === "minecraft:player") p.sendMessage(msg);
    else world.sendMessage(msg);
  });
}
