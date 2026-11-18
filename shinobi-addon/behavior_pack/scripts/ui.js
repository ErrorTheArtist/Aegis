// Form helpers (v1.56).
// A form opened from a chat command can't appear while the chat screen is still open — Bedrock answers "user busy".
// showForm keeps trying for a while (until the player closes the chat), so menus opened by /scriptevent always show.

import { system } from "@minecraft/server";

const wait = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));

export async function showForm(player, form, tries = 60) {
  for (let i = 0; ; i++) {
    let r;
    try {
      r = await form.show(player);
    } catch {
      return { canceled: true };
    }
    if (!r.canceled || r.cancelationReason !== "UserBusy" || i >= tries) return r;
    await wait(10); // every half second, for up to half a minute
  }
}
