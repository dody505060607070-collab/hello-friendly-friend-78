import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, Search, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { requestStatusLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/supply-requests/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل طلب توفير عقار | مثراء العقارية" },
      { name: "description", content: "تفاصيل طلب توفير العقار وملاحظات الإدارة وحالة المتابعة." },
      { property: "og:title", content: "تفاصيل طلب توفير عقار | مثراء العقارية" },
      { property: "og:description", content: "متابعة طلب توفير عقار حتى إغلاقه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SupplyRequestDetail,
});

const statusOrder = ["new", "in_review", "contacted", "approved", "converted", "rejected", "closed"];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13.5px] font-semibold text-foreground">{value || "—"}</p>
    </div>
  );
}

function SupplyRequestDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const request = useQuery({
    queryKey: ["supply_request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (request.data) setNote((request.data as { admin_notes?: string | null }).admin_notes ?? "");
  }, [request.data]);

  const update = useMutation({
    mutationFn: async (patch: { status?: string; admin_notes?: string }) => {
      const { error } = await supabase.from("supply_requests").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply_request", id] });
      queryClient.invalidateQueries({ queryKey: ["supply_requests"] });
      toast.success("تم الحفظ");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  if (request.isLoading) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">جاري تحميل الطلب…</p>
      </div>
    );
  }

  if (request.error || !request.data) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <p className="text-[14px] font-semibold text-foreground">تعذّر العثور على الطلب</p>
        <Link to="/supply-requests" className="text-[13px] font-semibold text-primary">
          رجوع للقائمة
        </Link>
      </div>
    );
  }

  const r = request.data as Record<string, string | number | null>;

  return (
    <>
      <PageHero
        title={`طلب توفير: ${String(r["full_name"] ?? "")}`}
        subtitle="تفاصيل الطلب وبيانات التواصل وملاحظات الإدارة."
        icon={Search}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="الاسم" value={String(r["full_name"] ?? "")} />
        <Field label="الجوال" value={<span dir="ltr">{String(r["phone"] ?? "")}</span>} />
        <Field label="نوع الطلب" value={r["request_type"] === "buy" ? "شراء" : "إيجار"} />
        <Field label="نوع العقار" value={String(r["property_type"] ?? "")} />
        <Field label="المدينة" value={String(r["city"] ?? "")} />
        <Field label="الأحياء" value={String(r["districts"] ?? "")} />
        <Field label="الحد الأدنى للميزانية" value={String(r["budget_min"] ?? "")} />
        <Field label="الحد الأعلى للميزانية" value={String(r["budget_max"] ?? "")} />
        <Field
          label="الصفة"
          value={r["requester_type"] === "broker" ? String(r["broker_name"] ?? "وسيط") : "عميل"}
        />
        <Field label="جوال الوسيط" value={<span dir="ltr">{String(r["broker_phone"] ?? "")}</span>} />
        <Field label="ملاحظات مقدّم الطلب" value={String(r["requester_notes"] ?? "")} />
        <Field label="الحالة الحالية" value={requestStatusLabels[String(r["status"])] ?? String(r["status"])} />
      </div>

      <div className="surface-card mt-4 space-y-4 p-5">
        <div>
          <label className="text-[12.5px] font-semibold text-foreground">حالة الطلب</label>
          <select
            value={String(r["status"] ?? "new")}
            onChange={(e) => update.mutate({ status: e.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none sm:w-64"
          >
            {statusOrder.map((s) => (
              <option key={s} value={s}>
                {requestStatusLabels[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[12.5px] font-semibold text-foreground">ملاحظة الإدارة</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-border bg-card p-3 text-[13px] outline-none"
          />
          <button
            type="button"
            onClick={() => update.mutate({ admin_notes: note })}
            disabled={update.isPending}
            className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
          >
            حفظ الملاحظة
          </button>
        </div>
      </div>

      <div className="mt-4">
        <Link
          to="/supply-requests"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-[13px] font-semibold"
        >
          <ArrowRight className="size-4" />
          رجوع للقائمة
        </Link>
      </div>
    </>
  );
}
