/**
 * Unified row/status color system for all tables (tasks, invoices, contracts, reservations).
 * Tones map to semantic design tokens only — never hardcoded colors.
 */
export type Tone = "danger" | "warning" | "success" | "muted" | "info" | "neutral";

export const toneRowClass: Record<Tone, string> = {
  danger: "bg-destructive/8 hover:bg-destructive/12",
  warning: "bg-warning/12 hover:bg-warning/18",
  success: "bg-success/10 hover:bg-success/15",
  muted: "bg-muted/60 text-muted-foreground hover:bg-muted",
  info: "bg-primary/8 hover:bg-primary/12",
  neutral: "",
};

export const toneBadgeClass: Record<Tone, string> = {
  danger: "border-destructive/30 bg-destructive/12 text-destructive",
  warning: "border-warning/40 bg-warning/18 text-warning-foreground",
  success: "border-success/30 bg-success/14 text-success",
  muted: "border-border bg-muted text-muted-foreground",
  info: "border-primary/30 bg-primary/10 text-primary",
  neutral: "border-border bg-card text-foreground",
};

export const toneDotClass: Record<Tone, string> = {
  danger: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  muted: "bg-muted-foreground/50",
  info: "bg-primary",
  neutral: "bg-border",
};

const DONE = ["completed", "done", "approved", "paid", "closed", "signed", "sent", "converted", "won"];
const CANCELLED = ["cancelled", "canceled", "expired", "archived", "terminated", "stopped", "closed_lost"];
const OVERDUE = ["overdue", "late", "failed", "rejected", "unpaid_overdue"];
const ACTIVE = ["active", "hold", "new", "in_progress", "pending", "unpaid", "partial", "submitted", "draft"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Decide the tone for a record based on status + due date.
 * red = overdue, orange = due today, green = done/paid, grey = cancelled.
 */
export function rowTone(status?: string | null, dueDate?: string | null): Tone {
  const s = (status ?? "").toLowerCase();
  if (CANCELLED.includes(s)) return "muted";
  if (DONE.includes(s)) return "success";
  if (OVERDUE.includes(s)) return "danger";

  if (dueDate) {
    const due = startOfDay(new Date(dueDate));
    const today = startOfDay(new Date());
    if (!Number.isNaN(due)) {
      if (due < today) return "danger";
      if (due <= today + 2 * 24 * 60 * 60 * 1000) return "warning";
    }
  }
  if (ACTIVE.includes(s)) return "info";
  return "neutral";
}

/** Reservations stay primary while active and become muted after cancellation/expiry. */
export function reservationTone(status?: string | null): Tone {
  const s = (status ?? "").toLowerCase();
  if (s === "converted") return "success";
  if (s === "cancelled" || s === "expired") return "muted";
  if (s === "hold" || s === "active") return "info";
  return "neutral";
}

export const legendItems: { tone: Tone; label: string }[] = [
  { tone: "danger", label: "متأخر / فشل" },
  { tone: "warning", label: "اليوم / خلال يومين" },
  { tone: "success", label: "مكتمل / مدفوع" },
  { tone: "info", label: "نشط / قيد التنفيذ" },
  { tone: "muted", label: "ملغي / منتهي" },
];
