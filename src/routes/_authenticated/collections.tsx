import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Download, LineChart, PiggyBank, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { CardsSkeleton } from "@/components/kit/Skeleton";
import { StatBar, StatCard } from "@/components/kit/StatCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/collections")({
  head: () => ({
    meta: [
      { title: "تقرير التحصيلات والمؤشرات المالية | مثراء العقارية" },
      {
        name: "description",
        content: "تقرير شهري للتحصيلات ونسبة السداد والمبالغ المتأخرة والمتوقعة لكل شهر.",
      },
      { property: "og:title", content: "تقرير التحصيلات والمؤشرات المالية" },
      { property: "og:description", content: "المحصّل والمتأخر والمتوقع شهريًا مع نسبة التحصيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectionsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n);
const monthKey = (d: string) => d.slice(0, 7);
const monthLabel = (key: string) =>
  new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(
    new Date(`${key}-01T00:00:00`),
  );

type Row = {
  month: string;
  due: number;
  collected: number;
  overdue: number;
  count: number;
};

function CollectionsPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading, error } = useQuery({
    queryKey: ["collections-report", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments")
        .select("id, due_date, amount_due, amount_paid, status")
        .gte("due_date", `${year}-01-01`)
        .lte("due_date", `${year}-12-31`)
        .order("due_date", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo<Row[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = new Map<string, Row>();
    for (const p of data ?? []) {
      const key = monthKey(p.due_date);
      const row = map.get(key) ?? { month: key, due: 0, collected: 0, overdue: 0, count: 0 };
      const due = Number(p.amount_due ?? 0);
      const paid = Number(p.amount_paid ?? 0);
      row.due += due;
      row.collected += paid;
      row.count += 1;
      if (p.status !== "paid" && p.due_date < today) row.overdue += Math.max(0, due - paid);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  const totals = rows.reduce(
    (t, r) => ({
      due: t.due + r.due,
      collected: t.collected + r.collected,
      overdue: t.overdue + r.overdue,
    }),
    { due: 0, collected: 0, overdue: 0 },
  );
  const rate = totals.due ? Math.round((totals.collected / totals.due) * 100) : 0;

  const download = () =>
    exportToExcel(
      rows.map((r) => ({
        الشهر: monthLabel(r.month),
        "عدد الدفعات": r.count,
        "المستحق (ر.س)": Math.round(r.due),
        "المحصّل (ر.س)": Math.round(r.collected),
        "المتأخر (ر.س)": Math.round(r.overdue),
        "نسبة التحصيل": r.due ? `${Math.round((r.collected / r.due) * 100)}%` : "—",
      })),
      `تقرير-التحصيلات-${year}`,
    );

  return (
    <>
      <PageHero
        title="تقرير التحصيلات والمؤشرات المالية"
        subtitle="المستحق والمحصّل والمتأخر لكل شهر، مع نسبة التحصيل الإجمالية للسنة."
        icon={LineChart}
      />

      <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold">السنة:</span>
          {[year - 1, year, year + 1].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                y === year
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={download} disabled={!rows.length}>
          <Download className="size-4" />
          تصدير Excel
        </Button>
      </div>

      {isLoading ? (
        <CardsSkeleton count={4} />
      ) : error ? (
        <p className="surface-card px-5 py-6 text-[13px] text-destructive">
          تعذّر تحميل التقرير: {(error as Error).message}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="إجمالي المستحق" value={totals.due} suffix="ر.س" icon={Banknote} tone="primary" />
            <StatCard
              label="إجمالي المحصّل"
              value={totals.collected}
              suffix="ر.س"
              icon={PiggyBank}
              tone="success"
            />
            <StatCard label="المتأخر" value={totals.overdue} suffix="ر.س" icon={TrendingUp} tone="danger" />
            <StatCard label="نسبة التحصيل" value={rate} suffix="%" icon={LineChart} tone="warning" />
          </div>

          <section className="surface-card overflow-hidden">
            <header className="border-b border-border px-5 py-4">
              <h2 className="text-[14.5px] font-bold">التفصيل الشهري</h2>
            </header>
            {rows.length ? (
              <ul className="divide-y divide-border/70">
                {rows.map((r) => {
                  const pct = r.due ? Math.round((r.collected / r.due) * 100) : 0;
                  return (
                    <li key={r.month} className="px-5 py-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                        <span className="font-bold">{monthLabel(r.month)}</span>
                        <span className="flex flex-wrap gap-4 text-muted-foreground">
                          <span>المستحق {fmt(r.due)}</span>
                          <span className="text-success">المحصّل {fmt(r.collected)}</span>
                          {r.overdue > 0 ? (
                            <span className="text-destructive">المتأخر {fmt(r.overdue)}</span>
                          ) : null}
                          <span className="font-bold text-foreground">{pct}%</span>
                        </span>
                      </div>
                      <StatBar value={pct} tone={pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger"} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                text={`لا توجد دفعات مسجّلة لسنة ${year}`}
                hint="أضف عقودًا بجدول دفعات ليظهر التقرير الشهري هنا."
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
