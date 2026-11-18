// The Path of the Shinobi (v1.56) — a story campaign in 12 chapters that walks every shinobi through the add-on, from the
// Academy to the battle against Kaguya. Each chapter has a few objectives that are tracked by themselves; finish them and
// the chapter's reward is paid and the next chapter begins. Your mentor depends on your village (Kakashi in the Leaf,
// Gaara in the Sand…, a masked man for rogue ninja).
//   Shinobi Record → Story shows the current chapter, your mentor's words and your progress.
//   /scriptevent aegis:story            — your chapter
//   /scriptevent aegis:story reset      — start again (testing)

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { addRyo, fmtRyo, questRyo } from "./currency.js";
import { getLevel, getRank } from "./levels.js";
import { VILLAGES, getVillage, isRogue } from "./villages.js";
import { hasSageTraining } from "./sage.js";
import { giveShards } from "./xpshards.js";
import { bumpAch } from "./achievements.js";

const PROP = "aegis:story"; // { ch, prog: [n…], base: {}, done }

// objective: [kind, goal, text]   kinds: kill:<what> · cast · level · rank · sage · visit · summon · jinchuriki
export const CHAPTERS = [
  { title: "The Academy", reward: { ryo: 1000, items: [["aegis:chakra_pill", 2]] },
    intro: "So you want to be a shinobi? Then show me the basics. Mould your chakra — cast a few jutsu — and clear out the monsters near the village.",
    goals: [["cast", 3, "Cast 3 jutsu"], ["kill:monster", 5, "Defeat 5 monsters"]] },
  { title: "Mission to the Land of Waves", reward: { ryo: 2000, items: [["aegis:kunai", 16]] },
    intro: "A simple escort mission… that turned out to be anything but. Rogue ninja are on the roads. Deal with them — and get stronger.",
    goals: [["kill:ninja", 10, "Defeat 10 hostile ninja"], ["level", 10, "Reach level 10"]] },
  { title: "The Chūnin Exams", reward: { ryo: 4000, shards: 1 },
    intro: "The Chūnin Exams are here. Pass the proctor's exam — and watch out for the Sound ninja; they're up to something.",
    goals: [["rank", 1, "Pass the Chūnin exam"], ["kill:sound", 5, "Defeat 5 Sound ninja"]] },
  { title: "Konoha Crush", reward: { ryo: 5000, items: [["aegis:dango", 4]] },
    intro: "The Sound has struck. While we fight them off, take a message to one of the other great villages — we'll need allies.",
    goals: [["kill:ninja", 20, "Defeat 20 hostile ninja"], ["visit", 1, "Visit another great village"]] },
  { title: "The Search for a Legend", reward: { ryo: 8000, items: [["aegis:mystical_palm_scroll", 1]] },
    intro: "The legends of the shinobi world still walk among us. Find one — and earn their respect the only way they understand.",
    goals: [["kill:legend", 1, "Defeat a legendary shinobi"], ["level", 30, "Reach level 30"]] },
  { title: "The Retrieval Mission", reward: { ryo: 12000, items: [["aegis:summon_hounds_scroll", 1]] },
    intro: "One of ours has been lured away by the Sound. Cut through their ranks — we're bringing our comrade home.",
    goals: [["kill:sound", 10, "Defeat 10 Sound ninja"], ["level", 50, "Reach level 50"]] },
  { title: "The Akatsuki Strike", reward: { ryo: 15000, shards: 2 },
    intro: "Black cloaks with red clouds. The Akatsuki are hunting the Tailed Beasts — and anyone in their way. Take two of them down.",
    goals: [["kill:akatsuki", 2, "Defeat 2 Akatsuki members"]] },
  { title: "Sage Training", reward: { ryo: 20000, items: [["aegis:toad_oil_scroll", 1]] },
    intro: "Your strength isn't enough any more. Learn to draw in nature's chakra — Sage Mode. Ask the Jutsu Sensei about Sage Training.",
    goals: [["sage", 1, "Learn Sage Mode"]] },
  { title: "Pain's Assault", reward: { ryo: 25000, shards: 3 },
    intro: "The Akatsuki's leader has come in person. The village is burning. Fight — for everyone.",
    goals: [["kill:akatsuki", 3, "Defeat 3 more Akatsuki members"], ["kill:ninja", 50, "Defeat 50 hostile ninja"]] },
  { title: "The Tailed Beasts", reward: { ryo: 30000, items: [["aegis:bijuu_scroll", 1]] },
    intro: "A Tailed Beast's power is a burden… and a weapon. Face one and bring it down — or carry one inside you.",
    goals: [["kill:beast", 1, "Defeat a Tailed Beast (or become a Jinchūriki)"]] },
  { title: "The Fourth Great Ninja War", reward: { ryo: 50000, shards: 5, items: [["aegis:reroll_scroll", 1]] },
    intro: "The war has begun. Every village fights side by side against the reanimated legends. Hold the line.",
    goals: [["kill:legend", 5, "Defeat 5 legendary shinobi"], ["level", 150, "Reach level 150"]] },
  { title: "The Rabbit Goddess", reward: { ryo: 100000, shards: 10, items: [["aegis:reroll_scroll", 2]] },
    intro: "The mother of all chakra has returned. This is the end of everything — unless you stop her. Defeat Kaguya… or the Ten-Tails itself.",
    goals: [["kill:final", 1, "Defeat Kaguya Ōtsutsuki or the Ten-Tails"]] },
];

