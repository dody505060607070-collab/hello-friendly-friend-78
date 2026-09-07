import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Loader2, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/owner-form")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "إضافة مالك | مثراء العقارية" },
      {
        name: "description",
        content: "نموذج إضافة وتعديل بيانات المالك: البيانات الأساسية، بيانات التواصل والإعدادات.",
      },
      { property: "og:title", content: "إضافة مالك | مثراء العقارية" },
      { property: "og:description", content: "نموذج كامل لبيانات المالك وتواصله وإعداداته." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerFormPage,
});

const ownerTypes: [string, string][] = [
  ["owner", "مالك"],
  ["agent", "وكيل مالك"],
  ["company", "شركة / مؤسسة"],
];

const idTypes: [string, string][] = [
  ["national", "هوية وطنية"],
  ["iqama", "إقامة"],
  ["commercial", "سجل تجاري"],
  ["passport", "جواز سفر"],
];

const emptyForm = {
  owner_type: "owner",
  full_name: "",
  id_type: "",
  national_id: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
  whatsapp_notify: true,
};

type FormState = typeof emptyForm;

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <header className="border-b border-border/70 px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      </header>
      <div className="grid gap-5 px-5 py-5 sm:px-6 md:grid-cols-2">{children}</div>
    </section>
  );
}

function OwnerFormPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);

  const existing = useQuery({
    queryKey: ["owner-form", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const row = existing.data;
    if (!row) return;
    setForm({
      owner_type: "owner",
      full_name: row.full_name ?? "",
      id_type: "",
      national_id: row.national_id ?? "",
      phone: row.phone ?? "",
      whatsapp: row.whatsapp ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      notes: row.notes ?? "",
      is_active: row.is_active ?? true,
      whatsapp_notify: true,
    });
  }, [existing.data]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    mutationFn: async (again: boolean) => {
      if (!form.full_name.trim()) throw new Error("الاسم الكامل مطلوب");
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        whatsapp: (form.whatsapp.trim() || form.phone.trim()) || null,
        email: form.email.trim() || null,
        national_id: form.national_id.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
        roles: ["owner"],
      };
      if (id) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
      return again;
    },
    onSuccess: (again) => {
      void queryClient.invalidateQueries({ queryKey: ["owners"] });
      toast.success(id ? "تم تحديث بيانات المالك" : "تمت إضافة المالك");
      if (again) {
        setForm(emptyForm);
        return;
      }
      void navigate({ to: "/owners" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <PageHero
        title="الملاك"
        subtitle="إدارة بيانات الملاك وعقاراتهم وعقودهم الإيجارية."
        icon={Users}
      />

      <nav className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Link to="/owners" className="font-semibold text-foreground hover:text-primary">
          الملاك
        </Link>
        <ChevronLeft className="size-3.5" />
        <span>{id ? "تعديل" : "إضافة"}</span>
      </nav>

      {id && existing.isLoading ? (
        <div className="surface-card grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(false);
          }}
          className="space-y-5"
        >
          <SectionCard title="البيانات الأساسية">
            <div className="md:col-span-2">
              <Field label="نوع المالك" required>
                <select
                  value={form.owner_type}
                  onChange={(e) => set({ owner_type: e.target.value })}
                  className={inputClass}
                >
                  {ownerTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="الاسم الكامل" required>
                <input
                  value={form.full_name}
                  onChange={(e) => set({ full_name: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="نوع الهوية">
              <select
                value={form.id_type}
                onChange={(e) => set({ id_type: e.target.value })}
                className={inputClass}
              >
                <option value="">اختر</option>
                {idTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="رقم الهوية">
              <input
                value={form.national_id}
                onChange={(e) => set({ national_id: e.target.value })}
                className={inputClass}
              />
            </Field>
          </SectionCard>

          <SectionCard title="بيانات التواصل">
            <Field label="رقم الجوال">
              <input
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                dir="ltr"
                className={inputClass}
              />
            </Field>
            <Field
              label="واتساب"
              hint="اتركه فارغًا إذا كان رقم الواتساب هو نفس رقم الجوال."
            >
              <input
                value={form.whatsapp}
                onChange={(e) => set({ whatsapp: e.target.value })}
                dir="ltr"
                placeholder="يُستخدم رقم الجوال تلقائيًا إذا تُرك فارغًا"
                className={inputClass}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="البريد الإلكتروني">
                <input
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  dir="ltr"
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="العنوان">
                <input
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="الإعدادات">
            <Toggle label="نشط" checked={form.is_active} onChange={(v) => set({ is_active: v })} />
            <Toggle
              label="إشعارات واتساب"
              checked={form.whatsapp_notify}
              onChange={(v) => set({ whatsapp_notify: v })}
            />
            <div className="md:col-span-2">
              <Field label="ملاحظات">
                <textarea
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={5}
                  className={textareaClass}
                />
              </Field>
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              to="/owners"
              className="inline-flex h-11 items-center rounded-xl border border-border bg-card px-5 text-[13px] font-semibold text-foreground hover:bg-muted"
            >
              إلغاء
            </Link>
            <button
              type="button"
              onClick={() => save.mutate(true)}
              disabled={save.isPending}
              className="shine inline-flex h-11 items-center rounded-xl border border-border bg-card px-5 text-[13px] font-semibold text-foreground disabled:opacity-60"
            >
              {id ? "حفظ وبدء إضافة المزيد" : "إضافة وبدء إضافة المزيد"}
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="shine inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {id ? "حفظ" : "إضافة"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
