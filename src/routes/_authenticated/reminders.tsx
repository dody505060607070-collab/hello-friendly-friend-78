import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Loader2, MessageSquare, Send, StopCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { Field, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { followupStatusLabels } from "@/lib/labels";
import { whatsappLink } from "@/lib/site-data";

type FollowupRow = {
  id: string;
  recipient_name: string | null;
  recipient_phone: string;
  message_body: string;
  repeat_interval: string | null;
  sent_count: number | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  status: string;
  contract: { contract_number: string | null } | null;
};

type LogRow = {
  id: string;
  recipient_name: string | null;
  recipient_phone: string;
  body: string;
  channel: string;
  result: string;
  failure_reason: string | null;
  sent_by_system: boolean | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "إدارة التذكيرات | مثراء العقارية" },
      {
        name: "description",
        content: "إرسال ومتابعة تذكيرات الدفعات الإيجارية من شاشة واحدة مع سجل التواصل الكامل.",
      },
      { property: "og:title", content: "إدارة التذكيرات | مثراء العقارية" },
      { property: "og:description", content: "تذكيرات السداد والمتابعات المجدولة وحالة الإرسال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RemindersPage,
});

const repeatOptions = [
  { key: "once", label: "مرة واحدة" },
  { key: "daily", label: "كل يوم" },
  { key: "weekly", label: "كل أسبوع" },
  { key: "biweekly", label: "كل أسبوعين" },
  { key: "monthly", label: "كل شهر" },
];

