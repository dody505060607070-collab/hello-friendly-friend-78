import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Handshake, Home, KeyRound, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import bgCity from "@/assets/bg-city.jpg";
import ctaImage from "@/assets/cta-deal.jpg";
import featureCommercial from "@/assets/feature-commercial.jpg";
import featureInterior from "@/assets/feature-interior.jpg";
import featureLand from "@/assets/feature-land.jpg";
import videoInterior from "@/assets/video-interior.mp4.asset.json";
import videoCity from "@/assets/video-city.mp4.asset.json";
import { HeroVideo } from "@/components/site/HeroVideo";
import { PropertyGrid } from "@/components/site/PropertyCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PropertyMapSection } from "@/components/site/PropertyMapSection";
import { Reveal } from "@/components/site/Reveal";
import { useRecentlyViewed } from "@/lib/favorites";
import { publicPropertiesQuery, publicServicesQuery } from "@/lib/site-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مثراء العقارية | عقارات بريدة للإيجار والبيع" },
      {
        name: "description",
        content:
          "مثراء العقارية في بريدة: شقق وفلل ومعارض للإيجار والبيع، خبرة محلية تفوق 8 سنوات وخدمة سريعة عبر واتساب.",
      },
      { property: "og:title", content: "مثراء العقارية | عقارات بريدة للإيجار والبيع" },
      {
        property: "og:description",
        content: "خبرة محلية في سوق عقارات بريدة: إيجار، بيع، إدارة أملاك ومتابعة عقود.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const fallbackServices = [
  { id: "s1", title: "تأجير الوحدات", description: "شقق وفلل ومكاتب جاهزة للسكن والعمل.", icon: "KeyRound" },
  { id: "s2", title: "بيع العقارات", description: "أراضٍ وفلل وعمائر بأسعار السوق الحقيقية.", icon: "Home" },
  { id: "s3", title: "إدارة الأملاك", description: "متابعة العقود والتحصيل والصيانة عن المالك.", icon: "ShieldCheck" },
  { id: "s4", title: "الوساطة العقارية", description: "تفاوض ووساطة موثوقة بين المالك والمستأجر.", icon: "Handshake" },
];

const serviceIcons = { KeyRound, Home, ShieldCheck, Handshake, Building2 } as const;

