import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * إرسال واتساب مباشرة عبر Twilio (بدون فتح wa.me).
 * السرّيات: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM
 * واختياريًا TWILIO_CONTENT_SID للقالب المعتمد خارج نافذة الـ 24 ساعة.
 */

/** يحوّل رقمًا سعوديًا محليًا (05xxxxxxxx) إلى صيغة +966xxxxxxxx. */
export function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00966")) return `+${digits.slice(2)}`;
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("05")) return `+966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  return digits.startsWith("00") ? `+${digits.slice(2)}` : `+${digits}`;
}

type TwilioResult =
  | { ok: true; sid: string }
  | { ok: false; error: string; needsTemplate?: boolean };

export async function twilioSend(input: {
  to: string;
  body: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<TwilioResult> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_WHATSAPP_FROM"] ?? "whatsapp:+17372212163";
  if (!sid || !token) return { ok: false, error: "بيانات Twilio غير مكتملة في النظام" };

  const to = toE164(input.to);
  if (!to.startsWith("+") || to.length < 8) {
    return { ok: false, error: `رقم الجوال غير صالح: ${input.to}` };
  }

  const form = new URLSearchParams({ To: `whatsapp:${to}`, From: from });
  if (input.contentSid) {
    form.set("ContentSid", input.contentSid);
    if (input.contentVariables) form.set("ContentVariables", JSON.stringify(input.contentVariables));
  } else {
    form.set("Body", input.body);
  }

  let res: Response;
  try {
    res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
  } catch (e) {
    return { ok: false, error: `تعذر الاتصال بـ Twilio: ${(e as Error).message}` };
  }

  if (res.ok) {
    const data = (await res.json()) as { sid?: string };
    return { ok: true, sid: data.sid ?? "" };
  }

  const text = await res.text();
  let message = `Twilio ${res.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string; code?: number };
    if (parsed.message) message = `Twilio ${parsed.code ?? res.status}: ${parsed.message}`;
    // 63016 = خارج نافذة الـ 24 ساعة → يجب استخدام قالب معتمد
    if (parsed.code === 63016) {
      return {
        ok: false,
        needsTemplate: true,
        error: "العميل خارج نافذة الـ24 ساعة — يلزم قالب واتساب معتمد لهذه الرسالة",
      };
    }
  } catch {
    message = `Twilio ${res.status}: ${text.slice(0, 200)}`;
  }
  return { ok: false, error: message };
}

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      z
        .object({
          to: z.string().min(5),
          body: z.string().min(1),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<TwilioResult> => {
    const { requireUnlocked } = await import("@/lib/kill-switch.server");
    await requireUnlocked();
    const result = await twilioSend({ to: data.to, body: data.body });
    const { dispatchAutomation } = await import("@/lib/automation.server");
    await dispatchAutomation("whatsapp.sent", {
      to: data.to,
      body: data.body,
      ok: result.ok,
      sid: result.ok ? result.sid : null,
      error: result.ok ? null : result.error,
    });
    return result;
  });

export const checkTwilioConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      configured: Boolean(process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"]),
      from: process.env["TWILIO_WHATSAPP_FROM"] ?? null,
    };
  });
