// Chakra natures (basic releases): Fire, Wind, Lightning, Earth, Water.
// Every player rolls one affinity the first time they join. Jutsu of a release you have cost 25% less chakra and
// hit 25% harder. More releases can be learned from the Jutsu Sensei. Anyone can still cast any basic jutsu.

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { spendRyo, fmtRyo } from "./currency.js";
import { getVillage, villagePerk, isRaining, VILLAGE_ELEMENT_BONUS } from "./villages.js";

export const NATURES = {
  fire: { name: "Fire Release", color: "§c", rgb: [1, 0.45, 0.1] },
  wind: { name: "Wind Release", color: "§a", rgb: [0.6, 1, 0.75] },
  lightning: { name: "Lightning Release", color: "§e", rgb: [0.6, 0.85, 1] },
  earth: { name: "Earth Release", color: "§6", rgb: [0.65, 0.5, 0.3] },
  water: { name: "Water Release", color: "§9", rgb: [0.3, 0.6, 1] },
};
const IDS = Object.keys(NATURES);

// Which basic release each jutsu scroll belongs to.
export const JUTSU_NATURE = {
  "aegis:fireball_scroll": "fire",
  "aegis:phoenix_scroll": "fire",
  "aegis:great_fire_scroll": "fire",
  "aegis:wind_scroll": "wind",
  "aegis:vacuum_scroll": "wind",
  "aegis:rasenshuriken_scroll": "wind",
  "aegis:chidori_scroll": "lightning",
  "aegis:chidori_current_scroll": "lightning",
  "aegis:chidori_spear_scroll": "lightning",
  "aegis:kirin_scroll": "lightning",
  "aegis:earth_wall_scroll": "earth",
  "aegis:earth_spikes_scroll": "earth",
  "aegis:water_dragon_scroll": "water",
  "aegis:water_prison_scroll": "water",
  // wave 3 (not clan-bound)
  "aegis:dragon_flame_scroll": "fire",
  "aegis:ash_burning_scroll": "fire",
  "aegis:water_shark_scroll": "water",
  "aegis:hiding_mist_scroll": "water",
  "aegis:water_shockwave_scroll": "water",
  "aegis:sickle_weasel_scroll": "wind",
  "aegis:pressure_damage_scroll": "wind",
  "aegis:lightning_hound_scroll": "lightning",
  "aegis:lightning_armor_scroll": "lightning",
  "aegis:earth_dragon_scroll": "earth",
  "aegis:headhunter_scroll": "earth",
  "aegis:swamp_scroll": "earth",
};

// Level + price (in units of 100 Ryō) for your 2nd, 3rd, 4th and 5th release.
export const NATURE_TRAINING = [null, null, { lvl: 25, ems: 24 }, { lvl: 50, ems: 40 }, { lvl: 90, ems: 56 }, { lvl: 140, ems: 64 }];

const PROP = "aegis:natures";
const AFFINITY_COST = 0.75;
const AFFINITY_DAMAGE = 1.25;
const BOOST_TICKS = 100; // damage dealt within 5s of casting an affinity jutsu is boosted

let api;
const boosted = new Map(); // player id -> tick the affinity damage boost ends
const villageBoost = new Map(); // player id -> tick the village-element boost ends

export function getNatures(player) {
  try {
    return String(player.getDynamicProperty(PROP) ?? "").split(",").filter((n) => NATURES[n]);
  } catch {
    return [];
  }
}

function setNatures(player, list) {
  player.setDynamicProperty(PROP, [...new Set(list)].filter((n) => NATURES[n]).join(","));
}

export const hasNature = (player, n) => getNatures(player).includes(n);
export const natureLabel = (n) => `${NATURES[n].color}${NATURES[n].name}`;

// Multiplier on a scroll's chakra cost (and starts the damage boost if it's an affinity jutsu).
export function natureCostMultiplier(player, itemId) {
  const n = JUTSU_NATURE[itemId];
  return n && hasNature(player, n) ? AFFINITY_COST : 1;
}

