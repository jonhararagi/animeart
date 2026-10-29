const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
function anchors(bounds) {
  return [
    { value: finite(bounds.left), kind: "edge-start" },
    { value: (finite(bounds.left) + finite(bounds.right)) / 2, kind: "center" },
    { value: finite(bounds.right), kind: "edge-end" }
  ];
}
/** Calculate document-space snapping corrections and transient alignment guides. */
export function getSmartSnapAdjustment({ movingBounds, otherBounds = [], canvasWidth, canvasHeight, threshold = 8, includeCanvas = true } = {}) {
  if (!movingBounds || ![movingBounds.left, movingBounds.right, movingBounds.top, movingBounds.bottom].every(Number.isFinite)) {
    return { dx: 0, dy: 0, guides: [], snapped: false };
  }
  const tolerance = Math.max(0, finite(threshold, 8));
  const targets = [];
  if (includeCanvas && Number.isFinite(canvasWidth) && Number.isFinite(canvasHeight)) {
    targets.push({ id: "canvas", bounds: { left: 0, top: 0, right: canvasWidth, bottom: canvasHeight } });
  }
  for (const item of otherBounds) {
    if (!item || item.id === movingBounds.id || !item.bounds) continue;
    if (![item.bounds.left, item.bounds.right, item.bounds.top, item.bounds.bottom].every(Number.isFinite)) continue;
    targets.push(item);
  }
  const candidates = { x: [], y: [] };
  for (const target of targets) {
    for (const a of anchors(movingBounds)) for (const b of anchors(target.bounds)) {
      const delta = b.value - a.value;
      if (Math.abs(delta) <= tolerance) candidates.x.push({ delta, coordinate: b.value, targetId: target.id, kind: b.kind });
    }
    const movingY = anchors({ left: movingBounds.top, right: movingBounds.bottom });
    const targetY = anchors({ left: target.bounds.top, right: target.bounds.bottom });
    for (const a of movingY) for (const b of targetY) {
      const delta = b.value - a.value;
      if (Math.abs(delta) <= tolerance) candidates.y.push({ delta, coordinate: b.value, targetId: target.id, kind: b.kind });
    }
  }
  const best = axis => candidates[axis].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0] || null;
  const x = best("x"), y = best("y"), guides = [];
  if (x) guides.push({ axis: "vertical", coordinate: x.coordinate, targetId: x.targetId, kind: x.kind });
  if (y) guides.push({ axis: "horizontal", coordinate: y.coordinate, targetId: y.targetId, kind: y.kind });
  return { dx: x?.delta || 0, dy: y?.delta || 0, guides, snapped: Boolean(x || y) };
}
