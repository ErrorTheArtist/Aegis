// The Jujutsu Kaisen cast in the world. One entity, jjk:sorcerer: its jjk:npc property picks who it is (models:
// tools/gen_sorcerers.py; indices: roster_ids.js). They fight with the same techniques players use — Gojo casts Hollow
// Purple and the Unlimited Void, Sukuna opens the Malevolent Shrine — plus a few of their own (npc_moves.js).
//
// Jujutsu High (allies): Gojo, Yuji, Megumi, Nobara, Maki, Inumaki, Panda, Nanami, Mei Mei, Todo, Yuta.
//   They exorcise curses, fight villains, and never hurt a player who isn't sparring them (and players' techniques
//   don't hurt them either). At night one may turn up to help a sorcerer surrounded by curses.
//   Right-click one to talk: a line in character, what their technique is — and a spar. A spar is a real fight, but
//   they pull their punches: it can't kill you. Bring them to half health to win XP (once every 10 minutes for each
//   character). Ask Todo what he asks everyone.
// Villains (bosses, with a boss bar): Sukuna, Toji, Geto, Mahito, Choso, Jogo. At night one may appear near a
//   Grade 1 sorcerer (Sukuna only for Special Grade, or anyone who has eaten 15 fingers) — one at a time. Beaten, they
//   pay a lot of XP and drop Sukuna's Fingers or Cursed Wombs. Left alone for a minute, they leave.
// Admins: Admin Panel -> Summon a character (it can stay put, for a hub), or /scriptevent jjk:summon <id> [stay].

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { NPC_IDS } from "./roster_ids.js";
import {
  getProp, setProp, bump, now, V, valid, alive, isPlayer, health, gameMode, fx, sound, tell, title, effect, clearEffect, mid, tp, COLOR,
  byId, ground, worldProp, targetRules, sideOf,
} from "./core.js";
import { hurt, dmgHooks, dmgCaps } from "./combat.js";
import { MOVES, TECHNIQUES } from "./techniques.js";
import { NPC_MOVES } from "./npc_moves.js";
import { addXp, gradeOf, fingersOf, G } from "./grades.js";
import { CLANS } from "./clans.js";

