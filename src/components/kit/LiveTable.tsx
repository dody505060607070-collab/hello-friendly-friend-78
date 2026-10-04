import { useQuery } from "@tanstack/react-query";
import { Inbox, Loader2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { DataTable, type Column } from "@/components/kit/DataTable";
import { supabase } from "@/integrations/supabase/client";

export type LiveTableProps<T> = {
  /** اسم الجدول في قاعدة البيانات */
  table: string;
  select?: string;
  columns: Column<T>[];
  orderBy?: { column: string; ascending?: boolean };
  /** تصفية إضافية على الاستعلام */
  filter?: (query: any) => any;
  queryKey?: unknown[];
  searchPlaceholder?: string;
  toolbarExtra?: ReactNode;
  emptyText?: string;
  emptyHint?: string;
  selectable?: boolean;
  showColumnsButton?: boolean;
};

export function useTableRows<T>({
  table,
  select = "*",
  orderBy,
  filter,
  queryKey,
}: Pick<LiveTableProps<T>, "table" | "select" | "orderBy" | "filter" | "queryKey">) {
  return useQuery({
    queryKey: queryKey ?? [table, select, orderBy?.column, orderBy?.ascending],
    queryFn: async () => {
      let q: any = supabase.from(table as any).select(select);
      if (filter) q = filter(q);
      if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-16 text-center">
      <Inbox className="size-8 text-muted-foreground/60" />
      <p className="text-[14px] font-semibold text-foreground">{text}</p>
      {hint ? <p className="max-w-md text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function LiveTable<T>({
  columns,
  searchPlaceholder,
  toolbarExtra,
  emptyText = "لا توجد بيانات بعد",
  emptyHint = "ستظهر السجلات هنا بمجرد إضافتها في النظام.",
  selectable,
  showColumnsButton,
  ...queryProps
}: LiveTableProps<T>) {
  const { data, isLoading, error } = useTableRows<T>(queryProps);

  if (isLoading) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">جاري تحميل البيانات…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <p className="text-[14px] font-semibold text-foreground">تعذّر تحميل البيانات</p>
        <p className="max-w-md text-[12.5px] text-muted-foreground" dir="ltr">
          {error instanceof Error ? error.message : "خطأ غير معروف"}
        </p>
      </div>
    );
  }

  return (
    <DataTable<T>
      columns={columns}
      rows={data ?? []}
      {...(searchPlaceholder ? { searchPlaceholder } : {})}
      {...(selectable !== undefined ? { selectable } : {})}
      {...(showColumnsButton !== undefined ? { showColumnsButton } : {})}
      toolbarExtra={toolbarExtra}
      emptyState={<EmptyState text={emptyText} hint={emptyHint} />}
    />
  );
}


export function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value)} ر.س`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(value));
}
