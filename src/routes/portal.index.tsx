import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { getPortalOverview } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "بوابة العميل | مثراء العقارية" },
      { name: "description", content: "تابع عقودك وفواتيرك وأقساطك مع مثراء العقارية." },
      { property: "og:title", content: "بوابة العميل | مثراء العقارية" },
      { property: "og:description", content: "تابع عقودك وفواتيرك وأقساطك مع مثراء العقارية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalHome,
});

const money = (v: number | null | undefined) =>
  `${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function PortalHome() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => getPortalOverview(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.payments.filter((p) => p.status !== "paid" && p.due_date >= today).slice(0, 5);
  const overdue = data.payments.filter((p) => p.status !== "paid" && p.due_date < today);
  const remaining = data.payments.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
  const paid = data.payments.reduce((s, p) => s + Number(p.amount_paid), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold text-foreground">{data.contact?.full_name ?? "مرحبًا"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          رقم الهوية: {data.contact?.national_id ?? "—"} • الجوال: {data.contact?.phone ?? "—"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="عقود نشطة" value={String(data.contracts.filter((c) => c.status === "active").length)} />
        <Stat label="فواتير" value={String(data.invoices.length)} />
        <Stat label="إجمالي المدفوع" value={money(paid)} tone="text-emerald-600" />
        <Stat label="المتبقي" value={money(remaining)} tone={overdue.length ? "text-destructive" : "text-foreground"} />
      </div>

      {overdue.length ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          لديك {overdue.length} دفعة متأخرة — يرجى التواصل مع الإدارة للسداد.
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card">
        <header className="border-b border-border px-5 py-3 text-sm font-bold">أقرب الدفعات</header>
        {upcoming.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">لا توجد دفعات قادمة.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-semibold">دفعة رقم {p.payment_number}</span>
                <span className="text-muted-foreground">{p.due_date}</span>
                <span className="font-bold">{money(Number(p.amount_due) - Number(p.amount_paid))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3">
        <Link to="/portal/contracts" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          عقودي
        </Link>
        <Link to="/portal/invoices" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          فواتيري
        </Link>
      </div>
    </div>
  );
}
