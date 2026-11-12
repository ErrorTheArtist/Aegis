// Kamui — only ONE player in the world can hold it: whoever first defeats Tobi.
// Like Tobi, the holder is permanently phased out of this world: nothing can hurt them — except for 1.5 seconds
// every time they attack (hit something, cast a jutsu, use an item), when they have to turn solid.
//   right-click: Kamui Warp — twist space around the enemy you look at
//   sneak + right-click: warp yourself to the spot you look at
// The Kamui holder's hits also break another Tobi's phase (Kamui can reach Kamui).
//   /scriptevent aegis:kamui info | free (admin: take Kamui back from its holder's record)

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { showTitle } from "./hud.js";
import { impactFx, sfx } from "./cinematic.js";

export const KAMUI_ITEM = "aegis:kamui";
const PROP = "aegis:kamui_holder";
const PURPLE = [0.6, 0.3, 0.9];
const WARP = { cost: 45, cd: 300 };
const SELF = { cost: 20, cd: 60 };
const SOLID_TICKS = 30; // 1.5 s
let api;
let breakPhase = () => {};
const solidUntil = new Map(); // holder id -> tick their solid window ends

export function kamuiHolder() {
  try {
    return JSON.parse(world.getDynamicProperty(PROP) ?? "null");
  } catch {
    return null;
  }
}
const holds = (p) => kamuiHolder()?.id === p?.id;

function container(p) {
  return p.getComponent("minecraft:inventory")?.container;
}
function hasItem(p) {
  const inv = container(p);
  if (!inv) return true;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === KAMUI_ITEM) return true;
  return false;
}
function giveItem(p) {
  if (hasItem(p)) return;
  try {
    const s = new ItemStack(KAMUI_ITEM, 1);
    s.lockMode = ItemLockMode.inventory;
    s.keepOnDeath = true;
    container(p)?.addItem(s);
  } catch {
    /* inventory full — next spawn */
  }
}

// Called when Tobi dies. The first player to defeat him takes Kamui.
export function onTobiDefeated(killer) {
  if (!killer || killer.typeId !== "minecraft:player") return;
  const h = kamuiHolder();
  if (h) {
    if (h.id !== killer.id) killer.sendMessage(`§7Tobi falls… but Kamui already belongs to §5${h.name}§7.`);
    return;
  }
  world.setDynamicProperty(PROP, JSON.stringify({ id: killer.id, name: killer.name }));
  giveItem(killer);
  showTitle(killer, "§5§lKAMUI", { subtitle: "§7The space-time eye is yours alone", fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 20 });
  impactFx(killer.dimension, killer.location, PURPLE, 2.5);
  api.particle(killer.dimension, "aegis:cine_swirl", killer.location, PURPLE);
  sfx(killer.dimension, "aegis.transform", killer.location, 2, 0.8);
  world.sendMessage(`§5${killer.name}§d defeated Tobi and awakened §5Kamui§d — the only one in the world.`);
  killer.sendMessage("§7Like Tobi, you're now phased out of this world: §fnothing can hurt you§7 — except for §f1.5s§7 every time you attack. Right-click the §5Kamui§7 eye to §fWarp§7 an enemy; §fsneak§7 + right-click to warp yourself.");
}

function lookTarget(p, range) {
  try {
    return p.getEntitiesFromViewDirection({ maxDistance: range }).map((h) => h.entity).find((e) => api.canBeHit(e, p));
  } catch {
    return undefined;
  }
}

function warp(p) {
  const dim = p.dimension;
  const t = lookTarget(p, 32);
  if (!t) {
    p.onScreenDisplay.setActionBar("§7Look at an enemy within 32 blocks. §8(sneak + right-click to warp yourself)");
    return false;
  }
  {
    const spot = { ...t.location };
    for (let k = 0; k < 12; k += 2) system.runTimeout(() => api.particle(dim, "aegis:cine_swirl", spot, PURPLE), k);
    sfx(dim, "aegis.charge", spot, 1.5, 1.4);
    system.runTimeout(() => {
      if (!api.isValid(t) || !api.isValid(p)) return;
      const big = t.typeId === "aegis:legend" || t.typeId === "aegis:akatsuki" || t.matches?.({ families: ["tailed_beast"] });
      api.hurt(t, big ? 20 : 14, p, "magic");
      try {
        t.addEffect("nausea", 100, { amplifier: 0 });
        t.addEffect("slowness", 40, { amplifier: 2 });
      } catch {
        /* ignore */
      }
      if (!big) {
        const a = Math.random() * Math.PI * 2;
        const to = { x: t.location.x + Math.cos(a) * 10, y: t.location.y + 1, z: t.location.z + Math.sin(a) * 10 };
        try {
          if (dim.getBlock(to)?.isAir && dim.getBlock({ ...to, y: to.y + 1 })?.isAir) t.teleport(to);
        } catch {
          /* ignore */
        }
      }
      impactFx(dim, t.location, PURPLE, 1.5);
      api.particle(dim, "aegis:cine_swirl", t.location, PURPLE);
      if (t.typeId === "aegis:akatsuki") breakPhase(t, p);
    }, 12);
    return true;
  }
}

