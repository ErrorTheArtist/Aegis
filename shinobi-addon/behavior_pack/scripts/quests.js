// Quest Givers — NPCs you place with the NPC Spawner: their name and outfit (spawner settings), and their quest:
//   • Quest Board (the default since v1.52) — the NPC offers every premade quest; each player picks one for their level.
//   • One premade quest — pick it from the list (and tweak it if you like).
//   • Your own quest — the quest text, which enemies the player has to fight (and whether they spawn when the quest
//     starts), how many, the rewards (Ryō, XP, any item — even the one in your hand), level requirement, time limit,
//     repeatable.

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
const LEGEND_IDS = ["naruto", "sasuke", "tsunade", "sarutobi", "minato", "madara", "gaara", "zabuza", "killer_bee", "onoki", "hanzo"];
const RANDOM_LEGENDS = LEGEND_IDS.filter((l) => l !== "madara"); // (the raid boss only comes when asked for by name)
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
  legend: { label: "Any legendary shinobi", match: (e) => e.typeId === "aegis:legend",
    spawn: (dim, at, tags) => spawnNinja(`${RANDOM_LEGENDS[Math.floor(Math.random() * RANDOM_LEGENDS.length)]}_boss`)(dim, at, tags) },
  ...Object.fromEntries(LEGEND_IDS.map((l) => [`legend_${l}`, {
    label: `Legend: ${{ sarutobi: "Hiruzen Sarutobi", madara: "Edo Madara Uchiha", zabuza: "Zabuza Momochi", killer_bee: "Killer B", onoki: "Ōnoki",
      hanzo: "Hanzō of the Salamander" }[l] ?? cap(l)}`,
    match: (e) => e.typeId === "aegis:legend" && member(e) === l,
    spawn: spawnNinja(`${l}_boss`),
  }])),
};
const TARGET_IDS = Object.keys(QUEST_TARGETS);
const BIG = (id) => id === "bijuu" || BEASTS.includes(id) || id.startsWith("legend") || ["akatsuki", "itachi", "kisame", "deidara", "pain", "konan", "hidan", "kakuzu", "sasori", "zetsu", "tobi"].includes(id);

// Reward items offered in the quest editor ("Item in my hand" covers everything else).
const REWARD_ITEMS = [
  "aegis:chakra_pill", "aegis:ramen", "aegis:blank_scroll", "aegis:reroll_scroll", "aegis:bijuu_scroll",
  "aegis:fireball_scroll", "aegis:sphere_scroll", "aegis:chidori_scroll", "aegis:clone_scroll", "aegis:rasenshuriken_scroll",
  "aegis:kirin_scroll", "aegis:great_fire_scroll", "aegis:eight_gates_scroll", "aegis:summon_toad_scroll",
  "aegis:big_rasengan_scroll", "aegis:dragon_flame_scroll", "aegis:water_shark_scroll", "aegis:lightning_hound_scroll", "aegis:front_lotus_scroll",
  "aegis:kunai", "aegis:shuriken", "aegis:kusanagi", "aegis:samehada", "aegis:kubikiribocho", "aegis:hiramekarei",
  "aegis:anbu_mask", "aegis:anbu_armor", "aegis:akatsuki_cloak",
  "minecraft:diamond", "minecraft:golden_apple", "minecraft:enchanted_golden_apple", "minecraft:netherite_ingot", "minecraft:totem_of_undying",
];
const itemLabel = (id) => cap(id.split(":")[1].replace(/_scroll$/, " scroll"));

// ---------------------------------------------------------------------------
// Premade quests (v1.52) — ready to use: give one to a Quest Giver, or let it offer them all (Quest Board).
// Enemies appear around the player when the quest starts (except the hunts), every quest can be done again, and the XP
// is generous on purpose — each one is worth several levels at the level it's meant for.
// ---------------------------------------------------------------------------
const pm = (id, minLevel, title, text, target, count, xp, ryo, item = "", itemCount = 1, spawn = true) =>
  ({ id: `pm_${id}`, premade: true, title, text, target, count, spawn, ryo, xp, item, itemCount, minLevel, repeatable: true, timeLimit: 0 });
