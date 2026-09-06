import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون | مثراء العقارية" },
      { name: "description", content: "حسابات فريق العمل وحالتها وصلاحياتها في النظام." },
      { property: "og:title", content: "الموظفون | مثراء العقارية" },
      { property: "og:description", content: "حسابات فريق العمل وحالتها وصلاحياتها في النظام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  return (
    <>
      <PageHero
        title="الموظفون"
        subtitle="حسابات الفريق. الصلاحيات تُدار من صفحة الأدوار والصلاحيات وتُطبّق على قاعدة البيانات."
        icon={UserCog}
      />

      <LiveTable<Row>
        table="profiles"
        select="id, full_name, email, phone, job_title, is_active, created_at"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بالاسم أو البريد"
        emptyText="لا توجد حسابات موظفين"
        emptyHint="كل حساب يُنشأ عبر صفحة الدخول يظهر هنا تلقائيًا."
        columns={[
          { header: "الموظف", cell: (r) => r.full_name, className: "font-semibold" },
          { header: "البريد", cell: (r) => <span dir="ltr">{r.email ?? "—"}</span> },
          { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span> },
          { header: "المسمى", cell: (r) => r.job_title ?? "—" },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "نشط" : "موقوف"}</Chip>
            ),
          },
          { header: "أُضيف", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
