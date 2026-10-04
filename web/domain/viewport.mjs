const DEFAULT_VIEWPORT = Object.freeze({ zoom: 1, panX: 0, panY: 0 });

function finite(value) {
  return Number.isFinite(Number(value));
}

export function createViewport(zoom = 1, panX = 0, panY = 0) {
  return normalizeViewport({ zoom, panX, panY });
}

export function normalizeViewport(viewport) {
  const zoom = Number(viewport?.zoom);
  return {
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_VIEWPORT.zoom,
    panX: finite(viewport?.panX) ? Number(viewport.panX) : DEFAULT_VIEWPORT.panX,
    panY: finite(viewport?.panY) ? Number(viewport.panY) : DEFAULT_VIEWPORT.panY
  };
}

export function isValidViewport(viewport) {
  return Boolean(viewport && Number.isFinite(viewport.zoom) && viewport.zoom > 0 && Number.isFinite(viewport.panX) && Number.isFinite(viewport.panY));
}

export function screenToDocument(point, viewport, center = { x: 0, y: 0 }) {
  const view = normalizeViewport(viewport);
  return {
    x: (point.x - center.x - view.panX) / view.zoom + center.x,
    y: (point.y - center.y - view.panY) / view.zoom + center.y
  };
}

export function documentToScreen(point, viewport, center = { x: 0, y: 0 }) {
  const view = normalizeViewport(viewport);
  return {
    x: (point.x - center.x) * view.zoom + center.x + view.panX,
    y: (point.y - center.y) * view.zoom + center.y + view.panY
  };
}

export function zoomAt(viewport, nextZoom, screenPoint, center = { x: 0, y: 0 }) {
  const current = normalizeViewport(viewport);
  const zoom = Number(nextZoom);
  if (!Number.isFinite(zoom) || zoom <= 0) return current;
  const documentPoint = screenToDocument(screenPoint, current, center);
  return {
    zoom,
    panX: screenPoint.x - center.x - (documentPoint.x - center.x) * zoom,
    panY: screenPoint.y - center.y - (documentPoint.y - center.y) * zoom
  };
}

export function panBy(viewport, deltaX, deltaY) {
  const current = normalizeViewport(viewport);
  return { ...current, panX: current.panX + Number(deltaX || 0), panY: current.panY + Number(deltaY || 0) };
}
