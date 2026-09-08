import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { getPortalInvoice } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/invoices/$invoiceId")({
  head: () => ({
    meta: [
      { title: "عرض الفاتورة | بوابة عميل مثراء" },
      { name: "description", content: "تفاصيل الفاتورة وبنودها والإجمالي شامل الضريبة." },
      { property: "og:title", content: "عرض الفاتورة | بوابة عميل مثراء" },
      { property: "og:description", content: "تفاصيل الفاتورة وبنودها والإجمالي شامل الضريبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoiceView,
});

const money = (v: number) =>
  `${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

function InvoiceView() {
  const { invoiceId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-invoice", invoiceId],
    queryFn: () => getPortalInvoice({ data: { invoiceId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const inv = data.invoice as {
    invoice_number: string;
    issue_date: string;
    due_date: string | null;
    status: string;
    subtotal: number;
    vat_amount: number;
    total: number;
    notes: string | null;
    contact: { full_name: string; national_id: string | null; phone: string | null } | null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/portal/invoices" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">
          رجوع للفواتير
        </Link>
        <button onClick={() => window.print()} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          طباعة
        </button>
      </div>

      <article className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-2 bg-gradient-to-l from-[hsl(var(--primary))] to-amber-300" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="text-right">
              <h1 className="text-2xl font-bold text-primary">فاتورة</h1>
              <p className="text-sm text-muted-foreground">مثراء العقارية</p>
            </div>
            <dl className="text-sm">
              <div className="flex gap-6 border-b border-border py-1.5">
                <dt className="text-muted-foreground">رقم الفاتورة</dt>
                <dd className="font-bold">{inv.invoice_number}</dd>
              </div>
              <div className="flex gap-6 border-b border-border py-1.5">
                <dt className="text-muted-foreground">UUID</dt>
                <dd className="font-mono text-xs font-bold" dir="ltr">{invoiceId}</dd>
              </div>
              <div className="flex gap-6 border-b border-border py-1.5">
                <dt className="text-muted-foreground">تاريخ الإصدار</dt>
                <dd className="font-bold">{inv.issue_date}</dd>
              </div>
              <div className="flex gap-6 py-1.5">
                <dt className="text-muted-foreground">الحالة</dt>
                <dd className="font-bold">{inv.status === "paid" ? "مدفوعة" : "بانتظار السداد"}</dd>
              </div>
            </dl>

          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">من</span>
              <p className="mt-2 font-bold">مثراء العقارية</p>
              <p className="text-sm text-muted-foreground">بريدة، المملكة العربية السعودية</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">إلى</span>
              <p className="mt-2 font-bold">{inv.contact?.full_name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">رقم الهوية: {inv.contact?.national_id ?? "—"}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">{inv.contact?.phone ?? "—"}</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-right text-sm">
              <thead className="bg-primary text-primary-foreground text-xs">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">البيان</th>
                  <th className="px-4 py-3">العدد</th>
                  <th className="px-4 py-3">سعر الوحدة</th>
                  <th className="px-4 py-3">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td className="px-4 py-3">{idx + 1}</td>
                    <td className="px-4 py-3">{it.description}</td>
                    <td className="px-4 py-3">{Number(it.quantity).toFixed(2)}</td>
                    <td className="px-4 py-3">{money(Number(it.unit_price))}</td>
                    <td className="px-4 py-3 font-semibold">{money(Number(it.total))}</td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">لا توجد بنود.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <dl className="mt-6 max-w-sm space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">الإجمالي قبل الضريبة</dt>
              <dd className="font-semibold">{money(Number(inv.subtotal))}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">ضريبة القيمة المضافة</dt>
              <dd className="font-semibold">{money(Number(inv.vat_amount))}</dd>
            </div>
            <div className="flex justify-between border-b-2 border-primary pb-2">
              <dt className="font-bold">الإجمالي شامل الضريبة</dt>
              <dd className="text-base font-bold">{money(Number(inv.total))}</dd>
            </div>
          </dl>

          {inv.notes ? <p className="mt-6 text-sm text-muted-foreground">{inv.notes}</p> : null}
        </div>
      </article>
    </div>
  );
}
