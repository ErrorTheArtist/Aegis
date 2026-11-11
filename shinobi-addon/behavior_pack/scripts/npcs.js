// NPCs: the creative-only NPC Spawner block, friendly NPC menus (shops, Mission Desk, Chūnin Exam
// Proctor, Clan Elder, chatter), missions, rank exams and ramen.
//
// NPC Spawner: place it (creative) → a settings form opens. Cover it with anything; the NPC appears
// in the first free space above and respawns according to its settings. Interact with the block
// (or sneak-interact with one of its NPCs) in creative to reconfigure it.
//   /scriptevent aegis:spawner   — open the settings of the spawner you're looking at

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { CLANS, getClanId, setClanPublic, applyNameTag } from "./clans.js";
import { getLevel, gainXp, getRank, setRank, addPoints, RANKS } from "./levels.js";
import { hasSageTraining, grantSage } from "./sage.js";
import { hasEternalMangekyo, awakenEternal } from "./clans.js";

const SPAWNER = "aegis:npc_spawner";
const INDEX_PROP = "aegis:spawners";
const SKIN_NAMES = ["Sensei", "Elder", "Weaponsmith", "Ramen chef", "Hokage", "Proctor", "Genin (orange)", "Genin (blue)",
  "Genin (pink)", "Rogue ninja", "Sound ninja", "Anbu", "Itachi", "Kisame", "Deidara", "Leaf chūnin"];

export const NPC_TYPES = {
  sensei: { label: "Jutsu Sensei (jutsu shop)", entity: "aegis:npc", skin: 0, name: "§bJutsu Sensei", friendly: true,
    greeting: "A ninja never stops training. What would you like to learn?" },
  clan_elder: { label: "Clan Elder", entity: "aegis:npc", skin: 1, name: "§6Clan Elder", friendly: true,
    greeting: "Our bloodline is our strength." },
  weaponsmith: { label: "Weaponsmith (tools & swords)", entity: "aegis:npc", skin: 2, name: "§7Weaponsmith", friendly: true,
    greeting: "Finest steel in the Land of Fire." },
  ramen: { label: "Ramen Shop", entity: "aegis:npc", skin: 3, name: "§eRamen Shop", friendly: true,
    greeting: "Welcome! One bowl or two?" },
  mission_desk: { label: "Hokage (Mission Desk)", entity: "aegis:npc", skin: 4, name: "§cHokage", friendly: true,
    greeting: "The village has work for you." },
  proctor: { label: "Chūnin Exam Proctor (rank exams)", entity: "aegis:npc", skin: 5, name: "§8Exam Proctor", friendly: true,
    greeting: "Think you're ready to rank up?" },
  villager: { label: "Leaf Shinobi (chatter)", entity: "aegis:npc", skin: 15, name: "§aLeaf Shinobi", friendly: true,
    greeting: "Nice weather for training, huh?" },
  genin: { label: "Genin (recruitable companion)", entity: "aegis:genin", skin: -1, name: "§fGenin", friendly: true,
    greeting: "Hire me and I'll fight by your side!" },
  rogue: { label: "Rogue Ninja (hostile)", entity: "aegis:hostile_ninja", skin: 9, name: "§cRogue Ninja", tier: "rogue" },
  sound: { label: "Sound Ninja (hostile)", entity: "aegis:hostile_ninja", skin: 10, name: "§5Sound Ninja", tier: "sound" },
  anbu: { label: "Anbu (hostile)", entity: "aegis:hostile_ninja", skin: 11, name: "§7Rogue Anbu", tier: "anbu" },
  akatsuki: { label: "Akatsuki (boss)", entity: "aegis:akatsuki", skin: 12, name: "Akatsuki", boss: true },
};
const TYPE_IDS = Object.keys(NPC_TYPES);
export const AKATSUKI = {
  itachi: { name: "§cItachi Uchiha", skin: 12 },
  kisame: { name: "§9Kisame Hoshigaki", skin: 13 },
  deidara: { name: "§eDeidara", skin: 14 },
};
const MEMBER_IDS = ["random", ...Object.keys(AKATSUKI)];

let api;
const configs = new Map(); // key -> config

// ---------------------------------------------------------------------------
// Inventory / economy helpers
// ---------------------------------------------------------------------------
function container(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

export function countItem(player, id) {
  const inv = container(player);
  let n = 0;
  if (inv) for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId === id) n += it.amount;
  }
  return n;
}

export function takeItem(player, id, n) {
  const inv = container(player);
  if (!inv || countItem(player, id) < n) return false;
  for (let i = 0; i < inv.size && n > 0; i++) {
    const it = inv.getItem(i);
    if (it?.typeId !== id) continue;
    const take = Math.min(n, it.amount);
    n -= take;
    if (take >= it.amount) inv.setItem(i, undefined);
    else {
      it.amount -= take;
      inv.setItem(i, it);
    }
  }
  return true;
}

