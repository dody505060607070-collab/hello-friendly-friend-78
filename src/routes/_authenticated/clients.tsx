import { createFileRoute } from "@tanstack/react-router";
import { Contact } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { contactRoleLabels } from "@/lib/labels";

type Row = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  roles: string[] | null;
  source: string | null;
  budget_min: number | null;
  budget_max: number | null;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "العملاء | مثراء العقارية" },
      { name: "description", content: "قاعدة العملاء والوسطاء وبيانات التواصل والميزانيات." },
      { property: "og:title", content: "العملاء | مثراء العقارية" },
      { property: "og:description", content: "قاعدة العملاء والوسطاء وبيانات التواصل والميزانيات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  return (
    <>
      <PageHero
        title="العملاء"
        subtitle="كل جهات الاتصال: ملاك، مستأجرون، مشترون، وسطاء وعملاء محتملون."
        icon={Contact}
      />

      <LiveTable<Row>
        table="contacts"
        select="id, full_name, phone, email, roles, source, budget_min, budget_max, is_active, created_at"
        orderBy={{ column: "created_at" }}
        queryKey={["contacts", "all"]}
        searchPlaceholder="بحث بالاسم أو الجوال"
        emptyText="لا يوجد عملاء مسجلون"
        emptyHint="أضِف عميلًا أو حوّل طلبًا واردًا إلى عميل ليظهر هنا."
        columns={[
          { header: "العميل", cell: (r) => r.full_name, className: "font-semibold" },
          { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span> },
          { header: "البريد", cell: (r) => <span dir="ltr">{r.email ?? "—"}</span> },
          {
            header: "الأدوار",
            cell: (r) => (
              <span className="flex flex-wrap gap-1">
                {(r.roles ?? []).map((role) => (
                  <Chip key={role} tone="primary">
                    {contactRoleLabels[role] ?? role}
                  </Chip>
                ))}
              </span>
            ),
          },
          { header: "المصدر", cell: (r) => r.source ?? "—" },
          {
            header: "الميزانية",
            cell: (r) =>
              r.budget_min || r.budget_max
                ? `${formatCurrency(r.budget_min)} — ${formatCurrency(r.budget_max)}`
                : "—",
          },
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
