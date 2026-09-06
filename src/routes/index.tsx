import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  ChevronLeft,
  FileText,
  Home,
  Building2,
  Upload,
  Plus,
  TriangleAlert,
  Wallet,
  ClipboardList,
  Search,
  Clock,
  MoveUpLeft,
  CalendarClock,
  Inbox,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHero } from "@/components/kit/PageHero";
import { Chip } from "@/components/kit/Chip";
import { collectionSeries, endingContracts, latePayments, workQueue } from "@/data/dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — الرشودي للعقارات" },
      {
        name: "description",
        content: "ملخص موحد لأداء المحفظة العقارية والأولويات التي تحتاج متابعة.",
      },
      { property: "og:title", content: "لوحة التحكم — الرشودي للعقارات" },
      {
        property: "og:description",
        content: "المتأخرات، التحصيل، نسبة الإشغال والعقود النشطة في شاشة واحدة.",
      },
    ],
  }),
  component: Dashboard,
});

function ActionButton({
  children,
  icon: Icon,
  primary,
}: {
  children: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
          : "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
      }
    >
      {children}
      <Icon className="size-4" />
    </button>
  );
}

function KpiCard({
  label,
  value,
  hint,
  footer,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  footer: string;
  icon: LucideIcon;
  tone?: "danger";
}) {
  return (
    <div className="surface-card relative overflow-hidden p-5">
      {tone === "danger" ? (
        <span className="absolute inset-y-0 end-0 w-[3px] bg-destructive" />
      ) : null}
      <div className="flex items-start justify-between">
        <div className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
          <Icon className="size-[18px]" />
        </div>
        <p className="text-[12.5px] font-semibold text-muted-foreground">{label}</p>
      </div>
      <p
        className={
          tone === "danger"
            ? "mt-3 text-2xl font-bold text-destructive"
            : "mt-3 text-2xl font-bold text-foreground"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12px] text-muted-foreground">
        <ChevronLeft className="size-4" />
        <span>{footer}</span>
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <PageHero
        title="لوحة التحكم"
        subtitle="ملخص موحد لأداء المحفظة العقارية والأولويات التي تحتاج متابعة."
        icon={Home}
        stats={[
          { value: "97", label: "عقد نشط" },
          { value: "96%", label: "نسبة الإشغال" },
          { value: "65", label: "دفعة متأخرة" },
        ]}
      />

      <div className="flex flex-wrap justify-center gap-3">
        <ActionButton icon={Plus} primary>
          عقد إيجار جديد
        </ActionButton>
        <ActionButton icon={Upload}>رفع عقد PDF</ActionButton>
        <ActionButton icon={Bell}>إدارة التذكيرات</ActionButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" />
          آخر تحديث عند 23:09
        </p>
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
          الشهر الحالي
          <Calendar className="size-4 text-muted-foreground" />
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="إجمالي المتأخرات"
          value="309,463 ر.س"
          hint="65 دفعة تحتاج تحصيلًا"
          footer="فتح مركز التحصيل"
          icon={TriangleAlert}
          tone="danger"
        />
        <KpiCard
          label="تحصيل الشهر"
          value="0%"
          hint="0 من 80,566 ر.س"
          footer="أقل بـ 26 نقطة عن الشهر السابق"
          icon={Wallet}
        />
        <KpiCard
          label="نسبة الإشغال"
          value="96%"
          hint="97 من 101 وحدة"
          footer="4 وحدة شاغرة"
          icon={Building2}
        />
        <KpiCard
          label="العقود النشطة"
          value="97"
          hint="15 تنتهي خلال 60 يومًا"
          footer="عرض سجل العقود"
          icon={FileText}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link
              to="/invoices"
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary"
            >
              <ChevronLeft className="size-4" />
              متابعة التحصيل
            </Link>
            <div className="text-end">
              <p className="text-[11.5px] font-semibold text-primary">الأداء المالي</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">المستحق والمحصل</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                حركة استحقاقات الإيجار خلال آخر 6 أشهر
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4 border-y border-border py-4 text-end">
            <div>
              <p className="text-[11.5px] text-muted-foreground">متبقي للتحصيل</p>
              <p className="mt-1 font-bold text-destructive">80,566 ر.س</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted-foreground">إجمالي المستحق</p>
              <p className="mt-1 font-bold text-foreground">80,566 ر.س</p>
            </div>
            <div>
              <p className="text-[11.5px] text-muted-foreground">محصل هذا الشهر</p>
              <p className="mt-1 font-bold text-foreground">0 ر.س</p>
            </div>
          </div>

          <div className="mt-4 h-[260px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...collectionSeries].reverse()} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(v: number) => (v ? `${Math.round(v / 1000)} ألف` : "0")}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                    direction: "rtl",
                  }}
                />
                <Legend
                  formatter={(value) => (value === "collected" ? "المحصل" : "المستحق")}
                  iconType="square"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="due" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="collected" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-start justify-between">
            <MoveUpLeft className="size-4 text-primary" />
            <div className="text-end">
              <p className="text-[11.5px] font-semibold text-primary">حالة المحفظة</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">إشغال الوحدات</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                الوحدات المرتبطة بعقود نشطة الآن
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-accent/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">96%</span>
              <span className="text-[12.5px] font-semibold text-muted-foreground">
                نسبة الإشغال
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full w-[96%] rounded-full bg-primary" />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>من أصل 101 وحدة</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-border" />4 شاغرة
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" />
                  97 مشغولة
                </span>
              </span>
            </div>
          </div>

          <ul className="mt-2 divide-y divide-border">
            {[
              { icon: FileText, label: "العقود النشطة", value: "97" },
              { icon: CalendarClock, label: "تنتهي خلال 60 يومًا", value: "15" },
              { icon: Wallet, label: "مستحق خلال 30 يومًا", value: "110,482 ر.س" },
              { icon: Inbox, label: "طلبات مفتوحة", value: "118" },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between py-3">
                <span className="text-[13px] font-semibold text-foreground">{row.value}</span>
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  {row.label}
                  <row.icon className="size-4 text-primary/70" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="text-end">
        <p className="text-[11.5px] font-semibold text-primary">المتابعة اليومية</p>
        <h2 className="mt-1 text-lg font-bold text-foreground">الأولويات المفتوحة</h2>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Clock className="size-3.5" />
            لقطة عند فتح الصفحة
          </p>
          <p className="text-[12px] text-muted-foreground">
            ما يحتاج تدخلًا الآن. مرتّبًا حسب القيمة والموعد.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="surface-card overflow-hidden">
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <Link
              to="/invoices"
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary"
            >
              <ChevronLeft className="size-4" />
              عرض الكل
            </Link>
            <div className="text-end">
              <h3 className="font-bold text-foreground">دفعات متأخرة</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                65 دفعة بإجمالي 309,463 ر.س
              </p>
            </div>
          </div>

          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-border text-[12px] text-muted-foreground">
                <th className="px-5 py-2.5 font-semibold">المستأجر والوحدة</th>
                <th className="px-3 py-2.5 font-semibold">تاريخ الاستحقاق</th>
                <th className="px-3 py-2.5 font-semibold">الحالة</th>
                <th className="px-3 py-2.5 font-semibold">المبلغ المتبقي</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {latePayments.map((row) => (
                <tr key={row.tenant} className="border-b border-border/70 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[12px] font-bold text-primary">
                        {row.tenant.charAt(0)}
                      </span>
                      <span>
                        <span className="block text-[13px] font-semibold text-foreground">
                          {row.tenant}
                        </span>
                        <span className="block text-[11.5px] text-muted-foreground">
                          {row.unit}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[12.5px] text-muted-foreground">{row.due}</td>
                  <td className="px-3 py-3">
                    <Chip tone="warning">
                      <span className="size-1.5 rounded-full bg-destructive" />
                      {row.late}
                    </Chip>
                  </td>
                  <td className="px-3 py-3 text-[13px] font-semibold text-foreground">
                    {row.amount}
                  </td>
                  <td className="px-3 py-3">
                    <span className="grid size-7 place-items-center rounded-lg border border-border text-muted-foreground">
                      <ChevronLeft className="size-4" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section className="surface-card overflow-hidden">
            <div className="border-b border-border px-5 py-4 text-end">
              <h3 className="font-bold text-foreground">قائمة العمل</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">عناصر تنتظر الإجراء</p>
            </div>
            <ul className="divide-y divide-border">
              {workQueue.map((row, i) => (
                <li key={row.title} className="flex items-center justify-between px-5 py-3.5">
                  <span className="flex items-center gap-2">
                    {row.value === "لا يوجد" ? (
                      <Chip tone="success">✓ لا يوجد</Chip>
                    ) : (
                      <Chip tone="warning">{row.value}</Chip>
                    )}
                    <ChevronLeft className="size-4 text-muted-foreground" />
                  </span>
                  <span className="flex items-center gap-3 text-end">
                    <span>
                      <span className="block text-[13px] font-semibold text-foreground">
                        {row.title}
                      </span>
                      <span className="block text-[11.5px] text-muted-foreground">{row.hint}</span>
                    </span>
                    <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary">
                      {[Search, ClipboardList, ClipboardList, Bell].map((Icon, idx) =>
                        idx === i ? <Icon key={idx} className="size-4" /> : null,
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <Link to="/contracts" className="text-[12.5px] font-semibold text-primary">
                عرض الكل
              </Link>
              <div className="text-end">
                <h3 className="font-bold text-foreground">عقود قريبة الانتهاء</h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  خلال الستين يومًا القادمة
                </p>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {endingContracts.map((row) => (
                <li key={row.name} className="flex items-center justify-between px-5 py-3.5">
                  <Chip tone="warning">{row.days}</Chip>
                  <span className="text-end">
                    <span className="block text-[13px] font-semibold text-foreground">
                      {row.name}
                    </span>
                    <span className="block text-[11.5px] text-muted-foreground">{row.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
