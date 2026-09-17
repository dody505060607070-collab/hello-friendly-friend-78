import { useMemo } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { Chip } from "@/components/kit/Chip";
import { AnalyticsCard } from "@/components/dashboard/AnalyticsCard";
import { MetricsCustomizer, type MetricDef } from "@/components/dashboard/MetricsCustomizer";
import { useMetricsVisibility } from "@/components/dashboard/useMetricsVisibility";
import {
  WeeklyOccupancyChart,
  UnitStatusChart,
  ContractExpiryHeatmapChart,
} from "@/components/dashboard/DashboardCharts";
import * as A from "@/lib/analytics";

const METRICS: MetricDef[] = [
  { key: "units_distribution", label: "توزيع الوحدات حسب النوع" },
  { key: "reservations", label: "الحجوزات النشطة والمعلّقة" },
  { key: "weekly_occupancy", label: "الإشغال الأسبوعي" },
  { key: "unit_status_chart", label: "توزيع حالات الوحدات" },
  { key: "daily_activity", label: "ملخص النشاط اليومي للموظفين" },
  { key: "cash_flow", label: "التدفق النقدي المتوقع" },
  { key: "arrears_ageing", label: "أعمار المتأخرات" },
  { key: "expiry_heatmap", label: "خريطة انتهاء العقود" },
  { key: "occupancy_trend", label: "اتجاه الإشغال" },
  { key: "vacancy_days", label: "متوسط أيام الشغور" },
  { key: "profitability", label: "ربحية العقارات" },
  { key: "performance_ranking", label: "ترتيب أداء العقارات" },
  { key: "risk_index", label: "مؤشر مخاطر العقود" },
  { key: "collection_likelihood", label: "احتمالية التحصيل" },
  { key: "tenant_retention", label: "احتفاظ المستأجرين" },
  { key: "pipeline", label: "خط أنابيب الفرص" },
  { key: "lead_sources", label: "تحليل مصادر العملاء" },
  { key: "response_speed", label: "سرعة الاستجابة" },
  { key: "team_performance", label: "أداء الفريق" },
  { key: "maintenance_board", label: "لوحة المهام والصيانة" },
  { key: "geo_distribution", label: "التوزيع الجغرافي" },
  { key: "period_comparison", label: "مقارنة الفترات" },
  { key: "executive_summary", label: "الموجز التنفيذي اليومي" },
];

