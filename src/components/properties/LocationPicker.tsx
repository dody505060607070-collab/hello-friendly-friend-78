import { ClientOnly } from "@tanstack/react-router";
import { Loader2, MapPin } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";

import { inputClass } from "@/components/kit/Modal";
import { extractLatLngFromUrl, isShortMapsUrl, looksLikeMapsUrl } from "@/lib/geo";
import { resolveMapCoordinates } from "@/lib/geo.functions";

const LocationPickerMap = lazy(() =>
  import("@/components/properties/LocationPickerMap").then((m) => ({ default: m.LocationPickerMap })),
);

const MapPlaceholder = () => (
  <div className="h-[320px] w-full animate-pulse rounded-xl border border-border bg-secondary/60" />
);

/**
 * منتقي موقع العقار: خريطة تفاعلية + استخراج تلقائي للإحداثيات من رابط خرائط جوجل
 * (بما فيها الروابط المختصرة) + إدخال يدوي لخط العرض/الطول.
 */
export function LocationPicker({
  mapUrl,
  latitude,
  longitude,
  onMapUrlChange,
  onCoordsChange,
}: {
  mapUrl: string;
  latitude: string;
  longitude: string;
  onMapUrlChange: (url: string) => void;
  onCoordsChange: (lat: string, lng: string) => void;
}) {
  const [extracting, setExtracting] = useState(false);

  const lat = latitude ? Number(latitude) : null;
  const lng = longitude ? Number(longitude) : null;

  const extractFromUrl = async (url: string) => {
    if (!looksLikeMapsUrl(url)) return;
    const direct = extractLatLngFromUrl(url);
    if (direct) {
      onCoordsChange(String(direct.lat), String(direct.lng));
      toast.success("تم استخراج الإحداثيات من الرابط");
      return;
    }
    if (!isShortMapsUrl(url)) return;
    setExtracting(true);
    try {
      const point = await resolveMapCoordinates({ data: { url } });
      onCoordsChange(String(point.lat), String(point.lng));
      toast.success("تم استخراج الإحداثيات من الرابط المختصر");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر استخراج الإحداثيات من الرابط");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-foreground">
            رابط خرائط جوجل
          </span>
          <input
            className={inputClass}
            dir="ltr"
            value={mapUrl}
            onChange={(e) => onMapUrlChange(e.target.value)}
            onBlur={(e) => void extractFromUrl(e.target.value.trim())}
            placeholder="https://maps.google.com/... أو https://maps.app.goo.gl/..."
          />
        </div>
        <button
          type="button"
          disabled={extracting || !mapUrl.trim()}
          onClick={() => void extractFromUrl(mapUrl.trim())}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[12.5px] font-semibold text-primary disabled:opacity-50"
        >
          {extracting ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
          استخراج الإحداثيات
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-foreground">
            خط العرض (Latitude)
          </span>
          <input
            className={inputClass}
            dir="ltr"
            value={latitude}
            onChange={(e) => onCoordsChange(e.target.value, longitude)}
            placeholder="26.3260"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-foreground">
            خط الطول (Longitude)
          </span>
          <input
            className={inputClass}
            dir="ltr"
            value={longitude}
            onChange={(e) => onCoordsChange(latitude, e.target.value)}
            placeholder="43.9750"
          />
        </div>
      </div>

      <ClientOnly fallback={<MapPlaceholder />}>
        <Suspense fallback={<MapPlaceholder />}>
          <LocationPickerMap
            lat={lat}
            lng={lng}
            onChange={(point) => onCoordsChange(String(point.lat), String(point.lng))}
          />
        </Suspense>
      </ClientOnly>
      <p className="text-[11.5px] text-muted-foreground">
        اضغط على الخريطة أو اسحب العلامة لتحديد الموقع بدقة.
      </p>
    </div>
  );
}
