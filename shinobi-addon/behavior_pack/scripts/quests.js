// Quest Givers — NPCs you place with the NPC Spawner and design yourself: their name and outfit (spawner settings),
// the quest text, which enemies the player has to fight (and whether they spawn when the quest starts),
// how many, the rewards (Ryō, XP, any item — even the one in your hand), level requirement, time limit, repeatable.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { NPC_TYPES, setupNpc, defaultsFor, giveItem, listQuests } from "./npcs.js";
import { getLevel, gainXp } from "./levels.js";
import { addRyo, fmtRyo } from "./currency.js";

let api;
const QUEST_PROP = "aegis:quest";
const DONE_PROP = "aegis:quests_done";

const BEASTS = ["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"];
const cap = (s) => s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const member = (e) => {
  try {
    return e.getDynamicProperty("aegis:member");
  } catch {
    return undefined;
  }
};
const role = (e) => {
  try {
    return e.getDynamicProperty("aegis:role");
  } catch {
    return undefined;
  }
};

function spawnNinja(type, extra = {}) {
  return (dim, at, tags) => {
    const e = dim.spawnEntity(NPC_TYPES[type].entity, at);
    setupNpc(e, { ...defaultsFor(type), type, ...extra }, { tags });
    return e;
  };
}
function spawnPlain(id) {
  return (dim, at, tags) => {
    const e = dim.spawnEntity(id, at);
    for (const t of tags) e.addTag(t);
    return e;
  };
}

// Everything a quest can ask the player to fight.
export const QUEST_TARGETS = {
  monster: { label: "Any hostile mob", match: (e) => e.matches?.({ families: ["monster"] }) && !e.typeId.startsWith("aegis:"), spawn: spawnPlain("minecraft:zombie") },
  zombie: { label: "Zombies", match: (e) => e.typeId === "minecraft:zombie", spawn: spawnPlain("minecraft:zombie") },
  skeleton: { label: "Skeletons", match: (e) => e.typeId === "minecraft:skeleton", spawn: spawnPlain("minecraft:skeleton") },
  spider: { label: "Spiders", match: (e) => e.typeId === "minecraft:spider", spawn: spawnPlain("minecraft:spider") },
  creeper: { label: "Creepers", match: (e) => e.typeId === "minecraft:creeper", spawn: spawnPlain("minecraft:creeper") },
  ninja: { label: "Any enemy ninja", match: (e) => e.typeId === "aegis:hostile_ninja", spawn: spawnNinja("rogue") },
  rogue: { label: "Rogue Ninja", match: (e) => e.typeId === "aegis:hostile_ninja" && role(e) === "rogue", spawn: spawnNinja("rogue") },
  sound: { label: "Sound Ninja", match: (e) => e.typeId === "aegis:hostile_ninja" && role(e) === "sound", spawn: spawnNinja("sound") },
  anbu: { label: "Rogue Anbu", match: (e) => e.typeId === "aegis:hostile_ninja" && role(e) === "anbu", spawn: spawnNinja("anbu") },
  akatsuki: { label: "Any Akatsuki member", match: (e) => e.typeId === "aegis:akatsuki", spawn: spawnNinja("akatsuki", { member: "random" }) },
  itachi: { label: "Akatsuki: Itachi", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "itachi", spawn: spawnNinja("akatsuki", { member: "itachi" }) },
  kisame: { label: "Akatsuki: Kisame", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "kisame", spawn: spawnNinja("akatsuki", { member: "kisame" }) },
  deidara: { label: "Akatsuki: Deidara", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "deidara", spawn: spawnNinja("akatsuki", { member: "deidara" }) },
  pain: { label: "Akatsuki: Pain", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "pain", spawn: spawnNinja("akatsuki", { member: "pain" }) },
  konan: { label: "Akatsuki: Konan", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "konan", spawn: spawnNinja("akatsuki", { member: "konan" }) },
  hidan: { label: "Akatsuki: Hidan", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "hidan", spawn: spawnNinja("akatsuki", { member: "hidan" }) },
  kakuzu: { label: "Akatsuki: Kakuzu", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "kakuzu", spawn: spawnNinja("akatsuki", { member: "kakuzu" }) },
  sasori: { label: "Akatsuki: Sasori", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "sasori", spawn: spawnNinja("akatsuki", { member: "sasori" }) },
  zetsu: { label: "Akatsuki: Zetsu", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "zetsu", spawn: spawnNinja("akatsuki", { member: "zetsu" }) },
  tobi: { label: "Akatsuki: Tobi", match: (e) => e.typeId === "aegis:akatsuki" && member(e) === "tobi", spawn: spawnNinja("akatsuki", { member: "tobi" }) },
  bijuu: { label: "Any Tailed Beast", match: (e) => BEASTS.some((b) => e.typeId === `aegis:${b}`),
    spawn: (dim, at, tags) => spawnPlain(`aegis:${BEASTS[Math.floor(Math.random() * BEASTS.length)]}`)(dim, at, tags) },
  ...Object.fromEntries(BEASTS.map((b) => [b, { label: `Tailed Beast: ${cap(b)}`, match: (e) => e.typeId === `aegis:${b}`, spawn: spawnPlain(`aegis:${b}`) }])),
  ...Object.fromEntries(["naruto", "sasuke", "tsunade", "sarutobi", "minato"].map((l) => [`legend_${l}`, {
    label: `Legend: ${{ sarutobi: "Hiruzen Sarutobi" }[l] ?? cap(l)}`,
    match: (e) => e.typeId === "aegis:legend" && member(e) === l,
    spawn: spawnNinja(`${l}_boss`),
  }])),
};
const TARGET_IDS = Object.keys(QUEST_TARGETS);
const BIG = (id) => id === "bijuu" || BEASTS.includes(id) || id.startsWith("legend_") || ["akatsuki", "itachi", "kisame", "deidara", "pain", "konan", "hidan", "kakuzu", "sasori", "zetsu", "tobi"].includes(id);

