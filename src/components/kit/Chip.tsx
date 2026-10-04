import { cn } from "@/lib/utils";
import { toneBadgeClass, type Tone } from "@/lib/status-tone";
import type { ReactNode } from "react";

export type ChipTone = Tone | "primary" | "gold";

const toneMap: Record<ChipTone, Tone> = {
  neutral: "neutral",
  muted: "muted",
  info: "info",
  warning: "warning",
  success: "success",
  danger: "danger",
  primary: "info",
  gold: "neutral",
};

const specialTones: Partial<Record<ChipTone, string>> = {
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
        specialTones[tone] ?? toneBadgeClass[toneMap[tone]],
        className,
      )}
    >
      {children}
    </span>
  );
}
