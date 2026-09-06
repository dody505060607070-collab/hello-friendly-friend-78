import { ChevronDown, ChevronRight, Columns3, Filter, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  searchPlaceholder = "بحث",
  selectable = false,
  showColumnsButton = false,
  showFilter = true,
  total,
  pages = 1,
  rowClassName,
  toolbarExtra,
  emptyState,
}: {
  columns: Column<T>[];
  rows: T[];
  searchPlaceholder?: string;
  selectable?: boolean;
  showColumnsButton?: boolean;
  showFilter?: boolean;
  total?: number;
  pages?: number;
  rowClassName?: (row: T) => string | undefined;
  toolbarExtra?: ReactNode;
  emptyState?: ReactNode;
}) {
  const count = total ?? rows.length;
  const pageList = Array.from({ length: Math.min(pages, 4) }, (_, i) => i + 1);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder={searchPlaceholder}
            className="h-10 w-[220px] rounded-lg border border-border bg-card pe-9 ps-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
          />
        </div>
        {toolbarExtra}
        {showFilter ? (
          <button
            type="button"
            className="relative grid size-10 place-items-center rounded-lg text-primary transition-colors hover:bg-accent"
            aria-label="تصفية"
          >
            <Filter className="size-[18px]" />
            <span className="absolute -top-0.5 end-0 rounded-full bg-destructive/10 px-1 text-[10px] font-bold text-destructive">
              0
            </span>
          </button>
        ) : null}
        {showColumnsButton ? (
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
            aria-label="الأعمدة"
          >
            <Columns3 className="size-[18px]" />
          </button>
        ) : null}
      </div>

      {rows.length === 0 && emptyState ? (
        emptyState
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-right">
            <thead>
              <tr className="border-b border-border bg-card">
                {selectable ? (
                  <th className="w-10 px-4 py-3">
                    <span className="block size-4 rounded border border-border" />
                  </th>
                ) : null}
                {columns.map((col) => (
                  <th
                    key={col.header}
                    className={cn(
                      "px-4 py-3 text-[12.5px] font-bold whitespace-nowrap text-foreground",
                      col.className,
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable ? (
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border/70 last:border-0 hover:bg-muted/40",
                    rowClassName?.(row),
                  )}
                >
                  {selectable ? (
                    <td className="px-4 py-3.5">
                      <span className="block size-4 rounded border border-border" />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.header}
                      className={cn(
                        "px-4 py-3.5 text-[13px] whitespace-nowrap text-foreground",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
        <p className="text-[12.5px] text-muted-foreground">
          عرض 1 إلى {rows.length} من {count} نتيجة
        </p>

        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span>لكل صفحة</span>
          <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 font-semibold text-foreground">
            10
            <ChevronDown className="size-4 text-muted-foreground" />
          </span>
        </div>

        <div className="flex items-center gap-1">
          {pages > 4 ? (
            <>
              <PageBtn>{pages}</PageBtn>
              <PageBtn>{pages - 1}</PageBtn>
              <span className="px-1 text-muted-foreground">…</span>
            </>
          ) : null}
          {[...pageList].reverse().map((p) => (
            <PageBtn key={p} active={p === 1}>
              {p}
            </PageBtn>
          ))}
          <PageBtn>
            <ChevronRight className="size-4" />
          </PageBtn>
        </div>
      </div>
    </div>
  );
}

function PageBtn({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-9 place-items-center rounded-lg border text-[12.5px] font-semibold transition-colors",
        active
          ? "border-primary/30 bg-accent text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
