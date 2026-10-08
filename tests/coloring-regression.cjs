// Semantic regions are checked independently of the visible ink for every sheet.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  sharp = require("sharp");
(async () => {
  const catalog = JSON.parse(fs.readFileSync("assets/coloring/catalog.json"));
  const seeds = JSON.parse(fs.readFileSync("tests/coloring-seeds.json"));
  const clean = Object.fromEntries(
    JSON.parse(fs.readFileSync("assets/coloring/CLEAN-LINES-REPORT.json")).map(
      (i) => [i.id, i.seeds],
    ),
  );
  for (const item of catalog) {
    const bundle = JSON.parse(
      fs.readFileSync(`assets/coloring/prepared/${item.id}.json`),
    );
    const names = [""],
      colors = new Map();
    const labels = bundle.paint.replace(
      /<[^>]+data-region="([^"]+)"[^>]*>/g,
      (tag, id) => {
        const group = tag.match(/data-fill-group="([^"]+)"/)?.[1],
          key = group ? "group:" + group : id;
        if (!colors.has(key)) {
          names.push(key);
          colors.set(key, (names.length - 1) * 8191);
        }
        return tag.replace(
          /fill="[^"]*"/,
          `fill="#${colors.get(key).toString(16).padStart(6, "0")}"`,
        );
      },
    );
    const svg = (s) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bundle.viewBox.join(" ")}">${s}</svg>`;
    const labelPixels = await sharp(Buffer.from(svg(labels)))
      .resize(720, 880)
      .removeAlpha()
      .raw()
      .toBuffer();
    const before = await sharp(
      Buffer.from(fs.readFileSync(`assets/coloring/${item.id}.svg`)),
    )
      .resize(720, 880)
      .flatten({ background: "#fff" })
      .raw()
      .toBuffer();
    let checked = 0;
    const points = clean[item.id] || seeds[item.id] || seeds[item.simpleOf];
    for (const [x, y] of points) {
      const i = (Math.round(y * 2) * 720 + Math.round(x * 2)) * 3;
      if (before[i] < 245 || before[i + 1] < 245 || before[i + 2] < 245)
        continue;
      let name;
      for (let dy = -2; dy <= 2 && !name; dy++)
        for (let dx = -2; dx <= 2 && !name; dx++) {
          const at = i + (dy * 720 + dx) * 3;
          if (at < 0 || at + 2 >= labelPixels.length) continue;
          const value = labelPixels.readUIntBE(at, 3);
          const candidate = value % 8191 === 0 ? names[value / 8191] : null;
          if (candidate && candidate !== "sky") name = candidate;
        }
      assert.ok(
        name && name !== "sky",
        `${item.id}: character seed ${x},${y} belongs to ${name || "no region"}`,
      );
      checked++;
    }
    assert.ok(
      checked >= Math.min(3, points.length),
      `${item.id}: too few independently paintable character samples`,
    );
    console.log(`PASS ${item.id}: ${checked} independent semantic samples`);
  }
  console.log(`PASS all ${catalog.length} prepared region contracts`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
