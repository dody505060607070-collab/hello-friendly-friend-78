import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

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
  const [state, setState] = useState<{ locked: boolean; message: string; loading: boolean }>({
    locked: false,
    message: "",
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    fetchKillSwitch()
      .then((data) => {
        if (!mounted) return;
        setState({ locked: Boolean(data.locked), message: data.message || "", loading: false });
      })
      .catch(() => {
        if (!mounted) return;
        setState({ locked: false, message: "", loading: false });
      });
    const id = setInterval(() => {
      fetchKillSwitch().then((data) => {
        if (!mounted) return;
        setState({ locked: Boolean(data.locked), message: data.message || "", loading: false });
      });
    }, 15_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Always let the hidden control route render immediately so the owner can unlock.
  if (pathname.startsWith(CONTROL_PATH)) return <>{children}</>;

  if (state.loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/70">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  if (state.locked) {
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
            {state.message || "الموقع متوقف مؤقتاً. يرجى التواصل مع المالك."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
