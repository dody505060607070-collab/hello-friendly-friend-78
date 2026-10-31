/**
 * تذكيرات مواعيد المعاينة (اجتماع المالك + الزائر + الوسيط) المرتبطة بالمهام.
 * لكل شخص رسالة خاصة به، وتتكرر كل meeting_interval_hours حتى موعد الاجتماع أو إنهاء المهمة.
 */
type MeetingTask = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  due_time: string | null;
  meeting_place: string | null;
  meeting_notes: string | null;
  meeting_owner_name: string | null;
  meeting_owner_phone: string | null;
  meeting_visitor_name: string | null;
  meeting_visitor_phone: string | null;
  meeting_agent_name: string | null;
  meeting_agent_phone: string | null;
  meeting_interval_hours: number;
  meeting_last_sent_at: string | null;
};

const COLS =
  "id, title, status, due_date, due_time, meeting_place, meeting_notes, meeting_owner_name, meeting_owner_phone, meeting_visitor_name, meeting_visitor_phone, meeting_agent_name, meeting_agent_phone, meeting_interval_hours, meeting_last_sent_at";

/** Meeting moment in Riyadh time (UTC+3), or null when no date set. */
export function meetingMoment(t: { due_date: string | null; due_time: string | null }): Date | null {
  if (!t.due_date) return null;
  const time = (t.due_time || "23:59").slice(0, 5);
  return new Date(`${t.due_date}T${time}:00+03:00`);
}

/** Hourly eligibility: active, before meeting, interval elapsed. */
export function isMeetingReminderDue(t: Pick<MeetingTask, "status" | "due_date" | "due_time" | "meeting_interval_hours" | "meeting_last_sent_at">, now = new Date()): boolean {
  if (t.status === "done" || t.status === "cancelled") return false;
  const at = meetingMoment(t);
  if (at && at.getTime() < now.getTime()) return false;
  if (!t.meeting_last_sent_at) return true;
  const hours = Math.max(1, t.meeting_interval_hours || 12);
  return now.getTime() - new Date(t.meeting_last_sent_at).getTime() >= hours * 3600_000 - 5 * 60_000;
}

function whenText(t: MeetingTask) {
  const parts = [t.due_date, t.due_time?.slice(0, 5)].filter(Boolean);
  return parts.length ? parts.join(" الساعة ") : "سيتم تأكيده";
}

export function buildMeetingMessages(t: MeetingTask) {
  const when = whenText(t);
  const place = t.meeting_place?.trim() || "سيتم إرساله لاحقًا";
  const notes = t.meeting_notes?.trim() ? `\n📝 ملاحظات: ${t.meeting_notes.trim()}` : "";
  const hello = (n: string | null) => `السلام عليكم${n?.trim() ? ` ${n.trim()}` : ""}،`;
  const out: { role: string; name: string | null; phone: string; body: string }[] = [];
  if (t.meeting_owner_phone?.trim())
    out.push({ role: "owner", name: t.meeting_owner_name, phone: t.meeting_owner_phone.trim(), body:
      `${hello(t.meeting_owner_name)}\nنذكّركم بموعد معاينة عقاركم مع أحد العملاء المهتمين.\n📅 الموعد: ${when}\n📍 المكان: ${place}${notes}\n\nمكتب مثراء العقارية` });
  if (t.meeting_visitor_phone?.trim())
    out.push({ role: "visitor", name: t.meeting_visitor_name, phone: t.meeting_visitor_phone.trim(), body:
      `${hello(t.meeting_visitor_name)}\nلا تنسَ موعدك لزيارة ومعاينة العقار.\n📅 الموعد: ${when}\n📍 المكان: ${place}${notes}\n\nمكتب مثراء العقارية` });
  if (t.meeting_agent_phone?.trim())
    out.push({ role: "agent", name: t.meeting_agent_name, phone: t.meeting_agent_phone.trim(), body:
      `${hello(t.meeting_agent_name)}\nلديك موعد معاينة: ${t.title}\n📅 الموعد: ${when}\n📍 المكان: ${place}\n👤 المالك: ${t.meeting_owner_name || "-"} ${t.meeting_owner_phone || ""}\n👤 الزائر: ${t.meeting_visitor_name || "-"} ${t.meeting_visitor_phone || ""}${notes}` });
  return out;
}

async function sendForTask(t: MeetingTask, sentBy: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { whatsappSend } = await import("@/lib/whatsapp.functions");
  let sent = 0;
  let failed = 0;
  for (const m of buildMeetingMessages(t)) {
    let ok = false;
    let reason: string | null = null;
    try {
      const r = await whatsappSend({ to: m.phone, body: m.body });
      ok = r.ok;
      if (!r.ok) reason = r.error;
    } catch (e) {
      reason = (e as Error).message;
    }
    ok ? sent++ : failed++;
    await supabaseAdmin.from("message_log").insert({
      kind: "meeting_reminder", recipient_name: m.name ?? m.role, recipient_phone: m.phone,
      body: m.body, channel: "whatsapp", result: ok ? "sent" : "failed", failure_reason: reason,
      sent_by: sentBy, sent_by_system: !sentBy,
    });
  }
  await supabaseAdmin.from("tasks").update({ meeting_last_sent_at: new Date().toISOString() }).eq("id", t.id);
  return { sent, failed };
}

export async function sendMeetingReminderForTask(taskId: string, sentBy: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("tasks").select(COLS).eq("id", taskId).eq("meeting_enabled", true).maybeSingle();
  if (!data) return { sent: 0, failed: 0 };
  return sendForTask(data as MeetingTask, sentBy);
}

export async function runMeetingReminders() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("tasks").select(COLS).eq("meeting_enabled", true).limit(200);
  let tasks = 0, sent = 0, failed = 0;
  for (const t of (data ?? []) as MeetingTask[]) {
    if (!isMeetingReminderDue(t)) continue;
    tasks++;
    const r = await sendForTask(t, null);
    sent += r.sent;
    failed += r.failed;
  }
  return { tasks, sent, failed };
}
