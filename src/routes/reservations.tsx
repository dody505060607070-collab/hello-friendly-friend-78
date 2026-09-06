import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, CircleX, Clock, Columns3, Filter, Lock, Search } from "lucide-react";

import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "إدارة الحجوزات — الرشودي للعقارات" },
      { name: "description", content: "متابعة حجوزات العقارات وحالتها الحالية." },
      { property: "og:title", content: "إدارة الحجوزات — الرشودي للعقارات" },
      { property: "og:description", content: "الحجوزات النشطة والمنتهية وحالة كل حجز." },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  return (
    <>
      <PageHero
        title="إدارة الحجوزات"
        subtitle="متابعة حجوزات العقارات وحالتها الحالية."
        icon={Bookmark}
        stats={[{ value: "5", label: "إجمالي السجلات" }]}
      />

      <div className="flex items-center justify-end gap-1.5 text-[12.5px] text-muted-foreground">
        <span className="font-semibold text-primary">الحجوزات</span>
        <span>‹</span>
        <span>القائمة</span>
      </div>

      <Pills
        items={[
          { key: "active", label: "النشطة", icon: Lock },
          { key: "soon", label: "تنتهي خلال 24 ساعة", icon: Clock },
          { key: "expired", label: "المنتهية", count: 5, icon: CircleX },
          { key: "all", label: "الكل", count: 5, icon: Bookmark },
        ]}
      />

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="ابحث باسم العقار أو ا"
              className="h-10 w-[220px] rounded-lg border border-border bg-card pe-9 ps-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary/40"
            />
          </div>
          <button
            type="button"
            className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground"
          >
            <Filter className="size-4 text-primary" />
            تصفية الموظف
            <span className="absolute -top-2 end-1 rounded-full bg-destructive/10 px-1 text-[10px] font-bold text-destructive">
              0
            </span>
          </button>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
            aria-label="الأعمدة"
          >
            <Columns3 className="size-[18px]" />
          </button>
        </div>

        <div className="grid place-items-center gap-3 px-6 py-20 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Bookmark className="size-5" />
          </span>
          <h2 className="text-base font-bold text-foreground">لا توجد حجوزات</h2>
          <p className="text-[12.5px] text-muted-foreground">لم يقم أي موظف بحجز عقار بعد.</p>
        </div>
      </div>
    </>
  );
}