function HomePage() {
  const rent = useQuery(publicPropertiesQuery("rent", 6));
  const sale = useQuery(publicPropertiesQuery("sale", 6));
  const services = useQuery(publicServicesQuery);
  const all = useQuery(publicPropertiesQuery(undefined, 200));

  const [purpose, setPurpose] = useState("");
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");

  const types = useMemo(
    () => [...new Set((all.data ?? []).map((p) => p.property_type).filter(Boolean))] as string[],
    [all.data],
  );
  const districts = useMemo(
    () => [...new Set((all.data ?? []).map((p) => p.district).filter(Boolean))] as string[],
    [all.data],
  );

  const results = useMemo(() => {
    if (!purpose && !type && !district) return null;
    return (all.data ?? []).filter(
      (p) =>
        (!purpose || p.purpose === purpose) &&
        (!type || p.property_type === type) &&
        (!district || p.district === district),
    );
  }, [all.data, purpose, type, district]);

  const recentCodes = useRecentlyViewed();
  const recent = (all.data ?? []).filter((p) => recentCodes.includes(p.code)).slice(0, 3);

  const shownServices = services.data?.length ? services.data : fallbackServices;

  return (
    <SiteLayout>
      <HeroVideo />


      <section className="relative z-20 mx-auto -mt-14 max-w-5xl px-4">
        <div className="glass-panel animate-pop-in p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              aria-label="نوع العرض"
              className="h-11 rounded-xl border border-input bg-card/80 px-3 text-[13.5px] outline-none transition-colors focus:border-primary/50"
            >
              <option value="">كل العروض</option>
              <option value="rent">للإيجار</option>
              <option value="sale">للبيع</option>
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="نوع العقار"
              className="h-11 rounded-xl border border-input bg-card/80 px-3 text-[13.5px] outline-none transition-colors focus:border-primary/50"
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
              className="h-11 rounded-xl border border-input bg-card/80 px-3 text-[13.5px] outline-none transition-colors focus:border-primary/50"
            >
              <option value="">كل الأحياء</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="shine flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[13.5px] font-bold text-primary-foreground">
              <Search className="size-4" />
              {results ? `${results.length} نتيجة` : "ابحث عن عقارك"}
            </div>
          </div>
        </div>
      </section>

      {results ? (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-6 text-[22px] font-bold text-foreground">نتائج البحث</h2>
          <PropertyGrid
            properties={results}
            loading={all.isLoading}
            error={all.error}
            emptyText="لا توجد عقارات مطابقة لبحثك حالياً."
          />
        </section>
      ) : null}

      <Reveal as="section" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[22px] font-bold text-foreground sm:text-[26px]">أحدث عقارات الإيجار</h2>
          <Link to="/rent" className="text-[13.5px] font-semibold text-primary hover:underline">
            عرض الكل
          </Link>
        </div>
        <PropertyGrid
          properties={rent.data}
          loading={rent.isLoading}
          error={rent.error}
          emptyText="لا توجد عقارات إيجار معروضة حالياً."
        />
      </Reveal>

      <Reveal as="section" className="mesh-bg py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-[22px] font-bold text-foreground sm:text-[26px]">أحدث عقارات البيع</h2>
            <Link to="/sale" className="text-[13.5px] font-semibold text-primary hover:underline">
              عرض الكل
            </Link>
          </div>
          <PropertyGrid
            properties={sale.data}
            loading={sale.isLoading}
            error={sale.error}
            emptyText="لا توجد عقارات بيع معروضة حالياً."
          />
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-[24px] font-bold text-foreground sm:text-[30px]">خدماتنا</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[13.5px] leading-7 text-muted-foreground">
          نغطي رحلة العقار كاملة: العرض، التفاوض، العقد، ثم المتابعة والتحصيل.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shownServices.map((service) => {
            const Icon =
              serviceIcons[(service.icon ?? "Building2") as keyof typeof serviceIcons] ?? Building2;
            return (
              <div
                key={service.id}
                className="glass lift rounded-2xl p-6 text-center"
              >
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-card">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-4 text-[15.5px] font-bold text-foreground">{service.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      </Reveal>

      {recent.length > 0 ? (
        <Reveal as="section" className="mx-auto max-w-6xl px-4 pb-6">
          <h2 className="mb-6 text-[22px] font-bold text-foreground sm:text-[26px]">شاهدتها مؤخراً</h2>
          <PropertyGrid properties={recent} />
        </Reveal>
      ) : null}

      <Reveal as="section" className="relative isolate overflow-hidden py-20">
        <img
          src={bgCity}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-background/85 backdrop-blur-[2px]" />
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-[24px] font-bold text-foreground sm:text-[30px]">
            تصنيفات نغطيها في بريدة
          </h2>
          <div className="mt-9 grid gap-6 md:grid-cols-3">
            {[
              { img: featureInterior, title: "سكني مفروش وجاهز", text: "شقق وفلل بتشطيب حديث جاهزة للسكن الفوري.", to: "/rent" as const },
              { img: featureCommercial, title: "تجاري ومكاتب", text: "معارض ومكاتب في مواقع حيوية بمداخل مستقلة.", to: "/rent" as const },
              { img: featureLand, title: "أراضٍ واستثمار", text: "أراضٍ سكنية وتجارية بفرص نمو حقيقية.", to: "/sale" as const },
            ].map((card) => (
              <Link
                key={card.title}
                to={card.to}
                className="lift group relative isolate block h-72 overflow-hidden rounded-3xl shadow-card"
              >
                <img
                  src={card.img}
                  alt={card.title}
                  loading="lazy"
                  className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 block p-6 text-white">
                  <span className="block text-[17px] font-bold">{card.title}</span>
                  <span className="mt-1.5 block text-[13px] leading-6 text-white/85">{card.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="text-[22px] font-bold text-foreground sm:text-[26px]">جولة بصرية</h2>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          لمحات من العقارات والأحياء التي نعمل بها.
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {[{ v: videoInterior, poster: featureInterior }, { v: videoCity, poster: bgCity }].map(({ v, poster }) => (
            <video
              key={v.url}
              src={v.url}
              poster={poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-64 w-full rounded-3xl object-cover shadow-card md:h-72"
            />
          ))}
        </div>
      </Reveal>

      <PropertyMapSection properties={all.data} />

      <section className="relative isolate overflow-hidden py-20 text-white">
        <img
          src={ctaImage}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-primary/75" />
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 text-center">
          <h2 className="text-[24px] font-bold sm:text-[30px]">عندك عقار للإيجار أو البيع؟</h2>
          <p className="max-w-xl text-[14px] leading-7 text-white/90">
            أرسل تفاصيل عقارك وسيتواصل معك فريقنا لتقييمه وعرضه على العملاء المناسبين.
          </p>
          <Link
            to="/list-property"
            className="shine rounded-xl bg-gold px-8 py-3.5 text-[14px] font-bold text-gold-foreground"
          >
            اعرض | اطلب عقارك
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
