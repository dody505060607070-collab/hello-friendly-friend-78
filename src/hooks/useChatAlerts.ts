import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

/** فتح الصوت بعد أول تفاعل من المستخدم حتى يعمل التنبيه لاحقًا والتبويب في الخلفية. */
function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.00001, ctx.currentTime);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.01);
}

/** نغمة تنبيه قصيرة بدون ملفات صوت خارجية. */
function playChime() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // ضاغط بسيط لرفع الصوت المسموع بدون تشويه
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, now);
    comp.ratio.setValueAtTime(12, now);
    comp.connect(ctx.destination);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1.0, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    gain.connect(comp);

    // نغمتان متكررتان أقوى وأوضح
    [880, 1180, 880, 1320].forEach((freq, i) => {
      const t = now + i * 0.16;
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "triangle" : "square";
      osc.frequency.setValueAtTime(freq, t);
      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.9, t);
      oGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(oGain);
      oGain.connect(gain);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch {
    /* تجاهل */
  }
}

/** إشعار نظام يظهر حتى لو التبويب في الخلفية. */
function systemNotify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: "mithra-chat",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    if ("vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* تجاهل */
  }
}

async function senderName(id: string | null | undefined) {
  if (!id) return "زميل";
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? "زميل";
}

/** إشعار وصوت لأي رسالة جديدة في شات الموظفين أو محادثات الأنشطة. */
export function useChatAlerts() {
  const { userId } = useCurrentUser();
  const qc = useQueryClient();
  const meRef = useRef<string | undefined>(undefined);
  meRef.current = userId;

  // إذن إشعارات المتصفح + فتح الصوت بعد أول تفاعل
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    const onInteract = () => unlockAudio();
    window.addEventListener("pointerdown", onInteract, { once: true });
    window.addEventListener("keydown", onInteract, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    const notify = async (senderId: string | null, body: string | null, source: string) => {
      if (!senderId || senderId === meRef.current) return;
      const name = await senderName(senderId);
      const text = (body ?? "مرفق جديد").slice(0, 120);
      playChime();
      if (document.hidden) systemNotify(`${name} — ${source}`, text);
      toast.message(`${name} — ${source}`, { description: text });
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
