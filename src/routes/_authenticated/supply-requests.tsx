import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Inbox, Loader2, Search, StickyNote, TriangleAlert, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { requestStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  full_name: string;
  phone: string;
  request_type: string;
  city: string | null;
  districts: string | null;
  property_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  requester_type: string | null;
  broker_name: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/supply-requests")({
  head: () => ({
    meta: [
      { title: "طلبات توفير عقار | مثراء العقارية" },
      { name: "description", content: "طلبات العملاء لتوفير عقار مناسب ومتابعتها حتى الإغلاق." },
      { property: "og:title", content: "طلبات توفير عقار | مثراء العقارية" },
      { property: "og:description", content: "طلبات العملاء لتوفير عقار مناسب ومتابعتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplyRequestsPage,
});

const SELECT =
  "id, full_name, phone, request_type, city, districts, property_type, budget_min, budget_max, requester_type, broker_name, status, created_at";

function SupplyRequestsPage() {
  const [tab, setTab] = useState("in_review");
  const { data, isLoading, error } = useTableRows<Row>({
    table: "supply_requests",
    select: SELECT,
    orderBy: { column: "created_at" },
  });

  const rows = data ?? [];

  const counts = useMemo(
    () => ({
      review: rows.filter((r) => r.status === "new" || r.status === "in_review").length,
      buy: rows.filter((r) => r.request_type === "buy").length,
      rent: rows.filter((r) => r.request_type !== "buy").length,
      following: rows.filter((r) => r.status === "contacted").length,
      done: rows.filter((r) => r.status === "converted" || r.status === "closed").length,
    }),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (tab === "in_review") return r.status === "new" || r.status === "in_review";
    if (tab === "buy") return r.request_type === "buy";
    if (tab === "rent") return r.request_type !== "buy";
    if (tab === "following") return r.status === "contacted";
    return r.status === "converted" || r.status === "closed";
  });

  return (
    <>
      <PageHero
        title="طلبات توفير عقار"
        subtitle="متابعة احتياجات العملاء والطلبات العقارية."
        icon={Search}
        stats={[
          { value: String(counts.review), label: "قيد المراجعة" },
          { value: String(counts.following), label: "جاري المتابعة" },
          { value: String(counts.done), label: "تم التوفير" },
        ]}
      />

      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-card">
          <span className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-foreground">
            <Search className="size-4" />
            طلبات توفير عقار
          </span>
          <Link
            to="/submissions"
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            <Inbox className="size-4" />
            طلبات عرض عقار
          </Link>
        </div>
      </div>

      <Pills
        variant="card"
        defaultKey="in_review"
        onChange={setTab}
        items={[
          { key: "in_review", label: "قيد المراجعة", count: counts.review },
          { key: "buy", label: "شراء", count: counts.buy },
          { key: "rent", label: "إيجار", count: counts.rent },
          { key: "following", label: "جاري المتابعة", count: counts.following },
          { key: "done", label: "تم التوفير", count: counts.done },
        ]}
      />

      {isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل الطلبات…</p>
        </div>
      ) : error ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <TriangleAlert className="size-7 text-destructive" />
          <p className="text-[14px] font-semibold text-foreground">تعذّر تحميل الطلبات</p>
          <p className="text-[12.5px] text-muted-foreground" dir="ltr">
            {error instanceof Error ? error.message : "خطأ غير معروف"}
          </p>
        </div>
      ) : (
        <DataTable<Row>
          rows={filtered}
          searchPlaceholder="بحث"
          emptyState={
            <EmptyState
              text="لا توجد طلبات توفير عقار"
              hint="الطلبات الواردة من الموقع أو المسجلة من الفريق ستظهر هنا."
            />
          }
          columns={[
            { header: "الاسم", sortable: true, cell: (r) => r.full_name, className: "font-semibold" },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
            { header: "المدينة", cell: (r) => r.city ?? "—" },
            { header: "الحي", cell: (r) => r.districts ?? "—" },
            {
              header: "النوع",
              cell: (r) => (
                <Chip tone={r.request_type === "buy" ? "success" : "warning"}>
                  {r.request_type === "buy" ? "شراء" : "إيجار"}
                </Chip>
              ),
            },
            {
              header: "الميزانية",
              cell: (r) =>
                r.budget_min || r.budget_max
                  ? `${formatCurrency(r.budget_min)} — ${formatCurrency(r.budget_max)}`
                  : "—",
            },
            {
              header: "وسيط",
              cell: (r) =>
                r.requester_type === "broker" ? (
                  <span className="inline-flex items-center gap-1 text-primary" title={r.broker_name ?? "وسيط"}>
                    <Users className="size-4" />
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              header: "الحالة",
              cell: (r) => (
                <Chip tone={r.status === "new" || r.status === "in_review" ? "warning" : "primary"}>
                  {requestStatusLabels[r.status] ?? r.status}
                </Chip>
              ),
            },
            { header: "تاريخ الطلب", sortable: true, cell: (r) => formatDate(r.created_at) },
            {
              header: "إجراءات",
              cell: (r) => (
                <span className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toast.info("إضافة ملاحظة إدارية قيد التجهيز.")}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <StickyNote className="size-4" />
                    ملاحظة
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      toast.info(
                        `${r.full_name} · ${r.property_type ?? "غير محدد"} · ${r.city ?? "—"}`,
                      )
                    }
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground"
                  >
                    <Eye className="size-4" />
                    التفاصيل
                  </button>
                </span>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
