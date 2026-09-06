import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { reservationStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  extended_count: number | null;
  notes: string | null;
  properties: { name: string; code: string | null } | null;
  employee: { full_name: string } | null;
  contact: { full_name: string } | null;
};

export const Route = createFileRoute("/_authenticated/reservations")({
  head: () => ({
    meta: [
      { title: "إدارة الحجوزات | مثراء العقارية" },
      { name: "description", content: "حجوزات الموظفين للعقارات مع مدة الحجز والتمديد والانتهاء." },
      { property: "og:title", content: "إدارة الحجوزات | مثراء العقارية" },
      { property: "og:description", content: "حجوزات الموظفين للعقارات ومدة الحجز والتمديد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  return (
    <>
      <PageHero
        title="إدارة الحجوزات"
        subtitle="الحجوزات النشطة والمؤقتة، ولا يُسمح بحجزين متعارضين على نفس العقار."
        icon={CalendarClock}
      />

      <LiveTable<Row>
        table="reservations"
        select="id, status, starts_at, ends_at, extended_count, notes, properties:property_id(name, code), employee:employee_id(full_name), contact:contact_id(full_name)"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بالعقار أو الموظف"
        emptyText="لا توجد حجوزات"
        emptyHint="عند حجز موظف لعقار سيظهر الحجز هنا مع مدة الصلاحية."
        columns={[
          {
            header: "العقار",
            cell: (r) => r.properties?.name ?? "—",
            className: "font-semibold",
          },
          { header: "الكود", cell: (r) => r.properties?.code ?? "—" },
          { header: "الموظف", cell: (r) => r.employee?.full_name ?? "—" },
          { header: "العميل", cell: (r) => r.contact?.full_name ?? "—" },
          { header: "من", cell: (r) => formatDate(r.starts_at) },
          { header: "إلى", cell: (r) => formatDate(r.ends_at) },
          { header: "مرات التمديد", cell: (r) => r.extended_count ?? 0 },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip
                tone={
                  r.status === "active"
                    ? "success"
                    : r.status === "hold"
                      ? "warning"
                      : r.status === "cancelled"
                        ? "danger"
                        : "neutral"
                }
              >
                {reservationStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
        ]}
      />
    </>
  );
}
