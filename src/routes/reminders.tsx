import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "إدارة التذكيرات — الرشودي للعقارات" },
      { name: "description", content: "متابعة تذكيرات السداد والتجديد وحالة إرسالها." },
      { property: "og:title", content: "إدارة التذكيرات — الرشودي للعقارات" },
      { property: "og:description", content: "التذكيرات المجدولة والمرسلة والمتعذر إرسالها." },
    ],
  }),
  component: RemindersPage,
});

function RemindersPage() {
  return (
    <>
      <PageHero
        title="إدارة التذكيرات"
        subtitle="متابعة تذكيرات السداد والتجديد وحالة إرسالها."
        icon={Bell}
        stats={[
          { value: "1", label: "تذكير مجدول" },
          { value: "8", label: "تحتاج مراجعة" },
        ]}
      />

      <PageBar crumbs={["التذكيرات", "القائمة"]} action={{ label: "تذكير جديد" }} />

      <Pills
        items={[
          { key: "scheduled", label: "المجدولة", count: 1 },
          { key: "sent", label: "المرسلة" },
          { key: "failed", label: "متعذرة", count: 8 },
        ]}
      />

      <div className="surface-card grid place-items-center gap-3 px-6 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Bell className="size-5" />
        </span>
        <h2 className="text-base font-bold text-foreground">لا توجد تذكيرات مجدولة</h2>
        <p className="text-[12.5px] text-muted-foreground">
          سيتم إظهار التذكيرات هنا بعد جدولتها من العقود.
        </p>
      </div>
    </>
  );
}
