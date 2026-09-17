import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { KillSwitchGate } from "@/components/KillSwitchGate";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/lib/i18n";
import { SITE_URL, SITE_NAME } from "@/lib/site-config";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-extrabold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-bold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-[13.5px] leading-7 text-muted-foreground">
          الرابط الذي فتحته غير صحيح أو تم نقل الصفحة. جرّب أحد الأقسام التالية:
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {[
            { to: "/", label: "الرئيسية" },
            { to: "/rent", label: "قسم الإيجار" },
            { to: "/sale", label: "قسم البيع" },
            { to: "/contact", label: "تواصل معنا" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-[13px] font-bold text-foreground transition-colors hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${SITE_NAME} — لوحة الإدارة` },
      {
        name: "description",
        content: "نظام إدارة عقاري متكامل: العقارات، العقود، الفواتير، الملاك والمهام.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: SITE_NAME },
      {
        property: "og:description",
        content: "نظام إدارة عقاري متكامل: العقارات، العقود، الفواتير، الملاك والمهام.",
      },
      { property: "og:url", content: SITE_URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: SITE_NAME },
      { name: "theme-color", content: "#2d4a86" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "canonical", href: SITE_URL },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* Kill switch wraps the entire application shell so 404, errors and every route are blocked when locked. */}
        <KillSwitchGate>{children}</KillSwitchGate>
        <Scripts />
      </body>
    </html>
  );
}

function AppServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/app-sw.js", { scope: "/" }).catch((error) => {
      console.error("app-sw registration failed", error);
    });
  }, []);

  return null;
}

function HomeStructuredData() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/") return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: SITE_NAME,
    url: SITE_URL,
    image: `${SITE_URL}/favicon.png`,
    logo: `${SITE_URL}/favicon.png`,
    areaServed: "SA",
    inLanguage: "ar",
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <AppServiceWorkerRegistrar />
          <HomeStructuredData />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
