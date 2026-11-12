// Companions: recruitable Genin (levels up by fighting) and summoned animals (toad, slug, snake).

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getRyo, spendRyo, fmtRyo } from "./currency.js";

const RECRUIT_COST = 1500; // Ryō
const MAX_COMPANION_LEVEL = 10;
const SUMMONS = {
  "aegis:summon_toad_scroll": { entity: "aegis:summon_toad", name: "Toad", sound: "mob.slime.big" },
  "aegis:summon_slug_scroll": { entity: "aegis:summon_slug", name: "Slug", sound: "mob.slime.small" },
  "aegis:summon_snake_scroll": { entity: "aegis:summon_snake", name: "Snake", sound: "mob.silverfish.say" },
};
const SUMMON_COST = 40;
const SUMMON_CD = 1200; // 60s

let api;

function tame(e, player) {
  e.setDynamicProperty("aegis:owner", player.id);
  try {
    if (e.getComponent("minecraft:tameable")?.tame(player)) return;
  } catch {
    /* fall back to our own follow logic */
  }
  try {
    e.triggerEvent("aegis:tamed");
  } catch {
    /* ignore */
  }
}

const ownerOf = (e) => {
  try {
    return e.getDynamicProperty("aegis:owner");
  } catch {
    return undefined;
  }
};

function companionName(e) {
  const base = e.getDynamicProperty("aegis:base_name") ?? "Genin";
  return `${base} §7Lv.${e.getDynamicProperty("aegis:clevel") ?? 1}`;
}

// ---------------------------------------------------------------------------
// Genin
// ---------------------------------------------------------------------------
async function geninMenu(player, e) {
  const owner = ownerOf(e);
  if (!owner) {
    const r = await new ActionFormData()
      .title("§lGenin")
      .body(`§7"Hire me and I'll fight by your side! I get stronger with every battle."\n\n§6Your Ryō: §f${fmtRyo(getRyo(player))}`)
      .button(`§2Recruit\n§r§7${fmtRyo(RECRUIT_COST)}`)
      .button("Not now")
      .show(player);
    if (r.canceled || r.selection !== 0) return;
    if (!spendRyo(player, RECRUIT_COST)) return player.sendMessage(`§cYou need ${fmtRyo(RECRUIT_COST)}.`);
    // leave the spawner (it will send a new recruit later) and join the player
    for (const tag of e.getTags()) if (tag.startsWith("aegis_sp_")) e.removeTag(tag);
    e.setDynamicProperty("aegis:spawner", undefined);
    e.setDynamicProperty("aegis:base_name", (e.nameTag || "Genin").replace(/§7Lv\.\d+/, "").trim());
    e.setDynamicProperty("aegis:clevel", 1);
    e.setDynamicProperty("aegis:cxp", 0);
    e.setDynamicProperty("aegis:mode", "follow");
    try {
      e.triggerEvent("aegis:wander");
      e.triggerEvent("aegis:vulnerable");
    } catch {
      /* ignore */
    }
    tame(e, player);
    e.nameTag = companionName(e);
    api.particle(e.dimension, "aegis:chakra_aura", e.location);
    player.sendMessage(`§a${e.getDynamicProperty("aegis:base_name")} joined your team!`);
    return;
  }
  if (owner !== player.id) return player.sendMessage("§7\"I already have a team leader.\"");
  const mode = e.getDynamicProperty("aegis:mode") ?? "follow";
  const lvl = e.getDynamicProperty("aegis:clevel") ?? 1;
  const xp = e.getDynamicProperty("aegis:cxp") ?? 0;
  const r = await new ActionFormData()
    .title(`§l${e.getDynamicProperty("aegis:base_name") ?? "Genin"}`)
    .body(`§7Level §f${lvl}/${MAX_COMPANION_LEVEL}§7 · XP §f${xp}/${lvl * 100}\n§7Mode: §f${mode}`)
    .button(mode === "follow" ? "§6Stay here" : "§2Follow me")
    .button("§cDismiss (send home)")
    .button("Close")
    .show(player);
  if (r.canceled) return;
  if (r.selection === 0) {
    const next = mode === "follow" ? "stay" : "follow";
    e.setDynamicProperty("aegis:mode", next);
    e.triggerEvent(next === "stay" ? "aegis:stay" : "aegis:wander");
    player.sendMessage(next === "stay" ? "§7\"I'll hold this position.\"" : "§7\"Right behind you!\"");
  } else if (r.selection === 1) {
    api.particle(e.dimension, "aegis:smoke_puff", e.location);
    e.remove();
    player.sendMessage("§7Your companion headed home.");
  }
}

