import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { History, Loader2, Radio, ShieldAlert, TriangleAlert } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  actor: { full_name: string } | null;
};

/** كلمات مفتاحية تُصنَّف بموجبها العملية كـ"هامة" في سجل الأنشطة. */
const IMPORTANT_KEYWORDS = [
  "delete",
  "remove",
  "reject",
  "cancel",
  "approve",
  "finaliz",
  "import",
  "staff",
  "role",
  "permission",
  "password",
  "backup",
  "restore",
];

function isImportantAction(action: string) {
  const lower = action.toLowerCase();
  return IMPORTANT_KEYWORDS.some((k) => lower.includes(k));
}

export const Route = createFileRoute("/_authenticated/activity-log")({
  head: () => ({
    meta: [
      { title: "سجل الأنشطة | مثراء العقارية" },
      { name: "description", content: "سجل كل عملية تمت في النظام ومن نفّذها ومتى." },
      { property: "og:title", content: "سجل الأنشطة | مثراء العقارية" },
      { property: "og:description", content: "سجل كل عملية تمت في النظام ومن نفّذها ومتى." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityLogPage,
});

function ActivityLogPage() {
  const { isSuperAdmin, loading } = useCurrentUser();

  return (
    <>
      <PageHero
        title="سجل الأنشطة"
        subtitle="تتبّع كامل لعمليات الإضافة والتعديل والحذف والاعتماد."
        icon={History}
      />

      {loading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري التحقق من الصلاحيات…</p>
        </div>
      ) : !isSuperAdmin ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <ShieldAlert className="size-8 text-destructive" />
          <p className="text-[14px] font-bold text-foreground">هذه الصفحة مخصّصة لمدير النظام فقط</p>
          <p className="text-[13px] text-muted-foreground">
            لا تملك صلاحية الوصول إلى سجل الأنشطة وجلسات الموظفين. تواصل مع مدير النظام إذا كنت بحاجة إلى ذلك.
          </p>
        </div>
      ) : (
        <>
          <StaffSessionsPanel />
          <ImportantActionsPanel />

          <LiveTable<Row>
            table="activity_log"
            select="id, action, entity_type, entity_id, created_at, actor:actor_id(full_name)"
            orderBy={{ column: "created_at" }}
            searchPlaceholder="بحث بالعملية"
            emptyText="لا توجد أنشطة مسجلة"
            emptyHint="ستُسجَّل العمليات هنا تلقائيًا أثناء استخدام النظام."
            columns={[
              { header: "المستخدم", cell: (r) => r.actor?.full_name ?? "النظام", className: "font-semibold" },
              { header: "العملية", cell: (r) => r.action },
              { header: "النوع", cell: (r) => r.entity_type ?? "—" },
              { header: "السجل", cell: (r) => <span dir="ltr">{r.entity_id ?? "—"}</span> },
              { header: "التاريخ", cell: (r) => formatDate(r.created_at) },
            ]}
          />
        </>
      )}
    </>
  );
}

type SessionRow = {
  id: string;
  user_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
};

function useStaffSessionsData() {
  return useQuery({
    queryKey: ["activity-log-staff-sessions"],
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [sessionsRes, profilesRes] = await Promise.all([
        supabase
          .from("employee_sessions")
          .select("id, user_id, started_at, last_seen_at, ended_at")
          .gte("started_at", dayAgo)
          .order("started_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const sessions = (sessionsRes.data ?? []) as SessionRow[];
      const names = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name as string]));

      const cutoff = Date.now() - 5 * 60 * 1000;
      const online = sessions.filter(
        (s) => !s.ended_at && new Date(s.last_seen_at).getTime() >= cutoff,
      );

      const today = new Date().toISOString().slice(0, 10);
      const todaySessions = sessions.filter((s) => s.started_at.slice(0, 10) === today);
      const logins = todaySessions.length;
      const logouts = todaySessions.filter((s) => s.ended_at).length;

      return {
        online: online.map((s) => ({ ...s, name: names.get(s.user_id) ?? "موظف" })),
        recent: sessions.slice(0, 15).map((s) => ({ ...s, name: names.get(s.user_id) ?? "موظف" })),
        logins,
        logouts,
      };
    },
    refetchInterval: 30000,
  });
}

function formatDuration(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const minutes = Math.max(Math.round((end - new Date(startIso).getTime()) / 60000), 0);
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} س ${rest} د`;
}

function StaffSessionsPanel() {
  const q = useStaffSessionsData();

  if (q.isLoading) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">جاري تحميل جلسات الموظفين…</p>
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-10 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <p className="text-[13px] text-destructive" dir="ltr">
          {q.error instanceof Error ? q.error.message : "تعذّر تحميل جلسات الموظفين"}
        </p>
      </div>
    );
  }

  const { online, recent, logins, logouts } = q.data;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="surface-card p-5 lg:col-span-1">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-success" />
          <h2 className="text-[15px] font-bold text-foreground">الموظفون المتصلون الآن</h2>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">نشاط خلال آخر 5 دقائق</p>

        {online.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">لا يوجد موظفون متصلون حاليًا.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {online.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-[13px]">
                <span className="font-semibold text-foreground">{s.name}</span>
                <Chip tone="success">متصل الآن</Chip>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">{logins}</p>
            <p className="text-[11.5px] text-muted-foreground">تسجيل دخول اليوم</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{logouts}</p>
            <p className="text-[11.5px] text-muted-foreground">تسجيل خروج اليوم</p>
          </div>
        </div>
      </section>

      <section className="surface-card p-5 lg:col-span-2">
        <h2 className="text-[15px] font-bold text-foreground">جلسات الموظفين الأخيرة</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          تسجيلات الدخول والخروج ومدة كل جلسة خلال آخر 24 ساعة
        </p>

        {recent.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">لا توجد جلسات مسجّلة.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-right">
              <thead>
                <tr className="border-b border-border text-[12px] font-bold text-muted-foreground">
                  <th className="py-2">الموظف</th>
                  <th className="py-2">دخول</th>
                  <th className="py-2">خروج</th>
                  <th className="py-2">المدة</th>
                  <th className="py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-b border-border/70 text-[13px] last:border-0">
                    <td className="py-3 font-semibold text-foreground">{s.name}</td>
                    <td className="py-3">{formatDate(s.started_at)}</td>
                    <td className="py-3">{s.ended_at ? formatDate(s.ended_at) : "—"}</td>
                    <td className="py-3">{formatDuration(s.started_at, s.ended_at)}</td>
                    <td className="py-3">
                      {s.ended_at ? (
                        <Chip tone="neutral">منتهية</Chip>
                      ) : (
                        <Chip tone="success">نشطة</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function useImportantActions() {
  return useQuery({
    queryKey: ["activity-log-important"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, entity_type, entity_id, created_at, actor:actor_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).filter((r) => isImportantAction(r.action)).slice(0, 10);
    },
  });
}

function ImportantActionsPanel() {
  const q = useImportantActions();

  return (
    <section className="surface-card p-5">
      <h2 className="text-[15px] font-bold text-foreground">العمليات الهامة</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        حذف، اعتماد، رفض، استيراد، وصلاحيات — من آخر 100 عملية مسجّلة
      </p>

      {q.isLoading ? (
        <div className="grid place-items-center gap-2 py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري التحميل…</p>
        </div>
      ) : q.error ? (
        <div className="grid place-items-center gap-2 py-8 text-center">
          <TriangleAlert className="size-6 text-destructive" />
          <p className="text-[13px] text-destructive" dir="ltr">
            {q.error instanceof Error ? q.error.message : "تعذّر تحميل العمليات الهامة"}
          </p>
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">لا توجد عمليات هامة حديثة.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {(q.data ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5 text-[13px]">
              <div>
                <span className="font-semibold text-foreground">{r.actor?.full_name ?? "النظام"}</span>
                <span className="text-muted-foreground"> — {r.action}</span>
              </div>
              <span className="text-[11.5px] text-muted-foreground">{formatDate(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