function warpSelf(p) {
  const dim = p.dimension;
  let hit;
  try {
    hit = p.getBlockFromViewDirection({ maxDistance: 24 });
  } catch {
    hit = undefined;
  }
  if (!hit) {
    p.onScreenDisplay.setActionBar("§7Look at an enemy or a spot within reach.");
    return false;
  }
  const to = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 1, z: hit.block.location.z + 0.5 };
  api.particle(dim, "aegis:cine_swirl", p.location, PURPLE);
  sfx(dim, "aegis.whoosh", p.location, 1.2, 1.4);
  try {
    p.teleport(to, { keepVelocity: false });
  } catch {
    return false;
  }
  api.particle(dim, "aegis:cine_swirl", to, PURPLE);
  return true;
}

export const isKamuiPhased = (p) => holds(p) && !solidUntil.has(p.id);

// The holder turns solid for 1.5 s whenever they attack.
function goSolid(p) {
  const fresh = !solidUntil.has(p.id);
  solidUntil.set(p.id, system.currentTick + SOLID_TICKS);
  try {
    if (p.getEffect("resistance")?.amplifier >= 4) p.removeEffect("resistance");
  } catch {
    /* ignore */
  }
  if (fresh) p.onScreenDisplay?.setActionBar("§6You turned solid to attack — §cyou can be hit (1.5s)");
}

function phaseIn(p) {
  try {
    p.addEffect("resistance", 30, { amplifier: 4, showParticles: false }); // full immunity while phased
  } catch {
    /* ignore */
  }
}

// Returns true if the item was Kamui (handled).
export function handleKamuiUse(player, itemStack) {
  if (itemStack?.typeId !== KAMUI_ITEM) return false;
  if (!holds(player)) {
    player.onScreenDisplay.setActionBar("§cThis eye doesn't answer to you.");
    return true;
  }
  const sneaking = player.isSneaking;
  const move = sneaking ? SELF : WARP;
  const key = sneaking ? "kamui_self" : "kamui_warp";
  const left = api.cooldownLeft(player, key);
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7Kamui ${sneaking ? "self-warp" : "Warp"} ready in §f${(left / 20).toFixed(1)}s`);
    return true;
  }
  if (api.getChakra(player) < move.cost) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(api.getChakra(player))}/${move.cost})`);
    return true;
  }
  api.anim(player, "animation.aegis.eye_activate");
  if ((sneaking ? warpSelf(player) : warp(player)) === false) return true;
  api.setChakra(player, api.getChakra(player) - move.cost);
  api.startCooldown(player, key, move.cd);
  return true;
}

export function initKamui(helpers, onBreakPhase) {
  api = helpers;
  if (onBreakPhase) breakPhase = onBreakPhase;

  // the holder always keeps the eye; anyone else who somehow has it loses it
  world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (holds(player)) giveItem(player);
    else if (hasItem(player)) {
      const inv = container(player);
      for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === KAMUI_ITEM) inv.setItem(i, undefined);
    }
  });

  // permanent phase: refresh full immunity unless the holder is in a solid window
  system.runInterval(() => {
    const h = kamuiHolder();
    if (!h) return;
    const p = world.getEntity(h.id);
    if (!p || !api.isValid(p)) return;
    const now = system.currentTick;
    const until = solidUntil.get(p.id);
    if (until && now >= until) {
      solidUntil.delete(p.id);
      api.particle(p.dimension, "aegis:cine_swirl", p.location, PURPLE);
      p.onScreenDisplay?.setActionBar("§5Kamui — phased again");
    }
    if (!solidUntil.has(p.id)) {
      phaseIn(p);
      if (now % 40 === 0) api.particle(p.dimension, "aegis:cine_swirl", p.location, PURPLE);
    } else {
      api.particle(p.dimension, "aegis:beast_aura", p.location, [1, 0.55, 0.15]);
    }
  }, 5);

  // attacking makes the holder solid: melee hits, jutsu / item use (but not the Kamui eye itself)
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => {
    if (holds(damagingEntity)) goSolid(damagingEntity);
  });
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack?.typeId !== KAMUI_ITEM && holds(source)) goSolid(source);
  });
  // hitting the holder while they're phased: it passes through
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (!holds(hitEntity) || solidUntil.has(hitEntity.id)) return;
    api.particle(hitEntity.dimension, "aegis:cine_swirl", hitEntity.location, PURPLE);
    if (damagingEntity?.typeId === "minecraft:player") damagingEntity.onScreenDisplay?.setActionBar("§7Your attack passes right through them… §8(strike when they attack)");
  });

  // Kamui reaches Kamui: the holder's hits pull another Tobi out of his phase
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (hitEntity?.typeId !== "aegis:akatsuki" || !holds(damagingEntity)) return;
    breakPhase(hitEntity, damagingEntity);
  });

  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:kamui" || p?.typeId !== "minecraft:player") return;
    const cmd = String(message ?? "").trim().toLowerCase();
    if (cmd === "free") {
      world.setDynamicProperty(PROP, undefined);
      return p.sendMessage("§7Kamui has no holder now — the next player to defeat Tobi takes it.");
    }
    const h = kamuiHolder();
    p.sendMessage(h ? `§7Kamui belongs to §5${h.name}§7.` : "§7Nobody holds Kamui yet — defeat Tobi to claim it.");
  });
}
