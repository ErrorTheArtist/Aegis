// Personal settings (v1.56) — Shinobi Record → Settings.
//   M1 combo animations · swords on your back · quiet notifications (no chat lines for achievements and daily
//   missions — the titles on screen stay) · v1.63: Chakra Leap, Wall Running and Water Walking (each can be turned off).

import { ModalFormData } from "@minecraft/server-ui";

const QUIET = "aegis:quiet";
export const quiet = (p) => {
  try {
    return p?.getDynamicProperty(QUIET) === true;
  } catch {
    return false;
  }
};

const OPTIONS = [
  // [label, property, the property is set when the option is OFF]
  ["M1 combo animations", "aegis:m1_off", true],
  ["Swords go on your back when you switch away", "aegis:sheath_off", true],
  ["Chat messages for achievements and daily missions", QUIET, true],
  // v1.63: ninja movement (movement.js)
  ["Chakra Leap §8(jump again in mid-air)", "aegis:leap_off", true],
  ["Wall Running §8(hold jump against a wall or a tree)", "aegis:wallrun_off", true],
  ["Water Walking §8(run on water; sneak to sink)", "aegis:waterwalk_off", true],
];

export async function settingsMenu(player, back) {
  const f = new ModalFormData().title("§lSettings");
  for (const [label, prop, inverted] of OPTIONS) {
    const set = player.getDynamicProperty(prop) === true;
    f.toggle(label, inverted ? !set : set);
  }
  const r = await f.show(player);
  if (!r.canceled && r.formValues) {
    OPTIONS.forEach(([, prop, inverted], i) => {
      const on = !!r.formValues[i];
      player.setDynamicProperty(prop, (inverted ? !on : on) ? true : undefined);
    });
    player.sendMessage("§7Settings saved.");
  }
  return back?.();
}
