import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, CornerDownLeft, FileText, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { navGroups } from "@/data/nav";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  hint?: string;
  to: string;
  group: string;
  icon: typeof Search;
};

const navItems: Item[] = navGroups.flatMap((g) =>
  g.items.map((i) => ({
    id: `nav-${i.to}-${i.label}`,
    label: i.label,
    to: i.to,
    group: g.label ?? "التنقّل",
    icon: g.icon ?? Search,
  })),
);

/** بحث سريع بالكيبورد — Ctrl/Cmd + K */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = query.trim();

  const remote = useQuery({
    queryKey: ["command-palette", term],
    enabled: open && term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`;
      const [props, contacts, contracts] = await Promise.all([
        supabase
          .from("properties")
          .select("id, name, code")
          .or(`name.ilike.${like},code.ilike.${like}`)
          .limit(5),
        supabase
          .from("contacts")
          .select("id, full_name, phone")
          .or(`full_name.ilike.${like},phone.ilike.${like}`)
          .limit(5),
        supabase
          .from("contracts")
          .select("id, contract_number")
          .ilike("contract_number", like)
          .limit(5),
      ]);

      const list: Item[] = [];
      for (const p of props.data ?? [])
        list.push({
          id: `p-${p.id}`,
          label: p.name,
          hint: p.code ?? undefined,
          to: "/properties",
          group: "العقارات",
          icon: Building2,
        });
      for (const c of contacts.data ?? [])
        list.push({
          id: `c-${c.id}`,
          label: c.full_name,
          hint: c.phone ?? undefined,
          to: "/clients",
          group: "العملاء",
          icon: Users,
        });
      for (const k of contracts.data ?? [])
        list.push({
          id: `k-${k.id}`,
          label: `عقد ${k.contract_number}`,
          to: "/contracts",
          group: "العقود",
          icon: FileText,
        });
      return list;
    },
  });

  const results = useMemo(() => {
    const local = term
      ? navItems.filter((i) => i.label.includes(term) || i.to.includes(term.toLowerCase()))
      : navItems.slice(0, 8);
    return [...local, ...(remote.data ?? [])].slice(0, 14);
  }, [term, remote.data]);

  useEffect(() => setCursor(0), [term]);

  if (!open) return null;

  const go = (item: Item) => {
    setOpen(false);
    setQuery("");
    void navigate({ to: item.to });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-foreground/40 px-4 pt-[12vh] backdrop-blur-sm"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-float">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              }
              if (e.key === "Enter" && results[cursor]) go(results[cursor]!);
            }}
            placeholder="ابحث عن صفحة أو عقار أو عميل أو عقد…"
            className="h-14 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              لا توجد نتائج مطابقة
            </p>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors",
                    i === cursor ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{item.label}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {item.group}
                      {item.hint ? ` · ${item.hint}` : ""}
                    </span>
                  </span>
                  {i === cursor ? (
                    <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** زر يفتح البحث السريع للمستخدمين الذين لا يستعملون الكيبورد */
export function CommandPaletteButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
        )
      }
      className="hidden h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted md:inline-flex"
      title="بحث سريع (Ctrl + K)"
    >
      <Search className="size-4" />
      بحث سريع
      <kbd className="rounded border border-border px-1 text-[10.5px]">Ctrl K</kbd>
    </button>
  );
}