function RemindersPage() {
  const queryClient = useQueryClient();
  const [contactId, setContactId] = useState("");
  const [contractId, setContractId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");
  const [repeat, setRepeat] = useState("once");

  const followups = useTableRows<FollowupRow>({
    table: "reminder_followups",
    select:
      "id, recipient_name, recipient_phone, message_body, repeat_interval, sent_count, last_sent_at, next_send_at, status, contract:contract_id(contract_number)",
    orderBy: { column: "next_send_at", ascending: true },
    queryKey: ["reminder_followups"],
  });

  const log = useTableRows<LogRow>({
    table: "message_log",
    select:
      "id, recipient_name, recipient_phone, body, channel, result, failure_reason, sent_by_system, created_at",
    orderBy: { column: "created_at" },
    queryKey: ["message_log"],
  });

  const contacts = useQuery({
    queryKey: ["contacts", "reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name, phone, whatsapp")
        .order("full_name")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const contracts = useQuery({
    queryKey: ["contracts", "reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, contract_number")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const templates = useQuery({
    queryKey: ["message_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, name, body")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedContact = (contacts.data ?? []).find((c) => c.id === contactId);
  const phone = selectedContact?.whatsapp ?? selectedContact?.phone ?? "";

  const schedule = useMutation({
    mutationFn: async () => {
      if (!selectedContact) throw new Error("اختر المستلم أولًا");
      if (!phone) throw new Error("لا يوجد رقم جوال محفوظ لهذا المستلم");
      if (!body.trim()) throw new Error("نص الرسالة مطلوب");

      const next = new Date();
      if (repeat === "daily") next.setDate(next.getDate() + 1);
      if (repeat === "weekly") next.setDate(next.getDate() + 7);
      if (repeat === "biweekly") next.setDate(next.getDate() + 14);
      if (repeat === "monthly") next.setMonth(next.getMonth() + 1);

      const { error } = await supabase.from("reminder_followups").insert({
        recipient_contact_id: selectedContact.id,
        recipient_name: selectedContact.full_name,
        recipient_phone: phone,
        contract_id: contractId || null,
        template_id: templateId || null,
        message_body: body.trim(),
        repeat_interval: repeat,
        status: "pending",
        next_send_at: repeat === "once" ? new Date().toISOString() : next.toISOString(),
      });
      if (error) throw error;

      const { error: logError } = await supabase.from("message_log").insert({
        recipient_name: selectedContact.full_name,
        recipient_phone: phone,
        contract_id: contractId || null,
        body: body.trim(),
        channel: "whatsapp",
        result: "queued",
        sent_by_system: false,
      });
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_followups"] });
      queryClient.invalidateQueries({ queryKey: ["message_log"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم جدولة التذكير وتسجيله في سجل التواصل");
      if (phone) window.open(whatsappLink(phone, body.trim()), "_blank", "noopener");
      setBody("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const stop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminder_followups")
        .update({ status: "stopped" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_followups"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم إيقاف التذكير");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الإيقاف"),
  });

  const rows = followups.data ?? [];
  const stats = useMemo(
    () => ({
      scheduled: rows.filter((r) => r.status === "pending").length,
      active: rows.filter((r) => r.status !== "stopped" && r.status !== "done").length,
      messages: (log.data ?? []).length,
    }),
    [rows, log.data],
  );

  return (
    <>
      <PageHero
        title="إدارة التذكيرات"
        subtitle="إرسال ومتابعة تذكيرات الدفعات الإيجارية من شاشة واحدة."
        icon={BellRing}
        stats={[
          { value: String(stats.scheduled), label: "تذكير مجدول" },
          { value: String(stats.active), label: "متابعة نشطة" },
          { value: String(stats.messages), label: "رسالة في السجل" },
        ]}
      />

      <section className="surface-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Send className="size-4 text-primary" />
          <div>
            <h2 className="text-[14px] font-bold text-foreground">إرسال تذكير</h2>
            <p className="text-[12px] text-muted-foreground">
              حدّد المستلم والدفعة، ثم اختر مرة واحدة أو تكرارًا حتى يستجيب.
            </p>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="المستلم">
            <select
              className={inputClass}
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">اختر المستلم أولًا</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الإرسال عن طريق">
            <select className={inputClass} defaultValue="whatsapp">
              <option value="whatsapp">واتساب</option>
            </select>
          </Field>
          <Field label="العقد / الدفعة">
            <select
              className={inputClass}
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            >
              <option value="">— بدون —</option>
              {(contracts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_number ?? c.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="قالب الرسالة">
            <select
              className={inputClass}
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                const t = (templates.data ?? []).find((x) => x.id === e.target.value);
                if (t) setBody(fillTemplate(t.body));
              }}
            >
              <option value="">تخصيص نص الرسالة</option>
              {(templates.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:col-span-2 lg:col-span-4 lg:grid-cols-2">
            <Field label="نص الرسالة (قابل للتخصيص)">
              <textarea
                className={textareaClass}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="مثال: تحية طيبة، نود تذكيركم بموعد سداد دفعة الإيجار."
              />
            </Field>
            <Field label="معاينة الرسالة كما تصل للعميل">
              <div className="min-h-[120px] rounded-xl bg-[#ece5dd] p-3">
                <div className="ms-auto max-w-[92%] whitespace-pre-wrap rounded-xl bg-[#dcf8c6] p-3 text-[13px] leading-6 text-[#111b21] shadow-sm">
                  {body.trim() || "اكتب نص الرسالة أو اختر قالبًا جاهزًا لتظهر المعاينة هنا."}
                </div>
              </div>
            </Field>
          </div>


          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
            <span className="text-[12.5px] font-semibold text-foreground">التكرار</span>
            {repeatOptions.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setRepeat(o.key)}
                className={
                  repeat === o.key
                    ? "rounded-lg border border-primary/30 bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-primary"
                    : "rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted"
                }
              >
                {o.label}
              </button>
            ))}
            <span className="ms-auto">
              <PrimaryButton onClick={() => schedule.mutate()} disabled={schedule.isPending}>
                {schedule.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                إرسال التذكير
              </PrimaryButton>
            </span>
          </div>

          {phone ? (
            <p className="text-[12px] text-muted-foreground sm:col-span-2 lg:col-span-4">
              سيُرسل إلى <span dir="ltr">{phone}</span> ويُسجَّل في سجل التواصل بالأسفل.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-primary" />
          <h2 className="text-[14px] font-bold text-foreground">المتابعات النشطة</h2>
        </div>
        <DataTable<FollowupRow>
          rows={rows}
          draggableRows
          dragLabel="تذكير"
          searchPlaceholder="بحث بالمستلم أو رقم العقد"
          emptyState={
            <EmptyState
              text="لا توجد تذكيرات مجدولة"
              hint="استخدم نموذج «إرسال تذكير» بالأعلى لإنشاء متابعة جديدة."
            />
          }
          columns={[
            { header: "المستلم", sortable: true, cell: (r) => r.recipient_name ?? "—", className: "font-semibold" },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.recipient_phone}</span> },
            { header: "العقد", cell: (r) => r.contract?.contract_number ?? "—" },
            {
              header: "التكرار",
              cell: (r) =>
                repeatOptions.find((o) => o.key === r.repeat_interval)?.label ??
                r.repeat_interval ??
                "مرة واحدة",
            },
            { header: "عدد الإرسالات", cell: (r) => r.sent_count ?? 0 },
            { header: "آخر إرسال", cell: (r) => formatDate(r.last_sent_at) },
            {
              header: "الإرسال القادم",
              sortable: true,
              value: (r) => r.next_send_at ?? "",
              cell: (r) => formatDate(r.next_send_at),
            },
            {
              header: "الحالة",
              cell: (r) => (
                <Chip
                  tone={
                    r.status === "sent"
                      ? "success"
                      : r.status === "failed"
                        ? "danger"
                        : r.status === "pending"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {followupStatusLabels[r.status] ?? r.status}
                </Chip>
              ),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <span className="inline-flex items-center gap-3">
                  <a
                    href={whatsappLink(r.recipient_phone, r.message_body)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <Send className="size-4" />
                    إرسال الآن
                  </a>
                  {r.status !== "stopped" ? (
                    <button
                      type="button"
                      onClick={() => stop.mutate(r.id)}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                    >
                      <StopCircle className="size-4" />
                      إيقاف
                    </button>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="text-[14px] font-bold text-foreground">سجل التواصل</h2>
        </div>
        <DataTable<LogRow>
          rows={log.data ?? []}
          searchPlaceholder="بحث في سجل الرسائل"
          emptyState={
            <EmptyState
              text="لا توجد رسائل بعد"
              hint="كل تذكير يُرسل يُسجَّل هنا مع نتيجة الإرسال."
            />
          }
          columns={[
            { header: "المستلم", cell: (r) => r.recipient_name ?? "—", className: "font-semibold" },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.recipient_phone}</span> },
            { header: "الرسالة", cell: (r) => r.body.slice(0, 60) },
            {
              header: "النتيجة",
              cell: (r) => (
                <Chip
                  tone={r.result === "sent" ? "success" : r.result === "failed" ? "danger" : "warning"}
                >
                  {r.result === "sent" ? "تم الإرسال" : r.result === "failed" ? "تعذّر الإرسال" : "في الانتظار"}
                </Chip>
              ),
            },
            { header: "بواسطة", cell: (r) => (r.sent_by_system ? "النظام" : "الفريق") },
            {
              header: "وقت الإرسال",
              sortable: true,
              value: (r) => r.created_at,
              cell: (r) => formatDate(r.created_at),
            },
          ]}
        />
      </section>
    </>
  );
}
