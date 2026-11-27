// Showing a form: waits (up to 15 s) while the player is busy in another screen, instead of failing.

import { system } from "@minecraft/server";

export async function show(p, form) {
  for (let i = 0; i < 30; i++) {
    let r;
    try {
      r = await form.show(p);
    } catch {
      return { canceled: true };
    }
    if (!r.canceled || r.cancelationReason !== "UserBusy") return r;
    await new Promise((res) => system.runTimeout(res, 10));
  }
  return { canceled: true };
}
