// One-off: make every area of the clean line-art sheets fill with one tap,
// right up to its lines. Their cells were traced apart from the ink, so a
// cell often stopped short of a line, leaving a strip of the backing
// (protect-clean-regions.py) or a sliver of the neighboring cell white when
// the area was colored; and a part drawn with open lines, like hair with
// strands that end short of the outline, was cut into many cells, each
// needing its own tap.
//
// Each sheet is drawn 4× (1440×1760): once with every region in its own flat
// color (spaced like regions.js does, so a blend of two at an edge matches
// none and takes a neighbor's label), once with only the lines. An area is
// what a bucket of paint would fill: pixels off the ink and off the sky,
// connected, with gaps in a line narrower than about a canvas pixel and a
// half closed. In each area the largest cell and every other cell thick
// enough not to be a sliver keep their pixels; every other pixel, backing
// included, goes to the nearest of them. Two of those cells split along a
// cut running right across the smaller one were one part cut in two by the
// tracing, so they fill together (a data-fill-group; a saved fill of one
// still colors just that cell). A pocket of
// backing with no cell stays backing, and the sky (outside an outline with a
// gap) neither gives nor takes pixels. Every cell is then traced again from
// its pixels, reaching a little under the ink so its edge hides beneath the
// line.
//
// Hair drawn as many closed locks is marked by hand in hair-groups.json, a
// point (sheet units) in each lock: those areas fill together as one "hair"
// group, and a lock that is a pocket of backing joins the nearest of them.
//
// Region IDs never change, so saved fills color the larger cells. Run it on
// the sheets as they were before it (git), since it changes them in place.
//
// node scripts/close-fill-gaps.cjs [sheet-id …]   (default: every *-clean.svg)
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const DIR = path.join(__dirname, "../assets/coloring");
const HAIR = require("./hair-groups.json");
const SCALE = 4,
  W = 360 * SCALE,
  H = 440 * SCALE;
const THICK = 8; // a part this many pixels at 4× deep is not a sliver…
const MIN_PART = 400; // …if it also has this many pixels
const INK_REACH = 2; // pixels at 4× a cell reaches under the ink
const TOLERANCE = 0.75; // tracing tolerance, pixels at 4×
const CLOSE = 3; // a gap in a line narrower than twice this (pixels at 4×) still parts areas
const MIN_CUT = 4; // two cells split by a cut this long (sheet units)…
const ACROSS = 0.8; // …and this many times the smaller one's width fill together

