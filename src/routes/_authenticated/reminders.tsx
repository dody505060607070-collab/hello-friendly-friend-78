import { createFileRoute } from "@tanstack/react-router";
import { BellRing } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { followupStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  repeat_interval: string | null;
  sent_count: number | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  status: string;
  contract: { contract_number: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "إدارة التذكيرات | الرشودي للعقارات" },
      { name: "description", content: "تذكيرات السداد والمتابعات المجدولة وحالة إرسال الرسائل." },
      { property: "og:title", content: "إدارة التذكيرات | الرشودي للعقارات" },
      { property: "og:description", content: "تذكيرات السداد والمتابعات المجدولة وحالة الإرسال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RemindersPage,
});

function RemindersPage() {
  return (
    <>
      <PageHero
        title="إدارة التذكيرات"
        subtitle="التذكيرات المجدولة للمستأجرين والملاك. لا يتم تسجيل أي إرسال كناجح إلا بعد تأكيد المزود."
        icon={BellRing}
      />

      <LiveTable<Row>
        table="reminder_followups"
        select="id, recipient_name, recipient_phone, repeat_interval, sent_count, last_sent_at, next_send_at, status, contract:contract_id(contract_number)"
        orderBy={{ column: "next_send_at", ascending: true }}
        searchPlaceholder="بحث بالمستلم أو رقم العقد"
        emptyText="لا توجد تذكيرات مجدولة"
        emptyHint="أضِف تذكيرًا لدفعة أو عقد ليظهر هنا مع موعد الإرسال القادم."
        columns={[
          { header: "المستلم", cell: (r) => r.recipient_name ?? "—", className: "font-semibold" },
          { header: "الجوال", cell: (r) => <span dir="ltr">{r.recipient_phone ?? "—"}</span> },
          { header: "العقد", cell: (r) => r.contract?.contract_number ?? "—" },
          { header: "التكرار", cell: (r) => r.repeat_interval ?? "مرة واحدة" },
          { header: "عدد الإرسالات", cell: (r) => r.sent_count ?? 0 },
          { header: "آخر إرسال", cell: (r) => formatDate(r.last_sent_at) },
          { header: "الإرسال القادم", cell: (r) => formatDate(r.next_send_at) },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip
                tone={
                  r.status === "sent"
                    ? "success"
                    : r.status === "failed"
                      ? "danger"
                      : r.status === "pending"
                        ? "warning"
                        : "neutral"
                }
              >
                {followupStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
        ]}
      />
    </>
  );
}