const reanimated = (e) => {
  try {
    return !!e.getDynamicProperty("aegis:reanimated");
  } catch {
    return false;
  }
};

function companionKill(companion, dead) {
  if (companion.typeId !== "aegis:genin" || !ownerOf(companion) || reanimated(companion)) return;
  let lvl = companion.getDynamicProperty("aegis:clevel") ?? 1;
  if (lvl >= MAX_COMPANION_LEVEL) return;
  let xp = (companion.getDynamicProperty("aegis:cxp") ?? 0) + 25;
  try {
    xp = (companion.getDynamicProperty("aegis:cxp") ?? 0) + Math.max(10, Math.round(dead.getComponent("minecraft:health").effectiveMax * 2));
  } catch {
    /* use default */
  }
  let leveled = false;
  while (lvl < MAX_COMPANION_LEVEL && xp >= lvl * 100) {
    xp -= lvl * 100;
    lvl++;
    leveled = true;
  }
  companion.setDynamicProperty("aegis:cxp", xp);
  companion.setDynamicProperty("aegis:clevel", lvl);
  if (leveled) {
    applyCompanionStats(companion, lvl);
    companion.nameTag = companionName(companion);
    api.particle(companion.dimension, "minecraft:totem_particle", api.add(companion.location, { x: 0, y: 1, z: 0 }));
    api.sound(companion.dimension, "random.levelup", companion.location, 0.7, 1.4);
  }
}

function applyCompanionStats(e, lvl) {
  const add = (id, amp) => {
    if (amp < 0) return;
    try {
      e.addEffect(id, 20000000, { amplifier: amp, showParticles: false });
    } catch {
      /* ignore */
    }
  };
  add("strength", Math.floor(lvl / 3) - 1);
  add("resistance", Math.floor(lvl / 4) - 1);
  add("health_boost", Math.floor(lvl / 2) - 1);
  add("speed", lvl >= 8 ? 0 : -1);
  try {
    const h = e.getComponent("minecraft:health");
    h.setCurrentValue(h.effectiveMax);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Summons
// ---------------------------------------------------------------------------
export function handleSummonUse(player, itemStack) {
  const s = SUMMONS[itemStack.typeId];
  if (!s) return false;
  const left = api.cooldownLeft(player, "summon");
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7Summoning ready in §f${(left / 20).toFixed(1)}s`);
    return true;
  }
  if (api.getChakra(player) < SUMMON_COST) {
    player.onScreenDisplay.setActionBar(`§cNot enough chakra! §7(${Math.floor(api.getChakra(player))}/${SUMMON_COST})`);
    return true;
  }
  api.setChakra(player, api.getChakra(player) - SUMMON_COST);
  api.startCooldown(player, "summon", SUMMON_CD);
  api.gainJutsuXp(player, SUMMON_COST);
  // one summon at a time
  for (const e of player.dimension.getEntities({ families: ["summon"] })) if (ownerOf(e) === player.id) e.remove();
  api.anim(player, "animation.aegis.summon_slam");
  const d = player.getViewDirection();
  const h = api.norm({ x: d.x, y: 0, z: d.z });
  const at = api.add(player.location, api.scale(h, 3));
  system.runTimeout(() => {
    try {
      const e = player.dimension.spawnEntity(s.entity, at);
      tame(e, player);
      e.nameTag = `${player.name}'s ${s.name}`;
      api.particle(player.dimension, "aegis:smoke_puff", at);
      api.particle(player.dimension, "minecraft:huge_explosion_emitter", at);
      api.sound(player.dimension, s.sound, at, 1.5, 0.6);
      player.onScreenDisplay.setActionBar(`§dSummoning Jutsu: ${s.name}!`);
    } catch {
      /* ignore */
    }
  }, 8);
  return true;
}