const TAG = /<(path|rect|circle|ellipse|polygon|polyline)\b[^>]*?\/?>/g;
const attr = (tag, name) =>
  (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
function setAttr(tag, name, value) {
  if (attr(tag, name) !== undefined)
    return tag.replace(new RegExp(`(\\s${name}=)"[^"]*"`), `$1"${value}"`);
  return tag.replace(/\s*(\/?>)$/, ` ${name}="${value}"$1`);
}

// The mask as path data in the coordinates `matrix` maps to the sheet.
function outline(mask, matrix) {
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let p = 0; p < W * H; p++)
    if (mask[p]) {
      const x = p % W,
        y = (p - x) / W;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  const local = invert(matrix);
  const point = ([x, y]) =>
    [
      local[0] * (x / SCALE) + local[2] * (y / SCALE) + local[4],
      local[1] * (x / SCALE) + local[3] * (y / SCALE) + local[5],
    ]
      .map((v) => +v.toFixed(1))
      .join(" ");
  return trace(mask, x0, y0, x1, y1)
    .map(simplify)
    .filter((loop) => loop.length >= 3)
    .map((loop) => "M" + loop.map(point).join("L") + "Z")
    .join("");
}

async function raster(svg) {
  const { data } = await sharp(Buffer.from(svg), { density: 72 * SCALE })
    .resize(W, H)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

// translate/scale/matrix lists, as [a b c d e f].
function parseTransform(text = "") {
  let m = [1, 0, 0, 1, 0, 0];
  for (const [, kind, args] of text.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    const t =
      kind === "translate"
        ? [1, 0, 0, 1, n[0], n[1] || 0]
        : kind === "scale"
          ? [n[0], 0, 0, n[1] ?? n[0], 0, 0]
          : kind === "matrix"
            ? n
            : null;
    if (!t) throw new Error(`transform ${kind}`);
    m = [
      m[0] * t[0] + m[2] * t[1],
      m[1] * t[0] + m[3] * t[1],
      m[0] * t[2] + m[2] * t[3],
      m[1] * t[2] + m[3] * t[3],
      m[0] * t[4] + m[2] * t[5] + m[4],
      m[1] * t[4] + m[3] * t[5] + m[5],
    ];
  }
  return m;
}
function multiply([a, b, c, d, e, f], [g, h, k, m, n, o]) {
  return [
    a * g + c * h,
    b * g + d * h,
    a * k + c * m,
    b * k + d * m,
    a * n + c * o + e,
    b * n + d * o + f,
  ];
}
function invert([a, b, c, d, e, f]) {
  const k = a * d - b * c;
  return [
    d / k,
    -b / k,
    -c / k,
    a / k,
    (c * f - d * e) / k,
    (b * e - a * f) / k,
  ];
}

// Closed loops along pixel edges around the mask, inside on the right.
function trace(mask, x0, y0, x1, y1) {
  const out = new Map(),
    key = (x, y) => y * (W + 1) + x,
    inside = (x, y) =>
      x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1,
    add = (ax, ay, bx, by) => {
      const k = key(ax, ay);
      if (!out.has(k)) out.set(k, []);
      out.get(k).push([bx, by]);
    };
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) add(x, y, x + 1, y);
      if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inside(x - 1, y)) add(x, y + 1, x, y);
    }
  const loops = [];
  for (const [start, ends] of out)
    while (ends.length) {
      const loop = [[start % (W + 1), Math.floor(start / (W + 1))]];
      let [x, y] = ends.pop();
      while (key(x, y) !== start) {
        loop.push([x, y]);
        [x, y] = out.get(key(x, y)).pop();
      }
      loops.push(loop);
    }
  return loops;
}
// Douglas–Peucker on a closed loop.
function simplify(loop) {
  const corners = loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length],
      b = loop[(i + 1) % loop.length];
    return (b[0] - a[0]) * (p[1] - a[1]) !== (b[1] - a[1]) * (p[0] - a[0]);
  });
  if (corners.length < 4) return corners;
  const keep = new Uint8Array(corners.length);
  let far = 0,
    best = -1;
  corners.forEach(([x, y], i) => {
    const d = (x - corners[0][0]) ** 2 + (y - corners[0][1]) ** 2;
    if (d > best) [best, far] = [d, i];
  });
  keep[0] = keep[far] = 1;
  const stack = [
    [0, far],
    [far, corners.length],
  ];
  while (stack.length) {
    const [i, j] = stack.pop(),
      a = corners[i],
      b = corners[j % corners.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let worst = 0,
      at = -1;
    for (let k = i + 1; k < j; k++) {
      const p = corners[k],
        d =
          Math.abs(
            (b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1]),
          ) / len;
      if (d > worst) [worst, at] = [d, k];
    }
    if (worst > TOLERANCE) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return corners.filter((_, i) => keep[i]);
}

