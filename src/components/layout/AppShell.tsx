import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, ChevronLeft } from "lucide-react";
import { useState, type ReactNode } from "react";

import logo from "@/assets/logo.png";
import { navGroups } from "@/data/nav";
import { cn } from "@/lib/utils";

function SidebarNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [closed, setClosed] = useState<string[]>([]);

  const toggle = (label: string) =>
    setClosed((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );

  return (
    <nav className="flex flex-col gap-5 px-4 py-6">
      {navGroups.map((group, gi) => {
        const isOpen = !group.label || !closed.includes(group.label);
        const Icon = group.icon;
        return (
          <div key={group.label ?? gi} className="space-y-1">
            {group.label ? (
              <button
                type="button"
                onClick={() => toggle(group.label!)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] font-semibold text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground"
              >
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
                <span className="flex items-center gap-2">
                  {group.label}
                  {Icon ? <Icon className="size-[18px] text-primary/70" /> : null}
                </span>
              </button>
            ) : null}

            {isOpen ? (
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={cn(
                          "group flex items-center justify-between rounded-lg py-2 pe-2 ps-3 text-[13.5px] transition-colors",
                          active
                            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {item.badge ? (
                            <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-bold text-warning-foreground">
                              {item.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-2.5">
                          {group.label ? (
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                active ? "bg-primary" : "bg-border",
                              )}
                            />
                          ) : null}
                          {!group.label && Icon ? (
                            <Icon className="size-[18px] text-primary/70" />
                          ) : null}
                          {item.label}
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

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
            aria-label="الحساب"
          >
            A
          </button>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="الإشعارات"
          >
            <Bell className="size-[18px]" />
          </button>
        </div>

        <Link to="/" className="absolute left-1/2 -translate-x-1/2">
          <img
            src={logo}
            alt="الرشودي للعقارات"
            width={1152}
            height={576}
            className="h-11 w-auto"
          />
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-[15px] font-bold text-foreground">الرشودي للعقارات</span>
          <ChevronLeft className="size-5 text-muted-foreground" />
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[268px] shrink-0 overflow-y-auto border-s border-sidebar-border bg-sidebar lg:block">
          <SidebarNav />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
