import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const STORAGE_KEY = "mithraa-lang";

/** قاموس الترجمة: المفتاح هو النص العربي الأصلي. */
const EN: Record<string, string> = {
  // عام
  "لوحة التحكم": "Dashboard",
  "المساعد الذكي": "AI Assistant",
  "إدارة العقارات": "Property Management",
  العقارات: "Properties",
  "طلبات التقديم": "Listing Requests",
  "إدارة الحجوزات": "Reservations",
  "إدارة الإيجارات": "Leasing",
  الملاك: "Owners",
  "إدارة العقود": "Contracts",
  الفواتير: "Invoices",
  "إدارة التذكيرات": "Reminders",
  المهام: "Tasks",
  "كل المهام": "All Tasks",
  "نظام CRM": "CRM",
  العملاء: "Clients",
  الفرص: "Opportunities",
  "المتابعات والأنشطة": "Activities & Follow-ups",
  "شات الموظفين": "Team Chat",
  التقارير: "Reports",
  "إعدادات الموقع": "Site Settings",
  الشركاء: "Partners",
  الخدمات: "Services",
  الإدارة: "Administration",
  الموظفون: "Employees",
  "الأدوار والصلاحيات": "Roles & Permissions",
  "سجل الأنشطة": "Activity Log",
  "سجل الأخطاء": "Error Log",
  الإشعارات: "Notifications",
  CRM: "CRM",

  // إجراءات
  بحث: "Search",
  إضافة: "Add",
  تعديل: "Edit",
  حذف: "Delete",
  حفظ: "Save",
  إلغاء: "Cancel",
  إغلاق: "Close",
  عرض: "View",
  تصدير: "Export",
  إرسال: "Send",
  "تسجيل الخروج": "Sign out",
  "الملف الشخصي": "Profile",

  // الموقع العام
  "الصفحة الرئيسية": "Home",
  الرئيسية: "Home",
  إيجار: "Rent",
  بيع: "Sale",
  "من نحن": "About",
  "تواصل معنا": "Contact",
  "اعرض عقارك": "List your property",
  "اطلب عقارك": "Request a property",
  "العقارات على الخريطة": "Properties on the map",
  الكل: "All",
  "عقارات للبيع": "For sale",
  "عقارات للإيجار": "For rent",
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (text: string) => string };

const LangContext = createContext<Ctx>({ lang: "ar", setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ar") setLangState(stored);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((text: string) => (lang === "en" ? (EN[text] ?? text) : text), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  return useContext(LangContext);
}

/** زر تبديل اللغة عربي / English. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      title={lang === "ar" ? "Switch to English" : "التحويل إلى العربية"}
      aria-label="Language"
      className={`rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-bold text-foreground transition-colors hover:bg-accent ${className}`}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
