import { createFileRoute } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "لا يوجد اتصال بالإنترنت — مثراء العقارية" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-muted">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">لا يوجد اتصال بالإنترنت</h1>
        <p className="mt-2 text-[13.5px] leading-7 text-muted-foreground">
          يبدو أنك غير متصل بالشبكة حاليًا. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
