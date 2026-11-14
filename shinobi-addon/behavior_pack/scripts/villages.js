// Village loyalty: a [Village] tag over your head, no friendly fire between village-mates (toggle for events),
// a village chat, a Return Home jutsu, and Village Honor — every kill earns honor for you and your village, shown on
// the village leaderboard in the Shinobi Record (Village button).
//   /scriptevent aegis:village friendlyfire on|off   — allow village-mates to hurt each other (e.g. for a tournament)
//   /scriptevent aegis:village honor                 — print the village leaderboard
//
// Choosing a village: the first time a player joins (or the first time after this update) they pick one of the
// great nations, get teleported there (it becomes their spawn point), receive a starter kit, and only then roll
// their clan and chakra nature and begin the starter quests.
//   /scriptevent aegis:village            — show your village
//   /scriptevent aegis:village choose     — pick again (admins / testing)
//   /scriptevent aegis:village home       — go back to your village

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { impactFx, sfx } from "./cinematic.js";

export const VILLAGES = {
  leaf: { name: "Hidden Leaf", jp: "Konohagakure", color: "§a", pos: { x: 500, y: 74, z: -1412 } },
  sand: { name: "Hidden Sand", jp: "Sunagakure", color: "§6", pos: { x: -959, y: 88, z: -175 } },
  rain: { name: "Hidden Rain", jp: "Amegakure", color: "§9", pos: { x: -192, y: 70, z: -1197 } },
  stone: { name: "Hidden Stone", jp: "Iwagakure", color: "§7", pos: { x: -216, y: 95, z: -1533 } },
  cloud: { name: "Hidden Cloud", jp: "Kumogakure", color: "§e", pos: { x: 1980, y: 78, z: -2380 } },
  mist: { name: "Hidden Mist", jp: "Kirigakure", color: "§b", pos: { x: 2135, y: 77, z: -641 } },
};
const SHORT = { leaf: "Leaf", sand: "Sand", rain: "Rain", stone: "Stone", cloud: "Cloud", mist: "Mist" };

// Village spirit: every village's own element hits 10% harder after you cast one of its jutsu (the Rain: any jutsu,
// while it rains), and each village has one more perk of its own.
export const VILLAGE_PERKS = {
  leaf: { element: "fire", name: "Will of Fire", text: "Fire Release jutsu +10% damage · +10% chakra regen", regen: 1.1 },
  sand: { element: "wind", name: "Desert Shield", text: "Wind Release jutsu +10% damage · 6% chance the sand blocks a hit", block: 0.06 },
  mist: { element: "water", name: "Born of the Mist", text: "Water Release jutsu +10% damage · breathe underwater", effects: { water_breathing: 0 } },
  cloud: { element: "lightning", name: "Lightning Reflexes", text: "Lightning Release jutsu +10% damage · jutsu cooldowns 10% shorter", cooldown: 0.9 },
  stone: { element: "earth", name: "Unbreakable", text: "Earth Release jutsu +10% damage · take 8% less damage", guard: 0.08 },
  rain: { element: "rain", name: "Endless Rain", text: "Every jutsu +10% damage while it rains · immune to poison", immune: ["poison"] },
};
export const VILLAGE_ELEMENT_BONUS = 1.1;
export const villagePerk = (player) => VILLAGE_PERKS[getVillage(player)];
export const villageRegenMultiplier = (player) => villagePerk(player)?.regen ?? 1;
export const villageCooldownMultiplier = (player) => villagePerk(player)?.cooldown ?? 1;
export const villageEffectLevels = (player) => villagePerk(player)?.effects ?? {};
let raining = false;
export const isRaining = () => raining;