const NAMES = {
  gojo: "Satoru Gojo", yuji: "Yuji Itadori", megumi: "Megumi Fushiguro", nobara: "Nobara Kugisaki", maki: "Maki Zen'in", inumaki: "Toge Inumaki",
  panda: "Panda", nanami: "Kento Nanami", mei_mei: "Mei Mei", todo: "Aoi Todo", yuta: "Yuta Okkotsu",
  sukuna: "Ryomen Sukuna", toji: "Toji Fushiguro", geto: "Suguru Geto", mahito: "Mahito", choso: "Choso", jogo: "Jogo",
};
// who: title, colour, side, clan, technique (for the Record), grade (domain clashes), power (damage multiplier),
// moves [[id, range]], spar XP (allies) or xp + drops [[item, count, chance]] (villains), lines
export const CAST = {
  gojo: { title: "The Strongest", c: "§b", side: "ally", clan: "gojo", tech: "limitless", grade: 5, power: 1.6, spar: 1500, infinity: true,
    moves: [["blue", 10], ["red", 24], ["hollow_purple", 32], ["unlimited_void", 10]],
    lines: ["Don't worry. I'm the strongest.", "Throughout heaven and earth, I alone am the honored one.", "Sneak while you use Blue — it pulls you instead. Trust me."] },
  yuji: { title: "Sukuna's Vessel", c: "§d", side: "ally", clan: "clanless", tech: null, grade: 3, power: 1.2, spar: 150,
    moves: [["divergent_fist", 4.5], ["black_flash_strike", 4.5]],
    lines: ["I'm gonna eat all of Sukuna's fingers. ...That came out wrong.", "Black Flash isn't luck. Okay — it's a little luck.", "Sneak and stand still to focus your cursed energy."] },
  megumi: { title: "Ten Shadows", c: "§5", side: "ally", clan: "zenin", tech: "ten_shadows", grade: 2, power: 1.1, spar: 120,
    moves: [["summon_divine_dogs", 16], ["summon_nue", 16], ["summon_max_elephant", 18], ["chimera_shadow_garden", 10]],
    lines: ["I save people unequally.", "Shikigami answer to resolve, not strength.", "The Zen'in clan would do anything for the Ten Shadows."] },
  nobara: { title: "Straw Doll", c: "§6", side: "ally", clan: "clanless", tech: "straw_doll", grade: 3, power: 1.1, spar: 120,
    moves: [["straw_hairpin", 20], ["straw_resonance", 64], ["straw_nail_barrage", 8]],
    lines: ["I'm a country girl, not a pushover.", "Hit them once and they're mine — Resonance does the rest.", "A hammer, some nails and a doll. What else do you need?"] },
  maki: { title: "Heavenly Restriction", c: "§2", side: "ally", clan: "zenin", tech: "heavenly", grade: 3, power: 1.2, spar: 160,
    moves: [["playful_cloud", 4], ["dragon_bone", 4.5]],
    lines: ["No cursed energy? Then train harder.", "I'll be head of the Zen'in clan one day. Watch me.", "A cursed tool is only as good as the arm that swings it."] },
  inumaki: { title: "Cursed Speech", c: "§3", side: "ally", clan: "inumaki", tech: "cursed_speech", grade: 2, power: 1.1, spar: 110,
    moves: [["speech_dont_move", 12], ["speech_blast_away", 10], ["speech_crush", 16]],
    lines: ["Salmon.", "Tuna mayo!", "Bonito flakes. §8(He points at the Clans page of your Record.)"] },
  panda: { title: "Abrupt Mutated Cursed Corpse", c: "§f", side: "ally", clan: "clanless", tech: null, grade: 3, power: 1.1, spar: 150,
    moves: [["gorilla_core", 4]],
    lines: ["I'm not a panda. ...Okay, I'm a panda.", "Gorilla mode is a secret. Don't tell anyone.", "Curses come out at night. Stay close to your friends."] },
  nanami: { title: "Ratio", c: "§9", side: "ally", clan: "clanless", tech: "ratio", grade: 4, power: 1.3, spar: 300,
    moves: [["ratio_seven_three", 6], ["ratio_flurry", 4], ["ratio_collapse", 7]],
    lines: ["I hate overtime.", "Strike the 7:3 point. Precisely there.", "Jujutsu is a job. Do it properly and go home."] },
  mei_mei: { title: "Black Bird Manipulation", c: "§8", side: "ally", clan: "clanless", tech: null, grade: 4, power: 1.3, spar: 300,
    moves: [["bird_strike", 30], ["axe_cleave", 4.5]],
    lines: ["Money is everything. This spar's free — this time.", "My crows see the whole town.", "Grade 1 is where the real money is."] },
  todo: { title: "Boogie Woogie", c: "§6", side: "ally", clan: "clanless", tech: "boogie", grade: 4, power: 1.3, spar: 350,
    moves: [["boogie_swap", 20], ["clap_barrage", 12], ["black_flash_swap", 20]],
    lines: ["What kind of women are you into?"] },
  yuta: { title: "Special Grade Sorcerer", c: "§f", side: "ally", clan: "clanless", tech: null, grade: 5, power: 1.5, spar: 800,
    moves: [["rika", 8], ["speech_blast_away", 10], ["black_flash_strike", 4.5]],
    lines: ["Rika, don't!", "I'll love you forever, Rika.", "Copying a technique takes a lot of cursed energy. Rika has plenty."] },
  sukuna: { title: "King of Curses", c: "§4", side: "villain", clan: "clanless", tech: "shrine", grade: 5, power: 1.5, xp: 3000,
    drops: [["jjk:sukuna_finger", 3, 1], ["jjk:cursed_womb", 1, 1]], domainBelow: 0.6,
    moves: [["dismantle", 16], ["cleave", 6], ["fuga", 30], ["malevolent_shrine", 12]],
    lines: ["Know your place, fool.", "Stand proud. You are strong.", "How amusing."] },
  toji: { title: "Sorcerer Killer", c: "§8", side: "villain", clan: "zenin", tech: "heavenly", grade: 4, power: 1.5, xp: 1200,
    drops: [["jjk:cursed_womb", 1, 0.5]],
    moves: [["burst", 20], ["inverted_spear_of_heaven", 5], ["playful_cloud", 4], ["split_soul_katana", 6]],
    lines: ["I'm a monkey who broke out of his cage.", "Nothing personal. It's just a job."] },
  geto: { title: "The Worst Curse User", c: "§6", side: "villain", clan: "clanless", tech: null, grade: 5, power: 1.4, xp: 1500,
    drops: [["jjk:sukuna_finger", 1, 1]], moves: [["curse_release", 20], ["uzumaki", 24]],
    lines: ["Monkeys. All of you.", "Every curse is mine to command."] },
  mahito: { title: "Special Grade Curse", c: "§9", side: "villain", clan: "clanless", tech: null, grade: 5, power: 1.4, xp: 1200,
    drops: [["jjk:cursed_womb", 1, 0.6]], moves: [["idle_transfiguration", 3.5], ["soul_spikes", 4]],
    lines: ["The soul is the shape of the body.", "Let's play!"] },
  choso: { title: "Death Painting", c: "§4", side: "villain", clan: "kamo", tech: "blood", grade: 4, power: 1.3, xp: 1000,
    drops: [["jjk:cursed_womb", 1, 0.5]], moves: [["piercing_blood", 20], ["supernova", 5], ["convergence", 30]],
    lines: ["I'm the big brother!", "Blood is thicker than water."] },
  jogo: { title: "Special Grade Curse", c: "§c", side: "villain", clan: "clanless", tech: null, grade: 5, power: 1.4, xp: 1200,
    drops: [["jjk:sukuna_finger", 1, 1]], moves: [["ember_insects", 24], ["meteor", 24]],
    lines: ["Humans are the impostors!", "Burn to ash!"] },
};
const DOMAINS = new Set(["unlimited_void", "malevolent_shrine", "chimera_shadow_garden"]);
export const SPAR_COOLDOWN = 600000; // ms per character
export const VILLAINS = Object.keys(CAST).filter((k) => CAST[k].side === "villain");
export const ALLIES = Object.keys(CAST).filter((k) => CAST[k].side === "ally");

