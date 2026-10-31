import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** يرسل تفاصيل المهمة على واتساب للموظفين المكلّفين. */
export const notifyTaskNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().min(1),
        userIds: z.array(z.string()).optional(),
        schedule: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { notifyTaskAssigneesNow } = await import("@/lib/tasks.server");
    return notifyTaskAssigneesNow(data.taskId, data.userIds, { schedule: data.schedule ?? false });
  });

/** إنهاء المهمة وإيقاف رسائل التذكير المتكررة عليها. */
export const finishTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { stopTaskReminders } = await import("@/lib/tasks.server");
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ status: "done", submitted_at: new Date().toISOString() })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    await stopTaskReminders(data.taskId);
    return { ok: true };
  });

/** إيقاف رسائل المهمة المتكررة بدون تغيير حالتها. */
export const stopTaskWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { stopTaskReminders } = await import("@/lib/tasks.server");
    return stopTaskReminders(data.taskId);
  });

/** يرسل تذكير موعد المعاينة للمالك والزائر والوسيط فورًا (ويبدأ عدّاد التكرار). */
export const sendMeetingReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Forbidden");
    const { sendMeetingReminderForTask } = await import("@/lib/meeting-reminders.server");
    return sendMeetingReminderForTask(data.taskId, context.userId);
  });
