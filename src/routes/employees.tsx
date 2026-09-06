import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";

export const Route = createFileRoute("/employees")({
  head: () => ({
    meta: [
      { title: "الموظفين — الرشودي للعقارات" },
      { name: "description", content: "إدارة حسابات الموظفين وصلاحياتهم داخل النظام." },
      { property: "og:title", content: "الموظفين — الرشودي للعقارات" },
      { property: "og:description", content: "حسابات الفريق، الأدوار والصلاحيات." },
    ],
  }),
  component: EmployeesPage,
});

type Employee = { name: string; role: string; phone: string; tasks: number; active: boolean };

const employees: Employee[] = [
  { name: "عبدالعزيز الرشودي", role: "مدير", phone: "+966500000001", tasks: 12, active: true },
  { name: "سعود السلمان", role: "موظف عقود", phone: "+966500000002", tasks: 24, active: true },
  { name: "يوسف علي اليحي", role: "مسوق", phone: "+966500000003", tasks: 18, active: true },
  { name: "مهند فهد الضبيب", role: "مصور", phone: "+966500000004", tasks: 9, active: true },
  { name: "كادي الحربي", role: "خدمة عملاء", phone: "+966500000005", tasks: 6, active: false },
];

const columns: Column<Employee>[] = [
  { header: "الاسم", cell: (r) => <span className="font-semibold">{r.name}</span> },
  { header: "الدور", cell: (r) => <Chip tone="primary">{r.role}</Chip> },
  { header: "الجوال", cell: (r) => <span dir="ltr">{r.phone}</span> },
  { header: "المهام", cell: (r) => <Chip tone="warning">{r.tasks}</Chip> },
  {
    header: "نشط",
    cell: (r) => <Chip tone={r.active ? "success" : "neutral"}>{r.active ? "نشط" : "موقوف"}</Chip>,
  },
];

function EmployeesPage() {
  return (
    <>
      <PageHero
        title="الموظفين"
        subtitle="إدارة حسابات الموظفين وصلاحياتهم داخل النظام."
        icon={UserCog}
        stats={[{ value: String(employees.length), label: "موظف" }]}
      />

      <PageBar crumbs={["الموظفين", "القائمة"]} action={{ label: "موظف جديد" }} />

      <DataTable columns={columns} rows={employees} pages={1} />
    </>
  );
}
