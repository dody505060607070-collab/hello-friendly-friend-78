import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Handshake, Home, KeyRound, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import heroImage from "@/assets/site-hero.jpg";
import { PropertyGrid } from "@/components/site/PropertyCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { publicPropertiesQuery, publicServicesQuery } from "@/lib/site-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الرشودي للعقارات | عقارات بريدة للإيجار والبيع" },
      {
        name: "description",
        content:
          "الرشودي للعقارات في بريدة: شقق وفلل ومعارض للإيجار والبيع، خبرة محلية تفوق 8 سنوات وخدمة سريعة عبر واتساب.",
      },
      { property: "og:title", content: "الرشودي للعقارات | عقارات بريدة للإيجار والبيع" },
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
  const all = useQuery(publicPropertiesQuery(undefined, 60));

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

  const shownServices = services.data?.length ? services.data : fallbackServices;

  return (
    <SiteLayout>
      <section className="relative isolate">
        <img
          src={heroImage}
          alt="عقارات الرشودي في بريدة"
          width={1920}
          height={1088}
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-primary/75" />
        <div className="mx-auto max-w-4xl px-4 py-24 text-center text-primary-foreground md:py-32">
          <p className="text-[14px] font-semibold tracking-wide text-gold">
            نعرف بريدة.. ونفهم العقار
          </p>
          <h1 className="mt-4 text-3xl font-extrabold leading-snug md:text-5xl">
            خبرةٌ محلية.. وقرارٌ عقاري أوضح
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-8 opacity-90">
            أكثر من 8 سنوات في سوق عقارات بريدة. نساعدك على اختيار الوحدة المناسبة للإيجار أو
            الشراء، ونتابع معك العقد والتحصيل حتى النهاية.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/rent"
              className="rounded-lg bg-gold px-6 py-3 text-[14px] font-bold text-gold-foreground"
            >
              تصفّح عقارات الإيجار
            </Link>
            <Link
              to="/sale"
              className="rounded-lg border border-primary-foreground/40 px-6 py-3 text-[14px] font-bold"
            >
              تصفّح عقارات البيع
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 max-w-5xl px-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-float">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              aria-label="نوع العرض"
              className="h-11 rounded-lg border border-input bg-background px-3 text-[13.5px]"
            >
              <option value="">كل العروض</option>
              <option value="rent">للإيجار</option>
              <option value="sale">للبيع</option>
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="نوع العقار"
              className="h-11 rounded-lg border border-input bg-background px-3 text-[13.5px]"
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
              className="h-11 rounded-lg border border-input bg-background px-3 text-[13.5px]"
            >
              <option value="">كل الأحياء</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-[13.5px] font-bold text-primary-foreground">
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

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-[22px] font-bold text-foreground">أحدث عقارات الإيجار</h2>
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
      </section>

      <section className="bg-secondary/60 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-[22px] font-bold text-foreground">أحدث عقارات البيع</h2>
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
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-[22px] font-bold text-foreground">خدماتنا</h2>
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
                className="rounded-2xl border border-border bg-card p-6 text-center shadow-card"
              >
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
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
      </section>

      <section className="bg-primary py-14 text-primary-foreground">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 text-center">
          <h2 className="text-[24px] font-bold">عندك عقار للإيجار أو البيع؟</h2>
          <p className="max-w-xl text-[14px] leading-7 opacity-90">
            أرسل تفاصيل عقارك وسيتواصل معك فريقنا لتقييمه وعرضه على العملاء المناسبين.
          </p>
          <Link
            to="/list-property"
            className="rounded-lg bg-gold px-7 py-3 text-[14px] font-bold text-gold-foreground"
          >
            اعرض | اطلب عقارك
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
