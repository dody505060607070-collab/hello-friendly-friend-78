import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState } from "@/components/kit/LiveTable";
import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  sort_order: number | null;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "الخدمات | مثراء العقارية" },
      { name: "description", content: "إضافة وتعديل الخدمات المعروضة للزوار في الموقع العام." },
      { property: "og:title", content: "الخدمات | مثراء العقارية" },
      { property: "og:description", content: "إضافة وتعديل الخدمات المعروضة للزوار في الموقع العام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicesPage,
});

const empty = {
  title: "",
  description: "",
  icon: "",
  image_url: "",
  sort_order: 0,
  is_active: true,
};

function ServicesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });

  const list = useQuery({
    queryKey: ["services-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, title, description, icon, image_url, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["services-admin"] });
    queryClient.invalidateQueries({ queryKey: ["services"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("اكتب عنوان الخدمة");
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        icon: form.icon.trim() || null,
        image_url: form.image_url.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      const res = editId
        ? await supabase.from("services").update(payload).eq("id", editId)
        : await supabase.from("services").insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success(editId ? "تم تحديث الخدمة" : "تمت إضافة الخدمة");
      setOpen(false);
      setEditId(null);
      setForm({ ...empty });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });

  const toggleActive = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الخدمة");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحذف"),
  });

  const startEdit = (row: Row) => {
    setEditId(row.id);
    setForm({
      title: row.title,
      description: row.description ?? "",
      icon: row.icon ?? "",
      image_url: row.image_url ?? "",
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const rows = list.data ?? [];

  return (
    <>
      <PageHero
        title="الخدمات"
        subtitle="كل خدمة تُضيفها هنا تظهر مباشرة للزوار في الموقع العام."
        icon={Sparkles}
        stats={[
          { label: "إجمالي الخدمات", value: String(rows.length) },
          { label: "معروضة للزوار", value: String(rows.filter((r) => r.is_active).length) },
        ]}
      />

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-foreground">قائمة الخدمات</h2>
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setForm({ ...empty, sort_order: rows.length + 1 });
              setOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" />
            إضافة خدمة
          </button>
        </div>

        <DataTable<Row>
          rows={rows}
          searchPlaceholder="بحث بالخدمة"
          dragLabel="خدمة"
          emptyState={
            <EmptyState
              text="لا توجد خدمات مضافة"
              hint="اضغط «إضافة خدمة» لتظهر في صفحة الخدمات بالموقع."
            />
          }
          columns={[
            { header: "الخدمة", cell: (r) => r.title, className: "font-semibold" },
            { header: "الوصف", cell: (r) => r.description ?? "—" },
            { header: "الترتيب", cell: (r) => r.sort_order ?? 0, value: (r) => r.sort_order ?? 0 },
            {
              header: "الحالة",
              cell: (r) => (
                <button type="button" onClick={() => toggleActive.mutate(r)}>
                  <Chip tone={r.is_active ? "success" : "neutral"}>
                    {r.is_active ? "معروضة" : "مخفية"}
                  </Chip>
                </button>
              ),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEdit(r)} aria-label="تعديل">
                    <Pencil className="size-4 text-muted-foreground hover:text-primary" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`حذف الخدمة «${r.title}»؟`)) remove.mutate(r.id);
                    }}
                    aria-label="حذف"
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "تعديل خدمة" : "إضافة خدمة"}
        subtitle="تظهر الخدمة في الموقع العام بعد الحفظ."
        footer={
          <>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              حفظ
            </PrimaryButton>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="عنوان الخدمة">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="الترتيب">
            <input
              type="number"
              className={inputClass}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </Field>
          <Field label="رابط صورة (اختياري)">
            <input
              dir="ltr"
              className={inputClass}
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </Field>
          <Field label="أيقونة (اختياري)">
            <input
              dir="ltr"
              className={inputClass}
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="الوصف">
              <textarea
                className={textareaClass}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            معروضة في الموقع
          </label>
        </div>
      </Modal>
    </>
  );
}
