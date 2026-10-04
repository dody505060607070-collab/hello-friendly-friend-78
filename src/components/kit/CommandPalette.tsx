import { useNavigate } from "@tanstack/react-router";
import { Building2, FileText, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { navGroups } from "@/data/nav";
import { supabase } from "@/integrations/supabase/client";

type Hit = { id: string; label: string; sub?: string | undefined; to: string };

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<{ properties: Hit[]; contacts: Hit[]; contracts: Hit[] }>({
    properties: [],
    contacts: [],
    contracts: [],
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits({ properties: [], contacts: [], contracts: [] });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const like = `%${q}%`;
      const [props, contacts, contracts] = await Promise.all([
        supabase.from("properties").select("id, code, name, city").or(`name.ilike.${like},code.ilike.${like}`).limit(6),
        supabase.from("contacts").select("id, full_name, phone").or(`full_name.ilike.${like},phone.ilike.${like}`).limit(6),
        supabase.from("contracts").select("id, contract_number").ilike("contract_number", like).limit(6),
      ]);
      if (cancelled) return;
      setHits({
        properties: (props.data ?? []).map((p) => ({
          id: p.id,
          label: p.name,
          sub: [p.code, p.city].filter(Boolean).join(" · "),
          to: `/properties/${p.code}`,
        })),
        contacts: (contacts.data ?? []).map((c) => ({
          id: c.id,
          label: c.full_name,
          sub: c.phone ?? undefined,
          to: `/owners/${c.id}`,
        })),
        contracts: (contracts.data ?? []).map((c) => ({
          id: c.id,
          label: `عقد ${c.contract_number}`,
          to: `/contracts/${c.id}`,
        })),
      });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  const goto = (to: string) => {
    setOpen(false);
    setTerm("");
    navigate({ to } as never);
  };

  const pages = navGroups.flatMap((g) => g.items);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={term}
        onValueChange={setTerm}
        placeholder="ابحث عن عقار أو عميل أو عقد أو صفحة…"
      />
      <CommandList dir="rtl">
        <CommandEmpty>لا توجد نتائج</CommandEmpty>

        {hits.properties.length ? (
          <CommandGroup heading="العقارات">
            {hits.properties.map((h) => (
              <CommandItem key={h.id} value={`prop-${h.label}-${h.id}`} onSelect={() => goto(h.to)}>
                <Building2 className="size-4 text-primary" />
                <span>{h.label}</span>
                {h.sub ? <span className="ms-auto text-[11.5px] text-muted-foreground">{h.sub}</span> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {hits.contacts.length ? (
          <CommandGroup heading="العملاء والملاك">
            {hits.contacts.map((h) => (
              <CommandItem key={h.id} value={`c-${h.label}-${h.id}`} onSelect={() => goto(h.to)}>
                <Users className="size-4 text-primary" />
                <span>{h.label}</span>
                {h.sub ? <span className="ms-auto text-[11.5px] text-muted-foreground">{h.sub}</span> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {hits.contracts.length ? (
          <CommandGroup heading="العقود">
            {hits.contracts.map((h) => (
              <CommandItem key={h.id} value={`ct-${h.label}-${h.id}`} onSelect={() => goto(h.to)}>
                <FileText className="size-4 text-primary" />
                <span>{h.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading="الصفحات">
          {pages.map((p) => (
            <CommandItem key={p.to} value={`page-${p.label}`} onSelect={() => goto(p.to)}>
              <Search className="size-4 text-muted-foreground" />
              <span>{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
