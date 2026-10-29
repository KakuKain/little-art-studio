// Turns generated game pictures into the WebP files the app ships. The
// sources are transparent PNGs (about 1024px) and stay out of git, like the
// other raster originals:
//
// - animal-<id>.png, food-<id>.png: 動物餐廳 customers and foods, written to
//   assets/games/restaurant/.
// - game-<id>.png: a game's card on the home hub, written to assets/ui/.
// - restaurant-background-portrait.png, restaurant-background-landscape.png:
//   the 動物餐廳 room, cut into strips (see BACKDROP).
//
// Run it by hand after adding or redrawing a picture:
//
//   node scripts/build-game-art.cjs [source folder, default tmp/restaurant-art]
//
// Each picture is trimmed to its drawing and centered on a transparent square
// with a little room around the outline, so every animal (and every food)
// shows at the same size whatever margin the generator left.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = path.resolve(root, process.argv[2] ?? "tmp/restaurant-art");
const OUTPUT = {
  animal: "assets/games/restaurant",
  food: "assets/games/restaurant",
  game: "assets/ui",
};
// An animal shows at about 120 CSS px on a phone (170px on a tablet), a food
// at about 50px (60px) and a hub card at about 120px; these sizes stay sharp
// on 3× phone screens.
const SIZES = { animal: 384, food: 192, game: 384 };
const PADDING = 0.04;
// The room is cut into four strips so it fits any screen without cropping:
// the wall with its decorations, a few rows of plain stripes, the counter's
// top edge and a few rows of plain panels. The plain rows are all alike, so
// the page stretches them as tall as it needs below the wall and below the
// counter's edge. Rows measured on the 2026-10-28 pictures; remeasure them
// after redrawing the room.
const BACKDROP = {
  portrait: {
    wall: [0, 690],
    stripes: 800,
    counter: [908, 1050],
    panels: 1200,
  },
  landscape: { wall: [0, 450], stripes: 600, counter: [773, 850], panels: 900 },
};

// The bounding box of the visible drawing.
async function drawingBox(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[y * info.width + x] > 16) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < 0) throw new Error(`${file} is empty`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

(async () => {
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  const files = fs
    .readdirSync(source)
    .filter((name) => /^(animal|food|game)-[a-z]+\.png$/.test(name))
    .sort();
  for (const name of files) {
    const kind = name.split("-")[0],
      file = path.join(source, name),
      size = SIZES[kind],
      pad = Math.round(size * PADDING),
      target = path.join(root, OUTPUT[kind], name.replace(/\.png$/, ".webp"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(file)
      .extract(await drawingBox(file))
      .resize(size - 2 * pad, size - 2 * pad, {
        fit: "contain",
        background: clear,
      })
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: clear,
      })
      .webp({ quality: 86, alphaQuality: 90, smartSubsample: true, effort: 6 })
      .toFile(target);
    console.log(`${path.relative(root, target)} ${fs.statSync(target).size} B`);
  }
  for (const [shape, rows] of Object.entries(BACKDROP)) {
    const file = path.join(source, `restaurant-background-${shape}.png`);
    if (!fs.existsSync(file)) continue;
    const { width } = await sharp(file).metadata();
    const strips = {
      wall: rows.wall,
      stripes: [rows.stripes, rows.stripes + 8],
      counter: rows.counter,
      panels: [rows.panels, rows.panels + 8],
    };
    for (const [part, [top, bottom]] of Object.entries(strips)) {
      const target = path.join(
        root,
        OUTPUT.animal,
        `room-${part}-${shape}.webp`,
      );
      await sharp(file)
        .extract({ left: 0, top, width, height: bottom - top })
        .webp({ quality: 82, smartSubsample: true, effort: 6 })
        .toFile(target);
      console.log(
        `${path.relative(root, target)} ${fs.statSync(target).size} B`,
      );
      files.push(target);
    }
  }
  console.log(`${files.length} pictures written`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
