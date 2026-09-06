import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PropertyGrid } from "@/components/site/PropertyCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PropertyMapSection } from "@/components/site/PropertyMapSection";
import { publicPropertiesQuery } from "@/lib/site-data";

export const Route = createFileRoute("/rent")({
  head: () => ({
    meta: [
      { title: "عقارات للإيجار في بريدة | مثراء العقارية" },
      {
        name: "description",
        content: "شقق وفلل ومكاتب ومعارض للإيجار في بريدة مع أسعار محدثة وتواصل مباشر عبر واتساب.",
      },
      { property: "og:title", content: "عقارات للإيجار في بريدة | مثراء العقارية" },
      {
        property: "og:description",
        content: "تصفّح وحدات الإيجار المتاحة في أحياء بريدة واختر ما يناسبك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RentPage,
});

function RentPage() {
  const { data, isLoading, error } = useQuery(publicPropertiesQuery("rent", 200));
  const [district, setDistrict] = useState("");
  const [type, setType] = useState("");

  const districts = useMemo(
    () => [...new Set((data ?? []).map((p) => p.district).filter(Boolean))] as string[],
    [data],
  );
  const types = useMemo(
    () => [...new Set((data ?? []).map((p) => p.property_type).filter(Boolean))] as string[],
    [data],
  );

  const filtered = (data ?? []).filter(
    (p) => (!district || p.district === district) && (!type || p.property_type === type),
  );

  return (
    <SiteLayout>
      <section className="bg-primary py-14 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-[28px] font-extrabold">قسم الإيجار</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-7 opacity-90">
            وحدات سكنية وتجارية جاهزة للإيجار في أحياء بريدة، محدّثة مباشرة من نظام إدارة العقارات
            لدينا.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:w-2/3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="نوع العقار"
            className="h-11 rounded-lg border border-input bg-card px-3 text-[13.5px]"
          >
            <option value="">كل أنواع العقارات</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            aria-label="الحي"
            className="h-11 rounded-lg border border-input bg-card px-3 text-[13.5px]"
          >
            <option value="">كل الأحياء</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <PropertyGrid
          properties={filtered}
          loading={isLoading}
          error={error}
          emptyText="لا توجد عقارات إيجار معروضة حالياً."
        />
      </section>

      <PropertyMapSection
        properties={filtered}
        title="خريطة عقارات الإيجار"
        description="النقاط الحمراء للإيجار والصفراء للبيع — اضغط على النقطة لعرض تفاصيل العقار."
      />
    </SiteLayout>
  );
}
