import { useMutation } from "@tanstack/react-query";
import { Loader2, MapPinned } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { extractLatLngFromUrl, isShortMapsUrl } from "@/lib/geo";
import { resolveMapCoordinates } from "@/lib/geo.functions";

/**
 * أداة تعبئة تلقائية: تبحث عن العقارات التي لديها رابط خرائط جوجل بدون
 * إحداثيات محفوظة، وتستخرج الإحداثيات وتحفظها تلقائيًا.
 */
export function BackfillCoordinatesButton() {
  const [result, setResult] = useState<{ done: number; failed: number; total: number } | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, map_url")
        .not("map_url", "is", null)
        .or("latitude.is.null,longitude.is.null");
      if (error) throw error;

      const rows = (data ?? []).filter((r) => r.map_url && r.map_url.trim());
      let done = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          const url = row.map_url as string;
          const point = extractLatLngFromUrl(url) ?? (isShortMapsUrl(url) ? await resolveMapCoordinates({ data: { url } }) : null);
          if (!point) {
            failed += 1;
            continue;
          }
          const { error: updateError } = await supabase
            .from("properties")
            .update({ latitude: point.lat, longitude: point.lng })
            .eq("id", row.id);
          if (updateError) throw updateError;
          done += 1;
        } catch {
          failed += 1;
        }
      }

      return { done, failed, total: rows.length };
    },
    onSuccess: (res) => {
      setResult(res);
      if (res.total === 0) toast("لا توجد عقارات بحاجة لتعبئة الإحداثيات");
      else toast.success(`تمت تعبئة ${res.done} من ${res.total} عقارًا${res.failed ? `، تعذّر استخراج ${res.failed}` : ""}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّرت عملية التعبئة"),
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[12.5px] font-semibold text-primary disabled:opacity-60"
      >
        {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <MapPinned className="size-4" />}
        تعبئة الإحداثيات المفقودة من روابط الخرائط
      </button>
      {result ? (
        <span className="text-[12px] text-muted-foreground">
          تم تحديث {result.done} من أصل {result.total}
          {result.failed ? `، تعذّر استخراج ${result.failed}` : ""}
        </span>
      ) : null}
    </div>
  );
}
