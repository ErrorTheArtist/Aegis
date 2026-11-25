// Credits — Jujutsu Legacy was made by errorlegend. Questions, ideas or bugs: DM errorlegend_ on Discord.
//
// The credit is part of the add-on and can't be switched off: every player sees it when they join, it's on the
// Jujutsu Record (and its Credits page), in the awakening message, and /scriptevent jjk:credits shows it. A second,
// encoded copy is kept in core.js. If the names here are changed or removed, the add-on stops awakening techniques
// and running moves, and tells everyone who really made it.

import { seal } from "./core.js";

export const AUTHOR = "errorlegend";
export const DISCORD = "errorlegend_";

const original = () => seal().split("|");
export const creditsIntact = () => `${AUTHOR}|${DISCORD}` === seal();
// Always built from the sealed copy, so it shows the real author even in an edited copy.
export function creditLine() {
  const [author, discord] = original();
  return `§d✦ §fJujutsu Legacy §7— made by §d${author}§7. Questions or ideas? DM §f${discord}§7 on Discord.`;
}
export function creditPage() {
  const [author, discord] = original();
  return [
    "§d§lJujutsu Legacy",
    "",
    `§fCreated by §d§l${author}`,
    `§7Models, techniques, curses, domains — everything in this add-on.`,
    "",
    `§fContact: §7DM §f${discord}§7 on Discord`,
    "§7for questions, ideas and bug reports.",
    "",
    "§8Jujutsu Kaisen belongs to Gege Akutami. This is a fan-made add-on.",
  ].join("\n");
}
export function tamperedLine() {
  const [author, discord] = original();
  return `§c✦ This copy of Jujutsu Legacy has been modified to hide its credits. The original is by §f${author}§c (Discord: §f${discord}§c). Techniques are disabled.`;
}
