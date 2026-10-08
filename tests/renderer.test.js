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
  assert.deepEqual(
    small.map((m) => m[3]),
    ["hsl(40 85% 65%)", "hsl(140 85% 65%)", "hsl(240 85% 65%)"],
  );
  assert.equal(small[0][2], 9);
  assert.equal(large[0][2], 18);
  assert.equal(small[0][1], null, "the first point paints a dot");
  assert.deepEqual(small[1][1], { x: 0, y: 0 });
  assert.equal(strokeColor({ tool: "eraser", color: "#fff" }, 99), "#fff");
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
