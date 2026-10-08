// Use sharp for SVG rendering: npm install sharp (offline build tool only).
const sharp = require("sharp"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const catalog = JSON.parse(fs.readFileSync("assets/coloring/catalog.json"));
  const report = fs.existsSync("assets/coloring/FIT-REPORT.json")
    ? JSON.parse(fs.readFileSync("assets/coloring/FIT-REPORT.json"))
    : {};
  for (const item of catalog) {
    const filename = `assets/coloring/${item.id}.svg`;
    let source = fs.readFileSync(filename, "utf8");
    if (source.includes("data-art-fit")) continue;
    const { data, info } = await sharp(Buffer.from(source))
      .resize(720, 880)
      .flatten({ background: "#fff" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let x0 = info.width,
      y0 = info.height,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    const width = (x1 - x0 + 1) / 2,
      height = (y1 - y0 + 1) / 2,
      scale = Math.min(320 / width, 396 / height),
      dx = 180 - (scale * (x0 + x1)) / 4,
      dy = 220 - (scale * (y0 + y1)) / 4;
    const opening = source.indexOf(">") + 1;
    const content = source.slice(opening, source.lastIndexOf("</svg>"));
    const sky = content.match(/<path\b[^>]*data-region="sky"[^>]*\/>/)[0];
    source =
      source.slice(0, opening) +
      sky +
      `<g data-art-fit="true" transform="translate(${dx.toFixed(4)} ${dy.toFixed(4)}) scale(${scale.toFixed(6)})">` +
      content.replace(sky, "") +
      "</g></svg>";
    fs.writeFileSync(filename, source);
    report[item.id] = {
      scale: +scale.toFixed(6),
      dx: +dx.toFixed(4),
      dy: +dy.toFixed(4),
      before: [width, height],
      after: [width * scale, height * scale],
    };
  }
  fs.writeFileSync(
    "assets/coloring/FIT-REPORT.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(`Fitted ${Object.keys(report).length} sheets without clipping`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
