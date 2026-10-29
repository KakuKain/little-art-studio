import test from "node:test";
import assert from "node:assert/strict";
import {
  surfaceFor,
  sameSurface,
  canvasHeight,
  toWorld,
  toPixel,
  previewCrop,
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

test("an album preview fills the 360:440 frame without cutting the sheet", () => {
  const ratio = 360 / 440,
    inside = (c, width, height) =>
      c.x >= -1e-6 &&
      c.y >= -1e-6 &&
      c.x + c.w <= width + 1e-6 &&
      c.y + c.h <= height + 1e-6;
  // A tall phone canvas: the crop is the sheet itself.
  const phone = surfaceFor({ width: 375, height: 650 }),
    tall = previewCrop(phone, {}, 720, 1248);
  assert.ok(Math.abs(tall.w / tall.h - ratio) < 1e-9);
  assert.ok(inside(tall, 720, 1248));
  assert.ok(
    Math.abs(tall.w - (360 / phone.w) * 720) < 1e-6,
    "the sheet's width",
  );
  // A wide canvas: the frame is as tall as the sheet and centred on it.
  const wide = surfaceFor({ width: 1000, height: 500 }),
    crop = previewCrop(wide, {}, 720, 360);
  assert.ok(Math.abs(crop.w / crop.h - ratio) < 1e-9);
  assert.ok(inside(crop, 720, 360));
  assert.ok(
    Math.abs(crop.h - (440 / wide.h) * 360) < 1e-6,
    "the sheet's height",
  );
  // Bounds wider than the frame widen it, and it still stays inside.
  const bounds = { w: 318.5, h: 194, cx: 182.875, cy: 210.625 },
    pair = previewCrop(
      surfaceFor({ width: 375, height: 650 }, { bounds }),
      { bounds },
      720,
      1248,
    );
  assert.ok(Math.abs(pair.w / pair.h - ratio) < 1e-9);
  assert.ok(inside(pair, 720, 1248));
  // A blank canvas is shown whole.
  assert.deepEqual(previewCrop(phone, { blank: true }, 720, 1248), {
    x: 0,
    y: 0,
    w: 720,
    h: 1248,
  });
});
