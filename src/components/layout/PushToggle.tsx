import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string> = {
  enabled: "تم تفعيل إشعارات الهاتف — هتوصلك حتى لو التطبيق مقفول.",
  denied: "الإشعارات مرفوضة من المتصفح. فعّلها من إعدادات الموقع في المتصفح.",
  "open-in-new-tab": "افتح الموقع في تبويب مستقل (أو من الشاشة الرئيسية) لتفعيل الإشعارات.",
  unsupported: "المتصفح الحالي لا يدعم الإشعارات. على iPhone أضف الموقع للشاشة الرئيسية أولًا.",
  "not-configured": "إعدادات الإشعارات غير مكتملة على الخادم.",
};

export function PushToggle() {
  const { status, enable } = usePushNotifications();
  const active = status === "enabled";

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await enable().catch(() => "unsupported" as const);
        const msg = MESSAGES[result] ?? "";
        if (result === "enabled") toast.success(msg);
        else if (msg) toast.error(msg);
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full transition-colors hover:bg-accent",
        active ? "text-primary" : "text-muted-foreground hover:text-accent-foreground",
      )}
      aria-label="تفعيل إشعارات الهاتف"
      title={active ? "إشعارات الهاتف مفعّلة" : "تفعيل إشعارات الهاتف"}
    >
      <BellRing className="size-[18px]" />
    </button>
  );
}
