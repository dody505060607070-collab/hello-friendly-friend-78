import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { contractStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  contract_number: string | null;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  annual_rent: number | null;
  total_value: number | null;
  payment_cycle: string | null;
  status: string;
  source: string | null;
  owner: { full_name: string } | null;
  tenant: { full_name: string } | null;
};

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({
    meta: [
      { title: "إدارة العقود | الرشودي للعقارات" },
      { name: "description", content: "عقود الإيجار والبيع مع الأطراف والمدد والقيم وحالة السريان." },
      { property: "og:title", content: "إدارة العقود | الرشودي للعقارات" },
      { property: "og:description", content: "عقود الإيجار والبيع مع الأطراف والمدد وحالة السريان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <>
      <PageHero
        title="إدارة العقود"
        subtitle="جميع العقود المسجلة أو المستوردة من ملفات PDF، مع أطرافها وقيمها ودفعاتها."
        icon={FileText}
      />

      <LiveTable<Row>
        table="contracts"
        select="id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, payment_cycle, status, source, owner:owner_id(full_name), tenant:tenant_id(full_name)"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث برقم العقد أو الطرف"
        emptyText="لا توجد عقود"
        emptyHint="أضِف عقدًا يدويًا أو استورد ملف PDF لعقد قائم ليظهر هنا."
        columns={[
          { header: "رقم العقد", cell: (r) => r.contract_number ?? "—", className: "font-semibold" },
          { header: "النوع", cell: (r) => (r.contract_type === "sale" ? "بيع" : "إيجار") },
          { header: "المالك", cell: (r) => r.owner?.full_name ?? "—" },
          { header: "المستأجر / المشتري", cell: (r) => r.tenant?.full_name ?? "—" },
          { header: "من", cell: (r) => formatDate(r.start_date) },
          { header: "إلى", cell: (r) => formatDate(r.end_date) },
          {
            header: "القيمة",
            cell: (r) => formatCurrency(r.annual_rent ?? r.total_value),
          },
          {
            header: "المصدر",
            cell: (r) => (
              <Chip tone={r.source === "pdf_import" ? "gold" : "neutral"}>
                {r.source === "pdf_import" ? "استيراد PDF" : "إدخال يدوي"}
              </Chip>
            ),
          },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip
                tone={
                  r.status === "active"
                    ? "success"
                    : r.status === "expired" || r.status === "terminated"
                      ? "danger"
                      : "warning"
                }
              >
                {contractStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
        ]}
      />
    </>
  );
}
