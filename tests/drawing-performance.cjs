// Exercise the production renderer without a browser or private app globals.
const { createCanvas } = require("@napi-rs/canvas");
const assert = require("node:assert/strict");
(async () => {
  global.document = { createElement: () => createCanvas(720, 1400) };
  const { createPainter } = await import("../modules/painter.js");
  for (const masked of [false, true]) {
    const canvas = createCanvas(720, 1400),
      painter = createPainter(canvas),
      mask = createCanvas(720, 1400);
    const mc = mask.getContext("2d");
    mc.fillStyle = "white";
    mc.fillRect(0, 0, 360, 1400);
    painter.resize();
    const points = Array.from({ length: 240 }, (_, i) => ({
      x: 100 + i,
      y: 250 + Math.sin(i / 15) * 100,
    }));
    const started = performance.now();
    points.forEach((p, i) =>
      painter.mark(
        p,
        i ? points[i - 1] : null,
        24,
        "#ff7399",
        false,
        masked ? mask : null,
      ),
    );
    const ms = performance.now() - started,
      ctx = canvas.getContext("2d"),
      pixels = ctx.getImageData(0, 0, 720, 1400).data;
    assert.ok(
      pixels.some((v, i) => i % 4 === 3 && v),
      "no brush pixels",
    );
    if (masked)
      for (let y = 0; y < 1400; y++)
        for (let x = 360; x < 720; x++)
          assert.equal(
            pixels[(y * 720 + x) * 4 + 3],
            0,
            "brush escaped its initial region",
          );
    const point = points[0];
    painter.mark(point, null, 32, "white", true, masked ? mask : null);
    assert.equal(
      ctx.getImageData(point.x, point.y, 1, 1).data[3],
      0,
      "eraser must remove the local stroke",
    );
    assert.ok(
      ms < 1000,
      `240 stroke segments exceeded a one-second regression budget: ${ms}ms`,
    );
    console.log(
      `PASS ${masked ? "region-clipped" : "blank"} brush and local eraser: ${ms.toFixed(1)} ms / 240 segments`,
    );
  }
  const fullMask = createCanvas(720, 1400),
    croppedMask = createCanvas(120, 80);
  fullMask.getContext("2d").fillRect(260, 300, 120, 80);
  croppedMask.getContext("2d").fillRect(0, 0, 120, 80);
  const rendered = [fullMask, { canvas: croppedMask, x: 260, y: 300 }].map(
    (mask) => {
      const canvas = createCanvas(720, 1400),
        painter = createPainter(canvas);
      painter.resize();
      painter.mark(
        { x: 450, y: 340 },
        { x: 180, y: 340 },
        40,
        "#ff7399",
        false,
        mask,
      );
      painter.mark(
        { x: 300, y: 410 },
        { x: 300, y: 250 },
        24,
        "#8056aa",
        false,
        mask,
      );
      painter.mark(
        { x: 390, y: 345 },
        { x: 350, y: 345 },
        20,
        "white",
        true,
        mask,
      );
      return canvas.getContext("2d").getImageData(0, 0, 720, 1400).data;
    },
  );
  assert.deepEqual(
    rendered[1],
    rendered[0],
    "cropped masks must preserve their canvas offset and clipping",
  );
  assert.equal(
    rendered[1][(340 * 720 + 200) * 4 + 3],
    0,
    "offset mask leaked on its left",
  );
  assert.ok(
    rendered[1][(340 * 720 + 270) * 4 + 3] > 0,
    "offset mask lost an interior stroke",
  );
  console.log(
    "PASS cropped region masks retain offset, edge clipping, and local eraser behavior",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
