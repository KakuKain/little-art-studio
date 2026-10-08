// Prepare region-label renders for deterministic native SVG simplification.
const fs = require("fs"),
  sharp = require("sharp");
const ids = [
  "cinderella",
  "aurora",
  "ariel",
  "jasmine",
  "pocahontas",
  "mulan",
  "rapunzel",
  "merida",
  "moana",
  "elsa",
  "anna",
  "raya",
];
(async () => {
  fs.mkdirSync("/tmp/simple-art-labels", { recursive: true });
  for (const id of ids) {
    let s = fs.readFileSync("assets/coloring/" + id + ".svg", "utf8"),
      n = 0,
      mapping = {};
    s = s.replace(/<path\b[^>]*data-region="([^"]+)"[^>]*>/g, (tag, key) => {
      if (key === "sky") return tag.replace(/fill="[^"]+"/, 'fill="#000000"');
      const value = ++n * 8191;
      mapping[value] = key;
      return tag.replace(
        /fill="[^"]+"/,
        `fill="#${value.toString(16).padStart(6, "0")}"`,
      );
    });
    await sharp(Buffer.from(s))
      .resize(1800, 2200)
      .png()
      .toFile("/tmp/simple-art-labels/" + id + ".png");
    fs.writeFileSync(
      "/tmp/simple-art-labels/" + id + ".json",
      JSON.stringify(mapping),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
