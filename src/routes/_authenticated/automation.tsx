import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAutomationSettings, saveAutomationSettings } from "@/lib/automation.functions";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({
    meta: [
      { title: "ربط n8n | مثراء" },
      {
        name: "description",
        content: "إعداد ربط نظام مثراء بمنصة n8n لإرسال التذكيرات والمتابعات تلقائياً.",
      },
      { property: "og:title", content: "ربط n8n | مثراء" },
      {
        property: "og:description",
        content: "إعداد ربط نظام مثراء بمنصة n8n لإرسال التذكيرات والمتابعات تلقائياً.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  const qc = useQueryClient();
  const load = useServerFn(getAutomationSettings);
  const save = useServerFn(saveAutomationSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: () => load(),
    retry: false,
  });

  const [enabled, setEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setWebhookUrl(data.webhook_url);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (regenerate: boolean) =>
      save({ data: { enabled, webhook_url: webhookUrl, regenerate_token: regenerate } }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      void qc.invalidateQueries({ queryKey: ["automation-settings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/n8n` : "/api/public/n8n";

  const copy = (value: string, label: string) => {
    void navigator.clipboard.writeText(value);
    toast.success(`تم نسخ ${label}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Workflow className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">ربط n8n للأتمتة</h1>
          <p className="text-sm text-muted-foreground">
            التذكيرات والمتابعات المجدولة تُرسل من n8n عبر هذا الربط.
          </p>
        </div>
      </header>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-base">تفعيل الأتمتة</Label>
            <p className="text-xs text-muted-foreground">إرسال أحداث النظام إلى n8n تلقائياً</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wh">رابط الـ Webhook في n8n</Label>
          <Input
            id="wh"
            dir="ltr"
            placeholder="https://n8n.srv1124662.hstgr.cloud/webhook/mithra"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <Button onClick={() => mutation.mutate(false)} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} حفظ
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">بيانات الاتصال (ضعها في n8n)</h2>

        <div className="space-y-2">
          <Label>رابط النظام (HTTP Request في n8n)</Label>
          <div className="flex gap-2">
            <Input dir="ltr" readOnly value={endpoint} />
            <Button variant="outline" size="icon" onClick={() => copy(endpoint, "الرابط")}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>المفتاح المشترك — ترويسة X-Mithra-Token</Label>
          <div className="flex gap-2">
            <Input
              dir="ltr"
              readOnly
              type={showToken ? "text" : "password"}
              value={data?.shared_token ?? ""}
            />
            <Button variant="outline" onClick={() => setShowToken((v) => !v)}>
              {showToken ? "إخفاء" : "إظهار"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy(data?.shared_token ?? "", "المفتاح")}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutation.mutate(true)}
            disabled={mutation.isPending}
          >
            <KeyRound className="size-4" /> توليد مفتاح جديد
          </Button>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-7">
          <p className="font-medium">الأوامر المتاحة (POST مع الترويسة):</p>
          <ul className="list-disc ps-5 text-muted-foreground">
            <li>
              <code dir="ltr">{'{"action":"due_payments","days":7}'}</code> — يرجّع الدفعات
              المستحقة/المتأخرة مع اسم وجوال العميل
            </li>
            <li>
              <code dir="ltr">{'{"action":"send_whatsapp","to":"9665...","body":"..."}'}</code> —
              إرسال رسالة واتساب
            </li>
            <li>
              <code dir="ltr">{'{"action":"notify_staff","title":"...","body":"..."}'}</code> —
              تنبيه الموظفين داخل النظام
            </li>
            <li>
              <code dir="ltr">{'{"action":"log","event":"...","data":{}}'}</code> — تسجيل حدث
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
