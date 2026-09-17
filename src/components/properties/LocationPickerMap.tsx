import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/**
 * خريطة تفاعلية لاختيار موقع العقار: انقر أو اسحب العلامة لتحديد الإحداثيات.
 * مكوّن يعمل على العميل فقط (يُستدعى عبر ClientOnly من property-form).
 */
export function LocationPickerMap({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (point: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);

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
    const start: [number, number] = [lat ?? 26.3536, lng ?? 43.9667];

    if (!mapRef.current) {
      const map = L.map(containerRef.current).setView(start, lat && lng ? 15 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);

      const icon = L.divIcon({
        className: "mithra-map-marker",
        iconSize: [36, 48],
        iconAnchor: [18, 46],
        html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))">
          <div style="background:var(--primary);border:2px solid #fff;border-radius:999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>
            </svg>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--primary);margin-top:-1px"></div>
        </div>`,
      });

      const marker = L.marker(start, { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChange({ lat: pos.lat, lng: pos.lng });
      });
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
    }
  }, [leaflet]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (lat == null || lng == null) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - lat) > 1e-7 || Math.abs(current.lng - lng) > 1e-7) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 14));
    }
  }, [lat, lng]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="h-[320px] w-full overflow-hidden rounded-xl border border-border"
    />
  );
}
