/**
 * Append a freehand sample and interpolate between distant samples.
 *
 * Pointer events can be coalesced on supported devices, but some Android
 * WebViews still deliver relatively sparse events during quick finger strokes.
 * Interpolation fills those gaps in document coordinates, keeping the brush
 * line visually continuous without changing the stroke's tool or style.
 */
export function appendInterpolatedStrokePoint(points, nextPoint, createPoint, spacing = 2) {
  if (!Array.isArray(points) || !nextPoint ||
      !Number.isFinite(Number(nextPoint.x)) || !Number.isFinite(Number(nextPoint.y)) ||
      typeof createPoint !== "function") return 0;

  const stepSize = Number(spacing);
  if (!Number.isFinite(stepSize) || stepSize <= 0) {
    throw new RangeError("Stroke interpolation spacing must be a positive finite number");
  }

  const next = { x: Number(nextPoint.x), y: Number(nextPoint.y) };
  const previous = points[points.length - 1];
  if (!previous) {
    points.push(createPoint(next.x, next.y));
    return 1;
  }

  const startX = Number(previous.x);
  const startY = Number(previous.y);
  if (!Number.isFinite(startX) || !Number.isFinite(startY)) return 0;
  const dx = next.x - startX;
  const dy = next.y - startY;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 0.01) return 0;

  const steps = Math.max(1, Math.ceil(distance / stepSize));
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    points.push(createPoint(startX + dx * progress, startY + dy * progress));
  }
  return steps;
}
