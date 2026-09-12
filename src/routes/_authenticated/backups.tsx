import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBackup, Download, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exportWorkbook, type ExportRow } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/backups")({
  head: () => ({
    meta: [
      { title: "النسخ الاحتياطي | مثراء العقارية" },
      {
        name: "description",
        content: "أخذ نسخة احتياطية من بيانات النظام وتنزيلها كملف Excel مع سجل لكل عملية.",
      },
      { property: "og:title", content: "النسخ الاحتياطي | مثراء العقارية" },
      { property: "og:description", content: "نسخة احتياطية كاملة من بيانات النظام بضغطة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupsPage,
});

const TABLES = [
  { table: "properties", label: "العقارات" },
  { table: "contacts", label: "العملاء" },
  { table: "contracts", label: "العقود" },
  { table: "contract_payments", label: "دفعات العقود" },
  { table: "opportunities", label: "الفرص" },
  { table: "tasks", label: "المهام" },
  { table: "reservations", label: "الحجوزات" },
] as const;

function BackupsPage() {
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();

  const history = useQuery({
    queryKey: ["backup-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_runs")
        .select("id, status, tables_count, rows_count, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const run = async () => {
    setRunning(true);
    try {
      const sheets: { name: string; rows: ExportRow[] }[] = [];
      let total = 0;
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t.table).select("*").limit(5000);
        if (error) throw error;
        const rows = (data ?? []) as Record<string, unknown>[];
        total += rows.length;
        sheets.push({
          name: t.label,
          rows: rows.map((r) => {
            const out: ExportRow = {};
            for (const [k, v] of Object.entries(r))
              out[k] = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean);
            return out;
          }),
        });
      }

      const stamp = new Date().toISOString().slice(0, 16).replace("T", "_");
      await exportWorkbook(`نسخة-احتياطية-${stamp}`, sheets);

      const { error } = await supabase.from("backup_runs").insert({
        status: "success",
        tables_count: TABLES.length,
        rows_count: total,
        details: { tables: TABLES.map((t) => t.table) },
      });
      if (error) throw error;

      toast.success(`تم إنشاء نسخة احتياطية تحتوي ${total} سجلًا`);
      await qc.invalidateQueries({ queryKey: ["backup-runs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء النسخة الاحتياطية");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHero
        title="النسخ الاحتياطي"
        subtitle="نزّل نسخة كاملة من بياناتك كملف Excel واحتفظ بها خارج النظام، مع سجل بكل عملية نسخ."
        icon={DatabaseBackup}
      />

      <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-[12.5px] text-muted-foreground">
          تشمل النسخة: {TABLES.map((t) => t.label).join("، ")}.
        </p>
        <Button type="button" size="sm" onClick={run} disabled={running}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          إنشاء نسخة احتياطية الآن
        </Button>
      </div>

      <section className="surface-card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-[14.5px] font-bold">سجل النسخ السابقة</h2>
        </header>
        {history.data?.length ? (
          <ul className="divide-y divide-border/70">
            {history.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px]">
                <span className="font-semibold">
                  {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(b.created_at),
                  )}
                </span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span>{b.tables_count} جدول</span>
                  <span>{b.rows_count} سجل</span>
                  <Chip tone={b.status === "success" ? "success" : "danger"}>
                    {b.status === "success" ? "ناجحة" : "فاشلة"}
                  </Chip>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            text="لا توجد نسخ احتياطية بعد"
            hint="أنشئ نسخة الآن، ويفضّل تكرارها أسبوعيًا والاحتفاظ بالملف في مكان آمن."
            icon={DatabaseBackup}
          />
        )}
      </section>
    </>
  );
}