export const whoIs = (e) => getProp(e, "who");
export const nameOfCast = (who) => NAMES[who] ?? who;
const sparring = new Map(); // npc id -> { pid, start, who }
const casting = new Map(); // npc id -> { next: tick, cds: { move: tick } }
const idle = new Map(); // villain id -> ticks with nobody near
export const sparPartner = (npc) => sparring.get(npc?.id)?.pid;
export const sparOf = (p) => [...sparring].find(([, s]) => s.pid === p?.id)?.[0];

// ---------------------------------------------------------------------------
// Setup: the jjk:npc property says who it is; the event gives it their health, size and side
// ---------------------------------------------------------------------------
export function setupSorcerer(e, who) {
  if (!valid(e)) return undefined;
  if (!who && getProp(e, "who")) return getProp(e, "who");
  if (!who) {
    let idx = 0;
    try {
      idx = e.getProperty("jjk:npc") ?? 0;
    } catch {
      /* ignore */
    }
    who = NPC_IDS[idx] ?? "yuji";
  }
  const c = CAST[who];
  if (!c) return undefined;
  try {
    e.triggerEvent(`jjk:as_${who}`);
  } catch {
    /* ignore */
  }
  setProp(e, "who", who);
  setProp(e, "side", c.side);
  setProp(e, "grade", c.grade);
  try {
    e.nameTag = `${c.c}§l${nameOfCast(who)}\n§r§7${c.title}`;
  } catch {
    /* ignore */
  }
  return who;
}