const MENTORS = { leaf: "§bKakashi", sand: "§6Gaara", mist: "§bMei Terumī", cloud: "§eKiller B", stone: "§6Ōnoki", rain: "§9Konan" };
export const mentorOf = (p) => (isRogue(p) ? "§8The Masked Man" : MENTORS[getVillage(p)] ?? "§7Your sensei");

let api;

export function storyState(p) {
  try {
    const st = JSON.parse(p.getDynamicProperty(PROP) ?? "null");
    if (st && Array.isArray(st.prog)) return st;
  } catch {
    /* fall through */
  }
  return { ch: 0, prog: CHAPTERS[0].goals.map(() => 0), done: false };
}
const save = (p, st) => p.setDynamicProperty(PROP, JSON.stringify(st));

function payout(p, reward) {
  const bits = [];
  const ryo = questRyo(reward.ryo); // (the economy's quest-reward setting)
  if (ryo) {
    addRyo(p, ryo, true);
    bits.push(fmtRyo(ryo));
  }
  if (reward.shards) {
    giveShards(p, reward.shards);
    bits.push(`${reward.shards} XP Shard${reward.shards > 1 ? "s" : ""}`);
  }
  for (const [id, n] of reward.items ?? []) {
    try {
      const left = p.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(id, n));
      if (left) p.dimension.spawnItem(left, p.location);
    } catch {
      /* ignore */
    }
    bits.push(`${n > 1 ? `${n}× ` : ""}${id.replace("aegis:", "").replace(/_scroll$/, " scroll").replace(/_/g, " ")}`);
  }
  return bits.join("§7, §f");
}

