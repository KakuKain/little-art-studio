import {
  ART_CATALOG,
  ART_METADATA,
} from "../assets/coloring/catalog.js?v=1.0.0-beta.1";
export const ART_CACHE = "little-art-studio-art-v1";
const ROOT = new URL("../", import.meta.url);
// An offline sheet needs its layered bundle and its grid thumbnail.
export function artworkURLs(id) {
  const meta = ART_METADATA[id];
  return [`${meta.bundle}?rev=${meta.revision}`, meta.thumb];
}
export async function categoryStatus(category) {
  const items = ART_CATALOG.filter((i) => i.category === category);
  if (!("caches" in globalThis)) return { ready: 0, total: items.length };
  const cache = await caches.open(ART_CACHE);
  let ready = 0;
  for (const item of items)
    if (
      (
        await Promise.all(artworkURLs(item.id).map((url) => cache.match(url)))
      ).every(Boolean)
    )
      ready++;
  return { ready, total: items.length };
}
export async function downloadCategory(category, progress) {
  if (!("caches" in globalThis)) throw new Error("此瀏覽器不支援離線圖片");
  const cache = await caches.open(ART_CACHE);
  const items = ART_CATALOG.filter((i) => i.category === category);
  let completed = 0,
    cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      for (const url of artworkURLs(item.id)) {
        if (await cache.match(url)) continue;
        const response = await fetch(url);
        if (!response.ok) throw new Error("圖片下載失敗，已下載的圖片會保留");
        if (url.includes(".json")) {
          const bundle = await response.clone().json();
          if (
            bundle.id !== item.id ||
            bundle.revision !== ART_METADATA[item.id].revision
          )
            throw new Error("圖片版本不符，請重新整理");
        }
        await cache.put(url, response);
      }
      progress(++completed, items.length);
    }
  }
  await Promise.all([worker(), worker()]);
  return { ready: completed, total: items.length };
}
// Deletes artwork a newer cached copy has replaced. An outdated copy stays
// until its replacement arrives, because it can still open the sheet offline.
// Retired sheets are kept: old drafts may still open them.
export async function pruneArtCache() {
  if (!("caches" in globalThis)) return 0;
  const cache = await caches.open(ART_CACHE),
    requests = await cache.keys(),
    present = new Set(requests.map((request) => request.url));
  let removed = 0;
  for (const request of requests) {
    const url = new URL(request.url);
    if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname))
      continue;
    const match = url.pathname
      .slice(ROOT.pathname.length)
      .match(
        /^assets\/coloring\/(?:prepared\/([a-z0-9-]+)\.json|thumbs\/([a-z0-9-]+)\.webp|([a-z0-9-]+)\.svg)$/,
      );
    const id = match && (match[1] || match[2] || match[3]),
      meta = id && ART_METADATA[id];
    if (!meta) continue;
    const [bundle, thumb] = artworkURLs(id).map((u) => new URL(u, ROOT).href);
    if (url.href === bundle || url.href === thumb) continue;
    // Source SVGs served as thumbnails and offline fallbacks before V48;
    // the current bundle replaces both.
    const replacement = match[2] ? thumb : bundle;
    if (present.has(replacement) && (await cache.delete(request))) removed++;
  }
  return removed;
}
