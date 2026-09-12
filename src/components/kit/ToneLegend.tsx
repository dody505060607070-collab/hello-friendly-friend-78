import { rowToneLabel, type RowTone } from "@/lib/row-tone";

const dot: Record<Exclude<RowTone, "none">, string> = {
  overdue: "bg-destructive",
  today: "bg-warning",
  urgent: "bg-destructive/60",
  done: "bg-success",
  new: "bg-success/60",
  progress: "bg-primary",
};

export function ToneLegend({ tones }: { tones: Exclude<RowTone, "none">[] }) {
  return (
    <div className="surface-card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
      <span className="text-[12.5px] font-bold text-foreground">دليل الألوان:</span>
      {tones.map((t) => (
        <span key={t} className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span className={`size-2.5 rounded-full ${dot[t]}`} aria-hidden />
          {rowToneLabel[t]}
        </span>
      ))}
    </div>
  );
}
