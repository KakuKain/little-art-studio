// Fits artwork into the visible paper. Pure geometry: no DOM, no module state.
export const SHEET = { width: 360, height: 440 };
export const INSETS = { top: 64, bottom: 24, side: 16 };
export const CANVAS_WIDTH = 720;

// Returns the SVG-space window that fills `rect` while keeping the character's
// bounds completely visible: never crop a head, foot, wing or tail.
export function surfaceFor(rect, { blank = false, bounds } = {}) {
  const width = rect.width > 0 ? rect.width : SHEET.width,
    height = rect.height > 0 ? rect.height : SHEET.height;
  if (blank) {
    const ratio = width / height,
      w = Math.max(SHEET.width, SHEET.height * ratio),
      h = Math.max(SHEET.height, SHEET.width / ratio);
    return { x: (SHEET.width - w) / 2, y: (SHEET.height - h) / 2, w, h };
  }
  const box = bounds || { w: SHEET.width, h: SHEET.height };
  const { top, bottom, side } = INSETS;
  const scale = Math.min(
    Math.max(1, width - side * 2) / box.w,
    Math.max(1, height - top - bottom) / box.h,
  );
  const w = width / scale,
    h = height / scale;
  return {
    x: (box.cx ?? SHEET.width / 2) - w / 2,
    y: (box.cy ?? SHEET.height / 2) - h / 2 - (top - bottom) / (2 * scale),
    w,
    h,
  };
}
export function sameSurface(a, b, epsilon = 0.01) {
  return (
    !!a &&
    !!b &&
    ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) < epsilon)
  );
}
export function canvasHeight(surface, width = CANVAS_WIDTH) {
  return Math.round((width * surface.h) / surface.w);
}
// A view is a surface rendered into a canvas of width × height pixels.
// Strokes are stored in SVG space so they survive resizes and rotation.
export function toWorld(p, { surface, width, height }) {
  return [
    Math.round((surface.x + (p.x * surface.w) / width) * 1000) / 1000,
    Math.round((surface.y + (p.y * surface.h) / height) * 1000) / 1000,
  ];
}
export function toPixel([x, y], { surface, width, height }) {
  return {
    x: ((x - surface.x) * width) / surface.w,
    y: ((y - surface.y) * height) / surface.h,
  };
}
