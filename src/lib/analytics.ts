/**
 * حسابات لوحة التحكم والتحليلات — كل الدوال هنا حسابات تُشتق من بيانات
 * تم جلبها مسبقًا (على العميل)، دون أي طلبات إضافية للخادم.
 * الدوال آمنة تمامًا مع مصفوفات فارغة أو قيم null.
 */

export type RawUnit = {
  id: string;
  unit_type: string | null;
  status: string;
  building_id: string | null;
  created_at: string;
};

export type RawContract = {
  id: string;
  contract_number: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  total_value: number | null;
  property_id: string | null;
  unit_id: string | null;
  tenant_id: string | null;
  created_at: string;
};

export type RawPayment = {
  id: string;
  contract_id: string;
  due_date: string;
  amount_due: number | null;
  amount_paid: number | null;
  status: string;
};

export type RawReservation = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  property_id: string | null;
  unit_id: string | null;
  contact_id: string | null;
  created_at: string;
  property_name?: string | null;
};

export type RawOpportunity = {
  id: string;
  stage: string;
  expected_value: number | null;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
};

export type RawContact = {
  id: string;
  source: string | null;
  created_at: string;
  kind: string;
  assigned_to: string | null;
};

export type RawTask = {
  id: string;
  status: string;
  task_type: string;
  priority: string;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  assigned_by: string | null;
};

export type RawActivity = {
  id: string;
  action: string;
  created_at: string;
  actor_id: string | null;
  actor_name?: string | null;
};

export type RawSession = {
  id: string;
  user_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  user_name?: string | null;
};

export type RawProperty = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
};

const dayMs = 86400000;

export function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / dayMs);
}

