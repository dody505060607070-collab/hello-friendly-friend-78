import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";

import { TaskList } from "@/components/tasks/TaskList";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "المهام | مثراء العقارية" },
      { name: "description", content: "متابعة مهام الفريق ومهام التصوير واعتماد التنفيذ." },
      { property: "og:title", content: "المهام | مثراء العقارية" },
      { property: "og:description", content: "متابعة مهام الفريق ومهام التصوير واعتماد التنفيذ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <TaskList
      title="كل المهام"
      subtitle="جميع المهام المسندة للفريق مع حالتها وأولويتها وموعد التسليم."
      icon={CircleCheck}
    />
  ),
});
