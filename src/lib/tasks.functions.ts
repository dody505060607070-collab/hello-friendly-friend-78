import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const priorityLabel = (p: string | null) =>
  p === "urgent" ? "عاجلة" : p === "high" ? "عالية" : p === "low" ? "منخفضة" : "متوسطة";

/**
 * إرسال يدوي لمرة واحدة فقط لتكليف المهمة على واتساب للموظفين المحددين،
 * يتم تفعيله فقط بالضغط على زر "إرسال المهمة على واتساب" من شاشة المهمة.
 * لا يوجد أي جدولة أو تكرار تلقائي لاحق.
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
    if (error || !task) {
      return { ok: false as const, sent: 0, failed: 0, skipped: 0, results: [] as TaskSendResult[] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: people } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, whatsapp, whatsapp_notify, is_active")
      .in("id", data.userIds);

    const { sendWhatsApp } = await import("@/lib/whatsapp.functions");
    const now = Date.now();
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results: TaskSendResult[] = [];

    for (const person of people ?? []) {
      const phone = person.whatsapp || person.phone;
      if (!phone || person.is_active === false || person.whatsapp_notify === false) {
        skipped++;
        results.push({
          userId: person.id,
          name: person.full_name ?? "بدون اسم",
          ok: false,
          skipped: true,
          error: "بدون رقم واتساب أو الإشعارات مقفولة",
        });
        continue;
      }
      const dueText = task.due_date
        ? `\nموعد التسليم: ${task.due_date}${task.due_time ? ` ${String(task.due_time).slice(0, 5)}` : ""}`
        : "";
      const detailsText = task.details ? `\nالتفاصيل: ${task.details}` : "";
      const locText = task.location_text ? `\nالموقع: ${task.location_text}` : "";
      const text =
        `مهمة مكلّف بها (${priorityLabel(task.priority)}): ${task.title}` +
        `${detailsText}${dueText}${locText}\nبرجاء بدء التنفيذ وتحديث حالتها في النظام.`;

      const result = await sendWhatsApp({ to: phone, body: text });
      await supabaseAdmin.from("message_log").insert({
        recipient_name: person.full_name,
        recipient_phone: phone,
        body: text,
        channel: "whatsapp",
        result: result.ok ? "sent" : "failed",
        failure_reason: result.ok ? null : result.error,
        sent_by_system: false,
        idempotency_key: `task-send:${task.id}:${person.id}#${now}`,
      });
      if (result.ok) sent++;
      else failed++;
      results.push({
        userId: person.id,
        name: person.full_name ?? "بدون اسم",
        ok: result.ok,
        skipped: false,
        error: result.ok ? null : result.error,
      });
    }

    return { ok: true as const, sent, failed, skipped, results };
  });

export type TaskSendResult = {
  userId: string;
  name: string;
  ok: boolean;
  skipped: boolean;
  error: string | null;
};