export const PREMADE = [
  pm("pests", 1, "Pest Control", "Zombies keep wandering into the training grounds. Clear them out.", "zombie", 8, 250, 300, "aegis:ramen", 1),
  pm("bones", 1, "Bone Collectors", "Skeleton archers are shooting at the academy students.", "skeleton", 8, 250, 300, "aegis:ramen", 1),
  pm("webs", 1, "Eight Legs", "Spiders have nested by the river. Nobody can fetch water.", "spider", 6, 250, 300, "aegis:ramen", 1),
  pm("creepers", 5, "Creeper Clearance", "Something keeps blowing holes in the village wall.", "creeper", 5, 450, 500, "aegis:chakra_pill", 2),
  pm("night", 5, "Night Watch", "Keep the village safe tonight: defeat 15 hostile mobs, wherever you find them.", "monster", 15, 500, 600, "aegis:chakra_pill", 2, false),
  pm("rogues", 10, "Rogue Patrol", "Rogue ninja are robbing travellers on the roads.", "rogue", 5, 700, 1000, "aegis:chakra_pill", 3),
  pm("bandits", 15, "Road Bandits", "A whole band of rogue ninja has set up camp. Break it up.", "rogue", 8, 1000, 1500, "aegis:kunai", 16),
  pm("sound", 20, "Sound Infiltrators", "Orochimaru's spies have slipped over the border.", "sound", 5, 1500, 2000, "aegis:chakra_pill", 4),
  pm("traitors", 25, "Traitors of the Village", "Anbu who abandoned the village must be stopped.", "anbu", 4, 2000, 2500, "aegis:xp_shard", 1),
  pm("border", 30, "Border Defence", "Enemy ninja are probing our defences. Drive them back.", "ninja", 10, 3000, 3000, "aegis:xp_shard", 1),
  pm("anbu_hunt", 35, "Anbu Hunt", "A squad of rogue Anbu is on the move.", "anbu", 6, 3500, 3500, "aegis:xp_shard", 2),
  pm("ambush", 40, "Sound Ambush", "The Sound is massing for an attack. Strike first.", "sound", 10, 4500, 4000, "aegis:xp_shard", 2),
  pm("bounty", 50, "Akatsuki Bounty", "An Akatsuki member has been sighted nearby. Bring them down.", "akatsuki", 1, 7000, 6000, "aegis:xp_shard", 3),
  pm("itachi", 55, "The Uchiha Prodigy", "Itachi Uchiha has been seen near the village.", "itachi", 1, 8000, 7000, "aegis:xp_shard", 3),
  pm("kisame", 55, "The Tailless Tailed Beast", "Kisame Hoshigaki is hunting along the coast.", "kisame", 1, 8000, 7000, "aegis:xp_shard", 3),
  pm("deidara", 55, "Art is an Explosion", "Deidara is blowing up the countryside.", "deidara", 1, 8000, 7000, "aegis:xp_shard", 3),
  pm("pain", 65, "The Six Paths", "Pain has come looking for a Jinchūriki.", "pain", 1, 10000, 8000, "aegis:xp_shard", 4),
  pm("beast", 70, "Tailed Beast Subjugation", "A Tailed Beast is rampaging. Subdue it before it reaches the village.", "bijuu", 1, 12000, 10000, "aegis:xp_shard", 4),
  pm("legend", 80, "A Legend's Challenge", "A legendary shinobi wants to test your strength.", "legend", 1, 15000, 12000, "aegis:xp_shard", 5),
  pm("kurama", 90, "The Nine-Tailed Fox", "Kurama, the strongest of the Tailed Beasts, is loose.", "kurama", 1, 20000, 15000, "aegis:xp_shard", 6),
  pm("purge", 100, "Akatsuki Purge", "End the Akatsuki threat: defeat three of its members.", "akatsuki", 3, 25000, 20000, "aegis:xp_shard", 6),
  pm("legends", 120, "Clash of Legends", "Three legendary shinobi stand in your way.", "legend", 3, 40000, 30000, "aegis:xp_shard", 8),
  pm("madara", 150, "The Reanimated Uchiha", "Madara Uchiha has returned from the dead. Only the strongest can stop him.", "legend_madara", 1, 60000, 50000, "aegis:xp_shard", 10),
];
const PREMADE_BY_ID = Object.fromEntries(PREMADE.map((q) => [q.id, q]));
const boardOf = (cfg) => !cfg?.quest || cfg.quest.board; // no quest of its own → it offers the premade quests
// The quest a player is on with this giver: a premade one is looked up by id (a Quest Board holds all of them).
const questFor = (cfg, cur) => (cur?.id && PREMADE_BY_ID[cur.id]) || cfg?.quest;

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

