# AnimeArt Web Architecture

## T020 verified boundary

The Web foundation is additive to the existing Android editor. Android remains native Kotlin/Compose; Web uses browser DOM + Canvas. The platforms do not share renderers.

## Current Web foundation

- web/index.html is the browser entry point.
- web/app.js owns the browser UI/interaction wiring.
- web/domain/model.mjs is the Web domain boundary for document/layer persistence shape.
- web/domain/viewport.mjs is the pure Web viewport and coordinate-math boundary.
- web/test/ contains Node tests for domain contracts, viewport math and entrypoint smoke checks.
- web/scripts/build.mjs produces a static dist tree.
- web/package.json has only build/test tooling and no runtime dependency.

## Reuse boundary

Android already has canonical concepts for CanvasDocument, Layer, Stroke, StrokePoint, Viewport, CommandHistory, transforms and persistence. The Web implementation reuses those concepts as compatible plain-data contracts without duplicating Android classes across platforms.

## Renderer rule

Android Compose Canvas and Web Canvas are separate platform renderers. No universal renderer is introduced.

## Persistence rule

The current Web persistence boundary is browser localStorage. Viewport is session/view state in T022 and is not persisted with the project document.

## T021 — Web domain contracts

The Web domain remains plain JavaScript ES modules and does not duplicate Android Kotlin classes. Document restoration continues through restoreDocument -> migrateLegacyDocument -> normalizeDocument.

### Contract boundary

- Document: versioned plain data with dimensions and an ordered non-empty layer list.
- Layer: stable id, name, visibility, lock state, opacity, transform and drawing strokes.
- LayerContent: not introduced as a separate Web runtime abstraction yet; the current Web foundation has one supported content kind (drawing).
- Stroke: minimal drawing record containing tool, positive size and document-coordinate points.
- StrokePoint: minimal x/y document coordinate record.
- Transform: plain x/y/scale/rotation layer metadata, independent from Canvas APIs.
- Viewport: Web view state containing zoom, panX and panY; pure, validated and independent of the DOM.

## T022 — Web Viewport / Zoom / Pan

### Coordinate boundary

The Web editor keeps three coordinate concepts separate:

1. Pointer/screen coordinates: CSS-pixel coordinates relative to the canvas element client rectangle.
2. Document coordinates: the coordinates stored by StrokePoint. They are never mutated by viewport zoom or pan.
3. Canvas backing pixels: the physical canvas bitmap resolution. Existing devicePixelRatio scaling is applied once by the renderer and is not part of document/viewport math.

The viewport is applied once at presentation time around the canvas center:

screen = (document - center) * zoom + center + pan.

The inverse is:

document = (screen - center - pan) / zoom + center.

Pointer input is converted with screenToDocument before creating or extending strokes. Rendering applies the viewport with one Canvas transform before drawing the document.

### Viewport contract

Defaults are zoom=1, panX=0, panY=0. Zoom must be finite and > 0; pan values must be finite. Invalid constructed values normalize to safe defaults. Viewport is session state and is not stored in localStorage project data in T022.

### Interaction

- Wheel zooms in/out around the pointer location and clamps the session zoom to a centralized safe range of 0.25..4.
- Pan tool + Pointer Events changes viewport pan state only; it never creates a stroke.
- Existing Pointer Events are reused for drawing and pan. No parallel mouse/touch event system is introduced.
- Pinch, inertia, animation and advanced navigation remain deferred.

### Layer transform vs viewport

Layer transforms remain part of Layer metadata and are applied in document space before the viewport presentation transform. Viewport does not mutate Layer Transform and does not alter stored StrokePoint coordinates.

## Deferred stages

Web undo/redo, richer transforms, durable project storage, PWA/offline packaging, pinch gestures and Android WebView/container integration remain later stages.
