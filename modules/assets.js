import { ART_METADATA } from "../assets/coloring/catalog.js?v=1.0.0-beta.1";
import { legacyScenes } from "./legacy-scenes.js?v=1.0.0-beta.1";

const cache = new Map();
// Errors carry a code so the interface never has to parse a message.
function artworkError(code, id, cause) {
  const error = new Error(`${code}: ${id}`, { cause });
  error.code = code;
  return error;
}
export function thumbnailURL(id) {
  return ART_METADATA[id]?.thumb || `assets/coloring/${id}.svg`;
}
function validBundle(data, id) {
  return (
    data?.schemaVersion === 1 &&
    data.id === id &&
    typeof data.paint === "string" &&
    typeof data.lines === "string" &&
    Array.isArray(data.regions)
  );
}
// Offline after an update, before the new bundle was downloaded: reuse a
// cached copy from an earlier revision (region IDs are stable across
// revisions), or else the original SVG an older release cached.
async function cachedFallback(id, meta) {
  if (!("caches" in globalThis)) return null;
  const art = await caches.open("little-art-studio-art-v1");
  const bundle = new URL(`../${meta.bundle}`, import.meta.url),
    svg = new URL(`../assets/coloring/${id}.svg`, import.meta.url);
  let legacy = null;
  for (const request of await art.keys()) {
    const url = new URL(request.url);
    if (url.origin !== bundle.origin) continue;
    if (url.pathname === bundle.pathname) {
      const data = await (await art.match(request)).json().catch(() => null);
      if (validBundle(data, id)) return data;
    } else if (url.pathname === svg.pathname && !legacy) legacy = request;
  }
  if (!legacy) return null;
  const doc = new DOMParser().parseFromString(
    await (await art.match(legacy)).text(),
    "image/svg+xml",
  );
  if (doc.querySelector("parsererror")) return null;
  return {
    id,
    revision: "cached-44",
    paint: doc.documentElement.innerHTML,
    lines: "",
    legacy: true,
  };
}
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
    if (!/^[a-z0-9-]+$/.test(id)) throw artworkError("artwork-unknown", id);
    const response = await fetch(`assets/coloring/${id}.svg`).catch((error) => {
      throw artworkError("artwork-unavailable", id, error);
    });
    if (!response.ok) throw artworkError("artwork-unavailable", id);
    const doc = new DOMParser().parseFromString(
      await response.text(),
      "image/svg+xml",
    );
    if (doc.querySelector("parsererror"))
      throw artworkError("artwork-invalid", id);
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
  let data;
  try {
    const response = await fetch(`${meta.bundle}?rev=${meta.revision}`);
    if (!response.ok) throw artworkError("artwork-unavailable", id);
    data = await response.json();
  } catch (error) {
    const fallback = await cachedFallback(id, meta).catch(() => null);
    if (fallback) return fallback;
    throw error.code ? error : artworkError("artwork-unavailable", id, error);
  }
  if (!validBundle(data, id) || data.revision !== meta.revision)
    throw artworkError("artwork-invalid", id);
  cache.set(id, data);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return data;
}
