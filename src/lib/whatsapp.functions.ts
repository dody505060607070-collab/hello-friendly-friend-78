import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** يحوّل الرقم إلى صيغة دولية سعودية (9665XXXXXXXX). */
export function normalizeSaudiPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("05")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5")) return `966${digits}`;
  return digits;
}

/**
 * إرسال رسالة واتساب عبر Twilio.
 * الأسرار المطلوبة على الخادم: TWILIO_ACCOUNT_SID، TWILIO_AUTH_TOKEN،
 * TWILIO_WHATSAPP_FROM (مثل: whatsapp:+14155238886).
 * إن لم تُضبط، تُعاد حالة "not_configured" مع رابط wa.me كبديل يدوي
 * حتى لا يتوقف أي جزء من النظام.
 */
export const sendWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; body: string; mediaUrl?: string }) => {
    if (!input.to || !input.body) throw new Error("الرقم والنص مطلوبان");
    return input;
  })
  .handler(async ({ data }) => {
    const to = normalizeSaudiPhone(data.to);
    const sid = process.env["TWILIO_ACCOUNT_SID"];
    const token = process.env["TWILIO_AUTH_TOKEN"];
    const from = process.env["TWILIO_WHATSAPP_FROM"];
    const fallback = `https://wa.me/${to}?text=${encodeURIComponent(data.body)}`;

    if (!sid || !token || !from) {
      return { status: "not_configured" as const, to, link: fallback };
    }

    const params = new URLSearchParams({
      To: `whatsapp:+${to}`,
      From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
      Body: data.body,
    });
    if (data.mediaUrl) params.set("MediaUrl", data.mediaUrl);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const json = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) return { status: "failed" as const, to, error: json.message ?? `Twilio ${res.status}`, link: fallback };
    return { status: "sent" as const, to, messageSid: json.sid ?? null, link: fallback };
  });
