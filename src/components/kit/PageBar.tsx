import { ChevronLeft, Plus } from "lucide-react";
import type { ReactNode } from "react";

export function PageBar({
  crumbs,
  action,
}: {
  crumbs: string[];
  action?: { label: string; icon?: ReactNode };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {action ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {action.icon ?? <Plus className="size-4" />}
          {action.label}
        </button>
      ) : (
        <span />
      )}

      <nav className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronLeft className="size-3.5" /> : null}
            <span className={i === 0 ? "font-semibold text-primary" : undefined}>{crumb}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}