export function giveItem(player, id, n = 1) {
  const inv = container(player);
  while (n > 0) {
    let stack;
    try {
      stack = new ItemStack(id, 1);
      const amt = Math.min(n, stack.maxAmount);
      stack.amount = amt;
      n -= amt;
    } catch {
      return;
    }
    const left = inv?.addItem(stack);
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

const isCreative = (p) => {
  try {
    return String(p.getGameMode()).toLowerCase() === "creative";
  } catch {
    return false;
  }
};

const priceOf = (base, cfg) => Math.max(1, Math.round(base * ((cfg?.price ?? 100) / 100)));

function say(player, npc, text) {
  player.sendMessage(`${npc.nameTag || "NPC"}§r§7: ${text}`);
}

// ---------------------------------------------------------------------------
// Spawner storage
// ---------------------------------------------------------------------------
const keyOf = (dim, loc) => `${dim.id.replace("minecraft:", "")}_${loc.x}_${loc.y}_${loc.z}`;
const tagOf = (key) => `aegis_sp_${key}`;

function loadAll() {
  configs.clear();
  let keys = [];
  try {
    keys = JSON.parse(world.getDynamicProperty(INDEX_PROP) ?? "[]");
  } catch {
    keys = [];
  }
  for (const k of keys) {
    try {
      const c = JSON.parse(world.getDynamicProperty(`aegis:sp:${k}`) ?? "null");
      if (c) configs.set(k, c);
    } catch {
      /* skip corrupt entry */
    }
  }
}

function save(cfg) {
  configs.set(cfg.key, cfg);
  world.setDynamicProperty(`aegis:sp:${cfg.key}`, JSON.stringify(cfg));
  world.setDynamicProperty(INDEX_PROP, JSON.stringify([...configs.keys()]));
}

function forget(key) {
  configs.delete(key);
  world.setDynamicProperty(`aegis:sp:${key}`, undefined);
  world.setDynamicProperty(INDEX_PROP, JSON.stringify([...configs.keys()]));
}

function defaultsFor(type) {
  const t = NPC_TYPES[type];
  const hostile = !t.friendly;
  return {
    type, name: "", skin: -1, clan: "random", member: "random",
    count: 1, respawn: true, delay: hostile ? 60 : 10, stay: !hostile && type !== "villager" && type !== "genin",
    radius: hostile ? 12 : 6, invuln: !hostile, price: 100, greeting: "", height: 0,
  };
}

// Creates (or replaces) a spawner block + config.
export function createSpawner(dim, loc, overrides = {}) {
  const pos = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
  try {
    dim.getBlock(pos)?.setType(SPAWNER);
  } catch {
    /* ignore */
  }
  const type = overrides.type ?? "sensei";
  const cfg = { ...defaultsFor(type), ...overrides, key: keyOf(dim, pos), dim: dim.id, ...pos, spawned: false };
  save(cfg);
  return cfg;
}

function removeNpcs(cfg) {
  try {
    for (const e of world.getDimension(cfg.dim).getEntities({ tags: [tagOf(cfg.key)] })) e.remove();
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------
function passable(b) {
  if (!b) return false;
  if (b.isAir) return true;
  if (b.isLiquid) return false;
  return typeof b.isSolid === "boolean" ? !b.isSolid : false;
}

function spawnPoint(dim, cfg) {
  if (cfg.height > 0) return { x: cfg.x + 0.5, y: cfg.y + cfg.height, z: cfg.z + 0.5 };
  for (let dy = 1; dy <= 24; dy++) {
    try {
      const a = dim.getBlock({ x: cfg.x, y: cfg.y + dy, z: cfg.z });
      const b = dim.getBlock({ x: cfg.x, y: cfg.y + dy + 1, z: cfg.z });
      if (passable(a) && passable(b)) return { x: cfg.x + 0.5, y: cfg.y + dy, z: cfg.z + 0.5 };
    } catch {
      return undefined;
    }
  }
  return { x: cfg.x + 0.5, y: cfg.y + 1, z: cfg.z + 0.5 };
}

function resolveSkin(cfg) {
  if (cfg.skin >= 0) return cfg.skin;
  if (cfg.type === "genin") return 6 + Math.floor(Math.random() * 3);
  if (cfg.type === "akatsuki") return AKATSUKI[cfg.memberResolved]?.skin ?? 12;
  return NPC_TYPES[cfg.type].skin;
}

export function setupNpc(e, cfg, extra = {}) {
  const t = NPC_TYPES[cfg.type];
  const member = cfg.type === "akatsuki" ? (cfg.member === "random" ? Object.keys(AKATSUKI)[Math.floor(Math.random() * 3)] : cfg.member) : undefined;
  cfg.memberResolved = member;
  try {
    if (cfg.key) e.addTag(tagOf(cfg.key));
    for (const tag of extra.tags ?? []) e.addTag(tag);
    e.setDynamicProperty("aegis:role", cfg.type);
    if (cfg.key) e.setDynamicProperty("aegis:spawner", cfg.key);
    if (member) e.setDynamicProperty("aegis:member", member);
    if (cfg.type === "clan_elder") {
      const clan = cfg.clan === "random" || !CLANS[cfg.clan] ? Object.keys(CLANS)[Math.floor(Math.random() * Object.keys(CLANS).length)] : cfg.clan;
      e.setDynamicProperty("aegis:elder_clan", clan);
      if (!cfg.name) e.nameTag = `${CLANS[clan].color}${CLANS[clan].name} Clan Elder`;
    }
    e.setProperty("aegis:skin", resolveSkin(cfg));
    if (cfg.name) e.nameTag = cfg.name;
    else if (member) e.nameTag = AKATSUKI[member].name;
    else if (cfg.type !== "clan_elder") e.nameTag = t.name;
    if (!extra.natural) e.triggerEvent("aegis:persist");
    if (t.tier) e.triggerEvent(`aegis:tier_${t.tier}`);
    if (t.friendly) {
      e.triggerEvent(cfg.stay ? "aegis:stay" : "aegis:wander");
      e.triggerEvent(cfg.invuln ? "aegis:invulnerable" : "aegis:vulnerable");
    } else if (cfg.invuln) e.triggerEvent("aegis:invulnerable");
  } catch {
    /* ignore */
  }
}

function spawnOne(dim, cfg) {
  const at = spawnPoint(dim, cfg);
  if (!at) return;
  try {
    const e = dim.spawnEntity(NPC_TYPES[cfg.type].entity, at);
    setupNpc(e, cfg);
    api.particle(dim, "aegis:smoke_puff", at);
  } catch {
    /* ignore */
  }
}

function tickSpawners() {
  const now = Date.now();
  for (const cfg of [...configs.values()]) {
    let dim;
    let block;
    try {
      dim = world.getDimension(cfg.dim);
      block = dim.getBlock({ x: cfg.x, y: cfg.y, z: cfg.z });
    } catch {
      continue; // unloaded
    }
    if (!block) continue;
    if (block.typeId !== SPAWNER) {
      removeNpcs(cfg);
      forget(cfg.key);
      continue;
    }
    if (!NPC_TYPES[cfg.type]) continue;
    const existing = dim.getEntities({ tags: [tagOf(cfg.key)] });
    // keep friendly NPCs near their post
    if (NPC_TYPES[cfg.type].friendly) {
      for (const e of existing) {
        const dx = e.location.x - (cfg.x + 0.5);
        const dz = e.location.z - (cfg.z + 0.5);
        if (Math.sqrt(dx * dx + dz * dz) > (cfg.stay ? 2 : cfg.radius) + 3) {
          const at = spawnPoint(dim, cfg);
          if (at) e.teleport(at);
        }
      }
    }
    const missing = cfg.count - existing.length;
    if (missing <= 0) {
      if (cfg.missingSince) {
        cfg.missingSince = undefined;
        save(cfg);
      }
      continue;
    }
    if (!cfg.spawned) {
      for (let i = 0; i < missing; i++) spawnOne(dim, cfg);
      cfg.spawned = true;
      save(cfg);
    } else if (cfg.respawn) {
      if (!cfg.missingSince) {
        cfg.missingSince = now;
        save(cfg);
      } else if (now - cfg.missingSince >= cfg.delay * 1000) {
        spawnOne(dim, cfg);
        cfg.missingSince = undefined;
        save(cfg);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Spawner settings UI
// ---------------------------------------------------------------------------
async function spawnerMenu(player, cfg) {
  const t = NPC_TYPES[cfg.type];
  const r = await new ActionFormData()
    .title("§lNPC Spawner")
    .body(`§7Type: §f${t.label}\n§7Name: §f${cfg.name || t.name}\n§7Count: §f${cfg.count}§7 · Respawn: §f${cfg.respawn ? cfg.delay + "s" : "off"}\n§7Position: §f${cfg.x} ${cfg.y} ${cfg.z}`)
    .button("§2Configure")
    .button("§9Respawn now")
    .button("§6Remove NPCs (they come back if respawn is on)")
    .button("§cDelete spawner")
    .show(player);
  if (r.canceled) return;
  if (r.selection === 0) return configure(player, cfg);
  if (r.selection === 1) {
    removeNpcs(cfg);
    cfg.spawned = false;
    save(cfg);
    player.sendMessage("§7Respawning…");
  } else if (r.selection === 2) {
    removeNpcs(cfg);
    cfg.missingSince = Date.now();
    save(cfg);
  } else if (r.selection === 3) {
    removeNpcs(cfg);
    forget(cfg.key);
    try {
      world.getDimension(cfg.dim).getBlock({ x: cfg.x, y: cfg.y, z: cfg.z })?.setType("minecraft:air");
    } catch {
      /* ignore */
    }
    player.sendMessage("§7Spawner deleted.");
  }
}

async function configure(player, cfg) {
  const clanIds = ["random", ...Object.keys(CLANS)];
  const f = new ModalFormData()
    .title("§lConfigure NPC Spawner")
    .dropdown("NPC type", TYPE_IDS.map((id) => NPC_TYPES[id].label), Math.max(0, TYPE_IDS.indexOf(cfg.type)))
    .textField("Name (empty = default; § colour codes work)", "default", cfg.name)
    .dropdown("Outfit", ["Default for this NPC", ...SKIN_NAMES], cfg.skin + 1)
    .dropdown("Clan (Clan Elder only)", clanIds.map((c) => (c === "random" ? "Random" : CLANS[c].name)), Math.max(0, clanIds.indexOf(cfg.clan)))
    .dropdown("Akatsuki member (Akatsuki only)", ["Random", "Itachi", "Kisame", "Deidara"], Math.max(0, MEMBER_IDS.indexOf(cfg.member)))
    .slider("How many to keep spawned", 1, 6, 1, cfg.count)
    .toggle("Respawn when killed / removed", cfg.respawn)
    .slider("Respawn delay (seconds)", 5, 600, 5, Math.max(5, cfg.delay))
    .toggle("Stay in place (friendly NPCs)", cfg.stay)
    .slider("Wander radius (blocks)", 2, 24, 1, cfg.radius)
    .toggle("Invulnerable", cfg.invuln)
    .slider("Shop prices / mission rewards (%)", 50, 300, 10, cfg.price)
    .textField("Greeting line (empty = default)", "default", cfg.greeting)
    .slider("Spawn height above block (0 = first free space)", 0, 10, 1, cfg.height);
  const r = await f.show(player);
  if (r.canceled || !r.formValues) return;
  const v = r.formValues;
  const oldType = cfg.type;
  cfg.type = TYPE_IDS[v[0]];
  if (cfg.type !== oldType) {
    // sensible defaults for the new type, then apply the rest of the form
    Object.assign(cfg, { ...defaultsFor(cfg.type), type: cfg.type });
  }
  cfg.name = String(v[1] ?? "").trim();
  cfg.skin = Number(v[2]) - 1;
  cfg.clan = clanIds[Number(v[3])] ?? "random";
  cfg.member = MEMBER_IDS[Number(v[4])] ?? "random";
  cfg.count = Number(v[5]);
  cfg.respawn = !!v[6];
  cfg.delay = Number(v[7]);
  if (cfg.type === oldType) {
    cfg.stay = !!v[8];
    cfg.invuln = !!v[10];
  }
  cfg.radius = Number(v[9]);
  cfg.price = Number(v[11]);
  cfg.greeting = String(v[12] ?? "").trim();
  cfg.height = Number(v[13]);
  removeNpcs(cfg);
  cfg.spawned = false;
  cfg.missingSince = undefined;
  save(cfg);
  player.sendMessage(`§aSpawner saved: §f${NPC_TYPES[cfg.type].label}§7. Cover the block if you like — the NPC spawns in the first free space above it.`);
}

function cfgForEntity(e) {
  try {
    return configs.get(e.getDynamicProperty("aegis:spawner"));
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------
const SHOPS = {
  sensei: [
    ["aegis:fireball_scroll", 1, "Fire Style: Fireball Jutsu", 8, 1],
    ["aegis:flash_scroll", 1, "Body Flicker", 6, 1],
    ["aegis:wind_scroll", 1, "Wind Style: Great Breakthrough", 10, 5],
    ["aegis:substitution_scroll", 1, "Substitution Jutsu", 10, 5],
    ["aegis:clone_scroll", 1, "Shadow Clone Jutsu", 16, 15],
    ["aegis:sphere_scroll", 1, "Rasengan", 24, 25],
    ["aegis:chidori_scroll", 1, "Chidori", 24, 25],
    ["aegis:phoenix_scroll", 1, "Phoenix Sage Fire", 12, 10],
    ["aegis:earth_wall_scroll", 1, "Earth Wall", 14, 12],
    ["aegis:water_dragon_scroll", 1, "Water Dragon Bullet", 16, 15],
    ["aegis:mystical_palm_scroll", 1, "Mystical Palm (healing)", 18, 20],
    ["aegis:chidori_current_scroll", 1, "Chidori Current", 20, 25],
    ["aegis:rasenshuriken_scroll", 1, "Rasenshuriken", 40, 50],
    ["aegis:summon_toad_scroll", 1, "Summoning: Toad", 20, 20],
    ["aegis:summon_slug_scroll", 1, "Summoning: Slug", 20, 20],
    ["aegis:summon_snake_scroll", 1, "Summoning: Snake", 20, 20],
    ["aegis:blank_scroll", 4, "Blank Scroll ×4", 2, 1],
    ["__sage", 0, "Sage Training (learn Sage Mode)", 48, 60],
  ],
  weaponsmith: [
    ["aegis:kunai", 8, "Kunai ×8", 3, 1],
    ["aegis:shuriken", 16, "Shuriken ×16", 3, 1],
    ["aegis:headband", 1, "Hidden Leaf Headband", 6, 1],
    ["aegis:chakra_blades", 1, "Chakra Blades", 30, 15],
    ["aegis:nuibari", 1, "Nuibari", 36, 20],
    ["aegis:kusanagi", 1, "Kusanagi", 40, 25],
    ["aegis:shibuki", 1, "Shibuki", 40, 25],
    ["aegis:kiba", 1, "Kiba", 44, 30],
    ["aegis:hiramekarei", 1, "Hiramekarei", 44, 30],
    ["aegis:samehada", 1, "Samehada", 48, 35],
    ["aegis:kubikiribocho", 1, "Kubikiribōchō", 48, 35],
    ["aegis:flak_jacket", 1, "Leaf Flak Jacket", 8, 1],
    ["aegis:shinobi_pants", 1, "Shinobi Pants", 6, 1],
    ["aegis:ninja_sandals", 1, "Ninja Sandals", 3, 1],
    ["aegis:anbu_mask", 1, "Anbu Mask", 12, 30],
    ["aegis:anbu_armor", 1, "Anbu Armor", 20, 30],
    ["aegis:samurai_helmet", 1, "Samurai Kabuto", 18, 40],
    ["aegis:samurai_armor", 1, "Samurai Dō", 28, 40],
    ["aegis:samurai_leggings", 1, "Samurai Haidate", 22, 40],
    ["aegis:samurai_boots", 1, "Samurai Suneate", 14, 40],
    ["__repair", 0, "Repair the item in your hand", 5, 1],
  ],
  ramen: [
    ["aegis:ramen", 1, "Ichiraku Ramen (heal, +60 chakra, regen)", 3, 1],
    ["aegis:miso_ramen", 1, "Miso Ramen (+30 chakra, speed)", 2, 1],
    ["aegis:chakra_pill", 3, "Soldier Pills ×3", 4, 1],
  ],
};

async function shop(player, npc, cfg, list, title) {
  const ems = countItem(player, "minecraft:emerald");
  const lvl = getLevel(player);
  const f = new ActionFormData().title(title).body(`§7${cfg?.greeting || NPC_TYPES[cfg?.type ?? npc.getDynamicProperty("aegis:role")]?.greeting || ""}\n\n§aYour emeralds: §f${ems}`);
  for (const [, , label, base, req] of list) {
    const p = priceOf(base, cfg);
    f.button(`${lvl < req ? "§8" : ems >= p ? "§2" : "§c"}${label}\n§r§7${p} emeralds${lvl < req ? ` · Lv ${req}` : ""}`);
  }
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  const [id, amount, label, base, req] = list[r.selection];
  const price = priceOf(base, cfg);
  if (lvl < req) player.sendMessage(`§cYou need to be level ${req} for that.`);
  else if (id === "__sage") {
    if (hasSageTraining(player)) player.sendMessage("§7You've already mastered Sage Mode.");
    else if (!takeItem(player, "minecraft:emerald", price)) player.sendMessage(`§cYou need ${price} emeralds.`);
    else return grantSage(player);
  } else if (id === "__repair") {
    const inv = container(player);
    const it = inv?.getItem(player.selectedSlotIndex);
    const dur = it?.getComponent("minecraft:durability");
    if (!dur || dur.damage <= 0) player.sendMessage("§7Hold a damaged item to repair it.");
    else if (!takeItem(player, "minecraft:emerald", price)) player.sendMessage(`§cYou need ${price} emeralds.`);
    else {
      dur.damage = 0;
      inv.setItem(player.selectedSlotIndex, it);
      api.sound(player.dimension, "random.anvil_use", player.location, 1, 1);
      player.sendMessage("§aGood as new!");
    }
  } else if (!takeItem(player, "minecraft:emerald", price)) player.sendMessage(`§cYou need ${price} emeralds.`);
  else {
    giveItem(player, id, amount);
    api.sound(player.dimension, "random.orb", player.location, 1, 1.2);
    player.sendMessage(`§aBought ${label}.`);
  }
  return shop(player, npc, cfg, list, title);
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------
const MISSIONS = {
  D: { lvl: 1, kind: "monster", need: 10, xp: 400, ems: 5, items: [], text: "Defeat 10 hostile mobs" },
  C: { lvl: 10, kind: "ninja", need: 5, xp: 1200, ems: 10, items: [["aegis:chakra_pill", 3]], text: "Defeat 5 enemy ninja" },
  B: { lvl: 25, kind: "ninja", need: 12, xp: 3000, ems: 16, items: [["minecraft:diamond", 3]], text: "Defeat 12 enemy ninja (rogue, Sound or Anbu)" },
  A: { lvl: 50, kind: "bijuu", need: 1, xp: 8000, ems: 24, items: [["minecraft:diamond", 6]], text: "Defeat a Tailed Beast" },
  S: { lvl: 80, kind: "akatsuki", need: 1, xp: 15000, ems: 40, items: [["aegis:bijuu_scroll", 1]], text: "Defeat an Akatsuki member (one will be sighted nearby)" },
};

const getMission = (p) => {
  try {
    return JSON.parse(p.getDynamicProperty("aegis:mission") ?? "null");
  } catch {
    return null;
  }
};
const setMission = (p, m) => p.setDynamicProperty("aegis:mission", m ? JSON.stringify(m) : undefined);

async function missionDesk(player, npc, cfg) {
  const m = getMission(player);
  const lvl = getLevel(player);
  const f = new ActionFormData().title("§lMission Desk");
  const opts = [];
  if (m) {
    const def = MISSIONS[m.rank];
    const done = m.progress >= def.need;
    f.body(`§7Current mission: §e${m.rank}-rank §f${def.text}\n§7Progress: §f${Math.min(m.progress, def.need)}/${def.need}`);
    if (done) {
      f.button("§2Report mission complete");
      opts.push("turnin");
    }
    f.button("§cAbandon mission");
    opts.push("abandon");
  } else {
    f.body(`§7${cfg?.greeting || NPC_TYPES.mission_desk.greeting}\n§7Choose a mission. Rewards scale with this desk's settings.`);
    for (const [rank, def] of Object.entries(MISSIONS)) {
      f.button(`${lvl < def.lvl ? "§8" : "§0"}${rank}-rank: ${def.text}\n§r§7${Math.round(def.xp * (cfg?.price ?? 100) / 100)} XP · ${priceOf(def.ems, cfg)} emeralds${lvl < def.lvl ? ` · Lv ${def.lvl}` : ""}`);
      opts.push(rank);
    }
  }
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  const choice = opts[r.selection];
  if (choice === "abandon") {
    setMission(player, null);
    say(player, npc, "Mission cancelled. Don't make a habit of it.");
  } else if (choice === "turnin") {
    const def = MISSIONS[m.rank];
    setMission(player, null);
    const mult = (cfg?.price ?? 100) / 100;
    gainXp(player, Math.round(def.xp * mult));
    giveItem(player, "minecraft:emerald", priceOf(def.ems, cfg));
    for (const [id, n] of def.items) giveItem(player, id, n);
    showTitle(player, `§a${m.rank}-rank complete!`, { subtitle: `§7+${Math.round(def.xp * mult)} XP, ${priceOf(def.ems, cfg)} emeralds`, stayDuration: 50 });
    api.sound(player.dimension, "random.levelup", player.location, 1, 1.2);
  } else if (choice) {
    const def = MISSIONS[choice];
    if (lvl < def.lvl) return player.sendMessage(`§cYou need to be level ${def.lvl} for ${choice}-rank missions.`);
    setMission(player, { rank: choice, progress: 0 });
    say(player, npc, `${choice}-rank mission: ${def.text}. Report back when it's done.`);
    if (def.kind === "akatsuki") api.spawnAkatsukiNear?.(player, "§cAn Akatsuki member has been sighted near you!");
  }
}

function missionProgress(killer, kind) {
  const m = getMission(killer);
  if (!m) return;
  const def = MISSIONS[m.rank];
  const matches = def.kind === kind || (def.kind === "monster" && kind !== "other") || (def.kind === "ninja" && kind === "akatsuki");
  if (!matches || m.progress >= def.need) return;
  m.progress++;
  setMission(killer, m);
  killer.onScreenDisplay.setActionBar(m.progress >= def.need ? "§aMission complete — report to the Mission Desk!" : `§eMission: §f${m.progress}/${def.need}`);
}

// ---------------------------------------------------------------------------
// Rank exams
// ---------------------------------------------------------------------------
const EXAMS = {
  1: { lvl: 20, waves: [["rogue", 4]], time: 90, bonus: 5, text: "Defeat 4 rogue ninja in 90 seconds" },
  2: { lvl: 60, waves: [["anbu", 3], ["sound", 3]], time: 120, bonus: 10, text: "Defeat 3 Anbu and 3 Sound ninja in 2 minutes" },
  3: { lvl: 120, waves: [["akatsuki", 1]], time: 180, bonus: 20, text: "Defeat an Akatsuki member in 3 minutes" },
};
const exams = new Map(); // player id -> { tag, deadline, rank }

async function proctor(player, npc, cfg) {
  const rank = getRank(player);
  const next = EXAMS[rank + 1];
  const f = new ActionFormData().title("§lRank Exams").body(
    `§7Your rank: §f${RANKS[rank]}\n` + (next ? `§7Next: §e${RANKS[rank + 1]}§7 — ${next.text}\n§7Requires Lv ${next.lvl}. Reward: +${next.bonus} stat points.` : "§6You hold the highest rank. The village bows to you, Kage.")
  );
  if (next) f.button(getLevel(player) >= next.lvl ? `§2Begin the ${RANKS[rank + 1]} Exam` : `§8${RANKS[rank + 1]} Exam (Lv ${next.lvl})`);
  f.button("Leave");
  const r = await f.show(player);
  if (r.canceled || !next || r.selection !== 0) return;
  if (getLevel(player) < next.lvl) return player.sendMessage(`§cCome back at level ${next.lvl}.`);
  if (exams.has(player.id)) return player.sendMessage("§cYou're already in an exam!");
  startExam(player, rank + 1);
}

function startExam(player, toRank) {
  const def = EXAMS[toRank];
  const tag = `aegis_exam_${player.id}`;
  const dim = player.dimension;
  let i = 0;
  for (const [type, n] of def.waves) {
    for (let k = 0; k < n; k++, i++) {
      const a = (i / 6) * Math.PI * 2;
      const at = { x: player.location.x + Math.cos(a) * 8, y: player.location.y + 0.5, z: player.location.z + Math.sin(a) * 8 };
      try {
        const e = dim.spawnEntity(NPC_TYPES[type].entity, at);
        setupNpc(e, { ...defaultsFor(type), type }, { tags: [tag] });
        api.particle(dim, "aegis:smoke_puff", at);
      } catch {
        /* ignore */
      }
    }
  }
  exams.set(player.id, { tag, deadline: system.currentTick + def.time * 20, rank: toRank, dim: dim.id });
  showTitle(player, `§e${RANKS[toRank]} Exam`, { subtitle: `§7${def.text} — begin!`, stayDuration: 50 });
}

function endExam(player, passed) {
  const ex = exams.get(player?.id);
  if (!ex) return;
  exams.delete(player.id);
  try {
    for (const e of world.getDimension(ex.dim).getEntities({ tags: [ex.tag] })) e.remove();
  } catch {
    /* ignore */
  }
  if (!player || !api.isValid(player)) return;
  if (passed) {
    setRank(player, ex.rank);
    addPoints(player, EXAMS[ex.rank].bonus);
    applyNameTag(player);
    showTitle(player, `§6${RANKS[ex.rank]}!`, { subtitle: `§7Exam passed — +${EXAMS[ex.rank].bonus} stat points`, stayDuration: 60 });
    if (ex.rank === 3) {
      giveItem(player, "aegis:hokage_hat", 1);
      giveItem(player, "aegis:hokage_robe", 1);
      player.sendMessage("§fYou received the §6Hokage Hat§f and §6Hokage Robe§f.");
    }
    api.sound(player.dimension, "ui.toast.challenge_complete", player.location, 1, 1);
    world.sendMessage(`§e${player.name} passed the exam and is now a §6${RANKS[ex.rank]}§e!`);
  } else {
    showTitle(player, "§cExam failed", { subtitle: "§7Train harder and try again.", stayDuration: 40 });
  }
}

function tickExams() {
  for (const [pid, ex] of [...exams]) {
    const player = world.getAllPlayers().find((p) => p.id === pid);
    if (!player) {
      endExam({ id: pid }, false);
      continue;
    }
    let left = 0;
    try {
      left = world.getDimension(ex.dim).getEntities({ tags: [ex.tag] }).length;
    } catch {
      /* ignore */
    }
    if (left === 0) endExam(player, true);
    else if (system.currentTick > ex.deadline) endExam(player, false);
    else player.onScreenDisplay.setActionBar(`§eExam: §f${left} left §7· ${Math.ceil((ex.deadline - system.currentTick) / 20)}s`);
  }
}

// ---------------------------------------------------------------------------
// Clan Elder
// ---------------------------------------------------------------------------
const MASTERY = [null, { lvl: 15, ems: 20 }, { lvl: 40, ems: 40 }, { lvl: 80, ems: 64 }];

async function clanElder(player, npc, cfg) {
  const clanId = npc.getDynamicProperty("aegis:elder_clan");
  const clan = CLANS[clanId];
  if (!clan) return;
  const mine = getClanId(player) === clanId;
  const mastery = Number(player.getDynamicProperty("aegis:clan_mastery") ?? 0);
  const f = new ActionFormData().title(`§l${clan.name} Clan Elder`);
  const opts = [];
  if (mine) {
    const next = MASTERY[mastery + 1];
    f.body(`§7${cfg?.greeting || `Welcome home, child of the ${clan.name}.`}\n\n§7Clan Mastery: §e${mastery}/3§7 (each level: +10% clan max chakra, −10% clan ability cooldowns)\n§7Perks: §f${clan.perks}`);
    if (next) {
      f.button(`§2Train Clan Mastery ${mastery + 1}\n§r§7${priceOf(next.ems, cfg)} emeralds · Lv ${next.lvl}`);
      opts.push("train");
    }
    if (clanId === "uchiha" && player.getDynamicProperty("aegis:mangekyo") === true && !hasEternalMangekyo(player)) {
      f.button(`§5Awaken the Eternal Mangekyō\n§r§7${priceOf(64, cfg)} emeralds · Lv 100`);
      opts.push("eternal");
    }
  } else {
    f.body(`§7You are not of the ${clan.color}${clan.name}§7. But blood can be… arranged.\n§7Perks of our clan: §f${clan.perks}`);
    f.button(`§5Bloodline transfer: join the ${clan.name}\n§r§7${priceOf(64, cfg)} emeralds · Lv 30 · replaces your clan`);
    opts.push("join");
  }
  f.button("Leave");
  opts.push("leave");
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  const c = opts[r.selection];
  if (c === "train") {
    const next = MASTERY[mastery + 1];
    if (getLevel(player) < next.lvl) return player.sendMessage(`§cReach level ${next.lvl} first.`);
    if (!takeItem(player, "minecraft:emerald", priceOf(next.ems, cfg))) return player.sendMessage(`§cYou need ${priceOf(next.ems, cfg)} emeralds.`);
    player.setDynamicProperty("aegis:clan_mastery", mastery + 1);
    showTitle(player, `${clan.color}Clan Mastery ${mastery + 1}`, { subtitle: "§7Your bloodline grows stronger", stayDuration: 50 });
    api.sound(player.dimension, "random.levelup", player.location, 1, 0.8);
  } else if (c === "eternal") {
    if (getLevel(player) < 100) return player.sendMessage("§cReach level 100 first.");
    if (!takeItem(player, "minecraft:emerald", priceOf(64, cfg))) return player.sendMessage(`§cYou need ${priceOf(64, cfg)} emeralds.`);
    awakenEternal(player);
  } else if (c === "join") {
    if (getLevel(player) < 30) return player.sendMessage("§cReach level 30 first.");
    const ok = await new MessageFormData().title("Bloodline transfer").body(`Replace your clan with the ${clan.name}? Clan Mastery and Mangekyō progress are lost.`).button1("§5Transfer").button2("Cancel").show(player);
    if (ok.selection !== 0) return;
    if (!takeItem(player, "minecraft:emerald", priceOf(64, cfg))) return player.sendMessage(`§cYou need ${priceOf(64, cfg)} emeralds.`);
    setClanPublic(player, clanId);
    showTitle(player, `${clan.color}${clan.name} Clan`, { subtitle: "§7Your bloodline has changed", stayDuration: 60 });
  }
}

// ---------------------------------------------------------------------------
// Talking to NPCs
// ---------------------------------------------------------------------------
const CHATTER = [
  "Have you tried focusing your chakra? Sneak and stand still.",
  "They say a Tailed Beast was spotted beyond the hills…",
  "The Hokage always has missions for those who ask.",
  "Akatsuki hunt Jinchūriki. Watch your back.",
  "The ramen here is the best in the village!",
  "The proctor's exams are no joke. Bring Soldier Pills.",
  "A sword's only as good as the chakra you put into it.",
];

async function talk(player, npc) {
  const role = npc.getDynamicProperty("aegis:role");
  const cfg = cfgForEntity(npc);
  if (player.isSneaking && isCreative(player) && cfg) return spawnerMenu(player, cfg);
  switch (role) {
    case "sensei":
      return shop(player, npc, cfg, SHOPS.sensei, "§lJutsu Sensei");
    case "weaponsmith":
      return shop(player, npc, cfg, SHOPS.weaponsmith, "§lWeaponsmith");
    case "ramen":
      return shop(player, npc, cfg, SHOPS.ramen, "§lRamen Shop");
    case "mission_desk":
      return missionDesk(player, npc, cfg);
    case "proctor":
      return proctor(player, npc, cfg);
    case "clan_elder":
      return clanElder(player, npc, cfg);
    case "villager":
    default:
      say(player, npc, cfg?.greeting || CHATTER[Math.floor(Math.random() * CHATTER.length)]);
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function killerOf(damageSource) {
  let k = damageSource?.damagingEntity;
  if (k && k.typeId !== "minecraft:player") {
    try {
      const owner = k.getDynamicProperty("aegis:owner");
      if (owner) k = world.getEntity(owner);
    } catch {
      k = undefined;
    }
  }
  return k?.typeId === "minecraft:player" ? k : undefined;
}

function killKind(dead) {
  const t = dead.typeId;
  if (t === "aegis:akatsuki") return "akatsuki";
  if (t === "aegis:hostile_ninja") return "ninja";
  if (["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"].some((b) => t === `aegis:${b}`)) return "bijuu";
  try {
    if (dead.matches?.({ families: ["monster"] })) return "monster";
  } catch {
    /* fall through */
  }
  return /zombie|skeleton|creeper|spider|witch|pillager|vindicator|evoker|ravager|phantom|drowned|husk|stray|slime|blaze|ghast|piglin_brute|hoglin|enderman|silverfish|guardian|warden|breeze|bogged/.test(t) ? "monster" : "other";
}

export function initNpcs(helpers) {
  api = helpers;
  system.run(loadAll);

  system.runInterval(() => {
    try {
      tickSpawners();
    } catch {
      /* keep going */
    }
  }, 40);
  system.runInterval(tickExams, 20);

  // Place → register + open settings
  world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
    if (block.typeId !== SPAWNER) return;
    const cfg = createSpawner(block.dimension, block.location, { type: "sensei" });
    system.runTimeout(() => configure(player, cfg).catch(() => {}), 5);
  });

  // Interact with the block (creative) → spawner menu
  const lastOpen = new Map();
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (ev.block.typeId !== SPAWNER) return;
    const now = system.currentTick;
    if ((lastOpen.get(ev.player.id) ?? -100) > now - 10) return;
    lastOpen.set(ev.player.id, now);
    const key = keyOf(ev.block.dimension, ev.block.location);
    const player = ev.player;
    system.run(() => {
      if (!isCreative(player)) return;
      const cfg = configs.get(key) ?? createSpawner(player.dimension, ev.block.location, { type: "sensei" });
      spawnerMenu(player, cfg).catch(() => {});
    });
  });

  world.afterEvents.playerBreakBlock.subscribe(({ brokenBlockPermutation, block, dimension }) => {
    if (brokenBlockPermutation.type.id !== SPAWNER) return;
    const cfg = configs.get(keyOf(dimension, block.location));
    if (cfg) {
      removeNpcs(cfg);
      forget(cfg.key);
    }
  });

  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (target.typeId !== "aegis:npc") return;
    system.run(() => talk(player, target).catch(() => {}));
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (deadEntity.typeId === "minecraft:player") {
      if (exams.has(deadEntity.id)) endExam(deadEntity, false);
      return;
    }
    const killer = killerOf(damageSource);
    if (killer) missionProgress(killer, killKind(deadEntity));
  });

  // Ramen
  world.afterEvents.itemCompleteUse.subscribe(({ source: player, itemStack }) => {
    if (itemStack?.typeId === "aegis:ramen") {
      try {
        const h = player.getComponent("minecraft:health");
        h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 8));
        player.addEffect("regeneration", 200, { amplifier: 0 });
      } catch {
        /* ignore */
      }
      api.setChakra(player, api.getChakra(player) + 60);
      player.onScreenDisplay.setActionBar("§6Delicious! §a+60 chakra");
    } else if (itemStack?.typeId === "aegis:miso_ramen") {
      try {
        player.addEffect("speed", 600, { amplifier: 0 });
      } catch {
        /* ignore */
      }
      api.setChakra(player, api.getChakra(player) + 30);
      player.onScreenDisplay.setActionBar("§eTasty! §a+30 chakra");
    }
  });

  system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== "aegis:spawner" || sourceEntity?.typeId !== "minecraft:player") return;
    const player = sourceEntity;
    const hit = player.getBlockFromViewDirection?.({ maxDistance: 8 });
    if (hit?.block?.typeId !== SPAWNER) return player.sendMessage("§7Look at an NPC Spawner.");
    const cfg = configs.get(keyOf(player.dimension, hit.block.location)) ?? createSpawner(player.dimension, hit.block.location, { type: "sensei" });
    system.run(() => spawnerMenu(player, cfg).catch(() => {}));
  });
}
