import { createServerFn } from "@tanstack/react-start";

import {
  getKillSwitchState,
  killSwitchCodeMatches,
  requireUnlocked,
} from "./kill-switch.server";

export { requireUnlocked, getKillSwitchState };

export const setKillSwitch = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; locked: boolean; message?: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["KILL_SWITCH_SECRET"];
    if (!expected) {
      return { ok: false as const, error: "KILL_SWITCH_SECRET غير مضبوط على الخادم" };
    }
    if (!killSwitchCodeMatches(data.code, expected)) {
      // small delay to blunt guessing
      await new Promise((r) => setTimeout(r, 800));
      return { ok: false as const, error: "الكود غير صحيح" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trimmed = typeof data.message === "string" ? data.message.trim() : "";
    const patch =
      trimmed.length > 0
        ? { locked: data.locked, updated_at: new Date().toISOString(), message: trimmed }
        : { locked: data.locked, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("site_kill_switch")
      .update(patch)
      .eq("id", 1);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, locked: data.locked };
  });
