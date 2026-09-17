import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  addOwnerDelegate,
  addUnitExpense,
  createOwnerRequest,
  getOwnerOverview,
  recordOwnerDocument,
  recordOwnerPayment,
  removeOwnerDelegate,
} from "@/lib/portal.functions";
import { uploadMedia } from "@/lib/media";

export const Route = createFileRoute("/portal/owner")({
  head: () => ({
    meta: [
      { title: "بوابة المالك | مثراء العقارية" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPortal,
});

const money = (v: number | null | undefined) =>
  `${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (d: string) => Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 86400000);

type OwnerContract = {
  id: string;
  contract_number: string;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  annual_rent: number | null;
  total_value: number | null;
  status: string;
  unit_id: string | null;
  tenant: { id: string; full_name: string; phone: string | null } | null;
};

type OwnerUnit = {
  id: string;
  unit_number: string;
  unit_type: string | null;
  area: number | null;
  rooms: number | null;
  floor: string | null;
  status: string;
  building_id: string | null;
  building: { id: string; name: string; city: string | null; district: string | null } | null;
};

type OwnerPayment = {
  id: string;
  contract_id: string;
  payment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: string;
};

function statusChip(status: string) {
  const map: Record<string, string> = {
    vacant: "bg-amber-100 text-amber-700",
    occupied: "bg-emerald-100 text-emerald-700",
    out_of_service: "bg-red-100 text-red-700",
    maintenance: "bg-red-100 text-red-700",
  };
  const label: Record<string, string> = {
    vacant: "شاغرة",
    occupied: "مؤجّرة",
    out_of_service: "خارج الخدمة",
    maintenance: "صيانة",
  };
  return { cls: map[status] ?? "bg-muted text-muted-foreground", label: label[status] ?? status };
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3 text-sm font-bold">
        <span>{title}</span>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function csvDownload(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const body = rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","));
  const csv = "\uFEFF" + [headers.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function OwnerPortal() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-overview"],
    queryFn: () => getOwnerOverview(),
  });

  const [reqUnit, setReqUnit] = useState<string>("");
  const [reqType, setReqType] = useState("maintenance");
  const [reqDetails, setReqDetails] = useState("");

  const [expUnit, setExpUnit] = useState("");
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(today());

  const [docUnit, setDocUnit] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const [delName, setDelName] = useState("");
  const [delPhone, setDelPhone] = useState("");
  const [delLevel, setDelLevel] = useState<"view" | "record_payment">("view");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["owner-overview"] });

  const requestMutation = useMutation({
    mutationFn: () =>
      createOwnerRequest({ data: { unitId: reqUnit || null, requestType: reqType, details: reqDetails } }),
    onSuccess: () => {
      setReqDetails("");
      invalidate();
    },
  });

  const expenseMutation = useMutation({
    mutationFn: () =>
      addUnitExpense({
        data: { unitId: expUnit, title: expTitle, amount: Number(expAmount) || 0, spentOn: expDate },
      }),
    onSuccess: () => {
      setExpTitle("");
      setExpAmount("");
      invalidate();
    },
  });

  const docMutation = useMutation({
    mutationFn: async () => {
      if (!docFile) throw new Error("اختر ملفًا أولًا");
      setDocBusy(true);
      const uploaded = await uploadMedia("owner-documents", `${Date.now()}-${docFile.name}`, docFile);
      return recordOwnerDocument({ data: { unitId: docUnit || null, title: docTitle || docFile.name, filePath: uploaded.key } });
    },
    onSuccess: () => {
      setDocTitle("");
      setDocFile(null);
      setDocBusy(false);
      invalidate();
    },
    onError: () => setDocBusy(false),
  });

  const delegateMutation = useMutation({
    mutationFn: () => addOwnerDelegate({ data: { delegateName: delName, delegatePhone: delPhone, accessLevel: delLevel } }),
    onSuccess: () => {
      setDelName("");
      setDelPhone("");
      invalidate();
    },
  });

  const removeDelegateMutation = useMutation({
    mutationFn: (id: string) => removeOwnerDelegate({ data: { id } }),
    onSuccess: invalidate,
  });

  const payMutation = useMutation({
    mutationFn: (paymentId: string) => recordOwnerPayment({ data: { paymentId } }),
    onSuccess: invalidate,
  });

  const kpis = useMemo(() => {
    if (!data) return null;
    const contracts = data.contracts as unknown as OwnerContract[];
    const units = data.units as unknown as OwnerUnit[];
    const payments = data.payments as OwnerPayment[];

    const startingToday = contracts.filter((c) => c.start_date === today()).length;
    const endingToday = contracts.filter((c) => c.end_date === today()).length;
    const active = contracts.filter((c) => c.status === "active").length;

    const vacant = units.filter((u) => u.status === "vacant").length;
    const occupied = units.filter((u) => u.status === "occupied").length;
    const outOfService = units.filter((u) => u.status === "out_of_service" || u.status === "maintenance").length;

    const collected = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
    const remaining = payments.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);

    const expiring30 = contracts.filter((c) => c.end_date && daysBetween(c.end_date) >= 0 && daysBetween(c.end_date) <= 30);
    const expiring60 = contracts.filter((c) => c.end_date && daysBetween(c.end_date) > 30 && daysBetween(c.end_date) <= 60);

    const thisMonth = today().slice(0, 7);
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = prevDate.toISOString().slice(0, 7);

    const collectedThisMonth = payments
      .filter((p) => p.status === "paid" && p.due_date.slice(0, 7) === thisMonth)
      .reduce((s, p) => s + Number(p.amount_paid), 0);
    const collectedPrevMonth = payments
      .filter((p) => p.status === "paid" && p.due_date.slice(0, 7) === prevMonth)
      .reduce((s, p) => s + Number(p.amount_paid), 0);

    const expensesTotal = data.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const netIncome = collected - expensesTotal;

    return {
      startingToday,
      endingToday,
      active,
      vacant,
      occupied,
      outOfService,
      total: units.length,
      collected,
      remaining,
      expiring30,
      expiring60,
      collectedThisMonth,
      collectedPrevMonth,
      expensesTotal,
      netIncome,
    };
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data || !kpis) return null;

  const units = data.units as unknown as OwnerUnit[];
  const contracts = data.contracts as unknown as OwnerContract[];
  const payments = data.payments as OwnerPayment[];

  const unitContract = (unitId: string) => contracts.find((c) => c.unit_id === unitId && c.status === "active") ?? null;
  const contractPayments = (contractId: string) => payments.filter((p) => p.contract_id === contractId);
  const punctuality = (contractId: string) => {
    const list = contractPayments(contractId);
    if (!list.length) return null;
    const onTime = list.filter((p) => p.status === "paid").length;
    return Math.round((onTime / list.length) * 100);
  };

  return (
    <div className="space-y-5" dir="rtl">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-l from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.7)] p-5 text-white shadow">
        <h1 className="text-lg font-bold">لوحة المالك — {data.contact?.full_name ?? ""}</h1>
        <p className="mt-1 text-xs text-white/80">إدارة عقاراتك المؤجّرة ومتابعة السداد والمصروفات.</p>
      </section>

      {(kpis.expiring30.length || kpis.expiring60.length) ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          ⏰ لديك {kpis.expiring30.length} عقد ينتهي خلال 30 يومًا و{kpis.expiring60.length} عقد ينتهي خلال 60 يومًا.
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "عقود تبدأ اليوم", value: kpis.startingToday },
          { label: "عقود تنتهي اليوم", value: kpis.endingToday },
          { label: "عقود نشطة", value: kpis.active },
          { label: "وحدات شاغرة", value: kpis.vacant, tone: "text-amber-600" },
          { label: "وحدات مؤجّرة", value: kpis.occupied, tone: "text-emerald-600" },
          { label: "خارج الخدمة", value: kpis.outOfService, tone: "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={`text-xl font-extrabold ${k.tone ?? "text-foreground"}`}>{k.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي المحصّل</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-600">{money(kpis.collected)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">المتبقي</p>
          <p className={`mt-1 text-xl font-extrabold ${kpis.remaining ? "text-destructive" : "text-foreground"}`}>{money(kpis.remaining)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">صافي الدخل (بعد المصروفات)</p>
          <p className="mt-1 text-xl font-extrabold">{money(kpis.netIncome)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">تحصيل الشهر الحالي مقابل الماضي</p>
          <p className="mt-1 text-sm font-bold">
            {money(kpis.collectedThisMonth)} / {money(kpis.collectedPrevMonth)}
          </p>
        </div>
      </div>

      {/* Units */}
      <Section
        title="🏠 الوحدات"
        action={
          <button
            className="text-xs font-semibold text-primary"
            onClick={() =>
              csvDownload(
                "كشف-حساب.csv",
                payments.map((p) => ({
                  "رقم الدفعة": p.payment_number,
                  "تاريخ الاستحقاق": p.due_date,
                  "المستحق": p.amount_due,
                  "المسدد": p.amount_paid,
                  "الحالة": p.status,
                })),
              )
            }
          >
            تصدير كشف الحساب CSV ↓
          </button>
        }
      >
        {units.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد وحدات مملوكة مرتبطة بحسابك.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {units.map((u) => {
              const c = unitContract(u.id);
              const own = c ? contractPayments(c.id) : [];
              const remaining = own.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
              const chip = statusChip(u.status);
              const rate = c ? punctuality(c.id) : null;
              return (
                <article key={u.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">
                      {u.unit_type ?? "وحدة"} — رقم {u.unit_number}
                    </p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {[u.building?.name, u.building?.city, u.building?.district].filter(Boolean).join(" — ") || "—"}
                  </p>
                  {c ? (
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p>المستأجر: <b className="text-foreground">{c.tenant?.full_name ?? "—"}</b></p>
                      <p>العقد: <b className="text-foreground">{c.contract_number}</b> ({c.start_date ?? "—"} → {c.end_date ?? "—"})</p>
                      <p>المتبقي: <b className={remaining ? "text-destructive" : "text-foreground"}>{money(remaining)}</b></p>
                      {rate !== null ? <p>مؤشر الالتزام بالسداد: <b className="text-foreground">{rate}%</b></p> : null}
                      {c.end_date && daysBetween(c.end_date) >= 0 && daysBetween(c.end_date) <= 60 ? (
                        <button
                          className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                          onClick={() => createOwnerRequest({ data: { unitId: u.id, contractId: c.id, requestType: "renewal", details: "طلب تجديد العقد" } }).then(invalidate)}
                        >
                          طلب تجديد العقد
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">وحدة شاغرة</span>
                      <button
                        className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                        onClick={() => createOwnerRequest({ data: { unitId: u.id, requestType: "marketing", details: "طلب تسويق الوحدة الشاغرة" } }).then(invalidate)}
                      >
                        طلب تسويق الوحدة
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Section>

      {/* Payments to record */}
      <Section title="💳 دفعات مستحقة">
        {payments.filter((p) => p.status !== "paid").length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد دفعات معلّقة.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {payments
              .filter((p) => p.status !== "paid")
              .map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>دفعة رقم {p.payment_number} — استحقاق {p.due_date}</span>
                  <span className="font-bold">{money(Number(p.amount_due) - Number(p.amount_paid))}</span>
                  <button
                    className="rounded-lg border border-primary px-3 py-1 text-[11px] font-bold text-primary"
                    disabled={payMutation.isPending}
                    onClick={() => payMutation.mutate(p.id)}
                  >
                    تسجيل السداد
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Section>

      {/* Requests */}
      <Section title="📝 طلب جديد">
        <div className="grid gap-3 sm:grid-cols-4">
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={reqUnit} onChange={(e) => setReqUnit(e.target.value)}>
            <option value="">بدون وحدة محددة</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>وحدة {u.unit_number}</option>
            ))}
          </select>
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={reqType} onChange={(e) => setReqType(e.target.value)}>
            <option value="maintenance">صيانة</option>
            <option value="renewal">تجديد عقد</option>
            <option value="marketing">تسويق وحدة شاغرة</option>
            <option value="other">أخرى</option>
          </select>
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
            placeholder="تفاصيل الطلب"
            value={reqDetails}
            onChange={(e) => setReqDetails(e.target.value)}
          />
        </div>
        <button
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          disabled={requestMutation.isPending}
          onClick={() => requestMutation.mutate()}
        >
          إرسال الطلب
        </button>

        {data.requests.length ? (
          <ul className="mt-4 space-y-2 text-xs">
            {data.requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>{r.request_type} — {r.details ?? "—"}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{r.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      {/* Expenses */}
      <Section title="🧾 مصروفات الوحدات">
        <div className="grid gap-3 sm:grid-cols-5">
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={expUnit} onChange={(e) => setExpUnit(e.target.value)}>
            <option value="">اختر وحدة</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>وحدة {u.unit_number}</option>
            ))}
          </select>
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="عنوان المصروف" value={expTitle} onChange={(e) => setExpTitle(e.target.value)} />
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="المبلغ" type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
          <button
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            disabled={!expUnit || !expTitle || expenseMutation.isPending}
            onClick={() => expenseMutation.mutate()}
          >
            إضافة
          </button>
        </div>
        {data.expenses.length ? (
          <ul className="mt-4 space-y-1 text-xs">
            {data.expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-border py-1">
                <span>{e.title} — {e.spent_on}</span>
                <span className="font-bold text-destructive">{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">لا توجد مصروفات مسجّلة.</p>
        )}
      </Section>

      {/* Documents */}
      <Section title="📁 مستندات الملكية">
        <div className="grid gap-3 sm:grid-cols-4">
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={docUnit} onChange={(e) => setDocUnit(e.target.value)}>
            <option value="">بدون وحدة محددة</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>وحدة {u.unit_number}</option>
            ))}
          </select>
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="عنوان المستند" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
          <button
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            disabled={!docFile || docBusy}
            onClick={() => docMutation.mutate()}
          >
            {docBusy ? "جارٍ الرفع…" : "رفع المستند"}
          </button>
        </div>
        {data.documents.length ? (
          <ul className="mt-4 space-y-1 text-xs">
            {data.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between border-b border-border py-1">
                <span>{d.title}</span>
                <span className="text-muted-foreground">{d.created_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">لا توجد مستندات مرفوعة.</p>
        )}
      </Section>

      {/* Delegates */}
      <Section title="👥 المفوّضون بالتصرف">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="اسم المفوَّض" value={delName} onChange={(e) => setDelName(e.target.value)} />
          <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="جوال المفوَّض" value={delPhone} onChange={(e) => setDelPhone(e.target.value)} />
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={delLevel} onChange={(e) => setDelLevel(e.target.value as "view" | "record_payment")}>
            <option value="view">عرض فقط</option>
            <option value="record_payment">تسجيل سداد</option>
          </select>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            disabled={!delName || delegateMutation.isPending}
            onClick={() => delegateMutation.mutate()}
          >
            إضافة مفوَّض
          </button>
        </div>
        {data.delegates.length ? (
          <ul className="mt-4 space-y-1 text-xs">
            {data.delegates.map((d) => (
              <li key={d.id} className="flex items-center justify-between border-b border-border py-1">
                <span>{d.delegate_name} — {d.delegate_phone ?? "—"} ({d.access_level === "view" ? "عرض فقط" : "تسجيل سداد"})</span>
                <button className="text-destructive" onClick={() => removeDelegateMutation.mutate(d.id)}>حذف</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">لا يوجد مفوّضون حاليًا.</p>
        )}
      </Section>
    </div>
  );
}
