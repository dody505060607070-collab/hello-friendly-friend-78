import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Check,
  FileText,
  Image as ImageIcon,
  Info,
  Link2,
  MapPin,
  Phone,
  Settings as SettingsIcon,
  UploadCloud,
} from "lucide-react";

import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "إعدادات الموقع — مثراء العقارية" },
      { name: "description", content: "التحكم في بيانات الموقع والتواصل وإعدادات التشغيل." },
      { property: "og:title", content: "إعدادات الموقع — مثراء العقارية" },
      { property: "og:description", content: "الهوية البصرية وبيانات التواصل والروابط والإحصائيات." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHero
        title="إعدادات الموقع"
        subtitle="التحكم في بيانات الموقع والتواصل وإعدادات التشغيل."
        icon={SettingsIcon}
      />

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <Pills
            items={[
              { key: "brand", label: "الهوية البصرية", icon: ImageIcon },
              { key: "contact", label: "التواصل", icon: Phone },
              { key: "invoices", label: "الفواتير", icon: FileText },
              { key: "info", label: "المعلومات", icon: Info },
              { key: "stats", label: "الإحصائيات", icon: BarChart3 },
              { key: "links", label: "الروابط", icon: Link2 },
              { key: "areas", label: "الأنواع والأحياء", icon: MapPin },
            ]}
          />
        </div>

        <div className="p-5">
          <div className="rounded-xl border border-border bg-accent/40 px-5 py-4 text-end">
            <h2 className="font-bold text-foreground">شعار المنصة</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              الشعار المعتمد في جميع واجهات المنصة.
            </p>
          </div>

          <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-border bg-card px-6 py-14">
            <div className="flex flex-col items-center gap-2 text-center">
              <UploadCloud className="size-6 text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground">
                اسحب الشعار هنا أو اضغط للاختيار
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[13.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Check className="size-4" />
          حفظ الإعدادات
        </button>
      </div>
    </>
  );
}
