import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const priorityLabel = (p: string | null) =>
  p === "urgent" ? "عاجلة" : p === "high" ? "عالية" : p === "low" ? "منخفضة" : "متوسطة";

/**
 * إرسال فوري لتكليف المهمة على واتساب لكل موظف مكلّف،
 * ويُسجَّل في سجل الرسائل بنفس مفتاح المتابعة حتى تبدأ دورة التكرار من الآن
 * (عاجلة 12 ساعة / عالية 24 ساعة / غير ذلك 3 أيام).
 */
export const notifyTaskAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ taskId: z.string().uuid(), userIds: z.array(z.string().uuid()).min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error } = await context.supabase
      .from("tasks")
      .select("id, title, details, priority, status, due_date, due_time, location_text")
      .eq("id", data.taskId)
      .single();
    if (error || !task) return { ok: false as const, sent: 0, failed: 0, skipped: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: people } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, whatsapp, whatsapp_notify, is_active")
      .in("id", data.userIds);

    const { twilioSend } = await import("@/lib/whatsapp.functions");
    const now = Date.now();
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const person of people ?? []) {
      const phone = person.whatsapp || person.phone;
      if (!phone || person.is_active === false || person.whatsapp_notify === false) {
        skipped++;
        continue;
      }
      const dueText = task.due_date
        ? `\nموعد التسليم: ${task.due_date}${task.due_time ? ` ${String(task.due_time).slice(0, 5)}` : ""}`
        : "";
      const detailsText = task.details ? `\nالتفاصيل: ${task.details}` : "";
      const locText = task.location_text ? `\nالموقع: ${task.location_text}` : "";
      const text =
        `مهمة جديدة مكلّف بها (${priorityLabel(task.priority)}): ${task.title}` +
        `${detailsText}${dueText}${locText}\nبرجاء بدء التنفيذ وتحديث حالتها في النظام.`;

      const result = await twilioSend({ to: phone, body: text });
      await supabaseAdmin.from("message_log").insert({
        recipient_name: person.full_name,
        recipient_phone: phone,
        body: text,
        channel: "whatsapp",
        result: result.ok ? "sent" : "failed",
        failure_reason: result.ok ? null : result.error,
        sent_by_system: true,
        idempotency_key: `task-fu:${task.id}:${person.id}#${now}`,
      });
      if (result.ok) sent++;
      else failed++;

      await supabaseAdmin.from("notifications").insert({
        user_id: person.id,
        title: `مهمة جديدة (${priorityLabel(task.priority)})`,
        body: task.title,
        link: "/tasks",
      });
    }

    return { ok: true as const, sent, failed, skipped };
  });
