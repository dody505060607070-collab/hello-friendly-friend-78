import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Plus } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { ToneLegend } from "@/components/kit/ToneLegend";
import { Button } from "@/components/ui/button";
import { reservationStatusLabels } from "@/lib/labels";
import { reservationRowTone, rowToneClass } from "@/lib/row-tone";

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


function NewReservationForm() {
  const navigate = useNavigate();
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <Button type="button" size="sm" onClick={() => navigate({ to: "/reserve" })}>
        <Plus className="size-4" />
        حجز جديد
      </Button>
      <p className="text-right text-[12px] text-muted-foreground">
        ينقلك لتصفّح العقارات كما يراها الزوار — اضغط على أي عقار لحجزه فورًا. علامة «محجوز» تظهر للموظفين فقط.
      </p>
    </div>
  );
}

function ReservationsPage() {
  return (
    <>
      <PageHero
        title="إدارة الحجوزات"
        subtitle="الحجوزات النشطة والمؤقتة، ولا يُسمح بحجزين متعارضين على نفس العقار."
        icon={CalendarClock}
      />

      <NewReservationForm />

      <ToneLegend
        tones={["overdue", "today", "urgent", "progress", "new", "done"]}
        labels={{
          overdue: "منتهية / ملغاة",
          today: "تنتهي اليوم",
          urgent: "تنتهي خلال يومين",
          progress: "معلّقة",
          new: "نشطة",
          done: "تم تحويلها",
        }}
      />

      <LiveTable<Row>
        rowClassName={(r) => rowToneClass[reservationRowTone(r)]}
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
