/**
 * محرك الأتمتة (n8n) — إرسال الأحداث من النظام إلى n8n عبر Webhook.
 * server-only: لا يُستورد أبدًا من كود المتصفح.
 */

export type AutomationEvent =
  | "contract.created"
  | "payment.reminder_sent"
  | "whatsapp.sent"
  | "request.created"
  | "test.ping";

type Config = {
  enabled: boolean;
  webhook_url: string | null;
  events: string[];
  shared_token: string | null;
};

export async function getAutomationConfigRow(): Promise<Config> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("automation_config")
    .select("enabled, webhook_url, events, shared_token")
    .eq("id", true)
    .maybeSingle();
  // الرابط والمفتاح يُقرآن من الإعدادات المخزّنة أو من متغيرات البيئة — بلا أي واجهة إعداد.
  const envUrl = process.env["N8N_WEBHOOK_URL"] ?? null;
  const url = data?.webhook_url ?? envUrl;
  return {
    enabled: Boolean(url) && data?.enabled !== false,
    webhook_url: url,
    events: Array.isArray(data?.events) ? (data?.events as string[]) : [],
    shared_token: data?.shared_token ?? process.env["N8N_SHARED_TOKEN"] ?? null,
  };
}

/** يرسل حدثًا إلى n8n ويسجّله. لا يرمي استثناءات أبدًا. */
export async function dispatchAutomation(
  event: AutomationEvent,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cfg = await getAutomationConfigRow();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!cfg.enabled || !cfg.webhook_url) {
      return { ok: false, error: "الأتمتة غير مفعّلة" };
    }
    if (cfg.events.length > 0 && !cfg.events.includes(event)) {
      return { ok: false, error: "الحدث غير مفعّل" };
    }

    const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data: payload });
    let status = "sent";
    let response = "";
    try {
      const res = await fetch(cfg.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Mithra-Token": cfg.shared_token ?? "",
          "X-Mithra-Event": event,
        },
        body,
      });
      response = (await res.text()).slice(0, 500);
      if (!res.ok) status = `failed_${res.status}`;
    } catch (e) {
      status = "failed";
      response = (e as Error).message.slice(0, 500);
    }

    await supabaseAdmin.from("automation_events").insert({
      event,
      direction: "out",
      payload: payload as never,
      status,
      response,
    });

    return status === "sent" ? { ok: true } : { ok: false, error: response };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** يتحقق من مفتاح الربط القادم من n8n. */
export async function verifyAutomationToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const cfg = await getAutomationConfigRow();
  if (!cfg.shared_token) return false;
  const a = new TextEncoder().encode(token);
  const b = new TextEncoder().encode(cfg.shared_token);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* تذكيرات الدفعات اليدوية — فحص الأهلية قبل كل إرسال                    */
/* ------------------------------------------------------------------ */

const SETTLED_PAYMENT_STATUSES = new Set(["paid", "cancelled", "closed"]);
const CLOSED_CONTRACT_STATUSES = new Set(["cancelled", "ended", "closed", "terminated"]);

export type ReminderEligibility = { skip: boolean; reason?: string };

/**
 * يتحقق قبل كل إرسال أن الدفعة والعقد ما زالا يستحقان تذكيرًا.
 * يُوقف التذكير (بدون إرسال) إذا: الدفعة مدفوعة/ملغاة/مغلقة، أو المبلغ المسدد ≥ المستحق،
 * أو حالة العقد منتهية/ملغاة/مغلقة، أو كل دفعات العقد مُسوّاة.
 */
export function evaluateReminderEligibility(input: {
  payment: { status: string; amount_due: number; amount_paid: number } | null;
  contract: { status: string } | null;
  allContractPayments: { status: string; amount_due: number; amount_paid: number }[];
}): ReminderEligibility {
  const { payment, contract, allContractPayments } = input;

  if (!payment) return { skip: true, reason: "لا توجد دفعة مرتبطة" };
  if (SETTLED_PAYMENT_STATUSES.has(payment.status)) {
    return { skip: true, reason: `حالة الدفعة: ${payment.status}` };
  }
  if (Number(payment.amount_paid) >= Number(payment.amount_due)) {
    return { skip: true, reason: "تم سداد كامل المبلغ" };
  }
  if (contract && CLOSED_CONTRACT_STATUSES.has(contract.status)) {
    return { skip: true, reason: `حالة العقد: ${contract.status}` };
  }
  if (
    allContractPayments.length > 0 &&
    allContractPayments.every(
      (p) => SETTLED_PAYMENT_STATUSES.has(p.status) || Number(p.amount_paid) >= Number(p.amount_due),
    )
  ) {
    return { skip: true, reason: "كل دفعات العقد مُسوّاة" };
  }
  return { skip: false };
}

/** يحسب موعد الإرسال القادم متجاوزًا أي دورات فائتة، ليكون أول موعد مستقبلي فعلًا (بلا تراكم). */
export function calculateNextFutureSend(interval: string | null, from: Date = new Date()): string | null {
  if (!interval || interval === "once") return null;
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  const stepMs: Record<string, number> = {
    "6h": 6 * hourMs,
    "8h": 8 * hourMs,
    "12h": 12 * hourMs,
    "24h": dayMs,
    daily: dayMs,
    "3d": 3 * dayMs,
    weekly: 7 * dayMs,
    biweekly: 14 * dayMs,
  };
  const now = Date.now();
  if (interval === "monthly") {
    const d = new Date(from);
    do {
      d.setMonth(d.getMonth() + 1);
    } while (d.getTime() <= now);
    return d.toISOString();
  }
  const step = stepMs[interval];
  if (!step) return null;
  let next = from.getTime() + step;
  while (next <= now) next += step;
  return new Date(next).toISOString();
}

