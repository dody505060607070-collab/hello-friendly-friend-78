import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";

/** نغمة تنبيه قصيرة بدون ملفات صوت خارجية. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gain.connect(ctx.destination);

    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.13);
      osc.connect(gain);
      osc.start(now + i * 0.13);
      osc.stop(now + i * 0.13 + 0.25);
    });

    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    /* المتصفح منع الصوت قبل تفاعل المستخدم */
  }
}

async function senderName(id: string | null | undefined) {
  if (!id) return "زميل";
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? "زميل";
}

/** إشعار وصوت لأي رسالة جديدة في شات الموظفين أو محادثات الأنشطة. */
export function useChatAlerts() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const meRef = useRef<string | undefined>(undefined);
  meRef.current = user?.id;

  useEffect(() => {
    const notify = async (senderId: string | null, body: string | null, source: string) => {
      if (!senderId || senderId === meRef.current) return;
      const name = await senderName(senderId);
      playChime();
      toast.message(`${name} — ${source}`, {
        description: (body ?? "مرفق جديد").slice(0, 120),
      });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["nav-counts"] });
    };

    const channel = supabase
      .channel("chat-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        (payload) => {
          const row = payload.new as { sender_id: string; body: string | null };
          void notify(row.sender_id, row.body, "شات الموظفين");
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_messages" },
        (payload) => {
          const row = payload.new as { sender_id: string; body: string | null };
          void notify(row.sender_id, row.body, "محادثة خاصة");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
