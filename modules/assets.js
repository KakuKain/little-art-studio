import { ART_METADATA } from "../assets/coloring/catalog.js?v=46";
import { legacyScenes } from "./legacy-scenes.js?v=46";

const cache = new Map();
export async function loadArtwork(id) {
  if (id === "blank")
    return { id, revision: "blank", paint: "", lines: "", regions: [] };
  if (Object.hasOwn(legacyScenes, id)) {
    return {
      id,
      revision: "legacy-44",
      paint: legacyScenes[id],
      lines: "",
      legacy: true,
    };
  }
  const meta = ART_METADATA[id];
  if (!meta) {
    // Older drafts may refer to retired, but still shipped, original SVG IDs.
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Unknown artwork: ${id}`);
    const response = await fetch(`assets/coloring/${id}.svg`);
    if (!response.ok) throw new Error(`Unknown artwork: ${id}`);
    const doc = new DOMParser().parseFromString(
      await response.text(),
      "image/svg+xml",
    );
    if (doc.querySelector("parsererror"))
      throw new Error(`Invalid legacy artwork: ${id}`);
    return {
      id,
      revision: "retired-44",
      paint: doc.documentElement.innerHTML,
      lines: "",
      legacy: true,
    };
  }
  if (cache.has(id)) {
    const hit = cache.get(id);
    cache.delete(id);
    cache.set(id, hit);
    return hit;
  }
  let response;
  try {
    response = await fetch(`${meta.bundle}?rev=${meta.revision}`);
  } catch (error) {
    // An update installed while online must not strand a previously cached sheet
    // when the child next opens it offline, before the new bundle has been visited.
    if ("caches" in globalThis) {
      const art = await caches.open("little-art-studio-art-v1");
      const target = new URL(`../assets/coloring/${id}.svg`, import.meta.url);
      for (const request of await art.keys()) {
        const url = new URL(request.url);
        if (url.origin === target.origin && url.pathname === target.pathname) {
          const cached = await art.match(request);
          const doc = new DOMParser().parseFromString(
            await cached.text(),
            "image/svg+xml",
          );
          if (!doc.querySelector("parsererror"))
            return {
              id,
              revision: "cached-44",
              paint: doc.documentElement.innerHTML,
              lines: "",
              legacy: true,
            };
        }
      }
    }
    throw error;
  }
  if (!response.ok) throw new Error(`Unable to load artwork: ${id}`);
  const data = await response.json();
  if (
    data.schemaVersion !== 1 ||
    data.id !== id ||
    data.revision !== meta.revision ||
    typeof data.paint !== "string" ||
    typeof data.lines !== "string" ||
    !Array.isArray(data.regions)
  ) {
    throw new Error(`Invalid artwork contract: ${id}`);
  }
  cache.set(id, data);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return data;
}