export function spawnSorcerer(dim, who, loc, opts = {}) {
  let e;
  try {
    e = dim.spawnEntity("jjk:sorcerer", loc);
  } catch {
    return undefined;
  }
  setupSorcerer(e, who);
  if (opts.stay) e.triggerEvent?.("jjk:stay");
  if (opts.wanderer) e.triggerEvent?.("jjk:wanderer");
  fx(dim, "jjk:smoke", loc, CAST[who].side === "villain" ? COLOR.dark : COLOR.white, 1.4);
  return e;
}

// ---------------------------------------------------------------------------
// Teams: who may hurt whom
// ---------------------------------------------------------------------------
const CURSES = /^jjk:(fly_head|lanky_curse|mouth_curse|eye_curse|finger_bearer)$/;
targetRules.push((caster, e) => {
  const cs = sideOf(caster);
  const es = sideOf(e);
  if (cs === "ally") {
    if (es === "ally") return false;
    if (isPlayer(e)) return sparPartner(caster) === e.id; // only the player they're sparring
    if (getProp(e, "owner") && !es) return false; // players' shikigami
  }
  if (cs === "villain") {
    if (es === "villain" || CURSES.test(e.typeId)) return false; // villains and curses don't fight each other
  }
  if (isPlayer(caster) && es === "ally") return sparPartner(e) === caster.id; // no friendly fire on Jujutsu High
  return true;
});
// their strength
dmgHooks.push((caster) => (caster?.typeId === "jjk:sorcerer" ? CAST[whoIs(caster)]?.power ?? 1 : 1));
// a sparring partner pulls every punch: 35%, and never below 1 health
dmgCaps.push((caster, target, dmg) => {
  if (caster?.typeId !== "jjk:sorcerer" || !isPlayer(target) || sparPartner(caster) !== target.id) return dmg;
  const h = health(target)?.currentValue ?? 20;
  return Math.max(0, Math.min(dmg * 0.35, h - 1));
});

// ---------------------------------------------------------------------------
// Fighting
// ---------------------------------------------------------------------------
function isMonster(x) {
  try {
    return !!x.getComponent("minecraft:type_family")?.hasTypeFamily("monster");
  } catch {
    return false;
  }
}

function huntable(e, x) {
  if (!alive(x) || x.id === e.id) return false;
  if (isPlayer(x)) {
    const gm = gameMode(x);
    return gm !== "creative" && gm !== "spectator";
  }
  return true;
}

export function targetOf(e) {
  const who = whoIs(e);
  const c = CAST[who];
  if (!c) return undefined;
  if (c.side === "ally") {
    const p = byId(sparPartner(e));
    if (p) return p;
  }
  const r = c.side === "ally" ? 20 : 24;
  let list = [];
  try {
    list = e.dimension.getEntities({ location: e.location, maxDistance: r, excludeFamilies: ["jjk_fx"] });
  } catch {
    return undefined;
  }
  let best;
  let bd = 1e9;
  for (const x of list) {
    if (!huntable(e, x)) continue;
    const xs = sideOf(x);
    let foe;
    if (c.side === "ally") foe = CURSES.test(x.typeId) || xs === "villain" || (!isPlayer(x) && !xs && isMonster(x) && x.typeId !== "minecraft:creeper");
    else foe = isPlayer(x) || xs === "ally" || (!!getProp(x, "owner") && !xs);
    if (!foe) continue;
    const d = V.dist(x.location, e.location);
    if (d < bd) {
      best = x;
      bd = d;
    }
  }
  return best;
}

function face(e, t) {
  tp(e, e.location, { facingLocation: mid(t) });
}

export function runMove(e, id, t) {
  if (NPC_MOVES[id]) return NPC_MOVES[id](e, t) !== false;
  const m = MOVES[id];
  if (!m) return false;
  try {
    return m.run(e) !== false;
  } catch {
    return false;
  }
}

