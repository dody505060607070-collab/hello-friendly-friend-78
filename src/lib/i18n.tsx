import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import generatedEnglish from "./translations.en.json";

export type Lang = "ar" | "en";

const STORAGE_KEY = "mithraa-lang";

/** قاموس الترجمة: المفتاح هو النص العربي الأصلي. */
const EN: Record<string, string> = {
  ...(generatedEnglish as Record<string, string>),
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
  "اكتشف": "Discover",
  "دليل المناطق": "Area guide",
  "استكشف المناطق العقارية": "Explore real estate areas",
  "اكتشف عقارات المنطقة": "Discover properties in this area",
  "اختر المنطقة المناسبة وشاهد العقارات المتاحة فيها مباشرة.": "Choose an area and view its available properties.",
  "عقار متاح": "available property",
  "عقارات متاحة": "available properties",
  "كل العروض": "All listings",
  "كل أنواع العقارات": "All property types",
  "كل الأحياء": "All districts",
  "أحدث عقارات الإيجار": "Latest rental properties",
  "أحدث عقارات البيع": "Latest properties for sale",
  "عرض الكل": "View all",
  "خدماتنا": "Our services",
  "تصنيفات نغطيها في بريدة": "Property categories in Buraidah",
  "جولة بصرية": "Visual tour",
  "عقار على الخريطة": "properties on the map",
  "عندك عقار للإيجار أو البيع؟": "Have a property to rent or sell?",
  "لاحقاً": "Later",
  "موافق": "Accept",
  "عمارة": "Building",
  "الصفاء": "Al-Safa",
  "قلب القصيم ووجهة للسكن والاستثمار العقاري.": "The heart of Al-Qassim for homes and property investment.",
  "نغطي رحلة العقار كاملة: العرض، التفاوض، العقد، ثم المتابعة والتحصيل.": "We manage the complete property journey: listing, negotiation, contracts, follow-up, and collection.",
  "لمحات من العقارات والأحياء التي نعمل بها.": "A visual glimpse of the properties and neighborhoods we serve.",
  "أرسل تفاصيل عقارك وسيتواصل معك فريقنا لتقييمه وعرضه على العملاء المناسبين.": "Send your property details and our team will contact you to evaluate and present it to suitable clients.",
  "مثراء العقارية — إيجار وبيع وإدارة أملاك في بريدة، القصيم.": "Mithraa Real Estate — leasing, sales, and property management in Buraidah, Al-Qassim.",
  "السبت — الخميس 9ص — 10م": "Saturday–Thursday, 9 AM–10 PM",
  "جميع الحقوق محفوظة © 2026 — مؤسسة مثراء": "All rights reserved © 2026 — Mithraa Establishment",
  "نستخدم ملفات تعريف الارتباط (Cookies) لتحسين تجربتك وتذكّر تفضيلاتك أثناء تصفح العقارات.": "We use cookies to improve your experience and remember your preferences while browsing properties.",
  "اعرض | اطلب عقارك": "List or request a property",
  "لا توجد عقارات بيع معروضة حالياً.": "No properties are currently listed for sale.",
  "لا توجد عقارات إيجار معروضة حالياً.": "No rental properties are currently listed.",
  "سكني مفروش وجاهز": "Furnished, move-in-ready homes",
  "شقق وفلل بتشطيب حديث جاهزة للسكن الفوري.": "Modern apartments and villas ready for immediate occupancy.",
  "تجاري ومكاتب": "Commercial spaces and offices",
  "معارض ومكاتب في مواقع حيوية بمداخل مستقلة.": "Showrooms and offices in prime locations with private entrances.",
  "أراضٍ واستثمار": "Land and investment",
  "أراضٍ سكنية وتجارية بفرص نمو حقيقية.": "Residential and commercial land with genuine growth potential.",
  "١ عقار متاح": "1 available property",
  "عمارة — الصفاء": "Building — Al-Safa",
  "الصفاء — بريدة": "Al-Safa — Buraidah",
  "عرض التفاصيل": "View details",
  "جميع الحقوق محفوظة © 2026 — مؤسسة مثراء": "All rights reserved © 2026 — Mithraa Establishment",
  "مثراء AI": "Mithraa AI",
};

const arabicPattern = /[\u0600-\u06ff]/;
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function translateValue(value: string) {
  const whitespace = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  if (!core || !arabicPattern.test(core)) return value;
  return `${whitespace}${EN[core] ?? core}${trailing}`;
}

function translateDocument(lang: Lang, root: ParentNode = document.body) {
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = textWalker.nextNode();
  while (current) {
    const textNode = current as Text;
    const parent = textNode.parentElement;
    if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
      if (!originalText.has(textNode)) originalText.set(textNode, textNode.data);
      const source = originalText.get(textNode) ?? textNode.data;
      const next = lang === "en" ? translateValue(source) : source;
      if (textNode.data !== next) textNode.data = next;
    }
    current = textWalker.nextNode();
  }

  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) {
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      let originals = originalAttributes.get(element);
      if (!originals) {
        originals = new Map();
        originalAttributes.set(element, originals);
      }
      if (!originals.has(attribute)) originals.set(attribute, value);
      const source = originals.get(attribute) ?? value;
      element.setAttribute(attribute, lang === "en" ? translateValue(source) : source);
    }
  }
}

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
    translateDocument(lang);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentNode) {
          const textNode = mutation.target as Text;
          const saved = originalText.get(textNode);
          if (saved && textNode.data === translateValue(saved)) continue;
          originalText.set(textNode, textNode.data);
          translateDocument(lang, mutation.target.parentNode);
        }
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) translateDocument(lang, node as Element);
          if (node.nodeType === Node.TEXT_NODE && node.parentNode) translateDocument(lang, node.parentNode);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
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
