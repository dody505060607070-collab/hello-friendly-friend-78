import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, CalendarClock, CircleCheck, FileWarning, Wallet } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { CardsSkeleton } from "@/components/kit/Skeleton";
import { StatCard } from "@/components/kit/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { rowToneClass } from "@/lib/row-tone";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "مركز التنبيهات | مثراء العقارية" },
      {
        name: "description",
        content: "تنبيهات العقود القريبة من الانتهاء والدفعات المتأخرة والمهام المتجاوزة موعدها.",
      },
      { property: "og:title", content: "مركز التنبيهات | مثراء العقارية" },
      { property: "og:description", content: "العقود المنتهية قريبًا والدفعات المتأخرة في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AlertsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n);
const daysLeft = (d: string) =>
  Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);

function useAlerts() {
  return useQuery({
    queryKey: ["alerts-center"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

      const [contracts, payments, tasks] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, contract_number, end_date, status, annual_rent, properties:property_id(name)")
          .eq("status", "active")
          .not("end_date", "is", null)
          .lte("end_date", in60)
          .order("end_date", { ascending: true })
          .limit(50),
        supabase
          .from("contract_payments")
          .select("id, due_date, amount_due, amount_paid, status, contract_id, contracts:contract_id(contract_number)")
          .neq("status", "paid")
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(50),
        supabase
          .from("tasks")
          .select("id, title, due_date, status, priority")
          .not("status", "in", "(done,approved)")
          .not("due_date", "is", null)
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(50),
      ]);

      if (contracts.error) throw contracts.error;
      if (payments.error) throw payments.error;
      if (tasks.error) throw tasks.error;

      return {
        contracts: contracts.data ?? [],
        payments: payments.data ?? [],
        tasks: tasks.data ?? [],
      };
    },
  });
}

function AlertsPage() {
  const { data, isLoading, error } = useAlerts();

  const overdueAmount = (data?.payments ?? []).reduce(
    (s, p) => s + (Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0)),
    0,
  );
  const expiringSoon = (data?.contracts ?? []).filter(
    (c) => c.end_date && daysLeft(c.end_date) <= 30,
  ).length;

  return (
    <>
      <PageHero
        title="مركز التنبيهات"
        subtitle="كل ما يحتاج تدخّلًا اليوم: عقود على وشك الانتهاء، دفعات متأخرة، ومهام تجاوزت موعدها."
        icon={BellRing}
      />

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : error ? (
        <p className="surface-card px-5 py-6 text-[13px] text-destructive">
          تعذّر تحميل التنبيهات: {(error as Error).message}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="عقود تنتهي خلال 60 يومًا"
              value={data?.contracts.length ?? 0}
              hint={`${expiringSoon} منها خلال 30 يومًا`}
              icon={CalendarClock}
              tone="warning"
            />
            <StatCard
              label="دفعات متأخرة"
              value={data?.payments.length ?? 0}
              hint={`إجمالي المتأخر ${fmt(overdueAmount)} ر.س`}
              icon={Wallet}
              tone="danger"
            />
            <StatCard
              label="مهام تجاوزت موعدها"
              value={data?.tasks.length ?? 0}
              icon={FileWarning}
              tone="primary"
            />
          </div>

          <section className="surface-card overflow-hidden">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-[14.5px] font-bold">العقود القريبة من الانتهاء</h2>
              <Link to="/contracts" className="text-[12.5px] font-semibold text-primary">
                كل العقود ←
              </Link>
            </header>
            {data?.contracts.length ? (
              <ul className="divide-y divide-border/70">
                {data.contracts.map((c) => {
                  const left = c.end_date ? daysLeft(c.end_date) : 0;
                  return (
                    <li
                      key={c.id}
                      className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px] ${
                        left <= 0 ? rowToneClass.overdue : left <= 30 ? rowToneClass.urgent : ""
                      }`}
                    >
                      <span className="font-semibold">
                        {c.contract_number}
                        <span className="ms-2 font-normal text-muted-foreground">
                          {(c.properties as { name?: string } | null)?.name ?? "—"}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-muted-foreground">ينتهي: {c.end_date}</span>
                        <Chip tone={left <= 0 ? "danger" : left <= 30 ? "warning" : "neutral"}>
                          {left <= 0 ? "منتهٍ" : `باقٍ ${left} يوم`}
                        </Chip>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                text="لا توجد عقود قريبة من الانتهاء"
                hint="سننبّهك هنا قبل 60 يومًا من انتهاء أي عقد نشط."
                icon={CircleCheck}
              />
            )}
          </section>

          <section className="surface-card overflow-hidden">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-[14.5px] font-bold">الدفعات المتأخرة</h2>
              <Link to="/invoices" className="text-[12.5px] font-semibold text-primary">
                الفواتير ←
              </Link>
            </header>
            {data?.payments.length ? (
              <ul className="divide-y divide-border/70">
                {data.payments.map((p) => (
                  <li
                    key={p.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px] ${rowToneClass.overdue}`}
                  >
                    <span className="font-semibold">
                      {(p.contracts as { contract_number?: string } | null)?.contract_number ?? "—"}
                    </span>
                    <span className="flex items-center gap-3">
                      <span>استحقاق {p.due_date}</span>
                      <span className="font-bold">
                        {fmt(Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0))} ر.س
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                text="لا توجد دفعات متأخرة"
                hint="كل الدفعات المستحقة حتى اليوم محصّلة."
                icon={CircleCheck}
              />
            )}
          </section>

          <section className="surface-card overflow-hidden">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-[14.5px] font-bold">مهام متأخرة</h2>
              <Link to="/tasks" className="text-[12.5px] font-semibold text-primary">
                كل المهام ←
              </Link>
            </header>
            {data?.tasks.length ? (
              <ul className="divide-y divide-border/70">
                {data.tasks.map((t) => (
                  <li
                    key={t.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px] ${rowToneClass.overdue}`}
                  >
                    <span className="font-semibold">{t.title}</span>
                    <span className="text-muted-foreground">تاريخ التسليم {t.due_date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="لا توجد مهام متأخرة" hint="فريقك ملتزم بالمواعيد." icon={CircleCheck} />
            )}
          </section>
        </>
      )}
    </>
  );
}
