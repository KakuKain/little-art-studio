import test from "node:test";
import assert from "node:assert/strict";
import {
  surfaceFor,
  sameSurface,
  canvasHeight,
  toWorld,
  toPixel,
} from "../modules/surface.js";

const viewports = [
  { width: 390, height: 700 },
  { width: 844, height: 300 },
  { width: 768, height: 860 },
  { width: 1100, height: 560 },
  { width: 320, height: 420 },
];
const sheets = [
  undefined,
  { w: 264, h: 400 },
  { w: 324, h: 322, cx: 170, cy: 230 },
];

test("the whole character stays visible inside the insets at every size", () => {
  for (const rect of viewports)
    for (const bounds of sheets) {
      const s = surfaceFor(rect, { bounds }),
        box = bounds || { w: 360, h: 440 },
        scale = rect.width / s.w,
        cx = box.cx ?? 180,
        cy = box.cy ?? 220;
      const left = (cx - box.w / 2 - s.x) * scale,
        right = (cx + box.w / 2 - s.x) * scale,
        top = (cy - box.h / 2 - s.y) * scale,
        bottom = (cy + box.h / 2 - s.y) * scale;
      assert.ok(left >= 16 - 1e-6 && right <= rect.width - 16 + 1e-6);
      assert.ok(top >= 64 - 1e-6 && bottom <= rect.height - 24 + 1e-6);
      assert.ok(Math.abs(s.w / s.h - rect.width / rect.height) < 1e-9);
    }
});

test("a blank canvas covers the full sheet without distortion", () => {
  for (const rect of viewports) {
    const s = surfaceFor(rect, { blank: true });
    assert.ok(s.x <= 0 && s.y <= 0 && s.x + s.w >= 360 && s.y + s.h >= 440);
    assert.ok(Math.abs(s.w / s.h - rect.width / rect.height) < 1e-9);
  }
});

test("a hidden paper falls back to the sheet size instead of NaN", () => {
  const s = surfaceFor({ width: 0, height: 0 }, { blank: true });
  assert.deepEqual(s, { x: 0, y: 0, w: 360, h: 440 });
  assert.ok(Number.isFinite(surfaceFor({ width: 0, height: 0 }).w));
});

test("SVG-space points survive a change of view", () => {
  const a = { surface: surfaceFor(viewports[0]), width: 720 },
    b = { surface: surfaceFor(viewports[1]), width: 720 };
  a.height = canvasHeight(a.surface);
  b.height = canvasHeight(b.surface);
  const world = toWorld({ x: 300.25, y: 512.5 }, a);
  const back = toWorld(toPixel(world, b), b);
  assert.ok(Math.abs(back[0] - world[0]) < 0.002);
  assert.ok(Math.abs(back[1] - world[1]) < 0.002);
  assert.ok(sameSurface(a.surface, { ...a.surface, x: a.surface.x + 0.001 }));
  assert.ok(!sameSurface(a.surface, b.surface));
});
