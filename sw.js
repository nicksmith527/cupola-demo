// Service worker: lets the installed app open instantly and even offline.
// Network first, so a fresh push to GitHub always wins; the cache is only a fallback.
const CACHE = "cupola-demo-v10";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // "no-cache" makes the browser check GitHub for a newer file every time
    // (a quick "not modified" when nothing changed), instead of reusing its
    // own copy for up to 10 minutes after a push.
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
