// Titles (v1.54) — Pain, Itachi of the Sharingan, Tobi, Sasuke and Naruto.
// A server admin grants one with the tag command once a player has earned it:
//   /tag <player> add pain        (or itachi, tobi, sasuke, naruto)
// The holder gets the title's reward gear — creative-only items nobody can get any other way, kept on death — its
// perks, and the title over their name. /tag <player> remove pain takes the title and its perks away (the gear stays,
// but only the title's holder can use it). The requirements are in the Shinobi Record → Titles, ticked where the add-on
// can check them — since v1.55 that includes bounties and the players you've defeated (the Bingo Book, bounty.js); only
// "every village quest chain without dying" is left for the admin to judge.

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { impactFx, chargeFx, shake, sfx } from "./cinematic.js";
import { getLevel } from "./levels.js";
import { getVillage, everLeft, rogueOf, getHonor } from "./villages.js";
import { hasSageTraining } from "./sage.js";
import { kamuiHolder } from "./kamui.js";
import { JUTSU_NATURE } from "./natures.js";
import { bountyOf, pvpRecord } from "./bounty.js";

const REWARDED = "aegis:titles_rewarded"; // titles whose gear this player has been given (once each)
const ACTIVE = "aegis:titles_active"; // titles they held at the last check (to announce changes)
const NINJA_KILLS = "aegis:ninja_kills";
export const MISSIONS_DONE = "aegis:missions_done";

const num = (p, k) => {
  try {
    const v = p.getDynamicProperty(k);
    return typeof v === "number" ? v : 0;
  } catch {
    return 0;
  }
};
const list = (p, k) => {
  try {
    return JSON.parse(p.getDynamicProperty(k) ?? "[]");
  } catch {
    return [];
  }
};
export const ninjaKills = (p) => num(p, NINJA_KILLS);
export const missionsDone = (p) => num(p, MISSIONS_DONE);
const hasMS = (p) => {
  try {
    return p.getDynamicProperty("aegis:mangekyo") === true;
  } catch {
    return false;
  }
};
const clanOf = (p) => {
  try {
    return p.getDynamicProperty("aegis:clan");
  } catch {
    return undefined;
  }
};

