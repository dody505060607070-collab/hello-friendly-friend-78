import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const boxSize: Record<Size, string> = {
  sm: "size-8 rounded-lg",
  md: "size-10 rounded-xl",
  lg: "size-12 rounded-xl",
};

const iconSize: Record<Size, string> = {
  sm: "size-4",
  md: "size-[18px]",
  lg: "size-6",
};

/** Brand-tinted icon container used across the app instead of plain grey icons. */
export function IconBox({
  icon: Icon,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center border border-primary/20 bg-primary/10 text-primary",
        boxSize[size],
        className,
      )}
    >
      <Icon className={iconSize[size]} />
    </span>
  );
}
