import { createFileRoute } from "@tanstack/react-router";

/**
 * نقطة دخول n8n إلى النظام.
 * POST /api/public/n8n  مع الترويسة X-Mithra-Token
 * body: { action: "send_whatsapp" | "notify_staff" | "due_payments" | "process_reminders" | "log", ... }
 */
export const Route = createFileRoute("/api/public/n8n")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyAutomationToken } = await import("@/lib/automation.server");
        const token = request.headers.get("x-mithra-token");
        if (!(await verifyAutomationToken(token))) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "invalid json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const action = String(body["action"] ?? "");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        // نتيجة تذكيرات الدفعات عندما يُشغَّل الإجراء الدوري الموحّد.
        let reminders: { checked: number; sent: number; failed: number } | null = null;

        try {
          if (action === "send_whatsapp") {
            const to = String(body["to"] ?? "");
            const text = String(body["body"] ?? "");
            if (!to || !text) return json({ ok: false, error: "to/body مطلوبان" }, 400);
            const { twilioSend } = await import("@/lib/whatsapp.functions");
            const result = await twilioSend({ to, body: text });
            await supabaseAdmin.from("automation_events").insert({
              event: "whatsapp.inbound_request",
              direction: "in",
              payload: { to } as never,
              status: result.ok ? "sent" : "failed",
              response: result.ok ? result.sid : result.error,
            });
            return json(result, result.ok ? 200 : 502);
          }

          if (action === "notify_staff") {
            const title = String(body["title"] ?? "تنبيه من الأتمة");
            const text = body["body"] ? String(body["body"]) : null;
            const link = body["link"] ? String(body["link"]) : null;
            const { data: staff } = await supabaseAdmin.from("user_roles").select("user_id");
            const ids = Array.from(new Set((staff ?? []).map((r) => r.user_id)));
            if (ids.length > 0) {
              await supabaseAdmin
                .from("notifications")
                .insert(ids.map((user_id) => ({ user_id, title, body: text, link })));
            }
            await supabaseAdmin.from("automation_events").insert({
              event: "staff.notified",
              direction: "in",
              payload: { title, count: ids.length } as never,
              status: "sent",
            });
            return json({ ok: true, notified: ids.length });
          }

          if (action === "due_payments") {
            // يرجع الدفعات المستحقة خلال N يوم (أو المتأخرة) مع بيانات العميل — لاستخدامها في تذكيرات مجدولة.
            const days = Math.min(Math.max(Number(body["days"] ?? 7) || 7, 0), 90);
            const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
            const { data: payments, error } = await supabaseAdmin
              .from("contract_payments")
              .select("id, contract_id, due_date, amount_due, amount_paid, status, payment_number")
              .in("status", ["pending", "partial", "overdue"])
              .lte("due_date", until)
              .order("due_date", { ascending: true })
              .limit(200);
            if (error) throw new Error(error.message);

            const contractIds = Array.from(new Set((payments ?? []).map((p) => p.contract_id)));
            const { data: contracts } = contractIds.length
              ? await supabaseAdmin.from("contracts").select("id, contract_number, tenant_id").in("id", contractIds)
              : { data: [] };
            const tenantIds = Array.from(
              new Set((contracts ?? []).map((c) => c.tenant_id).filter((v): v is string => Boolean(v))),
            );
            const { data: tenants } = tenantIds.length
              ? await supabaseAdmin.from("contacts").select("id, full_name, phone").in("id", tenantIds)
              : { data: [] };

            const contractById = new Map((contracts ?? []).map((c) => [c.id, c]));
            const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));
            const today = new Date().toISOString().slice(0, 10);

            const items = (payments ?? []).map((p) => {
              const contract = contractById.get(p.contract_id);
              const tenant = contract?.tenant_id ? tenantById.get(contract.tenant_id) : undefined;
              return {
                payment_id: p.id,
                contract_number: contract?.contract_number ?? null,
                due_date: p.due_date,
                status: p.status,
                remaining: Math.max(0, Number(p.amount_due) - Number(p.amount_paid)),
                days_overdue: p.due_date < today ? Math.floor((Date.parse(today) - Date.parse(p.due_date)) / 86400000) : 0,
                tenant_name: tenant?.full_name ?? null,
                tenant_phone: tenant?.phone ?? null,
              };
            });

            await supabaseAdmin.from("automation_events").insert({
              event: "payments.due_listed",
              direction: "in",
              payload: { days, count: items.length } as never,
              status: "sent",
            });
            return json({ ok: true, count: items.length, items });
          }

          if (action === "process_reminders") {
            // يبحث عن متابعات مستحقة ويرسلها، ثم يحدّث موعد الإرسال التالي حسب التكرار.
            const now = new Date().toISOString();
            const { data: rows, error: fetchError } = await supabaseAdmin
              .from("reminder_followups")
              .select(
                "id, recipient_name, recipient_phone, message_body, repeat_interval, sent_count, last_sent_at, next_send_at, status",
              )
              .eq("status", "pending")
              .lte("next_send_at", now)
              .order("next_send_at", { ascending: true })
              .limit(100);
            if (fetchError) throw new Error(fetchError.message);

            const { twilioSend } = await import("@/lib/whatsapp.functions");
            let sent = 0;
            let failed = 0;

            for (const row of rows ?? []) {
              const result = await twilioSend({ to: row.recipient_phone, body: row.message_body });
              const next = calculateNextSend(row.repeat_interval);

              await supabaseAdmin.from("message_log").insert({
                recipient_name: row.recipient_name,
                recipient_phone: row.recipient_phone,
                body: row.message_body,
                channel: "whatsapp",
                result: result.ok ? "sent" : "failed",
                failure_reason: result.ok ? null : result.error,
                sent_by_system: true,
              });

              if (result.ok) {
                sent++;
                if (row.repeat_interval === "once" || !next) {
                  await supabaseAdmin
                    .from("reminder_followups")
                    .update({ status: "done", sent_count: (row.sent_count ?? 0) + 1, last_sent_at: now })
                    .eq("id", row.id);
                } else {
                  await supabaseAdmin
                    .from("reminder_followups")
                    .update({
                      sent_count: (row.sent_count ?? 0) + 1,
                      last_sent_at: now,
                      next_send_at: next,
                    })
                    .eq("id", row.id);
                }
              } else {
                failed++;
                await supabaseAdmin
                  .from("reminder_followups")
                  .update({ status: "failed", last_sent_at: now })
                  .eq("id", row.id);
              }
            }

            await supabaseAdmin.from("automation_events").insert({
              event: "reminders.processed",
              direction: "in",
              payload: { checked: (rows ?? []).length, sent, failed } as never,
              status: "sent",
            });

            return json({ ok: true, checked: (rows ?? []).length, sent, failed });
          }

          if (action === "task_followups") {
            // متابعة تلقائية للمهام غير المنجزة عبر واتساب حسب الأولوية:
            // عاجلة كل 12 ساعة، عالية كل 24 ساعة، عادية/منخفضة كل 3 أيام.
            const dryRun = body["dry_run"] === true;
            const { data: tasks, error: tErr } = await supabaseAdmin
              .from("tasks")
              .select("id, title, priority, status, due_date, due_time")
              .in("status", ["new", "in_progress", "rejected"])
              .limit(300);
            if (tErr) throw new Error(tErr.message);

            const taskIds = (tasks ?? []).map((t) => t.id);
            const { data: assignees } = taskIds.length
              ? await supabaseAdmin
                  .from("task_assignees")
                  .select("task_id, user_id")
                  .in("task_id", taskIds)
              : { data: [] };

            const userIds = Array.from(new Set((assignees ?? []).map((a) => a.user_id)));
            const { data: people } = userIds.length
              ? await supabaseAdmin
                  .from("profiles")
                  .select("id, full_name, phone, whatsapp, whatsapp_notify, is_active")
                  .in("id", userIds)
              : { data: [] };
            const personById = new Map((people ?? []).map((p) => [p.id, p]));

            const { data: pastLogs } = await supabaseAdmin
              .from("message_log")
              .select("idempotency_key, created_at, result")
              .like("idempotency_key", "task-fu:%")
              .order("created_at", { ascending: false })
              .limit(1000);
            const lastSentAt = new Map<string, number>();
            for (const log of pastLogs ?? []) {
              const key = (log.idempotency_key ?? "").split("#")[0];
              if (!key || lastSentAt.has(key)) continue;
              lastSentAt.set(key, Date.parse(log.created_at));
            }

            const hourMs = 3600000;
            const intervalFor = (priority: string | null) =>
              priority === "urgent" ? 12 * hourMs : priority === "high" ? 24 * hourMs : 72 * hourMs;
            const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));
            const now = Date.now();
            const { twilioSend } = await import("@/lib/whatsapp.functions");

            let sent = 0;
            let failed = 0;
            let skipped = 0;
            const due: { task: string; to: string }[] = [];

            for (const link of assignees ?? []) {
              const task = taskById.get(link.task_id);
              const person = personById.get(link.user_id);
              if (!task || !person || person.is_active === false) {
                skipped++;
                continue;
              }
              const phone = person.whatsapp || person.phone;
              if (!phone || person.whatsapp_notify === false) {
                skipped++;
                continue;
              }
              const key = `task-fu:${task.id}:${person.id}`;
              const last = lastSentAt.get(key);
              if (last && now - last < intervalFor(task.priority)) {
                skipped++;
                continue;
              }

              const priorityLabel =
                task.priority === "urgent"
                  ? "عاجلة"
                  : task.priority === "high"
                    ? "عالية"
                    : task.priority === "low"
                      ? "منخفضة"
                      : "متوسطة";
              const dueText = task.due_date
                ? ` — موعد التسليم: ${task.due_date}${task.due_time ? ` ${String(task.due_time).slice(0, 5)}` : ""}`
                : "";
              const text = `تذكير بمهمة (${priorityLabel}): ${task.title}${dueText}\nالمهمة ما زالت غير منجزة، برجاء المتابعة وتحديث حالتها في النظام.`;

              due.push({ task: task.title, to: phone });
              if (dryRun) continue;

              const result = await twilioSend({ to: phone, body: text });
              await supabaseAdmin.from("message_log").insert({
                recipient_name: person.full_name,
                recipient_phone: phone,
                body: text,
                channel: "whatsapp",
                result: result.ok ? "sent" : "failed",
                failure_reason: result.ok ? null : result.error,
                sent_by_system: true,
                idempotency_key: `${key}#${now}`,
              });
              if (result.ok) sent++;
              else failed++;
            }

            await supabaseAdmin.from("automation_events").insert({
              event: "tasks.followups_processed",
              direction: "in",
              payload: { open_tasks: (tasks ?? []).length, sent, failed, skipped, dry_run: dryRun } as never,
              status: "sent",
            });

            return json({
              ok: true,
              open_tasks: (tasks ?? []).length,
              sent,
              failed,
              skipped,
              ...(dryRun ? { would_send: due } : {}),
            });
          }

          if (action === "log") {
            await supabaseAdmin.from("automation_events").insert({
              event: String(body["event"] ?? "n8n.log"),
              direction: "in",
              payload: (body["data"] ?? {}) as never,
              status: "sent",
            });
            return json({ ok: true });
          }

          return json({ ok: false, error: `action غير معروف: ${action}` }, 400);
        } catch (e) {
          return json({ ok: false, error: (e as Error).message }, 500);
        }
      },
    },
  },
});

function calculateNextSend(interval: string | null): string | null {
  if (!interval || interval === "once") return null;
  const now = new Date();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  if (interval === "6h") return new Date(now.getTime() + 6 * hourMs).toISOString();
  if (interval === "8h") return new Date(now.getTime() + 8 * hourMs).toISOString();
  if (interval === "12h") return new Date(now.getTime() + 12 * hourMs).toISOString();
  if (interval === "24h" || interval === "daily") return new Date(now.getTime() + dayMs).toISOString();
  if (interval === "3d") return new Date(now.getTime() + 3 * dayMs).toISOString();
  if (interval === "weekly") return new Date(now.getTime() + 7 * dayMs).toISOString();
  if (interval === "biweekly") return new Date(now.getTime() + 14 * dayMs).toISOString();
  if (interval === "monthly") {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }
  return null;
}
