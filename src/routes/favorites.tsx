import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import heroImage from "@/assets/feature-interior.jpg";
import { PageHero } from "@/components/site/PageHero";
import { PropertyGrid } from "@/components/site/PropertyCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useFavorites } from "@/lib/favorites";
import { publicPropertiesQuery } from "@/lib/site-data";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "عقاراتي المفضلة | مثراء العقارية" },
      {
        name: "description",
        content: "العقارات التي حفظتها من موقع مثراء العقارية في بريدة لمتابعتها ومقارنتها لاحقاً.",
      },
      { property: "og:title", content: "عقاراتي المفضلة | مثراء العقارية" },
      { property: "og:description", content: "قائمة العقارات المحفوظة على جهازك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { favorites, clear } = useFavorites();
  const { data, isLoading, error } = useQuery(publicPropertiesQuery(undefined, 300));
  const list = (data ?? []).filter((p) => favorites.includes(p.code));

  return (
    <SiteLayout>
      <PageHero
        image={heroImage}
        eyebrow="محفوظة على جهازك"
        title="عقاراتي المفضلة"
        subtitle="احفظ العقارات التي تهمك وقارن بينها بسهولة قبل التواصل معنا."
        height="sm"
      />

      <section className="mx-auto max-w-6xl px-4 py-12">
        {favorites.length > 0 ? (
          <div className="mb-6 flex items-center justify-between">
            <p className="text-[13.5px] text-muted-foreground">
              لديك {favorites.length.toLocaleString("ar-SA")} عقار محفوظ
            </p>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-muted"
            >
              تفريغ القائمة
            </button>
          </div>
        ) : null}

        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
            <Heart className="mx-auto size-10 text-primary/40" />
            <p className="mt-4 text-[14px] text-muted-foreground">
              لم تحفظ أي عقار بعد. اضغط على القلب في أي عقار لإضافته هنا.
            </p>
            <Link
              to="/rent"
              className="mt-5 inline-flex rounded-lg bg-primary px-5 py-2.5 text-[13px] font-bold text-primary-foreground"
            >
              تصفّح عقارات الإيجار
            </Link>
          </div>
        ) : (
          <PropertyGrid
            properties={list}
            loading={isLoading}
            error={error}
            emptyText="العقارات المحفوظة لم تعد متاحة للعرض."
          />
        )}
      </section>
    </SiteLayout>
  );
}
