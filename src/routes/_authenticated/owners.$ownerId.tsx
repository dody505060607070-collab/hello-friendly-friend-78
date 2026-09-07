import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Building2,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { askAdminAi } from "@/lib/ai.functions";
import { exportWorkbook, type ExportRow } from "@/lib/export";
import { contractStatusLabels, invoiceStatusLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/owners/$ownerId")({
  head: () => ({
    meta: [
      { title: "ملف المالك | مثراء العقارية" },
      { name: "description", content: "ملف المالك وعقاراته ووحداته وعقوده وفواتيره." },
      { property: "og:title", content: "ملف المالك | مثراء العقارية" },
      { property: "og:description", content: "تفاصيل المالك المالية والعقارية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerDetailPage,
});

function OwnerDetailPage() {
  const { ownerId } = Route.useParams();
  const dossier = useQuery({
    queryKey: ["owner-dossier", ownerId],
    queryFn: async () => {
      const [owner, properties, units, contracts, invoices] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", ownerId).single(),
        supabase.from("properties").select("id, code, name, purpose, property_type, city, district, price_value, status, is_visible").eq("owner_id", ownerId).order("created_at", { ascending: false }),
        supabase.from("units").select("id, unit_number, unit_type, floor, area, rooms, status, is_rentable").eq("owner_id", ownerId).order("created_at", { ascending: false }),
        supabase.from("contracts").select("id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, deposit, status, property:property_id(name), unit:unit_id(unit_number)").eq("owner_id", ownerId).order("created_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number, issue_date, due_date, subtotal, vat_amount, total, status").eq("contact_id", ownerId).order("created_at", { ascending: false }),
      ]);
      if (owner.error) throw owner.error;
      if (properties.error) throw properties.error;
      if (units.error) throw units.error;
      if (contracts.error) throw contracts.error;
      if (invoices.error) throw invoices.error;
      return { owner: owner.data, properties: properties.data ?? [], units: units.data ?? [], contracts: contracts.data ?? [], invoices: invoices.data ?? [] };
    },
  });

  const data = dossier.data;
  const activeContracts = data?.contracts.filter((contract) => contract.status === "active") ?? [];
  const unpaidInvoices = data?.invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled") ?? [];
  const outstanding = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);

  const exportOwner = async (aiSummary?: string) => {
    if (!data) return;
    const ownerRows: ExportRow[] = [
      {
        "الاسم الكامل": data.owner.full_name,
        "الصفة": "مالك",
        "رقم الهوية / السجل": data.owner.national_id,
        "الجوال": data.owner.phone,
        "واتساب": data.owner.whatsapp,
        "البريد": data.owner.email,
        "العنوان": data.owner.address,
        "الحالة": data.owner.is_active ? "نشط" : "موقوف",
        "الملاحظات": data.owner.notes,
      },
    ];
    const sheets = [
      { name: "بيانات المالك", rows: ownerRows },
      { name: "العقارات", rows: data.properties.map((row) => ({ الكود: row.code, العقار: row.name, الغرض: row.purpose === "sale" ? "بيع" : "إيجار", النوع: row.property_type, المدينة: row.city, الحي: row.district, السعر: row.price_value, الحالة: row.status, "ظاهر بالموقع": row.is_visible ? "نعم" : "لا" })) },
      { name: "الوحدات", rows: data.units.map((row) => ({ "رقم الوحدة": row.unit_number, النوع: row.unit_type, الدور: row.floor, المساحة: row.area, الغرف: row.rooms, الحالة: row.status, "قابلة للإيجار": row.is_rentable ? "نعم" : "لا" })) },
      { name: "العقود", rows: data.contracts.map((row) => ({ "رقم العقد": row.contract_number, النوع: row.contract_type === "sale" ? "بيع" : "إيجار", العقار: row.property?.name, الوحدة: row.unit?.unit_number, البداية: row.start_date, النهاية: row.end_date, "الإيجار السنوي": row.annual_rent, "القيمة الإجمالية": row.total_value, التأمين: row.deposit, الحالة: contractStatusLabels[row.status] ?? row.status })) },
      { name: "الفواتير", rows: data.invoices.map((row) => ({ "رقم الفاتورة": row.invoice_number, الإصدار: row.issue_date, الاستحقاق: row.due_date, "قبل الضريبة": row.subtotal, الضريبة: row.vat_amount, الإجمالي: row.total, الحالة: invoiceStatusLabels[row.status] ?? row.status })) },
    ];
    if (aiSummary) sheets.push({ name: "ملخص المساعد الذكي", rows: [{ "الملخص": aiSummary }] });
    await exportWorkbook(`ملف المالك - ${data.owner.full_name}`, sheets);
  };

  const aiExport = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("لم تكتمل البيانات بعد");
      const context = JSON.stringify({ owner: data.owner, properties: data.properties, units: data.units, contracts: data.contracts, invoices: data.invoices });
      const response = await askAdminAi({ data: { context, messages: [{ role: "user", content: "أنشئ ملخصًا تنفيذيًا دقيقًا لملف هذا المالك: وضعه العقاري، العقود النشطة، الالتزامات والفواتير، وأهم إجراء مقترح. لا تخترع أي معلومة." }] } });
      await exportOwner(response.text);
    },
    onSuccess: () => toast.success("تم إعداد ملف المالك الذكي وتنزيله"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر إعداد الملف"),
  });

  if (dossier.isLoading) return <div className="surface-card grid place-items-center py-24"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!data) return <div className="surface-card p-10 text-center text-destructive">تعذّر تحميل ملف المالك</div>;

  const phone = data.owner.phone?.replace(/\D/g, "") ?? "";
  const whatsapp = (data.owner.whatsapp || data.owner.phone)?.replace(/\D/g, "") ?? "";

  return (
    <>
      <PageHero title="الملاك" subtitle="إدارة بيانات الملاك وعقاراتهم وعقودهم الإيجارية" icon={UserRound} stats={[
        { value: String(data.properties.length), label: "عقار" },
        { value: String(activeContracts.length), label: "عقد نشط" },
        { value: formatCurrency(outstanding), label: "قيمة مستحقة" },
        { value: String(data.invoices.length), label: "إجمالي الفواتير" },
      ]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/owners" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold hover:bg-muted"><ArrowRight className="size-4" />رجوع للملاك</Link>
        <div className="flex flex-wrap gap-2">
          <Link to="/invoice-form" search={{ id: "", ownerId }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"><ReceiptText className="size-4" />إنشاء فاتورة</Link>
          <button type="button" onClick={() => void exportOwner()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold hover:bg-muted"><Download className="size-4" />Excel</button>
          <button type="button" disabled={aiExport.isPending} onClick={() => aiExport.mutate()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-accent px-4 text-[13px] font-semibold text-primary disabled:opacity-50">{aiExport.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}ملف ذكي</button>
        </div>
      </div>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">{data.owner.full_name.slice(0, 1)}</div><div><div className="flex items-center gap-2"><h2 className="text-[17px] font-bold">{data.owner.full_name}</h2><Chip tone="gold">مالك</Chip><Chip tone={data.owner.is_active ? "success" : "neutral"}>{data.owner.is_active ? "نشط" : "موقوف"}</Chip></div><p className="mt-1 text-[12px] text-muted-foreground">رقم الهوية / السجل: <span dir="ltr">{data.owner.national_id ?? "غير مسجل"}</span></p></div></div>
          <div className="flex gap-2">{phone ? <a href={`tel:+${phone}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12px] font-semibold"><Phone className="size-4" />اتصال</a> : null}{whatsapp ? <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-success/30 px-3 text-[12px] font-semibold text-success"><MessageCircle className="size-4" />واتساب</a> : null}</div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Info icon={Phone} label="الجوال" value={data.owner.phone} ltr />
          <Info icon={Mail} label="البريد الإلكتروني" value={data.owner.email} ltr />
          <Info icon={MapPin} label="العنوان" value={data.owner.address} />
          <Info icon={FileText} label="ملاحظات" value={data.owner.notes} />
        </div>
      </section>

      <RecordSection title="العقارات والوحدات" icon={Building2} count={data.properties.length + data.units.length}>
        <div className="grid gap-3 md:grid-cols-2">
          {data.properties.map((property) => <article key={property.id} className="rounded-lg border border-border p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">{property.name}</h3><p className="mt-1 text-[12px] text-muted-foreground">{property.code} · {property.city ?? "—"}، {property.district ?? "—"}</p></div><Chip tone={property.status === "available" ? "success" : "warning"}>{property.status}</Chip></div><p className="mt-3 font-bold text-primary">{formatCurrency(property.price_value)}</p></article>)}
          {data.units.map((unit) => <article key={unit.id} className="rounded-lg border border-border p-4"><h3 className="font-bold">وحدة {unit.unit_number}</h3><p className="mt-1 text-[12px] text-muted-foreground">{unit.unit_type ?? "—"} · الدور {unit.floor ?? "—"} · {unit.area ?? "—"} م²</p><Chip className="mt-3" tone={unit.status === "available" ? "success" : "neutral"}>{unit.status}</Chip></article>)}
          {!data.properties.length && !data.units.length ? <Empty text="لا توجد عقارات أو وحدات مرتبطة" /> : null}
        </div>
      </RecordSection>

      <RecordSection title="العقود" icon={FileText} count={data.contracts.length}>
        <div className="space-y-2">{data.contracts.map((contract) => <div key={contract.id} className="grid items-center gap-3 rounded-lg border border-border p-3 sm:grid-cols-5"><strong>{contract.contract_number}</strong><span>{contract.property?.name ?? contract.unit?.unit_number ?? "—"}</span><span>{formatDate(contract.start_date)} — {formatDate(contract.end_date)}</span><span className="font-semibold">{formatCurrency(contract.annual_rent ?? contract.total_value)}</span><Chip tone={contract.status === "active" ? "success" : "neutral"}>{contractStatusLabels[contract.status] ?? contract.status}</Chip></div>)}{!data.contracts.length ? <Empty text="لا توجد عقود مرتبطة" /> : null}</div>
      </RecordSection>

      <RecordSection title="الفواتير" icon={ReceiptText} count={data.invoices.length}>
        <div className="space-y-2">{data.invoices.map((invoice) => <Link key={invoice.id} to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }} className="grid items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted sm:grid-cols-5"><strong dir="ltr">{invoice.invoice_number}</strong><span>{formatDate(invoice.issue_date)}</span><span>{formatDate(invoice.due_date)}</span><span className="font-semibold">{formatCurrency(invoice.total)}</span><Chip tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : "warning"}>{invoiceStatusLabels[invoice.status] ?? invoice.status}</Chip></Link>)}{!data.invoices.length ? <Empty text="لا توجد فواتير مرتبطة" /> : null}</div>
      </RecordSection>
    </>
  );
}

function Info({ icon: Icon, label, value, ltr }: { icon: typeof Phone; label: string; value: string | null; ltr?: boolean }) {
  return <div className="bg-card p-5"><p className="flex items-center gap-2 text-[11.5px] text-muted-foreground"><Icon className="size-4" />{label}</p><p className="mt-2 text-[13px] font-semibold" dir={ltr ? "ltr" : undefined}>{value || "غير مسجل"}</p></div>;
}

function RecordSection({ title, icon: Icon, count, children }: { title: string; icon: typeof Building2; count: number; children: React.ReactNode }) {
  return <section className="surface-card overflow-hidden"><header className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="flex items-center gap-2 text-[14px] font-bold"><Icon className="size-4 text-primary" />{title}</h2><Chip tone="primary">{count}</Chip></header><div className="p-4">{children}</div></section>;
}

function Empty({ text }: { text: string }) { return <p className="col-span-full py-7 text-center text-[12.5px] text-muted-foreground">{text}</p>; }