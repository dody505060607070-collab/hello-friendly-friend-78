import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { invoiceStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  vat_amount: number | null;
  total: number | null;
  status: string;
  contact: { full_name: string } | null;
  contract: { contract_number: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير | مثراء العقارية" },
      { name: "description", content: "فواتير العقود والخدمات مع الضريبة وحالة السداد." },
      { property: "og:title", content: "الفواتير | مثراء العقارية" },
      { property: "og:description", content: "فواتير العقود والخدمات مع الضريبة وحالة السداد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  return (
    <>
      <PageHero
        title="الفواتير"
        subtitle="الفواتير الصادرة وحالة سدادها، وتُحسب الضريبة حسب النسبة في الإعدادات."
        icon={ReceiptText}
      />

      <LiveTable<Row>
        table="invoices"
        select="id, invoice_number, issue_date, due_date, subtotal, vat_amount, total, status, contact:contact_id(full_name), contract:contract_id(contract_number)"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث برقم الفاتورة أو العميل"
        emptyText="لا توجد فواتير"
        emptyHint="أنشئ فاتورة من عقد أو دفعة لتظهر هنا مع حالة السداد."
        columns={[
          { header: "رقم الفاتورة", cell: (r) => r.invoice_number ?? "—", className: "font-semibold" },
          { header: "العميل", cell: (r) => r.contact?.full_name ?? "—" },
          { header: "العقد", cell: (r) => r.contract?.contract_number ?? "—" },
          { header: "الإصدار", cell: (r) => formatDate(r.issue_date) },
          { header: "الاستحقاق", cell: (r) => formatDate(r.due_date) },
          { header: "قبل الضريبة", cell: (r) => formatCurrency(r.subtotal) },
          { header: "الضريبة", cell: (r) => formatCurrency(r.vat_amount) },
          { header: "الإجمالي", cell: (r) => formatCurrency(r.total) },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip
                tone={
                  r.status === "paid"
                    ? "success"
                    : r.status === "overdue"
                      ? "danger"
                      : r.status === "partial"
                        ? "warning"
                        : "neutral"
                }
              >
                {invoiceStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
        ]}
      />
    </>
  );
}