function cooldownTicks(id) {
  const m = MOVES[id];
  if (DOMAINS.has(id)) return 20 * 120;
  return Math.round((m?.cd ?? 8) * 20 * 1.5);
}

// One decision: cast something if a move is ready and in range. Returns the move used (for tests).
export function act(e) {
  const who = whoIs(e);
  const c = CAST[who];
  if (!c) return undefined;
  const st = casting.get(e.id) ?? { next: 0, cds: {} };
  casting.set(e.id, st);
  if (c.infinity) effect(e, "resistance", 30, 1); // Gojo: Infinity
  const t = targetOf(e);
  if (!t) {
    if (c.side === "ally") {
      const h = health(e);
      if (h && h.currentValue < h.effectiveMax) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + h.effectiveMax * 0.02));
    }
    return undefined;
  }
  if (now() < st.next) return undefined;
  const d = V.dist(e.location, t.location);
  const h = health(e);
  const hpFrac = h ? h.currentValue / h.effectiveMax : 1;
  const crowd = () => {
    try {
      return e.dimension.getEntities({ location: e.location, maxDistance: 10 }).filter((x) => x.id !== e.id && huntable(e, x) && (c.side === "ally" ? CURSES.test(x.typeId) || sideOf(x) === "villain" : isPlayer(x))).length;
    } catch {
      return 0;
    }
  };
  const options = c.moves.filter(([id, range]) => {
    if ((st.cds[id] ?? 0) > now() || d > range) return false;
    if (!DOMAINS.has(id)) return true;
    if (sparPartner(e)) return false; // no domains in a spar
    return c.side === "villain" ? hpFrac <= (c.domainBelow ?? 0.5) : crowd() >= 3 || sideOf(t) === "villain" || t.typeId === "jjk:finger_bearer";
  });
  if (!options.length) return undefined;
  const [id] = options[Math.floor(Math.random() * options.length)];
  face(e, t);
  if (!runMove(e, id, t)) {
    st.cds[id] = now() + 40;
    return undefined;
  }
  st.cds[id] = now() + cooldownTicks(id);
  st.next = now() + 30 + Math.floor(Math.random() * 30);
  if (c.side === "villain" && Math.random() < 0.15) say(e, t);
  return id;
}

function say(e, to) {
  const c = CAST[whoIs(e)];
  const line = c.lines[Math.floor(Math.random() * c.lines.length)];
  for (const p of world.getAllPlayers()) {
    if (p.dimension?.id === e.dimension?.id && V.dist(p.location, e.location) < 24) tell(p, `${c.c}${nameOfCast(whoIs(e))}: §f${line}`);
  }
}

// ---------------------------------------------------------------------------
// Sparring
// ---------------------------------------------------------------------------
export function sparReadyIn(p, who) {
  const last = getProp(p, `spar_${who}`, 0);
  return Math.max(0, last + SPAR_COOLDOWN - Date.now());
}

export function startSpar(npc, p) {
  const who = whoIs(npc);
  const c = CAST[who];
  if (!c || c.side !== "ally") return false;
  if (sparOf(p)) return tell(p, "§7You're already in a spar."), false;
  if (sparPartner(npc)) return tell(p, `§7${nameOfCast(who)} is sparring someone else.`), false;
  const wait = sparReadyIn(p, who);
  if (wait > 0) return tell(p, `${c.c}${nameOfCast(who)}: §fAgain? Rest first. §7(${Math.ceil(wait / 60000)} min)`), false;
  sparring.set(npc.id, { pid: p.id, start: now(), who });
  try {
    p.addTag("jjk_spar");
  } catch {
    /* ignore */
  }
  effect(npc, "weakness", 3000, 255); // its fists are pulled; its techniques are scaled down (and can't kill)
  title(p, "§6§lSPAR", `${c.c}${nameOfCast(who)}`, 30);
  tell(p, `${c.c}${nameOfCast(who)}: §fAlright — show me what you've got! §7(Bring them to half health to win. A spar can't kill you.)`);
  sound(p.dimension, "random.orb", p.location, 1, 0.6);
  return true;
}

