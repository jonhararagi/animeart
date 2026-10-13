import { panBy } from "./viewport.mjs";
import { zoomViewportAt } from "./canvas-space.mjs";

function validPoint(point) {
  return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

export function midpointBetweenTouches(first, second) {
  if (!validPoint(first) || !validPoint(second)) throw new TypeError("Touch points must have finite x and y coordinates");
  return { x: (Number(first.x) + Number(second.x)) / 2, y: (Number(first.y) + Number(second.y)) / 2 };
}

export function distanceBetweenTouches(first, second) {
  if (!validPoint(first) || !validPoint(second)) throw new TypeError("Touch points must have finite x and y coordinates");
  return Math.hypot(Number(second.x) - Number(first.x), Number(second.y) - Number(first.y));
}

export function updatePinchPanViewport({
  startViewport,
  startDistance,
  currentDistance,
  startMidpoint,
  currentMidpoint,
  documentModel,
  viewportSize,
  minZoom = 0.25,
  maxZoom = 4
}) {
  if (!startViewport || !validPoint(startMidpoint) || !validPoint(currentMidpoint) ||
      !Number.isFinite(startDistance) || startDistance <= 0 ||
      !Number.isFinite(currentDistance) || currentDistance <= 0 ||
      !Number.isFinite(minZoom) || !Number.isFinite(maxZoom) || minZoom <= 0 || maxZoom < minZoom) {
    return { ...(startViewport || { zoom: 1, panX: 0, panY: 0 }) };
  }
  const startZoom = Number(startViewport.zoom) > 0 ? Number(startViewport.zoom) : 1;
  const zoom = Math.min(maxZoom, Math.max(minZoom, startZoom * currentDistance / startDistance));
  const zoomed = zoomViewportAt(startViewport, zoom, startMidpoint, documentModel, viewportSize);
  return panBy(zoomed, currentMidpoint.x - startMidpoint.x, currentMidpoint.y - startMidpoint.y);
}