// requirement: [text, check(player) → bool, or null when an admin has to judge it]
const R = {
  lvl300: ["Reach Level 300", (p) => getLevel(p) >= 300],
  left: ["Leave your village", (p) => everLeft(p)],
  ms: ["Own the Mangekyō Sharingan", hasMS],
  kills: ["Defeat 3,000 hostile ninja", (p) => ninjaKills(p) >= 3000],
  kage: ["Defeat a Kage-rank player", (p) => !!pvpRecord(p).kage],
  bounty2: ["Have a bounty of at least 2 Million Ryō", (p) => bountyOf(p) >= 2000000],
};
export const TITLES = {
  pain: {
    name: "§5Pain", short: "§5Pain",
    reqs: [R.left, R.lvl300, ["Defeat the player holding the title The Toad Sage", (p) => !!pvpRecord(p).toad],
      ["Have a bounty of at least 5 Million Ryō", (p) => bountyOf(p) >= 5000000],
      ["Must have the Ōtsutsuki Clan", (p) => clanOf(p) === "otsutsuki"]],
    rewards: ["aegis:advanced_rinnegan", "aegis:adv_shinra_tensei_scroll", "aegis:adv_chibaku_tensei_scroll", "aegis:chakra_rod"],
    perks: "+15% damage vs groups (2 or more enemies near your target)",
  },
  itachi: {
    name: "§cItachi of the Sharingan", short: "§cItachi",
    reqs: [R.lvl300, R.ms, ["Finish every village quest chain without dying", null], R.left,
      ["Must be a part of the Hidden Leaf before leaving it", (p) => rogueOf(p) === "leaf"], R.kage, R.bounty2],
    rewards: ["aegis:tsukuyomi_scroll", "aegis:amaterasu_scroll", "aegis:susanoo_scroll", "aegis:totsuka_blade"],
    perks: "+15% genjutsu strength · immune to one debuff every 45 seconds",
  },
  tobi: {
    name: "§6Tobi", short: "§6Tobi",
    reqs: [R.lvl300, ["Be the Kamui holder in the world", (p) => kamuiHolder()?.id === p.id], R.ms, R.left,
      ["Defeat a Jōnin-rank feared and respected player", (p) => !!pvpRecord(p).jonin], R.bounty2],
    rewards: ["aegis:tobi_mask", "aegis:gunbai", "aegis:kamui_shuriken_scroll"],
    perks: "Kamui cooldown −30% · +10% jutsu damage",
  },
  sasuke: {
    name: "§9Sasuke", short: "§9Sasuke",
    reqs: [R.lvl300, R.ms, R.left, R.kills, R.kage, R.bounty2],
    rewards: ["aegis:kusanagi_v2", "aegis:indra_arrow_scroll", "aegis:chidori_nagashi_scroll", "aegis:perfect_susanoo_scroll"],
    perks: "+15% lightning jutsu damage · +10% movement speed",
  },
  naruto: {
    name: "§6Naruto", short: "§6Naruto",
    reqs: [R.lvl300, ["Master Sage Mode", (p) => hasSageTraining(p)],
      ["Have Kurama sealed inside you", (p) => {
        try {
          return p.getDynamicProperty("aegis:bijuu") === "kurama";
        } catch {
          return false;
        }
      }],
      ["Stay in your village (never leave it)", (p) => !everLeft(p) && !!getVillage(p)], ["Complete 500 missions", (p) => missionsDone(p) >= 500],
      R.kills, ["Have 3 Million Honor", (p) => getHonor(p) >= 3000000]],
    rewards: ["aegis:orange_sage_coat", "aegis:rasenshuriken_v2_scroll", "aegis:tailed_beast_bomb_scroll", "aegis:six_paths_sage_scroll"],
    perks: "+15% chakra regen · +10% max HP",
  },
};
export const TITLE_IDS = Object.keys(TITLES);
const ITEM_NAMES = {
  "aegis:advanced_rinnegan": "Advanced Rinnegan Eyes", "aegis:adv_shinra_tensei_scroll": "Advanced Shinra Tensei Scroll",
  "aegis:adv_chibaku_tensei_scroll": "Advanced Chibaku Tensei Scroll", "aegis:chakra_rod": "Chakra Receiver Rods",
  "aegis:tsukuyomi_scroll": "Tsukuyomi Scroll", "aegis:amaterasu_scroll": "Amaterasu Scroll", "aegis:susanoo_scroll": "Susanoo Scroll",
  "aegis:totsuka_blade": "Totsuka Blade", "aegis:tobi_mask": "Tobi's Spiral Mask", "aegis:gunbai": "Uchiha War Fan (Gunbai)",
  "aegis:kamui_shuriken_scroll": "Kamui Shuriken Scroll", "aegis:kusanagi_v2": "Kusanagi Sword V2", "aegis:indra_arrow_scroll": "Indra's Arrow Scroll",
  "aegis:chidori_nagashi_scroll": "Chidori Nagashi V2 Scroll", "aegis:perfect_susanoo_scroll": "Perfect Susanoo Scroll",
  "aegis:orange_sage_coat": "Orange Sage Coat", "aegis:rasenshuriken_v2_scroll": "Rasenshuriken V2 Scroll",
  "aegis:tailed_beast_bomb_scroll": "Tailed Beast Bomb V2 Scroll", "aegis:six_paths_sage_scroll": "Six Paths Sage Mode Scroll (half)",
};
export const itemName = (id) => ITEM_NAMES[id] ?? id;
// which title each reward belongs to (only that title's holder can use it)
export const ITEM_TITLE = Object.fromEntries(TITLE_IDS.flatMap((t) => TITLES[t].rewards.map((it) => [it, t])));

export const hasTitle = (p, id) => {
  try {
    return p?.typeId === "minecraft:player" && p.hasTag(id);
  } catch {
    return false;
  }
};
export const titlesOf = (p) => TITLE_IDS.filter((id) => hasTitle(p, id));
export const titlePrefix = (p) => titlesOf(p).map((id) => TITLES[id].short).join("§7/") + (titlesOf(p).length ? "§r " : "");

let api;

// ---------------------------------------------------------------------------
// Perks
// ---------------------------------------------------------------------------
const GENJUTSU = new Set(["aegis:hell_viewing_scroll", "aegis:tsukuyomi_scroll", "aegis:sharingan"]);
const castWindow = new Map(); // player id -> { genjutsu: tick, lightning: tick }
const rinnegan = new Map(); // player id -> tick the Advanced Rinnegan ends
const sixPaths = new Map(); // player id -> tick Six Paths Sage Mode ends

// Called by main.js whenever a jutsu is cast.
export function noteTitleCast(player, itemId) {
  const w = castWindow.get(player.id) ?? {};
  if (GENJUTSU.has(itemId)) w.genjutsu = system.currentTick + 100;
  if (JUTSU_NATURE[itemId] === "lightning" || itemId === "aegis:indra_arrow_scroll" || itemId === "aegis:chidori_nagashi_scroll") w.lightning = system.currentTick + 100;
  castWindow.set(player.id, w);
}