/** توزيع الوحدات حسب النوع مع أعداد المشغول/الشاغر لكل نوع. */
export function unitsByType(units: RawUnit[]) {
  const map = new Map<string, { type: string; total: number; occupied: number; vacant: number }>();
  for (const u of units) {
    const type = u.unit_type?.trim() || "غير محدد";
    const row = map.get(type) ?? { type, total: 0, occupied: 0, vacant: 0 };
    row.total += 1;
    if (u.status === "occupied") row.occupied += 1;
    else row.vacant += 1;
    map.set(type, row);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/** توزيع حالات الوحدات (لغرض الرسم البياني). */
export function unitStatusChart(units: RawUnit[]) {
  const map = new Map<string, number>();
  for (const u of units) {
    const key = u.status || "غير محدد";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const labels: Record<string, string> = {
    occupied: "مشغولة",
    vacant: "شاغرة",
    maintenance: "تحت الصيانة",
    reserved: "محجوزة",
  };
  return Array.from(map.entries()).map(([status, count]) => ({
    status,
    label: labels[status] ?? status,
    count,
  }));
}

/** الإشغال الأسبوعي التقديري خلال آخر 8 أسابيع بالاعتماد على تواريخ العقود النشطة. */
export function weeklyOccupancyTrend(contracts: RawContract[], totalUnits: number, weeks = 8) {
  const now = new Date();
  const points: { week: string; occupancy: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const at = new Date(now.getTime() - i * 7 * dayMs);
    const iso = at.toISOString().slice(0, 10);
    const occupiedCount = totalUnits
      ? contracts.filter((c) => {
          if (!c.start_date) return false;
          const started = c.start_date <= iso;
          const notEnded = !c.end_date || c.end_date >= iso;
          return started && notEnded && c.status !== "cancelled";
        }).length
      : 0;
    points.push({
      week: at.toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit" }),
      occupancy: totalUnits ? Math.min(100, Math.round((occupiedCount / totalUnits) * 100)) : 0,
    });
  }
  return points;
}

/** ملخص الحجوزات النشطة والمعلّقة. */
export function reservationsSummary(reservations: RawReservation[]) {
  const active = reservations.filter((r) => r.status === "active" || r.status === "confirmed");
  const pending = reservations.filter((r) => r.status === "pending" || r.status === "new");
  return { active, pending, total: reservations.length };
}

/** التدفق النقدي المتوقع خلال 30/60/90 يومًا القادمة (تقديري = يعتمد على الاستحقاقات غير المسددة). */
export function expectedCashFlow(payments: RawPayment[]) {
  const today = new Date();
  const remaining = (p: RawPayment) => Math.max(Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0), 0);
  const within = (days: number) =>
    payments
      .filter((p) => p.status !== "paid" && daysBetween(new Date(p.due_date), today) <= days && daysBetween(new Date(p.due_date), today) >= 0)
      .reduce((s, p) => s + remaining(p), 0);
  return { d30: within(30), d60: within(60), d90: within(90) };
}

/** أعمار المتأخرات: 1-30 / 31-60 / 61-90 / 90+ يومًا. */
export function arrearsAgeing(payments: RawPayment[]) {
  const today = new Date();
  const buckets = { b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
  for (const p of payments) {
    if (p.status === "paid") continue;
    const remaining = Math.max(Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0), 0);
    if (remaining <= 0) continue;
    const overdue = daysBetween(today, new Date(p.due_date));
    if (overdue <= 0) continue;
    if (overdue <= 30) buckets.b1_30 += remaining;
    else if (overdue <= 60) buckets.b31_60 += remaining;
    else if (overdue <= 90) buckets.b61_90 += remaining;
    else buckets.b90plus += remaining;
  }
  return buckets;
}

/** خريطة حرارية شهرية لانتهاء العقود خلال 12 شهرًا القادمة. */
export function contractExpiryHeatmap(contracts: RawContract[]) {
  const now = new Date();
  const months: { month: string; count: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const at = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = at.toISOString().slice(0, 7);
    const count = contracts.filter(
      (c) => c.status === "active" && c.end_date && c.end_date.slice(0, 7) === key,
    ).length;
    months.push({ month: at.toLocaleDateString("ar-SA", { month: "short", year: "2-digit" }), count });
  }
  return months;
}

/** اتجاه الإشغال العام (نسبة مئوية حالية مقابل الشهر الماضي) — تقديري. */
export function occupancyTrend(units: RawUnit[], contracts: RawContract[]) {
  const total = units.length;
  const occupiedNow = units.filter((u) => u.status === "occupied").length;
  const monthAgo = new Date(Date.now() - 30 * dayMs).toISOString().slice(0, 10);
  const occupiedThen = contracts.filter(
    (c) => c.start_date && c.start_date <= monthAgo && (!c.end_date || c.end_date >= monthAgo) && c.status !== "cancelled",
  ).length;
  const nowPct = total ? Math.round((occupiedNow / total) * 100) : 0;
  const thenPct = total ? Math.round((Math.min(occupiedThen, total) / total) * 100) : 0;
  return { nowPct, thenPct, delta: nowPct - thenPct };
}

/** متوسط عدد أيام شغور الوحدة بين انتهاء عقد وبداية آخر — تقديري بناءً على العقود المتتالية على نفس الوحدة. */
export function averageVacancyDays(contracts: RawContract[]) {
  const byUnit = new Map<string, RawContract[]>();
  for (const c of contracts) {
    if (!c.unit_id || !c.start_date) continue;
    const list = byUnit.get(c.unit_id) ?? [];
    list.push(c);
    byUnit.set(c.unit_id, list);
  }
  const gaps: number[] = [];
  for (const list of byUnit.values()) {
    const sorted = [...list].sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1]?.end_date;
      const nextStart = sorted[i]?.start_date;
      if (!prevEnd || !nextStart) continue;
      const gap = daysBetween(new Date(nextStart), new Date(prevEnd));
      if (gap > 0 && gap < 365) gaps.push(gap);
    }
  }
  if (!gaps.length) return 0;
  return Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
}

