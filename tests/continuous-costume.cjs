// Regression: the simplified costume must be one paint shape, without rectangular holes.
const fs = require("fs"),
  assert = require("assert/strict"),
  sharp = require("sharp");
(async () => {
  const cases = [
    [
      "anna",
      "cape",
      [
        [94, 224, 108, 224],
        [245, 118, 254, 118],
      ],
    ],
    [
      "elsa",
      "dress",
      [
        [171, 340, 190, 340],
        [180, 360, 180, 397],
      ],
    ],
    [
      "moana",
      "skirt",
      [
        [262, 282, 273, 300],
        [268, 309, 275, 326],
      ],
    ],
  ];
  for (const [name, group, lines] of cases) {
    let source = fs.readFileSync(`assets/coloring/${name}-simple.svg`, "utf8");
    const tags =
      source.match(/<path\b[^>]*data-fill-group="[^"]+"[^>]*>/g) || [];
    assert.equal(
      tags.filter((t) => t.includes(`data-fill-group="${group}"`)).length,
      1,
      `${name}: one union paint region`,
    );
    source = source.replace(/<path\b[^>]*data-fill-group="[^"]+"[^>]*>/g, (t) =>
      t.replace(/fill="[^"]*"/, 'fill="#ff00ff"'),
    );
    const { data, info } = await sharp(Buffer.from(source))
      .resize(1440, 1760)
      .flatten({ background: "#fff" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const [x0, y0, x1, y1] of lines) {
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
      for (let step = 0; step <= steps; step++) {
        const x = Math.round((x0 + ((x1 - x0) * step) / steps) * 4),
          y = Math.round((y0 + ((y1 - y0) * step) / steps) * 4),
          i = (y * info.width + x) * info.channels;
        assert(
          data[i] > 240 && data[i + 1] < 15 && data[i + 2] > 240,
          `${name}: paint discontinuity at ${x / 4},${y / 4}`,
        );
      }
    }
    console.log(`PASS ${name}: continuous paint across former patch seams`);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
