import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

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
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "العقارات | الرشودي للعقارات" },
      { name: "description", content: "إدارة بيانات العقارات، الأسعار، الحالة والنشر على الموقع." },
      { property: "og:title", content: "العقارات | الرشودي للعقارات" },
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

function PropertiesPage() {
  return (
    <>
      <PageHero
        title="إدارة العقارات"
        subtitle="كل العقارات المسجلة في النظام مع حالتها الحقيقية وحالة النشر على الموقع."
        icon={Building2}
      />

      <LiveTable<PropertyRow>
        table="properties"
        select="id, code, name, purpose, property_type, status, price_value, price_text, city, district, is_visible, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بالاسم أو الكود"
        emptyText="لا توجد عقارات مسجلة"
        emptyHint="ابدأ بإضافة عقار أو باعتماد أحد طلبات عرض العقار لتظهر هنا."
        columns={[
          { header: "الكود", cell: (r) => r.code ?? "—" },
          { header: "العقار", cell: (r) => r.name, className: "font-semibold" },
          { header: "النوع", cell: (r) => r.property_type ?? "—" },
          { header: "الغرض", cell: (r) => (r.purpose === "sale" ? "بيع" : "إيجار") },
          {
            header: "المدينة / الحي",
            cell: (r) => [r.city, r.district].filter(Boolean).join(" - ") || "—",
          },
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
            header: "النشر",
            cell: (r) => (
              <Chip tone={r.is_visible ? "primary" : "neutral"}>
                {r.is_visible ? "ظاهر بالموقع" : "غير منشور"}
              </Chip>
            ),
          },
          { header: "أُضيف", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
