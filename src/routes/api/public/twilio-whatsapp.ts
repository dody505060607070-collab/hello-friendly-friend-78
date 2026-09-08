import { createHmac, timingSafeEqual } from "node:crypto";

import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook واتساب من Twilio (الرسائل الواردة وحالات التسليم).
 * يتحقق من توقيع X-Twilio-Signature قبل معالجة أي بيانات.
 */
function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string, token: string) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/twilio-whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TWILIO_AUTH_TOKEN"];
        if (!token) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
        const signature = request.headers.get("x-twilio-signature") ?? "";
        const publicUrl = process.env["PUBLIC_BASE_URL"]
          ? `${process.env["PUBLIC_BASE_URL"]}/api/public/twilio-whatsapp`
          : request.url;

        if (!signature || !verifyTwilioSignature(publicUrl, params, signature, token))
          return new Response("Invalid signature", { status: 401 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("activity_log").insert({
            action: "whatsapp_webhook",
            entity: "whatsapp",
            details: {
              from: params["From"] ?? null,
              to: params["To"] ?? null,
              body: params["Body"] ?? null,
              status: params["MessageStatus"] ?? null,
              sid: params["MessageSid"] ?? null,
            },
          });
        } catch {
          // لا نُفشل الـwebhook بسبب التسجيل
        }

        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { "Content-Type": "text/xml" } },
        );
      },
    },
  },
});
