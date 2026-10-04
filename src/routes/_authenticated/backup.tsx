import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBackup, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createSystemBackup } from "@/lib/backup.functions";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [
    { title: "النسخ الاحتياطي | مثراء العقارية" },
    { name: "description", content: "إنشاء نسخة احتياطية مشفرة محليًا ومراجعة سجل النسخ السابقة." },
    { property: "og:title", content: "النسخ الاحتياطي | مثراء العقارية" },
    { property: "og:description", content: "نسخ بيانات النظام وسجل عمليات النسخ." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: BackupPage,
});

type BackupRow = { id: string; status: string; size_bytes: number | null; tables_count: number; created_at: string; completed_at: string | null; error_message: string | null };

function BackupPage() {
  const { isSuperAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["backup-runs"], enabled: isSuperAdmin, queryFn: async () => {
    const { data, error } = await supabase.from("backup_runs").select("id,status,size_bytes,tables_count,created_at,completed_at,error_message").order("created_at", { ascending: false }).limit(50);
    if (error) throw error; return (data ?? []) as BackupRow[];
  }});
  const create = useMutation({ mutationFn: () => createSystemBackup(), onSuccess: (result) => {
    const url = URL.createObjectURL(new Blob([result.payload], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = result.fileName; link.click(); URL.revokeObjectURL(url);
    void qc.invalidateQueries({ queryKey: ["backup-runs"] }); toast.success("تم إنشاء وتنزيل النسخة الاحتياطية");
  }, onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر إنشاء النسخة") });

  return <><PageHero title="النسخ الاحتياطي" subtitle="تنزيل نسخة كاملة من بيانات التشغيل ومراجعة سجل النسخ." icon={DatabaseBackup} />
    {!isSuperAdmin ? <div className="surface-card"><EmptyState text="هذه الصفحة للمدير العام فقط" /></div> : <>
      <div className="flex justify-end"><Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <Loader2 className="animate-spin" /> : <Download />}إنشاء نسخة الآن</Button></div>
      <DataTable rows={history.data ?? []} emptyState={<EmptyState text="لم يتم إنشاء نسخ بعد" />} columns={[
        { header: "التاريخ", cell: (r: BackupRow) => formatDate(r.created_at) },
        { header: "الحالة", cell: (r: BackupRow) => <Chip tone={r.status === "completed" ? "success" : r.status === "failed" ? "danger" : "warning"}>{r.status === "completed" ? "مكتملة" : r.status === "failed" ? "فشلت" : "قيد التنفيذ"}</Chip> },
        { header: "الجداول", cell: (r: BackupRow) => r.tables_count },
        { header: "الحجم", cell: (r: BackupRow) => r.size_bytes == null ? "—" : `${(r.size_bytes / 1024).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} ك.ب` },
        { header: "ملاحظة", cell: (r: BackupRow) => r.error_message ?? "—" },
      ]} />
    </>}
  </>;
}