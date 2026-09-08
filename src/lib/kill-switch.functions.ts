import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const setKillSwitch = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; locked: boolean; message?: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["KILL_SWITCH_SECRET"];
    if (!expected) {
      return { ok: false as const, error: "KILL_SWITCH_SECRET غير مضبوط على الخادم" };
    }
    if (!data.code || data.code.length < 4 || !passwordMatches(data.code, expected)) {
      // small delay to blunt guessing
      await new Promise((r) => setTimeout(r, 800));
      return { ok: false as const, error: "الكود غير صحيح" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      locked: data.locked,
      updated_at: new Date().toISOString(),
    };
    if (typeof data.message === "string" && data.message.trim().length > 0) {
      patch["message"] = data.message.trim();
    }
    const { error } = await supabaseAdmin
      .from("site_kill_switch")
      .update(patch)
      .eq("id", 1);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, locked: data.locked };
  });
