import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** يُستدعى من الموقع العام بعد حفظ طلب عقار جديد — تشغيل تلقائي بدون أي إعداد من الواجهة. */
export const reportPublicRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().max(120),
        phone: z.string().trim().max(30),
        purpose: z.string().trim().max(30).optional(),
        city: z.string().trim().max(80).optional(),
        property_type: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { dispatchAutomation } = await import("@/lib/automation.server");
    await dispatchAutomation("request.created", data);
    return { ok: true as const };
  });

/** يُستدعى بعد إرسال تذكير دفعة عبر واتساب. */
export const reportReminderSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        paymentId: z.string(),
        contractId: z.string().nullable().optional(),
        recipientName: z.string().nullable().optional(),
        recipientPhone: z.string().nullable().optional(),
        amount: z.number().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        message: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { dispatchAutomation } = await import("@/lib/automation.server");
    await dispatchAutomation("payment.reminder_sent", data);
    return { ok: true as const };
  });
