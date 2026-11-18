// Factions (v1.56) — the Akatsuki for rogue ninja, the Anbu for a village's most trusted shinobi.
//   Shinobi Record → Faction shows both, what each asks of you, and a Join button once you qualify.
//   • Akatsuki — a rogue ninja, level 60+, with a bounty of 25,000+ Ryō. You get the cloak and hat, [Akatsuki] over
//     your name, +10% jutsu damage against Tailed Beasts and Jinchūriki, and the Akatsuki's own members leave you alone.
//   • Anbu — a village shinobi, level 60+, Jōnin rank (or level 80) and 2,000+ honor. You get the mask and armour,
//     [Anbu] over your name, +10% jutsu damage against rogue ninja (NPCs and rogue players), and the village pays half
//     again on top of any bounty you claim on a rogue.
//   • Contracts: one at a time from your faction (hunt a Tailed Beast, eliminate rogue ninja, bring a missing-nin to
//     justice…) for Ryō and standing; standing raises your rank in the faction.
//   Leave whenever you like (the page has a button). An Akatsuki member who rejoins a village, or an Anbu who leaves
//   theirs, is dropped from the faction automatically.
//   /scriptevent aegis:faction                — your faction
//   /scriptevent aegis:faction leave           — leave it

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { showTitle } from "./hud.js";
import { addRyo, fmtRyo, questRyo } from "./currency.js";
import { getLevel, getRank } from "./levels.js";
import { getVillage, isRogue, getHonor } from "./villages.js";
import { bountyOf } from "./bounty.js";

const PROP = "aegis:faction";
const STATE = "aegis:faction_state"; // { standing, contract: { id, have }, done }
const BEASTS = ["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama", "juubi"];

export const FACTIONS = {
  akatsuki: {
    name: "§cAkatsuki", tag: "§c[Akatsuki]§r ", mtag: "aegis_akatsuki", color: "§c",
    pitch: "An organisation of S-rank rogue ninja who hunt the Tailed Beasts. No village, no mercy.",
    perks: "+10% jutsu damage against Tailed Beasts and Jinchūriki · the Akatsuki's members leave you alone · cloak and hat",
    gear: [["aegis:akatsuki_cloak", 1], ["aegis:akatsuki_hat", 1]],
    reqs: [["A rogue ninja (left your village)", (p) => isRogue(p)], ["Level 60", (p) => getLevel(p) >= 60],
      ["A bounty of at least 25,000 Ryō", (p) => bountyOf(p) >= 25000]],
    ranks: ["Member", "Partner", "Leader's Right Hand"],
    contracts: {
      beast: ["Capture a Tailed Beast — defeat one", 1, 25000],
      legends: ["Defeat 3 legendary shinobi", 3, 20000],
      jinchuriki: ["Hunt a Jinchūriki — defeat a player who carries a Tailed Beast", 1, 30000],
      bounty: ["Collect a bounty from the Bingo Book", 1, 15000],
      anbu: ["Silence an Anbu — defeat an Anbu player", 1, 20000],
    },
  },
  anbu: {
    name: "§7Anbu", tag: "§8[Anbu]§r ", mtag: "aegis_anbu", color: "§7",
    pitch: "The Kage's Black Ops — masked shinobi who hunt the village's enemies in the shadows.",
    perks: "+10% jutsu damage against rogue ninja · +50% on bounties you claim on rogues · mask and armour",
    gear: [["aegis:anbu_mask", 1], ["aegis:anbu_armor", 1]],
    reqs: [["A member of a village", (p) => !!getVillage(p) && !isRogue(p)], ["Level 60", (p) => getLevel(p) >= 60],
      ["Jōnin rank (or level 80)", (p) => getRank(p) >= 2 || getLevel(p) >= 80], ["2,000 village honor", (p) => getHonor(p) >= 2000]],
    ranks: ["Operative", "Squad Leader", "Captain"],
    contracts: {
      rogues: ["Eliminate 15 rogue ninja", 15, 8000],
      sound: ["Wipe out 10 Sound ninja", 10, 8000],
      akatsuki: ["Eliminate 2 Akatsuki members", 2, 25000],
      missing_nin: ["Bring a missing-nin to justice — defeat a rogue player", 1, 20000],
      raid: ["Defend a village in a world event", 1, 15000],
    },
  },
};

let api;

export const factionOf = (p) => {
  try {
    const f = p?.getDynamicProperty(PROP);
    return FACTIONS[f] ? f : undefined;
  } catch {
    return undefined;
  }
};
export const factionTag = (p) => FACTIONS[factionOf(p)]?.tag ?? "";

function state(p) {
  try {
    return JSON.parse(p.getDynamicProperty(STATE) ?? "null") ?? { standing: 0 };
  } catch {
    return { standing: 0 };
  }
}
const saveState = (p, st) => p.setDynamicProperty(STATE, JSON.stringify(st));
const rankOf = (st) => (st.standing >= 15 ? 2 : st.standing >= 5 ? 1 : 0);
export const factionRank = (p) => {
  const f = factionOf(p);
  return f ? FACTIONS[f].ranks[rankOf(state(p))] : undefined;
};

