import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { getPortalOverview } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/contracts/")({
  head: () => ({
    meta: [
      { title: "عقودي | بوابة عميل مثراء" },
      { name: "description", content: "استعرض عقودك الإيجارية وجدول الأقساط الخاص بكل عقد." },
      { property: "og:title", content: "عقودي | بوابة عميل مثراء" },
      { property: "og:description", content: "استعرض عقودك الإيجارية وجدول الأقساط الخاص بكل عقد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalContracts,
});

const cycleLabel: Record<string, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semi_annual: "نصف سنوي",
  annual: "سنوي",
};

function PortalContracts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => getPortalOverview(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const contracts = data?.contracts ?? [];
  const payments = data?.payments ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">العقود</h1>
        <p className="text-sm text-muted-foreground">جميع عقودك مع مثراء العقارية.</p>
      </div>

      {contracts.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">لا توجد عقود مسجّلة باسمك.</p>
      ) : null}

      {contracts.map((c) => {
        const own = payments.filter((p) => p.contract_id === c.id);
        const paid = own.filter((p) => p.status === "paid").length;
        const late = own.filter((p) => p.status !== "paid" && p.due_date < today).length;
        return (
          <article key={c.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">رقم العقد</p>
                <p className="text-base font-bold">{c.contract_number}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {c.status === "active" ? "نشط" : c.status}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">تاريخ البداية</dt>
                <dd className="font-semibold">{c.start_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">تاريخ الانتهاء</dt>
                <dd className="font-semibold">{c.end_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">دورة الدفع</dt>
                <dd className="font-semibold">{cycleLabel[c.payment_cycle ?? ""] ?? c.payment_cycle ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">الإيجار السنوي</dt>
                <dd className="font-semibold">{Number(c.annual_rent ?? 0).toLocaleString("en-US")} ر.س</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                مسددة {paid} • {late ? <span className="text-destructive">متأخرة {late}</span> : "لا توجد متأخرات"}
              </span>
              <Link
                to="/portal/contracts/$contractId"
                params={{ contractId: c.id }}
                className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                جدول الأقساط ←
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
