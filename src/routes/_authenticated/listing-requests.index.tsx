import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, Loader2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { requestStatusLabels } from "@/lib/labels";

export type ListingRow = {
  id: string;
  full_name: string;
  phone: string;
  purpose: string;
  property_type: string | null;
  city: string | null;
  district: string | null;
  asking_price: string | null;
  rent_period: string | null;
  admin_notes: string | null;
  property_id: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/listing-requests/")({
  head: () => ({
    meta: [
      { title: "طلبات عرض عقار | مثراء العقارية" },
      {
        name: "description",
        content: "طلبات المالكين لعرض عقاراتهم، مع مسار المراجعة والاعتماد والنشر على الموقع.",
      },
      { property: "og:title", content: "طلبات عرض عقار | مثراء العقارية" },
      { property: "og:description", content: "مراجعة طلبات عرض العقار واعتمادها ونشرها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ListingRequestsPage,
});

function ListingRequestsPage() {
  const [tab, setTab] = useState("all");

  const listing = useTableRows<ListingRow>({
    table: "listing_requests",
    select:
      "id, full_name, phone, purpose, property_type, city, district, asking_price, rent_period, admin_notes, property_id, status, created_at",
    orderBy: { column: "created_at" },
    queryKey: ["listing_requests"],
  });

  const rows = useMemo(() => listing.data ?? [], [listing.data]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      open: rows.filter((r) => r.status === "new" || r.status === "in_review").length,
      contacted: rows.filter((r) => r.status === "contacted").length,
      done: rows.filter((r) => r.status === "converted" || r.status === "approved").length,
      closed: rows.filter((r) => r.status === "closed" || r.status === "rejected").length,
    }),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "open") return r.status === "new" || r.status === "in_review";
    if (tab === "contacted") return r.status === "contacted";
    if (tab === "done") return r.status === "converted" || r.status === "approved";
    return r.status === "closed" || r.status === "rejected";
  });

  return (
    <>
      <PageHero
        title="طلبات عرض عقار"
        subtitle="طلبات المالكين لعرض عقاراتهم: مراجعة ثم فتح العقار كمسودة ثم الاعتماد والنشر."
        icon={Inbox}
        stats={[
          { value: String(counts.open), label: "قيد المراجعة" },
          { value: String(counts.contacted), label: "جاري المتابعة" },
          { value: String(counts.done), label: "معتمدة" },
        ]}
      />

      <Pills
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: counts.all },
          { key: "open", label: "قيد المراجعة", count: counts.open },
          { key: "contacted", label: "تم التواصل", count: counts.contacted },
          { key: "done", label: "معتمدة", count: counts.done },
          { key: "closed", label: "مغلقة", count: counts.closed },
        ]}
      />

      {listing.isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل الطلبات…</p>
        </div>
      ) : listing.error ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <TriangleAlert className="size-7 text-destructive" />
          <p className="text-[14px] font-semibold text-foreground">تعذّر تحميل الطلبات</p>
          <p className="text-[12.5px] text-muted-foreground" dir="ltr">
            {listing.error instanceof Error ? listing.error.message : "خطأ غير معروف"}
          </p>
        </div>
      ) : (
        <DataTable<ListingRow>
          rows={filtered}
          showColumnsButton
          searchPlaceholder="بحث بالاسم أو الجوال"
          emptyState={
            <EmptyState
              text="لا توجد طلبات عرض عقار"
              hint="طلبات المالكين المرسلة من الموقع ستظهر هنا للمراجعة والاعتماد."
            />
          }
          columns={[
            {
              header: "المالك",
              sortable: true,
              cell: (r) => (
                <Link
                  to="/listing-requests/$id"
                  params={{ id: r.id }}
                  className="font-semibold text-primary hover:underline"
                >
                  {r.full_name}
                </Link>
              ),
            },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
            { header: "الغرض", cell: (r) => (r.purpose === "sale" ? "بيع" : "إيجار") },
            { header: "نوع العقار", cell: (r) => r.property_type ?? "—" },
            {
              header: "الموقع",
              cell: (r) => [r.city, r.district].filter(Boolean).join(" - ") || "—",
            },
            { header: "السعر المطلوب", cell: (r) => r.asking_price ?? "—" },
            { header: "الحالة", cell: (r) => requestStatusLabels[r.status] ?? r.status },
            {
              header: "التاريخ",
              sortable: true,
              value: (r) => r.created_at,
              cell: (r) => formatDate(r.created_at),
            },
            {
              header: "",
              cell: (r) => (
                <Link
                  to="/listing-requests/$id"
                  params={{ id: r.id }}
                  className="text-[12.5px] font-semibold text-primary"
                >
                  التفاصيل
                </Link>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
