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
  return {
    enabled: Boolean(data?.enabled),
    webhook_url: data?.webhook_url ?? null,
    events: Array.isArray(data?.events) ? (data?.events as string[]) : [],
    shared_token: data?.shared_token ?? null,
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
