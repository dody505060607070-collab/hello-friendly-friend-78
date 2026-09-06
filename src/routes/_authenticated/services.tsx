import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number | null;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "الخدمات | الرشودي للعقارات" },
      { name: "description", content: "خدمات الشركة المعروضة في الموقع العام وترتيبها." },
      { property: "og:title", content: "الخدمات | الرشودي للعقارات" },
      { property: "og:description", content: "خدمات الشركة المعروضة في الموقع العام وترتيبها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <>
      <PageHero
        title="الخدمات"
        subtitle="الخدمات التي تُعرض للزوار في الموقع العام."
        icon={Sparkles}
      />

      <LiveTable<Row>
        table="services"
        select="id, title, description, icon, sort_order, is_active"
        orderBy={{ column: "sort_order", ascending: true }}
        searchPlaceholder="بحث بالخدمة"
        emptyText="لا توجد خدمات مضافة"
        emptyHint="أضِف خدمة لتظهر في صفحة الخدمات بالموقع."
        columns={[
          { header: "الخدمة", cell: (r) => r.title, className: "font-semibold" },
          { header: "الوصف", cell: (r) => r.description ?? "—" },
          { header: "الأيقونة", cell: (r) => <span dir="ltr">{r.icon ?? "—"}</span> },
          { header: "الترتيب", cell: (r) => r.sort_order ?? "—" },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "ظاهرة" : "مخفية"}</Chip>
            ),
          },
        ]}
      />
    </>
  );
}
