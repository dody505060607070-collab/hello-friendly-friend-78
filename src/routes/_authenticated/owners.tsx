import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { contactRoleLabels } from "@/lib/labels";

type Row = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  national_id: string | null;
  roles: string[] | null;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/owners")({
  head: () => ({
    meta: [
      { title: "الملاك | الرشودي للعقارات" },
      { name: "description", content: "سجل الملاك وبيانات التواصل والعقارات المرتبطة بهم." },
      { property: "og:title", content: "الملاك | الرشودي للعقارات" },
      { property: "og:description", content: "سجل الملاك وبيانات التواصل والعقارات المرتبطة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnersPage,
});

function OwnersPage() {
  return (
    <>
      <PageHero
        title="الملاك"
        subtitle="بيانات الملاك المسجلين، وتُستخدم في العقود والمباني والوحدات."
        icon={Users}
      />

      <LiveTable<Row>
        table="contacts"
        select="id, full_name, phone, whatsapp, email, national_id, roles, is_active, created_at"
        filter={(q) => q.contains("roles", ["owner"])}
        orderBy={{ column: "created_at" }}
        queryKey={["contacts", "owners"]}
        searchPlaceholder="بحث بالاسم أو الجوال"
        emptyText="لا يوجد ملاك مسجلون"
        emptyHint="أضِف مالكًا جديدًا أو حوّل أحد مقدمي الطلبات إلى مالك."
        columns={[
          { header: "المالك", cell: (r) => r.full_name, className: "font-semibold" },
          { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone ?? "—"}</span> },
          { header: "واتساب", cell: (r) => <span dir="ltr">{r.whatsapp ?? "—"}</span> },
          { header: "البريد", cell: (r) => <span dir="ltr">{r.email ?? "—"}</span> },
          { header: "الهوية", cell: (r) => <span dir="ltr">{r.national_id ?? "—"}</span> },
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
