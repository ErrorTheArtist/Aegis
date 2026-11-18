// The Shinobi Handbook (v1.56) — Shinobi Record → Handbook: how everything in the add-on works, in short pages.

import { ActionFormData } from "@minecraft/server-ui";

export const TOPICS = [
  ["§aGetting started", [
    "§lWelcome, shinobi!§r",
    "• The first time you join you choose a §fvillage§r — you're sent there with a starter kit (sword, kunai, pills, ramen, your village's headband).",
    "• Your §fclan§r and §fchakra nature§r are rolled for you. Your clan's ability item is yours for good: it can't be dropped or lost.",
    "• The §fstarter quests§r and the §fStory§r (Shinobi Record → Story) take you step by step through everything.",
    "• This §fShinobi Record§r lives in the last slot of your hotbar — it's your menu for everything.",
    "• For your first hour of play you have a §agrace period§r: nothing can hurt you, and you can't fight.",
  ]],
  ["§bChakra & jutsu", [
    "• §fRight-click a jutsu scroll§r to cast it. Each costs chakra (the bar in the top-left) and has a cooldown.",
    "• Chakra comes back by itself; §fsneak and stand still§r to focus (three times faster). Soldier Pills, ramen and food pills help.",
    "• Jutsu of your §fchakra nature§r cost 25% less and hit 25% harder; your village's own element hits 10% harder.",
    "• The §fJutsu Sensei§r teaches scrolls by school — Fire, Water, Wind, Lightning, Earth, Ninjutsu, Taijutsu, Genjutsu & Medical, Sealing & Space-Time, Summoning. Bosses and the Travelling Merchant have them too.",
    "• §fM1 combos§r: punch or slash in rhythm — the third or fourth hit is a finisher that launches.",
    "• Hold a legendary sword and §fright-click§r for its special.",
  ]],
  ["§eLevels & stats", [
    "• Levels go to §f300§r. Every level gives 3 stat points to spend in Shinobi Record → Stats (each stat goes to 150).",
    "• Your §fhealth§r grows with your level and Vitality — up to 1,044 HP. Your §fdamage§r grows with your level too (×10 at 300).",
    "• Out of a fight you heal 1% of your health every second.",
    "• §fXP Shards§r (dropped by bosses, paid by quests) give a third of a level each — sneak + right-click to absorb a whole stack.",
    "• XP comes from kills, jutsu, quests, missions, daily missions and the story.",
  ]],
  ["§dClans", [
    "• 15 clans, from common (Inuzuka, Yamanaka) to legendary (Senju, Ōtsutsuki). Rarer clans are stronger.",
    "• Each has passives and an §fability item§r: right-click for one technique, §fsneak + right-click§r for another.",
    "• Some clans get kekkei genkai release scrolls (Wood, Ice, Lava, Boil, Blaze) and discounts on their favourite jutsu.",
    "• A §fBloodline Reroll Scroll§r rolls your clan again.",
    "• Uchiha awaken the §fMangekyō§r by fighting with the Sharingan on; Sage Mode is learned from the Jutsu Sensei (level 60).",
  ]],
  ["§aVillages & honor", [
    "• Each village has a §fperk§r (Will of Fire, Desert Shield…), its own headband, flak jacket and quests.",
    "• Every kill earns §fhonor§r for you and your village; the leaderboard is in Shinobi Record → Village.",
    "• Village-mates can't hurt each other. §fReturn Home§r teleports you back (10 minute cooldown).",
    "• You can §fleave your village§r (Shinobi Record → Village) and become a rogue ninja — only an admin can let you back in.",
  ]],
  ["§cBosses", [
    "• §fLegendary shinobi§r (19 of them) stand by their spawners and wait. §fTalk to one§r to accept its challenge — it shows the reward first.",
    "• The §fAkatsuki§r roam the world now and then and hunt Jinchūriki.",
    "• §fTailed Beasts§r: only one can rampage at a time. The §fTen-Tails§r only comes from its spawn egg.",
    "• Bosses hit harder the higher your level, so they stay a challenge. They drop scrolls, swords, Ryō and XP Shards.",
    "• The raid bosses (Edo Madara, Hashirama, Obito, Kaguya) are meant for groups.",
  ]],
  ["§6Jinchūriki", [
    "• An §fUzumaki§r can seal a weakened Tailed Beast into a player with the Four Symbols Seal (sneak + Sealing Chains).",
    "• A Jinchūriki gets more chakra and a §fcloak§r: wear it to enter Tailed Beast Mode — sneak taps and holds for Beast Arts and the Tailed Beast Bomb.",
    "• Face your beast's dark half (an Uzumaki opens the seal) to §fmaster§r it.",
    "• Die three times and the beast breaks free.",
  ]],
  ["§6Ryō & shops", [
    "• Earn Ryō from enemies (notes go straight to your wallet), missions, quests, daily missions, the story, events and bounties.",
    "• §fJutsu Sensei§r (scrolls, nature & clan training, Sage Mode) · §fWeaponsmith§r (gear, swords, ninja tools) · §fRamen Shop§r (food) · §fTravelling Merchant§r (random deals) · §fKage§r (missions) · §fProctor§r (rank exams) · §fQuest Giver§r · §fTravel Master§r (fast travel).",
    "• Pay other players from Shinobi Record → Ryō Wallet.",
  ]],
  ["§cBingo Book & PvP", [
    "• Put a §fbounty§r on any player (Shinobi Record → Bingo Book) — whoever defeats them collects it.",
    "• Killing players earns you a bounty of your own (three times as much for rogues). 100,000 Ryō shows [Wanted] over your name.",
    "• Your PvP record counts who you've defeated; the titles check it.",
    "• Players in a grace period can't fight or be hurt.",
  ]],
  ["§8Factions", [
    "• §cAkatsuki§r — for rogue ninja (level 60, a 25,000 Ryō bounty): the cloak, +10% damage to Tailed Beasts and Jinchūriki, and the Akatsuki leave you alone.",
    "• §7Anbu§r — for village shinobi (level 60, Jōnin or level 80, 2,000 honor): the mask, +10% damage to rogues, +50% on rogue bounties.",
    "• Both give §fcontracts§r for Ryō and rank. Join from Shinobi Record → Faction.",
  ]],
  ["§aDaily, achievements & events", [
    "• §fDaily§r: three random missions every day, a bonus for all three, and a login streak (day 7 pays the most).",
    "• §fAchievements§r: 51 of them, each with a reward the moment you unlock it.",
    "• §fWorld events§r — raids on villages, wanted legends, hidden scroll hunts, Double XP — are started by the server's admins.",
  ]],
  ["§5Titles", [
    "• Five titles of legend: §5Pain§r, §cItachi§r, §6Tobi§r, §9Sasuke§r, §6Naruto§r. Each has hard requirements (Shinobi Record → Titles shows them ticked).",
    "• An admin grants a title when you've earned it; it brings unique gear and perks.",
  ]],
];

export async function handbookMenu(player, back) {
  const f = new ActionFormData().title("§l§bShinobi Handbook").body("§7Pick a topic.");
  for (const [title] of TOPICS) f.button(title);
  f.button("§l« Back");
  const r = await f.show(player);
  if (r.canceled) return;
  const topic = TOPICS[r.selection];
  if (!topic) return back?.();
  await new ActionFormData().title(`§l${topic[0]}`).body(topic[1].join("\n\n")).button("§l« Back").show(player);
  return handbookMenu(player, back);
}
