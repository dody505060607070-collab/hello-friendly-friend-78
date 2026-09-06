import { createFileRoute } from "@tanstack/react-router";
import { Sparkle } from "lucide-react";

import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "الخدمات — الرشودي للعقارات" },
      { name: "description", content: "إدارة الخدمات المعروضة في صفحة الموقع." },
      { property: "og:title", content: "الخدمات — الرشودي للعقارات" },
      { property: "og:description", content: "خدمات المنصة العقارية ووصف كل خدمة." },
    ],
  }),
  component: ServicesPage,
});

const services = [
  { title: "إدارة الأملاك", desc: "تشغيل وإدارة العقارات نيابة عن المالك." },
  { title: "التسويق العقاري", desc: "تسويق الوحدات للبيع والإيجار." },
  { title: "تحصيل الإيجارات", desc: "متابعة الدفعات والمتأخرات." },
  { title: "التصوير العقاري", desc: "جلسات تصوير احترافية للوحدات." },
];

function ServicesPage() {
  return (
    <>
      <PageHero
        title="الخدمات"
        subtitle="إدارة الخدمات المعروضة في صفحة الموقع."
        icon={Sparkle}
        stats={[{ value: String(services.length), label: "خدمة" }]}
      />

      <PageBar crumbs={["الخدمات", "القائمة"]} action={{ label: "إضافة خدمة" }} />

      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.title} className="surface-card p-5 text-end">
            <h2 className="font-bold text-foreground">{s.title}</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
