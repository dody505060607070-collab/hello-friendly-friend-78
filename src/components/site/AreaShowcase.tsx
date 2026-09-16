import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpLeft, MapPin } from "lucide-react";

import { Reveal } from "@/components/site/Reveal";
import fallbackAreaImage from "@/assets/bg-city.jpg";
import { useI18n } from "@/lib/i18n";
import { publicAreasQuery } from "@/lib/site-data";
import { cn } from "@/lib/utils";

export function AreaShowcase({ purpose, currentCity }: { purpose?: "rent" | "sale"; currentCity?: string | null | undefined }) {
  const { lang, t } = useI18n();
  const { data, isLoading } = useQuery(publicAreasQuery(purpose));
  const areas = (data ?? []).slice(0, 5);
  if (!isLoading && areas.length === 0) return null;

  return (
    <Reveal as="section" className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[12px] font-bold text-gold">
            <MapPin className="size-4" /> {t("دليل المناطق")}
          </p>
          <h2 className="text-[24px] font-bold text-foreground sm:text-[30px]">
            {currentCity ? t("اكتشف عقارات المنطقة") : t("استكشف المناطق العقارية")}
          </h2>
        </div>
        <p className="max-w-md text-[13px] leading-7 text-muted-foreground">
          {t("اختر المنطقة المناسبة وشاهد العقارات المتاحة فيها مباشرة.")}
        </p>
      </div>

      {isLoading ? (
        <div className="grid h-[520px] animate-pulse gap-3 bg-muted md:grid-cols-2" />
      ) : (
        <div className="grid auto-rows-[210px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((area, index) => {
            const title = lang === "en" ? area.name_en || area.name : area.name;
            const description = lang === "en" ? area.description_en || area.description : area.description;
            const destination = purpose === "sale" ? "/sale" : "/rent";
            return (
              <Link
                key={area.id}
                to={destination}
                search={{ city: area.name }}
                className={cn(
                  "group relative isolate overflow-hidden rounded-lg bg-primary shadow-card",
                  index === 0 && "sm:row-span-2 lg:col-span-2",
                  index === 3 && "lg:col-span-2",
                  currentCity === area.name && "ring-2 ring-gold ring-offset-2 ring-offset-background",
                )}
              >
                <img src={area.image_url || fallbackAreaImage} alt={title} loading="lazy" className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-foreground/90 via-foreground/25 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-background sm:p-6">
                  <span className="min-w-0">
                    <strong className="block text-[18px] font-bold sm:text-[21px]">{title}</strong>
                    {description ? <span className="mt-1 line-clamp-2 block text-[12.5px] leading-6 opacity-85">{description}</span> : null}
                    <span className="mt-2 block text-[12px] font-semibold opacity-90">{area.property_count.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} {t("عقار متاح")}</span>
                  </span>
                  <ArrowUpLeft className="size-5 shrink-0 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Reveal>
  );
}