// The sheet's regions, each pixel's region (1-based, 0 for none) and ink.
async function layers(svg) {
  // Each region with the transform of the groups around it.
  const regions = [],
    stack = [[1, 0, 0, 1, 0, 0]];
  for (const [tag] of svg.matchAll(
    /<g\b[^>]*>|<\/g>|<(?:path|rect|circle|ellipse|polygon|polyline)\b[^>]*?\/?>/g,
  )) {
    if (tag === "</g>") stack.pop();
    else if (tag.startsWith("<g"))
      stack.push(
        multiply(stack.at(-1), parseTransform(attr(tag, "transform"))),
      );
    else if (attr(tag, "data-region"))
      regions.push({ tag, id: attr(tag, "data-region"), outer: stack.at(-1) });
  }
  // Shapes inside clip paths, masks and defs only shape others: leave them.
  const kept = [...svg.matchAll(/<(defs|clipPath|mask)\b[\s\S]*?<\/\1>/g)].map(
    (m) => [m.index, m.index + m[0].length],
  );
  const drawn = (at) => !kept.some(([a, b]) => at >= a && at < b);
  let i = 0;
  const flat = svg.replace(TAG, (tag, _, at) => {
    if (!drawn(at)) return tag;
    if (!attr(tag, "data-region")) return setAttr(tag, "display", "none");
    const v = ++i * 8191;
    return setAttr(
      setAttr(tag, "fill", `rgb(${v >> 16},${(v >> 8) & 255},${v & 255})`),
      "stroke",
      "none",
    );
  });
  const lines = svg.replace(TAG, (tag, _, at) =>
    drawn(at) && attr(tag, "data-region")
      ? setAttr(tag, "display", "none")
      : tag,
  );
  const [paint, ink] = await Promise.all([raster(flat), raster(lines)]);
  const label = new Int32Array(W * H),
    inked = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const color =
      (paint[p * 4] << 16) | (paint[p * 4 + 1] << 8) | paint[p * 4 + 2];
    label[p] = color % 8191 === 0 && color / 8191 <= i ? color / 8191 : 0;
  }
  // Ink is what shows as a line on the 720px canvas: each 2×2 block whose
  // lines cover more than a sixth of it.
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const p = y * W + x,
        cover =
          ink[p * 4 + 3] +
          ink[(p + 1) * 4 + 3] +
          ink[(p + W) * 4 + 3] +
          ink[(p + W + 1) * 4 + 3];
      if (cover > 4 * 40)
        inked[p] = inked[p + 1] = inked[p + W] = inked[p + W + 1] = 1;
    }
  // Blended edge pixels take a neighbor's label.
  for (let pass = 0; pass < 2; pass++)
    for (let p = 0; p < W * H; p++)
      if (!label[p])
        for (const q of [p - 1, p + 1, p - W, p + W])
          if (q >= 0 && q < W * H && label[q]) {
            label[p] = label[q];
            break;
          }
  const kind = regions.map((r) =>
    r.id === "sky" ? "sky" : r.id.includes("backing") ? "backing" : "cell",
  );
  return { regions, label, inked, kind };
}