export function endSpar(npcId, result) {
  const s = sparring.get(npcId);
  if (!s) return;
  sparring.delete(npcId);
  const npc = byId(npcId);
  const p = byId(s.pid);
  const c = CAST[s.who];
  if (p) {
    try {
      p.removeTag("jjk_spar");
    } catch {
      /* ignore */
    }
  }
  if (npc) {
    clearEffect(npc, "weakness");
    const h = health(npc);
    if (h) h.setCurrentValue(h.effectiveMax);
  }
  if (!p) return;
  if (result === "won") {
    setProp(p, `spar_${s.who}`, Date.now());
    bump(p, "spars_won");
    title(p, "§a§lYOU WIN", `§7You beat ${nameOfCast(s.who)}`, 40);
    tell(p, `${c.c}${nameOfCast(s.who)}: §fNot bad at all. Again some time.`);
    addXp(p, c.spar, `beat ${nameOfCast(s.who)} in a spar`);
    sound(p.dimension, "random.levelup", p.location, 1, 1);
  } else if (result === "lost") {
    title(p, "§c§lDEFEATED", `§7${nameOfCast(s.who)} wins this one`, 40);
    tell(p, `${c.c}${nameOfCast(s.who)}: §fYou'll get there. Come back stronger.`);
    const h = health(p);
    if (h) h.setCurrentValue(Math.max(h.currentValue, h.effectiveMax * 0.4));
  } else {
    tell(p, `§7The spar with ${nameOfCast(s.who)} is over.`);
  }
}

function sparTick() {
  for (const [npcId, s] of [...sparring]) {
    const npc = byId(npcId);
    const p = byId(s.pid);
    if (!alive(npc) || !alive(p) || p.dimension?.id !== npc.dimension?.id || V.dist(p.location, npc.location) > 40 || now() - s.start > 20 * 150) {
      endSpar(npcId, "over");
      continue;
    }
    const hp = health(p);
    const hn = health(npc);
    if (hp && hp.currentValue <= hp.effectiveMax * 0.3) endSpar(npcId, "lost");
    else if (hn && hn.currentValue <= hn.effectiveMax * 0.5) endSpar(npcId, "won");
  }
}

// ---------------------------------------------------------------------------
// Talking
// ---------------------------------------------------------------------------
async function show(p, form) {
  try {
    return await form.show(p);
  } catch {
    return { canceled: true };
  }
}

export async function talk(p, npc) {
  const who = whoIs(npc) ?? setupSorcerer(npc);
  const c = CAST[who];
  if (!c) return;
  if (c.side === "villain") return tell(p, `${c.c}${nameOfCast(who)}: §f${c.lines[0]}`);
  if (sparPartner(npc)) return;
  if (who === "todo") return todoQuestion(p, npc);
  const line = c.lines[Math.floor(Math.random() * c.lines.length)];
  const wait = sparReadyIn(p, who);
  const f = new ActionFormData().title(`${c.c}${nameOfCast(who)}`).body(`§7${c.title}\n\n§f"${line}"`)
    .button(wait > 0 ? `§8§lSpar\n§r§8rest ${Math.ceil(wait / 60000)} min` : `§l§6Spar\n§r§7win §a${c.spar} XP`)
    .button("§lYour technique?")
    .button("§lGoodbye");
  const r = await show(p, f);
  if (r.canceled) return;
  if (r.selection === 0) return void startSpar(npc, p);
  if (r.selection === 1) {
    const clan = CLANS[c.clan];
    const tech = c.tech ? TECHNIQUES[c.tech] : null;
    const about = tech ? `${tech.c}${tech.name}§f — ${tech.blurb}` : `§f${c.title}. Not a technique you'll ever awaken.`;
    tell(p, `${c.c}${nameOfCast(who)} §7(${clan.c}${clan.name}§7): ${about}`);
  }
}

