import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PublicProperty = {
  id: string;
  code: string;
  name: string;
  purpose: string;
  rent_period: string | null;
  property_type: string | null;
  city: string | null;
  district: string | null;
  price_text: string | null;
  price_value: number | null;
  description: string | null;
  is_featured: boolean;
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
  whatsapp_number: string | null;
  link_youtube: string | null;
  link_tiktok: string | null;
  link_instagram: string | null;
  link_snapchat: string | null;
  link_x: string | null;
  link_facebook: string | null;
  link_tour: string | null;
  created_at: string;
  property_images: { url: string; is_cover: boolean; sort_order: number }[];
};

export type PublicArea = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  property_count: number;
};

const PROPERTY_FIELDS =
  "id, code, name, purpose, rent_period, property_type, city, district, price_text, price_value, description, is_featured, map_url, latitude, longitude, whatsapp_number, link_youtube, link_tiktok, link_instagram, link_snapchat, link_x, link_facebook, link_tour, created_at, property_images(url, is_cover, sort_order)";

export const DEFAULT_WHATSAPP = "966550818020";
export const COMPANY_PHONE = "0550818020";
export const COMPANY_EMAIL = "info@mithra.sa";

export function whatsappLink(number?: string | null, text?: string) {
  const digits = (number ?? DEFAULT_WHATSAPP).replace(/[^0-9]/g, "");
  const normalized = digits.startsWith("966") ? digits : `966${digits.replace(/^0/, "")}`;
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function coverImage(property: Pick<PublicProperty, "property_images">) {
  const images = [...(property.property_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  return images[0]?.url ?? null;
}

export function galleryImages(property: Pick<PublicProperty, "property_images">) {
  return [...(property.property_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
}

async function fetchProperties(purpose?: "rent" | "sale", limit = 60) {
  let query = supabase
    .from("properties")
    .select(PROPERTY_FIELDS)
    .eq("is_visible", true)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (purpose) query = query.eq("purpose", purpose);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PublicProperty[];
}

export const publicPropertiesQuery = (purpose?: "rent" | "sale", limit?: number) =>
  queryOptions({
    queryKey: ["public-properties", purpose ?? "all", limit ?? 60],
    queryFn: () => fetchProperties(purpose, limit),
    staleTime: 60_000,
  });

export const publicAreasQuery = (purpose?: "rent" | "sale") =>
  queryOptions({
    queryKey: ["public-areas", purpose ?? "all"],
    queryFn: async () => {
      const [citiesResult, propertiesResult] = await Promise.all([
        supabase
          .from("cities")
          .select("id, name, name_en, description, description_en, image_url, is_featured, sort_order")
          .eq("is_active", true)
          .order("is_featured", { ascending: false })
          .order("sort_order"),
        (() => {
          let query = supabase.from("properties").select("city").eq("is_visible", true);
          if (purpose) query = query.eq("purpose", purpose);
          return query;
        })(),
      ]);
      if (citiesResult.error) throw citiesResult.error;
      if (propertiesResult.error) throw propertiesResult.error;
      const counts = new Map<string, number>();
      for (const row of propertiesResult.data ?? []) {
        const city = row.city?.trim();
        if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
      }
      return (citiesResult.data ?? []).map((city) => ({
        ...city,
        property_count: counts.get(city.name.trim()) ?? 0,
      })) as PublicArea[];
    },
    staleTime: 60_000,
  });

export const publicPropertyQuery = (code: string) =>
  queryOptions({
    queryKey: ["public-property", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(PROPERTY_FIELDS)
        .eq("is_visible", true)
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PublicProperty | null) ?? null;
    },
  });

export const publicServicesQuery = queryOptions({
  queryKey: ["public-services"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, title, description, icon, image_url")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 300_000,
});

export const publicSettingsQuery = queryOptions({
  queryKey: ["public-settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("company_name, phone, whatsapp_number, email, address, about, stats, social_links")
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 300_000,
});

export const purposeLabels: Record<string, string> = {
  rent: "إيجار",
  sale: "بيع",
  investment: "استثمار",
};

export const rentPeriodLabels: Record<string, string> = {
  yearly: "سنويًا",
  monthly: "شهريًا",
  daily: "يوميًا",
};

export type SiteSettings = {
  phone: string | null;
  whatsapp_number: string | null;
};

export const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("phone, whatsapp_number")
      .maybeSingle();
    if (error) throw error;
    return (data as SiteSettings | null) ?? null;
  },
  staleTime: 300_000,
});