const isJinchuriki = (p) => {
  try {
    return !!p.getDynamicProperty("aegis:bijuu");
  } catch {
    return false;
  }
};

// Damage multiplier for a faction member's jutsu.
export function factionDamageMultiplier(attacker, target) {
  const f = factionOf(attacker);
  if (!f || !target) return 1;
  if (f === "akatsuki") {
    if (target.typeId === "minecraft:player" ? isJinchuriki(target) : BEASTS.some((b) => target.typeId === `aegis:${b}`)) return 1.1;
  } else if (f === "anbu") {
    if (target.typeId === "aegis:hostile_ninja" || (target.typeId === "minecraft:player" && isRogue(target))) return 1.1;
  }
  return 1;
}

// The Akatsuki's NPC members and an Akatsuki player don't fight each other (used by main.js canBeHit).
export function factionAllies(a, b) {
  const member = (x) => x?.typeId === "minecraft:player" && factionOf(x) === "akatsuki";
  return (member(a) && b?.typeId === "aegis:akatsuki") || (member(b) && a?.typeId === "aegis:akatsuki");
}

// Extra Ryō the village pays an Anbu who claims a bounty on a rogue (bounty.js).
export const anbuBountyBonus = (killer, victim, amount) => (factionOf(killer) === "anbu" && isRogue(victim) ? Math.round(amount * 0.5) : 0);

