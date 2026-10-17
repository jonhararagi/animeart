export const CROP_SHAPE_KINDS = Object.freeze([
  "rectangle", "rounded", "circle", "ellipse", "triangle", "diamond",
  "pentagon", "hexagon", "octagon", "star", "heart"
]);

const CROP_SHAPE_SET = new Set(CROP_SHAPE_KINDS);

export function normalizeCropShape(kind) {
  const value = String(kind || "rectangle");
  return CROP_SHAPE_SET.has(value) ? value : "rectangle";
}

/**
 * Trace a crop-mask path in document/image pixel coordinates.
 * The caller owns filling, clipping, stroking, and the composite operation.
 */
export function traceCropShape(context, x, y, width, height, kind = "rectangle") {
  if (!context || typeof context.beginPath !== "function") {
    throw new TypeError("Crop-shape drawing requires a 2D canvas context");
  }
  const left = Number(x) || 0;
  const top = Number(y) || 0;
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const right = left + w;
  const bottom = top + h;
  const cx = left + w / 2;
  const cy = top + h / 2;
  const shape = normalizeCropShape(kind);
  const polygon = points => {
    if (!points.length) return;
    context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) context.lineTo(points[i][0], points[i][1]);
    context.closePath();
  };

  context.beginPath();
  if (shape === "rectangle") {
    context.rect(left, top, w, h);
  } else if (shape === "rounded") {
    const radius = Math.min(w, h) * 0.16;
    if (typeof context.roundRect === "function") {
      context.roundRect(left, top, w, h, radius);
    } else {
      context.moveTo(left + radius, top);
      context.lineTo(right - radius, top);
      context.quadraticCurveTo(right, top, right, top + radius);
      context.lineTo(right, bottom - radius);
      context.quadraticCurveTo(right, bottom, right - radius, bottom);
      context.lineTo(left + radius, bottom);
      context.quadraticCurveTo(left, bottom, left, bottom - radius);
      context.lineTo(left, top + radius);
      context.quadraticCurveTo(left, top, left + radius, top);
      context.closePath();
    }
  } else if (shape === "circle" || shape === "ellipse") {
    const rx = shape === "circle" ? Math.min(w, h) / 2 : w / 2;
    const ry = shape === "circle" ? Math.min(w, h) / 2 : h / 2;
    context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    context.closePath();
  } else if (shape === "triangle") {
    polygon([[cx, top], [right, bottom], [left, bottom]]);
  } else if (shape === "diamond") {
    polygon([[cx, top], [right, cy], [cx, bottom], [left, cy]]);
  } else if (shape === "pentagon" || shape === "hexagon" || shape === "octagon") {
    const sides = shape === "pentagon" ? 5 : shape === "hexagon" ? 6 : 8;
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / sides;
      points.push([cx + Math.cos(angle) * w / 2, cy + Math.sin(angle) * h / 2]);
    }
    polygon(points);
  } else if (shape === "star") {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 1 : 0.44;
      points.push([cx + Math.cos(angle) * w / 2 * radius, cy + Math.sin(angle) * h / 2 * radius]);
    }
    polygon(points);
  } else {
    context.moveTo(cx, bottom - h * 0.04);
    context.bezierCurveTo(cx - w * 0.12, bottom - h * 0.18, left + w * 0.04, top + h * 0.55, left + w * 0.06, top + h * 0.29);
    context.bezierCurveTo(left + w * 0.08, top + h * 0.02, cx - w * 0.12, top + h * 0.01, cx, top + h * 0.22);
    context.bezierCurveTo(cx + w * 0.12, top + h * 0.01, right - w * 0.08, top + h * 0.02, right - w * 0.06, top + h * 0.29);
    context.bezierCurveTo(right - w * 0.04, top + h * 0.55, cx + w * 0.12, bottom - h * 0.18, cx, bottom - h * 0.04);
    context.closePath();
  }
  return context;
}
