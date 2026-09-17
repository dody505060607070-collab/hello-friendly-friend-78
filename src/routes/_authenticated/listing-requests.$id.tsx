import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Inbox, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { requestStatusLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/listing-requests/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل طلب عرض عقار | مثراء العقارية" },
      { name: "description", content: "مراجعة طلب عرض العقار وفتحه كمسودة ثم اعتماده ونشره." },
      { property: "og:title", content: "تفاصيل طلب عرض عقار | مثراء العقارية" },
      { property: "og:description", content: "مسار اعتماد طلب عرض العقار حتى النشر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ListingRequestDetail,
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

function ListingRequestDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [note, setNote] = useState("");

  const request = useQuery({
    queryKey: ["listing_request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_requests")
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
      const { error } = await supabase.from("listing_requests").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing_request", id] });
      queryClient.invalidateQueries({ queryKey: ["listing_requests"] });
      toast.success("تم الحفظ");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  /** ينشئ مسودة عقار غير منشورة من بيانات الطلب ثم يفتح النموذج الكامل. */
  const openProperty = useMutation({
    mutationFn: async () => {
      const row = request.data as Record<string, string | null> | null;
      if (!row) throw new Error("الطلب غير متاح");
      if (row["property_id"]) return row["property_id"];

      const payload = {
        name: `عقار ${row["full_name"] ?? ""} - ${row["property_type"] ?? "طلب عرض"}`.trim(),
        code: `P-${Date.now().toString(36).toUpperCase()}`,
        purpose: row["purpose"] === "sale" ? "sale" : "rent",
        rent_period: row["purpose"] === "sale" ? null : (row["rent_period"] ?? "yearly"),
        property_type: row["property_type"] ?? null,
        city: row["city"] ?? null,
        district: row["district"] ?? null,
        price_text: row["asking_price"] ?? null,
        description: row["description"] ?? null,
        map_url: row["map_url"] ?? null,
        owner_name: row["full_name"] ?? null,
        owner_phone: row["phone"] ?? null,
        status: "draft",
        is_visible: false,
        needs_review: true,
      };
      const { data, error } = await supabase
        .from("properties")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      await supabase
        .from("listing_requests")
        .update({ property_id: data.id, status: "in_review" })
        .eq("id", id);
      return data.id as string;
    },
    onSuccess: (propertyId) => {
      queryClient.invalidateQueries({ queryKey: ["listing_request", id] });
      queryClient.invalidateQueries({ queryKey: ["listing_requests"] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("تم فتح العقار كمسودة غير منشورة");
      navigate({ to: "/property-form", search: { id: String(propertyId), req: id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر فتح العقار"),
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
        <Link to="/listing-requests" className="text-[13px] font-semibold text-primary">
          رجوع للقائمة
        </Link>
      </div>
    );
  }

  const r = request.data as Record<string, string | null>;

  return (
    <>
      <PageHero
        title={`طلب عرض: ${String(r["full_name"] ?? "")}`}
        subtitle="راجع البيانات ثم افتح العقار كمسودة، وأكمل النموذج، ثم اعتمده وانشره."
        icon={Inbox}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="المالك" value={String(r["full_name"] ?? "")} />
        <Field label="الجوال" value={<span dir="ltr">{String(r["phone"] ?? "")}</span>} />
        <Field label="البريد" value={<span dir="ltr">{String(r["email"] ?? "")}</span>} />
        <Field label="الغرض" value={r["purpose"] === "sale" ? "بيع" : "إيجار"} />
        <Field label="نوع العقار" value={String(r["property_type"] ?? "")} />
        <Field label="المدينة" value={String(r["city"] ?? "")} />
        <Field label="الحي" value={String(r["district"] ?? "")} />
        <Field label="السعر المطلوب" value={String(r["asking_price"] ?? "")} />
        <Field label="دورية الإيجار" value={String(r["rent_period"] ?? "")} />
        <Field label="رابط الموقع" value={String(r["map_url"] ?? "")} />
        <Field label="الوصف" value={String(r["description"] ?? "")} />
        <Field label="الحالة الحالية" value={requestStatusLabels[String(r["status"])] ?? String(r["status"])} />
      </div>

      <div className="surface-card mt-4 space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openProperty.mutate()}
            disabled={openProperty.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {openProperty.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {r["property_id"] ? "فتح العقار" : "فتح العقار كمسودة"}
          </button>
          <p className="text-[12.5px] text-muted-foreground">
            العقار يُنشأ غير منشور، ولا يظهر على الموقع إلا بعد «اعتماد ونشر» في أسفل نموذج العقار.
          </p>
        </div>

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
          to="/listing-requests"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-[13px] font-semibold"
        >
          <ArrowRight className="size-4" />
          رجوع للقائمة
        </Link>
      </div>
    </>
  );
}
