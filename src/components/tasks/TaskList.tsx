import type { LucideIcon } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { ToneLegend } from "@/components/kit/ToneLegend";
import { priorityLabels, taskStatusLabels } from "@/lib/labels";
import { rowToneClass, rowToneLabel, taskRowTone } from "@/lib/row-tone";

type Row = {
  id: string;
  title: string;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  property: { name: string } | null;
  created_at: string;
};

export function TaskList({
  title,
  subtitle,
  icon,
  taskType,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  taskType?: "normal" | "photography";
}) {
  return (
    <>
      <PageHero title={title} subtitle={subtitle} icon={icon} />

      <LiveTable<Row>
        table="tasks"
        select="id, title, task_type, priority, status, due_date, due_time, created_at, property:property_id(name)"
        {...(taskType ? { filter: (q: any) => q.eq("task_type", taskType) } : {})}
        queryKey={["tasks", taskType ?? "all"]}
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بعنوان المهمة"
        emptyText="لا توجد مهام"
        emptyHint="أنشئ مهمة وأسندها لموظف لتظهر هنا مع حالتها."
        columns={[
          { header: "المهمة", cell: (r) => r.title, className: "font-semibold" },
          {
            header: "النوع",
            cell: (r) => (
              <Chip tone={r.task_type === "photography" ? "gold" : "neutral"}>
                {r.task_type === "photography" ? "تصوير" : "عادية"}
              </Chip>
            ),
          },
          { header: "العقار", cell: (r) => r.property?.name ?? "—" },
          { header: "الأولوية", cell: (r) => priorityLabels[r.priority] ?? r.priority },
          {
            header: "التسليم",
            cell: (r) => [formatDate(r.due_date), r.due_time].filter(Boolean).join(" · "),
          },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip
                tone={
                  r.status === "approved" || r.status === "done"
                    ? "success"
                    : r.status === "rejected"
                      ? "danger"
                      : r.status === "submitted"
                        ? "warning"
                        : "primary"
                }
              >
                {taskStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
          { header: "أُنشئت", cell: (r) => formatDate(r.created_at) },
        ]}
      />
    </>
  );
}
