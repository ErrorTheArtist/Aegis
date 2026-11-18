// Ryō — the shinobi currency. Every player has a Ryō wallet (shown on the HUD).
// Enemies drop Ryō notes (aegis:ryo, 100 Ryō each); picking them up deposits them straight into the wallet.
// Players can pay each other from the Shinobi Record, and swap old emeralds for Ryō at any shop.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export const RYO_ITEM = "aegis:ryo";
export const NOTE_VALUE = 100; // one Ryō note
export const EMERALD_RATE = 100; // one emerald exchanges for 100 Ryō
// The economy (v1.58), set by the server's admins (Admin Panel → Economy, or /scriptevent aegis:economy):
//   prices — what everything costs (shops, the merchant, training, repairs, hiring genin, fast travel), in % of the v1.57
//            prices. Default 200%: twice as expensive.
//   quests — the Ryō quests pay (Quest Board quests, starter and village quests, Kage missions, daily missions, story
//            chapters, faction contracts), in % of the v1.57 rewards. Default 50%: half. Quests a Quest Giver was given by
//            hand pay exactly what was set. Achievements, events, bounties and Ryō notes are not affected.
// (v1.52 had already made everything 20% dearer: MARKUP. The prices setting multiplies on top of it.)
const MARKUP = 1.2;
const PRICE_PROP = "aegis:econ_prices";
const QUEST_PROP = "aegis:econ_quests";
export const DEFAULT_PRICES = 200;
export const DEFAULT_QUESTS = 50;
export const PRICE_RANGE = [25, 1000];
export const QUEST_RANGE = [0, 200];
function setting(prop, def, [lo, hi]) {
  try {
    const v = world.getDynamicProperty(prop);
    return typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
  } catch {
    return def;
  }
}
export const pricePercent = () => setting(PRICE_PROP, DEFAULT_PRICES, PRICE_RANGE);
export const questPercent = () => setting(QUEST_PROP, DEFAULT_QUESTS, QUEST_RANGE);
// the multiplier on a price written in plain Ryō (the v1.51 prices)
export const priceMultiplier = () => (MARKUP * pricePercent()) / 100;
export const price = (ryo) => Math.max(1, Math.round(ryo * priceMultiplier()));
// what a quest that was worth `n` Ryō pays now (rounded to tens)
export function questRyo(n) {
  const v = ((Number(n) || 0) * questPercent()) / 100;
  return v <= 0 ? 0 : Math.max(10, Math.round(v / 10) * 10);
}
// Changes the economy (either setting may be left out) and tells the server.
export function setEconomy({ prices, quests } = {}) {
  if (prices !== undefined) world.setDynamicProperty(PRICE_PROP, Math.max(PRICE_RANGE[0], Math.min(PRICE_RANGE[1], Math.round(prices))));
  if (quests !== undefined) world.setDynamicProperty(QUEST_PROP, Math.max(QUEST_RANGE[0], Math.min(QUEST_RANGE[1], Math.round(quests))));
  world.sendMessage(economyText());
}
export const economyText = () =>
  `§6Economy:§7 prices are §f${pricePercent()}%§7 of normal · quests pay §f${questPercent()}%§7 of their usual Ryō.`;
const PROP = "aegis:ryo";

let api;

export function getRyo(player) {
  try {
    return Math.max(0, Math.floor(Number(player.getDynamicProperty(PROP) ?? 0)));
  } catch {
    return 0;
  }
}

function setRyo(player, n) {
  player.setDynamicProperty(PROP, Math.max(0, Math.floor(n)));
}

export const fmtRyo = (n) => `${Math.floor(n).toLocaleString("en-US")} Ryō`;

export function addRyo(player, n, quiet = false) {
  if (!n) return;
  setRyo(player, getRyo(player) + n);
  if (!quiet) player.onScreenDisplay?.setActionBar(`§6+${fmtRyo(n)}`);
}

// Takes `n` Ryō if the player can afford it. Returns true on success.
export function spendRyo(player, n) {
  const have = getRyo(player);
  if (have < n) return false;
  setRyo(player, have - n);
  return true;
}

