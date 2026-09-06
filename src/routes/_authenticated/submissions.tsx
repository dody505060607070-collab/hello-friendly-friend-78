import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  full_name: string;
  phone: string;
  purpose: string;
  property_type: string | null;
  city: string | null;
  district: string | null;
  asking_price: number | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/submissions")({
  head: () => ({
    meta: [
      { title: "طلبات عرض عقار | مثراء العقارية" },
      { name: "description", content: "متابعة طلبات المالكين لعرض عقاراتهم واعتمادها." },
      { property: "og:title", content: "طلبات عرض عقار | مثراء العقارية" },
      { property: "og:description", content: "متابعة طلبات المالكين لعرض عقاراتهم واعتمادها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmissionsPage,
});

export const requestStatusLabels: Record<string, string> = {
  new: "جديد",
  in_review: "قيد المراجعة",
  contacted: "تم التواصل",
  approved: "معتمد",
  rejected: "مرفوض",
  converted: "تم التحويل",
  closed: "مغلق",
};

function SubmissionsPage() {
  return (
    <>
      <PageHero
        title="طلبات عرض عقار"
        subtitle="الطلبات الواردة من المالكين لعرض عقاراتهم، مع حالة المراجعة والتحويل لعقار."
        icon={ClipboardList}
      />

      <LiveTable<Row>
        table="listing_requests"
        select="id, full_name, phone, purpose, property_type, city, district, asking_price, status, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بالاسم أو الجوال"
        emptyText="لا توجد طلبات عرض عقار"
        emptyHint="الطلبات المرسلة من الموقع أو المضافة يدويًا ستظهر هنا."
        columns={[
          { header: "مقدّم الطلب", cell: (r) => r.full_name, className: "font-semibold" },
          { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
          { header: "الغرض", cell: (r) => (r.purpose === "sale" ? "بيع" : "إيجار") },
          { header: "النوع", cell: (r) => r.property_type ?? "—" },
          {
            header: "الموقع",
            cell: (r) => [r.city, r.district].filter(Boolean).join(" - ") || "—",
          },
          { header: "السعر المطلوب", cell: (r) => formatCurrency(r.asking_price) },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip tone={r.status === "new" ? "warning" : "primary"}>
                {requestStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
          { header: "التاريخ", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
