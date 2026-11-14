// Offline support: precache the app shell + its JS, then network-first for pages, cache-first for hashed assets.
const CACHE = "imposter-v1";
const PAGES = ["/", "/play", "/room", "/join/_"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const page of PAGES) {
        try {
          const res = await fetch(page);
          if (!res.ok) continue;
          await cache.put(page, res.clone());
          const assets = [...new Set((await res.text()).match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
          await Promise.all(assets.map((a) => cache.add(a).catch(() => {})));
        } catch {
          /* offline during install: cache fills at runtime instead */
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(url.pathname, { ignoreSearch: true });
        if (hit) return hit;
        // Any /join/<code> works offline: the join page reads the code from the URL.
        if (url.pathname.startsWith("/join/")) return (await caches.match("/join/_")) || Response.error();
        return (await caches.match("/")) || Response.error();
      }),
  );
});
