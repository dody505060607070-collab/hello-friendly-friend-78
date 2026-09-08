import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { FileText, Home, LogOut, Receipt, User } from "lucide-react";

import logoAsset from "@/assets/mithra-logo-transparent.png.asset.json";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/portal")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: PortalLayout,
});

function PortalLayout() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const name = (user.user_metadata?.["full_name"] as string | undefined) ?? "العميل";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const link = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white";
  const active = "bg-white/15 text-white";

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-l from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.75)] text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 p-1">
              <img src={logoAsset.url} alt="مثراء العقارية" className="h-full w-full object-contain" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold">مثراء العقارية</p>
              <p className="text-[11px] text-white/70">بوابة العميل</p>
            </div>
          </div>


          <nav className="flex flex-1 items-center justify-center gap-1">
            <Link to="/portal" activeOptions={{ exact: true }} className={link} activeProps={{ className: `${link} ${active}` }}>
              <Home className="h-4 w-4" /> الرئيسية
            </Link>
            <Link to="/portal/contracts" className={link} activeProps={{ className: `${link} ${active}` }}>
              <FileText className="h-4 w-4" /> العقود
            </Link>
            <Link to="/portal/invoices" className={link} activeProps={{ className: `${link} ${active}` }}>
              <Receipt className="h-4 w-4" /> الفواتير
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold">
              <User className="h-3.5 w-3.5" /> {name}
            </span>
            <button onClick={signOut} className="flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
              <LogOut className="h-3.5 w-3.5" /> خروج
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