// Extra damage from the attacker's titles (main.js hurt()).
export function titleDamageMultiplier(attacker, target) {
  if (attacker?.typeId !== "minecraft:player" || !titlesOf(attacker).length) return 1;
  const now = system.currentTick;
  const w = castWindow.get(attacker.id) ?? {};
  let m = 1;
  if (hasTitle(attacker, "pain")) {
    try {
      const crowd = target.dimension.getEntities({ location: target.location, maxDistance: 8 })
        .filter((e) => e.id !== target.id && e.id !== attacker.id && api.canBeHit(e, attacker) && e.typeId !== "minecraft:item").length;
      if (crowd >= 1) m *= 1.15; // the target and at least one more: a group
    } catch {
      /* ignore */
    }
    if ((rinnegan.get(attacker.id) ?? 0) > now) m *= 1.15;
  }
  if (hasTitle(attacker, "tobi")) m *= 1.1;
  if (hasTitle(attacker, "itachi") && (w.genjutsu ?? 0) > now) m *= 1.15;
  if (hasTitle(attacker, "sasuke") && (w.lightning ?? 0) > now) m *= 1.15;
  return m;
}
export const titleRegenMultiplier = (p) => (hasTitle(p, "naruto") ? 1.15 : 1) * ((sixPaths.get(p.id) ?? 0) > system.currentTick ? 2 : 1);
export const titleKamuiCdMultiplier = (p) => (hasTitle(p, "tobi") ? 0.7 : 1);
// Naruto: +10% max HP (health boost levels on top of `levels`)
export const titleHpLevels = (p, levels) => (hasTitle(p, "naruto") ? Math.round((20 + 4 * levels) * 0.1 / 4) : 0);

const DEBUFFS = ["slowness", "weakness", "poison", "wither", "blindness", "nausea", "mining_fatigue", "hunger", "levitation", "darkness"];
const immuneReady = new Map(); // player id -> tick

