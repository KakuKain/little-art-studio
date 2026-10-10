import test from "node:test";
import assert from "node:assert/strict";
import {
  createWork,
  record,
  moveCursor,
  addCheckpoint,
} from "../modules/history.js";
import {
  planReplay,
  strokePen,
  strokeColor,
  pixelPlacement,
} from "../modules/renderer.js";
import { createPainter } from "../modules/painter.js";
import { createCanvas } from "@napi-rs/canvas";

const stroke = (
  color,
  points = [
    [10, 10],
    [20, 10],
  ],
) => ({
  type: "stroke",
  tool: "pen",
  color,
  region: "sky",
  width: 6,
  hue: 0,
  points,
});

test("replay skips everything before the last clear and every undone action", () => {
  const work = createWork("kitty");
  record(work, { type: "fill", region: "sky", color: "pink" });
  record(work, stroke("red"));
  record(work, { type: "clear" });
  record(work, { type: "fill", region: "body", color: "blue" });
  record(work, stroke("green"));
  record(work, stroke("undone"));
  moveCursor(work, -1);
  const plan = planReplay(work);
  assert.equal(plan.cleared, true);
  assert.deepEqual(
    plan.fills.map((a) => a.color),
    ["blue"],
  );
  assert.deepEqual(
    plan.strokes.map((a) => a.color),
    ["green"],
  );
  assert.equal(plan.state, work.base);
});

test("replay starts from the newest usable checkpoint", () => {
  const work = createWork("kitty");
  for (let i = 0; i < 20; i++) record(work, stroke(String(i)));
  const state = { scene: "kitty", fills: [], pixels: "checkpoint" };
  addCheckpoint(work, state);
  record(work, stroke("after"));
  let plan = planReplay(work);
  assert.equal(plan.state, state);
  assert.equal(plan.cleared, false);
  assert.deepEqual(
    plan.strokes.map((a) => a.color),
    ["after"],
  );
  moveCursor(work, -2);
  plan = planReplay(work);
  assert.equal(plan.state, work.base);
  assert.equal(plan.strokes.length, 19);
});

test("strokes and rainbow colors replay identically at another canvas size", () => {
  const action = { ...stroke(), tool: "rainbow", hue: 40, width: 9 };
  const trace = (scale) => {
    const marks = [];
    const view = {
      surface: { x: 0, y: 0, w: 360, h: 440 },
      width: 360 * scale,
      height: 440 * scale,
    };
    const pen = strokePen(
      { mark: (...args) => marks.push(args) },
      action,
      view,
    );
    for (const [x, y] of [
      [0, 0],
      [30, 40],
      [60, 80],
    ])
      pen({ x: x * scale, y: y * scale });
    return marks;
  };
  const small = trace(1),
    large = trace(2);
  assert.deepEqual(
    small.map((m) => m[3]),
    large.map((m) => m[3]),
  );
  const hue = (stop) => +stop[1].match(/hsl\(([\d.]+)/)[1];
  const [dot, first, second] = small.map((m) => m[3]);
  assert.equal(dot, "hsl(40 85% 65%)", "the first point paints a dot");
  assert.deepEqual([hue(first[0]), hue(first.at(-1))], [40, 140]);
  assert.deepEqual(second[0], [0, first.at(-1)[1]], "segments join seamlessly");
  assert.equal(hue(second.at(-1)), 240);
  for (const stops of [first, second])
    for (let i = 1; i < stops.length; i++)
      assert.ok(Math.abs(hue(stops[i]) - hue(stops[i - 1])) <= 15);
  assert.equal(small[0][2], 9);
  assert.equal(large[0][2], 18);
  assert.equal(small[0][1], null);
  assert.deepEqual(small[1][1], { x: 0, y: 0 });
  assert.equal(strokeColor({ tool: "eraser", color: "#fff" }, 99), "#fff");
});

test("one long rainbow segment is a saturated gradient, not a solid block", () => {
  const canvas = createCanvas(400, 60),
    painter = createPainter(canvas, createCanvas(400, 60));
  painter.resize();
  const action = { ...stroke(), tool: "rainbow", hue: 0, width: 20 },
    view = { surface: { x: 0, y: 0, w: 400, h: 60 }, width: 400, height: 60 },
    pen = strokePen(painter, action, view);
  // Only two samples, as a fast swipe on a slow device produces.
  pen({ x: 20, y: 30 });
  pen({ x: 380, y: 30 });
  const pixels = canvas.getContext("2d").getImageData(0, 0, 400, 60).data;
  for (const x of [65, 110, 155, 245, 290, 335]) {
    const at = (30 * 400 + x) * 4,
      [r, g, b] = [0, 1, 2].map((k) => pixels[at + k] / 255),
      max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h =
      max === r
        ? ((g - b) / (max - min)) % 6
        : max === g
          ? (b - r) / (max - min) + 2
          : (r - g) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
    const expected = ((x - 20) * 2) % 360,
      gap = Math.min(Math.abs(h - expected), 360 - Math.abs(h - expected));
    assert.ok(gap < 12, `x=${x}: hue ${h.toFixed(1)}, expected ${expected}`);
    assert.ok(max - min > 0.3, `x=${x} must stay saturated`);
  }
});

test("checkpoint rasters return to the same SVG position", () => {
  const view = {
    surface: { x: -20, y: 10, w: 400, h: 500 },
    width: 800,
    height: 1000,
  };
  const state = { surface: { x: 0, y: 0, w: 360, h: 440 } };
  assert.deepEqual(pixelPlacement(state, view, false), [40, -20, 720, 880]);
  assert.deepEqual(pixelPlacement({}, view, true), [0, 0, 800, 1000]);
  assert.deepEqual(
    pixelPlacement({}, { ...view, width: 720, height: 1100 }, false),
    [0, 110, 720, 880],
  );
});
