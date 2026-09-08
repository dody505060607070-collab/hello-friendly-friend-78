import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin, Phone, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FavoriteButton } from "@/components/site/FavoriteButton";
import { PropertyCard } from "@/components/site/PropertyCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SOCIAL_PLATFORMS, SocialGlyph } from "@/components/site/SocialIcons";
import { recordView } from "@/lib/favorites";
import {
  COMPANY_PHONE,
  galleryImages,
  publicPropertiesQuery,
  publicPropertyQuery,
  purposeLabels,
  whatsappLink,
} from "@/lib/site-data";

export const Route = createFileRoute("/properties/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `عقار ${params.code} | مثراء العقارية` },
      {
        name: "description",
        content: `تفاصيل العقار رقم ${params.code} في بريدة: الموقع، السعر، المواصفات وطريقة التواصل مع مثراء العقارية.`,
      },
      { property: "og:title", content: `عقار ${params.code} | مثراء العقارية` },
      {
        property: "og:description",
        content: "تفاصيل كاملة للعقار مع صور وموقع وتواصل مباشر عبر واتساب.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PropertyPage,
  errorComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-foreground">تعذّر تحميل العقار</h1>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          العودة للرئيسية
        </Link>
      </div>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-foreground">العقار غير متاح</h1>
      </div>
    </SiteLayout>
  ),
});

function PropertyPage() {
  const { code } = Route.useParams();
  const { data: property, isLoading, error } = useQuery(publicPropertyQuery(code));
  const related = useQuery(publicPropertiesQuery(undefined, 12));
  const [active, setActive] = useState(0);

  useEffect(() => {
    recordView(code);
  }, [code]);

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        </div>
      </SiteLayout>
    );
  }

  if (error || !property) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-xl font-bold text-foreground">العقار غير متاح أو تم إخفاؤه</h1>
          <Link to="/rent" className="mt-4 inline-block text-primary hover:underline">
            تصفّح العقارات المتاحة
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const images = galleryImages(property);
  const price =
    property.price_text ??
    (property.price_value
      ? `${property.price_value.toLocaleString("ar-SA")} ريال`
      : "السعر عند الطلب");

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: property.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("تم نسخ رابط العقار");
      }
    } catch {
      /* المستخدم أغلق نافذة المشاركة */
    }
  };

  const others = (related.data ?? []).filter((p) => p.code !== property.code).slice(0, 3);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav className="mb-5 text-[12.5px] text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            الرئيسية
          </Link>
          {" / "}
          <Link
            to={property.purpose === "sale" ? "/sale" : "/rent"}
            className="hover:text-primary"
          >
            {property.purpose === "sale" ? "قسم البيع" : "قسم الإيجار"}
          </Link>
          {" / "}
          <span className="text-foreground">{property.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
              <FavoriteButton code={property.code} className="absolute end-4 top-4 z-10 size-11" />
              {images[active]?.url ? (
                <img
                  src={images[active]!.url}
                  alt={property.name}
                  className="h-[360px] w-full object-cover md:h-[440px]"
                />
              ) : (
                <div className="grid h-[360px] place-items-center text-muted-foreground">
                  <Building2 className="size-12" />
                </div>
              )}
            </div>

            {images.length > 1 ? (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.url + i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 ${
                      i === active ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-[17px] font-bold text-foreground">وصف العقار</h2>
              <p className="mt-3 whitespace-pre-line text-[14px] leading-8 text-muted-foreground">
                {property.description ?? "لم يُضف وصف لهذا العقار بعد. تواصل معنا للمزيد من التفاصيل."}
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary px-3 py-1 text-[12px] font-bold text-primary-foreground">
                  {purposeLabels[property.purpose] ?? property.purpose}
                </span>
                <span className="text-[12px] text-muted-foreground" dir="ltr">
                  {property.code}
                </span>
              </div>

              <h1 className="mt-4 text-[21px] font-bold leading-snug text-foreground">
                {property.name}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
                <MapPin className="size-4 text-primary/70" />
                {[property.district, property.city].filter(Boolean).join(" — ") || "بريدة"}
              </p>
              <p className="mt-4 text-[19px] font-extrabold text-primary">{price}</p>

              {property.property_type ? (
                <dl className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-xl bg-secondary/70 p-3">
                    <dt className="text-muted-foreground">نوع العقار</dt>
                    <dd className="mt-1 font-semibold text-foreground">{property.property_type}</dd>
                  </div>
                  <div className="rounded-xl bg-secondary/70 p-3">
                    <dt className="text-muted-foreground">المدينة</dt>
                    <dd className="mt-1 font-semibold text-foreground">{property.city ?? "بريدة"}</dd>
                  </div>
                </dl>
              ) : null}

              <div className="mt-6 space-y-2.5">
                <a
                  href={whatsappLink(
                    property.whatsapp_number,
                    `استفسار عن العقار ${property.code} — ${property.name}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg bg-primary py-3 text-center text-[14px] font-bold text-primary-foreground"
                >
                  تواصل عبر واتساب
                </a>
                <a
                  href={`tel:${COMPANY_PHONE}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border py-3 text-[14px] font-semibold text-foreground"
                >
                  <Phone className="size-4" />
                  اتصل بنا
                </a>
                <button
                  type="button"
                  onClick={share}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-[14px] font-semibold text-foreground"
                >
                  <Share2 className="size-4" />
                  مشاركة العقار
                </button>
                {SOCIAL_PLATFORMS.some((p) => property[p.key]) ? (
                  <div className="rounded-2xl border border-border p-4">
                    <p className="mb-3 text-[13px] font-bold text-foreground">شاهد العقار على</p>
                    <div className="flex flex-col gap-2.5">
                      {SOCIAL_PLATFORMS.filter((p) => property[p.key]).map((p) => (
                        <a
                          key={p.key}
                          href={property[p.key] as string}
                          target="_blank"
                          rel="noreferrer"
                          title={p.label}
                          aria-label={p.label}
                          className="flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-sm transition hover:scale-[1.02] hover:shadow-md"
                          style={{ backgroundColor: p.color }}
                        >
                          <SocialGlyph platform={p.key} className="size-7 shrink-0" />
                          <span className="text-[14px] font-bold">{p.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {property.map_url ? (
                  <a
                    href={property.map_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-border py-3 text-[14px] font-semibold text-foreground"
                  >
                    <MapPin className="size-4" />
                    الموقع على الخريطة
                  </a>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        {others.length > 0 ? (
          <section className="mt-14">
            <h2 className="mb-6 text-[20px] font-bold text-foreground">عقارات مشابهة</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </SiteLayout>
  );
}
