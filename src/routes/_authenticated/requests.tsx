import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, formatDate } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { CardsSkeleton } from "@/components/kit/Skeletons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "كل الطلبات | مثراء العقارية" },
      { name: "description", content: "شاشة موحدة لكل الطلبات الواردة وسجلها." },
      { property: "og:title", content: "كل الطلبات | مثراء العقارية" },
      { property: "og:description", content: "طلبات الخدمات والصيانة والعرض والتوفير في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

type Kind = "supply" | "listing" | "maintenance" | "service";
type Item = { id: string; kind: Kind; name: string; phone: string; summary: string; status: string; date: string; link: string };

const kindLabels: Record<Kind, string> = { supply: "توفير عقار", listing: "عرض عقار", maintenance: "صيانة", service: "خدمات" };
const closed = ["done", "completed", "closed", "approved", "published", "cancelled", "rejected", "converted", "paid"];
const statusLabels: Record<string, string> = {
  new: "جديد", pending: "قيد الانتظار", in_progress: "قيد التنفيذ", reviewing: "قيد المراجعة", approved: "معتمد",
  published: "منشور", done: "منجز", completed: "مكتمل", closed: "مغلق", cancelled: "ملغى", rejected: "مرفوض",
};

function RequestsPage() {
  const [kind, setKind] = useState("all");
  const [state, setState] = useState("open");
  const query = useQuery({
    queryKey: ["unified-requests"],
    queryFn: async () => {
      const [s, l, m, sp] = await Promise.all([
        supabase.from("supply_requests").select("id,full_name,phone,property_type,status,created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("listing_requests").select("id,full_name,phone,property_type,status,created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("maintenance_requests").select("id,reporter_name,reporter_phone,description,status,created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("service_partner_requests").select("id,customer_name,customer_phone,service_type,details,status,created_at").order("created_at", { ascending: false }).limit(300),
      ]);
      const items: Item[] = [
        ...(s.data ?? []).map((r) => ({ id: `s-${r.id}`, kind: "supply" as const, name: r.full_name, phone: r.phone, summary: r.property_type ?? "", status: r.status, date: r.created_at, link: `/supply-requests/${r.id}` })),
        ...(l.data ?? []).map((r) => ({ id: `l-${r.id}`, kind: "listing" as const, name: r.full_name, phone: r.phone, summary: r.property_type ?? "", status: r.status, date: r.created_at, link: `/listing-requests/${r.id}` })),
        ...(m.data ?? []).map((r) => ({ id: `m-${r.id}`, kind: "maintenance" as const, name: r.reporter_name, phone: r.reporter_phone, summary: r.description, status: r.status, date: r.created_at, link: "/maintenance" })),
        ...(sp.data ?? []).map((r) => ({ id: `p-${r.id}`, kind: "service" as const, name: r.customer_name, phone: r.customer_phone, summary: `${r.service_type} — ${r.details}`, status: r.status, date: r.created_at, link: "/service-partners" })),
      ];
      return items.sort((a, b) => b.date.localeCompare(a.date));
    },
  });

  const all = query.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const i of all) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [all]);
  const openCount = all.filter((i) => !closed.includes(i.status)).length;
  const list = all
    .filter((i) => kind === "all" || i.kind === kind)
    .filter((i) => state === "all" || (state === "open" ? !closed.includes(i.status) : closed.includes(i.status)));

  return (
    <>
      <PageHero title="كل الطلبات" subtitle="كل الطلبات الواردة وسجلها في مكان واحد، مع الفرز حسب النوع والحالة." icon={Inbox}
        stats={[{ value: String(openCount), label: "طلبات مفتوحة" }, { value: String(all.length - openCount), label: "مغلقة" }, { value: String(all.length), label: "الإجمالي" }]} />
      <Pills variant="card" defaultKey="all" onChange={setKind} items={[
        { key: "all", label: "الكل", count: counts.all ?? 0 },
        ...(Object.keys(kindLabels) as Kind[]).map((k) => ({ key: k, label: kindLabels[k], count: counts[k] ?? 0 })),
      ]} />
      <Pills defaultKey="open" onChange={setState} items={[{ key: "open", label: "مفتوحة" }, { key: "closed", label: "مغلقة / السجل" }, { key: "all", label: "الكل" }]} />
      {query.isLoading ? <CardsSkeleton count={5} className="lg:grid-cols-1" /> : list.length ? (
        <div className="space-y-2">
          {list.map((i) => (
            <Link key={i.id} to={i.link} className="surface-card flex items-center gap-4 p-4 transition hover:border-primary/30">
              <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-bold text-primary">{kindLabels[i.kind]}</span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[13.5px]">{i.name} <span className="font-normal text-muted-foreground" dir="ltr">{i.phone}</span></strong>
                <span className="line-clamp-1 text-[12px] text-muted-foreground">{i.summary || "—"}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${closed.includes(i.status) ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{statusLabels[i.status] ?? i.status}</span>
              <span className="shrink-0 text-[11.5px] text-muted-foreground">{formatDate(i.date)}</span>
            </Link>
          ))}
        </div>
      ) : <EmptyState text="لا توجد طلبات" hint="غيّر الفلتر لعرض طلبات أخرى." />}
    </>
  );
}
