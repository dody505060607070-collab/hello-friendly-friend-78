import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractLatLngFromUrl, isShortMapsUrl, type LatLng } from "@/lib/geo";

/**
 * يحلّ إحداثيات نقطة من رابط خرائط جوجل (بما فيها الروابط المختصرة
 * maps.app.goo.gl / goo.gl/maps) عبر تتبّع إعادة التوجيه على الخادم،
 * دون كشف أي مفاتيح خارجية.
 */
export const resolveMapCoordinates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    if (!input?.url?.trim()) throw new Error("ضع رابط خرائط جوجل أولًا");
    return input;
  })
  .handler(async ({ data }): Promise<LatLng> => {
    const url = data.url.trim();

    const direct = extractLatLngFromUrl(url);
    if (direct) return direct;

    if (!isShortMapsUrl(url)) {
      throw new Error("تعذّر استخراج الإحداثيات من هذا الرابط، تأكد أنه رابط خرائط جوجل صحيح");
    }

    try {
      let current = url;
      for (let i = 0; i < 6; i += 1) {
        const res = await fetch(current, { redirect: "manual" });
        const location = res.headers.get("location");
        const fromCurrent = extractLatLngFromUrl(current);
        if (fromCurrent) return fromCurrent;
        if (!location) {
          if (res.status >= 200 && res.status < 300) {
            const text = await res.text();
            const fromBody = extractLatLngFromUrl(text);
            if (fromBody) return fromBody;
          }
          break;
        }
        current = new URL(location, current).toString();
        const fromRedirect = extractLatLngFromUrl(current);
        if (fromRedirect) return fromRedirect;
      }
    } catch {
      throw new Error("تعذّر الوصول إلى الرابط المختصر، تحقق من الاتصال أو الرابط");
    }

    throw new Error("تعذّر استخراج الإحداثيات من هذا الرابط، جرّب لصق رابط خرائط كامل");
  });
