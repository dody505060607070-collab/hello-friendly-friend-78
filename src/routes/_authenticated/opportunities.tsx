import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";
import { stageLabels } from "@/lib/labels";

type Row = {
  id: string;
  title: string;
  deal_type: string | null;
  stage: string;
  expected_value: number | null;
  next_follow_up: string | null;
  close_reason: string | null;
  contact_id: string | null;
  contact: { full_name: string } | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/opportunities")({
  head: () => ({
    meta: [
      { title: "الفرص | مثراء العقارية" },
      { name: "description", content: "متابعة فرص البيع والإيجار ومراحلها حتى الإغلاق." },
      { property: "og:title", content: "الفرص | مثراء العقارية" },
      { property: "og:description", content: "متابعة فرص البيع والإيجار ومراحلها حتى الإغلاق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpportunitiesPage,
});

const SELECT =
  "id, title, deal_type, stage, expected_value, next_follow_up, close_reason, contact_id, created_at, contact:contact_id(full_name)";

const stageOrder = ["new", "qualified", "viewing", "negotiation", "contract", "won", "lost"];

type FormState = {
  title: string;
  contact_id: string;
  deal_type: string;
  stage: string;
  expected_value: string;
  next_follow_up: string;
};

const emptyForm: FormState = {
  title: "",
  contact_id: "",
  deal_type: "rent",
  stage: "new",
  expected_value: "",
  next_follow_up: "",
};

function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("open");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading } = useTableRows<Row>({
    table: "opportunities",
    select: SELECT,
    orderBy: { column: "created_at" },
    queryKey: ["opportunities"],
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
      if (!form.title.trim()) throw new Error("عنوان الفرصة مطلوب");
      const { error } = await supabase.from("opportunities").insert({
        title: form.title.trim(),
        contact_id: form.contact_id || null,
        deal_type: form.deal_type,
        stage: form.stage,
        expected_value: form.expected_value ? Number(form.expected_value) : null,
        next_follow_up: form.next_follow_up || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم إنشاء الفرصة");
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const changeStage = useMutation({
    mutationFn: async (input: { id: string; stage: string }) => {
      const { error } = await supabase
        .from("opportunities")
        .update({ stage: input.stage })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("تم تحديث مرحلة الفرصة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("تم حذف الفرصة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const counts = useMemo(
    () => ({
      all: rows.length,
      open: rows.filter((r) => !["won", "lost"].includes(r.stage)).length,
      won: rows.filter((r) => r.stage === "won").length,
      lost: rows.filter((r) => r.stage === "lost").length,
      value: rows
        .filter((r) => !["won", "lost"].includes(r.stage))
        .reduce((sum, r) => sum + (r.expected_value ?? 0), 0),
    }),
    [rows],
  );

  const filtered =
    tab === "all"
      ? rows
      : tab === "open"
        ? rows.filter((r) => !["won", "lost"].includes(r.stage))
        : rows.filter((r) => r.stage === tab);

  return (
    <>
      <PageHero
        title="الفرص"
        subtitle="كل فرصة بيع أو إيجار ومرحلتها الحالية وقيمتها المتوقعة وموعد المتابعة."
        icon={Target}
        stats={[
          { value: String(counts.open), label: "فرصة مفتوحة" },
          { value: formatCurrency(counts.value), label: "القيمة المتوقعة" },
          { value: String(counts.won), label: "فرصة ناجحة" },
        ]}
      />

      <div className="surface-card px-5 py-4 text-[12.5px] leading-6 text-muted-foreground">
        <strong className="text-foreground">كيف تعمل الفرص؟</strong> الفرصة هي رحلة العميل من أول
        اهتمام حتى التعاقد، وتمر بمراحل: جديد ← مؤهل ← معاينة ← تفاوض ← تعاقد ← ناجحة أو خاسرة. حدّث
        المرحلة من القائمة داخل الجدول مباشرة، وسجّل كل تواصل في «المتابعات والأنشطة» حتى تعرف سبب
        تعطّل أي فرصة.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" />
          إضافة فرصة
        </button>
      </div>

      <Pills
        variant="card"
        defaultKey="open"
        onChange={setTab}
        items={[
          { key: "open", label: "المفتوحة", count: counts.open },
          { key: "all", label: "الكل", count: counts.all },
          { key: "won", label: "ناجحة", count: counts.won },
          { key: "lost", label: "خاسرة", count: counts.lost },
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
          dragLabel="فرصة"
          showColumnsButton
          searchPlaceholder="بحث بعنوان الفرصة أو العميل"
          emptyState={
            <EmptyState
              text="لا توجد فرص"
              hint="أنشئ فرصة من عميل موجود لتتابع رحلته حتى التعاقد."
            />
          }
          columns={[
            {
              header: "الفرصة",
              sortable: true,
              value: (r) => r.title,
              cell: (r) => r.title,
              className: "font-semibold",
            },
            { header: "العميل", cell: (r) => r.contact?.full_name ?? "—" },
            { header: "النوع", cell: (r) => (r.deal_type === "sale" ? "بيع" : "إيجار") },
            {
              header: "المرحلة",
              cell: (r) => (
                <select
                  value={r.stage}
                  disabled={changeStage.isPending}
                  onChange={(e) => changeStage.mutate({ id: r.id, stage: e.target.value })}
                  className="h-9 rounded-lg border border-border bg-card px-2 text-[12.5px] font-semibold"
                >
                  {stageOrder.map((stage) => (
                    <option key={stage} value={stage}>
                      {stageLabels[stage] ?? stage}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              header: "القيمة المتوقعة",
              sortable: true,
              value: (r) => r.expected_value ?? 0,
              cell: (r) => formatCurrency(r.expected_value),
            },
            {
              header: "المتابعة القادمة",
              sortable: true,
              value: (r) => r.next_follow_up ?? "",
              cell: (r) => formatDate(r.next_follow_up),
            },
            {
              header: "الحالة",
              cell: (r) => (
                <Chip tone={r.stage === "won" ? "success" : r.stage === "lost" ? "danger" : "primary"}>
                  {stageLabels[r.stage] ?? r.stage}
                </Chip>
              ),
            },
            {
              header: "أُنشئت",
              sortable: true,
              value: (r) => r.created_at,
              cell: (r) => formatDate(r.created_at),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف الفرصة "${r.title}"؟`)) remove.mutate(r.id);
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
        title="إضافة فرصة جديدة"
        subtitle="اربط الفرصة بعميل، وحدّد نوع الصفقة وقيمتها المتوقعة."
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
          <Field label="عنوان الفرصة">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="مثال: مستأجر يبحث عن شقة في الرحاب"
            />
          </Field>
          <Field label="العميل">
            <select
              className={inputClass}
              value={form.contact_id}
              onChange={(e) => set({ contact_id: e.target.value })}
            >
              <option value="">— بدون —</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع الصفقة">
            <select
              className={inputClass}
              value={form.deal_type}
              onChange={(e) => set({ deal_type: e.target.value })}
            >
              <option value="rent">إيجار</option>
              <option value="sale">بيع</option>
            </select>
          </Field>
          <Field label="المرحلة">
            <select
              className={inputClass}
              value={form.stage}
              onChange={(e) => set({ stage: e.target.value })}
            >
              {stageOrder.map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabels[stage] ?? stage}
                </option>
              ))}
            </select>
          </Field>
          <Field label="القيمة المتوقعة">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.expected_value}
              onChange={(e) => set({ expected_value: e.target.value })}
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