function join(p, f) {
  const F = FACTIONS[f];
  p.setDynamicProperty(PROP, f);
  for (const other of Object.values(FACTIONS)) p.removeTag?.(other.mtag);
  p.addTag?.(F.mtag);
  saveState(p, { standing: 0 });
  for (const [id, n] of F.gear) {
    try {
      const left = p.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(id, n));
      if (left) p.dimension.spawnItem(left, p.location);
    } catch {
      /* ignore */
    }
  }
  newContract(p);
  api?.refreshName?.(p);
  showTitle(p, F.name, { subtitle: "§7welcomes you", fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
  world.sendMessage(`${F.color}${p.name}§7 has joined the ${F.name}§7.`);
}

export function leaveFaction(p, quiet = false) {
  const f = factionOf(p);
  if (!f) return false;
  p.setDynamicProperty(PROP, undefined);
  p.setDynamicProperty(STATE, undefined);
  p.removeTag?.(FACTIONS[f].mtag);
  api?.refreshName?.(p);
  if (!quiet) p.sendMessage(`§7You've left the ${FACTIONS[f].name}§7.`);
  return true;
}

function newContract(p) {
  const f = factionOf(p);
  if (!f) return;
  const ids = Object.keys(FACTIONS[f].contracts);
  const st = state(p);
  const prev = st.contract?.id;
  const pool = ids.filter((id) => id !== prev);
  st.contract = { id: pool[Math.floor(Math.random() * pool.length)], have: 0 };
  saveState(p, st);
  const [text, goal] = FACTIONS[f].contracts[st.contract.id];
  p.sendMessage(`${FACTIONS[f].color}✦ New contract: §f${text}§7 (0/${goal})`);
}

// Progress on the member's contract.
export function factionProgress(p, id, by = 1) {
  const f = factionOf(p);
  if (!f) return;
  const st = state(p);
  if (!st.contract || st.contract.id !== id) return;
  const [text, goal, base] = FACTIONS[f].contracts[id];
  const pay = questRyo(base); // (the economy's quest-reward setting)
  st.contract.have = Math.min(goal, st.contract.have + by);
  if (st.contract.have < goal) {
    saveState(p, st);
    return p.onScreenDisplay?.setActionBar(`${FACTIONS[f].color}✦ Contract: §f${text} §7${st.contract.have}/${goal}`);
  }
  const before = rankOf(st);
  st.standing = (st.standing ?? 0) + 1;
  st.done = (st.done ?? 0) + 1;
  saveState(p, st);
  addRyo(p, pay, true);
  p.sendMessage(`${FACTIONS[f].color}✦ Contract complete: §f${text}§7 — §6+${fmtRyo(pay)}§7, standing ${st.standing}`);
  api?.sound(p.dimension, "random.levelup", p.location, 0.6, 1.1);
  if (rankOf(st) > before) {
    showTitle(p, FACTIONS[f].name, { subtitle: `§7You're now: §f${FACTIONS[f].ranks[rankOf(st)]}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
  }
  newContract(p);
}

export async function factionMenu(p, back) {
  const mine = factionOf(p);
  if (mine) {
    const F = FACTIONS[mine];
    const st = state(p);
    const c = st.contract ? F.contracts[st.contract.id] : undefined;
    const r = await new ActionFormData()
      .title(`§l${F.name}`)
      .body([
        `§7${F.pitch}`, "",
        `§7Rank: §f${F.ranks[rankOf(st)]}§7 · standing §f${st.standing ?? 0}§7 · contracts done §f${st.done ?? 0}`,
        `§7Perks: §f${F.perks}`, "",
        c ? `§7Contract: §f${c[0]}§7 — ${st.contract.have}/${c[1]} §8(pays ${fmtRyo(questRyo(c[2]))})` : "§7No contract.",
        "§8Rank up at 5 and 15 contracts.",
      ].join("\n"))
      .button("§eNew contract\n§r§8give up this one for another")
      .button(`§cLeave the ${F.name.replace(/§./g, "")}`)
      .button("§l« Back")
      .show(p);
    if (r.canceled) return;
    if (r.selection === 0) {
      newContract(p);
      return factionMenu(p, back);
    }
    if (r.selection === 1) {
      const ok = await new MessageFormData().title("§lLeave?").body(`§7Leave the ${F.name}§7? You lose its perks, rank and contract.`)
        .button1("§cLeave").button2("Stay").show(p);
      if (ok.selection === 0) leaveFaction(p);
      return factionMenu(p, back);
    }
    return back?.();
  }
  const ids = Object.keys(FACTIONS);
  const tick = (ok) => (ok ? "§a✔" : "§8✘");
  const lines = [];
  const eligible = {};
  for (const id of ids) {
    const F = FACTIONS[id];
    const checks = F.reqs.map(([text, fn]) => {
      let ok = false;
      try {
        ok = !!fn(p);
      } catch {
        ok = false;
      }
      return [text, ok];
    });
    eligible[id] = checks.every(([, ok]) => ok);
    lines.push(`${F.name}§r §8— ${F.pitch}`, ...checks.map(([text, ok]) => `  ${tick(ok)} §7${text}`), `  §7Perks: §f${F.perks}`, "");
  }
  const f = new ActionFormData().title("§l§8Factions").body(lines.join("\n"));
  for (const id of ids) f.button(eligible[id] ? `§aJoin the ${FACTIONS[id].name}` : `§8${FACTIONS[id].name.replace(/§./g, "")} §7(not yet)`);
  f.button("§l« Back");
  const r = await f.show(p);
  if (r.canceled) return;
  const id = ids[r.selection];
  if (!id) return back?.();
  if (!eligible[id]) {
    p.sendMessage(`§7You don't meet the ${FACTIONS[id].name}§7's requirements yet.`);
    return factionMenu(p, back);
  }
  join(p, id);
  return factionMenu(p, back);
}

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

export function initFactions(helpers) {
  api = helpers;
  world.afterEvents.entityDie.subscribe(({ deadEntity: e, damageSource }) => {
    const k = killerOf(damageSource);
    if (!k || !e || !factionOf(k)) return;
    const t = e.typeId;
    if (t === "minecraft:player") {
      if (e.id === k.id) return;
      if (isJinchuriki(e)) factionProgress(k, "jinchuriki");
      if (factionOf(e) === "anbu") factionProgress(k, "anbu");
      if (isRogue(e)) factionProgress(k, "missing_nin");
      return;
    }
    try {
      if (e.getDynamicProperty("aegis:no_xp")) return;
    } catch {
      /* ignore */
    }
    if (BEASTS.some((b) => t === `aegis:${b}`)) factionProgress(k, "beast");
    else if (t === "aegis:legend") factionProgress(k, "legends");
    else if (t === "aegis:akatsuki") factionProgress(k, "akatsuki");
    else if (t === "aegis:hostile_ninja") {
      let role;
      try {
        role = e.getDynamicProperty("aegis:role");
      } catch {
        role = undefined;
      }
      if (role === "sound") factionProgress(k, "sound");
      else factionProgress(k, "rogues");
    }
  });
  // a member who no longer belongs is dropped; members keep their tag (the Akatsuki NPCs read it)
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      const f = factionOf(p);
      if (!f) continue;
      if ((f === "akatsuki" && !isRogue(p)) || (f === "anbu" && (isRogue(p) || !getVillage(p)))) {
        leaveFaction(p, true);
        p.sendMessage(`§7You no longer belong to the ${FACTIONS[f].name}§7.`);
        continue;
      }
      if (!p.hasTag?.(FACTIONS[f].mtag)) p.addTag?.(FACTIONS[f].mtag);
    }
  }, 100);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:faction" || p?.typeId !== "minecraft:player") return;
    if (String(message ?? "").trim() === "leave") return void (leaveFaction(p) || p.sendMessage("§7You're not in a faction."));
    const f = factionOf(p);
    p.sendMessage(f ? `§7Faction: ${FACTIONS[f].name}§7 · ${factionRank(p)}` : "§7No faction — Shinobi Record → Faction.");
  });
}
