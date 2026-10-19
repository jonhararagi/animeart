/**
 * Draw a smooth, round-capped path through freehand pointer samples.
 * Quadratic midpoints soften high-frequency pointer jitter while preserving
 * the first and last recorded coordinates.
 */
export function traceSmoothStrokePath(context, points) {
  if (!context || typeof context.beginPath !== "function" || !Array.isArray(points) || points.length === 0) {
    return false;
  }

  for (const point of points) {
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return false;
  }

  const first = points[0];
  context.beginPath();
  context.moveTo(Number(first.x), Number(first.y));

  if (points.length === 1) {
    // With lineCap="round", a zero-length segment paints a clean tap/dot.
    context.lineTo(Number(first.x), Number(first.y));
    return true;
  }

  if (points.length === 2) {
    const last = points[1];
    context.lineTo(Number(last.x), Number(last.y));
    return true;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(
      Number(current.x),
      Number(current.y),
      (Number(current.x) + Number(next.x)) / 2,
      (Number(current.y) + Number(next.y)) / 2
    );
  }

  const last = points[points.length - 1];
  context.lineTo(Number(last.x), Number(last.y));
  return true;
}
