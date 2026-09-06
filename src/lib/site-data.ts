import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PublicProperty = {
  id: string;
  code: string;
  name: string;
  purpose: string;
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
  created_at: string;
  property_images: { url: string; is_cover: boolean; sort_order: number }[];
};

const PROPERTY_FIELDS =
  "id, code, name, purpose, property_type, city, district, price_text, price_value, description, is_featured, map_url, latitude, longitude, whatsapp_number, created_at, property_images(url, is_cover, sort_order)";

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
