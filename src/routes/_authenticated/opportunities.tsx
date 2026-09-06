import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { stageLabels } from "@/lib/labels";

type Row = {
  id: string;
  title: string;
  deal_type: string | null;
  stage: string;
  expected_value: number | null;
  next_follow_up: string | null;
  close_reason: string | null;
  contact: { full_name: string } | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/opportunities")({
  head: () => ({
    meta: [
      { title: "الفرص | مثراء العقارية" },
      { name: "description", content: "متابعة فرص البيع والإيجار ومراحلها حتى الإغلاق." },
      { property: "og:title", content: "الفرص | مثراء العقارية" },
      { property: "og:description", content: "متابعة فرص البيع والإيجار ومراحلها حتى الإغلاق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  return (
    <>
      <PageHero
        title="الفرص"
        subtitle="الفرص المفتوحة والمغلقة مع مرحلتها الحالية وموعد المتابعة القادم."
        icon={Target}
      />

      <LiveTable<Row>
        table="opportunities"
        select="id, title, deal_type, stage, expected_value, next_follow_up, close_reason, created_at, contact:contact_id(full_name)"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بعنوان الفرصة أو العميل"
        emptyText="لا توجد فرص"
        emptyHint="تُنشأ الفرص من الطلبات الواردة أو يدويًا لمتابعة العميل خطوة بخطوة."
        columns={[
          { header: "الفرصة", cell: (r) => r.title, className: "font-semibold" },
          { header: "العميل", cell: (r) => r.contact?.full_name ?? "—" },
          { header: "النوع", cell: (r) => (r.deal_type === "sale" ? "بيع" : "إيجار") },
          {
            header: "المرحلة",
            cell: (r) => (
              <Chip
                tone={r.stage === "won" ? "success" : r.stage === "lost" ? "danger" : "primary"}
              >
                {stageLabels[r.stage] ?? r.stage}
              </Chip>
            ),
          },
          { header: "القيمة المتوقعة", cell: (r) => formatCurrency(r.expected_value) },
          { header: "المتابعة القادمة", cell: (r) => formatDate(r.next_follow_up) },
          { header: "أُنشئت", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
