import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, PhoneCall, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  activity_type: string;
  subject: string | null;
  outcome: string | null;
  happened_at: string | null;
  next_follow_up: string | null;
  contact_id: string | null;
  contact: { full_name: string } | null;
};

const typeLabels: Record<string, string> = {
  call: "مكالمة",
  whatsapp: "واتساب",
  meeting: "اجتماع",
  visit: "معاينة",
  note: "ملاحظة",
  email: "بريد",
};

export const Route = createFileRoute("/_authenticated/activities")({
  head: () => ({
    meta: [
      { title: "المتابعات والأنشطة | مثراء العقارية" },
      { name: "description", content: "سجل المكالمات والمعاينات والمتابعات مع العملاء." },
      { property: "og:title", content: "المتابعات والأنشطة | مثراء العقارية" },
      { property: "og:description", content: "سجل المكالمات والمعاينات والمتابعات مع العملاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivitiesPage,
});

const SELECT =
  "id, activity_type, subject, outcome, happened_at, next_follow_up, contact_id, contact:contact_id(full_name)";

type FormState = {
  contact_id: string;
  activity_type: string;
  subject: string;
  outcome: string;
  happened_at: string;
  next_follow_up: string;
};

const emptyForm: FormState = {
  contact_id: "",
  activity_type: "call",
  subject: "",
  outcome: "",
  happened_at: new Date().toISOString().slice(0, 16),
  next_follow_up: "",
};

function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading } = useTableRows<Row>({
    table: "crm_activities",
    select: SELECT,
    orderBy: { column: "happened_at" },
    queryKey: ["crm-activities"],
  });

  const contacts = useQuery({
    queryKey: ["contacts", "select"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .order("full_name")
        .limit(300);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const rows = data ?? [];
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.contact_id) throw new Error("اختر العميل");
      const { error } = await supabase.from("crm_activities").insert({
        contact_id: form.contact_id,
        activity_type: form.activity_type,
        subject: form.subject.trim() || null,
        outcome: form.outcome.trim() || null,
        happened_at: form.happened_at ? new Date(form.happened_at).toISOString() : new Date().toISOString(),
        next_follow_up: form.next_follow_up || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
      toast.success("تم تسجيل النشاط");
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
      toast.success("تم حذف النشاط");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const today = new Date().toISOString().slice(0, 10);
  const counts = useMemo(
    () => ({
      all: rows.length,
      due: rows.filter((r) => r.next_follow_up && r.next_follow_up <= today).length,
      calls: rows.filter((r) => r.activity_type === "call").length,
      visits: rows.filter((r) => r.activity_type === "visit").length,
    }),
    [rows, today],
  );

  const filtered =
    tab === "all"
      ? rows
      : tab === "due"
        ? rows.filter((r) => r.next_follow_up && r.next_follow_up <= today)
        : rows.filter((r) => r.activity_type === tab);

  return (
    <>
      <PageHero
        title="المتابعات والأنشطة"
        subtitle="كل تواصل مسجّل مع العملاء — ومنه يُحدَّد موعد المتابعة القادمة حتى لا يضيع أي عميل."
        icon={PhoneCall}
        stats={[
          { value: String(counts.all), label: "نشاط مسجّل" },
          { value: String(counts.due), label: "متابعة مستحقة" },
          { value: String(counts.calls), label: "مكالمة" },
        ]}
      />

      <div className="surface-card px-5 py-4 text-[12.5px] leading-6 text-muted-foreground">
        <strong className="text-foreground">كيف يعمل هذا القسم؟</strong> بعد كل مكالمة أو زيارة، سجّل
        نشاطًا: نوعه، موضوعه، ونتيجته، ثم حدّد «المتابعة القادمة». الأنشطة المستحقة تظهر في تبويب
        «متابعات مستحقة» ليبدأ الفريق يومه منها، وكل نشاط يبقى مرتبطًا بملف العميل وفرصته.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" />
          تسجيل نشاط
        </button>
      </div>

      <Pills
        variant="card"
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: counts.all },
          { key: "due", label: "متابعات مستحقة", count: counts.due },
          { key: "call", label: "مكالمات", count: counts.calls },
          { key: "visit", label: "معاينات", count: counts.visits },
        ]}
      />

      {isLoading ? (
        <div className="surface-card grid place-items-center px-6 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable<Row>
          rows={filtered}
          draggableRows
          dragLabel="نشاط"
          showColumnsButton
          searchPlaceholder="بحث بالعميل أو الموضوع"
          rowClassName={(r) =>
            r.next_follow_up && r.next_follow_up <= today ? "bg-destructive/5" : undefined
          }
          emptyState={
            <EmptyState
              text="لا توجد أنشطة مسجلة"
              hint="سجّل مكالمة أو معاينة مع عميل ليظهر النشاط هنا."
            />
          }
          columns={[
            {
              header: "العميل",
              sortable: true,
              value: (r) => r.contact?.full_name ?? "",
              cell: (r) => r.contact?.full_name ?? "—",
              className: "font-semibold",
            },
            {
              header: "النوع",
              cell: (r) => <Chip tone="primary">{typeLabels[r.activity_type] ?? r.activity_type}</Chip>,
            },
            { header: "الموضوع", cell: (r) => r.subject ?? "—" },
            { header: "النتيجة", cell: (r) => r.outcome ?? "—" },
            {
              header: "التاريخ",
              sortable: true,
              value: (r) => r.happened_at ?? "",
              cell: (r) => formatDate(r.happened_at),
            },
            {
              header: "المتابعة القادمة",
              sortable: true,
              value: (r) => r.next_follow_up ?? "",
              cell: (r) =>
                r.next_follow_up ? (
                  <Chip tone={r.next_follow_up <= today ? "danger" : "success"}>
                    {formatDate(r.next_follow_up)}
                  </Chip>
                ) : (
                  "—"
                ),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("حذف هذا النشاط؟")) remove.mutate(r.id);
                  }}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                >
                  <Trash2 className="size-4" />
                  حذف
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="تسجيل نشاط جديد"
        subtitle="سجّل ما حدث مع العميل، وحدّد موعد المتابعة القادمة."
        footer={
          <>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              حفظ
            </PrimaryButton>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="العميل">
            <select
              className={inputClass}
              value={form.contact_id}
              onChange={(e) => set({ contact_id: e.target.value })}
            >
              <option value="">— اختر العميل —</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع النشاط">
            <select
              className={inputClass}
              value={form.activity_type}
              onChange={(e) => set({ activity_type: e.target.value })}
            >
              {Object.entries(typeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الموضوع">
            <input
              className={inputClass}
              value={form.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="مثال: عرض شقة حي الرحاب"
            />
          </Field>
          <Field label="النتيجة">
            <textarea
              className={textareaClass}
              value={form.outcome}
              onChange={(e) => set({ outcome: e.target.value })}
              placeholder="ما خرجت به من التواصل"
            />
          </Field>
          <Field label="تاريخ ووقت النشاط">
            <input
              type="datetime-local"
              className={inputClass}
              dir="ltr"
              value={form.happened_at}
              onChange={(e) => set({ happened_at: e.target.value })}
            />
          </Field>
          <Field label="المتابعة القادمة">
            <input
              type="date"
              className={inputClass}
              dir="ltr"
              value={form.next_follow_up}
              onChange={(e) => set({ next_follow_up: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
