import { createFileRoute } from "@tanstack/react-router";
import { PhoneCall } from "lucide-react";

import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  activity_type: string;
  subject: string | null;
  outcome: string | null;
  happened_at: string | null;
  next_follow_up: string | null;
  contact: { full_name: string } | null;
};

const typeLabels: Record<string, string> = {
  call: "مكالمة",
  whatsapp: "واتساب",
  meeting: "اجتماع",
  visit: "معاينة",
  note: "ملاحظة",
  email: "بريد",
};

export const Route = createFileRoute("/_authenticated/activities")({
  head: () => ({
    meta: [
      { title: "المتابعات والأنشطة | الرشودي للعقارات" },
      { name: "description", content: "سجل المكالمات والمعاينات والمتابعات مع العملاء." },
      { property: "og:title", content: "المتابعات والأنشطة | الرشودي للعقارات" },
      { property: "og:description", content: "سجل المكالمات والمعاينات والمتابعات مع العملاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivitiesPage,
});

function ActivitiesPage() {
  return (
    <>
      <PageHero
        title="المتابعات والأنشطة"
        subtitle="كل تواصل مسجّل مع العملاء، ومنه تُحدد المتابعة القادمة."
        icon={PhoneCall}
      />

      <LiveTable<Row>
        table="crm_activities"
        select="id, activity_type, subject, outcome, happened_at, next_follow_up, contact:contact_id(full_name)"
        orderBy={{ column: "happened_at" }}
        searchPlaceholder="بحث بالعميل أو الموضوع"
        emptyText="لا توجد أنشطة مسجلة"
        emptyHint="سجّل مكالمة أو معاينة مع عميل ليظهر النشاط هنا."
        columns={[
          { header: "العميل", cell: (r) => r.contact?.full_name ?? "—", className: "font-semibold" },
          { header: "النوع", cell: (r) => typeLabels[r.activity_type] ?? r.activity_type },
          { header: "الموضوع", cell: (r) => r.subject ?? "—" },
          { header: "النتيجة", cell: (r) => r.outcome ?? "—" },
          { header: "التاريخ", cell: (r) => formatDate(r.happened_at) },
          { header: "المتابعة القادمة", cell: (r) => formatDate(r.next_follow_up) },
        ]}
      />
    </>
  );
}
