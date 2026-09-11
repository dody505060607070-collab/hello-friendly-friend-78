import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox, Loader2, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";
import { requestStatusLabels } from "@/lib/labels";

type SupplyRow = {
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
  admin_notes: string | null;
  status: string;
  created_at: string;
};

type ListingRow = {
  id: string;
  full_name: string;
  phone: string;
  purpose: string;
  property_type: string | null;
  city: string | null;
  district: string | null;
  asking_price: string | null;
  admin_notes: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "طلبات العقارات | مثراء العقارية" },
      {
        name: "description",
        content: "طلبات توفير العقار وطلبات عرض العقار في شاشة واحدة مع متابعة الحالة.",
      },
      { property: "og:title", content: "طلبات العقارات | مثراء العقارية" },
      { property: "og:description", content: "متابعة طلبات التوفير والعرض حتى الإغلاق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    source: search["source"] === "listing" ? "listing" : "supply",
  }),
  component: RequestsPage,
});

const statusOrder = ["new", "in_review", "contacted", "approved", "converted", "rejected", "closed"];

function RequestsPage() {
  const { source: initialSource } = Route.useSearch();
  const [source, setSource] = useState(initialSource);
  useEffect(() => {
    setSource(initialSource);
    setTab("all");
  }, [initialSource]);
  const [tab, setTab] = useState("all");
  const queryClient = useQueryClient();

  const supply = useTableRows<SupplyRow>({
    table: "supply_requests",
    select:
      "id, full_name, phone, request_type, city, districts, property_type, budget_min, budget_max, requester_type, broker_name, admin_notes, status, created_at",
    orderBy: { column: "created_at" },
    queryKey: ["supply_requests"],
  });

  const listing = useTableRows<ListingRow>({
    table: "listing_requests",
    select:
      "id, full_name, phone, purpose, property_type, city, district, asking_price, admin_notes, status, created_at",
    orderBy: { column: "created_at" },
    queryKey: ["listing_requests"],
  });

  const setStatus = useMutation({
    mutationFn: async (input: { table: string; id: string; status: string }) => {
      const { error: err } = await supabase
        .from(input.table as "supply_requests")
        .update({ status: input.status })
        .eq("id", input.id);
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply_requests"] });
      queryClient.invalidateQueries({ queryKey: ["listing_requests"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم تحديث حالة الطلب");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const saveNote = useMutation({
    mutationFn: async (input: { table: string; id: string; note: string }) => {
      const { error: err } = await supabase
        .from(input.table as "supply_requests")
        .update({ admin_notes: input.note })
        .eq("id", input.id);
      if (err) throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply_requests"] });
      queryClient.invalidateQueries({ queryKey: ["listing_requests"] });
      toast.success("تم حفظ الملاحظة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const supplyRows = supply.data ?? [];
  const listingRows = listing.data ?? [];
  const isLoading = supply.isLoading || listing.isLoading;
  const error = supply.error ?? listing.error;

  const activeRows: (SupplyRow | ListingRow)[] = source === "supply" ? supplyRows : listingRows;
  const table = source === "supply" ? "supply_requests" : "listing_requests";

  const counts = useMemo(() => {
    const open = (r: { status: string }) => r.status === "new" || r.status === "in_review";
    return {
      supply: supplyRows.length,
      listing: listingRows.length,
      all: activeRows.length,
      open: activeRows.filter(open).length,
      contacted: activeRows.filter((r) => r.status === "contacted").length,
      done: activeRows.filter((r) => r.status === "converted" || r.status === "approved").length,
      closed: activeRows.filter((r) => r.status === "closed" || r.status === "rejected").length,
    };
  }, [supplyRows, listingRows, activeRows]);

  const filtered = activeRows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "open") return r.status === "new" || r.status === "in_review";
    if (tab === "contacted") return r.status === "contacted";
    if (tab === "done") return r.status === "converted" || r.status === "approved";
    return r.status === "closed" || r.status === "rejected";
  });

  const statusCell = (row: { id: string; status: string }) => (
    <select
      value={row.status}
      onChange={(e) => setStatus.mutate({ table, id: row.id, status: e.target.value })}
      className="h-9 rounded-lg border border-border bg-card px-2 text-[12.5px] font-semibold text-foreground outline-none"
      aria-label="حالة الطلب"
    >
      {statusOrder.map((s) => (
        <option key={s} value={s}>
          {requestStatusLabels[s] ?? s}
        </option>
      ))}
    </select>
  );

  const noteCell = (row: { id: string; admin_notes: string | null }) => (
    <button
      type="button"
      onClick={() => {
        const note = window.prompt("ملاحظة الإدارة", row.admin_notes ?? "");
        if (note !== null) saveNote.mutate({ table, id: row.id, note });
      }}
      className="text-[12.5px] font-semibold text-primary"
    >
      {row.admin_notes ? "تعديل الملاحظة" : "إضافة ملاحظة"}
    </button>
  );

  return (
    <>
      <PageHero
        title="طلبات العقارات"
        subtitle="طلبات توفير العقار وطلبات عرض العقار في شاشة واحدة مع متابعة كل طلب حتى إغلاقه."
        icon={Search}
        stats={[
          { value: String(counts.open), label: "قيد المراجعة" },
          { value: String(counts.contacted), label: "جاري المتابعة" },
          { value: String(counts.done), label: "تم الإنجاز" },
        ]}
      />

      <Pills
        variant="card"
        defaultKey="supply"
        onChange={(key) => {
          setSource(key);
          setTab("all");
        }}
        items={[
          { key: "supply", label: "طلبات توفير عقار", count: counts.supply, icon: Search },
          { key: "listing", label: "طلبات عرض عقار", count: counts.listing, icon: Inbox },
        ]}
      />

      <Pills
        key={source}
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: counts.all },
          { key: "open", label: "قيد المراجعة", count: counts.open },
          { key: "contacted", label: "تم التواصل", count: counts.contacted },
          { key: "done", label: "منجزة", count: counts.done },
          { key: "closed", label: "مغلقة", count: counts.closed },
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
      ) : source === "supply" ? (
        <DataTable<SupplyRow>
          rows={filtered as SupplyRow[]}
          draggableRows
          dragLabel="طلب توفير عقار"
          showColumnsButton
          searchPlaceholder="بحث بالاسم أو الجوال"
          emptyState={
            <EmptyState
              text="لا توجد طلبات توفير عقار"
              hint="الطلبات الواردة من الموقع أو المسجلة من الفريق ستظهر هنا."
            />
          }
          columns={[
            { header: "مقدّم الطلب", sortable: true, cell: (r) => r.full_name, className: "font-semibold" },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
            { header: "نوع الطلب", cell: (r) => (r.request_type === "buy" ? "شراء" : "إيجار") },
            { header: "نوع العقار", cell: (r) => r.property_type ?? "—" },
            {
              header: "الموقع",
              cell: (r) => [r.city, r.districts].filter(Boolean).join(" - ") || "—",
            },
            {
              header: "الميزانية",
              cell: (r) =>
                r.budget_min || r.budget_max
                  ? `${formatCurrency(r.budget_min)} — ${formatCurrency(r.budget_max)}`
                  : "—",
            },
            {
              header: "مقدّم الطلب",
              cell: (r) => (
                <Chip tone={r.requester_type === "broker" ? "gold" : "primary"}>
                  {r.requester_type === "broker" ? (r.broker_name ?? "وسيط") : "عميل"}
                </Chip>
              ),
            },
            { header: "الحالة", cell: statusCell },
            { header: "ملاحظات", cell: noteCell },
            { header: "التاريخ", sortable: true, value: (r) => r.created_at, cell: (r) => formatDate(r.created_at) },
          ]}
        />
      ) : (
        <DataTable<ListingRow>
          rows={filtered as ListingRow[]}
          draggableRows
          dragLabel="طلب عرض عقار"
          showColumnsButton
          searchPlaceholder="بحث بالاسم أو الجوال"
          emptyState={
            <EmptyState
              text="لا توجد طلبات عرض عقار"
              hint="طلبات المالكين المرسلة من الموقع ستظهر هنا للمراجعة والاعتماد."
            />
          }
          columns={[
            { header: "المالك", sortable: true, cell: (r) => r.full_name, className: "font-semibold" },
            { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
            { header: "الغرض", cell: (r) => (r.purpose === "sale" ? "بيع" : "إيجار") },
            { header: "نوع العقار", cell: (r) => r.property_type ?? "—" },
            {
              header: "الموقع",
              cell: (r) => [r.city, r.district].filter(Boolean).join(" - ") || "—",
            },
            { header: "السعر المطلوب", cell: (r) => r.asking_price ?? "—" },
            { header: "الحالة", cell: statusCell },
            { header: "ملاحظات", cell: noteCell },
            { header: "التاريخ", sortable: true, value: (r) => r.created_at, cell: (r) => formatDate(r.created_at) },
          ]}
        />
      )}
    </>
  );
}
