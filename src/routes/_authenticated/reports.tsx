import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Loader2 } from "lucide-react";

import { PageHero } from "@/components/kit/PageHero";
import { formatCurrency } from "@/components/kit/LiveTable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "التقارير | مثراء العقارية" },
      { name: "description", content: "مؤشرات التحصيل والعقود والفرص محسوبة من قاعدة البيانات." },
      { property: "og:title", content: "التقارير | مثراء العقارية" },
      { property: "og:description", content: "مؤشرات التحصيل والعقود والفرص من بيانات النظام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const [payments, invoices, contracts, opportunities] = await Promise.all([
        supabase.from("contract_payments").select("amount_due, amount_paid, status, due_date"),
        supabase.from("invoices").select("total, status"),
        supabase.from("contracts").select("status, end_date"),
        supabase.from("opportunities").select("stage, expected_value"),
      ]);
      if (payments.error) throw payments.error;

      const rows = payments.data ?? [];
      const due = rows.reduce((s, r) => s + Number(r.amount_due ?? 0), 0);
      const paid = rows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const overdue = rows
        .filter((r) => r.status !== "paid" && r.due_date && r.due_date < today)
        .reduce((s, r) => s + (Number(r.amount_due ?? 0) - Number(r.amount_paid ?? 0)), 0);

      return {
        due,
        paid,
        overdue,
        collectionRate: due > 0 ? Math.round((paid / due) * 100) : 0,
        invoicesUnpaid: (invoices.data ?? []).filter((i) => i.status !== "paid").length,
        contractsActive: (contracts.data ?? []).filter((c) => c.status === "active").length,
        pipeline: (opportunities.data ?? [])
          .filter((o) => o.stage !== "won" && o.stage !== "lost")
          .reduce((s, o) => s + Number(o.expected_value ?? 0), 0),
      };
    },
  });

  return (
    <>
      <PageHero
        title="التقارير"
        subtitle="كل الأرقام محسوبة مباشرة من سجلات النظام، بدون أي بيانات تجريبية."
        icon={BarChart3}
      />

      {isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري حساب المؤشرات…</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="إجمالي المستحق" value={formatCurrency(data?.due ?? 0)} />
          <Stat label="إجمالي المحصّل" value={formatCurrency(data?.paid ?? 0)} />
          <Stat label="متأخرات" value={formatCurrency(data?.overdue ?? 0)} />
          <Stat label="نسبة التحصيل" value={`${data?.collectionRate ?? 0}%`} />
          <Stat label="فواتير غير مسددة" value={String(data?.invoicesUnpaid ?? 0)} />
          <Stat label="عقود سارية" value={String(data?.contractsActive ?? 0)} />
          <Stat label="قيمة الفرص المفتوحة" value={formatCurrency(data?.pipeline ?? 0)} />
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card px-5 py-5">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
