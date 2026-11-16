// One rampage at a time (v1.54): only one Tailed Beast (the Ten-Tails included) can be loose in the world at once.
// While one is out, a summoning scroll refuses, a quest won't call another, and any other beast that appears — a broken
// seal, an old one loading in — is turned away. The slot frees when the beast is defeated or cleared away (the lag clear
// sends a beast home after 20 minutes), or if it hasn't been seen for 25 minutes (left behind in an unloaded area).
// A Jinchūriki's "dark half" trial is fought inside the seal and doesn't count.

import { world, system } from "@minecraft/server";

export const TAILED_BEASTS = new Set(["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama", "juubi"]
  .map((b) => `aegis:${b}`));
const SLOT = "aegis:rampage";
const STALE = 25 * 60000;

let api;

function read() {
  try {
    return JSON.parse(world.getDynamicProperty(SLOT) ?? "null");
  } catch {
    return null;
  }
}
const write = (v) => world.setDynamicProperty(SLOT, v ? JSON.stringify(v) : undefined);
const nameOf = (type) => type.replace("aegis:", "").split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ").replace("Juubi", "the Ten-Tails");

// The beast that's loose right now (or undefined). Refreshes the slot when it can see the beast.
export function rampageHolder() {
  const h = read();
  if (!h) return undefined;
  let e;
  try {
    e = world.getEntity(h.id);
  } catch {
    e = undefined;
  }
  if (e && api?.isValid(e)) {
    h.seen = Date.now();
    h.x = Math.round(e.location.x);
    h.z = Math.round(e.location.z);
    write(h);
    return { ...h, name: nameOf(h.type) };
  }
  if (Date.now() - (h.seen ?? h.since ?? 0) > STALE) {
    write(null);
    return undefined;
  }
  return { ...h, name: nameOf(h.type) };
}

export const rampageText = (h) => `§c${h.name} is already rampaging${h.x !== undefined ? ` (near ${h.x}, ${h.z})` : ""} — only one Tailed Beast can be loose at a time.`;

// The beast is gone (defeated, cleared, sealed): free the slot.
export function releaseRampage(id) {
  const h = read();
  if (h && h.id === id) write(null);
}

const isTrial = (e) => {
  try {
    return !!e.getDynamicProperty("aegis:trial_of");
  } catch {
    return false;
  }
};

export function initRampage(helpers) {
  api = helpers;
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (!TAILED_BEASTS.has(entity.typeId)) return;
    system.runTimeout(() => {
      if (!api.isValid(entity) || isTrial(entity)) return;
      const h = rampageHolder();
      if (h && h.id !== entity.id) {
        try {
          for (const p of entity.dimension.getPlayers({ location: entity.location, maxDistance: 64 })) p.sendMessage(rampageText(h));
          api.particle(entity.dimension, "aegis:smoke_puff", entity.location);
          entity.remove();
        } catch {
          /* ignore */
        }
        return;
      }
      write({ id: entity.id, type: entity.typeId, since: Date.now(), seen: Date.now(), x: Math.round(entity.location.x), z: Math.round(entity.location.z) });
    }, 3);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (TAILED_BEASTS.has(deadEntity.typeId)) releaseRampage(deadEntity.id);
  });
  // keep the slot honest (a beast sealed or removed some other way)
  system.runInterval(() => void rampageHolder(), 1200);
}
