// Renders the installable app icons from icon.svg. Run it by hand after
// changing icon.svg; it is not part of npm run build because PNG encoding may
// differ across platforms and would break CI's no-diff check.
//
// - app-icon-192/512.png: the rounded icon, for launchers that use it as is.
// - app-icon-maskable-512.png: full-bleed background with the pencil inside
//   the central safe zone, so Android can crop it to any launcher shape.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "icon.svg"), "utf8");
const out = (name) => path.join(root, "assets/ui", name);
const inner = source
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/<rect[^>]*\/>/, "");
// The pencil spans roughly x 43–162, y 30–141. Center it and keep it well
// inside the 40%-radius safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="#fff6e9"/><g transform="translate(96 96) scale(0.85) translate(-102.5 -85.5)">${inner}</g></svg>`;

(async () => {
  for (const size of [192, 512])
    await sharp(Buffer.from(source))
      .resize(size, size)
      .png()
      .toFile(out(`app-icon-${size}.png`));
  await sharp(Buffer.from(maskable))
    .resize(512, 512)
    .png()
    .toFile(out("app-icon-maskable-512.png"));
  console.log("App icons written to assets/ui/");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