/** ربحية تقديرية لكل عقار = إجمالي قيم العقود النشطة المرتبطة به. */
export function propertyProfitability(contracts: RawContract[], properties: RawProperty[]) {
  const map = new Map<string, number>();
  for (const c of contracts) {
    if (!c.property_id || c.status !== "active") continue;
    map.set(c.property_id, (map.get(c.property_id) ?? 0) + Number(c.total_value ?? 0));
  }
  return properties
    .map((p) => ({ id: p.id, name: p.name, revenue: map.get(p.id) ?? 0 }))
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

/** ترتيب أداء العقارات (نفس بيانات الربحية، لأغراض العرض في مخطط الترتيب). */
export function propertyPerformanceRanking(profitability: ReturnType<typeof propertyProfitability>) {
  return profitability.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** مؤشر مخاطرة تقديري لكل عقد نشط (0-100) بناءً على قرب الانتهاء وتأخر السداد. */
export function contractRiskIndex(contracts: RawContract[], payments: RawPayment[]) {
  const today = new Date();
  const overdueByContract = new Map<string, number>();
  for (const p of payments) {
    if (p.status === "paid") continue;
    const remaining = Math.max(Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0), 0);
    if (remaining <= 0) continue;
    if (daysBetween(today, new Date(p.due_date)) <= 0) continue;
    overdueByContract.set(p.contract_id, (overdueByContract.get(p.contract_id) ?? 0) + 1);
  }
  return contracts
    .filter((c) => c.status === "active")
    .map((c) => {
      let score = 0;
      if (c.end_date) {
        const daysLeft = daysBetween(new Date(c.end_date), today);
        if (daysLeft <= 30) score += 45;
        else if (daysLeft <= 60) score += 25;
        else if (daysLeft <= 90) score += 10;
      }
      const overdueCount = overdueByContract.get(c.id) ?? 0;
      score += Math.min(overdueCount * 20, 55);
      return { id: c.id, contract_number: c.contract_number, score: Math.min(score, 100) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/** احتمالية تحصيل تقديرية للمتأخرات الحالية بناءً على نسبة السداد التاريخية العامة. */
export function collectionLikelihood(payments: RawPayment[]) {
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const total = payments.length;
  const historicalRate = total ? paidCount / total : 0;
  const overdueRemaining = arrearsAgeing(payments);
  const totalOverdue = overdueRemaining.b1_30 + overdueRemaining.b31_60 + overdueRemaining.b61_90 + overdueRemaining.b90plus;
  return {
    rate: Math.round(historicalRate * 100),
    expectedCollectible: Math.round(totalOverdue * historicalRate),
    totalOverdue,
  };
}

/** معدل احتفاظ المستأجرين — نسبة العقود المتجددة (renewal) إلى إجمالي العقود المنتهية/الحالية. */
export function tenantRetention(contracts: RawContract[]) {
  const finished = contracts.filter((c) => c.status !== "active" || (c.end_date && c.end_date < new Date().toISOString().slice(0, 10)));
  if (!finished.length) return { rate: 0, renewed: 0, total: 0 };
  const byTenant = new Map<string, RawContract[]>();
  for (const c of contracts) {
    if (!c.tenant_id) continue;
    const list = byTenant.get(c.tenant_id) ?? [];
    list.push(c);
    byTenant.set(c.tenant_id, list);
  }
  const renewedTenants = Array.from(byTenant.values()).filter((list) => list.length > 1).length;
  const total = byTenant.size;
  return { rate: total ? Math.round((renewedTenants / total) * 100) : 0, renewed: renewedTenants, total };
}

/** خط أنابيب الفرص حسب المرحلة. */
export function opportunityPipeline(opportunities: RawOpportunity[]) {
  const map = new Map<string, { stage: string; count: number; value: number }>();
  for (const o of opportunities) {
    const row = map.get(o.stage) ?? { stage: o.stage, count: 0, value: 0 };
    row.count += 1;
    row.value += Number(o.expected_value ?? 0);
    map.set(o.stage, row);
  }
  const labels: Record<string, string> = {
    new: "جديدة",
    contacted: "تم التواصل",
    negotiation: "تفاوض",
    won: "مغلقة (فوز)",
    lost: "مغلقة (خسارة)",
    qualified: "مؤهلة",
  };
  return Array.from(map.values()).map((r) => ({ ...r, label: labels[r.stage] ?? r.stage }));
}

/** تحليل مصادر العملاء المحتملين. */
export function leadSourceAnalysis(contacts: RawContact[]) {
  const map = new Map<string, number>();
  for (const c of contacts) {
    const key = c.source?.trim() || "غير معروف";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/** سرعة الاستجابة التقديرية = متوسط الفارق بالساعات بين إنشاء الفرصة وأول تحديث لها. */
export function responseSpeed(opportunities: RawOpportunity[]) {
  const diffsHours = opportunities
    .map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 3600000)
    .filter((h) => h >= 0 && h < 24 * 30);
  if (!diffsHours.length) return 0;
  return Math.round((diffsHours.reduce((s, h) => s + h, 0) / diffsHours.length) * 10) / 10;
}

/** أداء الفريق: عدد الفرص المسندة لكل موظف وعدد المهام المنجزة. */
export function teamPerformance(opportunities: RawOpportunity[], tasks: RawTask[], names: Map<string, string>) {
  const map = new Map<string, { userId: string; name: string; opportunities: number; wonOpportunities: number; tasksDone: number }>();
  const ensure = (id: string) => {
    if (!map.has(id)) map.set(id, { userId: id, name: names.get(id) ?? "غير معروف", opportunities: 0, wonOpportunities: 0, tasksDone: 0 });
    return map.get(id)!;
  };
  for (const o of opportunities) {
    if (!o.assigned_to) continue;
    const row = ensure(o.assigned_to);
    row.opportunities += 1;
    if (o.stage === "won") row.wonOpportunities += 1;
  }
  for (const t of tasks) {
    if (!t.assigned_by || t.status !== "approved") continue;
    const row = ensure(t.assigned_by);
    row.tasksDone += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.opportunities + b.tasksDone - (a.opportunities + a.tasksDone));
}

/** لوحة الصيانة/المهام حسب الحالة. */
export function maintenanceBoard(tasks: RawTask[]) {
  const columns = ["submitted", "in_progress", "approved", "rejected"] as const;
  const labels: Record<string, string> = {
    submitted: "بانتظار المراجعة",
    in_progress: "قيد التنفيذ",
    approved: "مكتملة",
    rejected: "مرفوضة",
  };
  return columns.map((status) => ({
    status,
    label: labels[status] ?? status,
    items: tasks.filter((t) => t.status === status),
  }));
}

/** التوزيع الجغرافي للعقارات حسب المدينة/الحي. */
export function geographicDistribution(properties: RawProperty[]) {
  const map = new Map<string, number>();
  for (const p of properties) {
    const key = p.city?.trim() || "غير محدد";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}

/** مقارنة فترة بفترة (الشهر الحالي مقابل السابق) لعدد العقود الجديدة والإيرادات. */
export function periodComparison(contracts: RawContract[]) {
  const now = new Date();
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const endPrev = startThis;

  const inRange = (date: string | null, from: string, to: string) => !!date && date >= from && date < to;

  const thisMonth = contracts.filter((c) => inRange(c.created_at.slice(0, 10), startThis, "9999-99-99"));
  const prevMonth = contracts.filter((c) => inRange(c.created_at.slice(0, 10), startPrev, endPrev));

  const revenue = (list: RawContract[]) => list.reduce((s, c) => s + Number(c.total_value ?? 0), 0);

  return {
    thisCount: thisMonth.length,
    prevCount: prevMonth.length,
    thisRevenue: revenue(thisMonth),
    prevRevenue: revenue(prevMonth),
    countDelta: thisMonth.length - prevMonth.length,
    revenueDelta: revenue(thisMonth) - revenue(prevMonth),
  };
}

/** موجز تنفيذي يومي: أهم الأرقام الحرجة في نظرة واحدة. */
export function executiveDailySummary(params: {
  overdueAmount: number;
  occupancy: number;
  activeContracts: number;
  endingSoon: number;
  onlineStaff: number;
  newLeadsToday: number;
}) {
  return params;
}

/** ملخص الأنشطة اليومية للموظفين (تسجيل دخول/خروج) بالاعتماد على جدول الجلسات. */
export function dailyStaffActivity(sessions: RawSession[]) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((s) => s.started_at.slice(0, 10) === today);
  const logins = todaySessions.length;
  const logouts = todaySessions.filter((s) => s.ended_at).length;
  const durations = todaySessions
    .filter((s) => s.ended_at)
    .map((s) => (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000);
  const avgDurationMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  return { logins, logouts, avgDurationMin };
}

/** الجلسات النشطة الآن (لم تُغلق ولها نبضة حديثة خلال آخر 5 دقائق). */
export function onlineSessions(sessions: RawSession[]) {
  const cutoff = Date.now() - 5 * 60 * 1000;
  return sessions.filter((s) => !s.ended_at && new Date(s.last_seen_at).getTime() >= cutoff);
}
