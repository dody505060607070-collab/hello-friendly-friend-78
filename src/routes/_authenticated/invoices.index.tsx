import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, Loader2, Pencil, Plus, ReceiptText } from "lucide-react";
import { useMemo } from "react";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { ToneLegend } from "@/components/kit/ToneLegend";
import { supabase } from "@/integrations/supabase/client";
import { invoiceStatusLabels } from "@/lib/labels";
import { invoiceRowTone, rowToneClass } from "@/lib/row-tone";

type Row = {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
  status: string;
  contact: { full_name: string } | null;
  contract: { contract_number: string } | null;
};

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({ meta: [
    { title: "الفواتير | مثراء العقارية" },
    { name: "description", content: "إدارة الفواتير وحالات السداد والمدفوعات." },
    { property: "og:title", content: "الفواتير | مثراء العقارية" },
    { property: "og:description", content: "الفواتير الصادرة وحالات سدادها." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: ["invoices", "full-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("id, invoice_number, issue_date, due_date, subtotal, vat_amount, total, status, contact:contact_id(full_name), contract:contract_id(contract_number)").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = list.data ?? [];
  const stats = useMemo(() => ({
    sent: rows.filter((row) => ["unpaid", "partial", "overdue"].includes(row.status)).length,
    paid: rows.filter((row) => row.status === "paid").length,
    outstanding: rows.filter((row) => !["paid", "cancelled"].includes(row.status)).reduce((sum, row) => sum + Number(row.total), 0),
  }), [rows]);

  return <>
    <PageHero title="الفواتير" subtitle="إدارة الفواتير وحالات إصدارها وسدادها" icon={ReceiptText} stats={[
      { value: String(stats.sent), label: "فاتورة مرسلة" },
      { value: String(stats.paid), label: "فاتورة مدفوعة" },
      { value: formatCurrency(stats.outstanding), label: "قيمة مستحقة" },
    ]} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/invoice-form" search={{ id: "", ownerId: "" }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"><Plus className="size-4" />إنشاء فاتورة</Link>
      <nav className="text-[12.5px] text-muted-foreground">الفواتير &nbsp; / &nbsp; القائمة</nav>
    </div>
    <ToneLegend tones={["overdue", "today", "urgent", "progress", "done"]} />
    {list.isLoading ? <div className="surface-card grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div> :
      <DataTable<Row> rows={rows} rowClassName={(r) => rowToneClass[invoiceRowTone(r)]} onRowClick={(r) => navigate({ to: "/invoices/$invoiceId", params: { invoiceId: r.id } })} showColumnsButton selectable dragLabel="فاتورة" exportFileName="قائمة الفواتير" searchPlaceholder="بحث برقم الفاتورة أو المالك" emptyState={<EmptyState text="لا توجد فواتير" hint="أنشئ فاتورة جديدة لتظهر هنا مع حالة السداد." />} columns={[
        { header: "رقم الفاتورة", sortable: true, value: (r) => r.invoice_number, cell: (r) => <Link to="/invoices/$invoiceId" params={{ invoiceId: r.id }} dir="ltr" className="font-bold text-primary hover:underline">{r.invoice_number}</Link> },
        { header: "المالك", value: (r) => r.contact?.full_name, cell: (r) => r.contact?.full_name ?? "—" },
        { header: "التاريخ", sortable: true, value: (r) => r.issue_date, cell: (r) => formatDate(r.issue_date) },
        { header: "الاستحقاق", sortable: true, value: (r) => r.due_date, cell: (r) => formatDate(r.due_date) },
        { header: "الحالة", value: (r) => invoiceStatusLabels[r.status] ?? r.status, cell: (r) => <Chip tone={r.status === "paid" ? "success" : r.status === "overdue" ? "danger" : r.status === "partial" ? "warning" : "neutral"}>{invoiceStatusLabels[r.status] ?? r.status}</Chip> },
        { header: "قبل الضريبة", sortable: true, value: (r) => r.subtotal, cell: (r) => formatCurrency(r.subtotal) },
        { header: "الضريبة", sortable: true, value: (r) => r.vat_amount, cell: (r) => formatCurrency(r.vat_amount) },
        { header: "الإجمالي", sortable: true, value: (r) => r.total, cell: (r) => <strong>{formatCurrency(r.total)}</strong> },
        { header: "إجراءات", cell: (r) => <div className="flex items-center gap-1"><Link to="/invoices/$invoiceId" params={{ invoiceId: r.id }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" aria-label="عرض الفاتورة" title="عرض وتسجيل دفعة"><Eye className="size-4" /></Link><Link to="/invoice-form" search={{ id: r.id, ownerId: "" }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" aria-label="تعديل الفاتورة" title="تعديل"><Pencil className="size-4" /></Link></div> },
      ]} />}
  </>;
}