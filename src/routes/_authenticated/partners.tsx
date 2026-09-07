import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Handshake, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/partners")({
  head: () => ({
    meta: [
      { title: "الشركاء | مثراء العقارية" },
      { name: "description", content: "إدارة شعارات الشركاء وروابطهم وترتيب ظهورهم في الموقع." },
      { property: "og:title", content: "الشركاء | مثراء العقارية" },
      { property: "og:description", content: "إدارة شعارات الشركاء وروابطهم وترتيب ظهورهم في الموقع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

const empty = {
  name: "",
  logo_url: "",
  website_url: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

function PartnersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });

  const list = useQuery({
    queryKey: ["partners-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, logo_url, website_url, description, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["partners-admin"] });
    queryClient.invalidateQueries({ queryKey: ["partners"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("اكتب اسم الشريك");
      const payload = {
        name: form.name.trim(),
        logo_url: form.logo_url.trim() || null,
        website_url: form.website_url.trim() || null,
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      const res = editId
        ? await supabase.from("partners").update(payload).eq("id", editId)
        : await supabase.from("partners").insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success(editId ? "تم تحديث الشريك" : "تمت إضافة الشريك");
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
        .from("partners")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الشريك");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحذف"),
  });

  const startEdit = (row: Row) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      logo_url: row.logo_url ?? "",
      website_url: row.website_url ?? "",
      description: row.description ?? "",
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const rows = list.data ?? [];

  return (
    <>
      <PageHero
        title="الشركاء"
        subtitle="الشركاء الذين تظهر شعاراتهم في الموقع العام مع روابطهم."
        icon={Handshake}
        stats={[
          { label: "إجمالي الشركاء", value: String(rows.length) },
          { label: "ظاهرون", value: String(rows.filter((r) => r.is_active).length) },
        ]}
      />

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-foreground">قائمة الشركاء</h2>
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
            إضافة شريك
          </button>
        </div>

        <DataTable<Row>
          rows={rows}
          searchPlaceholder="بحث باسم الشريك"
          dragLabel="شريك"
          emptyState={
            <EmptyState
              text="لا يوجد شركاء مضافون"
              hint="اضغط «إضافة شريك» وأدخل اسمه ورابط شعاره."
            />
          }
          columns={[
            {
              header: "الشعار",
              cell: (r) =>
                r.logo_url ? (
                  <img src={r.logo_url} alt={r.name} className="h-8 w-auto object-contain" />
                ) : (
                  "—"
                ),
            },
            { header: "الشريك", cell: (r) => r.name, className: "font-semibold" },
            {
              header: "الرابط",
              cell: (r) =>
                r.website_url ? (
                  <a
                    href={r.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="text-primary hover:underline"
                  >
                    زيارة
                  </a>
                ) : (
                  "—"
                ),
            },
            { header: "الترتيب", cell: (r) => r.sort_order ?? 0, value: (r) => r.sort_order ?? 0 },
            {
              header: "الحالة",
              cell: (r) => (
                <button type="button" onClick={() => toggleActive.mutate(r)}>
                  <Chip tone={r.is_active ? "success" : "neutral"}>
                    {r.is_active ? "ظاهر" : "مخفي"}
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
                      if (confirm(`حذف الشريك «${r.name}»؟`)) remove.mutate(r.id);
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
        title={editId ? "تعديل شريك" : "إضافة شريك"}
        subtitle="الشعار يظهر في قسم «شركاؤنا» بالموقع العام."
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
          <Field label="اسم الشريك">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          <Field label="رابط الشعار">
            <input
              dir="ltr"
              className={inputClass}
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            />
          </Field>
          <Field label="رابط الشريك">
            <input
              dir="ltr"
              className={inputClass}
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="نبذة">
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
            ظاهر في الموقع
          </label>
        </div>
      </Modal>
    </>
  );
}