// Every scroll cast resets the boost: only an affinity jutsu starts it, anything else ends it.
export function onJutsuCast(player, itemId) {
  const n = JUTSU_NATURE[itemId];
  if (n && hasNature(player, n)) boosted.set(player.id, system.currentTick + BOOST_TICKS);
  else boosted.delete(player.id);
  // your village's spirit: its element (the Rain: any jutsu while it rains)
  const el = villagePerk(player)?.element;
  if ((n && n === el) || (el === "rain" && isRaining())) villageBoost.set(player.id, system.currentTick + BOOST_TICKS);
  else villageBoost.delete(player.id);
}

export function natureDamageMultiplier(attacker) {
  const now = system.currentTick;
  const until = boosted.get(attacker?.id);
  const vUntil = villageBoost.get(attacker?.id);
  return (until && now <= until ? AFFINITY_DAMAGE : 1) * (vUntil && now <= vUntil ? VILLAGE_ELEMENT_BONUS : 1);
}

export function natureTag(player, itemId) {
  const n = JUTSU_NATURE[itemId];
  return n && hasNature(player, n) ? ` ${NATURES[n].color}(affinity)` : "";
}

export function beginNatureRoll(player) {
  if (!getNatures(player).length) rollNature(player);
}

function rollNature(player) {
  const n = IDS[Math.floor(Math.random() * IDS.length)];
  setNatures(player, [n]);
  const N = NATURES[n];
  showTitle(player, `${N.color}${N.name}`, { subtitle: "§7Your chakra nature has awakened", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 15 });
  player.sendMessage(`§7Your chakra nature is ${natureLabel(n)}§7: those jutsu cost §f25% less§7 chakra and deal §f25% more§7 damage. Learn more releases from the §bJutsu Sensei§7.`);
  try {
    api.particle(player.dimension, "aegis:cine_ring", player.location, N.rgb);
    api.particle(player.dimension, "aegis:cine_swirl", player.location, N.rgb);
  } catch {
    /* ignore */
  }
}

// Jutsu Sensei: learn another release.
export async function natureTraining(player, priceOf, getLevel) {
  const have = getNatures(player);
  const next = NATURE_TRAINING[have.length + 1];
  if (!next) return player.sendMessage("§6You have mastered all five chakra natures.");
  const missing = IDS.filter((n) => !have.includes(n));
  const price = priceOf(next.ems);
  const f = new ActionFormData()
    .title("§lChakra Nature Training")
    .body(`§7Your releases: ${have.map(natureLabel).join("§7, ") || "§8none"}\n\n§7Learning release #${have.length + 1} costs §6${fmtRyo(price)}§7 and needs §eLv ${next.lvl}§7.`);
  for (const n of missing) f.button(`${natureLabel(n)}`);
  f.button("Leave");
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined || r.selection >= missing.length) return;
  if (getLevel(player) < next.lvl) return player.sendMessage(`§cReach level ${next.lvl} first.`);
  if (!spendRyo(player, price)) return player.sendMessage(`§cYou need ${fmtRyo(price)}.`);
  const n = missing[r.selection];
  setNatures(player, [...have, n]);
  showTitle(player, `${NATURES[n].color}${NATURES[n].name}`, { subtitle: "§7New chakra nature learned!", stayDuration: 50 });
  api.sound(player.dimension, "random.levelup", player.location, 1, 1.1);
}

export function initNatures(helpers) {
  api = helpers;

  // Roll on first join (after the clan reveal), and for older players who don't have one yet.
  world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (getNatures(player).length || !getVillage(player)) return; // new players: after choosing a village
    system.runTimeout(() => api.isValid(player) && !getNatures(player).length && rollNature(player), 240);
  });

  // /scriptevent aegis:nature info | reroll | add <nature> | set <nature> | clear
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:nature" || p?.typeId !== "minecraft:player") return;
    const [cmd, arg] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    if (cmd === "reroll") return rollNature(p);
    if (cmd === "clear") return setNatures(p, []);
    if ((cmd === "add" || cmd === "set") && NATURES[arg]) {
      setNatures(p, cmd === "add" ? [...getNatures(p), arg] : [arg]);
      return p.sendMessage(`§7Releases: ${getNatures(p).map(natureLabel).join("§7, ")}`);
    }
    p.sendMessage(`§7Releases: ${getNatures(p).map(natureLabel).join("§7, ") || "§8none"}`);
  });
}
