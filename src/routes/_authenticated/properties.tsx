import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, ChevronLeft, Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";

type PropertyRow = {
  id: string;
  code: string | null;
  name: string;
  purpose: string;
  property_type: string | null;
  status: string;
  price_value: number | null;
  price_text: string | null;
  city: string | null;
  district: string | null;
  is_visible: boolean;
  is_featured: boolean;
  needs_review: boolean;
  sort_order: number | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "العقارات | مثراء العقارية" },
      { name: "description", content: "إدارة بيانات العقارات، الأسعار، الحالة والنشر على الموقع." },
      { property: "og:title", content: "العقارات | مثراء العقارية" },
      { property: "og:description", content: "إدارة بيانات العقارات، الأسعار، الحالة والنشر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropertiesPage,
});

const statusLabels: Record<string, string> = {
  available: "متاح",
  reserved: "محجوز",
  rented: "مؤجر",
  sold: "مبيع",
  hidden: "مخفي",
};

const SELECT =
  "id, code, name, purpose, property_type, status, price_value, price_text, city, district, is_visible, is_featured, needs_review, sort_order, created_at";

function PropertiesPage() {
  const [tab, setTab] = useState("all");
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTableRows<PropertyRow>({
    table: "properties",
    select: SELECT,
    orderBy: { column: "created_at" },
  });

  const rows = data ?? [];

  const flags = useMutation({
    mutationFn: async (input: { id: string; field: "is_visible" | "is_featured"; value: boolean }) => {
      const patch =
        input.field === "is_visible" ? { is_visible: input.value } : { is_featured: input.value };
      const { error: err } = await supabase.from("properties").update(patch).eq("id", input.id);
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم تحديث حالة العقار");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await supabase.from("properties").delete().eq("id", id);
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("تم حذف العقار");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const counts = useMemo(
    () => ({
      all: rows.length,
      rent: rows.filter((r) => r.purpose !== "sale").length,
      sale: rows.filter((r) => r.purpose === "sale").length,
      visible: rows.filter((r) => r.is_visible).length,
      review: rows.filter((r) => r.needs_review).length,
    }),
    [rows],
  );

  const filtered = rows.filter((r) =>
    tab === "all" ? true : tab === "sale" ? r.purpose === "sale" : r.purpose !== "sale",
  );

  return (
    <>
      <PageHero
        title="العقارات"
        subtitle="إدارة العقارات المعروضة وبياناتها وحالة ظهورها."
        icon={Building2}
        stats={[
          { value: String(counts.all), label: "إجمالي العقارات" },
          { value: String(counts.visible), label: "عقار ظاهر" },
          { value: String(counts.review), label: "بانتظار المراجعة" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => toast.info("نموذج إضافة عقار قيد التجهيز في المرحلة القادمة.")}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          إضافة عقار
        </button>

        <nav className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
          <span className="font-semibold text-foreground">العقارات</span>
          <ChevronLeft className="size-3.5" />
          <span>القائمة</span>
        </nav>
      </div>

      <Pills
        variant="card"
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: counts.all },
          { key: "rent", label: "الإيجار", count: counts.rent },
          { key: "sale", label: "البيع", count: counts.sale },
        ]}
      />

      {isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل العقارات…</p>
        </div>
      ) : error ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <TriangleAlert className="size-7 text-destructive" />
          <p className="text-[14px] font-semibold text-foreground">تعذّر تحميل العقارات</p>
          <p className="text-[12.5px] text-muted-foreground" dir="ltr">
            {error instanceof Error ? error.message : "خطأ غير معروف"}
          </p>
        </div>
      ) : (
        <DataTable<PropertyRow>
          rows={filtered}
          selectable
          showColumnsButton
          searchPlaceholder="بحث"
          emptyState={
            <EmptyState
              text="لا توجد عقارات مسجلة"
              hint="ابدأ بإضافة عقار أو باعتماد أحد طلبات عرض العقار لتظهر هنا."
            />
          }
          columns={[
            {
              header: "العقار",
              sortable: true,
              cell: (r) => r.name,
              className: "font-semibold",
            },
            { header: "الكود", sortable: true, cell: (r) => r.code ?? "—" },
            {
              header: "النوع",
              cell: (r) => (
                <Chip tone={r.purpose === "sale" ? "success" : "warning"}>
                  {r.purpose === "sale" ? "بيع" : "إيجار"}
                </Chip>
              ),
            },
            { header: "الحي", cell: (r) => r.district ?? "—" },
            { header: "المدينة", cell: (r) => r.city ?? "—" },
            { header: "السعر", cell: (r) => r.price_text ?? formatCurrency(r.price_value) },
            {
              header: "الحالة",
              cell: (r) => (
                <Chip tone={r.status === "available" ? "success" : "warning"}>
                  {statusLabels[r.status] ?? r.status}
                </Chip>
              ),
            },
            {
              header: "مرئي",
              cell: (r) => (
                <Toggle
                  label="ظهور العقار على الموقع"
                  checked={r.is_visible}
                  disabled={flags.isPending}
                  onChange={(value) => flags.mutate({ id: r.id, field: "is_visible", value })}
                />
              ),
            },
            {
              header: "مميز",
              cell: (r) => (
                <Toggle
                  label="عقار مميز"
                  checked={r.is_featured}
                  disabled={flags.isPending}
                  onChange={(value) => flags.mutate({ id: r.id, field: "is_featured", value })}
                />
              ),
            },
            { header: "الترتيب", sortable: true, cell: (r) => r.sort_order ?? 0 },
            { header: "تاريخ الإضافة", sortable: true, cell: (r) => formatDate(r.created_at) },
            {
              header: "إجراءات",
              cell: (r) => (
                <span className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toast.info("تعديل العقار متاح في المرحلة القادمة.")}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <Pencil className="size-4" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`حذف العقار "${r.name}"؟`)) remove.mutate(r.id);
                    }}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                  >
                    <Trash2 className="size-4" />
                    حذف
                  </button>
                </span>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
