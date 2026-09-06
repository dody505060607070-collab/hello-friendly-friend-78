import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Eye, Pencil, Users } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";
import { owners } from "@/data/records";

export const Route = createFileRoute("/owners")({
  head: () => ({
    meta: [
      { title: "الملاك — الرشودي للعقارات" },
      { name: "description", content: "إدارة بيانات الملاك وعقاراتهم وعقودهم الإيجارية." },
      { property: "og:title", content: "الملاك — الرشودي للعقارات" },
      { property: "og:description", content: "سجل الملاك مع عدد العقارات والعقود النشطة." },
    ],
  }),
  component: OwnersPage,
});

type Owner = (typeof owners)[number];

const columns: Column<Owner>[] = [
  {
    header: "الاسم",
    sortable: true,
    cell: (r) => <span className="font-semibold">{r.name}</span>,
  },
  { header: "النوع", cell: (r) => <Chip>{r.type}</Chip> },
  { header: "رقم الهوية / السجل", cell: (r) => r.id },
  {
    header: "الجوال",
    cell: (r) => <span dir="ltr">{r.phone}</span>,
  },
  {
    header: "العقارات",
    cell: (r) => <Chip tone="primary">{r.properties}</Chip>,
  },
  {
    header: "عقود نشطة",
    cell: (r) => <Chip tone="warning">{r.contracts}</Chip>,
  },
  {
    header: "نشط",
    cell: (r) =>
      r.active ? <CircleCheck className="size-5 text-success" /> : <span className="text-muted-foreground">—</span>,
  },
  {
    header: "",
    cell: () => (
      <div className="flex items-center gap-3">
        <button type="button" className="text-muted-foreground" aria-label="عرض">
          <Eye className="size-4" />
        </button>
        <button type="button" className="text-primary" aria-label="تعديل">
          <Pencil className="size-4" />
        </button>
      </div>
    ),
  },
];

function OwnersPage() {
  return (
    <>
      <PageHero
        title="الملاك"
        subtitle="إدارة بيانات الملاك وعقاراتهم وعقودهم الإيجارية."
        icon={Users}
        stats={[
          { value: "24", label: "مالك نشط" },
          { value: "97", label: "عقد نشط" },
          { value: "112,932 ر.س", label: "دفعات 30 يوم" },
          { value: "326,863 ر.س", label: "متأخرات" },
          { value: "3", label: "بانتظار المراجعة" },
        ]}
      />

      <PageBar crumbs={["الملاك", "القائمة"]} action={{ label: "مالك جديد" }} />

      <DataTable columns={columns} rows={owners} selectable showColumnsButton total={24} pages={3} />
    </>
  );
}
