import {
  Home,
  Building2,
  Factory,
  CircleCheck,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  badge?: number;
};

export type NavGroup = {
  label?: string;
  icon?: LucideIcon;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    icon: Home,
    items: [{ label: "لوحة التحكم", to: "/" }],
  },
  {
    label: "إدارة العقارات",
    icon: Factory,
    items: [
      { label: "العقارات", to: "/properties" },
      { label: "طلبات التقديم", to: "/submissions" },
      { label: "طلبات توفير عقار", to: "/supply-requests", badge: 97 },
      { label: "إدارة الحجوزات", to: "/reservations" },
    ],
  },
  {
    label: "إدارة الإيجارات",
    icon: Building2,
    items: [
      { label: "الملاك", to: "/owners", badge: 24 },
      { label: "إدارة العقود", to: "/contracts", badge: 23 },
      { label: "الفواتير", to: "/invoices", badge: 2 },
      { label: "إدارة التذكيرات", to: "/reminders", badge: 1 },
    ],
  },
  {
    label: "المهام",
    icon: CircleCheck,
    items: [{ label: "المهام", to: "/tasks", badge: 7 }],
  },
  {
    label: "إعدادات الموقع",
    icon: Settings,
    items: [
      { label: "إعدادات الموقع", to: "/settings" },
      { label: "الشركاء", to: "/partners" },
      { label: "الخدمات", to: "/services" },
    ],
  },
  {
    label: "الإدارة",
    icon: ShieldCheck,
    items: [
      { label: "الموظفين", to: "/employees" },
      { label: "سجل الأخطاء", to: "/error-log" },
    ],
  },
];