function perkTick() {
  const now = system.currentTick;
  for (const p of world.getAllPlayers()) {
    // Itachi: shrugs off one debuff every 45 seconds
    if (hasTitle(p, "itachi") && now >= (immuneReady.get(p.id) ?? 0)) {
      for (const id of DEBUFFS) {
        try {
          if (!p.getEffect(id)) continue;
          p.removeEffect(id);
        } catch {
          continue;
        }
        immuneReady.set(p.id, now + 900);
        p.onScreenDisplay?.setActionBar(`§cSharingan §7— shrugged off ${id.replace("_", " ")}`);
        api.particle(p.dimension, "aegis:cine_ring", p.location, [0.9, 0.15, 0.15]);
        break;
      }
    }
    // Sasuke: +10% movement speed
    try {
      const mv = p.getComponent("minecraft:movement");
      if (mv) {
        const want = hasTitle(p, "sasuke") ? mv.defaultValue * 1.1 : mv.defaultValue;
        if (Math.abs(mv.currentValue - want) > 0.001 && !p.getEffect("speed") && !p.getEffect("slowness")) mv.setCurrentValue(want);
      }
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Granting (watches the tags)
// ---------------------------------------------------------------------------
function giveReward(p, id) {
  const st = new ItemStack(id, 1);
  try {
    st.keepOnDeath = true;
    st.setLore([`§7${TITLES[ITEM_TITLE[id]].name}§7 title reward`]);
  } catch {
    /* ignore */
  }
  try {
    const left = p.getComponent("minecraft:inventory")?.container?.addItem(st);
    if (left) p.dimension.spawnItem(left, p.location);
  } catch {
    try {
      p.dimension.spawnItem(st, p.location);
    } catch {
      /* ignore */
    }
  }
}

function checkTitles(p) {
  const rewarded = list(p, REWARDED);
  const before = list(p, ACTIVE);
  const now = titlesOf(p);
  for (const id of now) {
    if (before.includes(id)) continue;
    const T = TITLES[id];
    if (!rewarded.includes(id)) {
      for (const it of T.rewards) giveReward(p, it);
      rewarded.push(id);
      p.setDynamicProperty(REWARDED, JSON.stringify(rewarded));
      p.sendMessage(`§eYou received the gear of the ${T.name}§e title: §f${T.rewards.map(itemName).join("§7, §f")}§e. §7Perks: ${T.perks}`);
    } else p.sendMessage(`§eYou hold the ${T.name}§e title again. §7Perks: ${T.perks}`);
    showTitle(p, T.name, { subtitle: "§7a title of legend", fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
    world.sendMessage(`§e${p.name} now holds the title ${T.name}§e!`);
    api.sound(p.dimension, "random.totem", p.location, 0.8, 1);
  }
  for (const id of before) if (!now.includes(id)) p.sendMessage(`§7You no longer hold the ${TITLES[id].name}§7 title.`);
  if (now.length !== before.length || now.some((id) => !before.includes(id))) {
    p.setDynamicProperty(ACTIVE, JSON.stringify(now));
    api.refreshName?.(p);
  }
}

// The Shinobi Record → Titles page.
export async function titlesMenu(player, back) {
  const f = new ActionFormData().title("§lTitles")
    .body("§7Legendary titles are granted by the server's admins once you've earned them (§f/tag <player> add <title>§7). " +
      "Each gives creative-only gear and perks. §a✔§7 = done, §c✘§7 = not yet, §8•§7 = the admins judge it.");
  for (const id of TITLE_IDS) f.button(`${TITLES[id].name}${hasTitle(player, id) ? " §a(yours)" : ""}\n§r§8tag: ${id}`);
  f.button("§l« Back");
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection === TITLE_IDS.length) return back?.();
  const T = TITLES[TITLE_IDS[r.selection]];
  const reqs = T.reqs.map(([text, check]) => (check ? (check(player) ? "§a✔ " : "§c✘ ") : "§8• ") + `§7${text}`);
  await new ActionFormData().title(T.name)
    .body(`§fRequirements\n${reqs.join("\n")}\n\n§fRewards\n§7${T.rewards.map(itemName).join("\n")}\n§7${T.perks}`)
    .button("§l« Back").show(player);
  return titlesMenu(player, back);
}

// ---------------------------------------------------------------------------
// Title gear: the eyes and the weapons' specials (right-click)
// ---------------------------------------------------------------------------
const PURPLE = [0.62, 0.35, 0.95];
const BOLT = [0.6, 0.85, 1];
const RED = [0.9, 0.15, 0.15];
const GOLD = [1, 0.8, 0.25];

function eff(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}
function foesNear(p, pos, r) {
  try {
    return p.dimension.getEntities({ location: pos, maxDistance: r }).filter((e) => e.id !== p.id && api.canBeHit(e, p));
  } catch {
    return [];
  }
}
function targetInView(p, range) {
  try {
    return p.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, p));
  } catch {
    return undefined;
  }
}
function lookPoint(p, range) {
  try {
    const b = p.getBlockFromViewDirection({ maxDistance: range });
    if (b) return { x: b.block.location.x + 0.5, y: b.block.location.y + 1, z: b.block.location.z + 0.5 };
  } catch {
    /* ignore */
  }
  return api.add(p.location, api.scale(api.norm({ ...p.getViewDirection(), y: 0 }), Math.min(range, 12)));
}
const noTarget = (p) => {
  p.onScreenDisplay?.setActionBar("§7No target in sight.");
  return false;
};
function ready(p, key, cd) {
  const left = api.cooldownLeft(p, key);
  if (left > 0) {
    p.onScreenDisplay?.setActionBar(`§7Ready in §f${(left / 20).toFixed(1)}s`);
    return false;
  }
  api.startCooldown(p, key, cd);
  return true;
}
function denied(p, id) {
  const t = ITEM_TITLE[id];
  if (!t || hasTitle(p, t)) return false;
  p.onScreenDisplay?.setActionBar(`§cOnly the holder of the ${TITLES[t].name}§c title can use this.`);
  return true;
}

const SPECIALS = {
  // Pain's eyes: 60 s of the Advanced Rinnegan — +15% damage, night vision, a ripple in the eyes
  "aegis:advanced_rinnegan"(p) {
    if (!ready(p, "adv_rinnegan", 2400)) return;
    rinnegan.set(p.id, system.currentTick + 1200);
    eff(p, "night_vision", 1240, 0);
    api.anim(p, "animation.aegis.eye_activate");
    sfx(p.dimension, "aegis.seal", p.location, 1.2, 0.6);
    showTitle(p, "§5Advanced Rinnegan", { subtitle: "§7+15% damage for 60 seconds", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
    for (let t = 0; t < 1200; t += 40) system.runTimeout(() => api.isValid(p) && api.particle(p.dimension, "aegis:cine_ring", p.location, PURPLE), t);
  },
  // Chakra Receiver Rods: thrown, they pin whoever they hit
  "aegis:chakra_rod"(p) {
    if (!ready(p, "chakra_rod", 60)) return;
    api.anim(p, "animation.aegis.throw_overhead");
    const d = p.getViewDirection();
    api.launchProjectile(p, api.add(p.getHeadLocation(), d), d, { noOrb: true, speed: 2, maxAge: 20, damage: 10, radius: 1.3, knock: 0.3, fire: 0,
      trail: "aegis:slash", burst: "aegis:slash", color: [0.25, 0.22, 0.3], hitRadius: 1.1, power: 0.4, effects: [["slowness", 60, 4]] });
    api.sound(p.dimension, "random.bow", p.location, 1, 0.7);
  },
  // Totsuka Blade: a thrust that seals — weakened foes are sealed away outright
  "aegis:totsuka_blade"(p) {
    const t = targetInView(p, 7);
    if (!t) return noTarget(p);
    if (!ready(p, "totsuka", 200)) return;
    api.anim(p, "animation.aegis.sword_thrust");
    sfx(p.dimension, "aegis.seal", t.location, 1.4, 0.8);
    api.particle(p.dimension, "aegis:slash", api.add(t.location, { x: 0, y: 1.2, z: 0 }), RED);
    let low = false;
    try {
      const h = t.getComponent("minecraft:health");
      low = h.currentValue / h.effectiveMax <= 0.15;
      api.hurt(t, low ? h.currentValue + 50 : 16, p, "magic");
    } catch {
      /* ignore */
    }
    eff(t, "weakness", 60, 2);
    eff(t, "slowness", 60, 2);
    if (low) showTitle(p, "§cTotsuka Blade", { subtitle: "§7sealed away", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 6 });
  },
  // Uchiha War Fan: Uchiha Return — a gust that hurls everything in front away
  "aegis:gunbai"(p) {
    if (!ready(p, "gunbai", 120)) return;
    api.anim(p, "animation.aegis.sword_spin");
    const d = api.norm({ ...p.getViewDirection(), y: 0 });
    sfx(p.dimension, "aegis.wind", p.location, 1.5, 0.7);
    for (let i = 1; i <= 8; i++) api.particle(p.dimension, "aegis:wind_gust", api.add(p.location, { x: d.x * i, y: 1, z: d.z * i }));
    for (const e of foesNear(p, api.add(p.location, api.scale(d, 4)), 5)) {
      api.hurt(e, 12, p);
      api.knockback(e, d.x, d.z, 4, 0.6);
    }
  },
  // Kusanagi V2: a lightning dash through the first enemy in the way
  "aegis:kusanagi_v2"(p) {
    if (!ready(p, "kusanagi_v2", 100)) return;
    api.anim(p, "animation.aegis.sword_thrust");
    sfx(p.dimension, "aegis.chidori", p.location, 1.2, 1.3);
    api.lungeStrike(p, { power: 3.5, range: 2.8, ticks: 12, trail: () => api.particle(p.dimension, "aegis:chidori", api.add(p.location, { x: 0, y: 1, z: 0 })),
      onHit: (t) => {
        api.hurt(t, 16, p, "lightning");
        eff(t, "slowness", 40, 3);
        impactFx(p.dimension, t.location, BOLT, 1.5);
      } });
  },
};

// ---------------------------------------------------------------------------
// The title jutsu (scrolls) — registered into main.js JUTSU; `title` = who may cast it
// ---------------------------------------------------------------------------
function susanooFor(p, seconds, perfect) {
  const dim = p.dimension;
  const model = api.spawnFx(dim, "aegis:susanoo", undefined, p.location);
  api.follow(model, () => (api.isValid(p) ? p.location : undefined), seconds * 20, () => ({ x: 0, y: p.getRotation().y }));
  const amp = perfect ? 2 : 1;
  for (const [id, a] of [["resistance", amp], ["strength", amp]]) eff(p, id, seconds * 20, a);
  showTitle(p, perfect ? "§9Perfect Susanoo" : "§5Susanoo", { subtitle: `§7${seconds} seconds`, fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
  const every = perfect ? 20 : 30;
  for (let t = every; t < seconds * 20; t += every) {
    system.runTimeout(() => {
      if (!api.isValid(p)) return;
      const foe = foesNear(p, p.location, perfect ? 9 : 7)[0];
      if (!foe) return;
      api.particle(dim, "aegis:susanoo_flame", api.add(foe.location, { x: 0, y: 1, z: 0 }), perfect ? BOLT : PURPLE);
      api.particle(dim, "aegis:slash", api.add(foe.location, { x: 0, y: 1.2, z: 0 }), perfect ? BOLT : PURPLE);
      sfx(dim, "aegis.slash", foe.location, 1, 0.7);
      api.hurt(foe, perfect ? 20 : 12, p);
      if (perfect) for (const e of foesNear(p, foe.location, 2.5)) if (e.id !== foe.id) api.hurt(e, 10, p);
    }, t);
  }
}

export function makeTitleJutsu(helpers) {
  api = helpers;
  return {
    "aegis:adv_shinra_tensei_scroll": { title: "pain", name: "Advanced Shinra Tensei", cost: 80, cooldown: 300, cast(p) {
      const dim = p.dimension;
      const c = { ...p.location };
      api.anim(p, "animation.aegis.almighty_push");
      chargeFx(p, PURPLE, 8, "aegis.charge");
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        sfx(dim, "mob.warden.sonic_boom", c, 2, 0.6);
        shake(dim, c, 1.2, 1, 32);
        for (let k = 0; k < 3; k++) system.runTimeout(() => api.particle(dim, "aegis:cine_ring", c, PURPLE), k * 3);
        api.particle(dim, "aegis:chakra_burst", api.add(c, { x: 0, y: 1, z: 0 }), PURPLE);
        for (const e of foesNear(p, c, 14)) {
          api.hurt(e, 20, p);
          const d = api.norm({ x: e.location.x - c.x, y: 0, z: e.location.z - c.z });
          api.knockback(e, d.x, d.z, 5, 0.9);
        }
      }, 8);
      return true;
    } },
    "aegis:adv_chibaku_tensei_scroll": { title: "pain", name: "Advanced Chibaku Tensei", cost: 150, cooldown: 1200, cast(p) {
      const dim = p.dimension;
      const core = api.add(lookPoint(p, 30), { x: 0, y: 8, z: 0 });
      api.anim(p, "animation.aegis.both_palms");
      chargeFx(p, PURPLE, 12, "aegis.charge");
      for (const q of dim.getPlayers({ location: core, maxDistance: 32 })) {
        if (q.id !== p.id) showTitle(q, "§5Chibaku Tensei", { subtitle: "§7You're being pulled into the sky!", fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 8 });
      }
      for (let t = 0; t < 70; t += 5) {
        system.runTimeout(() => {
          api.particle(dim, "aegis:beast_mist", core, [0.12, 0.08, 0.14]);
          api.particle(dim, "aegis:cine_debris", api.add(core, { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }), [0.4, 0.35, 0.3]);
          for (const e of foesNear(p, core, 18)) {
            const d = api.norm({ x: core.x - e.location.x, y: 0, z: core.z - e.location.z });
            api.knockback(e, d.x, d.z, 0.9, Math.max(0.2, Math.min(0.9, (core.y - e.location.y) * 0.15)));
          }
        }, t);
      }
      system.runTimeout(() => {
        sfx(dim, "random.explode", core, 3, 0.5);
        impactFx(dim, core, PURPLE, 3);
        shake(dim, core, 1, 1.2, 32);
        for (const e of foesNear(p, core, 7)) {
          api.hurt(e, 40, p);
          eff(e, "slowness", 80, 4);
        }
      }, 75);
      return true;
    } },
    "aegis:tsukuyomi_scroll": { title: "itachi", name: "Tsukuyomi", cost: 70, cooldown: 600, cast(p) {
      const t = targetInView(p, 16);
      if (!t) return noTarget(p);
      api.anim(p, "animation.aegis.eye_activate");
      sfx(p.dimension, "aegis.seal", t.location, 1.5, 0.5);
      const ticks = 92; // 4 s, +15% genjutsu strength
      if (t.typeId === "minecraft:player") {
        showTitle(t, "§4Tsukuyomi", { subtitle: "§7Seventy-two hours of torment…", fadeInDuration: 2, stayDuration: 50, fadeOutDuration: 10 });
        try {
          t.runCommand("camera @s fade time 0.3 3 0.6 color 120 0 0");
        } catch {
          /* ignore */
        }
      }
      for (const [id, a] of [["slowness", 255], ["weakness", 4], ["mining_fatigue", 4], ["blindness", 0]]) eff(t, id, ticks, a);
      for (let k = 0; k < 4; k++) {
        system.runTimeout(() => {
          if (!api.isValid(t)) return;
          api.hurt(t, 6, p, "magic");
          api.particle(t.dimension, "aegis:cine_ring", t.location, RED);
        }, k * 20 + 10);
      }
      return true;
    } },
    "aegis:amaterasu_scroll": { title: "itachi", name: "Amaterasu", cost: 50, cooldown: 300, cast(p) {
      const t = targetInView(p, 24);
      if (!t) return noTarget(p);
      api.anim(p, "animation.aegis.eye_activate");
      sfx(p.dimension, "aegis.fire", t.location, 1.5, 0.5);
      for (let k = 0; k < 12; k++) {
        system.runTimeout(() => {
          if (!api.isValid(t)) return;
          api.particle(t.dimension, "aegis:amaterasu", t.location);
          api.hurt(t, 3, p, "fire");
          try {
            t.setOnFire(3, true);
          } catch {
            /* ignore */
          }
        }, k * 10);
      }
      return true;
    } },
    "aegis:susanoo_scroll": { title: "itachi", name: "Susanoo", cost: 100, cooldown: 900, cast(p) {
      api.anim(p, "animation.aegis.eye_activate");
      sfx(p.dimension, "aegis.transform", p.location, 1.5, 0.8);
      impactFx(p.dimension, p.location, PURPLE, 2);
      susanooFor(p, 20, false);
      return true;
    } },
    "aegis:kamui_shuriken_scroll": { title: "tobi", name: "Kamui Shuriken", cost: 60, cooldown: 240, cast(p) {
      api.anim(p, "animation.aegis.throw_overhead");
      const d = p.getViewDirection();
      sfx(p.dimension, "aegis.whoosh", p.location, 1.3, 0.8);
      api.launchProjectile(p, api.add(p.getHeadLocation(), d), d, { noOrb: true, speed: 1.7, maxAge: 30, damage: 18, radius: 2.5, knock: 0.6, fire: 0,
        trail: "aegis:cine_swirl", burst: "aegis:cine_ring", color: PURPLE, hitRadius: 1.4, power: 1,
        effects: [["levitation", 20, 2], ["nausea", 100, 0], ["blindness", 40, 0]] });
      return true;
    } },
    "aegis:indra_arrow_scroll": { title: "sasuke", name: "Indra's Arrow", cost: 160, cooldown: 1200, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.chidori_charge");
      sfx(dim, "aegis.chidori", p.location, 1.6, 0.7);
      for (let t = 0; t < 30; t += 3) system.runTimeout(() => api.isValid(p) && api.particle(dim, "aegis:chidori", api.chidoriHand(p)), t);
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        api.anim(p, "animation.aegis.palm_thrust");
        const o = p.getHeadLocation();
        const d = p.getViewDirection();
        sfx(dim, "ambient.weather.lightning.impact", o, 2.5, 0.7);
        shake(dim, o, 1.2, 1.2, 48);
        const hit = new Set();
        for (let i = 2; i <= 40; i += 1.5) {
          const at = api.add(o, api.scale(d, i));
          if (i % 3 < 1.5) api.particle(dim, "aegis:cine_bolt", at, PURPLE);
          for (const e of foesNear(p, at, 2.6)) {
            if (hit.has(e.id)) continue;
            hit.add(e.id);
            api.hurt(e, 45, p, "lightning");
            api.knockback(e, d.x, d.z, 2.5, 0.5);
          }
        }
        impactFx(dim, api.add(o, api.scale(d, 40)), PURPLE, 3);
      }, 30);
      return true;
    } },
    "aegis:chidori_nagashi_scroll": { title: "sasuke", name: "Chidori Nagashi V2", cost: 50, cooldown: 200, cast(p) {
      const dim = p.dimension;
      api.anim(p, "animation.aegis.lightning_burst");
      sfx(dim, "aegis.chidori", p.location, 1.5, 1);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        api.particle(dim, "aegis:chidori", api.add(p.location, { x: Math.cos(a) * 3, y: 0.8, z: Math.sin(a) * 3 }));
      }
      api.particle(dim, "aegis:lightning_burst", api.add(p.location, { x: 0, y: 1, z: 0 }));
      for (const e of foesNear(p, p.location, 6)) {
        api.hurt(e, 14, p, "lightning");
        eff(e, "slowness", 40, 3);
      }
      return true;
    } },
    "aegis:perfect_susanoo_scroll": { title: "sasuke", name: "Perfect Susanoo", cost: 180, cooldown: 1800, cast(p) {
      api.anim(p, "animation.aegis.eye_activate");
      sfx(p.dimension, "aegis.transform", p.location, 2, 0.6);
      impactFx(p.dimension, p.location, BOLT, 3);
      shake(p.dimension, p.location, 0.8, 1, 32);
      susanooFor(p, 30, true);
      return true;
    } },
    "aegis:rasenshuriken_v2_scroll": { title: "naruto", name: "Rasenshuriken V2", cost: 120, cooldown: 400, cast(p) {
      api.anim(p, "animation.aegis.throw_overhead");
      chargeFx(p, [0.8, 0.95, 1], 16, "aegis.rasengan");
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        const d = p.getViewDirection();
        api.launchProjectile(p, api.add(p.getHeadLocation(), api.scale(d, 1.5)), d, { orbEntity: "aegis:rasenshuriken", orbOffset: 0.4, speed: 1.2,
          maxAge: 50, damage: 35, radius: 6, knock: 2, fire: 0, trail: "aegis:wind_gust", burst: "aegis:chakra_burst", hitRadius: 2.2,
          color: [0.8, 0.95, 1], power: 3,
          onExplode: (pos, dim) => {
            for (let k = 1; k <= 5; k++) {
              system.runTimeout(() => {
                api.particle(dim, "aegis:wind_gust", pos);
                for (const e of foesNear(p, pos, 6)) api.hurt(e, 4, p);
              }, k * 10);
            }
          } });
      }, 16);
      return true;
    } },
    "aegis:tailed_beast_bomb_scroll": { title: "naruto", name: "Tailed Beast Bomb V2", cost: 160, cooldown: 900, cast(p) {
      api.anim(p, "animation.aegis.both_palms");
      chargeFx(p, [1, 0.5, 0.1], 30, "aegis.charge");
      system.runTimeout(() => {
        if (!api.isValid(p)) return;
        const d = p.getViewDirection();
        api.launchProjectile(p, api.add(p.getHeadLocation(), api.scale(d, 2.5)), d, { orbEvent: "aegis:as_bijuudama_big", orbOffset: 0.6, speed: 1.3,
          maxAge: 50, damage: 50, radius: 7, knock: 3, fire: 0, trail: "aegis:beast_aura", burst: "aegis:beast_burst", color: [1, 0.5, 0.1],
          hitRadius: 2.5, power: 3.5, sound: "random.explode" });
        sfx(p.dimension, "mob.warden.sonic_boom", p.location, 1.5, 0.8);
      }, 30);
      return true;
    } },
    "aegis:six_paths_sage_scroll": { title: "naruto", name: "Six Paths Sage Mode (half)", cost: 100, cooldown: 1800, cast(p) {
      sixPaths.set(p.id, system.currentTick + 600);
      for (const [id, a] of [["speed", 1], ["strength", 2], ["resistance", 2], ["regeneration", 1], ["jump_boost", 1], ["night_vision", 0]]) eff(p, id, 600, a);
      impactFx(p.dimension, p.location, GOLD, 2.5);
      sfx(p.dimension, "aegis.transform", p.location, 1.8, 1.2);
      showTitle(p, "§6Six Paths Sage Mode", { subtitle: "§7half power · 30 seconds", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
      for (let t = 0; t < 600; t += 10) {
        system.runTimeout(() => {
          if (!api.isValid(p)) return;
          api.particle(p.dimension, "aegis:cine_swirl", p.location, GOLD);
          if (t % 40 === 0) {
            const a = (t / 40) * 0.7;
            api.particle(p.dimension, "aegis:cine_bolt", api.add(p.location, { x: Math.cos(a) * 1.2, y: 0.4, z: Math.sin(a) * 1.2 }), GOLD);
          }
        }, t);
      }
      return true;
    } },
  };
}

