/* Service worker: network-first for navigations (with offline fallback),
   cache-first + background revalidation for static assets.
   Never caches API calls, non-GET requests, or authenticated/live data. */

const STATIC_CACHE = "mithra-static-v1";
const OFFLINE_URL = "/offline";

const STATIC_EXTENSIONS = /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf)$/i;

/** يجب عدم تخزين أي طلبات API أو بيانات حية أو مصادقة مؤقتًا مطلقًا. */
function isExcludedFromCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/supabase/") ||
    url.hostname.includes("supabase.co") ||
    url.pathname === "/sitemap.xml" ||
    url.pathname === "/robots.txt"
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL]).catch(() => {})),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isExcludedFromCache(url)) return;

  // Navigations: network-first مع رجوع لصفحة عدم الاتصال عند الفشل.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline || Response.error();
      }),
    );
    return;
  }

  // ملفات ثابتة (css/js/img/fonts): cache-first مع تحديث في الخلفية.
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => undefined);

        return cached || (await networkFetch) || Response.error();
      }),
    );
  }
});
