# AnimeArt Web Architecture

## T020 verified boundary

The Web foundation is additive to the existing Android editor. Android remains native Kotlin/Compose; Web uses browser DOM + Canvas. The platforms do not share renderers.

## Current Web foundation

- `web/index.html` is the browser entry point.
- `web/app.js` owns the current browser UI/interaction wiring.
- `web/domain/model.mjs` is the current Web domain boundary for document/layer persistence shape.
- `web/test/` contains Node tests for the domain and entrypoint smoke checks.
- `web/scripts/build.mjs` produces a static `dist/` tree.
- `web/package.json` has only build/test tooling and no runtime dependency.

## Reuse boundary

Android already has canonical concepts for `CanvasDocument`, `Layer`, `Stroke`, `StrokePoint`, `Viewport`, `CommandHistory`, transforms and persistence. The Web prototype mirrors those concepts but does not duplicate Android classes across platforms.

The Web model currently represents the subset needed by the foundation: document metadata, ordered layers, visibility/lock/opacity/transform metadata and strokes. Viewport history and advanced persistence are intentionally not implemented yet.

## Renderer rule

Android Compose Canvas and Web Canvas are separate platform renderers. No universal renderer is introduced.

## Persistence rule

The current Web persistence boundary is browser `localStorage`. T020 fixes legacy-project restoration so the existing v1 shape is migrated before normalization; no advanced storage layer is introduced.

## Deferred stages

Zoom/pan state, Web undo/redo, richer transforms, durable project storage, PWA/offline packaging and Android WebView/container integration remain later stages. They are not silently represented as implemented by the foundation.

## T021 — Web domain contracts

The Web domain remains plain JavaScript ES modules and does not duplicate Android Kotlin classes.

### Contract boundary

- **Document**: versioned plain data with dimensions and an ordered non-empty layer list.
- **Layer**: stable id, name, visibility, lock state, opacity, transform and drawing strokes.
- **LayerContent**: not introduced as a separate Web runtime abstraction yet. The current Web foundation has one supported content kind (drawing), represented directly by `layer.strokes`. Introducing a tagged content hierarchy before another content type exists would add abstraction without behavior.
- **Stroke**: minimal drawing record containing `tool`, positive `size` and a point list.
- **StrokePoint**: minimal `x/y` coordinate record. Pressure, timestamp and tilt are not added because the Web editor does not currently consume them.
- **Transform**: plain `x/y/scale/rotation` data. It is layer metadata and remains independent from Canvas APIs.
- **Viewport**: not implemented as a Web domain contract in T021. The current Web pan behavior is still presentation-only and is not promoted into a domain model. T022 may introduce the minimum pure viewport contract before implementing real navigation.

### Domain invariants

Normalization and restoration now enforce the minimum Web contract:

- restored documents have the current document version and at least one layer;
- layer opacity is clamped to 0..1;
- transform coordinates/rotation are finite and scale is positive;
- strokes have a positive size and an array of valid points;
- stroke points contain finite numeric coordinates;
- legacy v1 migration continues to run before current normalization.

`isValidDocument()` provides a pure validation boundary for the normalized model.

### Reuse decision

Android remains the canonical reference for the conceptual vocabulary (`CanvasDocument`, `Layer`, `LayerContent`, `Stroke`, `StrokePoint`, `Transform`, `Viewport`). Web reuses those concepts as compatible plain-data contracts without importing Kotlin implementation details or creating a shared runtime layer.