import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type Step = { key: string; label: string; done: boolean };

/** شريط خطوات يوضّح تقدّم إدخال البيانات في النماذج الطويلة */
export function Stepper({
  steps,
  className,
}: {
  steps: Step[];
  className?: string;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className={cn("surface-card px-5 py-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-foreground">خطوات استكمال البيانات</p>
        <span className="text-[12.5px] font-semibold text-primary">{pct}% مكتمل</span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-[12px] font-bold transition-colors",
                s.done
                  ? "border-success/40 bg-success/15 text-success"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {s.done ? <Check className="size-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[12.5px] font-semibold",
                s.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