function container(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

// Ryō notes in the inventory go straight into the wallet.
function depositNotes(player) {
  const inv = container(player);
  if (!inv) return;
  let notes = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId !== RYO_ITEM) continue;
    notes += it.amount;
    inv.setItem(i, undefined);
  }
  if (notes) {
    addRyo(player, notes * NOTE_VALUE);
    api.sound(player.dimension, "random.orb", player.location, 0.6, 1.6);
  }
}

// Swaps every emerald in the inventory for Ryō. Returns how many were exchanged.
export function exchangeEmeralds(player) {
  const inv = container(player);
  if (!inv) return 0;
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId !== "minecraft:emerald") continue;
    n += it.amount;
    inv.setItem(i, undefined);
  }
  if (n) addRyo(player, n * EMERALD_RATE, true);
  return n;
}

// Shinobi Record → Wallet: pay another player.
export async function walletMenu(player) {
  const f = new ActionFormData()
    .title("§l§6Ryō Wallet")
    .body(`§7Balance: §6${fmtRyo(getRyo(player))}\n\n§7Defeat enemies, finish missions and quests to earn Ryō.`)
    .button("§2Pay a player")
    .button("§eExchange my emeralds\n§r§7" + `${EMERALD_RATE} Ryō each`)
    .button("Close");
  const r = await f.show(player);
  if (r.canceled) return;
  if (r.selection === 1) {
    const n = exchangeEmeralds(player);
    return player.sendMessage(n ? `§aExchanged ${n} emeralds for §6${fmtRyo(n * EMERALD_RATE)}§a.` : "§7You have no emeralds.");
  }
  if (r.selection !== 0) return;
  const others = world.getAllPlayers().filter((p) => p.id !== player.id);
  if (!others.length) return player.sendMessage("§7Nobody else is online.");
  const m = await new ModalFormData()
    .title("§lPay a player")
    .dropdown("Pay to", others.map((p) => p.name), 0)
    .textField(`Amount (you have ${fmtRyo(getRyo(player))})`, "1000", "")
    .show(player);
  if (m.canceled || !m.formValues) return;
  const to = others[Number(m.formValues[0])];
  const amount = Math.floor(Number(m.formValues[1]));
  if (!to || !Number.isFinite(amount) || amount <= 0) return player.sendMessage("§cEnter a positive amount.");
  if (!spendRyo(player, amount)) return player.sendMessage("§cYou don't have that much Ryō.");
  addRyo(to, amount, true);
  player.sendMessage(`§aPaid §6${fmtRyo(amount)}§a to ${to.name}.`);
  to.sendMessage(`§a${player.name} paid you §6${fmtRyo(amount)}§a.`);
}

export function initCurrency(helpers) {
  api = helpers;
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) depositNotes(p);
  }, 10);

  // /scriptevent aegis:economy                       — the current settings
  // /scriptevent aegis:economy prices 300            — everything costs 300% of the v1.57 prices
  // /scriptevent aegis:economy quests 25             — quests pay 25% of their v1.57 Ryō
  // /scriptevent aegis:economy reset                 — back to the defaults (200% / 50%)
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:economy") return;
    const tell = (t) => (p?.typeId === "minecraft:player" ? p.sendMessage(t) : world.sendMessage(t));
    const [cmd, arg] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    const n = Number(arg);
    if (cmd === "prices" && Number.isFinite(n)) return setEconomy({ prices: n });
    if (cmd === "quests" && Number.isFinite(n)) return setEconomy({ quests: n });
    if (cmd === "reset") return setEconomy({ prices: DEFAULT_PRICES, quests: DEFAULT_QUESTS });
    tell(`${economyText()}\n§7Change it: §f/scriptevent aegis:economy prices <${PRICE_RANGE.join("-")}>§7 · §fquests <${QUEST_RANGE.join("-")}>§7 · §freset`);
  });

  // /scriptevent aegis:ryo [give <n> | take <n> | set <n>] — admin tools; no argument shows the balance
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
    if (id !== "aegis:ryo" || p?.typeId !== "minecraft:player") return;
    const [cmd, arg] = String(message ?? "").trim().toLowerCase().split(/\s+/);
    const n = Math.floor(Number(arg));
    if (cmd === "give" && n > 0) addRyo(p, n);
    else if (cmd === "take" && n > 0) setRyo(p, getRyo(p) - n);
    else if (cmd === "set" && n >= 0) setRyo(p, n);
    p.sendMessage(`§7Balance: §6${fmtRyo(getRyo(p))}`);
  });
}
