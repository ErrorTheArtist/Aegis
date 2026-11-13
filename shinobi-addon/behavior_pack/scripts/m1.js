// M1 combos — basic attacks that chain. Land hits within 1.4 s of each other and they build a combo:
//   bare hands (or anything that isn't a blade):  jab → cross → roundhouse kick → rising uppercut (finisher)
//   swords, kunai, axes:                          slash → backhand → leaping chop (finisher)
// Every hit plays its own animation and sound and pulls you a step toward the target so the next one connects.
// Fists are buffed: each hit adds bonus damage (more with the Taijutsu stat); the finisher hits hardest, launches the
// target back and staggers them. Blades already hit hard, so their combo adds a small bonus on the finisher only.
//   /scriptevent aegis:m1 off | on   — turn your own combo animations off / on (damage bonus stays)

import { world, system } from "@minecraft/server";
import { getStat } from "./levels.js";
import { nindoDamage, NINDOS, getNindoId } from "./nindos.js";
import { boostHit, isEcho, healBack, scriptedHit } from "./dmgutil.js";
import { bijuuMeleeBonus } from "./bijuu.js";

const WINDOW = 28; // ticks between hits to keep the combo going
const FISTS = [
  { anim: "m1_jab", bonus: 2 },
  { anim: "m1_cross", bonus: 2 },
  { anim: "m1_kick", bonus: 3 },
  { anim: "m1_finisher", bonus: 5, finisher: true },
];
const BLADE = [
  { anim: "m1_slash1", bonus: 0 },
  { anim: "m1_slash2", bonus: 0 },
  { anim: "m1_slash3", bonus: 2, finisher: true },
];
const BLADES = /sword|kunai|kusanagi|samehada|kubikiribocho|hiramekarei|kiba|nuibari|shibuki|chakra_blades|_axe$|trident|mace/;

let api;
const combo = new Map(); // player id -> { step, tick, target }

function heldId(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex)?.typeId ?? "";
  } catch {
    return "";
  }
}

function onHit(player, target, damage) {
  const now = system.currentTick;
  const blade = BLADES.test(heldId(player));
  const chain = blade ? BLADE : FISTS;
  let c = combo.get(player.id);
  if (!c || now - c.tick > WINDOW || c.blade !== blade) c = { step: 0, blade };
  const move = chain[c.step % chain.length];
  combo.set(player.id, { step: move.finisher ? 0 : c.step + 1, tick: now, blade });

  const dim = player.dimension;
  const at = { x: target.location.x, y: target.location.y + 1.1, z: target.location.z };
  if (!player.getDynamicProperty("aegis:m1_off")) api.anim(player, `animation.aegis.${move.anim}`);
  api.sound(dim, move.finisher ? "aegis.hit_heavy" : blade ? "aegis.slash" : "aegis.hit", at, move.finisher ? 1.3 : 0.9, 0.95 + (c.step % 3) * 0.08);
  if (!blade) api.particle(dim, "aegis:slash", at, [1, 0.95, 0.8]);

  // bonus damage: fists scale with Taijutsu; then the nindō (Heavy Handed, Top Physique, Clever …) scales the hit.
  // A bigger hit is applied as (this hit + bonus) so it lands inside the hurt cooldown; a weaker one is healed back.
  const bonus = Math.round(move.bonus * (blade ? 1 : 1 + getStat(player, "taijutsu") / 100));
  // …and in Tailed Beast Mode every hit carries the beast's chakra
  const total = nindoDamage(player, target, damage, blade ? "blade" : "fist") + bonus + bijuuMeleeBonus(player, target);
  if (total > damage) boostHit(target, damage, total, player);
  else healBack(target, damage - total);
  const knock = NINDOS[getNindoId(player)]?.knock;

  const d = api.norm({ x: target.location.x - player.location.x, y: 0, z: target.location.z - player.location.z });
  const gap = Math.hypot(target.location.x - player.location.x, target.location.z - player.location.z);
  if (move.finisher) {
    api.knockback(target, d.x, d.z, 1.5, 0.45);
    try {
      target.addEffect("slowness", 20, { amplifier: 2, showParticles: false });
    } catch {
      /* ignore */
    }
    api.particle(dim, "aegis:cine_ring", { x: at.x, y: target.location.y + 0.1, z: at.z }, [1, 0.9, 0.7]);
    api.particle(dim, "aegis:dust", target.location);
    try {
      player.runCommand("camerashake add @s 0.25 0.15 positional");
    } catch {
      /* ignore */
    }
  } else if (gap > 1.6) {
    api.knockback(player, d.x, d.z, 0.35, 0); // step in so the next hit connects
  }
  if (knock && !move.finisher) api.knockback(target, d.x, d.z, knock, 0.2);
}

export function initM1(helpers) {
  api = helpers;
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (damageSource?.cause !== "entityAttack" || isEcho(hurtEntity, damage) || scriptedHit(hurtEntity, damageSource)) return;
    const p = damageSource.damagingEntity;
    if (p?.typeId !== "minecraft:player" || !api.isValid(hurtEntity) || !api.canBeHit(hurtEntity, p)) return;
    try {
      onHit(p, hurtEntity, damage);
    } catch {
      /* ignore */
    }
  });
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [id, c] of combo) if (now - c.tick > 200) combo.delete(id);
  }, 200);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:m1" || p?.typeId !== "minecraft:player") return;
    const off = String(message ?? "").trim().toLowerCase() === "off";
    p.setDynamicProperty("aegis:m1_off", off ? true : undefined);
    p.sendMessage(`§7M1 combo animations: ${off ? "§coff" : "§aon"}`);
  });
}
