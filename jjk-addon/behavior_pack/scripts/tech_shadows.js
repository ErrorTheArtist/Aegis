// Ten Shadows (Megumi's technique): shikigami called out of your shadow.
//   Divine Dogs            two wolves (white and black) fight beside you for 30 s: they go for what you attack, what
//                          attacks you, and any curse or monster nearby.
//   Nue                    an owl of lightning circles above you for 20 s and dives at your nearest enemy.
//   Max Elephant           (Grade 2) drops a colossal elephant onto the spot you look at.
//   Chimera Shadow Garden  (Grade 1) Domain Expansion.

import {
  V, eye, look, fx, sound, task, spawnFx, removeFx, tp, valid, alive, foes, mid, knock, anim, COLOR, rayEnd, ground, setProp, effect,
  byId, nameOf, aimed,
} from "./core.js";
import { hurt } from "./combat.js";
import { expand, setDogSummoner } from "./domains.js";

const dogs = new Map(); // owner id -> [dog ids]
const nues = new Map(); // owner id -> { entity, until }

export function summonDogs(p, extra = false) {
  if (!extra) for (const id of dogs.get(p.id) ?? []) removeFx(byId(id));
  const dim = p.dimension;
  const f = V.flat(look(p));
  const side = { x: -f.z, y: 0, z: f.x };
  const ids = extra ? [...(dogs.get(p.id) ?? [])] : [];
  for (const [kind, s] of [["white", 1], ["black", -1]]) {
    const at = ground(dim, V.add(p.location, V.add(V.mul(side, 1.6 * s), V.mul(f, 1))));
    let dog;
    try {
      dog = dim.spawnEntity(`jjk:divine_dog_${kind}`, at);
    } catch {
      continue;
    }
    setProp(dog, "owner", p.id);
    try {
      dog.nameTag = `§7${nameOf(p)}'s ${kind === "white" ? "§fWhite" : "§8Black"} Dog`;
    } catch {
      /* ignore */
    }
    try {
      dog.getComponent("minecraft:tameable")?.tame(p);
    } catch {
      /* not tameable by script here: they still hunt curses and monsters */
    }
    fx(dim, "jjk:smoke", at, COLOR.dark, 1.2);
    fx(dim, "jjk:ring", at, COLOR.shadow, 0.8);
    ids.push(dog.id);
  }
  dogs.set(p.id, ids);
  sound(dim, "mob.wolf.growl", p.location, 1, 0.8);
  sound(dim, "mob.wolf.bark", p.location, 1, 0.7);
  return true;
}
setDogSummoner(summonDogs);

function divineDogs(p) {
  anim(p, "summon");
  return summonDogs(p);
}

function nue(p) {
  anim(p, "summon");
  const dim = p.dimension;
  const old = nues.get(p.id);
  if (old && valid(old.entity)) {
    old.until = Date.now() + 20000;
    return true;
  }
  const bird = spawnFx(dim, "jjk:nue", V.add(p.location, { x: 0, y: 3, z: 0 }));
  if (!bird) return false;
  const state = { entity: bird, until: Date.now() + 20000 };
  nues.set(p.id, state);
  sound(dim, "mob.phantom.swoop", p.location, 1, 1.2);
  fx(dim, "jjk:smoke", bird.location, COLOR.dark, 1);
  let dive = null; // { target, from, t }
  let pos = { ...bird.location };
  task((age) => {
    if (!alive(p) || !valid(bird) || Date.now() > state.until || bird.dimension?.id !== p.dimension?.id) {
      if (valid(bird)) fx(bird.dimension, "jjk:smoke", bird.location, COLOR.dark, 1);
      removeFx(bird);
      nues.delete(p.id);
      return false;
    }
    if (!dive && age % 30 === 15) {
      let best;
      let bd = 1e9;
      for (const e of foes(p, p.location, 16)) {
        const d = V.dist(e.location, p.location);
        if (d < bd) {
          best = e;
          bd = d;
        }
      }
      if (best) {
        dive = { target: best, from: { ...pos }, t: 0 };
        sound(dim, "mob.phantom.swoop", pos, 1, 1.4);
      }
    }
    if (dive) {
      dive.t++;
      const to = valid(dive.target) ? mid(dive.target) : dive.from;
      const u = Math.min(1, dive.t / 6);
      pos = V.add(dive.from, V.mul(V.sub(to, dive.from), u));
      fx(dim, "jjk:spark", pos, COLOR.gold, 0.5);
      if (u >= 1) {
        if (valid(dive.target)) {
          hurt(p, dive.target, 6);
          effect(dive.target, "slowness", 40, 1);
          fx(dim, "jjk:spark", to, COLOR.gold, 1.4);
          fx(dim, "jjk:bolt", to, COLOR.gold, 0.7);
          sound(dim, "ambient.weather.thunder", to, 0.3, 2);
        }
        dive = null;
      }
    } else {
      const back = V.flat(look(p));
      const home = { x: p.location.x - back.x * 1.5, y: p.location.y + 3.2 + Math.sin(age / 8) * 0.3, z: p.location.z - back.z * 1.5 };
      pos = V.add(pos, V.mul(V.sub(home, pos), 0.25));
    }
    tp(bird, pos, { facingLocation: dive && valid(dive.target) ? mid(dive.target) : V.add(pos, V.flat(look(p))) });
    return true;
  }, 20 * 25);
  return true;
}

