import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";

import { TaskList } from "@/components/tasks/TaskList";

export const Route = createFileRoute("/_authenticated/tasks/normal")({
  head: () => ({
    meta: [
      { title: "المهام العادية | مثراء العقارية" },
      { name: "description", content: "المهام الإدارية والتشغيلية المسندة لفريق مثراء." },
      { property: "og:title", content: "المهام العادية | مثراء العقارية" },
      { property: "og:description", content: "المهام الإدارية والتشغيلية المسندة للفريق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <TaskList
      title="المهام العادية"
      subtitle="المهام الإدارية والتشغيلية غير المرتبطة بالتصوير."
      icon={ListChecks}
      taskType="normal"
    />
  ),
});
