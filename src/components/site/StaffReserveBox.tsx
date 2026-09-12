import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Props = { propertyId: string; propertyName: string };

const DURATIONS = [
  { hours: 24, label: "24 ساعة" },
  { hours: 48, label: "48 ساعة" },
  { hours: 72, label: "3 أيام" },
  { hours: 168, label: "أسبوع" },
];

/**
 * صندوق حجز يظهر للموظفين والمدير العام فقط داخل صفحة العقار.
 * العملاء لا يرون أي إشارة إلى حالة الحجز.
 */
export function StaffReserveBox({ propertyId, propertyName }: Props) {
  const { userId, profile, isSuperAdmin, loading } = useCurrentUser();
  const isStaff = Boolean(userId && (isSuperAdmin || (profile && profile.is_active)));
  const qc = useQueryClient();
  const [hours, setHours] = useState(24);
  const [contactId, setContactId] = useState("");
  const [notes, setNotes] = useState("");

  const current = useQuery({
    queryKey: ["property-reservation", propertyId],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, status, starts_at, ends_at, notes, employee:employee_id(full_name), contact:contact_id(full_name)")
        .eq("property_id", propertyId)
        .in("status", ["active", "hold"])
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as
        | {
            id: string;
            status: string;
            starts_at: string;
            ends_at: string;
            notes: string | null;
            employee: { full_name: string } | null;
            contact: { full_name: string } | null;
          }
        | null;
    },
  });

  const contacts = useQuery({
    queryKey: ["contacts-mini-public"],
    enabled: isStaff,
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

  const reserve = useMutation({
    mutationFn: async () => {
      const starts = new Date();
      const ends = new Date(starts.getTime() + hours * 3600 * 1000);
      const { error } = await supabase.from("reservations").insert({
        property_id: propertyId,
        contact_id: contactId || null,
        employee_id: userId ?? null,
        created_by: userId ?? null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: notes || `حجز مباشر من صفحة العقار: ${propertyName}`,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حجز العقار وسيظهر في إدارة الحجوزات");
      setNotes("");
      setContactId("");
      void qc.invalidateQueries({ queryKey: ["property-reservation", propertyId] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("overlap") || e.message.includes("conflict")
          ? "يوجد حجز نشط على هذا العقار بالفعل"
          : e.message,
      ),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled", cancelled_by: userId ?? null, cancelled_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إلغاء الحجز");
      void qc.invalidateQueries({ queryKey: ["property-reservation", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !isStaff) return null;

  const active = current.data;
  const fmt = (v: string) =>
    new Date(v).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1 text-[11px] font-bold text-primary">
          <Lock className="size-3" /> للموظفين فقط
        </span>
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
          حجز العقار
          <CalendarClock className="size-4 text-primary" />
        </h3>
      </div>

      {current.isLoading ? (
        <div className="mt-4 grid h-16 place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : active ? (
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-card p-4 text-right">
          <p className="text-[13.5px] font-bold text-primary">هذا العقار محجوز حالياً</p>
          <p className="text-[12.5px] text-muted-foreground">
            الموظف: {active.employee?.full_name ?? "—"}
            {active.contact?.full_name ? ` • العميل: ${active.contact.full_name}` : ""}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            من {fmt(active.starts_at)} إلى {fmt(active.ends_at)}
          </p>
          {active.notes ? (
            <p className="text-[12px] text-muted-foreground">ملاحظات: {active.notes}</p>
          ) : null}
          <button
            type="button"
            onClick={() => cancel.mutate(active.id)}
            disabled={cancel.isPending}
            className="pressable mt-1 h-9 w-full rounded-lg border border-destructive/40 text-[12.5px] font-bold text-destructive disabled:opacity-60"
          >
            {cancel.isPending ? "جارٍ الإلغاء..." : "إلغاء الحجز"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-right">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-right text-[13px]"
          >
            {DURATIONS.map((d) => (
              <option key={d.hours} value={d.hours}>
                مدة الحجز: {d.label}
              </option>
            ))}
          </select>

          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-right text-[13px]"
          >
            <option value="">العميل (اختياري)</option>
            {(contacts.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>

          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات الحجز (اختياري)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-right text-[13px]"
          />

          <button
            type="button"
            onClick={() => reserve.mutate()}
            disabled={reserve.isPending}
            className="pressable h-10 w-full rounded-lg bg-primary text-[13px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {reserve.isPending ? "جارٍ الحجز..." : "حجز هذا العقار"}
          </button>
        </div>
      )}
    </div>
  );
}
