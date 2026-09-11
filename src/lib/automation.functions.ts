import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AUTOMATION_EVENTS = [
  { key: "contract.created", label: "عقد جديد تم استيراده" },
  { key: "payment.reminder_sent", label: "تذكير دفعة تم إرساله" },
  { key: "whatsapp.sent", label: "رسالة واتساب صادرة" },
  { key: "request.created", label: "طلب عقار جديد من الموقع" },
] as const;

export const getAutomation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getAutomationConfigRow } = await import("@/lib/automation.server");
    const cfg = await getAutomationConfigRow();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: events } = await supabaseAdmin
      .from("automation_events")
      .select("id, event, direction, status, response, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    const base = process.env["PUBLIC_BASE_URL"] ?? "";
    return { ...cfg, inboundUrl: `${base}/api/public/n8n`, events_log: events ?? [] };
  });

export const saveAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        webhook_url: z.string().trim().max(500),
        events: z.array(z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("automation_config")
      .update({
        enabled: data.enabled,
        webhook_url: data.webhook_url || null,
        events: data.events as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const rotateAutomationToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("automation_config")
      .update({ shared_token: token })
      .eq("id", true);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, token };
  });

export const testAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { dispatchAutomation } = await import("@/lib/automation.server");
    return dispatchAutomation("test.ping", { message: "اختبار من نظام مثراء" });
  });

/** يُستدعى من الموقع العام بعد حفظ طلب عقار جديد، لإطلاق أتمتة n8n. */
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
