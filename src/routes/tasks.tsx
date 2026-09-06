import { createFileRoute } from "@tanstack/react-router";
import { Camera, ClipboardList, MessageSquare, TriangleAlert } from "lucide-react";

import { Chip, type ChipTone } from "@/components/kit/Chip";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { tasks } from "@/data/records";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "المهام — الرشودي للعقارات" },
      { name: "description", content: "تنظيم المهام ومتابعة التنفيذ والمراجعة." },
      { property: "og:title", content: "المهام — الرشودي للعقارات" },
      { property: "og:description", content: "مهام الفريق وحالتها ومواعيدها والمتأخر منها." },
    ],
  }),
  component: TasksPage,
});

type Task = (typeof tasks)[number];

const statusTone: Record<string, ChipTone> = {
  "قيد التنفيذ": "success",
  "معلّقة": "neutral",
  "في انتظار الموافقة": "warning",
};

const columns: Column<Task>[] = [
  {
    header: "المهمة",
    sortable: true,
    cell: (r) => <span className="font-semibold">{r.title}</span>,
  },
  {
    header: "النوع",
    cell: (r) => <Chip tone={r.type === "تصوير" ? "primary" : "neutral"}>{r.type}</Chip>,
  },
  {
    header: "الأولوية",
    cell: (r) => <Chip tone={r.priority === "عالية" ? "danger" : "warning"}>{r.priority}</Chip>,
  },
  {
    header: "الموظفون",
    cell: (r) => (
      <div className="flex flex-col items-start gap-1">
        {r.staff.map((s) => (
          <Chip key={s} tone="danger">
            {s}
          </Chip>
        ))}
      </div>
    ),
  },
  { header: "المُسند", cell: (r) => r.assignee },
  {
    header: "الحالة الكلية",
    cell: (r) => <Chip tone={statusTone[r.status] ?? "neutral"}>{r.status}</Chip>,
  },
  {
    header: "الموعد",
    sortable: true,
    cell: (r) =>
      r.due ? (
        <div className="text-start">
          <span className="flex items-center gap-1.5 font-semibold text-destructive">
            <TriangleAlert className="size-3.5" />
            {r.due}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-destructive/80">{r.lateNote}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">–</span>
      ),
  },
  {
    header: "مضى على الإرسال",
    sortable: true,
    cell: (r) => <span className="text-muted-foreground">{r.age}</span>,
  },
  {
    header: "",
    cell: (r) =>
      r.status === "في انتظار الموافقة" || r.late ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-semibold text-primary"
        >
          <MessageSquare className="size-3.5" />
          الشات
        </button>
      ) : null,
  },
];

function TasksPage() {
  return (
    <>
      <PageHero
        title="المهام"
        subtitle="تنظيم المهام ومتابعة التنفيذ والمراجعة."
        icon={ClipboardList}
        stats={[
          { value: "42", label: "مهمة نشطة" },
          { value: "7", label: "تنتظر الموافقة" },
          { value: "29", label: "مهام متأخرة" },
        ]}
      />

      <PageBar crumbs={["المهام", "القائمة"]} action={{ label: "إضافة مهمة" }} />

      <Pills
        variant="card"
        items={[
          { key: "all", label: "كل المهام", count: 145 },
          { key: "normal", label: "عادية", count: 91 },
          { key: "photo", label: "تصوير", count: 54, icon: Camera },
        ]}
      />

      <Pills
        items={[
          { key: "all", label: "الكل", count: 145 },
          { key: "progress", label: "قيد التنفيذ", count: 17 },
          { key: "waiting", label: "تنتظر الموافقة", count: 7 },
          { key: "done", label: "مكتملة", count: 101 },
          { key: "late", label: "متأخرة", count: 29 },
        ]}
      />

      <DataTable
        columns={columns}
        rows={tasks}
        selectable
        showColumnsButton
        total={145}
        pages={15}
        rowClassName={(r) => (r.late ? "bg-destructive/4 border-e-2 border-e-destructive" : undefined)}
      />
    </>
  );
}
