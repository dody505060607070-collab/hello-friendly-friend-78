import { createFileRoute } from "@tanstack/react-router";
import { FileText, Upload } from "lucide-react";

import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { contracts } from "@/data/records";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [
      { title: "إدارة العقود — الرشودي للعقارات" },
      { name: "description", content: "متابعة العقود والدفعات والتجديدات والاستحقاقات." },
      { property: "og:title", content: "إدارة العقود — الرشودي للعقارات" },
      { property: "og:description", content: "عقود الإيجار النشطة وتواريخ بدايتها ونهايتها." },
    ],
  }),
  component: ContractsPage,
});

type Contract = (typeof contracts)[number];

const columns: Column<Contract>[] = [
  { header: "رقم العقد", cell: (r) => <span className="font-semibold">{r.no}</span> },
  { header: "المالك", cell: (r) => r.owner },
  { header: "المستأجر", cell: (r) => r.tenant },
  { header: "الوحدة", cell: (r) => r.unit },
  { header: "البداية", sortable: true, cell: (r) => r.start },
  {
    header: "الانتهاء",
    sortable: true,
    cell: (r) => <span className={r.soon ? "font-semibold text-gold" : undefined}>{r.end}</span>,
  },
  { header: "الإيجار السنوي", sortable: true, cell: (r) => r.annual },
  { header: "المدفوع", cell: (r) => r.paid },
];

function ContractsPage() {
  return (
    <>
      <PageHero
        title="إدارة العقود"
        subtitle="متابعة العقود والدفعات والتجديدات والاستحقاقات."
        icon={FileText}
        stats={[
          { value: "97", label: "عقد نشط" },
          { value: "15", label: "تنتهي خلال 60 يوم" },
          { value: "3", label: "بانتظار المراجعة" },
        ]}
      />

      <PageBar
        crumbs={["عقود الإيجار", "القائمة"]}
        action={{ label: "إدخال عقد يدوي", icon: <FileText className="size-4" /> }}
      />

      <Pills
        variant="card"
        items={[
          { key: "contracts", label: "العقود", count: 20, icon: FileText },
          { key: "pdf", label: "استيراد PDF", count: 3, icon: Upload },
        ]}
      />

      <DataTable columns={columns} rows={contracts} total={97} pages={10} />
    </>
  );
}