export function DashboardAnalytics() {
  const { isVisible, toggle } = useMetricsVisibility(METRICS.map((m) => m.key));

  const q = useQuery({
    queryKey: ["dashboard-analytics-raw"],
    queryFn: async () => {
      const [units, contracts, payments, reservations, opportunities, contacts, tasks, sessions, properties, profiles] =
        await Promise.all([
          supabase.from("units").select("id, unit_type, status, building_id, created_at"),
          supabase
            .from("contracts")
            .select("id, contract_number, status, start_date, end_date, total_value, property_id, unit_id, tenant_id, created_at"),
          supabase.from("contract_payments").select("id, contract_id, due_date, amount_due, amount_paid, status"),
          supabase
            .from("reservations")
            .select("id, status, starts_at, ends_at, property_id, unit_id, contact_id, created_at, property:property_id(name)"),
          supabase.from("opportunities").select("id, stage, expected_value, created_at, updated_at, assigned_to"),
          supabase.from("contacts").select("id, source, created_at, kind, assigned_to"),
          supabase.from("tasks").select("id, status, task_type, priority, created_at, submitted_at, approved_at, assigned_by"),
          supabase.from("employee_sessions").select("id, user_id, started_at, last_seen_at, ended_at"),
          supabase.from("properties").select("id, name, city, district"),
          supabase.from("profiles").select("id, full_name"),
        ]);

      return {
        units: units.data ?? [],
        contracts: (contracts.data ?? []) as A.RawContract[],
        payments: (payments.data ?? []) as A.RawPayment[],
        reservations: ((reservations.data ?? []) as unknown as (A.RawReservation & {
          property: { name: string } | null;
        })[]).map((r) => ({ ...r, property_name: r.property?.name ?? null })),
        opportunities: (opportunities.data ?? []) as A.RawOpportunity[],
        contacts: (contacts.data ?? []) as A.RawContact[],
        tasks: (tasks.data ?? []) as A.RawTask[],
        sessions: (sessions.data ?? []) as A.RawSession[],
        properties: (properties.data ?? []) as A.RawProperty[],
        profiles: (profiles.data ?? []) as { id: string; full_name: string }[],
      };
    },
  });

  const derived = useMemo(() => {
    if (!q.data) return null;
    const { units, contracts, payments, reservations, opportunities, contacts, tasks, sessions, properties, profiles } = q.data;
    const names = new Map(profiles.map((p) => [p.id, p.full_name]));
    return {
      byType: A.unitsByType(units as A.RawUnit[]),
      statusChart: A.unitStatusChart(units as A.RawUnit[]),
      weekly: A.weeklyOccupancyTrend(contracts, units.length),
      reservations: A.reservationsSummary(reservations),
      dailyActivity: A.dailyStaffActivity(sessions),
      cashFlow: A.expectedCashFlow(payments),
      ageing: A.arrearsAgeing(payments),
      expiry: A.contractExpiryHeatmap(contracts),
      occTrend: A.occupancyTrend(units as A.RawUnit[], contracts),
      vacancyDays: A.averageVacancyDays(contracts),
      profitability: A.propertyProfitability(contracts, properties),
      pipeline: A.opportunityPipeline(opportunities),
      leadSources: A.leadSourceAnalysis(contacts),
      responseSpeed: A.responseSpeed(opportunities),
      teamPerf: A.teamPerformance(opportunities, tasks, names),
      maintenance: A.maintenanceBoard(tasks),
      geo: A.geographicDistribution(properties),
      periodCmp: A.periodComparison(contracts),
      riskIndex: A.contractRiskIndex(contracts, payments),
      collection: A.collectionLikelihood(payments),
      retention: A.tenantRetention(contracts),
    };
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">جاري تجهيز التحليلات…</p>
      </div>
    );
  }
  if (q.error || !derived) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-10 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <p className="text-[13px] text-destructive" dir="ltr">
          {q.error instanceof Error ? q.error.message : "تعذّر تحميل التحليلات"}
        </p>
      </div>
    );
  }

  const v = isVisible;
  const perfRanking = A.propertyPerformanceRanking(derived.profitability);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">التحليلات المتقدمة</h2>
        <MetricsCustomizer metrics={METRICS} isVisible={v} toggle={toggle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {v("units_distribution") && (
          <AnalyticsCard title="توزيع الوحدات حسب النوع">
            {derived.byType.length === 0 ? (
              <EmptyRow text="لا توجد وحدات مسجّلة" />
            ) : (
              <ul className="divide-y divide-border text-[13px]">
                {derived.byType.map((r) => (
                  <li key={r.type} className="flex items-center justify-between py-2">
                    <span className="font-semibold text-foreground">{r.type}</span>
                    <span className="text-muted-foreground">
                      مشغولة {r.occupied} · شاغرة {r.vacant} · إجمالي {r.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AnalyticsCard>
        )}

        {v("reservations") && (
          <AnalyticsCard title="الحجوزات النشطة والمعلّقة">
            {derived.reservations.total === 0 ? (
              <EmptyRow text="لا توجد حجوزات" />
            ) : (
              <div className="space-y-2 text-[13px]">
                <p>نشطة: {derived.reservations.active.length} · معلّقة: {derived.reservations.pending.length}</p>
                <ul className="max-h-56 divide-y divide-border overflow-y-auto">
                  {[...derived.reservations.active, ...derived.reservations.pending].slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span className="font-semibold text-foreground">{r.property_name ?? "—"}</span>
                      <span className="text-muted-foreground">
                        {formatDate(r.starts_at)} - {formatDate(r.ends_at)}
                      </span>
                      <Chip tone={r.status === "active" || r.status === "confirmed" ? "success" : "warning"}>{r.status}</Chip>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AnalyticsCard>
        )}

        {v("weekly_occupancy") && (
          <AnalyticsCard title="الإشغال الأسبوعي" estimated>
            <WeeklyOccupancyChart data={derived.weekly} />
          </AnalyticsCard>
        )}

        {v("unit_status_chart") && (
          <AnalyticsCard title="توزيع حالات الوحدات">
            <UnitStatusChart data={derived.statusChart} />
          </AnalyticsCard>
        )}

        {v("daily_activity") && (
          <AnalyticsCard title="ملخص النشاط اليومي للموظفين">
            <div className="grid grid-cols-3 gap-2 text-center text-[13px]">
              <Stat label="تسجيل دخول" value={String(derived.dailyActivity.logins)} />
              <Stat label="تسجيل خروج" value={String(derived.dailyActivity.logouts)} />
              <Stat label="متوسط مدة الجلسة (دقيقة)" value={String(derived.dailyActivity.avgDurationMin)} />
            </div>
          </AnalyticsCard>
        )}

        {v("cash_flow") && (
          <AnalyticsCard title="التدفق النقدي المتوقع" estimated>
            <div className="grid grid-cols-3 gap-2 text-center text-[13px]">
              <Stat label="30 يومًا" value={formatCurrency(derived.cashFlow.d30)} />
              <Stat label="60 يومًا" value={formatCurrency(derived.cashFlow.d60)} />
              <Stat label="90 يومًا" value={formatCurrency(derived.cashFlow.d90)} />
            </div>
          </AnalyticsCard>
        )}

        {v("arrears_ageing") && (
          <AnalyticsCard title="أعمار المتأخرات">
            <div className="grid grid-cols-4 gap-2 text-center text-[12.5px]">
              <Stat label="1-30" value={formatCurrency(derived.ageing.b1_30)} />
              <Stat label="31-60" value={formatCurrency(derived.ageing.b31_60)} />
              <Stat label="61-90" value={formatCurrency(derived.ageing.b61_90)} />
              <Stat label="90+" value={formatCurrency(derived.ageing.b90plus)} />
            </div>
          </AnalyticsCard>
        )}

        {v("expiry_heatmap") && (
          <AnalyticsCard title="خريطة انتهاء العقود (12 شهرًا)">
            <ContractExpiryHeatmapChart data={derived.expiry} />
          </AnalyticsCard>
        )}

        {v("occupancy_trend") && (
          <AnalyticsCard title="اتجاه الإشغال" estimated>
            <p className="text-[13px] text-foreground">
              الآن {derived.occTrend.nowPct}% مقابل {derived.occTrend.thenPct}% قبل شهر
              (<span className={derived.occTrend.delta >= 0 ? "text-success" : "text-destructive"}>
                {derived.occTrend.delta >= 0 ? "+" : ""}
                {derived.occTrend.delta}%
              </span>)
            </p>
          </AnalyticsCard>
        )}

        {v("vacancy_days") && (
          <AnalyticsCard title="متوسط أيام الشغور بين العقود" estimated>
            <p className="text-2xl font-bold text-foreground">{derived.vacancyDays} يوم</p>
          </AnalyticsCard>
        )}

        {v("profitability") && (
          <AnalyticsCard title="ربحية العقارات" estimated subtitle="إجمالي قيم العقود النشطة لكل عقار">
            {derived.profitability.length === 0 ? (
              <EmptyRow text="لا توجد بيانات كافية" />
            ) : (
              <ul className="divide-y divide-border text-[13px]">
                {derived.profitability.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span className="font-semibold text-foreground">{p.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </AnalyticsCard>
        )}

        {v("performance_ranking") && (
          <AnalyticsCard title="ترتيب أداء العقارات" estimated>
            {perfRanking.length === 0 ? (
              <EmptyRow text="لا توجد بيانات كافية" />
            ) : (
              <ol className="space-y-1 text-[13px]">
                {perfRanking.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>#{p.rank} {p.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(p.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </AnalyticsCard>
        )}

        {v("risk_index") && (
          <AnalyticsCard title="مؤشر مخاطر العقود" estimated>
            {derived.riskIndex.length === 0 ? (
              <EmptyRow text="لا توجد عقود نشطة" />
            ) : (
              <ul className="space-y-1 text-[13px]">
                {derived.riskIndex.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span>{r.contract_number ?? "بدون رقم"}</span>
                    <Chip tone={r.score >= 60 ? "danger" : r.score >= 30 ? "warning" : "success"}>{r.score}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </AnalyticsCard>
        )}

        {v("collection_likelihood") && (
          <AnalyticsCard title="احتمالية التحصيل" estimated>
            <p className="text-[13px] text-foreground">
              معدّل السداد التاريخي {derived.collection.rate}% — متوقع تحصيله من المتأخرات{" "}
              {formatCurrency(derived.collection.expectedCollectible)} من {formatCurrency(derived.collection.totalOverdue)}
            </p>
          </AnalyticsCard>
        )}

        {v("tenant_retention") && (
          <AnalyticsCard title="احتفاظ المستأجرين" estimated>
            <p className="text-2xl font-bold text-foreground">{derived.retention.rate}%</p>
            <p className="text-[12px] text-muted-foreground">{derived.retention.renewed} من {derived.retention.total} مستأجر جدّدوا عقودهم</p>
          </AnalyticsCard>
        )}

        {v("pipeline") && (
          <AnalyticsCard title="خط أنابيب الفرص">
            {derived.pipeline.length === 0 ? (
              <EmptyRow text="لا توجد فرص مسجّلة" />
            ) : (
              <ul className="space-y-1 text-[13px]">
                {derived.pipeline.map((p) => (
                  <li key={p.stage} className="flex items-center justify-between">
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">{p.count} · {formatCurrency(p.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </AnalyticsCard>
        )}

        {v("lead_sources") && (
          <AnalyticsCard title="تحليل مصادر العملاء">
            {derived.leadSources.length === 0 ? (
              <EmptyRow text="لا توجد بيانات مصادر" />
            ) : (
              <ul className="space-y-1 text-[13px]">
                {derived.leadSources.map((s) => (
                  <li key={s.source} className="flex items-center justify-between">
                    <span>{s.source}</span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </AnalyticsCard>
        )}

        {v("response_speed") && (
          <AnalyticsCard title="سرعة الاستجابة" estimated>
            <p className="text-2xl font-bold text-foreground">{derived.responseSpeed} ساعة</p>
            <p className="text-[12px] text-muted-foreground">متوسط الوقت بين إنشاء الفرصة وأول تحديث</p>
          </AnalyticsCard>
        )}

        {v("team_performance") && (
          <AnalyticsCard title="أداء الفريق">
            {derived.teamPerf.length === 0 ? (
              <EmptyRow text="لا توجد بيانات كافية" />
            ) : (
              <ul className="space-y-1 text-[13px]">
                {derived.teamPerf.slice(0, 6).map((t) => (
                  <li key={t.userId} className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{t.name}</span>
                    <span className="text-muted-foreground">فرص {t.opportunities} · مهام {t.tasksDone}</span>
                  </li>
                ))}
              </ul>
            )}
          </AnalyticsCard>
        )}

        {v("maintenance_board") && (
          <AnalyticsCard title="لوحة المهام والصيانة">
            <div className="grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-4">
              {derived.maintenance.map((c) => (
                <div key={c.status} className="rounded-lg border border-border p-2 text-center">
                  <p className="font-bold text-foreground">{c.items.length}</p>
                  <p className="text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>
          </AnalyticsCard>
        )}

        {v("geo_distribution") && (
          <AnalyticsCard title="التوزيع الجغرافي للعقارات">
            {derived.geo.length === 0 ? (
              <EmptyRow text="لا توجد بيانات مدن" />
            ) : (
              <ul className="space-y-1 text-[13px]">
                {derived.geo.map((g) => (
                  <li key={g.city} className="flex items-center justify-between">
                    <span>{g.city}</span>
                    <span className="text-muted-foreground">{g.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </AnalyticsCard>
        )}

        {v("period_comparison") && (
          <AnalyticsCard title="مقارنة الفترات (شهري)">
            <p className="text-[13px] text-foreground">
              عقود هذا الشهر {derived.periodCmp.thisCount} مقابل {derived.periodCmp.prevCount} الشهر الماضي
              (<span className={derived.periodCmp.countDelta >= 0 ? "text-success" : "text-destructive"}>
                {derived.periodCmp.countDelta >= 0 ? "+" : ""}
                {derived.periodCmp.countDelta}
              </span>)
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              الإيراد: {formatCurrency(derived.periodCmp.thisRevenue)} مقابل {formatCurrency(derived.periodCmp.prevRevenue)}
            </p>
          </AnalyticsCard>
        )}

        {v("executive_summary") && (
          <AnalyticsCard title="الموجز التنفيذي اليومي" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="متأخرات (1-30)" value={formatCurrency(derived.ageing.b1_30)} />
              <Stat label="إشغال حالي" value={`${derived.occTrend.nowPct}%`} />
              <Stat label="موظفون متصلون الآن" value={String(A.onlineSessions(q.data?.sessions ?? []).length)} />
              <Stat label="عقود تنتهي قريبًا" value={String(derived.expiry[0]?.count ?? 0)} />
            </div>
          </AnalyticsCard>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-[14px] font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="py-6 text-center text-[12.5px] text-muted-foreground">{text}</p>;
}
