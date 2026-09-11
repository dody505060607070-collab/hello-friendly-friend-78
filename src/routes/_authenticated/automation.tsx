import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Loader2, RefreshCw, Send, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { Field, inputClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Toggle } from "@/components/kit/Toggle";
import {
  AUTOMATION_EVENTS,
  getAutomation,
  rotateAutomationToken,
  saveAutomation,
  testAutomation,
} from "@/lib/automation.functions";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({
    meta: [
      { title: "الأتمتة (n8n) — مثراء العقارية" },
      { name: "description", content: "ربط النظام بـ n8n لإرسال واتساب وإيميل وتسجيل البيانات وتنبيه الفريق تلقائيًا." },
      { property: "og:title", content: "الأتمتة (n8n) — مثراء العقارية" },
      { property: "og:description", content: "محرك الأتمتة خلف نظام مثراء: أحداث صادرة وأوامر واردة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["automation"],
    queryFn: () => getAutomation(),
  });

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setUrl(data.webhook_url ?? "");
    setEvents(data.events.length > 0 ? data.events : AUTOMATION_EVENTS.map((e) => e.key));
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveAutomation({ data: { enabled, webhook_url: url.trim(), events } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("تم حفظ إعدادات الأتمتة");
        void qc.invalidateQueries({ queryKey: ["automation"] });
      } else toast.error(r.error);
    },
  });

  const rotate = useMutation({
    mutationFn: () => rotateAutomationToken(),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("تم توليد مفتاح جديد");
        void qc.invalidateQueries({ queryKey: ["automation"] });
      } else toast.error(r.error);
    },
  });

  const test = useMutation({
    mutationFn: () => testAutomation(),
    onSuccess: (r) => {
      if (r.ok) toast.success("وصل الحدث التجريبي إلى n8n بنجاح");
      else toast.error(r.error ?? "فشل الإرسال");
      void qc.invalidateQueries({ queryKey: ["automation"] });
    },
  });

  const copy = (value: string, label: string) => {
    void navigator.clipboard.writeText(value);
    toast.success(`تم نسخ ${label}`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        icon={Workflow}
        title="الأتمتة (n8n)"
        subtitle="اربط النظام بـ n8n: كل حدث يخرج تلقائيًا، و n8n يقدر يبعت واتساب وإيميل ويسجل في Google Sheets وينبّه الفريق."
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">تفعيل الأتمتة</h2>
                <p className="text-sm text-muted-foreground">عند التفعيل تُرسل الأحداث المحددة إلى رابط n8n.</p>
              </div>
              <Toggle label="مفعّل" checked={enabled} onChange={setEnabled} />
            </div>

            <Field label="رابط Webhook في n8n">
              <input
                className={inputClass}
                dir="ltr"
                placeholder="https://n8n.example.com/webhook/mithra"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium">الأحداث المرسلة</p>
              <div className="flex flex-wrap gap-2">
                {AUTOMATION_EVENTS.map((e) => {
                  const on = events.includes(e.key);
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() =>
                        setEvents((prev) => (on ? prev.filter((k) => k !== e.key) : [...prev, e.key]))
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {save.isPending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
              </button>
              <button
                type="button"
                onClick={() => test.mutate()}
                disabled={test.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> إرسال حدث تجريبي
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">بيانات الاتصال العكسي (n8n ← النظام)</h2>
            <p className="text-sm text-muted-foreground">
              استخدم هذا الرابط داخل عقدة HTTP Request في n8n مع الترويسة <code dir="ltr">X-Mithra-Token</code>، وactions:
              <code dir="ltr"> send_whatsapp</code>، <code dir="ltr">notify_staff</code>، <code dir="ltr">log</code>.
            </p>
            <div className="space-y-2">
              <Field label="رابط الاستقبال">
                <div className="flex gap-2">
                  <input className={inputClass} dir="ltr" readOnly value={data?.inboundUrl ?? "/api/public/n8n"} />
                  <button
                    type="button"
                    onClick={() => copy(data?.inboundUrl ?? "/api/public/n8n", "الرابط")}
                    className="rounded-xl border border-border px-3"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </Field>
              <Field label="مفتاح الربط">
                <div className="flex gap-2">
                  <input className={inputClass} dir="ltr" readOnly value={data?.shared_token ?? ""} />
                  <button
                    type="button"
                    onClick={() => copy(data?.shared_token ?? "", "المفتاح")}
                    className="rounded-xl border border-border px-3"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rotate.mutate()}
                    disabled={rotate.isPending}
                    className="rounded-xl border border-border px-3"
                    title="توليد مفتاح جديد"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">آخر الأحداث</h2>
            {(data?.events_log ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد أحداث بعد.</p>
            ) : (
              <div className="space-y-2">
                {(data?.events_log ?? []).map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Chip tone={row.status === "sent" ? "success" : "danger"}>{row.status}</Chip>
                      <span dir="ltr" className="font-mono text-xs">
                        {row.event}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.direction === "in" ? "وارد" : "صادر"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("ar-SA")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
