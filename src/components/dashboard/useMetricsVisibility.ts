import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mithra-dashboard-metrics-visibility";

/** تفضيلات إظهار/إخفاء مؤشرات لوحة التحكم، محفوظة محليًا على جهاز المستخدم. */
export function useMetricsVisibility(allKeys: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(raw)) setHidden(new Set(raw.filter((v): v is string => typeof v === "string")));
    } catch {
      /* تجاهل */
    }
  }, []);

  const toggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const isVisible = useCallback((key: string) => !hidden.has(key), [hidden]);

  return { isVisible, toggle, hidden, allKeys };
}
