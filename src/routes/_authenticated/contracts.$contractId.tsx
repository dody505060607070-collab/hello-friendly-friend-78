import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { GhostButton, Modal, PrimaryButton } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";
import { deleteContractWithOwner } from "@/lib/delete-helpers";

export const Route = createFileRoute("/_authenticated/contracts/$contractId")({
  component: ContractViewPage,
});

const money = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("ar-SA")} ر.س`;

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  active: "ساري",
  expired: "منتهٍ",
  terminated: "ملغي",
  renewed: "مجدد",
  pending: "قيد الانتظار",
  partial: "مدفوع جزئيًا",
  paid: "مدفوع",
  overdue: "متأخر",
  cancelled: "ملغي",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13.5px] font-semibold text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border bg-accent/40 px-5 py-3">
        <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ContractViewPage() {
  const { contractId } = Route.useParams();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alsoOwner, setAlsoOwner] = useState(false);



  const contract = useQuery({
    queryKey: ["contract-view", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "*, owner:contacts!contracts_owner_id_fkey(full_name, phone, national_id, email), tenant:contacts!contracts_tenant_id_fkey(full_name, phone, national_id, email), property:properties(code, name, city, district, property_type)",
        )
        .eq("id", contractId)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, any> | null;
    },
  });

  const payments = useQuery({
    queryKey: ["contract-view-payments", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments")
        .select("id, payment_number, due_date, amount_due, amount_paid, status")
        .eq("contract_id", contractId)
        .order("payment_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invoices = useQuery({
    queryKey: ["contract-view-invoices", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, total, status")
        .eq("contract_id", contractId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const c: any = contract.data;

  const remove = useMutation({
    mutationFn: async (alsoOwner: boolean) =>
      deleteContractWithOwner(contractId, (c?.owner_id as string | null) ?? null, alsoOwner),
    onSuccess: () => {
      toast.success("تم حذف العقد");
      navigate({ to: "/contracts" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHero
        title={c?.contract_number ? `العقد ${c.contract_number}` : "تفاصيل العقد"}
        subtitle="عرض كامل لبيانات العقد وأطرافه والعقار والأقساط والفواتير — للاطلاع فقط."
        icon={FileText}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/contracts"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary"
        >
          <ArrowRight className="size-4" />
          رجوع لإدارة العقود
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/contracts"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold hover:bg-muted"
          >
            <Pencil className="size-4" />
            تعديل العقد
          </Link>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground disabled:opacity-60"
          >
            {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            حذف العقد
          </button>

          <Modal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={`حذف العقد ${c?.contract_number ?? ""}`}
            subtitle="لا يمكن التراجع عن هذا الإجراء."
            footer={
              <>
                <PrimaryButton onClick={() => remove.mutate(alsoOwner)} disabled={remove.isPending}>
                  {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  تأكيد الحذف
                </PrimaryButton>
                <GhostButton onClick={() => setConfirmOpen(false)}>إلغاء</GhostButton>
              </>
            }
          >
            <div className="space-y-3 text-[13px]">
              <label className="flex items-center gap-2 font-semibold">
                <Toggle
                  label="حذف المالك أيضًا"
                  checked={alsoOwner}
                  onChange={(v) => setAlsoOwner(v)}
                />
                حذف المالك المرتبط بالعقد أيضًا {c?.owner?.full_name ? `(${c.owner.full_name})` : ""}
              </label>
              <p className="text-[12px] text-muted-foreground">
                عند التفعيل سيتم حذف المالك وكل عقوده الأخرى، مع فصل عقاراته ووحداته.
              </p>
            </div>
          </Modal>
        </div>
      </div>

      {contract.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : !c ? (
        <p className="surface-card p-6 text-center text-[13px] text-muted-foreground">
          العقد غير موجود.
        </p>
      ) : (
        <div className="space-y-5">
          <Section title="بيانات العقد">
            <div className="grid gap-3 sm:grid-cols-3">
              <Row label="رقم العقد" value={c.contract_number} />
              <Row
                label="الحالة"
                value={
                  <Chip tone={c.status === "active" ? "success" : c.status === "draft" ? "warning" : "danger"}>
                    {statusLabels[c.status] ?? c.status}
                  </Chip>
                }
              />
              <Row label="نوع العقد" value={c.contract_type === "sale" ? "بيع" : "إيجار"} />
              <Row label="تاريخ البداية" value={c.start_date} />
              <Row label="تاريخ النهاية" value={c.end_date} />
              <Row label="دورة السداد" value={c.payment_cycle} />
              <Row label="الإيجار السنوي" value={money(c.annual_rent)} />
              <Row label="القيمة الإجمالية" value={money(c.total_value)} />
              <Row label="التأمين" value={money(c.deposit)} />
              <Row label="عدد الدفعات" value={c.payments_count} />
              <Row label="المصدر" value={c.source === "import" ? "استيراد PDF" : "إدخال يدوي"} />
              <Row label="تاريخ الإنشاء" value={c.created_at?.slice(0, 10)} />
            </div>
            {c.notes ? (
              <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-[13px] text-foreground">{c.notes}</p>
            ) : null}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="المالك">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="الاسم" value={c.owner?.full_name} />
                <Row label="رقم الهوية" value={c.owner?.national_id} />
                <Row label="الجوال" value={c.owner?.phone} />
                <Row label="البريد" value={c.owner?.email} />
              </div>
            </Section>
            <Section title="المستأجر / المشتري">
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="الاسم" value={c.tenant?.full_name} />
                <Row label="رقم الهوية" value={c.tenant?.national_id} />
                <Row label="الجوال" value={c.tenant?.phone} />
                <Row label="البريد" value={c.tenant?.email} />
              </div>
            </Section>
          </div>

          <Section title="العقار">
            <div className="grid gap-3 sm:grid-cols-3">
              <Row label="الكود" value={c.property?.code} />
              <Row label="الاسم" value={c.property?.name} />
              <Row label="النوع" value={c.property?.property_type} />
              <Row label="المدينة" value={c.property?.city} />
              <Row label="الحي" value={c.property?.district} />
            </div>
          </Section>

          <Section title={`جدول الأقساط (${payments.data?.length ?? 0})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="bg-secondary/60 text-[12px] text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">#</th>
                    <th className="p-2 text-start">تاريخ الاستحقاق</th>
                    <th className="p-2 text-start">المستحق</th>
                    <th className="p-2 text-start">المدفوع</th>
                    <th className="p-2 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments.data ?? []).map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-2 font-semibold">{p.payment_number}</td>
                      <td className="p-2">{p.due_date}</td>
                      <td className="p-2">{money(p.amount_due)}</td>
                      <td className="p-2">{money(p.amount_paid)}</td>
                      <td className="p-2">
                        <Chip
                          tone={
                            p.status === "paid"
                              ? "success"
                              : p.status === "overdue"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {statusLabels[p.status] ?? p.status}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                  {!payments.data?.length ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        لا توجد أقساط مسجلة على هذا العقد.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`الفواتير (${invoices.data?.length ?? 0})`}>
            <div className="space-y-2">
              {(invoices.data ?? []).map((inv) => (
                <Link
                  key={inv.id}
                  to="/invoices/$invoiceId"
                  params={{ invoiceId: inv.id }}
                  className="flex items-center justify-between rounded-xl border border-border p-3 text-[13px] transition hover:bg-accent/40"
                >
                  <span className="font-semibold text-foreground">{inv.invoice_number}</span>
                  <span className="text-muted-foreground">{inv.issue_date}</span>
                  <span className="font-semibold">{money(inv.total)}</span>
                  <Chip tone={inv.status === "paid" ? "success" : "warning"}>
                    {statusLabels[inv.status] ?? inv.status}
                  </Chip>
                </Link>
              ))}
              {!invoices.data?.length ? (
                <p className="p-3 text-center text-[13px] text-muted-foreground">
                  لا توجد فواتير مرتبطة بهذا العقد.
                </p>
              ) : null}
            </div>
          </Section>
        </div>
      )}
    </>
  );
}
