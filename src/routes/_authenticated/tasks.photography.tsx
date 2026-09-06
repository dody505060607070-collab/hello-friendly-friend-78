import { createFileRoute } from "@tanstack/react-router";
import { Camera } from "lucide-react";

import { TaskList } from "@/components/tasks/TaskList";

export const Route = createFileRoute("/_authenticated/tasks/photography")({
  head: () => ({
    meta: [
      { title: "مهام التصوير | الرشودي للعقارات" },
      { name: "description", content: "مهام تصوير العقارات ومراجعة الصور واعتمادها قبل النشر." },
      { property: "og:title", content: "مهام التصوير | الرشودي للعقارات" },
      { property: "og:description", content: "مهام تصوير العقارات ومراجعة الصور واعتمادها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <TaskList
      title="مهام التصوير"
      subtitle="مهام تصوير العقارات، وتُراجع الصور وتُعتمد قبل نشرها على الموقع."
      icon={Camera}
      taskType="photography"
    />
  ),
});