const goalOf = (q) => `Defeat ${q.count} × ${QUEST_TARGETS[q.target]?.label ?? q.target}`;

// ---------------------------------------------------------------------------
// Quest settings (creative, from the NPC Spawner menu): the Quest Board, one premade quest, or your own
// ---------------------------------------------------------------------------
export async function questSetup(player, cfg, save) {
  const cur = cfg.quest;
  const now = boardOf(cfg) ? "§6Quest Board §7(every premade quest)" : `§e${cur.title}${cur.premade ? " §7(premade)" : ""}`;
  const r = await new ActionFormData()
    .title("§lQuest Settings")
    .body(`§7What should this Quest Giver offer?
§7Right now: ${now}`)
    .button("§6Quest Board\n§r§7every premade quest — players pick one for their level")
    .button(`§ePick one premade quest\n§r§7${PREMADE.length} ready-made quests, Lv 1–150`)
    .button("§bDesign your own quest\n§r§7story, enemies, rewards, level, time limit")
    .show(player);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection === 0) {
    cfg.quest = { board: true };
    save(cfg);
    return player.sendMessage("§aThis Quest Giver is now a §6Quest Board§a: players can pick any premade quest for their level.");
  }
  if (r.selection === 1) return pickPremade(player, cfg, save);
  if (cfg.quest?.board) cfg.quest = undefined; // the editor starts from the example quest
  return questEditor(player, cfg, save);
}

async function pickPremade(player, cfg, save) {
  const f = new ActionFormData().title("§lPremade Quests").body("§7Pick the quest this NPC gives. You can change the details afterwards.");
  for (const q of PREMADE) f.button(`§0[Lv ${q.minLevel}] ${q.title}\n§r§7${goalOf(q)} · ${q.xp.toLocaleString("en-US")} XP`);
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  const q = PREMADE[r.selection];
  cfg.quest = { ...q };
  save(cfg);
  player.sendMessage(`§aQuest set: §e${q.title}§a — ${goalOf(q)}. ${rewardText(q)}`);
  const m = await new MessageFormData()
    .title(`§l${q.title}`)
    .body(`§f${q.text}\n\n§7${goalOf(q)}${q.spawn ? " §7(they appear around the player)" : " §7(hunted in the world)"}\n${rewardText(q)}\n§7Level ${q.minLevel}+ · repeatable`)
    .button1("§aDone")
    .button2("Change the details")
    .show(player);
  if (m.selection === 1) return questEditor(player, cfg, save);
}

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
    id: q.premade ? newId() : q.id,
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
  const name = npc.nameTag || "Quest Giver";
  const giver = cfg?.key ?? `npc_${npc.id}`;
  const board = boardOf(cfg);
  const cur = getQuest(player);

  // Turning in / checking this giver's quest (a premade quest can be handed in at any Quest Board)
  if (cur && (cur.giver === giver || (board && PREMADE_BY_ID[cur.id]))) {
    const q = questFor(cfg, cur) ?? {};
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

  if (board) return questBoard(player, npc, cfg, giver, cur);
  const q = cfg.quest;
  if (!q.repeatable && getDone(player).includes(q.id)) return player.sendMessage(`§e${name}§f: You've already helped me. Thank you, shinobi.`);
  if (q.requires && !getDone(player).includes(q.requires)) {
    const pre = listQuests().find((o) => o.id === q.requires);
    return player.sendMessage(`§e${name}§f: You're not ready yet. §7(Finish §e${pre?.title ?? "an earlier quest"}§7 first.)`);
  }
  if (cur && !(await swapQuest(player, name, cur))) return;

  const f = new ActionFormData().title(`§l${q.title}`)
    .body(`§f${q.text}\n\n§7Objective: §fDefeat ${q.count} × ${QUEST_TARGETS[q.target].label}${q.spawn ? " §7(they'll appear near you)" : " §7(find them in the world)"}` +
      `${q.timeLimit ? `\n§7Time limit: §f${q.timeLimit} min` : ""}\n${rewardText(q)}${q.minLevel > 1 ? `\n§7Requires §eLv ${q.minLevel}` : ""}`)
    .button("§2Accept")
    .button("Decline");
  const r = await f.show(player);
  if (r.canceled || r.selection !== 0) return;
  if (getLevel(player) < q.minLevel) return player.sendMessage(`§cYou need to be level ${q.minLevel} for this quest.`);
  startQuest(player, giver, q);
}

