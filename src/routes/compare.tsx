import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GitCompareArrows, Plus, X } from "lucide-react";
import { useState } from "react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { coverImage, publicPropertiesQuery, purposeLabels } from "@/lib/site-data";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "مقارنة العقارات | مثراء العقارية" },
      {
        name: "description",
        content: "قارن حتى ثلاثة عقارات جنبًا إلى جنب: السعر والنوع والحي والمساحة والمميزات.",
      },
      { property: "og:title", content: "مقارنة العقارات | مثراء العقارية" },
      { property: "og:description", content: "قارن العقارات جنبًا إلى جنب واختر الأنسب لك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

const MAX = 3;

function ComparePage() {
  const { data, isLoading } = useQuery(publicPropertiesQuery(undefined, 200));
  const [picked, setPicked] = useState<string[]>([]);

  const all = data ?? [];
  const selected = picked
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is (typeof all)[number] => Boolean(p));

  const rows: { label: string; get: (p: (typeof all)[number]) => string }[] = [
    { label: "الكود", get: (p) => p.code },
    { label: "الغرض", get: (p) => purposeLabels[p.purpose] ?? p.purpose },
    { label: "النوع", get: (p) => p.property_type ?? "—" },
    { label: "المدينة", get: (p) => p.city ?? "—" },
    { label: "الحي", get: (p) => p.district ?? "—" },
    {
      label: "السعر",
      get: (p) =>
        p.price_text ??
        (p.price_value ? `${Number(p.price_value).toLocaleString("ar-EG")} ر.س` : "عند الطلب"),
    },
    { label: "الوصف", get: (p) => p.description ?? "—" },
  ];

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <header className="space-y-2 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[12.5px] font-semibold text-primary">
            <GitCompareArrows className="size-4" />
            مقارنة العقارات
          </span>
          <h1 className="text-2xl font-bold text-foreground">قارن حتى {MAX} عقارات جنبًا إلى جنب</h1>
          <p className="text-[13.5px] text-muted-foreground">
            اختر العقارات من القائمة ثم قارن السعر والموقع والنوع في جدول واحد.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="block text-[12.5px] font-semibold text-foreground">
            أضف عقارًا للمقارنة
            <select
              className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
              value=""
              disabled={isLoading || picked.length >= MAX}
              onChange={(e) => {
                const v = e.target.value;
                if (v && !picked.includes(v)) setPicked((p) => [...p, v]);
              }}
            >
              <option value="">
                {picked.length >= MAX ? `وصلت للحد الأقصى (${MAX})` : "— اختر عقارًا —"}
              </option>
              {all
                .filter((p) => !picked.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.code}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {selected.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Plus className="size-8 text-primary/60" />
            <p className="text-[15px] font-bold">لم تختر أي عقار بعد</p>
            <p className="max-w-md text-[12.5px] text-muted-foreground">
              اختر عقارين أو ثلاثة من القائمة أعلاه لتظهر المقارنة التفصيلية هنا.
            </p>
            <Link to="/rent" className="text-[12.5px] font-semibold text-primary">
              تصفّح عقارات الإيجار ←
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[620px] text-right text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-32 px-4 py-3 text-[12px] text-muted-foreground">البيان</th>
                  {selected.map((p) => (
                    <th key={p.id} className="px-4 py-3 align-top">
                      <div className="space-y-2">
                        <div className="relative">
                          <img
                            src={coverImage(p) ?? "/favicon.png"}
                            alt={p.name}
                            loading="lazy"
                            className="h-28 w-full rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setPicked((list) => list.filter((id) => id !== p.id))}
                            className="absolute end-2 top-2 grid size-7 place-items-center rounded-full bg-background/90 text-muted-foreground shadow"
                            aria-label={`إزالة ${p.name}`}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        <Link
                          to="/properties/$code"
                          params={{ code: p.code }}
                          className="block text-[13.5px] font-bold text-foreground hover:text-primary"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((r) => (
                  <tr key={r.label} className="odd:bg-muted/40">
                    <td className="px-4 py-3 text-[12px] font-semibold text-muted-foreground">
                      {r.label}
                    </td>
                    {selected.map((p) => (
                      <td key={p.id} className="px-4 py-3 align-top">
                        {r.get(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
