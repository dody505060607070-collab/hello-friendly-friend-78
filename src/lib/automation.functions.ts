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

/** إعدادات ربط n8n — للمدير العام فقط. */
export const getAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("غير مصرح");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("automation_config")
      .select("enabled, webhook_url, events, shared_token")
      .eq("id", true)
      .maybeSingle();
    return {
      enabled: data?.enabled ?? false,
      webhook_url: data?.webhook_url ?? process.env["N8N_WEBHOOK_URL"] ?? "",
      events: (data?.events as string[] | null) ?? [],
      shared_token: data?.shared_token ?? "",
    };
  });

export const saveAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        webhook_url: z.string().trim().max(500),
        regenerate_token: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("غير مصرح");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      id: true,
      enabled: data.enabled,
      webhook_url: data.webhook_url || null,
    };
    if (data.regenerate_token) {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      patch["shared_token"] = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    const { error } = await supabaseAdmin.from("automation_config").upsert(patch as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
