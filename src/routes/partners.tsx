import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";

import { PageBar } from "@/components/kit/PageBar";
import { PageHero } from "@/components/kit/PageHero";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "الشركاء — الرشودي للعقارات" },
      { name: "description", content: "إدارة شعارات الشركاء الظاهرة في الموقع." },
      { property: "og:title", content: "الشركاء — الرشودي للعقارات" },
      { property: "og:description", content: "إضافة وترتيب شركاء المنصة وشعاراتهم." },
    ],
  }),
  component: PartnersPage,
});

const partners = ["بنك التنمية", "وزارة الإسكان", "إيجار", "الهيئة العامة للعقار", "مساند"];

function PartnersPage() {
  return (
    <>
      <PageHero
        title="الشركاء"
        subtitle="إدارة شعارات الشركاء الظاهرة في الموقع."
        icon={Handshake}
        stats={[{ value: String(partners.length), label: "شريك" }]}
      />

      <PageBar crumbs={["الشركاء", "القائمة"]} action={{ label: "إضافة شريك" }} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((p) => (
          <div key={p} className="surface-card flex items-center justify-between px-5 py-6">
            <span className="text-[12px] text-muted-foreground">ظاهر</span>
            <span className="text-[14px] font-bold text-foreground">{p}</span>
          </div>
        ))}
      </div>
    </>
  );
}
