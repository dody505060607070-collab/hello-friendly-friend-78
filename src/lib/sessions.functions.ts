import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** تسجيل بداية جلسة عمل للموظف الحالي (بدون أي بيانات حساسة). */
export const startEmployeeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userAgent?: string; platform?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("employee_sessions")
      .insert({
        user_id: context.userId,
        user_agent: (data.userAgent ?? "").slice(0, 200) || null,
        platform: (data.platform ?? "").slice(0, 60) || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** نبضة تحديث آخر ظهور للجلسة الحالية. */
export const heartbeatEmployeeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employee_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .is("ended_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إغلاق الجلسة عند تسجيل الخروج. */
export const endEmployeeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employee_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
