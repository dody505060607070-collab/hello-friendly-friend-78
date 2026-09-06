import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Eye, Inbox, Pencil, Search, User, Users } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supplyRequests } from "@/data/records";

export const Route = createFileRoute("/supply-requests")({
  head: () => ({
    meta: [
      { title: "طلبات توفير عقار — الرشودي للعقارات" },
      { name: "description", content: "متابعة احتياجات العملاء والطلبات العقارية." },
      { property: "og:title", content: "طلبات توفير عقار — الرشودي للعقارات" },
      { property: "og:description", content: "طلبات العملاء للشراء والإيجار وحالة متابعتها." },
    ],
  }),
  component: SupplyRequestsPage,
});

type Request = (typeof supplyRequests)[number];

const columns: Column<Request>[] = [
  {
    header: "الاسم",
    sortable: true,
    cell: (r) => <span className="font-semibold">{r.name}</span>,
  },
  { header: "الجوال", cell: (r) => r.phone },
  { header: "المدينة", cell: (r) => r.city },
  { header: "الحي", cell: (r) => r.district },
  {
    header: "النوع",
    cell: (r) => <Chip tone={r.kind === "شراء" ? "success" : "warning"}>{r.kind}</Chip>,
  },
  { header: "الميزانية", cell: (r) => r.budget },
  {
    header: "وسيط",
    cell: (r) =>
      r.broker ? (
        <Users className="size-4 text-primary/70" />
      ) : (
        <User className="size-4 text-muted-foreground" />
      ),
  },
  { header: "الحالة", cell: (r) => <Chip tone="warning">{r.status}</Chip> },
  { header: "تاريخ الطلب", sortable: true, cell: (r) => r.date },
  {
    header: "",
    cell: (r) => (
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1 font-semibold text-warning-foreground">
          <ChevronDown className="size-3.5" />
          {r.status}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-semibold text-foreground"
        >
          <Pencil className="size-3.5 text-muted-foreground" />
          ملاحظة
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-semibold text-foreground"
        >
          <Eye className="size-3.5 text-muted-foreground" />
          التفاصيل
        </button>
      </div>
    ),
  },
];

function SupplyRequestsPage() {
  return (
    <>
      <PageHero
        title="طلبات توفير عقار"
        subtitle="متابعة احتياجات العملاء والطلبات العقارية."
        icon={Search}
        stats={[
          { value: "97", label: "قيد المراجعة" },
          { value: "21", label: "جاري المتابعة" },
          { value: "2", label: "تم التوفير" },
        ]}
      />

      <Pills
        variant="card"
        defaultKey="supply"
        items={[
          { key: "offers", label: "طلبات عرض عقار", icon: Inbox },
          { key: "supply", label: "طلبات توفير عقار", icon: Search },
        ]}
      />

      <Pills
        items={[
          { key: "review", label: "قيد المراجعة", count: 97 },
          { key: "buy", label: "شراء", count: 27 },
          { key: "rent", label: "إيجار", count: 70 },
          { key: "following", label: "جاري المتابعة", count: 21 },
          { key: "done", label: "تم التوفير", count: 2 },
        ]}
      />

      <DataTable columns={columns} rows={supplyRequests} total={97} pages={10} />
    </>
  );
}