async function todoQuestion(p, npc) {
  const f = new ActionFormData().title("§6Aoi Todo").body("§f\"Before we go any further... What kind of women are you into?\"")
    .button("§lTall, with a big butt")
    .button("§lSomeone kind")
    .button("§lI don't care");
  const r = await show(p, f);
  if (r.canceled) return;
  if (r.selection === 0) {
    title(p, "§6§lBEST FRIEND", "§7Aoi Todo approves", 50);
    tell(p, "§6Aoi Todo: §fMY BROTHER! We were classmates in a past life — I can see it! §7(Strength and Speed for a minute.)");
    effect(p, "strength", 1200, 1);
    effect(p, "speed", 1200, 1);
    if (Date.now() - getProp(p, "todo_bestie", 0) > 86400000) {
      setProp(p, "todo_bestie", Date.now());
      addXp(p, 50, "Todo's new best friend");
    }
    return;
  }
  tell(p, "§6Aoi Todo: §fBoring. ...You'll have to prove yourself with your fists!");
  if (sparReadyIn(p, "todo") <= 0) startSpar(npc, p);
}

// ---------------------------------------------------------------------------
// Encounters, rewards
// ---------------------------------------------------------------------------
function isNight() {
  try {
    const t = world.getTimeOfDay();
    return t >= 13000 && t <= 23000;
  } catch {
    return false;
  }
}
function around(p, rMin, rMax) {
  const a = Math.random() * Math.PI * 2;
  const r = rMin + Math.random() * (rMax - rMin);
  return ground(p.dimension, { x: p.location.x + Math.cos(a) * r, y: p.location.y + 8, z: p.location.z + Math.sin(a) * r }, 24);
}
function count(dim, loc, r, test) {
  try {
    return dim.getEntities({ location: loc, maxDistance: r, type: "jjk:sorcerer" }).filter(test).length;
  } catch {
    return 0;
  }
}

export function villainNight(force) {
  if (!force && (!worldProp("villains", true) || !isNight())) return undefined;
  const dim = world.getDimension("minecraft:overworld");
  if (count(dim, { x: 0, y: 0, z: 0 }, 1e9, (e) => getProp(e, "side") === "villain")) return undefined; // one at a time
  for (const p of world.getAllPlayers()) {
    if (!alive(p) || p.dimension?.id !== "minecraft:overworld" || gradeOf(p) < G.ONE) continue;
    if (!force && Math.random() >= 0.02) continue;
    const pool = VILLAINS.filter((v) => v !== "sukuna" || gradeOf(p) >= G.SPECIAL || fingersOf(p) >= 15);
    const who = pool[Math.floor(Math.random() * pool.length)];
    const e = spawnSorcerer(p.dimension, who, around(p, 18, 26));
    if (!e) continue;
    const c = CAST[who];
    try {
      world.sendMessage(`§4✦ ${c.c}${nameOfCast(who)}§f, ${c.title}, has appeared near ${p.name}...`);
    } catch {
      /* ignore */
    }
    return e;
  }
  return undefined;
}

export function allyNight(force) {
  if (!force && (!worldProp("allies", true) || !isNight())) return undefined;
  for (const p of world.getAllPlayers()) {
    if (!alive(p) || !getProp(p, "technique")) continue;
    if (!force && Math.random() >= 0.08) continue;
    let curses = 0;
    try {
      curses = p.dimension.getEntities({ location: p.location, maxDistance: 24, families: ["curse"] }).length;
    } catch {
      /* ignore */
    }
    if (!force && curses < 2) continue;
    if (count(p.dimension, p.location, 64, (e) => getProp(e, "side") === "ally") >= 2) continue;
    // the stronger ones are rarer
    const pool = ALLIES.flatMap((a) => Array(a === "gojo" ? 1 : a === "yuta" ? 2 : 6).fill(a));
    const who = pool[Math.floor(Math.random() * pool.length)];
    const e = spawnSorcerer(p.dimension, who, around(p, 8, 12), { wanderer: true });
    if (e) tell(p, `${CAST[who].c}${nameOfCast(who)} §7arrived to help!`);
    return e;
  }
  return undefined;
}

