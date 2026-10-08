// Renders a small WebP preview of every catalog sheet for the category grid
// and offline packs, so neither downloads the full source SVG.
//
// Each thumbnail is re-encoded only when its source or these settings change.
// manifest.json records the source hash, which keeps the CI freshness check
// independent of platform-specific encoder output.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");

const SETTINGS = { width: 360, height: 440, quality: 80, effort: 6 };
const root = path.resolve(__dirname, "..");
const folder = path.join(root, "assets/coloring");
const output = path.join(folder, "thumbs");
const manifestPath = path.join(output, "manifest.json");

(async () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(folder, "catalog.json")),
  );
  fs.mkdirSync(output, { recursive: true });
  const previous = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath))
    : {};
  const manifest = {};
  let rendered = 0;
  for (const { id } of catalog) {
    const source = fs.readFileSync(path.join(folder, `${id}.svg`));
    const hash = crypto
      .createHash("sha256")
      .update(source)
      .update(JSON.stringify(SETTINGS))
      .digest("hex")
      .slice(0, 16);
    const target = path.join(output, `${id}.webp`);
    manifest[id] = hash;
    if (previous[id] === hash && fs.existsSync(target)) continue;
    await sharp(source)
      .resize(SETTINGS.width, SETTINGS.height, {
        fit: "contain",
        background: "#fff",
      })
      .flatten({ background: "#fff" })
      .webp({ quality: SETTINGS.quality, effort: SETTINGS.effort })
      .toFile(target);
    rendered++;
  }
  for (const file of fs.readdirSync(output))
    if (file.endsWith(".webp") && !manifest[file.slice(0, -5)])
      fs.unlinkSync(path.join(output, file));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `Thumbnails: ${rendered} rendered, ${catalog.length - rendered} unchanged`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
