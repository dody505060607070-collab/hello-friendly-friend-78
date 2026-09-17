/**
 * أدوات استخراج الإحداثيات (خط العرض/الطول) من روابط خرائط جوجل.
 * لا تعتمد على أي مكتبة خارجية، وتعمل على العميل والخادم.
 */

export type LatLng = { lat: number; lng: number };

function inRange(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** يحاول استخراج إحداثيات من نص/رابط خرائط جوجل (بدون حل الروابط المختصرة). */
export function extractLatLngFromUrl(raw: string): LatLng | null {
  const url = (raw ?? "").trim();
  if (!url) return null;

  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    decoded = url;
  }

  // نمط !3dLAT!4dLNG (يظهر غالبًا في روابط /place/)
  const bang = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bang) {
    const lat = Number(bang[1]);
    const lng = Number(bang[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }

  // نمط @LAT,LNG,ZOOMz
  const at = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }

  // نمط q=LAT,LNG أو query=LAT,LNG أو ll=LAT,LNG
  const q = decoded.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (q) {
    const lat = Number(q[1]);
    const lng = Number(q[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }

  // نص عادي "lat,lng" فقط
  const plain = decoded.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }

  return null;
}

/** يتحقق مما إذا كان الرابط رابطًا مختصرًا يحتاج حلًّا عبر الخادم. */
export function isShortMapsUrl(raw: string): boolean {
  const url = (raw ?? "").trim();
  if (!url) return false;
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url);
}

/** يتحقق مما إذا كان النص رابط خرائط جوجل محتمل. */
export function looksLikeMapsUrl(raw: string): boolean {
  const url = (raw ?? "").trim();
  return /^https?:\/\//i.test(url) && /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google/i.test(url);
}
