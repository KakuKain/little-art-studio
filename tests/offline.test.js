import test from "node:test";
import assert from "node:assert/strict";
import { ART_METADATA } from "../assets/coloring/catalog.js";
import {
  pruneArtCache,
  categoryStatus,
  artworkURLs,
} from "../modules/offline.js";

const ROOT = new URL("../", import.meta.url);
const entries = new Map();
const resolve = (r) => new URL(typeof r === "string" ? r : r.url, ROOT).href;
globalThis.caches = {
  open: async () => ({
    keys: async () => [...entries.keys()].map((url) => ({ url })),
    match: async (r) => entries.get(resolve(r)),
    put: async (r, value) => entries.set(resolve(r), value),
    delete: async (r) => entries.delete(resolve(r)),
  }),
};
const put = (path) => entries.set(new URL(path, ROOT).href, new Response("x"));
const has = (path) => entries.has(new URL(path, ROOT).href);

test("only artwork with a cached replacement is pruned", async () => {
  const [kittyBundle, kittyThumb] = artworkURLs("kitty");
  put(kittyBundle);
  put(kittyThumb);
  put("assets/coloring/prepared/kitty.json?rev=outdated");
  put("assets/coloring/thumbs/kitty.webp?rev=outdated");
  put("assets/coloring/kitty.svg?rev=47");
  // No current Elsa bundle yet: the outdated copy must still open offline.
  put("assets/coloring/prepared/elsa-simple.json?rev=outdated");
  put("assets/coloring/elsa-simple.svg?rev=47");
  // A retired sheet that old drafts may reference.
  put("assets/coloring/anna.svg?rev=44");
  assert.equal(ART_METADATA.anna, undefined);
  assert.equal(await pruneArtCache(), 3);
  assert.ok(has(kittyBundle) && has(kittyThumb));
  assert.ok(!has("assets/coloring/prepared/kitty.json?rev=outdated"));
  assert.ok(!has("assets/coloring/thumbs/kitty.webp?rev=outdated"));
  assert.ok(!has("assets/coloring/kitty.svg?rev=47"));
  assert.ok(has("assets/coloring/prepared/elsa-simple.json?rev=outdated"));
  assert.ok(has("assets/coloring/elsa-simple.svg?rev=47"));
  assert.ok(has("assets/coloring/anna.svg?rev=44"));
  assert.equal(await pruneArtCache(), 0);
});

test("a sheet counts as offline-ready only with its current bundle and thumbnail", async () => {
  entries.clear();
  const [bundle, thumb] = artworkURLs("dolphin");
  put(bundle);
  assert.equal((await categoryStatus("ocean")).ready, 0);
  put(thumb);
  assert.equal((await categoryStatus("ocean")).ready, 1);
});
