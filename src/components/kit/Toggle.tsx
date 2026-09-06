import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
        checked ? "border-primary bg-primary" : "border-border bg-muted",
        disabled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute size-[18px] rounded-full bg-card shadow-sm transition-all",
          checked ? "start-1" : "end-1",
        )}
      />
    </button>
  );
}