// Reward items offered in the quest editor ("Item in my hand" covers everything else).
const REWARD_ITEMS = [
  "aegis:chakra_pill", "aegis:ramen", "aegis:blank_scroll", "aegis:reroll_scroll", "aegis:bijuu_scroll",
  "aegis:fireball_scroll", "aegis:sphere_scroll", "aegis:chidori_scroll", "aegis:clone_scroll", "aegis:rasenshuriken_scroll",
  "aegis:kirin_scroll", "aegis:great_fire_scroll", "aegis:eight_gates_scroll", "aegis:summon_toad_scroll",
  "aegis:kunai", "aegis:shuriken", "aegis:kusanagi", "aegis:samehada", "aegis:kubikiribocho", "aegis:hiramekarei",
  "aegis:anbu_mask", "aegis:anbu_armor", "aegis:akatsuki_cloak",
  "minecraft:diamond", "minecraft:golden_apple", "minecraft:enchanted_golden_apple", "minecraft:netherite_ingot", "minecraft:totem_of_undying",
];
const itemLabel = (id) => cap(id.split(":")[1].replace(/_scroll$/, " scroll"));

export function defaultQuest() {
  return {
    id: newId(), title: "Clear the Rogues", text: "Rogue ninja have been attacking travellers on the road. Deal with them.",
    target: "rogue", count: 5, spawn: true, ryo: 2000, xp: 1500, item: "", itemCount: 1, minLevel: 1, repeatable: true, timeLimit: 0,
  };
}
const newId = () => Math.random().toString(36).slice(2, 10);

