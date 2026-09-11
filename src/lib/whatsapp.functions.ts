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

function normalizeBridgeConfig() {
  const rawUrl = process.env["WHATSAPP_BRIDGE_URL"] ?? "";
  const rawToken = process.env["WHATSAPP_BRIDGE_TOKEN"] ?? "";
  const url = rawUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/+$/, "");
  const token = rawToken
    .trim()
    .replace(/^WHATSAPP_BRIDGE_TOKEN\s*=\s*/i, "")
    .replace(/^BRIDGE_TOKEN\s*=\s*/i, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  return { url, token };
}

function bridgeHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-Bridge-Token": token,
  };
}

/* ------------------------------------------------------------------ */
/* مزوّد واتساب السحابي (Evolution API) — ربط بالـQR بدون خادم خاص      */
/* الأسرار: WHATSAPP_API_URL / WHATSAPP_API_KEY / WHATSAPP_INSTANCE     */
/* ------------------------------------------------------------------ */

function cloudConfig() {
  const url = (process.env["WHATSAPP_API_URL"] ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");
  const key = (process.env["WHATSAPP_API_KEY"] ?? "").trim().replace(/^['"]|['"]$/g, "");
  const instance = (process.env["WHATSAPP_INSTANCE"] ?? "mithra").trim().replace(/^['"]|['"]$/g, "");
  return { url, key, instance, ready: Boolean(url && key) };
}

function cloudHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function cloudJson(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; data: Record<string, unknown>; raw: string }> {
  const { url, key } = cloudConfig();
  const res = await fetch(`${url}${path}`, {
    method: init?.method ?? "GET",
    headers: cloudHeaders(key),
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const raw = await res.text().catch(() => "");
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  return { status: res.status, data, raw };
}

/** إرسال رسالة عبر المزوّد السحابي. */
async function cloudSend(to: string, body: string): Promise<TwilioResult | null> {
  const cfg = cloudConfig();
  if (!cfg.ready) return null;
  const number = toE164(to).replace(/[^\d]/g, "");
  try {
    const { status, data, raw } = await cloudJson(`/message/sendText/${cfg.instance}`, {
      method: "POST",
      body: { number, text: body, textMessage: { text: body } },
    });
    if (status >= 200 && status < 300) {
      const keyObj = data["key"] as { id?: string } | undefined;
      return { ok: true, sid: keyObj?.id ?? "" };
    }
    const message =
      (data["message"] as string | undefined) ??
      (data["error"] as string | undefined) ??
      raw.slice(0, 200);
    return { ok: false, error: `واتساب ${status}: ${message}` };
  } catch (e) {
    return { ok: false, error: `تعذر الاتصال بخدمة واتساب: ${(e as Error).message}` };
  }
}

type LinkStatus = {
  configured: boolean;
  connection: "open" | "connecting" | "closed";
  qr: string | null;
  me: string | null;
  error: string | null;
};

/** حالة الربط + رمز QR من المزوّد السحابي. */
async function cloudStatus(): Promise<LinkStatus | null> {
  const cfg = cloudConfig();
  if (!cfg.ready) return null;
  try {
    const state = await cloudJson(`/instance/connectionState/${cfg.instance}`);
    const inst = (state.data["instance"] as { state?: string; owner?: string } | undefined) ?? {};
    const raw = inst.state ?? (state.data["state"] as string | undefined) ?? "";
    if (raw === "open") {
      return {
        configured: true,
        connection: "open",
        qr: null,
        me: (inst.owner ?? "").toString().split("@")[0] || null,
        error: null,
      };
    }

    // غير مرتبط → اطلب رمز QR جديد
    const conn = await cloudJson(`/instance/connect/${cfg.instance}`);
    const b64 = (conn.data["base64"] as string | undefined) ?? null;
    const qr = b64 ? (b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`) : null;
    if (conn.status === 401 || conn.status === 403) {
      return {
        configured: true,
        connection: "closed",
        qr: null,
        me: null,
        error: "مفتاح خدمة واتساب غير صحيح — تأكد من قيمة WHATSAPP_API_KEY.",
      };
    }
    if (conn.status === 404) {
      return {
        configured: true,
        connection: "closed",
        qr: null,
        me: null,
        error: `لا يوجد اتصال باسم «${cfg.instance}» لدى المزوّد. أنشئه بنفس الاسم أو صحّح WHATSAPP_INSTANCE.`,
      };
    }
    return {
      configured: true,
      connection: qr ? "connecting" : "closed",
      qr,
      me: null,
      error: qr ? null : `المزوّد لم يُرجع رمز QR (${conn.status}).`,
    };
  } catch (e) {
    return {
      configured: true,
      connection: "closed",
      qr: null,
      me: null,
      error: `تعذر الوصول لخدمة واتساب: ${(e as Error).message}`,
    };
  }
}

/** إرسال عبر جسر واتساب المجاني على الـVPS (رقمك الشخصي/رقم الشركة). */
async function bridgeSend(to: string, body: string): Promise<TwilioResult | null> {
  const { url, token } = normalizeBridgeConfig();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/send`, {
      method: "POST",
      headers: { ...bridgeHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ to: toE164(to), body }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
    if (res.ok && data.ok) return { ok: true, sid: data.id ?? "" };
    return { ok: false, error: data.error ?? `Bridge ${res.status}` };
  } catch (e) {
    return { ok: false, error: `تعذر الاتصال بجسر واتساب: ${(e as Error).message}` };
  }
}

export async function twilioSend(input: {
  to: string;
  body: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<TwilioResult> {
  // الأولوية للجسر المجاني (الرقم المرتبط بالـQR)، وإن فشل نرجع لـTwilio.
  if (!input.contentSid) {
    const viaBridge = await bridgeSend(input.to, input.body);
    if (viaBridge?.ok) return viaBridge;
  }

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

/** حالة ربط واتساب المجاني + رمز QR للمسح. */
export const getWhatsAppLinkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LinkStatus> => {
    const viaCloud = await cloudStatus();
    if (viaCloud) return viaCloud;
    const { url, token } = normalizeBridgeConfig();
    if (!url || !token) {
      return { configured: false, connection: "closed" as const, qr: null, me: null, error: null };
    }
    try {
      const res = await fetch(`${url}/status`, {
        headers: bridgeHeaders(token),
      });
      const raw = await res.text().catch(() => "");
      let data: { connection?: string; qr?: string | null; me?: string | null; error?: string | null } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        const detail = (data.error ?? raw ?? "").toString().slice(0, 200);
        return {
          configured: true,
          connection: "closed" as const,
          qr: null,
          me: null,
          error:
            res.status === 401 || res.status === 403
              ? "الجسر يعمل لكنه رفض مفتاح الاتصال. أعد تشغيل خدمة واتساب من لوحة الخادم لتقرأ إعداداتها المحفوظة."
              : `الجسر رجّع خطأ ${res.status}: ${detail}`,
        };
      }
      return {
        configured: true,
        connection: (data.connection ?? "closed") as "open" | "connecting" | "closed",
        qr: data.qr ?? null,
        me: data.me ?? null,
        error: data.error ?? null,
      };

    } catch (e) {
      return {
        configured: true,
        connection: "closed" as const,
        qr: null,
        me: null,
        error: `تعذر الوصول للجسر: ${(e as Error).message}`,
      };
    }
  });

/** فصل الرقم المرتبط وإظهار رمز QR جديد. */
export const unlinkWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { url, token } = normalizeBridgeConfig();
    if (!url || !token) return { ok: false, error: "الجسر غير مُعد" };
    try {
      const res = await fetch(`${url}/logout`, {
        method: "POST",
        headers: bridgeHeaders(token),
      });
      return { ok: res.ok, error: res.ok ? null : `Bridge ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
