import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageHero } from "@/components/kit/PageHero";

export const Route = createFileRoute("/error-log")({
  head: () => ({
    meta: [
      { title: "سجل الأخطاء — الرشودي للعقارات" },
      { name: "description", content: "متابعة أخطاء النظام وحالة معالجتها." },
      { property: "og:title", content: "سجل الأخطاء — الرشودي للعقارات" },
      { property: "og:description", content: "سجل تفصيلي بالأخطاء التقنية وتاريخ حدوثها." },
    ],
  }),
  component: ErrorLogPage,
});

type LogRow = { code: string; message: string; page: string; date: string; level: string };

const logs: LogRow[] = [
  {
    code: "ERR-1042",
    message: "تعذر إرسال تذكير واتساب",
    page: "/reminders",
    date: "05/09/2026 21:14",
    level: "تحذير",
  },
  {
    code: "ERR-1039",
    message: "فشل رفع ملف عقد PDF",
    page: "/contracts",
    date: "04/09/2026 12:02",
    level: "خطأ",
  },
  {
    code: "ERR-1031",
    message: "انتهاء صلاحية جلسة مستخدم",
    page: "/owners",
    date: "02/09/2026 08:45",
    level: "معلومة",
  },
];

const columns: Column<LogRow>[] = [
  { header: "الكود", cell: (r) => <span className="font-semibold">{r.code}</span> },
  { header: "الرسالة", cell: (r) => r.message },
  { header: "الصفحة", cell: (r) => <span dir="ltr">{r.page}</span> },
  { header: "التاريخ", sortable: true, cell: (r) => r.date },
  {
    header: "المستوى",
    cell: (r) => (
      <Chip tone={r.level === "خطأ" ? "danger" : r.level === "تحذير" ? "warning" : "neutral"}>
        {r.level}
      </Chip>
    ),
  },
];

function ErrorLogPage() {
  return (
    <>
      <PageHero
        title="سجل الأخطاء"
        subtitle="متابعة أخطاء النظام وحالة معالجتها."
        icon={ShieldAlert}
        stats={[{ value: String(logs.length), label: "سجل" }]}
      />

      <DataTable columns={columns} rows={logs} pages={1} />
    </>
  );
}
