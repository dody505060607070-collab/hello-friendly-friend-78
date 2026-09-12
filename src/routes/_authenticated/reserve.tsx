import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, CalendarClock, Loader2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reserve")({
  head: () => ({
    meta: [
      { title: "حجز عقار جديد | مثراء العقارية" },
      { name: "description", content: "تصفّح العقارات واحجز أي عقار بضغطة واحدة — للموظفين فقط." },
      { property: "og:title", content: "حجز عقار جديد | مثراء العقارية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReserveBrowsePage,
});

type PropertyRow = {
  id: string;
  code: string | null;
  name: string;
  purpose: string | null;
  property_type: string | null;
  city: string | null;
  district: string | null;
  price_text: string | null;
  status: string | null;
  property_images: { url: string; is_cover: boolean }[] | null;
};

const DURATIONS = [
  { hours: 24, label: "24 ساعة" },
  { hours: 48, label: "48 ساعة" },
  { hours: 72, label: "3 أيام" },
  { hours: 168, label: "أسبوع" },
];

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-right text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function ReserveBrowsePage() {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"sale" | "rent">("sale");
  const [selected, setSelected] = useState<PropertyRow | null>(null);
  const [hours, setHours] = useState(24);
  const [contactId, setContactId] = useState("");
  const [notes, setNotes] = useState("");

  const properties = useQuery({
    queryKey: ["reserve-browse", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, code, name, purpose, property_type, city, district, price_text, status, property_images(url, is_cover)",
        )
        .eq("is_visible", true)
        .eq("purpose", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PropertyRow[];
    },
  });

  const reservations = useQuery({
    queryKey: ["reserve-browse-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("property_id, ends_at")
        .in("status", ["active", "hold"])
        .gt("ends_at", new Date().toISOString());
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.property_id).filter(Boolean) as string[]);
    },
  });

  const contacts = useQuery({
    queryKey: ["contacts-mini-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name")
        .limit(500);
      return data ?? [];
    },
  });

  const confirm = useMutation({
    mutationFn: async (property: PropertyRow) => {
      const starts = new Date();
      const ends = new Date(starts.getTime() + hours * 3600 * 1000);
      const { error } = await supabase.from("reservations").insert({
        property_id: property.id,
        contact_id: contactId || null,
        employee_id: userId ?? null,
        created_by: userId ?? null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: notes || `حجز مباشر: ${property.name}`,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحجز — سيظهر في إدارة الحجوزات");
      void qc.invalidateQueries({ queryKey: ["reserve-browse-active"] });
      navigate({ to: "/reservations" });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("overlap") || e.message.includes("conflict") || e.message.includes("RESERVATION_CONFLICT")
          ? "يوجد حجز نشط على هذا العقار بالفعل"
          : e.message,
      ),
  });

  const list = useMemo(() => properties.data ?? [], [properties.data]);

  const cover = (p: PropertyRow) => {
    const imgs = p.property_images ?? [];
    return (imgs.find((i) => i.is_cover) ?? imgs[0])?.url ?? null;
  };

  return (
    <>
      <PageHero
        title="حجز عقار جديد"
        subtitle="تصفّح العقارات كما يراها الزوار، واضغط على أي عقار لحجزه — علامة «محجوز» تظهر للموظفين فقط."
        icon={CalendarClock}
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate({ to: "/reservations" })}>
          <ArrowRight className="size-4" />
          رجوع لإدارة الحجوزات
        </Button>

        <div className="flex rounded-xl border border-border bg-card p-1">
          {(
            [
              { key: "sale", label: "بيع" },
              { key: "rent", label: "إيجار" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`pressable h-9 rounded-lg px-6 text-[13px] font-bold transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {properties.isLoading ? (
        <div className="grid h-48 place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="grid h-48 place-items-center rounded-xl border border-dashed border-border text-[13px] text-muted-foreground">
          لا توجد عقارات {tab === "sale" ? "للبيع" : "للإيجار"} حاليًا
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const reserved = reservations.data?.has(p.id) ?? false;
            const img = cover(p);
            return (
              <button
                key={p.id}
                type="button"
                disabled={reserved || confirm.isPending}
                onClick={() => {
                  setSelected(p);
                  setNotes("");
                  setContactId("");
                }}
                className="pressable group relative overflow-hidden rounded-2xl border border-border bg-card text-right shadow-card transition hover:border-primary/40 hover:shadow-lg disabled:cursor-not-allowed"
              >
                <div className="relative h-44 w-full overflow-hidden bg-muted">
                  {img ? (
                    <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <MapPin className="size-8" />
                    </div>
                  )}

                  {reserved ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[1px]">
                      <span className="flex -rotate-6 items-center gap-2 rounded-xl border-4 border-amber-400 bg-amber-400/95 px-6 py-2 text-2xl font-black tracking-wide text-amber-950 shadow-2xl">
                        <BadgeCheck className="size-6" />
                        محجوز
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground">{p.code ?? ""}</span>
                    <h3 className="line-clamp-1 text-[14px] font-bold text-foreground">{p.name}</h3>
                  </div>
                  <p className="line-clamp-1 text-[12px] text-muted-foreground">
                    {[p.property_type, p.district, p.city].filter(Boolean).join(" • ") || "—"}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[13px] font-black text-primary">{p.price_text ?? "—"}</span>
                    {!reserved ? (
                      <span className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">اضغط للحجز</span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-right text-[16px] font-black text-foreground">تأكيد حجز «{selected.name}»</h3>

            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass}>
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>
                  مدة الحجز: {d.label}
                </option>
              ))}
            </select>

            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClass}>
              <option value="">العميل (اختياري)</option>
              {contacts.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
              className={`${inputClass} h-auto py-2`}
            />

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                className="flex-1"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate(selected)}
              >
                {confirm.isPending ? "جارٍ الحجز..." : "تأكيد الحجز"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
