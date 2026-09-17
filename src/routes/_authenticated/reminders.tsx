import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Loader2, MessageSquare, RefreshCw, Send, StopCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { Field, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { ToneLegend } from "@/components/kit/ToneLegend";
import { supabase } from "@/integrations/supabase/client";
import { followupStatusLabels } from "@/lib/labels";
import { followupRowTone, messageLogRowTone, rowToneClass } from "@/lib/row-tone";
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
  payment_id: string | null;
  contract: { contract_number: string | null } | null;
  payment: { id: string; amount_due: number; amount_paid: number; status: string } | null;
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

const moduleOptions = [
  { key: "all", label: "كل المهام" },
  { key: "contract", label: "العقود" },
  { key: "finance", label: "المالية" },
  { key: "operations", label: "التشغيل" },
  { key: "marketing", label: "التسويق" },
  { key: "general", label: "عام" },
];

function RemindersPage() {
  const queryClient = useQueryClient();
  const [contactId] = useState("");
  const [body, setBody] = useState("");
  const [repeat, setRepeat] = useState("once");

  const followups = useTableRows<FollowupRow>({
    table: "reminder_followups",
    select:
      "id, recipient_name, recipient_phone, message_body, repeat_interval, sent_count, last_sent_at, next_send_at, status, payment_id, contract:contract_id(contract_number), payment:payment_id(id, amount_due, amount_paid, status)",
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

  const payments = useQuery({
    queryKey: ["contract-payments", "reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments")
        .select(
          "id, contract_id, due_date, amount_due, amount_paid, status, payment_number, contract:contract_id(id, contract_number, tenant_id, tenant:tenant_id(id, full_name, phone, whatsapp))",
        )
        .in("status", ["pending", "partial", "overdue"])
        .order("due_date", { ascending: true })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [paymentId, setPaymentId] = useState("");
  const selectedPayment = (payments.data ?? []).find((p) => p.id === paymentId);
  const tenant = selectedPayment?.contract?.tenant ?? null;
  const selectedContact = (contacts.data ?? []).find((c) => c.id === contactId) ?? tenant;
  const phone = tenant?.whatsapp ?? tenant?.phone ?? selectedContact?.whatsapp ?? selectedContact?.phone ?? "";
  const contractId = selectedPayment?.contract_id ?? "";

  const schedule = useMutation({
    mutationFn: async () => {
      if (!selectedPayment) throw new Error("اختر الدفعة أولًا — كل تذكير يجب أن يرتبط بدفعة");
      if (!phone) throw new Error("لا يوجد رقم جوال محفوظ للمستأجر");
      if (!body.trim()) throw new Error("نص الرسالة مطلوب");

      // إرسال يدوي فوري عبر مزوّد واتساب المرتبط بالـQR — بلا أي بث
      const { sendWhatsAppMessage } = await import("@/lib/whatsapp.functions");
      const result = await sendWhatsAppMessage({ data: { to: phone, body: body.trim() } });
      if (!result.ok) throw new Error(result.error);

      const next = new Date();
      if (repeat === "daily") next.setDate(next.getDate() + 1);
      if (repeat === "weekly") next.setDate(next.getDate() + 7);
      if (repeat === "biweekly") next.setDate(next.getDate() + 14);
      if (repeat === "monthly") next.setMonth(next.getMonth() + 1);

      const recipientName = tenant?.full_name ?? "مستأجر";
      const { error } = await supabase.from("reminder_followups").insert({
        recipient_contact_id: tenant?.id ?? null,
        recipient_name: recipientName,
        recipient_phone: phone,
        contract_id: contractId || null,
        payment_id: selectedPayment.id,
        message_body: body.trim(),
        repeat_interval: repeat,
        status: repeat === "once" ? "done" : "pending",
        next_send_at: repeat === "once" ? null : next.toISOString(),
      });
      if (error) throw error;

      const { error: logError } = await supabase.from("message_log").insert({
        recipient_name: recipientName,
        recipient_phone: phone,
        contract_id: contractId || null,
        body: body.trim(),
        channel: "whatsapp",
        result: "sent",
        sent_by_system: false,
      });
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_followups"] });
      queryClient.invalidateQueries({ queryKey: ["message_log"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم إرسال التذكير وتسجيله في سجل التواصل");
      setBody("");
      setPaymentId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const markPaid = useMutation({
    mutationFn: async (row: FollowupRow) => {
      if (!row.payment_id || !row.payment) throw new Error("لا توجد دفعة مرتبطة بهذا التذكير");
      const { error: payErr } = await supabase
        .from("contract_payments")
        .update({ status: "paid", amount_paid: row.payment.amount_due })
        .eq("id", row.payment_id);
      if (payErr) throw payErr;
      const { error: remErr } = await supabase
        .from("reminder_followups")
        .update({ status: "stopped", next_send_at: null })
        .eq("id", row.id);
      if (remErr) throw remErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_followups"] });
      queryClient.invalidateQueries({ queryKey: ["contract-payments", "reminders"] });
      queryClient.invalidateQueries({ queryKey: ["contract_payments"] });
      toast.success("تم تسجيل الدفعة كمدفوعة وإيقاف التذكير");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
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

      <ToneLegend
        tones={["overdue", "today", "urgent", "progress", "done"]}
        labels={{
          overdue: "متأخر / فشل الإرسال",
          today: "الإرسال اليوم",
          urgent: "خلال يومين",
          progress: "مجدول لاحقًا",
          done: "تم الإرسال",
        }}
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
          <Field label="المستأجر (تلقائي من الدفعة)">
            <input className={inputClass} value={tenant?.full_name ?? ""} disabled placeholder="اختر الدفعة أولًا" />
          </Field>
          <Field label="الإرسال عن طريق">
            <select className={inputClass} defaultValue="whatsapp">
              <option value="whatsapp">واتساب</option>
            </select>
          </Field>
          <Field label="الدفعة المستحقة (إلزامي)">
            <select
              className={inputClass}
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
            >
              <option value="">اختر الدفعة أولًا</option>
              {(payments.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.contract?.contract_number ?? p.contract_id.slice(0, 8))} — دفعة {p.payment_number} —{" "}
                  {p.due_date} — متبقي {Math.max(0, Number(p.amount_due) - Number(p.amount_paid))}
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
          rowClassName={(r) => rowToneClass[followupRowTone(r)]}
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
                  {r.payment_id && r.status !== "stopped" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("تأكيد استلام السداد وإيقاف التذكير؟")) markPaid.mutate(r);
                      }}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-600"
                    >
                      تم الدفع
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
          rowClassName={(r) => rowToneClass[messageLogRowTone(r)]}
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
