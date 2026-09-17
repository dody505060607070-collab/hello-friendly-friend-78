import { useState } from "react";
import { Settings2, X } from "lucide-react";

export type MetricDef = { key: string; label: string };

/** تحكم بسيط لإظهار/إخفاء مؤشرات لوحة التحكم، محفوظ في localStorage. */
export function MetricsCustomizer({
  metrics,
  isVisible,
  toggle,
}: {
  metrics: MetricDef[];
  isVisible: (key: string) => boolean;
  toggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <Settings2 className="size-4" />
        تخصيص المؤشرات
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-80 rounded-xl border border-border bg-card p-3 shadow-card" dir="rtl">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <p className="text-[13px] font-bold text-foreground">إظهار/إخفاء المؤشرات</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {metrics.map((m) => (
              <label
                key={m.key}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-muted"
              >
                <span className="text-foreground">{m.label}</span>
                <input
                  type="checkbox"
                  checked={isVisible(m.key)}
                  onChange={() => toggle(m.key)}
                  className="size-4 accent-primary"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