async function repartition(id) {
  const file = path.join(DIR, `${id}.svg`);
  let svg = fs.readFileSync(file, "utf8");
  const { regions, label, inked, kind } = await layers(svg);
  const before = regions.map((r) => r.tag);
  const N = W * H,
    steps = [1, -1, W, -W],
    near = (p, q) => q >= 0 && q < N && Math.abs((q % W) - (p % W)) <= 1;
  // How deep each pixel lies inside its region (steps to another region or
  // the ink).
  const depth = new Int16Array(N).fill(-1),
    ring = new Int32Array(N);
  let rh = 0,
    rt = 0;
  for (let p = 0; p < N; p++) {
    if (inked[p]) continue;
    const x = p % W;
    if (
      x === 0 ||
      x === W - 1 ||
      p < W ||
      p >= N - W ||
      [p - 1, p + 1, p - W, p + W].some(
        (q) => inked[q] || label[q] !== label[p],
      )
    ) {
      depth[p] = 0;
      ring[rt++] = p;
    }
  }
  while (rh < rt) {
    const p = ring[rh++];
    for (const q of [p - 1, p + 1, p - W, p + W])
      if (
        q >= 0 &&
        q < N &&
        depth[q] < 0 &&
        !inked[q] &&
        label[q] === label[p]
      ) {
        depth[q] = depth[p] + 1;
        ring[rt++] = q;
      }
  }
  // The areas: pixels off the ink and off the sky, connected. A gap in a
  // line narrower than CLOSE (a slip of the tracing) still parts them; a
  // wider opening, like a strand of hair that ends short of the outline,
  // does not.
  const sky = regions.findIndex((r) => r.id === "sky") + 1,
    wall = inked.slice();
  for (let r = 0; r < CLOSE; r++) {
    const grown = wall.slice();
    for (let p = 0; p < N; p++)
      if (!wall[p] && steps.some((s) => near(p, p + s) && wall[p + s]))
        grown[p] = 1;
    wall.set(grown);
  }
  for (let p = 0; p < N; p++) if (label[p] === sky) wall[p] = 1;
  const area = new Int32Array(N),
    queue = new Int32Array(N),
    target = new Int32Array(N);
  let areas = 0;
  const joins = [];
  for (let seed = 0; seed < N; seed++) {
    if (wall[seed] || area[seed]) continue;
    area[seed] = ++areas;
    let head = 0,
      tail = 0;
    queue[tail++] = seed;
    while (head < tail) {
      const p = queue[head++];
      for (const s of steps) {
        const q = p + s;
        if (near(p, q) && !wall[q] && !area[q]) {
          area[q] = areas;
          queue[tail++] = q;
        }
      }
    }
    const pixels = queue.slice(0, tail),
      count = new Map(),
      deep = new Map();
    for (const p of pixels) {
      count.set(label[p], (count.get(label[p]) || 0) + 1);
      deep.set(label[p], Math.max(deep.get(label[p]) || 0, depth[p]));
    }
    const thick = (l) => count.get(l) >= MIN_PART && deep.get(l) >= THICK,
      cells = [...count.keys()]
        .filter((l) => l && kind[l - 1] === "cell")
        .sort((x, y) => count.get(y) - count.get(x));
    let main = cells.filter((l, i) => i === 0 || thick(l));
    if (!main.length) main = [[...count].sort((x, y) => y[1] - x[1])[0][0]];
    // Every other pixel goes to the nearest main region in the area.
    head = 0;
    tail = 0;
    for (const p of pixels)
      if (main.includes(label[p])) {
        target[p] = label[p];
        queue[tail++] = p;
      }
    while (head < tail) {
      const p = queue[head++];
      for (const s of steps) {
        const q = p + s;
        if (near(p, q) && area[q] === areas && !target[q]) {
          target[q] = target[p];
          queue[tail++] = q;
        }
      }
    }
    // Two cells of an area split along a cut that runs right across the
    // smaller one were one part cut in two by the tracing: they fill
    // together. A cell beyond a gap in a line stays its own.
    const parts = main.filter((l) => kind[l - 1] === "cell");
    if (parts.length < 2) continue;
    const cut = new Map(),
      size = new Map();
    for (const p of pixels) {
      size.set(target[p], (size.get(target[p]) || 0) + 1);
      for (const q of [(p + 1) % W ? p + 1 : -1, p + W < N ? p + W : -1])
        if (q >= 0 && area[q] === areas && target[q] !== target[p]) {
          const pair = [target[p], target[q]].sort((x, y) => x - y).join(",");
          cut.set(pair, (cut.get(pair) || 0) + 1);
        }
    }
    for (const [pair, n] of cut) {
      const [x, y] = pair.split(",").map(Number);
      if (kind[x - 1] !== "cell" || kind[y - 1] !== "cell") continue;
      const length = n / SCALE,
        width = Math.sqrt(Math.min(size.get(x), size.get(y))) / SCALE;
      if (length >= MIN_CUT && length >= ACROSS * width) joins.push([x, y]);
    }
  }
  // Hair (hair-groups.json lists a point in each lock): the cells there,
  // and the pockets of backing among them go to the nearest of the cells.
  const hair = new Set(),
    pockets = new Set();
  for (const [x, y] of HAIR[id] || []) {
    let a = 0,
      at = -1;
    for (let r = 0; r <= 24 && !a; r++)
      for (let dy = -r; dy <= r && !a; dy++)
        for (let dx = -r; dx <= r && !a; dx++) {
          at = (Math.round(y * SCALE) + dy) * W + Math.round(x * SCALE) + dx;
          a = area[at];
        }
    if (!a) {
      console.warn(`${id}: no area near ${x},${y}; skipped`);
      continue;
    }
    // A point on a cell marks that cell; one on backing marks its pocket,
    // unless the backing there went to a cell, which may not be hair.
    if (kind[label[at] - 1] === "cell") hair.add(label[at]);
    else if (kind[target[at] - 1] === "backing") pockets.add(a);
    else console.warn(`${id}: ${x},${y} is not on a lock; skipped`);
  }
  if (pockets.size && hair.size) {
    const owner = new Int32Array(N);
    let head = 0,
      tail = 0;
    for (let p = 0; p < N; p++)
      if (hair.has(target[p])) {
        owner[p] = target[p];
        queue[tail++] = p;
      }
    while (head < tail) {
      const p = queue[head++];
      for (const s of steps) {
        const q = p + s;
        if (near(p, q) && !owner[q]) {
          owner[q] = owner[p];
          queue[tail++] = q;
        }
      }
    }
    for (let p = 0; p < N; p++) if (pockets.has(area[p])) target[p] = owner[p];
  }
  // The pixels beside the ink, inside the closed gaps, go to the nearest
  // area pixel; the sky keeps its own, and nothing turns into sky.
  {
    let head = 0,
      tail = 0;
    for (let p = 0; p < N; p++) if (target[p]) queue[tail++] = p;
    while (head < tail) {
      const p = queue[head++];
      for (const s of steps) {
        const q = p + s;
        if (near(p, q) && !target[q] && !inked[q] && label[q] !== sky) {
          target[q] = target[p];
          queue[tail++] = q;
        }
      }
    }
  }
  let moved = 0;
  for (let p = 0; p < N; p++)
    if (!target[p]) target[p] = label[p];
    else if (target[p] !== label[p]) moved++;

  // Fill groups for joined cells; two cells already in different groups
  // stay apart.
  const parent = regions.map((_, i) => i),
    groupOf = regions.map((r) => attr(r.tag, "data-fill-group") || null);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const rootGroup = new Map(regions.map((_, i) => [i, groupOf[i]]));
  // The hair is one group.
  for (const l of hair) {
    const root = find(l - 1);
    if (rootGroup.get(root) && rootGroup.get(root) !== "hair") {
      console.warn(
        `${id}: ${regions[l - 1].id} stays in ${rootGroup.get(root)}`,
      );
      hair.delete(l);
    } else rootGroup.set(root, "hair");
  }
  for (const l of [...hair].slice(1)) joins.unshift([[...hair][0], l]);
  for (const [x, y] of joins) {
    const [a, b] = [find(x - 1), find(y - 1)];
    if (a === b) continue;
    const [ga, gb] = [rootGroup.get(a), rootGroup.get(b)];
    // The sheets' own groups (a costume, a rose) stay as they were drawn,
    // and the hair takes only what was marked.
    if (
      (ga && ga !== "hair") ||
      (gb && gb !== "hair") ||
      (ga === "hair") !== (gb === "hair")
    )
      continue;
    parent[b] = a;
    rootGroup.set(a, ga || gb);
  }
  const sets = new Map();
  regions.forEach((_, i) => {
    if (!sets.has(find(i))) sets.set(find(i), []);
    sets.get(find(i)).push(i);
  });
  let joined = 0;
  for (const [root, list] of sets) {
    if (list.length < 2) continue;
    const name = rootGroup.get(root) || `joined-${regions[list[0]].id}`;
    for (const i of list)
      if (!groupOf[i]) {
        regions[i].tag = setAttr(regions[i].tag, "data-fill-group", name);
        joined++;
      }
  }

  // Every cell traced again from its pixels, a little under the ink.
  const mask = new Uint8Array(N);
  let traced = 0;
  regions.forEach((region, i) => {
    const l = i + 1;
    if (kind[i] !== "cell") return;
    if (!region.tag.startsWith("<path")) {
      console.warn(`${id}: ${region.id} is not a path; left as it is`);
      return;
    }
    mask.fill(0);
    let front = [];
    for (let p = 0; p < N; p++)
      if (target[p] === l) {
        mask[p] = 1;
        if (!inked[p]) front.push(p);
      }
    if (!front.length) return;
    for (let depth = 0; depth < INK_REACH; depth++) {
      const next = [];
      for (const p of front)
        for (const s of steps) {
          const q = p + s;
          if (near(p, q) && inked[q] && !mask[q]) {
            mask[q] = 1;
            next.push(q);
          }
        }
      front = next;
    }
    const d = outline(
      mask,
      multiply(region.outer, parseTransform(attr(region.tag, "transform"))),
    );
    region.tag = setAttr(setAttr(region.tag, "d", d), "fill-rule", "evenodd");
    traced++;
  });
  regions.forEach((region, i) => {
    if (region.tag !== before[i]) svg = svg.replace(before[i], region.tag);
  });
  fs.writeFileSync(file, svg);
  return { traced, joined, moved: Math.round(moved / 4) };
}

(async () => {
  const ids = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs
        .readdirSync(DIR)
        .filter((f) => f.endsWith("-clean.svg"))
        .map((f) => f.slice(0, -4));
  for (const id of ids) {
    const { traced, joined, moved } = await repartition(id);
    console.log(
      `${id}: ${moved} pixels (at 720px) change hands, ${traced} cells traced again, ${joined} joined`,
    );
  }
})();
