import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownUp, Home, Pencil, Trash2 } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { properties } from "@/data/records";

export const Route = createFileRoute("/properties")({
  head: () => ({
    meta: [
      { title: "العقارات — الرشودي للعقارات" },
      { name: "description", content: "إدارة العقارات المعروضة وبياناتها وحالة ظهورها." },
      { property: "og:title", content: "العقارات — الرشودي للعقارات" },
      { property: "og:description", content: "قائمة العقارات مع حالة الظهور والتمييز والترتيب." },
    ],
  }),
  component: PropertiesPage,
});

type Property = (typeof properties)[number];

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={
        on
          ? "flex h-6 w-11 items-center rounded-full bg-primary p-0.5"
          : "flex h-6 w-11 items-center rounded-full bg-muted p-0.5"
      }
    >
      <span
        className={
          on
            ? "size-5 translate-x-0 rounded-full bg-card shadow-card"
            : "size-5 -translate-x-5 rounded-full bg-card shadow-card"
        }
      />
    </span>
  );
}

const columns: Column<Property>[] = [
  {
    header: "العقار",
    sortable: true,
    cell: (r) => <span className="font-semibold">{r.name}</span>,
  },
  { header: "الكود", sortable: true, cell: (r) => r.code },
  {
    header: "النوع",
    cell: (r) => <Chip tone={r.type === "بيع" ? "success" : "warning"}>{r.type}</Chip>,
  },
  { header: "الحي", cell: (r) => r.district },
  { header: "مرئي", cell: (r) => <Toggle on={r.visible} /> },
  { header: "مميز", cell: (r) => <Toggle on={r.featured} /> },
  { header: "الترتيب", sortable: true, cell: (r) => r.order },
  {
    header: "تاريخ الإضافة",
    cell: (r) => <span className="text-muted-foreground">{r.date}</span>,
  },
  {
    header: "",
    cell: () => (
      <div className="flex items-center gap-4">
        <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-primary">
          <Pencil className="size-3.5" />
          تعديل
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-semibold text-destructive"
        >
          <Trash2 className="size-3.5" />
          حذف
        </button>
      </div>
    ),
  },
];

function PropertiesPage() {
  return (
    <>
      <PageHero
        title="العقارات"
        subtitle="إدارة العقارات المعروضة وبياناتها وحالة ظهورها."
        icon={Home}
        stats={[
          { value: "239", label: "إجمالي العقارات" },
          { value: "104", label: "عقار ظاهر" },
          { value: "135", label: "بانتظار المراجعة" },
        ]}
      />

      <PageBar crumbs={["العقارات", "القائمة"]} action={{ label: "إضافة عقار" }} />

      <Pills
        items={[
          { key: "all", label: "الكل", count: 135 },
          { key: "rent", label: "الإيجار", count: 121 },
          { key: "sale", label: "البيع", count: 14 },
        ]}
      />

      <DataTable
        columns={columns}
        rows={properties}
        selectable
        showColumnsButton={false}
        total={239}
        pages={24}
        toolbarExtra={
          <button
            type="button"
            className="ms-auto grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
            aria-label="ترتيب"
          >
            <ArrowDownUp className="size-[18px]" />
          </button>
        }
      />
    </>
  );
}
