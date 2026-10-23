/**
 * Draw a smooth, round-capped path through recorded freehand samples.
 *
 * Quadratic midpoint segments soften the angular look of raw pointer samples.
 * The first and final recorded points remain the exact ends of the path.
 * Input points are validated before mutating the supplied canvas context.
 */
export function traceSmoothStrokePath(context, points) {
  if (!context || typeof context.beginPath !== "function" ||
      typeof context.moveTo !== "function" || typeof context.lineTo !== "function" ||
      !Array.isArray(points) || points.length === 0) {
    return false;
  }

  for (const point of points) {
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
      return false;
    }
  }
  if (points.length > 2 && typeof context.quadraticCurveTo !== "function") return false;

  const first = points[0];
  context.beginPath();
  context.moveTo(Number(first.x), Number(first.y));

  if (points.length === 1) {
    // A zero-length segment plus round line caps creates a clean brush tap.
    context.lineTo(Number(first.x), Number(first.y));
    return true;
  }

  if (points.length === 2) {
    context.lineTo(Number(points[1].x), Number(points[1].y));
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

/**
 * Reflect stroke samples around the vertical document centre line.
 * Returns fresh points and leaves the source stroke untouched.
 */
export function mirrorFreehandPoints(points, documentWidth) {
  const width = Number(documentWidth);
  if (!Array.isArray(points) || points.length === 0 ||
      !Number.isFinite(width) || width <= 0 ||
      points.some(point => !point ||
        !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y)))) {
    return null;
  }
  return points.map(point => ({ ...point, x: width - Number(point.x), y: Number(point.y) }));
}
