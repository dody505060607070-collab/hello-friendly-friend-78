import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "mithra-theme";

export type ThemeMode = "light" | "dark";

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as ThemeMode | null) ?? null;
    const initial: ThemeMode =
      saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setMode(initial);
    apply(initial);
  }, []);

  const toggle = () => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  };

  return { mode, toggle };
}

/** زر تبديل الوضع الليلي / النهاري */
export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-label={mode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
      title={mode === "dark" ? "التبديل للوضع النهاري" : "التبديل للوضع الليلي"}
    >
      {mode === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
