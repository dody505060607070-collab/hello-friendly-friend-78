import type { ReactNode } from "react";

import { EstimatedBadge } from "@/components/dashboard/EstimatedBadge";

/** بطاقة تحليلية عامة بعنوان ووصف ومحتوى حر، مع دعم شارة "تقديري". */
export function AnalyticsCard({
  title,
  subtitle,
  estimated,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  estimated?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
        {estimated ? <EstimatedBadge /> : null}
      </div>
      {subtitle ? <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
