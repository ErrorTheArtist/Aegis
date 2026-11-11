// Ryō — the shinobi currency. Every player has a Ryō wallet (shown on the HUD).
// Enemies drop Ryō notes (aegis:ryo, 100 Ryō each); picking them up deposits them straight into the wallet.
// Players can pay each other from the Shinobi Record, and swap old emeralds for Ryō at any shop.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export const RYO_ITEM = "aegis:ryo";
export const NOTE_VALUE = 100; // one Ryō note
export const EMERALD_RATE = 100; // one emerald exchanges for 100 Ryō
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
