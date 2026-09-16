import { useEffect, useState } from "react";

import { useCurrentUser } from "@/hooks/useAuth";
import { getVapidPublicKey, savePushSubscription } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufferToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushStatus =
  | "idle"
  | "unsupported"
  | "open-in-new-tab"
  | "denied"
  | "not-configured"
  | "enabled";

/** تسجيل الجهاز لاستقبال إشعارات حتى لو التطبيق مقفول. */
export function usePushNotifications() {
  const { userId } = useCurrentUser();
  const [status, setStatus] = useState<PushStatus>("idle");

  const enable = async (): Promise<PushStatus> => {
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return "unsupported";
    }
    if (window.top !== window.self) {
      setStatus("open-in-new-tab");
      return "open-in-new-tab";
    }
    const permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return "denied";
    }

    const { publicKey } = await getVapidPublicKey();
    if (!publicKey) {
      setStatus("not-configured");
      return "not-configured";
    }

    const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    await savePushSubscription({
      data: {
        endpoint: sub.endpoint,
        p256dh: bufferToBase64Url(sub.getKey("p256dh")),
        auth: bufferToBase64Url(sub.getKey("auth")),
        userAgent: navigator.userAgent,
      },
    });
    setStatus("enabled");
    return "enabled";
  };

  // تفعيل تلقائي عند الدخول لو الإذن ممنوح مسبقًا
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    void enable().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { status, enable };
}
