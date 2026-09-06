import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  source: string | null;
  message: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/error-log")({
  head: () => ({
    meta: [
      { title: "سجل الأخطاء | مثراء العقارية" },
      { name: "description", content: "أخطاء النظام وفشل الإرسال والتكاملات للمعالجة." },
      { property: "og:title", content: "سجل الأخطاء | مثراء العقارية" },
      { property: "og:description", content: "أخطاء النظام وفشل الإرسال والتكاملات للمعالجة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ErrorLogPage,
});

function ErrorLogPage() {
  return (
    <>
      <PageHero
        title="سجل الأخطاء"
        subtitle="كل فشل حقيقي يُسجَّل هنا بسببه، ولا يُعرض أي نجاح وهمي في النظام."
        icon={TriangleAlert}
      />

      <LiveTable<Row>
        table="error_log"
        select="id, source, message, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث في الأخطاء"
        emptyText="لا توجد أخطاء مسجلة"
        emptyHint="هذه علامة جيدة — لم يسجّل النظام أي فشل حتى الآن."
        columns={[
          { header: "المصدر", cell: (r) => r.source ?? "—", className: "font-semibold" },
          { header: "الرسالة", cell: (r) => <span dir="ltr">{r.message}</span> },
          { header: "التاريخ", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
