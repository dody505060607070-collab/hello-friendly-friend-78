import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** هيكل تحميل للجداول بدل دوّارة التحميل */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Skeleton className="h-10 w-[220px]" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="divide-y divide-border/70">
        <div className="flex gap-4 px-5 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-5 py-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className="h-4 flex-1"
                // تفاوت بسيط في العرض ليبدو أقرب للبيانات الحقيقية
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** هيكل تحميل لبطاقات الإحصائيات */
export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card space-y-3 px-5 py-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
      ))}
    </div>
  );
}
