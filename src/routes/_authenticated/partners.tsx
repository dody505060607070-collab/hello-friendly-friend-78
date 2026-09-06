import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  name: string;
  website_url: string | null;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/partners")({
  head: () => ({
    meta: [
      { title: "الشركاء | الرشودي للعقارات" },
      { name: "description", content: "شركاء الشركة الظاهرون في الموقع العام وترتيب عرضهم." },
      { property: "og:title", content: "الشركاء | الرشودي للعقارات" },
      { property: "og:description", content: "شركاء الشركة الظاهرون في الموقع العام وترتيب عرضهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

function PartnersPage() {
  return (
    <>
      <PageHero
        title="الشركاء"
        subtitle="الشركاء الذين تظهر شعاراتهم في الموقع العام."
        icon={Handshake}
      />

      <LiveTable<Row>
        table="partners"
        select="id, name, website_url, description, sort_order, is_active"
        orderBy={{ column: "sort_order", ascending: true }}
        searchPlaceholder="بحث باسم الشريك"
        emptyText="لا يوجد شركاء مضافون"
        emptyHint="أضِف شريكًا مع شعاره ليظهر في صفحة الشركاء بالموقع."
        columns={[
          { header: "الشريك", cell: (r) => r.name, className: "font-semibold" },
          { header: "الموقع", cell: (r) => <span dir="ltr">{r.website_url ?? "—"}</span> },
          { header: "الوصف", cell: (r) => r.description ?? "—" },
          { header: "الترتيب", cell: (r) => r.sort_order ?? "—" },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "ظاهر" : "مخفي"}</Chip>
            ),
          },
        ]}
      />
    </>
  );
}