const getQuest = (p) => {
  try {
    return JSON.parse(p.getDynamicProperty(QUEST_PROP) ?? "null");
  } catch {
    return null;
  }
};
const setQuest = (p, q) => p.setDynamicProperty(QUEST_PROP, q ? JSON.stringify(q) : undefined);
const getDone = (p) => {
  try {
    return JSON.parse(p.getDynamicProperty(DONE_PROP) ?? "[]");
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Quest editor (creative, from the NPC Spawner menu)
// ---------------------------------------------------------------------------
export async function questEditor(player, cfg, save) {
  const q = { ...defaultQuest(), ...(cfg.quest ?? {}) };
  const others = listQuests().filter((o) => o.id !== q.id);
  const itemOpts = ["None", "The item in my hand right now", ...REWARD_ITEMS.map(itemLabel)];
  const itemIdx = !q.item ? 0 : REWARD_ITEMS.includes(q.item) ? 2 + REWARD_ITEMS.indexOf(q.item) : 1;
  const f = new ModalFormData()
    .title("§lQuest Settings")
    .textField("Quest title", "Clear the Rogues", q.title)
    .textField("Quest story (what the NPC says)", "Rogue ninja have been attacking…", q.text)
    .dropdown("Enemy the player must fight", TARGET_IDS.map((t) => QUEST_TARGETS[t].label), Math.max(0, TARGET_IDS.indexOf(q.target)))
    .slider("How many", 1, 30, 1, q.count)
    .toggle("Spawn the enemies when the quest starts (off = hunt them in the world)", q.spawn)
    .textField("Ryō reward", "2000", String(q.ryo))
    .textField("XP reward", "1500", String(q.xp))
    .dropdown(`Item reward${q.item && itemIdx === 1 ? ` (now: ${q.item} ×${q.itemCount})` : ""}`, itemOpts, itemIdx)
    .slider("Item amount", 1, 64, 1, Math.max(1, q.itemCount))
    .slider("Minimum level", 1, 200, 1, q.minLevel)
    .toggle("Repeatable", q.repeatable)
    .slider("Time limit in minutes (0 = no limit)", 0, 30, 1, q.timeLimit)
    .dropdown("Requires finishing this quest first", ["Nothing", ...others.map((o) => o.title)], Math.max(0, others.findIndex((o) => o.id === q.requires) + 1));
  const r = await f.show(player);
  if (r.canceled || !r.formValues) return;
  const v = r.formValues;
  const num = (x, d) => (Number.isFinite(Number(x)) ? Math.max(0, Math.floor(Number(x))) : d);
  const out = {
    id: q.id,
    title: String(v[0] || "").trim() || "A Shinobi's Task",
    text: String(v[1] || "").trim() || "I need your help.",
    target: TARGET_IDS[Number(v[2])] ?? "rogue",
    count: Number(v[3]),
    spawn: !!v[4],
    ryo: num(v[5], 0),
    xp: num(v[6], 0),
    itemCount: Number(v[8]),
    minLevel: Number(v[9]),
    repeatable: !!v[10],
    timeLimit: Number(v[11]),
    requires: Number(v[12]) > 0 ? others[Number(v[12]) - 1]?.id ?? "" : "",
    item: "",
  };
  const pick = Number(v[7]);
  if (pick === 1) {
    const held = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    if (held) {
      out.item = held.typeId;
      out.itemCount = Math.min(held.maxAmount ?? 64, Math.max(1, Number(v[8])));
    } else if (q.item) {
      out.item = q.item; // keep the old one if your hand is empty
    } else {
      player.sendMessage("§7Your hand was empty — no item reward set.");
    }
  } else if (pick >= 2) out.item = REWARD_ITEMS[pick - 2];
  // the id never changes, so quests that require this one keep working after edits
  cfg.quest = out;
  save(cfg);
  player.sendMessage(`§aQuest saved: §e${out.title}§a — defeat ${out.count} × ${QUEST_TARGETS[out.target].label}. ${rewardText(out)}`);
}

function rewardText(q) {
  const parts = [];
  if (q.ryo) parts.push(`§6${fmtRyo(q.ryo)}`);
  if (q.xp) parts.push(`§b${q.xp} XP`);
  if (q.item) parts.push(`§f${q.itemCount}× ${itemLabel(q.item)}`);
  return parts.length ? `§7Reward: ${parts.join("§7, ")}` : "§7No reward";
}

// ---------------------------------------------------------------------------
// Talking to a Quest Giver
// ---------------------------------------------------------------------------
export async function questGiver(player, npc, cfg) {
  const q = cfg?.quest;
  const name = npc.nameTag || "Quest Giver";
  if (!q) return player.sendMessage(`§e${name}§f: I have nothing for you right now.`);
  const cur = getQuest(player);

  // Turning in / checking this giver's quest
  if (cur && cur.giver === cfg.key) {
    const done = cur.progress >= cur.count;
    const f = new ActionFormData().title(`§l${cur.title}`)
      .body(`§7${done ? "You did it! The village is grateful." : "Keep going — I'm counting on you."}\n\n§7Progress: §f${Math.min(cur.progress, cur.count)}/${cur.count} ${QUEST_TARGETS[cur.target].label}${timeLeft(cur)}\n${rewardText(q)}`);
    f.button(done ? "§2Claim reward" : "§7Okay");
    f.button("§cAbandon quest");
    const r = await f.show(player);
    if (r.canceled) return;
    if (r.selection === 1) return abandon(player, cur, "§7Quest abandoned.");
    if (!done) return;
    setQuest(player, null);
    if (q.ryo) addRyo(player, q.ryo, true);
    if (q.xp) gainXp(player, q.xp);
    if (q.item) giveItem(player, q.item, q.itemCount);
    player.setDynamicProperty(DONE_PROP, JSON.stringify([...new Set([...getDone(player), q.id])].slice(-200)));
    showTitle(player, "§aQuest complete!", { subtitle: `§e${cur.title}`, stayDuration: 50 });
    player.sendMessage(`§aQuest complete: §e${cur.title}§a. ${rewardText(q)}`);
    api.sound(player.dimension, "random.levelup", player.location, 1, 1.2);
    return;
  }

  if (cur) {
    const r = await new MessageFormData().title(`§l${name}`)
      .body(`§7You're already on a quest: §e${cur.title}§7 (${Math.min(cur.progress, cur.count)}/${cur.count}).\n\nAbandon it to take mine?`)
      .button1("§cAbandon and take this quest").button2("Not now").show(player);
    if (r.selection !== 0) return;
    abandon(player, cur, "§7Previous quest abandoned.");
  }
  if (!q.repeatable && getDone(player).includes(q.id)) return player.sendMessage(`§e${name}§f: You've already helped me. Thank you, shinobi.`);
  if (q.requires && !getDone(player).includes(q.requires)) {
    const pre = listQuests().find((o) => o.id === q.requires);
    return player.sendMessage(`§e${name}§f: You're not ready yet. §7(Finish §e${pre?.title ?? "an earlier quest"}§7 first.)`);
  }

  const f = new ActionFormData().title(`§l${q.title}`)
    .body(`§f${q.text}\n\n§7Objective: §fDefeat ${q.count} × ${QUEST_TARGETS[q.target].label}${q.spawn ? " §7(they'll appear near you)" : " §7(find them in the world)"}` +
      `${q.timeLimit ? `\n§7Time limit: §f${q.timeLimit} min` : ""}\n${rewardText(q)}${q.minLevel > 1 ? `\n§7Requires §eLv ${q.minLevel}` : ""}`)
    .button("§2Accept")
    .button("Decline");
  const r = await f.show(player);
  if (r.canceled || r.selection !== 0) return;
  if (getLevel(player) < q.minLevel) return player.sendMessage(`§cYou need to be level ${q.minLevel} for this quest.`);
  startQuest(player, cfg, q);
}

function timeLeft(cur) {
  if (!cur.deadline) return "";
  const s = Math.max(0, Math.round((cur.deadline - Date.now()) / 1000));
  return `\n§7Time left: §f${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function startQuest(player, cfg, q) {
  const tag = `aegis_q_${player.id}`;
  const cur = { giver: cfg.key, id: q.id, title: q.title, target: q.target, count: q.count, progress: 0, spawn: q.spawn, tag,
    deadline: q.timeLimit ? Date.now() + q.timeLimit * 60000 : 0 };
  setQuest(player, cur);
  if (q.spawn) {
    const dim = player.dimension;
    const t = QUEST_TARGETS[q.target];
    const r = BIG(q.target) ? 12 : 8;
    for (let i = 0; i < q.count; i++) {
      system.runTimeout(() => {
        if (!api.isValid(player)) return;
        const a = (i / q.count) * Math.PI * 2 + Math.random() * 0.4;
        const at = { x: player.location.x + Math.cos(a) * r, y: player.location.y + 0.5, z: player.location.z + Math.sin(a) * r };
        try {
          const e = t.spawn(dim, at, [tag]);
          e?.setDynamicProperty("aegis:no_seal", true); // a quest's Tailed Beast never makes a Jinchūriki
          api.particle(dim, "aegis:smoke_puff", at);
        } catch {
          /* ignore */
        }
      }, 20 + i * 4);
    }
  }
  showTitle(player, `§e${q.title}`, { subtitle: `§7Defeat ${q.count} × ${QUEST_TARGETS[q.target].label}`, stayDuration: 60 });
  api.sound(player.dimension, "random.orb", player.location, 1, 0.8);
}

function abandon(player, cur, msg) {
  setQuest(player, null);
  if (cur?.spawn) {
    try {
      for (const e of player.dimension.getEntities({ tags: [cur.tag] })) e.remove();
    } catch {
      /* ignore */
    }
  }
  player.sendMessage(msg);
}

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

export function initQuests(helpers) {
  api = helpers;

  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (deadEntity.typeId === "minecraft:player") return;
    const killer = killerOf(damageSource);
    if (!killer) return;
    const cur = getQuest(killer);
    if (!cur || cur.progress >= cur.count) return;
    let ok = false;
    try {
      ok = (!cur.spawn || deadEntity.hasTag(cur.tag)) && QUEST_TARGETS[cur.target]?.match(deadEntity);
    } catch {
      ok = false;
    }
    if (!ok) return;
    cur.progress++;
    setQuest(killer, cur);
    killer.onScreenDisplay.setActionBar(cur.progress >= cur.count ? `§aQuest complete — return to the quest giver! §7(${cur.title})` : `§eQuest: §f${cur.progress}/${cur.count} ${QUEST_TARGETS[cur.target].label}`);
    if (cur.progress >= cur.count) api.sound(killer.dimension, "random.levelup", killer.location, 0.6, 1.6);
  });

  // time limits
  system.runInterval(() => {
    const now = Date.now();
    for (const p of world.getAllPlayers()) {
      const cur = getQuest(p);
      if (!cur?.deadline || cur.progress >= cur.count || now < cur.deadline) continue;
      abandon(p, cur, `§cQuest failed — you ran out of time: §e${cur.title}`);
      showTitle(p, "§cQuest failed", { subtitle: "§7Out of time", stayDuration: 40 });
    }
  }, 20);

  // /scriptevent aegis:quest [abandon] — show (or drop) your current quest
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:quest" || p?.typeId !== "minecraft:player") return;
    const cur = getQuest(p);
    if (String(message ?? "").trim() === "abandon" && cur) return abandon(p, cur, "§7Quest abandoned.");
    p.sendMessage(cur ? `§e${cur.title}§7: ${Math.min(cur.progress, cur.count)}/${cur.count} ${QUEST_TARGETS[cur.target].label}${timeLeft(cur).replace("\n", " ")}` : "§7You have no active quest.");
  });
}

