import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, FileText, Loader2, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { invoiceStatusLabels } from "@/lib/labels";

type Item = { description: string; quantity: string; unit_price: string };

export const Route = createFileRoute("/_authenticated/invoice-form")({
  validateSearch: (search: Record<string, unknown>) => ({ id: typeof search["id"] === "string" ? search["id"] as string : "", ownerId: typeof search["ownerId"] === "string" ? search["ownerId"] as string : "" }),
  head: () => ({ meta: [
    { title: "إنشاء فاتورة | مثراء العقارية" },
    { name: "description", content: "إنشاء فاتورة وإضافة البنود والضريبة والملاحظات." },
    { property: "og:title", content: "إنشاء فاتورة | مثراء العقارية" },
    { property: "og:description", content: "نموذج الفاتورة الكامل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InvoiceFormPage,
});

function InvoiceFormPage() {
  const { id, ownerId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ invoice_number: "", contact_id: ownerId, contract_id: "", issue_date: today, due_date: "", status: "unpaid", vat_rate: "15", notes: "" });
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const set = (patch: Partial<typeof form>) => setForm((previous) => ({ ...previous, ...patch }));
  const options = useQuery({ queryKey: ["invoice-form-options"], queryFn: async () => {
    const [contacts, contracts, settings] = await Promise.all([
      supabase.from("contacts").select("id, full_name").order("full_name").limit(500),
      supabase.from("contracts").select("id, contract_number, owner_id").order("created_at", { ascending: false }).limit(500),
      supabase.from("app_settings").select("vat_rate, company_name, address").eq("id", true).maybeSingle(),
    ]);
    if (contacts.error) throw contacts.error;
    if (contracts.error) throw contracts.error;
    return { contacts: contacts.data ?? [], contracts: contracts.data ?? [], settings: settings.data };
  }});
  const existing = useQuery({ queryKey: ["invoice-edit", id], enabled: Boolean(id), queryFn: async () => {
    const [invoice, invoiceItems] = await Promise.all([supabase.from("invoices").select("*").eq("id", id).single(), supabase.from("invoice_items").select("description, quantity, unit_price").eq("invoice_id", id).order("sort_order")]);
    if (invoice.error) throw invoice.error;
    if (invoiceItems.error) throw invoiceItems.error;
    return { invoice: invoice.data, items: invoiceItems.data ?? [] };
  }});
  useEffect(() => { if (!id && options.data?.settings) set({ vat_rate: String(options.data.settings.vat_rate ?? 15) }); }, [id, options.data?.settings]);
  useEffect(() => { const data = existing.data; if (!data) return; setForm({ invoice_number: data.invoice.invoice_number, contact_id: data.invoice.contact_id ?? "", contract_id: data.invoice.contract_id ?? "", issue_date: data.invoice.issue_date, due_date: data.invoice.due_date ?? "", status: data.invoice.status, vat_rate: data.invoice.subtotal ? String((Number(data.invoice.vat_amount) / Number(data.invoice.subtotal)) * 100) : "0", notes: data.invoice.notes ?? "" }); setItems(data.items.length ? data.items.map((item) => ({ description: item.description, quantity: String(item.quantity), unit_price: String(item.unit_price) })) : [{ description: "", quantity: "1", unit_price: "" }]); }, [existing.data]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0), [items]);
  const vat = subtotal * (Number(form.vat_rate) || 0) / 100;
  const total = subtotal + vat;
  const save = useMutation({ mutationFn: async (addAnother: boolean) => {
    if (!form.contact_id) throw new Error("اختر المالك أو العميل");
    const validItems = items.filter((item) => item.description.trim() && Number(item.quantity) > 0);
    if (!validItems.length) throw new Error("أضف بند فاتورة واحدًا على الأقل");
    const payload = { invoice_number: form.invoice_number.trim() || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`, contact_id: form.contact_id, contract_id: form.contract_id || null, issue_date: form.issue_date, due_date: form.due_date || null, status: form.status, subtotal, vat_amount: vat, total, notes: form.notes.trim() || null };
    let invoiceId = id;
    if (id) { const update = await supabase.from("invoices").update(payload).eq("id", id); if (update.error) throw update.error; const remove = await supabase.from("invoice_items").delete().eq("invoice_id", id); if (remove.error) throw remove.error; }
    else { const insert = await supabase.from("invoices").insert(payload).select("id").single(); if (insert.error) throw insert.error; invoiceId = insert.data.id; }
    const inserted = await supabase.from("invoice_items").insert(validItems.map((item, index) => ({ invoice_id: invoiceId, description: item.description.trim(), quantity: Number(item.quantity), unit_price: Number(item.unit_price), total: Number(item.quantity) * Number(item.unit_price), sort_order: index })));
    if (inserted.error) throw inserted.error;
    return { invoiceId, addAnother };
  }, onSuccess: ({ invoiceId, addAnother }) => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success(id ? "تم تحديث الفاتورة" : "تم إنشاء الفاتورة"); if (addAnother) { setForm({ invoice_number: "", contact_id: ownerId, contract_id: "", issue_date: today, due_date: "", status: "unpaid", vat_rate: form.vat_rate, notes: "" }); setItems([{ description: "", quantity: "1", unit_price: "" }]); } else void navigate({ to: "/invoices/$invoiceId", params: { invoiceId } }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الحفظ") });

  return <>
    <PageHero title={id ? "تعديل الفاتورة" : "الفواتير"} subtitle="إدارة الفواتير وحالات إصدارها وسدادها" icon={ReceiptText} />
    <div className="flex items-center justify-between"><Link to="/invoices" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold"><ArrowRight className="size-4" />رجوع للفواتير</Link><span className="text-[12px] text-muted-foreground">الفواتير / {id ? "تعديل" : "إضافة"}</span></div>
    <Section title="بيانات الفاتورة" icon={ReceiptText}><div className="grid gap-4 sm:grid-cols-2">
      <Field label="المالك / العميل"><select className={inputClass} value={form.contact_id} onChange={(event) => set({ contact_id: event.target.value })}><option value="">اختر</option>{(options.data?.contacts ?? []).map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}</select></Field>
      <Field label="الحالة"><select className={inputClass} value={form.status} onChange={(event) => set({ status: event.target.value })}>{Object.entries(invoiceStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="رقم الفاتورة" hint="يُنشأ تلقائيًا إذا تُرك فارغًا"><input className={inputClass} dir="ltr" value={form.invoice_number} onChange={(event) => set({ invoice_number: event.target.value })} /></Field>
      <Field label="العقد المرتبط"><select className={inputClass} value={form.contract_id} onChange={(event) => set({ contract_id: event.target.value })}><option value="">بدون عقد</option>{(options.data?.contracts ?? []).filter((contract) => !form.contact_id || contract.owner_id === form.contact_id).map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_number}</option>)}</select></Field>
      <Field label="تاريخ الفاتورة"><input type="date" className={inputClass} value={form.issue_date} onChange={(event) => set({ issue_date: event.target.value })} /></Field>
      <Field label="تاريخ الاستحقاق"><input type="date" className={inputClass} value={form.due_date} onChange={(event) => set({ due_date: event.target.value })} /></Field>
    </div></Section>
    <Section title="بنود الفاتورة" icon={FileText}><div className="space-y-3">{items.map((item, index) => <div key={index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_110px_150px_44px]"><Field label="الصنف / نوع العمل"><input className={inputClass} value={item.description} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} /></Field><Field label="العدد"><input className={inputClass} dir="ltr" inputMode="decimal" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></Field><Field label="سعر الوحدة"><input className={inputClass} dir="ltr" inputMode="decimal" value={item.unit_price} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unit_price: event.target.value } : row))} /></Field><button type="button" onClick={() => setItems((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index))} className="mt-6 grid size-10 place-items-center rounded-lg text-destructive hover:bg-destructive/10" aria-label="حذف البند"><Trash2 className="size-4" /></button></div>)}<button type="button" onClick={() => setItems((current) => [...current, { description: "", quantity: "1", unit_price: "" }])} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12.5px] font-semibold"><Plus className="size-4" />إضافة بند</button></div></Section>
    <Section title="الضريبة والإجماليات" icon={ReceiptText}><div className="grid gap-4 sm:grid-cols-4"><Field label="نسبة الضريبة %"><input className={inputClass} dir="ltr" inputMode="decimal" value={form.vat_rate} onChange={(event) => set({ vat_rate: event.target.value })} /></Field><Total label="قبل الضريبة" value={subtotal} /><Total label="الضريبة" value={vat} /><Total label="الإجمالي" value={total} strong /></div></Section>
    <Section title="ملاحظات وشروط" icon={FileText}><Field label="ملاحظات الفاتورة"><textarea className={textareaClass} value={form.notes} onChange={(event) => set({ notes: event.target.value })} placeholder="تفاصيل السداد أو أي شروط تظهر في سجل الفاتورة." /></Field></Section>
    <div className="flex flex-wrap justify-center gap-3 pb-4"><button type="button" onClick={() => save.mutate(false)} disabled={save.isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-[13px] font-bold text-primary-foreground disabled:opacity-50">{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{id ? "حفظ التعديلات" : "إضافة"}</button>{!id ? <button type="button" onClick={() => save.mutate(true)} disabled={save.isPending} className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 text-[13px] font-semibold">إضافة وبدء فاتورة جديدة</button> : null}<Link to="/invoices" className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 text-[13px] font-semibold">إلغاء</Link></div>
  </>;
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof ReceiptText; children: ReactNode }) { return <section className="surface-card overflow-hidden"><header className="flex items-center gap-2 border-b border-border px-5 py-4"><Icon className="size-4 text-primary" /><h2 className="text-[14px] font-bold">{title}</h2></header><div className="p-5">{children}</div></section>; }
function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className="rounded-lg border border-border p-3"><p className="text-[11.5px] text-muted-foreground">{label}</p><p className={strong ? "mt-2 text-lg font-bold text-primary" : "mt-2 font-semibold"}>{new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س</p></div>; }