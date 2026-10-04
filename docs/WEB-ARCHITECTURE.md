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