function onDeath(dead, src) {
  if (dead?.typeId !== "jjk:sorcerer") return;
  const who = whoIs(dead);
  const c = CAST[who];
  if (!c) return;
  const spar = [...sparring].find(([id]) => id === dead.id);
  if (spar) endSpar(dead.id, "over");
  if (c.side !== "villain") {
    for (const p of world.getAllPlayers()) {
      if (p.dimension?.id === dead.dimension?.id && V.dist(p.location, dead.location) < 48) tell(p, `§7${nameOfCast(who)} has fallen.`);
    }
    return;
  }
  let k = src?.damagingEntity;
  if (k && !isPlayer(k) && getProp(k, "owner")) k = byId(getProp(k, "owner"));
  const at = { ...dead.location };
  for (const [item, n, chance] of c.drops ?? []) {
    if (Math.random() < chance) {
      try {
        dead.dimension.spawnItem(new ItemStack(item, n), at);
      } catch {
        /* ignore */
      }
    }
  }
  fx(dead.dimension, "jjk:smoke", at, COLOR.dark, 3);
  try {
    world.sendMessage(`§6✦ ${c.c}${nameOfCast(who)}§f has been defeated${isPlayer(k) ? ` by ${k.name}` : ""}!`);
  } catch {
    /* ignore */
  }
  if (isPlayer(k)) {
    addXp(k, c.xp, `defeated ${nameOfCast(who)}`);
    bump(k, "villains_beaten");
  }
}

function villainsLinger() {
  for (const e of world.getDimension("minecraft:overworld").getEntities({ type: "jjk:sorcerer" })) {
    if (getProp(e, "side") !== "villain") continue;
    let anyone = false;
    try {
      anyone = e.dimension.getEntities({ location: e.location, maxDistance: 64, type: "minecraft:player" }).some((q) => alive(q));
    } catch {
      /* ignore */
    }
    const t = anyone ? 0 : (idle.get(e.id) ?? 0) + 20;
    idle.set(e.id, t);
    if (t >= 1200) {
      idle.delete(e.id);
      fx(e.dimension, "jjk:smoke", e.location, COLOR.dark, 2.5);
      try {
        e.remove();
      } catch {
        /* ignore */
      }
    }
  }
}

export function initSorcerers() {
  world.afterEvents.entitySpawn?.subscribe?.(({ entity }) => {
    if (entity?.typeId !== "jjk:sorcerer") return;
    system.runTimeout(() => setupSorcerer(entity), 2);
  });
  world.afterEvents.playerInteractWithEntity?.subscribe?.(({ player, target }) => {
    if (target?.typeId === "jjk:sorcerer") talk(player, target);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      onDeath(deadEntity, damageSource);
    } catch {
      /* ignore */
    }
    casting.delete(deadEntity?.id);
    idle.delete(deadEntity?.id);
  });
  system.runInterval(() => {
    for (const dim of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
      let list = [];
      try {
        list = world.getDimension(dim).getEntities({ type: "jjk:sorcerer" });
      } catch {
        continue;
      }
      for (const e of list) {
        try {
          setupSorcerer(e);
          act(e);
        } catch {
          /* ignore */
        }
      }
    }
    sparTick();
  }, 10);
  system.runInterval(() => {
    try {
      villainsLinger();
    } catch {
      /* ignore */
    }
  }, 20);
  system.runInterval(() => {
    try {
      allyNight();
      villainNight();
    } catch {
      /* ignore */
    }
  }, 600);
  world.afterEvents.playerLeave?.subscribe?.(({ playerId }) => {
    for (const [npcId, s] of [...sparring]) if (s.pid === playerId) endSpar(npcId, "over");
  });
}
export const _state = { sparring, casting, idle };
