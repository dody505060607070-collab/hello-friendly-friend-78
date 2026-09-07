import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div
        className={cn(
          "relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-foreground">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-start gap-3 border-t border-border bg-muted/30 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-[12.5px] font-semibold text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[11.5px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}


export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40";

export const textareaClass =
  "min-h-[90px] w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40";

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      {children}
    </button>
  );
}
