import { createFileRoute } from "@tanstack/react-router";
import { Eye, Inbox, MapPin, Search } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { submissions } from "@/data/records";

export const Route = createFileRoute("/submissions")({
  head: () => ({
    meta: [
      { title: "طلبات التقديم — الرشودي للعقارات" },
      { name: "description", content: "مراجعة طلبات إضافة العقارات الواردة من الموقع." },
      { property: "og:title", content: "طلبات التقديم — الرشودي للعقارات" },
      { property: "og:description", content: "طلبات عرض العقارات الواردة وحالة مراجعتها." },
    ],
  }),
  component: SubmissionsPage,
});

type Submission = (typeof submissions)[number];

const columns: Column<Submission>[] = [
  { header: "الاسم", cell: (r) => <span className="font-semibold">{r.name}</span> },
  { header: "الهاتف", cell: (r) => r.phone },
  {
    header: "النوع",
    cell: (r) => <Chip tone={r.kind === "بيع" ? "success" : "warning"}>{r.kind}</Chip>,
  },
  { header: "نوع العقار", cell: (r) => r.propertyType },
  { header: "السعر المطلوب", cell: (r) => r.price },
  { header: "فترة الإيجار", cell: (r) => <span className="text-muted-foreground">{r.period}</span> },
  { header: "الحي", cell: (r) => r.district },
  {
    header: "الحالة",
    cell: (r) => (
      <Chip tone={r.status === "مرفوض" ? "danger" : "success"}>{r.status}</Chip>
    ),
  },
  {
    header: "الخريطة",
    cell: () => (
      <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-primary">
        <MapPin className="size-3.5 text-destructive" />
        عرض الموقع
      </button>
    ),
  },
  { header: "تاريخ الطلب", cell: (r) => <span className="text-muted-foreground">{r.date}</span> },
  {
    header: "",
    cell: () => (
      <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-foreground">
        <Eye className="size-3.5 text-muted-foreground" />
        التفاصيل والصور
      </button>
    ),
  },
];

function SubmissionsPage() {
  return (
    <>
      <PageHero
        title="طلبات التقديم"
        subtitle="مراجعة طلبات إضافة العقارات الواردة من الموقع."
        icon={Inbox}
        stats={[{ value: "120", label: "إجمالي السجلات" }]}
      />

      <Pills
        variant="card"
        items={[
          { key: "offers", label: "طلبات عرض عقار", icon: Inbox },
          { key: "supply", label: "طلبات توفير عقار", icon: Search },
        ]}
      />

      <Pills
        items={[
          { key: "all", label: "الكل" },
          { key: "rent", label: "إيجار" },
          { key: "sale", label: "بيع" },
        ]}
      />

      <DataTable columns={columns} rows={submissions} total={120} pages={12} />
    </>
  );
}