export function initTitles(helpers) {
  api = helpers;
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        checkTitles(p);
      } catch {
        /* ignore */
      }
    }
  }, 40);
  system.runInterval(perkTick, 10);

  world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
    const special = SPECIALS[itemStack?.typeId];
    if (!special || p?.typeId !== "minecraft:player" || denied(p, itemStack.typeId)) return;
    special(p);
  });

  // the Chakra Receiver Rods drain whoever they strike; count hostile ninja defeated (Sasuke's and Naruto's titles)
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity: p, hitEntity: e }) => {
    if (p?.typeId !== "minecraft:player" || !api.isValid(e)) return;
    let held;
    try {
      held = p.getComponent("minecraft:inventory")?.container?.getItem(p.selectedSlotIndex)?.typeId;
    } catch {
      return;
    }
    if (held !== "aegis:chakra_rod" || !hasTitle(p, "pain")) return;
    if (e.typeId === "minecraft:player") api.setChakra(e, api.getChakra(e) - 15);
    eff(e, "slowness", 40, 1);
    api.particle(e.dimension, "aegis:cine_ring", e.location, PURPLE);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (deadEntity.typeId !== "aegis:hostile_ninja") return;
    let k = damageSource?.damagingEntity;
    try {
      if (deadEntity.getDynamicProperty("aegis:no_xp")) return; // clones
      if (k && k.typeId !== "minecraft:player") k = world.getEntity(k.getDynamicProperty("aegis:owner"));
    } catch {
      return;
    }
    if (k?.typeId === "minecraft:player") k.setDynamicProperty(NINJA_KILLS, ninjaKills(k) + 1);
  });
}
