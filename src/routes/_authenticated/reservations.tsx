import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, CalendarPlus, CheckCircle2, Eye, Plus, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import { GhostButton, Modal, PrimaryButton } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { ToneLegend } from "@/components/kit/ToneLegend";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { reservationStatusLabels } from "@/lib/labels";
import { reservationRowTone, rowToneClass } from "@/lib/row-tone";

type Row = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  extended_count: number | null;
  notes: string | null;
  created_at: string | null;
  properties: { name: string; code: string | null } | null;
  employee: { full_name: string } | null;
  contact: { full_name: string; phone: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/reservations")({
  head: () => ({
    meta: [
      { title: "إدارة الحجوزات | مثراء العقارية" },
      { name: "description", content: "حجوزات الموظفين للعقارات مع مدة الحجز والتمديد والإلغاء." },
      { property: "og:title", content: "إدارة الحجوزات | مثراء العقارية" },
      { property: "og:description", content: "حجوزات الموظفين للعقارات ومدة الحجز والتمديد والإلغاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationsPage,
});

function NewReservationForm() {
  const navigate = useNavigate();
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <Button type="button" size="sm" onClick={() => navigate({ to: "/reserve" })}>
        <Plus className="size-4" />
        حجز جديد
      </Button>
      <p className="text-right text-[12px] text-muted-foreground">
        ينقلك لتصفّح العقارات كما يراها الزوار — اضغط على أي عقار لحجزه فورًا. علامة «محجوز» تظهر للموظفين فقط.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ReservationsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);

  const reservations = useTableRows<Row>({
    table: "reservations",
    select:
      "id, status, starts_at, ends_at, extended_count, notes, created_at, properties:property_id(name, code), employee:employee_id(full_name), contact:contact_id(full_name, phone)",
    orderBy: { column: "created_at" },
    queryKey: ["reservations"],
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
    queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
  };

  const cancel = useMutation({
    mutationFn: async (row: Row) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: auth.user?.id ?? null,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setSelected(null);
      toast.success("تم إلغاء الحجز");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الإلغاء"),
  });

  const extend = useMutation({
    mutationFn: async (row: Row) => {
      const ends = new Date(row.ends_at);
      const base = ends.getTime() > Date.now() ? ends : new Date();
      base.setDate(base.getDate() + 1);
      const { error } = await supabase
        .from("reservations")
        .update({ ends_at: base.toISOString(), extended_count: (row.extended_count ?? 0) + 1, status: "active" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("تم تمديد الحجز 24 ساعة");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التمديد"),
  });

  const convert = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase.from("reservations").update({ status: "converted" }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setSelected(null);
      toast.success("تم اعتماد الحجز وتحويله لعقد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التحويل"),
  });

  const rows = reservations.data ?? [];
  const closed = (s: string) => s === "cancelled" || s === "converted" || s === "expired";

  return (
    <>
      <PageHero
        title="إدارة الحجوزات"
        subtitle="الحجوزات النشطة والمؤقتة، ولا يُسمح بحجزين متعارضين على نفس العقار."
        icon={CalendarClock}
      />

      <NewReservationForm />

      <ToneLegend
        tones={["overdue", "today", "urgent", "progress", "new", "done"]}
        labels={{
          overdue: "منتهية / ملغاة",
          today: "تنتهي اليوم",
          urgent: "تنتهي خلال يومين",
          progress: "معلّقة",
          new: "نشطة",
          done: "تم تحويلها",
        }}
      />

      <DataTable<Row>
        rows={rows}
        rowClassName={(r) => rowToneClass[reservationRowTone(r)]}
        onRowClick={(r) => setSelected(r)}
        searchPlaceholder="بحث بالعقار أو الموظف"
        exportFileName="الحجوزات"
        emptyState={
          <EmptyState
            text="لا توجد حجوزات"
            hint="عند حجز موظف لعقار سيظهر الحجز هنا مع مدة الصلاحية."
          />
        }
        columns={[
          { header: "العقار", cell: (r) => r.properties?.name ?? "—", className: "font-semibold" },
          { header: "الكود", cell: (r) => r.properties?.code ?? "—" },
          { header: "الموظف", cell: (r) => r.employee?.full_name ?? "—" },
          { header: "العميل", cell: (r) => r.contact?.full_name ?? "—" },
          { header: "من", sortable: true, value: (r) => r.starts_at, cell: (r) => formatDate(r.starts_at) },
          { header: "إلى", sortable: true, value: (r) => r.ends_at, cell: (r) => formatDate(r.ends_at) },
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
          {
            header: "إجراءات",
            cell: (r) => (
              <span className="inline-flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(r);
                  }}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                >
                  <Eye className="size-4" />
                  التفاصيل
                </button>
                {!closed(r.status) ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancel.mutate(r);
                    }}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                  >
                    <XCircle className="size-4" />
                    إلغاء
                  </button>
                ) : null}
              </span>
            ),
          },
        ]}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="تفاصيل الحجز"
        subtitle={selected?.properties?.name ?? undefined}
        footer={
          selected && !closed(selected.status) ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <GhostButton onClick={() => extend.mutate(selected)} disabled={extend.isPending}>
                <CalendarPlus className="size-4" />
                تمديد 24 ساعة
              </GhostButton>
              <GhostButton onClick={() => cancel.mutate(selected)} disabled={cancel.isPending}>
                <XCircle className="size-4" />
                إلغاء الحجز
              </GhostButton>
              <PrimaryButton onClick={() => convert.mutate(selected)} disabled={convert.isPending}>
                <CheckCircle2 className="size-4" />
                اعتماد وتحويل لعقد
              </PrimaryButton>
            </div>
          ) : (
            <div className="flex justify-end">
              <GhostButton onClick={() => setSelected(null)}>إغلاق</GhostButton>
            </div>
          )
        }
      >
        {selected ? (
          <div className="space-y-1">
            <div className={`mb-3 rounded-xl px-4 py-3 text-[13px] font-semibold ${rowToneClass[reservationRowTone(selected)]}`}>
              {reservationStatusLabels[selected.status] ?? selected.status}
            </div>
            <DetailRow label="العقار" value={selected.properties?.name ?? "—"} />
            <DetailRow label="كود العقار" value={selected.properties?.code ?? "—"} />
            <DetailRow label="الموظف" value={selected.employee?.full_name ?? "—"} />
            <DetailRow label="العميل" value={selected.contact?.full_name ?? "—"} />
            <DetailRow label="جوال العميل" value={selected.contact?.phone ?? "—"} />
            <DetailRow label="بداية الحجز" value={formatDate(selected.starts_at)} />
            <DetailRow label="نهاية الحجز" value={formatDate(selected.ends_at)} />
            <DetailRow label="مرات التمديد" value={String(selected.extended_count ?? 0)} />
            <DetailRow label="تاريخ الإنشاء" value={formatDate(selected.created_at)} />
            <DetailRow label="ملاحظات" value={selected.notes?.trim() || "—"} />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
