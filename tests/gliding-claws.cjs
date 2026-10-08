// Tiny claw interiors must be paintable cells, not the background or backing.
const fs = require("fs"),
  sharp = require("sharp");
(async () => {
  const source = fs.readFileSync(
    "assets/coloring/toothless-gliding-clean.svg",
    "utf8",
  );
  let names = [""];
  const labeled = source.replace(
    /(<path\b[^>]*data-region=")([^"]+)("[^>]*fill=")white/g,
    (_, a, n, b) => {
      names.push(n);
      return a + n + b + "#" + (names.length - 1).toString(16).padStart(6, "0");
    },
  );
  const labels = await sharp(Buffer.from(labeled))
    .resize(2880, 3520)
    .removeAlpha()
    .raw()
    .toBuffer();
  const pink = await sharp(
    Buffer.from(source.replace('fill="white"', 'fill="#ff7399"')),
  )
    .resize(2880, 3520)
    .removeAlpha()
    .raw()
    .toBuffer();
  const spots = [
    [174, 532],
    [181, 529],
    [186, 524],
    [242, 533],
    [249, 530],
    [254, 525],
  ];
  for (const [x, y] of spots) {
    let found = false;
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const i = ((y * 4 + dy) * 2880 + x * 4 + dx) * 3,
          v = labels.readUIntBE(i, 3);
        if (
          v > 1 &&
          v < names.length &&
          names[v].startsWith("cell") &&
          pink[i] > 250 &&
          pink[i + 1] > 250 &&
          pink[i + 2] > 250
        )
          found = true;
      }
    if (!found)
      throw Error(`claw ${x},${y} lacks a separately paintable white cell`);
  }
  console.log("PASS all six claw interiors are independent paintable cells");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
