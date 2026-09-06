import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { requestStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  full_name: string;
  phone: string;
  request_type: string;
  city: string | null;
  districts: string[] | null;
  property_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  requester_type: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/supply-requests")({
  head: () => ({
    meta: [
      { title: "طلبات توفير عقار | الرشودي للعقارات" },
      { name: "description", content: "طلبات العملاء لتوفير عقار مناسب ومتابعتها حتى الإغلاق." },
      { property: "og:title", content: "طلبات توفير عقار | الرشودي للعقارات" },
      { property: "og:description", content: "طلبات العملاء لتوفير عقار مناسب ومتابعتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplyRequestsPage,
});

function SupplyRequestsPage() {
  return (
    <>
      <PageHero
        title="طلبات توفير عقار"
        subtitle="طلبات العملاء والوسطاء لتوفير عقار مطابق، مع الميزانية والأحياء المطلوبة."
        icon={Search}
      />

      <LiveTable<Row>
        table="supply_requests"
        select="id, full_name, phone, request_type, city, districts, property_type, budget_min, budget_max, requester_type, status, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بالاسم أو الجوال"
        emptyText="لا توجد طلبات توفير عقار"
        emptyHint="الطلبات الواردة من الموقع أو المسجلة من الفريق ستظهر هنا."
        columns={[
          { header: "مقدّم الطلب", cell: (r) => r.full_name, className: "font-semibold" },
          { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
          { header: "نوع الطلب", cell: (r) => (r.request_type === "buy" ? "شراء" : "إيجار") },
          { header: "النوع", cell: (r) => r.property_type ?? "—" },
          {
            header: "المدينة / الأحياء",
            cell: (r) => [r.city, r.districts?.join("، ")].filter(Boolean).join(" - ") || "—",
          },
          {
            header: "الميزانية",
            cell: (r) =>
              r.budget_min || r.budget_max
                ? `${formatCurrency(r.budget_min)} — ${formatCurrency(r.budget_max)}`
                : "—",
          },
          { header: "الجهة", cell: (r) => (r.requester_type === "broker" ? "وسيط" : "عميل") },
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
