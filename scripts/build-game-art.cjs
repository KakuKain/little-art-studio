// Turns generated game pictures into the WebP files the app ships. The
// sources are transparent PNGs (about 1024px) and stay out of git, like the
// other raster originals:
//
// - animal-<id>.png, food-<id>.png: 動物餐廳 customers and foods, written to
//   assets/games/restaurant/.
// - game-<id>.png: a game's card on the home hub, written to assets/ui/.
// - restaurant-background-portrait.png, restaurant-background-landscape.png:
//   the 動物餐廳 room, cut into strips (see BACKDROP).
// - cat-<color>-<pose>.png (pose: head, lying, sitting), blocks-frame.png and
//   blocks-background-portrait|landscape.png: 方塊出門's cats, the fence
//   round its board and its room, written to assets/games/blocks/.
//
// Run it by hand after adding or redrawing a picture:
//
//   node scripts/build-game-art.cjs [source folder, default tmp/restaurant-art]
//
// Each animal, food and card picture is trimmed to its drawing and centered
// on a transparent square with a little room around the outline, so every
// animal (and every food) shows at the same size whatever margin the
// generator left. A cat is trimmed too but keeps its own shape, since it
// fills its block on the board.
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
// 方塊出門: a cell is at most 96 CSS px, so a cell's side is 192 pixels of a
// cat (two cells for a lying or sitting one). The fence is scaled to the
// board as a whole (see layout() in game-blocks.js), and the room covers the
// screen.
const BLOCKS = "assets/games/blocks";
const CAT_BOX = { head: [192, 192], lying: [384, 192], sitting: [192, 384] };
// The generated fence is scaled to 1024 pixels, where its wood is 88 pixels
// wide and each corner fits in 128. The fence written is 1600 pixels square,
// so its wood is 88/1600 of its side: thin enough beside 8 × 8 cells.
const FRAME_SOURCE = 1024,
  FRAME_CORNER = 128,
  FRAME = 1600;
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

// A generated frame's corners differ a little and its sides are not quite
// alike along their length. The fence is rebuilt from the top left corner:
// mirrored into the other three, with each side carrying on the corner's
// last row or column of pixels, so all four sides look the same.
async function seamlessFrame(file) {
  const half = FRAME / 2,
    last = FRAME_CORNER - 1,
    data = await sharp(file)
      .extract(await drawingBox(file))
      .resize(FRAME_SOURCE, FRAME_SOURCE, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer(),
    out = Buffer.alloc(FRAME * FRAME * 4);
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const sx = Math.min(x < half ? x : FRAME - 1 - x, last),
        sy = Math.min(y < half ? y : FRAME - 1 - y, last),
        from = (sy * FRAME_SOURCE + sx) * 4;
      // Inside the fence stays empty.
      if (sx < last || sy < last)
        data.copy(out, (y * FRAME + x) * 4, from, from + 4);
    }
  return sharp(out, { raw: { width: FRAME, height: FRAME, channels: 4 } });
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
  for (const name of fs.readdirSync(source).sort()) {
    const file = path.join(source, name);
    let picture, target;
    const cat = /^cat-[a-z]+-(head|lying|sitting)\.png$/.exec(name);
    if (cat) {
      const [width, height] = CAT_BOX[cat[1]];
      picture = sharp(file)
        .extract(await drawingBox(file))
        .resize(width, height, { fit: "inside" });
      target = name.replace(/\.png$/, ".webp");
    } else if (name === "blocks-frame.png") {
      picture = await seamlessFrame(file);
      target = "frame.webp";
    } else if (/^blocks-background-(portrait|landscape)\.png$/.test(name)) {
      picture = sharp(file);
      target = name.replace(/^blocks-background-(\w+)\.png$/, "room-$1.webp");
    } else continue;
    target = path.join(root, BLOCKS, target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await picture
      .webp({ quality: 84, alphaQuality: 90, smartSubsample: true, effort: 6 })
      .toFile(target);
    console.log(`${path.relative(root, target)} ${fs.statSync(target).size} B`);
    files.push(target);
  }
  console.log(`${files.length} pictures written`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
