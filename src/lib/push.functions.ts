import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** المفتاح العام لإشعارات المتصفح (VAPID) — عام وآمن للمشاركة مع المتصفح. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null };
});

type SubInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SubInput) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpoint: string }) => data)
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

type SendInput = {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** إرسال إشعار Push لمستخدمين محددين (يعمل والتطبيق مغلق). */
export const sendPushToUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendInput) => data)
  .handler(async ({ data }) => {
    const publicKey = process.env["VAPID_PUBLIC_KEY"];
    const privateKey = process.env["VAPID_PRIVATE_KEY"];
    const subject = process.env["VAPID_SUBJECT"] ?? "mailto:info@mithra.work";
    if (!publicKey || !privateKey) return { sent: 0, reason: "vapid_not_configured" };
    const targets = [...new Set(data.userIds.filter(Boolean))];
    if (targets.length === 0) return { sent: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", targets);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) return { sent: 0 };

    const { buildPushPayload } = await import("@block65/webcrypto-web-push");

    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          const payload = await buildPushPayload(
            {
              data: {
                title: data.title,
                body: data.body,
                url: data.url ?? "/dashboard",
                tag: data.tag ?? "mithra",
              },
              options: { ttl: 60 * 60 * 24, urgency: "high" },
            },
            subscription,
            { subject, publicKey, privateKey },
          );
          const res = await fetch(sub.endpoint, {
            method: payload.method,
            headers: payload.headers,
            body: payload.body,
          });
          if (res.ok) sent += 1;
          else if (res.status === 404 || res.status === 410) stale.push(sub.endpoint);
          else console.error(`push failed [${res.status}]: ${await res.text()}`);
        } catch (err) {
          console.error("push error", err);
        }
      }),
    );

    if (stale.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return { sent };
  });
