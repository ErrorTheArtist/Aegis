// Servant curses: a curse that fights FOR someone (Geto's released curses, Mahito's transfigured humans).
// For a player (or an ally NPC) the curse's "jjk:servant" event (tools/gen_entities.py) makes it a tamed shikigami-like
// ally: it hunts monsters and whatever its owner fights, follows its owner, and is never hit by its owner's techniques
// (owner property). A villain's curses stay what they are — hostile to players and Jujutsu High — but still spare
// their master. Either way it gives no XP, drops nothing, and leaves after a while.

import { setProp, fx, COLOR, task, valid, removeFx, nameOf, sideOf } from "./core.js";

export function spawnServant(owner, typeId, loc, secs = 30) {
  let e;
  try {
    e = owner.dimension.spawnEntity(typeId, loc);
  } catch {
    return undefined;
  }
  const villain = sideOf(owner) === "villain";
  setProp(e, "owner", owner.id);
  try {
    e.nameTag = `§7${nameOf(owner)}§7's curse`;
    e.addTag(villain ? "jjk_minion" : "jjk_servant");
    if (!villain) e.triggerEvent("jjk:servant");
  } catch {
    /* ignore */
  }
  try {
    if (!villain) e.getComponent("minecraft:tameable")?.tame(owner);
  } catch {
    /* (an NPC owner can't tame: it still hunts monsters) */
  }
  fx(owner.dimension, "jjk:smoke", loc, COLOR.dark, 1.2);
  task((age) => {
    if (!valid(e)) return false;
    if (age < secs * 20) return true;
    fx(e.dimension, "jjk:smoke", e.location, COLOR.dark, 1.2);
    removeFx(e);
    return false;
  }, secs * 20 + 2);
  return e;
}
