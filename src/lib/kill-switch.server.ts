import { createHash, timingSafeEqual } from "node:crypto";

export type KillSwitchState = { locked: boolean; message: string };

let cachedState: KillSwitchState | null = null;
let cachedAt = 0;
const CACHE_MS = 5_000;

/** يتحقق من حالة القفل باستخدام service role (لا يخضع لـ RLS). */
export async function getKillSwitchState(): Promise<KillSwitchState> {
  const now = Date.now();
  if (cachedState && now - cachedAt < CACHE_MS) return cachedState;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_kill_switch")
    .select("locked,message")
    .eq("id", 1)
    .maybeSingle();

  if (!data) {
    // إذا حُذف الصف، نُعيد إنشاؤه مفتوحاً لكن نسجّل الحدث.
    await supabaseAdmin
      .from("site_kill_switch")
      .insert({ id: 1, locked: false, message: "الموقع متوقف مؤقتاً." });
    cachedState = { locked: false, message: "" };
  } else {
    cachedState = { locked: Boolean(data.locked), message: data.message || "" };
  }
  cachedAt = now;
  return cachedState;
}

/** يرمي خطأ إذا كان الموقع مقفولاً. */
export async function requireUnlocked() {
  const state = await getKillSwitchState();
  if (state.locked) {
    throw new Error(state.message || "الموقع متوقف مؤقتاً.");
  }
}

/** يتحقق من الكود السري بدون تسريب طوله. */
export function killSwitchCodeMatches(input: string, expected: string): boolean {
  if (!input || input.length < 4) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}
