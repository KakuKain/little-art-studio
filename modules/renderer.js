// Replays an editable work without DOM or module state, so live drawing and
// replay share one stroke implementation and both can run against any canvas.
import { replayStart } from "./history.js?v=47";

// Only actions after the last clear can affect the picture the child sees.
export function planReplay(work) {
  const start = replayStart(work),
    actions = work.actions.slice(start.cursor, work.cursor),
    clear = actions.findLastIndex((action) => action.type === "clear"),
    live = actions.slice(clear + 1);
  return {
    state: start.state,
    cleared: clear >= 0,
    fills: live.filter((action) => action.type === "fill"),
    strokes: live.filter((action) => action.type === "stroke"),
  };
}
export function strokeColor(action, distance) {
  return action.tool === "rainbow"
    ? `hsl(${(action.hue + distance * 2) % 360} 85% 65%)`
    : action.color;
}
// Returns a function that extends the stroke to each pixel point it receives.
// Rainbow hue advances with the distance travelled in SVG units, so a replay
// at another size reproduces the same colors.
export function strokePen(painter, action, view, mask = null) {
  const width = (action.width * view.width) / view.surface.w;
  let previous = null,
    distance = 0;
  return (p) => {
    if (previous)
      distance +=
        (Math.hypot(p.x - previous.x, p.y - previous.y) * view.surface.w) /
        view.width;
    painter.mark(
      p,
      previous,
      width,
      strokeColor(action, distance),
      action.tool === "eraser",
      mask,
    );
    previous = p;
  };
}
// Where a checkpoint's raster belongs in the current view: [x, y, w, h].
export function pixelPlacement(state, { surface, width, height }, blank) {
  if (state.surface) {
    const scale = width / surface.w;
    return [
      (state.surface.x - surface.x) * scale,
      (state.surface.y - surface.y) * scale,
      state.surface.w * scale,
      state.surface.h * scale,
    ];
  }
  if (blank) return [0, 0, width, height];
  // Drafts from before surfaces were stored used a fixed 720 × 880 sheet.
  const scale = Math.min(width / 720, height / 880);
  return [
    (width - 720 * scale) / 2,
    (height - 880 * scale) / 2,
    720 * scale,
    880 * scale,
  ];
}
