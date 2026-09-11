import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import logoAsset from "@/assets/mithra-logo.png.asset.json";
import { navGroups } from "@/data/nav";
import { signOut, useCurrentUser } from "@/hooks/useAuth";
import { navCountsQuery } from "@/lib/counts";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [closed, setClosed] = useState<string[]>([]);
  const { can } = useCurrentUser();
  const { data: counts } = useQuery(navCountsQuery);
  const { t } = useI18n();

  const toggle = (label: string) =>
    setClosed((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );

  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });

  return (
    <nav dir="rtl" className="flex flex-col gap-5 px-4 py-6 text-right">
      {navGroups.map((group, gi) => {
        const items = group.items.filter((item) => !item.module || can(item.module, "view"));
        if (items.length === 0) return null;
        const isOpen = !group.label || !closed.includes(group.label);
        const Icon = group.icon;
        return (
          <div key={group.label ?? gi} className="space-y-1">
            {group.label ? (
              <button
                type="button"
                onClick={() => group.label && toggle(group.label)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[15px] font-bold text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground"
              >
                <span className="flex min-w-0 items-center gap-2 text-right">
                  {Icon ? <Icon className="size-[18px] shrink-0 text-primary/70" /> : null}
                  <span>{t(group.label)}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
            ) : null}

            {isOpen ? (
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const searchMatch = item.search
                    ? Object.entries(item.search).every(([k, v]) => search?.[k] === v)
                    : true;
                  const active = pathname === item.to && searchMatch;
                  const badge = item.countKey ? counts?.[item.countKey] : undefined;
                  return (
                    <li key={item.to + (item.search?.["source"] ?? "")}>
                      <Link
                        to={item.to}
                        {...(item.search ? { search: item.search } : {})}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center justify-between rounded-lg py-2.5 pe-2 ps-3 text-[15.5px] transition-colors",
                          active
                            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5 text-right">
                          {group.label ? (
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                active ? "bg-primary" : "bg-border",
                              )}
                            />
                          ) : null}
                          {!group.label && Icon ? (
                            <Icon className="size-[18px] shrink-0 text-primary/70" />
                          ) : null}
                          <span>{t(item.label)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {badge ? (
                            <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-bold text-warning-foreground">
                              {badge}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

import { AiDock } from "./AiDock";
import { NotificationsBell } from "./NotificationsBell";
import { PushToggle } from "./PushToggle";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, isSuperAdmin } = useCurrentUser();
  const initial = profile?.full_name?.trim().charAt(0) ?? "؟";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background text-[15.5px] leading-relaxed">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-3 md:h-24 md:px-6">
        <div className="relative z-10 flex items-center gap-1 md:gap-2">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
            aria-label="الحساب"
            title={profile?.full_name ?? ""}
          >
            {initial}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <LogOut className="size-[18px]" />
          </button>
          <LanguageToggle />
          <NotificationsBell />
          <PushToggle />
        </div>

        <Link
          to="/dashboard"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 md:pointer-events-auto"
        >
          <img
            src={logoAsset.url}
            alt="مثراء العقارية"
            width={1152}
            height={576}
            className="h-12 w-auto md:h-[124px]"
          />
        </Link>

        <div className="relative z-10 flex items-center gap-3">
          <div className="hidden text-end md:block">
            <p className="text-[14px] font-bold leading-tight text-foreground">
              {profile?.full_name ?? "—"}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {isSuperAdmin ? "مدير عام" : (profile?.job_title ?? "موظف")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
            aria-label="القائمة"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-[268px] shrink-0 overflow-y-auto border-s border-sidebar-border bg-sidebar lg:block">
          <SidebarNav />
        </aside>

        {open ? (
          <div className="fixed inset-0 top-16 z-20 md:top-24 lg:hidden">
            <button
              type="button"
              aria-label="إغلاق القائمة"
              className="absolute inset-0 bg-foreground/30"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 end-0 w-[280px] overflow-y-auto bg-sidebar shadow-xl">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>

        <AiDock />
      </div>
    </div>
  );
}
