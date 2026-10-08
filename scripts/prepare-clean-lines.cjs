// Prepare reviewed clothing / hair masks in the original tracing coordinate space.
const fs = require("fs"),
  sharp = require("sharp");
(async () => {
  let merida = fs
    .readFileSync("assets/coloring/merida.svg", "utf8")
    .replace(/(<g data-art-fit="true") transform="[^"]+"/, "$1");
  await sharp(Buffer.from(merida))
    .resize(1800, 2202)
    .png()
    .toFile("/tmp/merida-legacy-outline.png");
  merida = merida.replace(
    /(<path\b[^>]*data-region="sky"[^>]*fill=")white/,
    "$1black",
  );
  await sharp(Buffer.from(merida))
    .resize(1800, 2202)
    .png()
    .toFile("/tmp/merida-legacy-fill.png");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
