import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { LiveTable, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { reservationStatusLabels } from "@/lib/labels";

type Row = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  extended_count: number | null;
  notes: string | null;
  properties: { name: string; code: string | null } | null;
  employee: { full_name: string } | null;
  contact: { full_name: string } | null;
};

export const Route = createFileRoute("/_authenticated/reservations")({
  head: () => ({
    meta: [
      { title: "إدارة الحجوزات | مثراء العقارية" },
      { name: "description", content: "حجوزات الموظفين للعقارات مع مدة الحجز والتمديد والانتهاء." },
      { property: "og:title", content: "إدارة الحجوزات | مثراء العقارية" },
      { property: "og:description", content: "حجوزات الموظفين للعقارات ومدة الحجز والتمديد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationsPage,
});

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-right text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function NewReservationForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    contact_id: "",
    starts_at: "",
    ends_at: "",
    notes: "",
  });

  const options = useQuery({
    queryKey: ["reservation-form-options"],
    queryFn: async () => {
      const [props, contacts] = await Promise.all([
        supabase.from("properties").select("id, name, code").order("created_at", { ascending: false }),
        supabase.from("contacts").select("id, full_name").eq("is_active", true).order("full_name"),
      ]);
      return { properties: props.data ?? [], contacts: contacts.data ?? [] };
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.starts_at || !form.ends_at) {
      toast.error("اختر العقار وحدد وقت البداية والنهاية");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const { error } = await supabase.from("reservations").insert({
        property_id: form.property_id,
        contact_id: form.contact_id || null,
        employee_id: uid,
        created_by: uid,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        notes: form.notes || null,
        status: "active",
      });
      if (error) throw error;
      toast.success("تم إنشاء الحجز بنجاح");
      setForm({ property_id: "", contact_id: "", starts_at: "", ends_at: "", notes: "" });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الحجز");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" onClick={() => setOpen((v) => !v)} size="sm">
          <Plus className="size-4" />
          {open ? "إغلاق" : "حجز جديد"}
        </Button>
        <p className="text-right text-[12px] text-muted-foreground">
          أي موظف نشط يمكنه إنشاء حجز على أي عقار متاح.
        </p>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            className={inputClass}
            value={form.property_id}
            onChange={(e) => setForm({ ...form, property_id: e.target.value })}
          >
            <option value="">اختر العقار *</option>
            {options.data?.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.code ? ` — ${p.code}` : ""}
              </option>
            ))}
          </select>

          <select
            className={inputClass}
            value={form.contact_id}
            onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
          >
            <option value="">العميل (اختياري)</option>
            {options.data?.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>

          <label className="space-y-1">
            <span className="block text-right text-[12px] font-bold">من</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-right text-[12px] font-bold">إلى</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </label>

          <textarea
            rows={2}
            className={`${inputClass} h-auto py-2 sm:col-span-2`}
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "جارٍ الحفظ..." : "حفظ الحجز"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ReservationsPage() {
  return (
    <>
      <PageHero
        title="إدارة الحجوزات"
        subtitle="الحجوزات النشطة والمؤقتة، ولا يُسمح بحجزين متعارضين على نفس العقار."
        icon={CalendarClock}
      />

      <NewReservationForm />

      <LiveTable<Row>
        table="reservations"
        select="id, status, starts_at, ends_at, extended_count, notes, properties:property_id(name, code), employee:employee_id(full_name), contact:contact_id(full_name)"
        orderBy={{ column: "created_at" }}
        searchPlaceholder="بحث بالعقار أو الموظف"
        emptyText="لا توجد حجوزات"
        emptyHint="عند حجز موظف لعقار سيظهر الحجز هنا مع مدة الصلاحية."
        columns={[
          {
            header: "العقار",
            cell: (r) => r.properties?.name ?? "—",
            className: "font-semibold",
          },
          { header: "الكود", cell: (r) => r.properties?.code ?? "—" },
          { header: "الموظف", cell: (r) => r.employee?.full_name ?? "—" },
          { header: "العميل", cell: (r) => r.contact?.full_name ?? "—" },
          { header: "من", cell: (r) => formatDate(r.starts_at) },
          { header: "إلى", cell: (r) => formatDate(r.ends_at) },
          { header: "مرات التمديد", cell: (r) => r.extended_count ?? 0 },
          {
            header: "الحالة",
            cell: (r) => (
              <Chip
                tone={
                  r.status === "active"
                    ? "success"
                    : r.status === "hold"
                      ? "warning"
                      : r.status === "cancelled"
                        ? "danger"
                        : "neutral"
                }
              >
                {reservationStatusLabels[r.status] ?? r.status}
              </Chip>
            ),
          },
        ]}
      />
    </>
  );
}