// Every village's shinobi gear: its headband (worn for faster chakra regen) and its flak jacket.
export const VILLAGE_GEAR = {
  leaf: { headband: "aegis:headband", headbandName: "Hidden Leaf Headband", jacket: "aegis:flak_jacket", jacketName: "Leaf Flak Jacket" },
  sand: { headband: "aegis:sand_headband", headbandName: "Hidden Sand Headband", jacket: "aegis:sand_flak_jacket", jacketName: "Sand Flak Jacket" },
  mist: { headband: "aegis:mist_headband", headbandName: "Hidden Mist Headband", jacket: "aegis:mist_flak_jacket", jacketName: "Mist Flak Jacket" },
  cloud: { headband: "aegis:cloud_headband", headbandName: "Hidden Cloud Headband", jacket: "aegis:cloud_flak_jacket", jacketName: "Cloud Flak Jacket" },
  stone: { headband: "aegis:stone_headband", headbandName: "Hidden Stone Headband", jacket: "aegis:stone_flak_jacket", jacketName: "Stone Flak Jacket" },
  rain: { headband: "aegis:rain_headband", headbandName: "Hidden Rain Headband", jacket: "aegis:rain_cloak", jacketName: "Rain Cloak" },
};
// One block per blow: the Sand perk and the Sand / Kazekage sets never both refund the same hit.
const blockTick = new Map();
export function claimBlock(entity) {
  const t = system.currentTick;
  if (blockTick.get(entity.id) === t) return false;
  blockTick.set(entity.id, t);
  return true;
}
export const HEADBANDS = new Set(Object.values(VILLAGE_GEAR).map((g) => g.headband));
export const gearOf = (player) => VILLAGE_GEAR[getVillage(player)] ?? VILLAGE_GEAR.leaf;
const GEAR_PROP = "aegis:vgear"; // got their village's headband (v1.51)
const KAGE_OF = { hokage: "leaf", kazekage: "sand", mizukage: "mist", raikage: "cloud", tsuchikage: "stone" };
const STATS_PROP = "aegis:vstats"; // world: { leaf: { members, honor, top: [[name, honor], ...] }, ... }
const COUNTED_PROP = "aegis:vcounted"; // player: the village this player is counted as a member of
const HONOR_PROP = "aegis:honor";
const FF_PROP = "aegis:ff";
const HOME_CD = 12000; // Return Home: 10 min
// honor per kill
const HONOR = { monster: 1, ninja: 3, akatsuki: 25, legend: 40, bijuu: 60 };
const BEASTS = ["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"];
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
export const villageTag = (v) => (VILLAGES[v] ? `${VILLAGES[v].color}[${SHORT[v]}]§r ` : "");

// ---------------------------------------------------------------------------
// Friendly fire
// ---------------------------------------------------------------------------
export const friendlyFire = () => !!world.getDynamicProperty(FF_PROP);
export function sameVillage(a, b) {
  if (a?.typeId !== "minecraft:player" || b?.typeId !== "minecraft:player" || a.id === b.id || friendlyFire()) return false;
  const v = getVillage(a);
  return !!v && v === getVillage(b);
}

// ---------------------------------------------------------------------------
// Village stats: members, honor, top shinobi
// ---------------------------------------------------------------------------
function readStats() {
  let s;
  try {
    s = JSON.parse(world.getDynamicProperty(STATS_PROP) ?? "{}");
  } catch {
    s = {};
  }
  for (const v of Object.keys(VILLAGES)) s[v] = { members: 0, honor: 0, top: [], ...(s[v] ?? {}) };
  return s;
}
const writeStats = (s) => world.setDynamicProperty(STATS_PROP, JSON.stringify(s));

export const getHonor = (p) => Number(p.getDynamicProperty(HONOR_PROP) ?? 0) || 0;

// Keeps the member count right when a player chooses (or changes) a village.
function syncMember(player) {
  const v = getVillage(player);
  const c = player.getDynamicProperty(COUNTED_PROP);
  if (c === v) return;
  const s = readStats();
  if (VILLAGES[c]) {
    s[c].members = Math.max(0, s[c].members - 1);
    s[c].top = s[c].top.filter(([n]) => n !== player.name);
  }
  if (v) s[v].members += 1;
  writeStats(s);
  player.setDynamicProperty(COUNTED_PROP, v);
}

