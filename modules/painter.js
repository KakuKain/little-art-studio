// A color is a CSS color or gradient stops [[offset, color], …] along the segment.
function paintFor(ctx, color, from, p) {
  if (typeof color === "string") return color;
  // A gradient between identical points paints nothing; use the end color.
  if (from.x === p.x && from.y === p.y) return color.at(-1)[1];
  const gradient = ctx.createLinearGradient(from.x, from.y, p.x, p.y);
  for (const [offset, stop] of color) gradient.addColorStop(offset, stop);
  return gradient;
}
// Only the stroke's dirty rectangle is composited, not the entire canvas.
// Painters that never draw at the same time may share one ink buffer.
export function createPainter(canvas, ink = document.createElement("canvas")) {
  const ctx = canvas.getContext("2d");
  const inkCtx = ink.getContext("2d");
  return {
    resize() {
      ink.width = canvas.width;
      ink.height = canvas.height;
    },
    mark(p, from, width, color, eraser, mask) {
      from ||= p;
      const padding = width / 2 + 2;
      const x = Math.max(0, Math.floor(Math.min(from.x, p.x) - padding));
      const y = Math.max(0, Math.floor(Math.min(from.y, p.y) - padding));
      const w =
        Math.min(canvas.width, Math.ceil(Math.max(from.x, p.x) + padding)) - x;
      const h =
        Math.min(canvas.height, Math.ceil(Math.max(from.y, p.y) + padding)) - y;
      if (w <= 0 || h <= 0) return;
      inkCtx.save();
      inkCtx.beginPath();
      inkCtx.rect(x, y, w, h);
      inkCtx.clip();
      inkCtx.clearRect(x, y, w, h);
      inkCtx.globalCompositeOperation = "source-over";
      inkCtx.strokeStyle = inkCtx.fillStyle = paintFor(inkCtx, color, from, p);
      inkCtx.lineWidth = width;
      inkCtx.lineCap = inkCtx.lineJoin = "round";
      inkCtx.beginPath();
      if (from === p) {
        inkCtx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
        inkCtx.fill();
      } else {
        inkCtx.moveTo(from.x, from.y);
        inkCtx.lineTo(p.x, p.y);
        inkCtx.stroke();
      }
      if (mask) {
        inkCtx.globalCompositeOperation = "destination-in";
        inkCtx.drawImage(mask.canvas || mask, mask.x || 0, mask.y || 0);
      }
      inkCtx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
      ctx.drawImage(ink, 0, 0);
      ctx.restore();
    },
  };
}
