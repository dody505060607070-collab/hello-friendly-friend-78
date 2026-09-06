import { createFileRoute } from "@tanstack/react-router";
import { FileUp } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { importStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  file_name: string;
  file_size: number | null;
  pages: number | null;
  ocr_used: boolean | null;
  status: string;
  warnings: unknown[] | null;
  error_message: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/contract-imports")({
  head: () => ({
    meta: [
      { title: "استيراد عقود PDF | مثراء العقارية" },
      { name: "description", content: "استيراد ملفات العقود، استخراج البيانات ومراجعتها قبل الاعتماد." },
      { property: "og:title", content: "استيراد عقود PDF | مثراء العقارية" },
      { property: "og:description", content: "استخراج بيانات العقود من ملفات PDF ومراجعتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportsPage,
});

function ImportsPage() {
  return (
    <>
      <PageHero
        title="استيراد عقود PDF"
        subtitle="كل ملف يُفحص لمنع التكرار، وتُستخرج بياناته للمراجعة قبل إنشاء العقد."
        icon={FileUp}
      />

      <LiveTable<Row>
        table="contract_imports"
        select="id, file_name, file_size, pages, ocr_used, status, warnings, error_message, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث باسم الملف"
        emptyText="لا توجد ملفات مستوردة"
        emptyHint="ارفع ملف عقد PDF ليُفحص ويُستخرج منه البيانات للمراجعة."
        columns={[
          { header: "الملف", cell: (r) => r.file_name, className: "font-semibold" },
          {
            header: "الحجم",
            cell: (r) => (r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(2)} م.ب` : "—"),
          },
          { header: "الصفحات", cell: (r) => r.pages ?? "—" },
          {
            header: "OCR",
            cell: (r) => (
              <Chip tone={r.ocr_used ? "gold" : "neutral"}>{r.ocr_used ? "مستخدم" : "غير مطلوب"}</Chip>
            ),
          },
          { header: "تحذيرات", cell: (r) => (r.warnings?.length ?? 0) || "—" },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip
                tone={
                  r.status === "approved"
                    ? "success"
                    : r.status === "failed" || r.status === "rejected"
                      ? "danger"
                      : "warning"
                }
              >
                {importStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
          { header: "التاريخ", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
