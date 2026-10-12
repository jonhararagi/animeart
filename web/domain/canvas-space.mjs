function finitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function documentCenter(documentModel) {
  const width = Number(documentModel?.width);
  const height = Number(documentModel?.height);
  return {
    x: finitePositive(width) ? width / 2 : 0,
    y: finitePositive(height) ? height / 2 : 0
  };
}

export function documentFitScale(documentModel, viewportSize) {
  const width = Number(documentModel?.width);
  const height = Number(documentModel?.height);
  const viewWidth = Number(viewportSize?.width);
  const viewHeight = Number(viewportSize?.height);
  if (!finitePositive(width) || !finitePositive(height) || !finitePositive(viewWidth) || !finitePositive(viewHeight)) return 1;
  return Math.min(viewWidth / width, viewHeight / height);
}

export function documentToScreenPoint(point, documentModel, viewport, viewportSize) {
  const center = documentCenter(documentModel);
  const viewWidth = Number(viewportSize?.width) || 0;
  const viewHeight = Number(viewportSize?.height) || 0;
  const zoom = Number(viewport?.zoom) > 0 ? Number(viewport.zoom) : 1;
  const scale = documentFitScale(documentModel, viewportSize) * zoom;
  return {
    x: viewWidth / 2 + (Number(point.x) - center.x) * scale + (Number(viewport?.panX) || 0),
    y: viewHeight / 2 + (Number(point.y) - center.y) * scale + (Number(viewport?.panY) || 0)
  };
}

export function screenToDocumentPoint(point, documentModel, viewport, viewportSize) {
  const center = documentCenter(documentModel);
  const viewWidth = Number(viewportSize?.width) || 0;
  const viewHeight = Number(viewportSize?.height) || 0;
  const zoom = Number(viewport?.zoom) > 0 ? Number(viewport.zoom) : 1;
  const scale = documentFitScale(documentModel, viewportSize) * zoom;
  if (!finitePositive(scale)) return center;
  return {
    x: (Number(point.x) - viewWidth / 2 - (Number(viewport?.panX) || 0)) / scale + center.x,
    y: (Number(point.y) - viewHeight / 2 - (Number(viewport?.panY) || 0)) / scale + center.y
  };
}

export function screenViewportForDocument(documentModel, viewport, viewportSize) {
  const center = documentCenter(documentModel);
  const scale = documentFitScale(documentModel, viewportSize) * (Number(viewport?.zoom) > 0 ? Number(viewport.zoom) : 1);
  return {
    zoom: scale,
    panX: (Number(viewportSize?.width) || 0) / 2 - center.x + (Number(viewport?.panX) || 0),
    panY: (Number(viewportSize?.height) || 0) / 2 - center.y + (Number(viewport?.panY) || 0)
  };
}

export function zoomViewportAt(viewport, nextZoom, screenPoint, documentModel, viewportSize) {
  const zoom = Number(nextZoom);
  if (!finitePositive(zoom)) return { ...viewport };
  const documentPoint = screenToDocumentPoint(screenPoint, documentModel, viewport, viewportSize);
  const center = documentCenter(documentModel);
  const width = Number(viewportSize?.width) || 0;
  const height = Number(viewportSize?.height) || 0;
  const scale = documentFitScale(documentModel, viewportSize) * zoom;
  return {
    zoom,
    panX: Number(screenPoint.x) - width / 2 - (documentPoint.x - center.x) * scale,
    panY: Number(screenPoint.y) - height / 2 - (documentPoint.y - center.y) * scale
  };
}