// Already on another quest: drop it to take this one?
async function swapQuest(player, name, cur) {
  const r = await new MessageFormData().title(`§l${name}`)
    .body(`§7You're already on a quest: §e${cur.title}§7 (${Math.min(cur.progress, cur.count)}/${cur.count}).\n\nAbandon it to take a new one?`)
    .button1("§cAbandon it and take a new quest").button2("Not now").show(player);
  if (r.selection !== 0) return false;
  abandon(player, cur, "§7Previous quest abandoned.");
  return true;
}

// The Quest Board: every premade quest, newest players at the top. Pick one, accept, come back to claim.
async function questBoard(player, npc, cfg, giver, cur) {
  const lvl = getLevel(player);
  const greeting = cfg?.greeting || "Plenty of work posted today. Pick a quest that suits your level.";
  const f = new ActionFormData()
    .title("§lQuest Board")
    .body(`§7${greeting}\n\n§7Enemies appear around you when a quest starts. Come back to any Quest Board to claim the reward — every quest can be done again.` +
      (cur ? `\n\n§eYou're on: ${cur.title} §7(${Math.min(cur.progress, cur.count)}/${cur.count}) — taking another quest abandons it.` : ""));
  for (const q of PREMADE) {
    const locked = lvl < q.minLevel;
    f.button(`${locked ? "§8" : "§2"}[Lv ${q.minLevel}] ${q.title}\n§r${locked ? "§8" : "§7"}${goalOf(q)} · ${q.xp.toLocaleString("en-US")} XP`);
  }
  const r = await f.show(player);
  if (r.canceled || r.selection === undefined) return;
  const q = PREMADE[r.selection];
  if (lvl < q.minLevel) {
    player.sendMessage(`§cYou need to be level ${q.minLevel} for §e${q.title}§c.`);
    return questBoard(player, npc, cfg, giver, cur);
  }
  const d = await new ActionFormData()
    .title(`§l${q.title}`)
    .body(`§f${q.text}\n\n§7Objective: §f${goalOf(q)}${q.spawn ? " §7(they'll appear near you)" : " §7(find them in the world)"}\n${rewardText(q)}\n§7Requires §eLv ${q.minLevel}`)
    .button("§2Accept")
    .button("§l« Back")
    .show(player);
  if (d.canceled) return;
  if (d.selection === 1) return questBoard(player, npc, cfg, giver, cur);
  if (cur && !(await swapQuest(player, npc.nameTag || "Quest Board", cur))) return;
  startQuest(player, giver, q);
}

function timeLeft(cur) {
  if (!cur.deadline) return "";
  const s = Math.max(0, Math.round((cur.deadline - Date.now()) / 1000));
  return `\n§7Time left: §f${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function startQuest(player, giver, q) {
  const tag = `aegis_q_${player.id}`;
  const cur = { giver, id: q.id, title: q.title, target: q.target, count: q.count, progress: 0, spawn: q.spawn, tag,
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

