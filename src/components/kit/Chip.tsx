import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type ChipTone = "neutral" | "warning" | "success" | "danger" | "primary" | "gold";

const tones: Record<ChipTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  warning: "border-warning/30 bg-warning/12 text-warning-foreground",
  success: "border-success/30 bg-success/12 text-success",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  primary: "border-primary/25 bg-primary/8 text-primary",
  gold: "border-gold/35 bg-gold/12 text-gold-foreground",
};

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
