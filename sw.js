// Offline support. Network first, so a new deploy shows up on the next launch;
// falls back to the cached copy when there's no connection.
const VERSION = "rp-v10";
const FILES = [
  "./", "index.html", "styles.css", "manifest.webmanifest",
  "fonts/press-start-2p.woff2", "assets/course-mask.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png",
  "src/main.js", "src/course.js", "src/terrain.js", "src/render.js", "src/sprites.js",
  "src/physics.js", "src/hud.js", "src/theme.js", "src/util.js"
];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache so we never store a stale file
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(FILES.map(f => fetch(f, { cache: "reload" }).then(r => r.ok && c.put(f, r)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(e.request, { cache: "no-cache" });
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