function summonSpecials() {
  for (const name of ["overworld", "nether", "the_end"]) {
    let list = [];
    try {
      list = world.getDimension(name).getEntities({ families: ["summon"] });
    } catch {
      continue;
    }
    for (const e of list) {
      const owner = world.getAllPlayers().find((p) => p.id === ownerOf(e));
      const foes = e.dimension.getEntities({ location: e.location, maxDistance: 6, families: ["monster"] });
      if (e.typeId === "aegis:summon_toad" && foes.length && Math.random() < 0.5) {
        // belly slam
        api.particle(e.dimension, "minecraft:huge_explosion_emitter", e.location);
        api.particle(e.dimension, "aegis:smoke_puff", e.location);
        api.sound(e.dimension, "random.explode", e.location, 0.8, 0.6);
        for (const f of foes) {
          api.hurt(f, 8, e);
          const away = api.norm({ x: f.location.x - e.location.x, y: 0, z: f.location.z - e.location.z });
          api.knockback(f, away.x, away.z, 1.6, 0.6);
        }
      } else if (e.typeId === "aegis:summon_slug") {
        // heals its summoner and spits acid
        if (owner && owner.dimension.id === e.dimension.id) {
          const d = api.sub(owner.location, e.location);
          if (d.x * d.x + d.y * d.y + d.z * d.z < 144) {
            try {
              owner.addEffect("regeneration", 60, { amplifier: 1, showParticles: true });
            } catch {
              /* ignore */
            }
            api.setChakra(owner, api.getChakra(owner) + 6);
            api.particle(e.dimension, "aegis:chakra_aura", owner.location);
          }
        }
        for (const f of foes) {
          api.hurt(f, 3, e);
          try {
            f.addEffect("poison", 60, { amplifier: 0 });
          } catch {
            /* ignore */
          }
          api.particle(e.dimension, "aegis:beast_mist", f.location, [0.6, 0.95, 0.4]);
        }
      }
      // keep summons with their summoner
      if (owner && owner.dimension.id === e.dimension.id) {
        const d = api.sub(owner.location, e.location);
        if (d.x * d.x + d.z * d.z > 30 * 30) e.teleport(api.add(owner.location, { x: 2, y: 0, z: 2 }));
      }
    }
  }
}

export function initCompanions(helpers) {
  api = helpers;

  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (target.typeId !== "aegis:genin" || reanimated(target)) return; // Edo Tensei bodies aren't hireable companions
    system.run(() => geninMenu(player, target).catch(() => {}));
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    const k = damageSource?.damagingEntity;
    if (k?.typeId === "aegis:genin") companionKill(k, deadEntity);
  });

  // Snake bites poison.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== "aegis:summon_snake") return;
    try {
      hitEntity.addEffect("poison", 100, { amplifier: 1 });
    } catch {
      /* ignore */
    }
  });

  system.runInterval(summonSpecials, 40);

  // Companions that fall far behind catch up (also covers platforms where taming falls back).
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      for (const e of p.dimension.getEntities({ type: "aegis:genin", location: p.location, maxDistance: 96 })) {
        if (ownerOf(e) !== p.id || (e.getDynamicProperty("aegis:mode") ?? "follow") !== "follow") continue;
        const d = api.sub(p.location, e.location);
        if (d.x * d.x + d.z * d.z > 20 * 20) e.teleport(api.add(p.location, { x: 1.5, y: 0, z: 1.5 }));
      }
    }
  }, 60);
}
