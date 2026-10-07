import { ART_CATALOG, ART_METADATA } from "../assets/coloring/catalog.js?v=46";
export const ART_CACHE = "little-art-studio-art-v1";
export function artworkURLs(id) {
  const meta = ART_METADATA[id];
  return [
    `${meta.bundle}?rev=${meta.revision}`,
    `assets/coloring/${id}.svg?rev=${meta.revision}`,
  ];
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
