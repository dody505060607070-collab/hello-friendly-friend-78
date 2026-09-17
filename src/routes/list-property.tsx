import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Home, ImageIcon, MapPin, Search, UserRound, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";

export const Route = createFileRoute("/list-property")({
  head: () => ({
    meta: [
      { title: "اعرض أو اطلب عقارك | مثراء العقارية" },
      {
        name: "description",
        content:
          "أرسل بيانات عقارك لعرضه للإيجار أو البيع في بريدة، أو اطلب عقاراً بمواصفات محددة وسيتواصل معك فريقنا.",
      },
      { property: "og:title", content: "اعرض أو اطلب عقارك | مثراء العقارية" },
      {
        property: "og:description",
        content: "نموذج عرض العقار أو طلب عقار في بريدة مع متابعة مباشرة من فريق مثراء.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://friendly-fellow-kit.lovable.app/list-property" }],
  }),
  component: ListPropertyPage,
});

type Mode = "request" | "offer";

/* ------------------------------ عناصر الشكل ------------------------------ */

function Req() {
  return <span className="text-destructive"> *</span>;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-right text-[12.5px] font-bold text-foreground">
        {label}
        {required ? <Req /> : null}
      </div>
      {hint ? <p className="text-right text-[11px] text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-right text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15";

function SelectBox({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pl-9`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
    </div>
  );
}

function ChoiceCard({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Home;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px] font-bold transition-all ${
        active
          ? "border-primary bg-primary/10 text-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent"
      }`}
    >
      <Icon className={`size-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      {label}
    </button>
  );
}

/* --------------------------------- الصفحة -------------------------------- */

function ListPropertyPage() {
  const [mode, setMode] = useState<Mode>("request");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const lists = useQuery({
    queryKey: ["public-form-lists"],
    queryFn: async () => {
      const [districts, types] = await Promise.all([
        supabase.from("districts").select("name").eq("is_active", true).order("sort_order"),
        supabase.from("property_types").select("name").eq("is_active", true).order("sort_order"),
      ]);
      return {
        districts: (districts.data ?? []).map((d) => d.name),
        types: (types.data ?? []).map((t) => t.name),
      };
    },
  });

  const districts = lists.data?.districts?.length
    ? lists.data.districts
    : ["الرحاب", "النهضة", "الصفراء", "الخليج", "الإسكان", "الوسط"];
  const propertyTypes = lists.data?.types?.length
    ? lists.data.types
    : ["شقة", "فيلا", "دور", "أرض", "معرض", "مكتب", "استراحة"];

  // نموذج «اطلب عقارك»
  const [req, setReq] = useState({
    full_name: "",
    phone: "",
    city: "",
    district: "",
    request_type: "buy",
    budget_min: "",
    budget_max: "",
    is_broker: false,
    broker_name: "",
    broker_phone: "",
    notes: "",
  });

  // نموذج «اعرض عقارك»
  const [offer, setOffer] = useState({
    full_name: "",
    phone: "",
    purpose: "sale",
    property_type: "",
    district: "",
    description: "",
    asking_price: "",
    map_url: "",
  });
  const [files, setFiles] = useState<File[]>([]);

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/avif"];

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 3);
    const badType = next.find((f) => !ALLOWED_IMAGE_TYPES.includes(f.type));
    if (badType) {
      toast.error("يُسمح بالصور فقط (JPG / PNG / WEBP)");
      return;
    }
    const tooBig = next.find((f) => f.size > 5 * 1024 * 1024);
    if (tooBig) {
      toast.error("حد أقصى 5 ميجا للصورة الواحدة");
      return;
    }
    setFiles(next);
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!req.full_name.trim() || !req.phone.trim() || !req.city.trim() || !req.district) {
      toast.error("رجاءً أكمل الحقول المطلوبة");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("supply_requests").insert({
        full_name: req.full_name,
        phone: req.phone,
        request_type: req.request_type === "buy" ? "sale" : "rent",
        city: req.city,
        districts: req.district,
        budget_min: req.budget_min ? Number(req.budget_min) : null,
        budget_max: req.budget_max ? Number(req.budget_max) : null,
        requester_type: req.is_broker ? "broker" : "client",
        broker_name: req.is_broker ? req.broker_name || null : null,
        broker_phone: req.is_broker ? req.broker_phone || null : null,
        requester_notes: req.notes || null,
      });
      if (error) throw error;
      await notifyAutomation(req.full_name, req.phone, req.request_type, req.city, null);
      await sendSelfConfirmation(req.phone, req.request_type === "buy" ? "طلب شراء عقار" : "طلب استئجار عقار");
      toast.success("تم إرسال طلبك بنجاح، سيتواصل معك فريقنا قريباً.");
      void navigate({ to: "/thank-you" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إرسال الطلب، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const submitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !offer.full_name.trim() ||
      !offer.phone.trim() ||
      !offer.property_type ||
      !offer.district ||
      !offer.description.trim() ||
      !offer.asking_price.trim() ||
      !offer.map_url.trim()
    ) {
      toast.error("رجاءً أكمل الحقول المطلوبة");
      return;
    }
    if (files.length === 0) {
      toast.error("أضف صورة واحدة على الأقل للعقار");
      return;
    }
    setBusy(true);
    try {
      const attachments: { path: string; name: string }[] = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || "jpg"}`;
        await uploadMedia("listing-uploads", path, file);
        attachments.push({ path: `listing-uploads/${path}`, name: file.name });
      }
      const { error } = await supabase.from("listing_requests").insert({
        full_name: offer.full_name,
        phone: offer.phone,
        purpose: offer.purpose,
        property_type: offer.property_type,
        city: "بريدة",
        district: offer.district,
        description: offer.description,
        asking_price: offer.asking_price,
        map_url: offer.map_url,
        attachments,
      });
      if (error) throw error;
      await notifyAutomation(
        offer.full_name,
        offer.phone,
        offer.purpose,
        "بريدة",
        offer.property_type,
      );
      await sendSelfConfirmation(offer.phone, offer.purpose === "sale" ? "عرض عقار للبيع" : "عرض عقار للإيجار");
      toast.success("تم إرسال بيانات عقارك بنجاح، سيتواصل معك فريقنا قريباً.");
      void navigate({ to: "/thank-you" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إرسال الطلب، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        {/* التبويبات */}
        <div className="mb-6 grid grid-cols-2 gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {(
            [
              { id: "offer", label: "اعرض عقارك", icon: Home },
              { id: "request", label: "اطلب عقارك", icon: Search },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`pressable flex items-center justify-center gap-2 py-3.5 text-[13.5px] font-bold transition-colors ${
                mode === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {/* ترويسة البطاقة */}
          <header className="bg-primary/10 px-6 py-5 text-right">
            <h1 className="text-[17px] font-extrabold text-primary">
              {mode === "request" ? "بيانات طلب العقار" : "بيانات العقار"}
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {mode === "request"
                ? "أخبرنا بما تبحث عنه وسنتواصل معك بأسرع وقت"
                : "يرجى تعبئة جميع الحقول المطلوبة بدقة"}
            </p>
          </header>

          {mode === "request" ? (
            <form onSubmit={submitRequest} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الاسم" required>
                  <input
                    className={inputClass}
                    placeholder="الاسم الكامل"
                    value={req.full_name}
                    onChange={(e) => setReq({ ...req, full_name: e.target.value })}
                  />
                </Field>
                <Field label="رقم الجوال" required>
                  <input
                    className={inputClass}
                    dir="ltr"
                    placeholder="05xxxxxxxx"
                    value={req.phone}
                    onChange={(e) => setReq({ ...req, phone: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="المدينة" required>
                  <input
                    className={inputClass}
                    placeholder="مثال: بريدة"
                    value={req.city}
                    onChange={(e) => setReq({ ...req, city: e.target.value })}
                  />
                </Field>
                <Field label="الحي" required>
                  <SelectBox
                    value={req.district}
                    onChange={(v) => setReq({ ...req, district: v })}
                    placeholder="اختر الحي"
                    options={districts}
                  />
                </Field>
              </div>

              <Field label="نوع الطلب" required>
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard
                    active={req.request_type === "buy"}
                    icon={Home}
                    label="أبي أشتري"
                    onClick={() => setReq({ ...req, request_type: "buy" })}
                  />
                  <ChoiceCard
                    active={req.request_type === "rent"}
                    icon={Search}
                    label="أبي أستأجر"
                    onClick={() => setReq({ ...req, request_type: "rent" })}
                  />
                </div>
              </Field>

              <Field
                label="الميزانية بالريال"
                required
                hint="ضع الرقم كاملاً بالريال، مثال: 15000 يعني 15 ألف ريال"
              >
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputClass}
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="من: مثال 15000"
                    value={req.budget_min}
                    onChange={(e) => setReq({ ...req, budget_min: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="إلى: مثال 23000"
                    value={req.budget_max}
                    onChange={(e) => setReq({ ...req, budget_max: e.target.value })}
                  />
                </div>
              </Field>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                <Switch
                  checked={req.is_broker}
                  onCheckedChange={(v) => setReq({ ...req, is_broker: v })}
                />
                <div className="flex flex-1 items-center justify-end gap-3 text-right">
                  <div>
                    <p className="text-[13px] font-bold text-foreground">أنا وسيط عقاري</p>
                    <p className="text-[11px] text-muted-foreground">أدخل بيانات الوسيط أدناه</p>
                  </div>
                  <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <UserRound className="size-4" />
                  </span>
                </div>
              </div>

              {req.is_broker ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="اسم الوسيط" required>
                    <input
                      className={inputClass}
                      placeholder="اسم الوسيط"
                      value={req.broker_name}
                      onChange={(e) => setReq({ ...req, broker_name: e.target.value })}
                    />
                  </Field>
                  <Field label="جوال الوسيط" required>
                    <input
                      className={inputClass}
                      dir="ltr"
                      placeholder="05xxxxxxxx"
                      value={req.broker_phone}
                      onChange={(e) => setReq({ ...req, broker_phone: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}

              <Field label="ملاحظات إضافية">
                <textarea
                  rows={4}
                  className={`${inputClass} h-auto py-2.5`}
                  placeholder="أي تفاصيل إضافية تساعدنا في إيجاد العقار المناسب لك..."
                  value={req.notes}
                  onChange={(e) => setReq({ ...req, notes: e.target.value })}
                />
              </Field>

              <button
                type="submit"
                disabled={busy}
                className="pressable h-11 w-full rounded-lg bg-primary text-[13.5px] font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "جارٍ الإرسال..." : "إرسال الطلب"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitOffer} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الاسم" required>
                  <input
                    className={inputClass}
                    placeholder="الاسم الكامل"
                    value={offer.full_name}
                    onChange={(e) => setOffer({ ...offer, full_name: e.target.value })}
                  />
                </Field>
                <Field label="رقم الجوال" required>
                  <input
                    className={inputClass}
                    dir="ltr"
                    placeholder="05xxxxxxxx"
                    value={offer.phone}
                    onChange={(e) => setOffer({ ...offer, phone: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="النوع" required>
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard
                    active={offer.purpose === "sale"}
                    icon={Home}
                    label="للبيع"
                    onClick={() => setOffer({ ...offer, purpose: "sale" })}
                  />
                  <ChoiceCard
                    active={offer.purpose === "rent"}
                    icon={Search}
                    label="للإيجار"
                    onClick={() => setOffer({ ...offer, purpose: "rent" })}
                  />
                </div>
              </Field>

              <Field label="نوع العقار" required>
                <SelectBox
                  value={offer.property_type}
                  onChange={(v) => setOffer({ ...offer, property_type: v })}
                  placeholder="اختر نوع العقار"
                  options={propertyTypes}
                />
              </Field>

              <Field label="الحي" required>
                <SelectBox
                  value={offer.district}
                  onChange={(v) => setOffer({ ...offer, district: v })}
                  placeholder="اختر الحي"
                  options={districts}
                />
              </Field>

              <Field label="وصف العقار" required>
                <textarea
                  rows={5}
                  className={`${inputClass} h-auto py-2.5`}
                  placeholder="اكتب وصفاً تفصيلياً للعقار (المساحة، عدد الغرف، المميزات...)"
                  value={offer.description}
                  onChange={(e) => setOffer({ ...offer, description: e.target.value })}
                />
              </Field>

              <Field label="السعر المطلوب" required>
                <input
                  className={inputClass}
                  placeholder="مثال: 150,000 ريال أو قابل للتفاوض"
                  value={offer.asking_price}
                  onChange={(e) => setOffer({ ...offer, asking_price: e.target.value })}
                />
              </Field>

              <Field
                label="موقع العقار على خرائط جوجل"
                required
                hint="افتح خرائط جوجل، اضغط على موقع العقار، ثم اضغط «مشاركة» وانسخ الرابط"
              >
                <div className="relative">
                  <input
                    className={`${inputClass} pl-10 text-left`}
                    dir="ltr"
                    placeholder="https://maps.app.goo.gl/..."
                    value={offer.map_url}
                    onChange={(e) => setOffer({ ...offer, map_url: e.target.value })}
                  />
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                </div>
              </Field>

              <Field label="صور العقار (بحد أقصى 3 صور)" required>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid w-full place-items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-8 transition-colors hover:bg-primary/10"
                >
                  <ImageIcon className="size-7 text-primary/70" />
                  <span className="text-[12.5px] font-bold text-primary">
                    اسحب الصور هنا أو اضغط للاختيار
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    JPG, PNG, WEBP — حد أقصى 5 ميجا للصورة
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                {files.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="relative overflow-hidden rounded-lg border border-border"
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt={`صورة العقار ${i + 1}`}
                          className="h-24 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                          className="absolute left-1 top-1 grid size-6 place-items-center rounded-md bg-background/90 text-destructive"
                          aria-label="حذف الصورة"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Field>

              <button
                type="submit"
                disabled={busy}
                className="pressable h-11 w-full rounded-lg bg-primary text-[13.5px] font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "جارٍ الإرسال..." : "إرسال الطلب"}
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

async function notifyAutomation(
  full_name: string,
  phone: string,
  purpose: string,
  city: string | null,
  property_type: string | null,
) {
  try {
    const { reportPublicRequest } = await import("@/lib/automation.functions");
    await reportPublicRequest({
      data: {
        full_name,
        phone,
        purpose,
        ...(city ? { city } : {}),
        ...(property_type ? { property_type } : {}),
      },
    });
  } catch {
    /* الأتمتة اختيارية */
  }
}


async function sendSelfConfirmation(phone: string, requestTypeLabel: string) {
  try {
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp.functions");
    await sendWhatsAppMessage({
      data: {
        to: phone,
        body: `شكراً لتواصلك مع مثراء العقارية.\nتم استلام طلبك (${requestTypeLabel}) بنجاح، وسيتواصل معك فريقنا في أقرب وقت.`,
      },
    });
  } catch {
    /* لا نوقف أو نراجع الحفظ إن فشل إرسال التأكيد */
  }
}