export function addHonor(player, n) {
  const v = getVillage(player);
  if (!v || n <= 0) return;
  const mine = getHonor(player) + n;
  player.setDynamicProperty(HONOR_PROP, mine);
  const s = readStats();
  s[v].honor += n;
  const top = s[v].top.filter(([name]) => name !== player.name);
  top.push([player.name, mine]);
  top.sort((a, b) => b[1] - a[1]);
  s[v].top = top.slice(0, 5);
  writeStats(s);
}

function killHonor(dead) {
  const t = dead.typeId;
  if (t === "aegis:legend") return HONOR.legend;
  if (t === "aegis:akatsuki") return HONOR.akatsuki;
  if (t === "aegis:hostile_ninja") return HONOR.ninja;
  if (BEASTS.some((b) => t === `aegis:${b}`)) return HONOR.bijuu;
  try {
    if (dead.matches?.({ families: ["monster"] })) return HONOR.monster;
  } catch {
    /* ignore */
  }
  return 0;
}

function kageHolders() {
  try {
    return JSON.parse(world.getDynamicProperty("aegis:kages") ?? "{}");
  } catch {
    return {};
  }
}

export function leaderboardText() {
  const s = readStats();
  const kages = kageHolders();
  const order = Object.keys(VILLAGES).sort((a, b) => s[b].honor - s[a].honor);
  const medal = ["§6#1", "§7#2", "§c#3"];
  return order
    .map((v, i) => {
      const k = Object.entries(kages).find(([kage]) => KAGE_OF[kage] === v);
      const top = s[v].top.slice(0, 3).map(([n, h]) => `§f${n} §8(${h})`).join("§7, ");
      return [
        `${medal[i] ?? `§8#${i + 1}`} ${villageLabel(v)} §7— §e${s[v].honor} honor §8· §7${s[v].members} shinobi`,
        k ? `   §7Kage: §f${k[1].name}` : "",
        top ? `   §7Top: ${top}` : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Village menu (from the Shinobi Record)
// ---------------------------------------------------------------------------
const lastHurt = new Map(); // player id -> tick

export async function villageMenu(player) {
  const v = getVillage(player);
  if (!v) return askVillage(player);
  const V = VILLAGES[v];
  const mates = world.getAllPlayers().filter((p) => p.id !== player.id && getVillage(p) === v);
  const r = await new ActionFormData()
    .title(`§l${V.color}${V.name}`)
    .body(
      [
        `§8${V.jp}`,
        `§7Village spirit — §f${VILLAGE_PERKS[v].name}§7: ${VILLAGE_PERKS[v].text}`,
        `§7Your honor: §e${getHonor(player)}`,
        `§7Online village-mates: ${mates.length ? mates.map((p) => `§f${p.name}`).join("§7, ") : "§8none"}`,
        friendlyFire() ? "§cFriendly fire is ON (event)" : "§aVillage-mates can't hurt each other.",
      ].join("\n")
    )
    .button(`${V.color}Village chat\n§r§8message everyone in your village`)
    .button("§eVillage leaderboard\n§r§8honor of the great villages")
    .button("§bReturn Home\n§r§8teleport to your village (10 min cooldown)")
    .button("Close")
    .show(player);
  if (r.canceled) return;
  if (r.selection === 0) return villageChat(player);
  if (r.selection === 1) {
    await new ActionFormData().title("§lVillage Honor").body(leaderboardText() + "\n\n§8Earn honor by defeating enemies: mobs 1, ninja 3, Akatsuki 25, legends 40, tailed beasts 60.").button("Back").show(player);
    return villageMenu(player);
  }
  if (r.selection === 2) return returnHome(player);
}

async function villageChat(player) {
  const v = getVillage(player);
  const r = await new ModalFormData().title(`${VILLAGES[v].color}Village chat`).textField("Message (only your village sees it)", "Meet at the gate…").show(player);
  if (r.canceled || !r.formValues) return;
  const msg = String(r.formValues[0] ?? "").replace(/§./g, "").trim().slice(0, 200);
  if (!msg) return;
  for (const p of world.getAllPlayers()) {
    if (getVillage(p) === v) p.sendMessage(`${VILLAGES[v].color}[${SHORT[v]} chat] §f${player.name}§7: §f${msg}`);
  }
}

function returnHome(player) {
  const v = getVillage(player);
  if ((lastHurt.get(player.id) ?? -1e9) > system.currentTick - 200) return player.sendMessage("§cYou can't return home in the middle of a fight.");
  const left = api.cooldownLeft(player, "aegis:return_home");
  if (left > 0) return player.sendMessage(`§7Return Home is ready in §f${Math.ceil(left / 20)}s§7.`);
  api.startCooldown(player, "aegis:return_home", HOME_CD);
  const dim = player.dimension;
  api.particle(dim, "aegis:smoke_puff", player.location);
  sfx(dim, "aegis.whoosh", player.location, 1, 1.2);
  goHome(player, v);
  system.runTimeout(() => api.isValid(player) && (api.particle(player.dimension, "aegis:smoke_puff", player.location), showTitle(player, `${VILLAGES[v].color}${VILLAGES[v].name}`, { subtitle: "§7Welcome home", stayDuration: 30 })), 4);
}

// ---------------------------------------------------------------------------
// Sand Gourd (Hidden Sand's village quest reward): Sand Coffin / Sand Shield
// ---------------------------------------------------------------------------
export const GOURD = "aegis:sand_gourd";
const SAND = [0.85, 0.72, 0.45];
export function handleGourdUse(player, itemStack) {
  if (itemStack?.typeId !== GOURD) return false;
  const shield = player.isSneaking;
  const key = shield ? "gourd_shield" : "gourd_coffin";
  const cost = shield ? 20 : 30;
  const left = api.cooldownLeft(player, key);
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7${shield ? "Sand Shield" : "Sand Coffin"} ready in §f${(left / 20).toFixed(1)}s`);
    return true;
  }
  if (api.getChakra(player) < cost) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(api.getChakra(player))}/${cost})`);
    return true;
  }
  const dim = player.dimension;
  if (shield) {
    api.anim(player, "animation.aegis.both_palms");
    try {
      player.addEffect("resistance", 80, { amplifier: 2, showParticles: false });
    } catch {
      /* ignore */
    }
    for (let k = 0; k < 80; k += 5) system.runTimeout(() => api.isValid(player) && api.particle(player.dimension, "aegis:cine_ring", player.location, SAND), k);
    sfx(dim, "aegis.whoosh", player.location, 1, 0.6);
    player.onScreenDisplay.setActionBar("§6Sand Shield §7— damage reduced for 4s");
    api.startCooldown(player, key, 400);
  } else {
    let t;
    try {
      t = player.getEntitiesFromViewDirection({ maxDistance: 18 }).map((h) => h.entity).find((e) => api.canBeHit(e, player));
    } catch {
      t = undefined;
    }
    if (!t) {
      player.onScreenDisplay.setActionBar("§7Look at an enemy within 18 blocks.");
      return true;
    }
    api.anim(player, "animation.aegis.palm_thrust");
    sfx(dim, "aegis.whoosh", t.location, 1.2, 0.5);
    try {
      t.addEffect("slowness", 40, { amplifier: 6 });
    } catch {
      /* ignore */
    }
    for (let k = 0; k < 20; k += 2) {
      system.runTimeout(() => {
        if (!api.isValid(t)) return;
        api.particle(t.dimension, "aegis:cine_debris", { x: t.location.x, y: t.location.y + (k / 20) * 2, z: t.location.z }, SAND);
        api.particle(t.dimension, "aegis:dust", t.location);
      }, k);
    }
    system.runTimeout(() => {
      if (!api.isValid(t)) return;
      api.hurt(t, 14, player);
      impactFx(t.dimension, t.location, SAND, 1.5);
      sfx(t.dimension, "aegis.impact", t.location, 1.2, 0.7);
    }, 22);
    api.startCooldown(player, key, 200);
  }
  api.setChakra(player, api.getChakra(player) - cost);
  return true;
}

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

// Players who chose their village before v1.51 (whose starter kit had no headband): one headband of their own village.
function giftHeadband(player) {
  if (player.getDynamicProperty(GEAR_PROP)) return;
  player.setDynamicProperty(GEAR_PROP, true);
  const v = getVillage(player);
  if (!v) return;
  const s = new ItemStack(VILLAGE_GEAR[v].headband, 1);
  try {
    const left = player.getComponent("minecraft:inventory")?.container?.addItem(s);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    player.dimension.spawnItem(s, player.location);
  }
  player.sendMessage(`${VILLAGES[v].color}A gift from your village: §fyour ${VILLAGE_GEAR[v].headbandName}§7. Wear it for faster chakra regen.`);
}

function giveKit(player) {
  if (player.getDynamicProperty(KIT_PROP)) return;
  player.setDynamicProperty(KIT_PROP, true);
  const inv = player.getComponent("minecraft:inventory")?.container;
  player.setDynamicProperty(GEAR_PROP, true);
  for (const [id, n] of [...STARTER_KIT, [gearOf(player).headband, 1]]) {
    const s = new ItemStack(id, n);
    try {
      const left = inv ? inv.addItem(s) : s;
      if (left) player.dimension.spawnItem(left, player.location);
    } catch {
      player.dimension.spawnItem(s, player.location);
    }
  }
  player.sendMessage(`§7You received your starter kit: §fKusanagi§7, kunai, Soldier Pills, ramen and your §f${gearOf(player).headbandName}§7.`);
}

// Shows the choice until the player picks (forms can't open while the world is still loading).
export async function askVillage(player, force = false) {
  if (asking.has(player.id) || (!force && getVillage(player))) return;
  asking.add(player.id);
  try {
    const ids = Object.keys(VILLAGES);
    const f = new ActionFormData()
      .title("§lChoose your village")
      .body("§7Every shinobi swears loyalty to a village. Choose where your journey begins — you'll be sent there and it becomes your home.\n\n" +
        ids.map((v) => `${VILLAGES[v].color}${SHORT[v]}§7 — §f${VILLAGE_PERKS[v].name}§7: ${VILLAGE_PERKS[v].text}`).join("\n"));
    for (const v of ids) f.button(`${VILLAGES[v].color}${VILLAGES[v].name}\n§r§8${VILLAGES[v].jp} · ${VILLAGE_PERKS[v].name}`);
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
    syncMember(player);
    api.refreshName?.(player);
    system.runTimeout(() => {
      if (!api.isValid(player)) return;
      showTitle(player, `${VILLAGES[v].color}§l${VILLAGES[v].name}`, { subtitle: `§7${VILLAGES[v].jp} — your new home`, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
      api.particle(player.dimension, "aegis:smoke_puff", player.location);
      world.sendMessage(`§e${player.name} has joined the ${VILLAGES[v].color}${VILLAGES[v].name}§e!`);
      player.sendMessage(`${VILLAGES[v].color}${VILLAGE_PERKS[v].name}§7: ${VILLAGE_PERKS[v].text}.`);
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
    else {
      syncMember(player); // players from before the leaderboard existed
      if (!player.getDynamicProperty(GEAR_PROP)) system.runTimeout(() => api.isValid(player) && giftHeadband(player), 60);
    }
  });

  // The Rain's spirit follows the weather.
  try {
    const w = world.getDimension("overworld").getWeather?.();
    if (w) raining = String(w) !== "Clear";
  } catch {
    /* ignore */
  }
  world.afterEvents.weatherChange?.subscribe(({ newWeather, dimension }) => {
    if (!dimension || String(dimension).includes("overworld")) raining = String(newWeather) !== "Clear";
  });

  // Village perks that need a moment of their own: poison immunity (Rain), the sand's block (Sand), less damage (Stone).
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      for (const id of villagePerk(p)?.immune ?? []) {
        try {
          if (p.getEffect(id)) p.removeEffect(id);
        } catch {
          /* ignore */
        }
      }
    }
  }, 10);
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (hurtEntity.typeId !== "minecraft:player" || damage <= 0) return;
    const perk = villagePerk(hurtEntity);
    if (!perk) return;
    let back = (perk.guard ?? 0) * damage;
    const blocked = perk.block && Math.random() < perk.block && claimBlock(hurtEntity);
    if (blocked) back = damage;
    if (back <= 0) return;
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue <= 0) return;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + back));
      if (blocked) {
        api.particle(hurtEntity.dimension, "aegis:dust", hurtEntity.location);
        api.sound(hurtEntity.dimension, "dig.sand", hurtEntity.location, 0.8, 0.8);
        hurtEntity.onScreenDisplay.setActionBar("§6The sand blocks the blow!");
      }
    } catch {
      /* ignore */
    }
  });

  // Village honor for every kill (yours or your companions' / summons')
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    let k = damageSource?.damagingEntity;
    if (!k || deadEntity.typeId === "minecraft:player") return;
    if (k.typeId !== "minecraft:player") {
      try {
        k = world.getEntity(k.getDynamicProperty("aegis:owner"));
      } catch {
        k = undefined;
      }
    }
    if (k?.typeId !== "minecraft:player") return;
    let n = 0;
    try {
      if (deadEntity.getDynamicProperty("aegis:no_xp")) return;
      n = killHonor(deadEntity);
    } catch {
      return;
    }
    if (n) addHonor(k, n);
  });

  // No friendly fire: village-mates' blows can't land (weakness while aiming at one), and anything that still gets
  // through (arrows, splash, summons) is healed straight back.
  system.runInterval(() => {
    if (friendlyFire()) return;
    for (const p of world.getAllPlayers()) {
      if (!getVillage(p)) continue;
      let t;
      try {
        t = p.getEntitiesFromViewDirection({ maxDistance: 5 })[0]?.entity;
      } catch {
        continue;
      }
      if (t && sameVillage(p, t)) {
        try {
          p.addEffect("weakness", 6, { amplifier: 50, showParticles: false });
        } catch {
          /* ignore */
        }
      }
    }
  }, 3);
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (hurtEntity.typeId !== "minecraft:player") return;
    let a = damageSource?.damagingEntity;
    if (a && a.typeId !== "minecraft:player") {
      try {
        a = world.getEntity(a.getDynamicProperty("aegis:owner")) ?? a;
      } catch {
        /* keep */
      }
    }
    if (!sameVillage(hurtEntity, a)) {
      if (a) lastHurt.set(hurtEntity.id, system.currentTick);
      return;
    }
    try {
      const h = hurtEntity.getComponent("minecraft:health");
      if (h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage));
    } catch {
      /* ignore */
    }
    a.onScreenDisplay?.setActionBar(`§aYou can't hurt a fellow ${villageLabel(getVillage(a))}§a shinobi.`);
  });
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:village" || p?.typeId !== "minecraft:player") return;
    const cmd = String(message ?? "").trim().toLowerCase();
    if (cmd === "choose") return void askVillage(p, true);
    if (cmd === "friendlyfire on" || cmd === "friendlyfire off") {
      world.setDynamicProperty(FF_PROP, cmd.endsWith("on") ? true : undefined);
      return world.sendMessage(cmd.endsWith("on") ? "§cFriendly fire is ON — village-mates can hurt each other." : "§aFriendly fire is OFF — village-mates are safe from each other again.");
    }
    if (cmd === "honor") return p.sendMessage(`§lVillage Honor§r\n${leaderboardText()}`);
    if (cmd === "menu") return void villageMenu(p);
    if (cmd === "home") {
      const v = getVillage(p);
      return v ? goHome(p, v) : p.sendMessage("§7You haven't chosen a village yet.");
    }
    p.sendMessage(`§7Your village: ${villageLabel(getVillage(p))}`);
  });
}
