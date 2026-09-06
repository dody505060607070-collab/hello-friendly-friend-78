import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

import type { PublicProperty } from "@/lib/site-data";

type MapProperty = PublicProperty & {
  latitude?: number | null;
  longitude?: number | null;
};

const filters = [
  { key: "all", label: "الكل" },
  { key: "sale", label: "بيع" },
  { key: "rent", label: "إيجار" },
] as const;

const colors: Record<string, string> = {
  sale: "#E0A800",
  rent: "#B01C2E",
};

export function PropertyMap({
  properties,
  title = "العقارات على الخريطة",
  description = "اضغط على أي نقطة لعرض تفاصيل العقار — الأصفر للبيع والأحمر للإيجار.",
}: {
  properties: MapProperty[] | undefined;
  title?: string;
  description?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);
  const [active, setActive] = useState<"all" | "sale" | "rent">("all");

  const points = useMemo(
    () =>
      (properties ?? []).filter(
        (p) =>
          typeof p.latitude === "number" &&
          typeof p.longitude === "number" &&
          (active === "all" || p.purpose === active),
      ),
    [properties, active],
  );

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (!cancelled) setLeaflet(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!leaflet || !containerRef.current) return;
    const L = leaflet;
    if (!mapRef.current) {
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
        [26.3536, 43.9667],
        11,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }
    const map = mapRef.current as import("leaflet").Map;
    const layer = layerRef.current as import("leaflet").LayerGroup;
    layer.clearLayers();

    const bounds: [number, number][] = [];
    points.forEach((property) => {
      const lat = Number(property.latitude);
      const lng = Number(property.longitude);
      bounds.push([lat, lng]);
      const color = colors[property.purpose] ?? "#B01C2E";
      L.circleMarker([lat, lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindPopup(
          `<div dir="rtl" style="min-width:180px;font-family:inherit">
            <strong style="display:block;margin-bottom:4px">${property.name}</strong>
            <span style="color:#666;font-size:12px">${property.district ?? ""}${
              property.city ? `، ${property.city}` : ""
            }</span><br/>
            <span style="color:${color};font-weight:700;font-size:12px">${
              property.price_text ?? "عند التواصل"
            }</span><br/>
            <a href="/properties/${property.code}" style="color:#B01C2E;font-weight:700;font-size:12px">عرض التفاصيل</a>
          </div>`,
        )
        .addTo(layer);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    else if (bounds.length === 1) map.setView(bounds[0]!, 13);
  }, [leaflet, points]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        (mapRef.current as import("leaflet").Map).remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    },
    [],
  );

  return (
    <section id="map-section" className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-foreground">{title}</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActive(filter.key)}
              className={`rounded-lg px-4 py-2 text-[13px] font-bold transition ${
                active === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 pb-4 text-[12.5px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: colors["sale"] }} /> عقارات
          للبيع
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: colors["rent"] }} /> عقارات
          للإيجار
        </span>
        <span>{points.length} عقار على الخريطة</span>
      </div>

      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded-2xl border border-border shadow-card"
      />
    </section>
  );
}
