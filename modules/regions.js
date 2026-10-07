// Semantic labels depend on artwork geometry, never on current paint colors.
const cache = new Map();
const LIMIT = 24 * 1024 * 1024;
function trim(current) {
  let bytes = [...cache.values()].reduce((n, entry) => n + entry.bytes, 0);
  for (const [key, entry] of cache) {
    if (bytes <= LIMIT) break;
    if (entry === current) continue;
    bytes -= entry.bytes;
    cache.delete(key);
  }
}
export async function loadRegions(svg, artwork, width, height, surface) {
  const key = JSON.stringify([
    artwork.id,
    artwork.revision,
    width,
    height,
    surface,
  ]);
  if (cache.has(key)) {
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  const copy = svg.cloneNode(true),
    colors = new Map(),
    ids = new Map();
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Legacy drafts retain their original renderer, including protective ink.
  if (artwork.legacy)
    copy.querySelectorAll("g,path,ellipse,circle").forEach((el) => {
      if (el.hasAttribute("stroke") && el.getAttribute("stroke") !== "none")
        el.setAttribute("stroke", "#000");
      if (el.getAttribute("fill") !== "none") el.setAttribute("fill", "#000");
    });
  let index = 0;
  copy.querySelectorAll("[data-region]").forEach((el) => {
    const id = el.dataset.fillGroup
      ? "group:" + el.dataset.fillGroup
      : el.dataset.region;
    if (!colors.has(id)) {
      const value = ++index * 8191;
      colors.set(id, value);
      ids.set(value, id);
    }
    const value = colors.get(id);
    el.setAttribute(
      "fill",
      `rgb(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255})`,
    );
  });
  const img = new Image();
  img.src =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(new XMLSerializer().serializeToString(copy));
  await img.decode();
  const raster = document.createElement("canvas");
  raster.width = width;
  raster.height = height;
  const context = raster.getContext("2d", { willReadFrequently: true });
  context.drawImage(img, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const labels = new Uint16Array(width * height);
  const keys = [...colors.keys()],
    indices = new Map(keys.map((id, i) => [id, i + 1]));
  const bounds = keys.map(() => ({
    left: width,
    top: height,
    right: -1,
    bottom: -1,
  }));
  for (let i = 0; i < labels.length; i++) {
    const at = i * 4,
      id = ids.get((pixels[at] << 16) | (pixels[at + 1] << 8) | pixels[at + 2]);
    labels[i] = indices.get(id) || 0;
    if (labels[i]) {
      const b = bounds[labels[i] - 1],
        x = i % width,
        y = Math.floor(i / width);
      b.left = Math.min(b.left, x);
      b.right = Math.max(b.right, x);
      b.top = Math.min(b.top, y);
      b.bottom = Math.max(b.bottom, y);
    }
  }
  const masks = new Map();
  const result = {
    bytes: labels.byteLength,
    has: (id) => colors.has(id),
    hit(x, y) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      let index = labels[y * width + x];
      // Tiny antialias gaps are resolved against nearby semantic pixels.
      if (!index)
        for (let radius = 1; radius <= 2 && !index; radius++) {
          for (let dy = -radius; dy <= radius && !index; dy++)
            for (let dx = -radius; dx <= radius && !index; dx++) {
              if (
                x + dx >= 0 &&
                y + dy >= 0 &&
                x + dx < width &&
                y + dy < height
              )
                index = labels[(y + dy) * width + x + dx];
            }
        }
      return keys[index - 1] || null;
    },
    mask(id) {
      if (masks.has(id)) return masks.get(id);
      const index = indices.get(id);
      if (!index) return null;
      const b = bounds[index - 1];
      if (b.right < b.left) return null;
      const mask = document.createElement("canvas");
      mask.width = b.right - b.left + 1;
      mask.height = b.bottom - b.top + 1;
      const ctx = mask.getContext("2d"),
        image = ctx.createImageData(mask.width, mask.height);
      for (let y = 0; y < mask.height; y++)
        for (let x = 0; x < mask.width; x++) {
          if (labels[(y + b.top) * width + x + b.left] === index) {
            const at = (y * mask.width + x) * 4;
            image.data.fill(255, at, at + 4);
          }
        }
      ctx.putImageData(image, 0, 0);
      const value = {
        canvas: mask,
        x: b.left,
        y: b.top,
        bytes: mask.width * mask.height * 4,
      };
      while (
        masks.size &&
        (masks.size >= 3 || result.bytes + value.bytes > LIMIT)
      ) {
        const first = masks.keys().next().value;
        result.bytes -= masks.get(first).bytes;
        masks.delete(first);
      }
      masks.set(id, value);
      result.bytes += value.bytes;
      trim(result);
      return value;
    },
  };
  cache.set(key, result);
  trim(result);
  return result;
}
