// Choosing a village: the first time a player joins (or the first time after this update) they pick one of the
// great nations, get teleported there (it becomes their spawn point), receive a starter kit, and only then roll
// their clan and chakra nature and begin the starter quests.
//   /scriptevent aegis:village            — show your village
//   /scriptevent aegis:village choose     — pick again (admins / testing)
//   /scriptevent aegis:village home       — go back to your village

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";

export const VILLAGES = {
  leaf: { name: "Hidden Leaf", jp: "Konohagakure", color: "§a", pos: { x: 500, y: 74, z: -1412 } },
  sand: { name: "Hidden Sand", jp: "Sunagakure", color: "§6", pos: { x: -959, y: 88, z: -175 } },
  rain: { name: "Hidden Rain", jp: "Amegakure", color: "§9", pos: { x: -192, y: 70, z: -1197 } },
  stone: { name: "Hidden Stone", jp: "Iwagakure", color: "§7", pos: { x: -216, y: 95, z: -1533 } },
  cloud: { name: "Hidden Cloud", jp: "Kumogakure", color: "§e", pos: { x: 1980, y: 78, z: -2380 } },
  mist: { name: "Hidden Mist", jp: "Kirigakure", color: "§b", pos: { x: 2135, y: 77, z: -641 } },
};
const PROP = "aegis:village";
const KIT_PROP = "aegis:starter_kit";
const STARTER_KIT = [["aegis:kusanagi", 1], ["aegis:kunai", 8], ["aegis:chakra_pill", 3], ["aegis:ramen", 2]];

let api;
let after = () => {}; // clan roll → nature roll → starter quests (set by main.js)
const asking = new Set();

export function getVillage(player) {
  try {
    const v = player.getDynamicProperty(PROP);
    return VILLAGES[v] ? v : undefined;
  } catch {
    return undefined;
  }
}
export const villageLabel = (v) => (VILLAGES[v] ? `${VILLAGES[v].color}${VILLAGES[v].name}` : "§8none");

function goHome(player, v) {
  const V = VILLAGES[v];
  const overworld = world.getDimension("overworld");
  try {
    player.teleport({ x: V.pos.x + 0.5, y: V.pos.y, z: V.pos.z + 0.5 }, { dimension: overworld });
  } catch {
    /* ignore */
  }
  try {
    player.setSpawnPoint({ dimension: overworld, x: V.pos.x, y: V.pos.y, z: V.pos.z });
  } catch {
    /* ignore */
  }
}

function giveKit(player) {
  if (player.getDynamicProperty(KIT_PROP)) return;
  player.setDynamicProperty(KIT_PROP, true);
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (const [id, n] of STARTER_KIT) {
    const s = new ItemStack(id, n);
    try {
      const left = inv ? inv.addItem(s) : s;
      if (left) player.dimension.spawnItem(left, player.location);
    } catch {
      player.dimension.spawnItem(s, player.location);
    }
  }
  player.sendMessage("§7You received your starter kit: §fKusanagi§7, kunai, Soldier Pills and ramen.");
}

// Shows the choice until the player picks (forms can't open while the world is still loading).
export async function askVillage(player, force = false) {
  if (asking.has(player.id) || (!force && getVillage(player))) return;
  asking.add(player.id);
  try {
    const ids = Object.keys(VILLAGES);
    const f = new ActionFormData()
      .title("§lChoose your village")
      .body("§7Every shinobi swears loyalty to a village. Choose where your journey begins — you'll be sent there and it becomes your home.");
    for (const v of ids) f.button(`${VILLAGES[v].color}${VILLAGES[v].name}\n§r§8${VILLAGES[v].jp}`);
    const r = await f.show(player);
    if (r.canceled || r.selection === undefined) {
      asking.delete(player.id);
      // closed or the screen was busy: ask again shortly
      system.runTimeout(() => api.isValid(player) && askVillage(player, force), 60);
      return;
    }
    const v = ids[r.selection];
    player.setDynamicProperty(PROP, v);
    asking.delete(player.id);
    goHome(player, v);
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      showTitle(player, `${VILLAGES[v].color}§l${VILLAGES[v].name}`, { subtitle: `§7${VILLAGES[v].jp} — your new home`, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
      api.particle(player.dimension, "aegis:smoke_puff", player.location);
      world.sendMessage(`§e${player.name} has joined the ${VILLAGES[v].color}${VILLAGES[v].name}§e!`);
      giveKit(player);
      after(player);
    }, 20);
  } catch {
    asking.delete(player.id);
    system.runTimeout(() => api.isValid(player) && askVillage(player, force), 60);
  }
}

export function initVillages(helpers, onChosen) {
  api = helpers;
  if (onChosen) after = onChosen;
  world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (!getVillage(player)) system.runTimeout(() => api.isValid(player) && askVillage(player), 40);
  });
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:village" || p?.typeId !== "minecraft:player") return;
    const cmd = String(message ?? "").trim().toLowerCase();
    if (cmd === "choose") return void askVillage(p, true);
    if (cmd === "home") {
      const v = getVillage(p);
      return v ? goHome(p, v) : p.sendMessage("§7You haven't chosen a village yet.");
    }
    p.sendMessage(`§7Your village: ${villageLabel(getVillage(p))}`);
  });
}
