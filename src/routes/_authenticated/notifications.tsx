import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات | الرشودي للعقارات" },
      { name: "description", content: "إشعارات المهام والعقود والمتابعات الخاصة بحسابك." },
      { property: "og:title", content: "الإشعارات | الرشودي للعقارات" },
      { property: "og:description", content: "إشعارات المهام والعقود والمتابعات الخاصة بحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <>
      <PageHero
        title="الإشعارات"
        subtitle="تصلك هنا تنبيهات الاستحقاقات والمهام والطلبات الجديدة."
        icon={Bell}
      />

      <LiveTable<Row>
        table="notifications"
        select="id, title, body, is_read, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث في الإشعارات"
        emptyText="لا توجد إشعارات"
        emptyHint="ستظهر الإشعارات هنا عند وجود استحقاق أو مهمة أو طلب جديد."
        columns={[
          { header: "العنوان", cell: (r) => r.title, className: "font-semibold" },
          { header: "التفاصيل", cell: (r) => r.body ?? "—" },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip tone={r.is_read ? "neutral" : "warning"}>{r.is_read ? "مقروء" : "جديد"}</Chip>
            ),
          },
          { header: "التاريخ", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