// Moves a chapter on once every objective is met.
function finishIfDone(p, st) {
  const C = CHAPTERS[st.ch];
  if (!C || st.done || !C.goals.every((g, i) => st.prog[i] >= g[1])) return false;
  const got = payout(p, C.reward);
  showTitle(p, `§6Chapter ${st.ch + 1} complete`, { subtitle: `§f${C.title}`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
  p.sendMessage(`§6✦ Story — Chapter ${st.ch + 1}: §f${C.title}§6 complete! §7Reward: §f${got}`);
  api?.sound(p.dimension, "random.levelup", p.location, 0.8, 0.8);
  if (st.ch + 1 >= CHAPTERS.length) {
    st.done = true;
    save(p, st);
    world.sendMessage(`§6✦ ${p.name}§e has finished the Path of the Shinobi — a hero of the shinobi world!`);
    bumpAch(p, "story_done");
    return true;
  }
  st.ch += 1;
  st.prog = CHAPTERS[st.ch].goals.map(() => 0);
  st.base = {};
  save(p, st);
  const N = CHAPTERS[st.ch];
  p.sendMessage(`§e✦ Chapter ${st.ch + 1}: §f${N.title}§e begins. ${mentorOf(p)}§f: "${N.intro}" §8(Shinobi Record → Story)`);
  checkState(p);
  return true;
}

// Progress on every objective of this kind in the current chapter (`set`: an absolute value).
export function storyProgress(p, kind, by = 1, set) {
  if (p?.typeId !== "minecraft:player") return;
  const st = storyState(p);
  if (st.done) return;
  const C = CHAPTERS[st.ch];
  let changed = false;
  C.goals.forEach(([k, goal], i) => {
    if (k !== kind || st.prog[i] >= goal) return;
    const was = st.prog[i];
    st.prog[i] = Math.min(goal, set !== undefined ? Math.max(was, set) : was + by);
    if (st.prog[i] !== was) changed = true;
  });
  if (!changed) return;
  save(p, st);
  if (!finishIfDone(p, st)) {
    const [, , text] = C.goals.find(([k]) => k === kind) ?? [];
    const i = C.goals.findIndex(([k]) => k === kind);
    if (text && i >= 0) p.onScreenDisplay?.setActionBar(`§e✦ ${text}: §f${st.prog[i]}/${C.goals[i][1]}`);
  }
}

// The objectives that are a state of the player (level, rank, Sage Mode, a visit, a Jinchūriki).
export function checkState(p) {
  const st = storyState(p);
  if (st.done) return;
  const kinds = new Set(CHAPTERS[st.ch].goals.map(([k]) => k));
  if (kinds.has("level")) storyProgress(p, "level", 0, getLevel(p));
  if (kinds.has("rank")) storyProgress(p, "rank", 0, getRank(p));
  if (kinds.has("sage") && hasSageTraining(p)) storyProgress(p, "sage", 0, 1);
  if (kinds.has("kill:beast") && p.getDynamicProperty("aegis:bijuu")) storyProgress(p, "kill:beast", 0, 1);
  if (kinds.has("visit")) {
    const home = getVillage(p);
    for (const [id, v] of Object.entries(VILLAGES)) {
      if (id === home || p.dimension.id !== "minecraft:overworld") continue;
      if (Math.hypot(p.location.x - v.pos.x, p.location.z - v.pos.z) < 80) {
        storyProgress(p, "visit", 0, 1);
        break;
      }
    }
  }
}

export async function storyMenu(p, back) {
  const st = storyState(p);
  if (st.done) {
    await new ActionFormData().title("§l§6The Path of the Shinobi").body(
      `§6✦ You've walked the whole path — all ${CHAPTERS.length} chapters.\n\n${mentorOf(p)}§f: "There's nothing left for me to teach you. The shinobi world is in your hands now."`,
    ).button("§l« Back").show(p);
    return back?.();
  }
  const C = CHAPTERS[st.ch];
  const goals = C.goals.map(([, goal, text], i) => `${st.prog[i] >= goal ? "§a✔" : "§8✘"} §f${text}§7 — ${Math.min(st.prog[i], goal)}/${goal}`);
  const reward = payoutText(C.reward);
  await new ActionFormData()
    .title(`§l§6Chapter ${st.ch + 1}/${CHAPTERS.length}`)
    .body([`§e§l${C.title}§r`, "", `${mentorOf(p)}§f: "${C.intro}"`, "", "§7Objectives:", ...goals, "", `§7Reward: §f${reward}`].join("\n"))
    .button("§l« Back")
    .show(p);
  return back?.();
}

function payoutText(r) {
  return [questRyo(r.ryo) ? fmtRyo(questRyo(r.ryo)) : "", r.shards ? `${r.shards} XP Shard${r.shards > 1 ? "s" : ""}` : "",
    ...(r.items ?? []).map(([id, n]) => `${n > 1 ? `${n}× ` : ""}${id.replace("aegis:", "").replace(/_scroll$/, " scroll").replace(/_/g, " ")}`)]
    .filter(Boolean).join("§7, §f");
}

export const storyLine = (p) => {
  const st = storyState(p);
  return st.done ? "§6Story: complete ✦" : `§7Story: §fChapter ${st.ch + 1} — ${CHAPTERS[st.ch].title}`;
};

// Called by main.js when a jutsu is cast.
export const noteStoryCast = (p) => storyProgress(p, "cast");

function killerOf(damageSource) {
  let k = damageSource?.damagingEntity;
  if (k && k.typeId !== "minecraft:player") {
    try {
      const owner = k.getDynamicProperty("aegis:owner");
      k = owner ? world.getEntity(owner) : undefined;
    } catch {
      k = undefined;
    }
  }
  return k?.typeId === "minecraft:player" ? k : undefined;
}

const BEASTS = ["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"];

export function initStory(helpers) {
  api = helpers;
  world.afterEvents.entityDie.subscribe(({ deadEntity: e, damageSource }) => {
    const k = killerOf(damageSource);
    if (!k || !e || e.typeId === "minecraft:player") return;
    try {
      if (e.getDynamicProperty("aegis:no_xp")) return; // clones
    } catch {
      /* ignore */
    }
    const t = e.typeId;
    let member;
    try {
      member = e.getDynamicProperty(t === "aegis:hostile_ninja" ? "aegis:role" : "aegis:member");
    } catch {
      member = undefined;
    }
    if (t === "aegis:hostile_ninja") {
      storyProgress(k, "kill:ninja");
      if (member === "sound") storyProgress(k, "kill:sound");
    } else if (t === "aegis:akatsuki") storyProgress(k, "kill:akatsuki");
    else if (t === "aegis:legend") {
      storyProgress(k, "kill:legend");
      if (member === "kaguya") storyProgress(k, "kill:final");
    } else if (t === "aegis:juubi") {
      storyProgress(k, "kill:final");
      storyProgress(k, "kill:beast");
    } else if (BEASTS.some((b) => t === `aegis:${b}`)) storyProgress(k, "kill:beast");
    else {
      try {
        if (e.matches?.({ families: ["monster"] })) storyProgress(k, "kill:monster");
      } catch {
        /* ignore */
      }
    }
  });
  // the state objectives, every five seconds — and a new shinobi hears from their mentor
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        checkState(p);
      } catch {
        /* ignore */
      }
    }
  }, 100);
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;
    system.runTimeout(() => {
      try {
        if (player.getDynamicProperty(PROP) === undefined && getVillage(player)) {
          save(player, storyState(player));
          player.sendMessage(`§e✦ The Path of the Shinobi — Chapter 1: §f${CHAPTERS[0].title}§e. ${mentorOf(player)}§f: "${CHAPTERS[0].intro}" §8(Shinobi Record → Story)`);
        }
      } catch {
        /* ignore */
      }
    }, 600);
  });
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:story" || p?.typeId !== "minecraft:player") return;
    if (String(message ?? "").trim() === "reset") {
      p.setDynamicProperty(PROP, undefined);
      return p.sendMessage("§7Your story starts again at Chapter 1.");
    }
    p.sendMessage(storyLine(p));
  });
}
