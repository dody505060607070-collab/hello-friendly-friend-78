import { useCallback, useEffect, useState } from "react";

const FAV_KEY = "mithra-favorites";
const RECENT_KEY = "mithra-recent";
const EVENT = "mithra-storage";

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(EVENT));
}

function useStoredList(key: string) {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setList(read(key));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  return list;
}

/** قائمة المفضلة (محفوظة على جهاز الزائر). */
export function useFavorites() {
  const favorites = useStoredList(FAV_KEY);

  const toggle = useCallback((code: string) => {
    const current = read(FAV_KEY);
    write(FAV_KEY, current.includes(code) ? current.filter((c) => c !== code) : [code, ...current]);
  }, []);

  const clear = useCallback(() => write(FAV_KEY, []), []);

  return { favorites, toggle, clear, isFavorite: (code: string) => favorites.includes(code) };
}

/** آخر العقارات التي شاهدها الزائر. */
export function useRecentlyViewed() {
  return useStoredList(RECENT_KEY);
}

export function recordView(code: string) {
  if (typeof window === "undefined") return;
  const current = read(RECENT_KEY).filter((c) => c !== code);
  write(RECENT_KEY, [code, ...current].slice(0, 8));
}