function maxElephant(p) {
  anim(p, "summon");
  const dim = p.dimension;
  const target = aimed(p, 20); // it falls on the enemy you aim at — or wherever you're looking
  const spot = ground(dim, target ? target.location : rayEnd(dim, eye(p), look(p), 20).at);
  const top = V.add(spot, { x: 0, y: 14, z: 0 });
  const ele = spawnFx(dim, "jjk:max_elephant", top);
  sound(dim, "mob.ravager.roar", p.location, 1, 0.6);
  fx(dim, "jjk:ring", spot, COLOR.water, 2);
  task((age) => {
    const u = Math.min(1, age / 14);
    if (valid(ele)) tp(ele, { x: spot.x, y: top.y - 14 * u * u, z: spot.z }, { facingLocation: p.location });
    if (age % 3 === 0) fx(dim, "jjk:ring", spot, COLOR.water, 2 - u);
    if (age < 14) return true;
    if (age === 14) {
      for (const e of foes(p, spot, 6)) {
        hurt(p, e, 20);
        const d = V.flat(V.sub(e.location, spot));
        knock(e, d.x, d.z, 1.8, 0.55);
        effect(e, "slowness", 60, 1);
      }
      fx(dim, "jjk:burst", V.add(spot, { x: 0, y: 1, z: 0 }), COLOR.water, 2.6);
      fx(dim, "jjk:ring", spot, COLOR.water, 3);
      fx(dim, "jjk:smoke", spot, COLOR.grey, 2.5);
      sound(dim, "random.explode", spot, 1.4, 0.6);
      sound(dim, "random.splash", spot, 1.4, 0.7);
      return true;
    }
    if (age < 34) return true;
    if (valid(ele)) fx(dim, "jjk:smoke", ele.location, COLOR.dark, 2.5);
    removeFx(ele);
    return false;
  }, 40);
  return true;
}

export const TEN_SHADOWS = {
  summon_divine_dogs: { name: "Divine Dogs", cost: 30, cd: 15, grade: 0, run: divineDogs, info: "Two wolves fight for you for 30 s." },
  summon_nue: { name: "Nue", cost: 35, cd: 20, grade: 0, run: nue, info: "For 20 s it dives at your nearest enemy: 6 damage and slowness." },
  summon_max_elephant: { name: "Max Elephant", cost: 60, cd: 25, grade: 2, run: maxElephant,
    info: "Drops on the enemy you aim at (or where you look, 20 blocks): 20 damage in 5 blocks." },
  chimera_shadow_garden: { name: "Domain Expansion: Chimera Shadow Garden", cost: "domain", cd: 90, grade: 4, run: (p) => expand(p, "garden"),
    info: "Radius 12, 10 s: enemies slowed, 2 damage a second; you're faster and tougher; two more dogs." },
};
export const _state = { dogs, nues };
