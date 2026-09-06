import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import logoAsset from "@/assets/mithra-logo.png.asset.json";
import { useSession } from "@/hooks/useAuth";
import { COMPANY_EMAIL, COMPANY_PHONE, whatsappLink } from "@/lib/site-data";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "الرئيسية" },
  { to: "/rent", label: "قسم الإيجار" },
  { to: "/sale", label: "قسم البيع" },
  { to: "/about", label: "من نحن" },
  { to: "/contact", label: "تواصل معنا" },
] as const;

function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex h-[74px] max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <Link
            to="/list-property"
            className="hidden rounded-lg border border-primary-foreground/35 px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-primary-foreground/10 md:inline-flex"
          >
            اعرض | اطلب عقارك
          </Link>
          <Link
            to={session ? "/dashboard" : "/auth"}
            className="hidden rounded-lg bg-gold px-4 py-2 text-[13px] font-bold text-gold-foreground transition-opacity hover:opacity-90 sm:inline-flex"
          >
            {session ? "لوحة التحكم" : "تسجيل الدخول"}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
            className="grid size-9 place-items-center rounded-lg border border-primary-foreground/30 lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative py-1 text-[14px] transition-opacity hover:opacity-100",
                pathname === item.to
                  ? "font-bold opacity-100 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-gold"
                  : "opacity-80",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link to="/" aria-label="مثراء العقارية">
          <img src={logoAsset.url} alt="مثراء العقارية" width={1152} height={576} className="h-10 w-auto" />
        </Link>
      </div>

      {open ? (
        <nav className="border-t border-primary-foreground/15 lg:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-3">
            {navLinks.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-2.5 text-[14px] hover:bg-primary-foreground/10"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/list-property"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-2.5 text-[14px] hover:bg-primary-foreground/10"
              >
                اعرض | اطلب عقارك
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
        <div>
          <h3 className="border-e-4 border-gold pe-3 text-[17px] font-bold">مثراء العقارية</h3>
          <p className="mt-4 text-[13.5px] leading-7 opacity-80">
            مثراء العقارية شركة رائدة في سوق العقارات بـبريدة منذ أكثر من 8 سنوات، نقدم أفضل
            الخيارات السكنية والتجارية بخبرة واحترافية عالية.
          </p>
        </div>

        <div>
          <h3 className="border-e-4 border-gold pe-3 text-[17px] font-bold">روابط سريعة</h3>
          <ul className="mt-4 space-y-2.5 text-[13.5px] opacity-85">
            {[...navLinks.slice(1), { to: "/list-property", label: "اعرض | اطلب عقارك" }].map(
              (item) => (
                <li key={item.to} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  <Link to={item.to} className="hover:opacity-100">
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>

        <div>
          <h3 className="border-e-4 border-gold pe-3 text-[17px] font-bold">تواصل معنا</h3>
          <ul className="mt-4 space-y-3 text-[13.5px] opacity-85">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-gold" />
              <a href={`tel:${COMPANY_PHONE}`} dir="ltr">
                {COMPANY_PHONE}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-gold" />
              <a href={`mailto:${COMPANY_EMAIL}`} dir="ltr">
                {COMPANY_EMAIL}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-gold" />
              بريدة، المملكة العربية السعودية
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-gold" />
              من السبت للخميس 9ص — 10م
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-primary-foreground/15 py-5 text-center text-[12.5px] opacity-70">
        جميع الحقوق محفوظة © {new Date().getFullYear()} — مؤسسة مثراء
      </div>
    </footer>
  );
}

function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("cookie-consent") !== "accepted") setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-4 shadow-float">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
        <p className="flex-1 text-[13px] leading-6 text-muted-foreground">
          نستخدم ملفات تعريف الارتباط (Cookies) لتحسين تجربتك وتذكّر تفضيلاتك أثناء تصفح العقارات.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            لاحقاً
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground"
          >
            موافق
          </button>
        </div>
      </div>
    </div>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <a
        href={whatsappLink(null, "مرحباً، لدي استفسار عقاري")}
        target="_blank"
        rel="noreferrer"
        aria-label="تواصل عبر واتساب"
        className="fixed bottom-24 start-4 z-40 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-float"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.35-.53.05-1.02.07-2.87-.6-2.2-.8-3.6-3.1-3.71-3.25-.11-.15-.9-1.2-.9-2.29 0-1.09.57-1.62.77-1.85.2-.23.44-.28.59-.28l.42.01c.14 0 .32-.05.5.38.18.44.62 1.53.67 1.64.06.11.09.24.02.39-.08.15-.15.24-.29.38-.14.14-.22.24-.32.39-.11.15-.23.32-.1.62.13.3.58 1.02 1.24 1.62.85.76 1.45.98 1.7 1.09.24.11.42.1.58-.06.15-.15.66-.77.84-1.03.18-.27.36-.22.6-.13.24.09 1.53.72 1.79.85.26.13.44.2.5.31.06.11.06.66-.18 1.34Z" />
        </svg>
      </a>
      <CookieBanner />
    </div>
  );
}
