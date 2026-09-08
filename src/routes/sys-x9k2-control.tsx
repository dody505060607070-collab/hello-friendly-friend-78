import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { setKillSwitch } from "@/lib/kill-switch.functions";

export const Route = createFileRoute("/sys-x9k2-control")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "—" }] }),
  component: ControlPage,
});

function ControlPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useServerFn(setKillSwitch);

  const { data, refetch } = useQuery({
    queryKey: ["site-kill-switch", "control"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_kill_switch")
        .select("locked,message,updated_at")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  async function apply(locked: boolean) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await run({
        data: message ? { code, locked, message } : { code, locked },
      });
      if (res.ok) {
        setStatus(locked ? "تم قفل الموقع" : "تم تشغيل الموقع");
        setCode("");
        await refetch();
      } else {
        setStatus(res.error);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "فشلت العملية");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-black text-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-xl font-bold">لوحة تحكم النظام</h1>
        <p className="mt-2 text-xs text-white/60">
          الحالة الحالية:{" "}
          <span className={data?.locked ? "text-red-400" : "text-green-400"}>
            {data?.locked ? "مقفول" : "مفتوح"}
          </span>
        </p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-white/70">الكود السري</label>
            <input
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/70">رسالة الإيقاف (اختياري)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={data?.message ?? "الموقع متوقف مؤقتاً."}
              className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/60"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={busy || !code}
              onClick={() => apply(true)}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              قفل الموقع
            </button>
            <button
              type="button"
              disabled={busy || !code}
              onClick={() => apply(false)}
              className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              فتح الموقع
            </button>
          </div>

          {status ? <p className="pt-2 text-xs text-white/80">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
