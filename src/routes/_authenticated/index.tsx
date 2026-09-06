import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  Loader2,
  ReceiptText,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { requestStatusLabels, taskStatusLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | الرشودي للعقارات" },
      {
        name: "description",
        content: "نظرة سريعة على العقارات والطلبات والاستحقاقات والمهام في نظام الرشودي للعقارات.",
      },
      { property: "og:title", content: "لوحة التحكم | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "نظرة سريعة على العقارات والطلبات والاستحقاقات والمهام.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { profile } = useCurrentUser();

  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [properties, requests, contracts, invoices, tasks, contacts, payments] =
        await Promise.all([
          supabase.from("properties").select("id", { count: "exact", head: true }),
          supabase
            .from("listing_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "new"),
          supabase
            .from("contracts")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
          supabase.from("invoices").select("id", { count: "exact", head: true }).neq("status", "paid"),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .not("status", "in", "(done,cancelled)"),
          supabase.from("contacts").select("id", { count: "exact", head: true }),
          supabase
            .from("contract_payments")
            .select("amount_due, amount_paid, due_date, status")
            .neq("status", "paid")
            .lte("due_date", today),
        ]);

      const overdue = (payments.data ?? []).reduce(
        (s, r) => s + (Number(r.amount_due ?? 0) - Number(r.amount_paid ?? 0)),
        0,
      );

      return {
        properties: properties.count ?? 0,
        requests: requests.count ?? 0,
        contracts: contracts.count ?? 0,
        invoices: invoices.count ?? 0,
        tasks: tasks.count ?? 0,
        contacts: contacts.count ?? 0,
        overdue,
      };
    },
  });

  const latestRequests = useQuery({
    queryKey: ["dashboard-latest-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_requests")
        .select("id, full_name, property_type, city, status, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const latestTasks = useQuery({
    queryKey: ["dashboard-latest-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date")
        .not("status", "in", "(done,cancelled)")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHero
        title={`أهلًا ${profile?.full_name ?? ""}`}
        subtitle="كل الأرقام هنا محسوبة من قاعدة البيانات مباشرة، ولا تحتوي أي بيانات تجريبية."
        icon={Building2}
      />

      {summary.isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري حساب المؤشرات…</p>
        </div>
      ) : summary.error ? (
        <div className="surface-card px-6 py-10 text-center text-[13px] text-destructive" dir="ltr">
          {summary.error instanceof Error ? summary.error.message : "خطأ غير معروف"}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            to="/properties"
            label="العقارات"
            value={summary.data?.properties ?? 0}
            icon={Building2}
          />
          <StatCard
            to="/submissions"
            label="طلبات جديدة"
            value={summary.data?.requests ?? 0}
            icon={ClipboardList}
          />
          <StatCard
            to="/contracts"
            label="عقود سارية"
            value={summary.data?.contracts ?? 0}
            icon={FileText}
          />
          <StatCard
            to="/invoices"
            label="فواتير غير مسددة"
            value={summary.data?.invoices ?? 0}
            icon={ReceiptText}
          />
          <StatCard to="/tasks" label="مهام مفتوحة" value={summary.data?.tasks ?? 0} icon={CalendarClock} />
          <StatCard to="/clients" label="جهات الاتصال" value={summary.data?.contacts ?? 0} icon={Users} />
          <div className="surface-card px-5 py-5 sm:col-span-2">
            <p className="text-[12.5px] text-muted-foreground">مبالغ مستحقة متأخرة</p>
            <p className="mt-2 text-xl font-bold text-destructive">
              {formatCurrency(summary.data?.overdue ?? 0)}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              محسوبة من دفعات العقود التي تجاوز تاريخ استحقاقها اليوم ولم تُسدد.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="أحدث الطلبات" to="/submissions">
          {latestRequests.isLoading ? (
            <PanelLoading />
          ) : (latestRequests.data ?? []).length === 0 ? (
            <PanelEmpty text="لا توجد طلبات بعد" />
          ) : (
            <ul className="divide-y divide-border">
              {(latestRequests.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-[13.5px] font-semibold text-foreground">{r.full_name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {[r.property_type, r.city].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Chip tone={r.status === "new" ? "warning" : "neutral"}>
                    {requestStatusLabels[r.status] ?? r.status}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="المهام القادمة" to="/tasks">
          {latestTasks.isLoading ? (
            <PanelLoading />
          ) : (latestTasks.data ?? []).length === 0 ? (
            <PanelEmpty text="لا توجد مهام مفتوحة" />
          ) : (
            <ul className="divide-y divide-border">
              {(latestTasks.data ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-[13.5px] font-semibold text-foreground">{t.title}</p>
                    <p className="text-[12px] text-muted-foreground">{formatDate(t.due_date)}</p>
                  </div>
                  <Chip tone="primary">{taskStatusLabels[t.status] ?? t.status}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function StatCard({
  to,
  label,
  value,
  icon: Icon,
}: {
  to: string;
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <Link to={to} className="surface-card block px-5 py-5 transition-colors hover:bg-muted/50">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </Link>
  );
}

function Panel({
  title,
  to,
  children,
}: {
  title: string;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card px-5 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        <Link to={to} className="text-[12.5px] font-semibold text-primary hover:underline">
          عرض الكل
        </Link>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function PanelLoading() {
  return (
    <div className="grid place-items-center py-10">
      <Loader2 className="size-5 animate-spin text-primary" />
    </div>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return <p className="py-10 text-center text-[13px] text-muted-foreground">{text}</p>;
}
