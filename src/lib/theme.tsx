import { createContext, useContext, useEffect, type ReactNode } from "react";

// Night mode removed on request: the site is always light.
type Theme = "light";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>(
  { theme: "light", setTheme: () => {}, toggle: () => {} },
);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
    try {
      window.localStorage.removeItem("mithraa-theme");
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <ThemeContext.Provider value={{ theme: "light", setTheme: () => {}, toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle(_props: { className?: string; showLabel?: boolean }) {
  return null;
}
