import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";

import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  actor: { full_name: string } | null;
};

export const Route = createFileRoute("/_authenticated/activity-log")({
  head: () => ({
    meta: [
      { title: "سجل الأنشطة | مثراء العقارية" },
      { name: "description", content: "سجل كل عملية تمت في النظام ومن نفّذها ومتى." },
      { property: "og:title", content: "سجل الأنشطة | مثراء العقارية" },
      { property: "og:description", content: "سجل كل عملية تمت في النظام ومن نفّذها ومتى." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityLogPage,
});

function ActivityLogPage() {
  return (
    <>
      <PageHero
        title="سجل الأنشطة"
        subtitle="تتبّع كامل لعمليات الإضافة والتعديل والحذف والاعتماد."
        icon={History}
      />

      <LiveTable<Row>
        table="activity_log"
        select="id, action, entity_type, entity_id, created_at, actor:actor_id(full_name)"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بالعملية"
        emptyText="لا توجد أنشطة مسجلة"
        emptyHint="ستُسجَّل العمليات هنا تلقائيًا أثناء استخدام النظام."
        columns={[
          { header: "المستخدم", cell: (r) => r.actor?.full_name ?? "النظام", className: "font-semibold" },
          { header: "العملية", cell: (r) => r.action },
          { header: "النوع", cell: (r) => r.entity_type ?? "—" },
          { header: "السجل", cell: (r) => <span dir="ltr">{r.entity_id ?? "—"}</span> },
          { header: "التاريخ", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
