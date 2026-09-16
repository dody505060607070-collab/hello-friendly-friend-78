import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type StatTone = "primary" | "success" | "warning" | "danger" | "neutral";

const toneRing: Record<StatTone, string> = {
  primary: "border-primary/25 bg-primary/5",
  success: "border-success/30 bg-success/8",
  warning: "border-warning/30 bg-warning/10",
  danger: "border-destructive/30 bg-destructive/8",
  neutral: "border-border bg-card",
};

const toneIcon: Record<StatTone, string> = {
  primary: "bg-primary/12 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/18 text-warning-foreground",
  danger: "bg-destructive/12 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/** عدّاد متحرّك يصل للرقم النهائي خلال أقل من ثانية */
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  suffix,
  format = (n) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n),
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  suffix?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const animated = useCountUp(Number.isFinite(value) ? value : 0);

  return (
    <div
      className={cn(
        "group rounded-xl border px-5 py-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float",
        toneRing[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
            {format(animated)}
            {suffix ? <span className="ms-1 text-[13px] font-semibold">{suffix}</span> : null}
          </p>
          {hint ? <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110",
              toneIcon[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** شريط نسبة متحرك */
export function StatBar({ value, tone = "primary" }: { value: number; tone?: StatTone }) {
  const pct = Math.max(0, Math.min(100, value));
  const bar: Record<StatTone, string> = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    neutral: "bg-muted-foreground",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", bar[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
