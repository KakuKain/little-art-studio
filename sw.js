importScripts("./offline-shell.js");
const SHELL = `little-art-studio-shell-v${SHELL_VERSION}`;
const ART = "little-art-studio-art-v1";
const ROOT = new URL("./", self.location.href);
function inside(request) {
  return new URL(request.url).href.startsWith(ROOT.href);
}
function artwork(request) {
  return (
    new URL(request.url).pathname.startsWith(
      ROOT.pathname + "assets/coloring/",
    ) && !new URL(request.url).pathname.endsWith("/catalog.js")
  );
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        cache.addAll(
          SHELL_FILES.map((url) => new Request(url, { cache: "reload" })),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const art = await caches.open(ART);
      // Copy runtime artwork from pre-module releases without changing other apps' caches.
      for (const key of await caches.keys()) {
        if (/^little-art-v\d+$/.test(key)) {
          const old = await caches.open(key);
          for (const request of await old.keys())
            if (inside(request) && artwork(request)) {
              const response = await old.match(request);
              if (response) await art.put(request, response);
            }
        }
        // Shells are named by release: numbered (v49) before 1.0.0-beta.1.
        if (key.startsWith("little-art-studio-shell-v") && key !== SHELL)
          await caches.delete(key);
        // Old little-art-v caches remain as compatibility backups.
      }
      await self.clients.claim();
    })(),
  );
});
async function fetchNavigation(request, event) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(request, {
      cache: "no-cache",
      signal: controller.signal,
    });
    if (response.ok)
      event.waitUntil(
        caches
          .open(SHELL)
          .then((cache) => cache.put(request, response.clone())),
      );
    if (response.ok) return response;
  } catch {
  } finally {
    clearTimeout(timer);
  }
  return (
    (await (await caches.open(SHELL)).match("./index.html")) || Response.error()
  );
}
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !inside(event.request)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetchNavigation(event.request, event));
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(artwork(event.request) ? ART : SHELL);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      if (response.ok)
        event.waitUntil(
          cache.put(event.request, response.clone()).catch(() => {}),
        );
      return response;
    })(),
  );
});
