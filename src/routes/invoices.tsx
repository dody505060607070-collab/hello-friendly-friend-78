import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Eye, FileText } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";
import { invoices } from "@/data/records";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير — الرشودي للعقارات" },
      { name: "description", content: "إدارة الفواتير وحالات إصدارها وسدادها." },
      { property: "og:title", content: "الفواتير — الرشودي للعقارات" },
      { property: "og:description", content: "الفواتير المرسلة والمدفوعة والقيم المستحقة." },
    ],
  }),
  component: InvoicesPage,
});

type Invoice = (typeof invoices)[number];

const columns: Column<Invoice>[] = [
  { header: "رقم الفاتورة", sortable: true, cell: (r) => <span className="font-semibold">{r.no}</span> },
  { header: "المالك", sortable: true, cell: (r) => r.owner },
  { header: "التاريخ", sortable: true, cell: (r) => r.date },
  {
    header: "الاستحقاق",
    sortable: true,
    cell: (r) => <span className="text-muted-foreground">{r.due}</span>,
  },
  {
    header: "الحالة",
    cell: (r) => (
      <Chip tone={r.status === "مدفوعة" ? "success" : "warning"}>{r.status}</Chip>
    ),
  },
  { header: "قبل الضريبة", sortable: true, cell: (r) => r.net },
  { header: "الضريبة", sortable: true, cell: (r) => r.vat },
  {
    header: "الإجمالي",
    sortable: true,
    cell: (r) => <span className="font-semibold">{r.total}</span>,
  },
  {
    header: "",
    cell: (r) => (
      <div className="flex items-center gap-3">
        <button type="button" className="text-muted-foreground" aria-label="عرض">
          <Eye className="size-4" />
        </button>
        {r.status !== "مدفوعة" ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-semibold text-success"
          >
            <CircleCheck className="size-4" />
            تسجيل مدفوعة
          </button>
        ) : null}
      </div>
    ),
  },
];

function InvoicesPage() {
  return (
    <>
      <PageHero
        title="الفواتير"
        subtitle="إدارة الفواتير وحالات إصدارها وسدادها."
        icon={FileText}
        stats={[
          { value: "2", label: "فاتورة مرسلة" },
          { value: "1", label: "فاتورة مدفوعة" },
          { value: "450 ر.س", label: "قيمة مستحقة" },
        ]}
      />

      <PageBar crumbs={["الفواتير", "القائمة"]} action={{ label: "إنشاء فاتورة" }} />

      <DataTable columns={columns} rows={invoices} total={3} pages={1} />
    </>
  );
}
