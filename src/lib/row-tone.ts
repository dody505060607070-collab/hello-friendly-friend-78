/**
 * نظام ألوان موحّد للصفوف: الصف كله يتلوّن حسب حالته
 * (متأخر = أحمر، اليوم = برتقالي، عاجل = أحمر خفيف، منجز = أخضر…)
 */
export type RowTone = "overdue" | "today" | "urgent" | "done" | "new" | "progress" | "none";

export const rowToneClass: Record<RowTone, string> = {
  overdue: "bg-destructive/12 text-destructive hover:bg-destructive/18 [&_td]:text-destructive [&_td]:font-semibold",
  today: "bg-warning/14 hover:bg-warning/20 [&_td]:font-semibold",
  urgent: "bg-destructive/7 hover:bg-destructive/12",
  done: "bg-success/10 hover:bg-success/16",
  new: "bg-success/6 hover:bg-success/12",
  progress: "bg-primary/6 hover:bg-primary/12",
  none: "",
};

export const rowToneLabel: Record<RowTone, string> = {
  overdue: "متأخرة — تجاوزت موعد التسليم",
  today: "تُسلَّم اليوم",
  urgent: "أولوية عاجلة",
  done: "منجزة / معتمدة",
  new: "جديدة",
  progress: "قيد التنفيذ",
  none: "عادية",
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export function taskRowTone(row: {
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
}): RowTone {
  const status = row.status ?? "";
  if (status === "done" || status === "approved") return "done";
  if (row.due_date) {
    const due = new Date(row.due_date);
    due.setHours(0, 0, 0, 0);
    const today = startOfToday();
    if (due.getTime() < today.getTime()) return "overdue";
    if (due.getTime() === today.getTime()) return "today";
  }
  if (row.priority === "urgent" || row.priority === "high") return "urgent";
  if (status === "in_progress" || status === "submitted") return "progress";
  if (status === "new") return "new";
  return "none";
}

/** عام: أي سجل له تاريخ استحقاق وحالة سداد/إغلاق */
export function dueRowTone(row: {
  status?: string | null;
  due_date?: string | null;
  paid?: boolean | null;
}): RowTone {
  if (row.paid || row.status === "paid" || row.status === "closed" || row.status === "done")
    return "done";
  if (row.due_date) {
    const due = new Date(row.due_date);
    due.setHours(0, 0, 0, 0);
    const today = startOfToday();
    if (due.getTime() < today.getTime()) return "overdue";
    if (due.getTime() === today.getTime()) return "today";
  }
  return "none";
}
