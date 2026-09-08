import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

const CONTROL_PATH = "/sys-x9k2-control";

async function fetchKillSwitch() {
  const { data } = await supabase
    .from("site_kill_switch")
    .select("locked,message")
    .eq("id", 1)
    .maybeSingle();
  return data ?? { locked: false, message: "" };
}

export function KillSwitchGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQuery({
    queryKey: ["site-kill-switch"],
    queryFn: fetchKillSwitch,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Always let the hidden control route render so the owner can unlock.
  if (pathname.startsWith(CONTROL_PATH)) return <>{children}</>;

  if (data?.locked) {
    return (
      <div
        dir="rtl"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <div className="max-w-md px-6 text-center">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full border border-white/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">الخدمة متوقفة</h1>
          <p className="mt-3 text-sm leading-7 text-white/70">
            {data.message || "الموقع متوقف مؤقتاً. يرجى التواصل مع المالك."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
