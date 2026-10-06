# AnimeArt

AnimeArt is a Web-first, local-first drawing and image-editing editor with an Android foundation kept green by CI.

## Current Web editor

The Web editor currently provides:

- document creation with validated dimensions;
- drawing with brush, eraser, color, size and opacity controls;
- ordered layers with rename, duplicate, delete, reorder, visibility, lock and opacity;
- image layers and local image import;
- viewport zoom/pan with Screen ↔ Document coordinate conversion;
- single-layer selection with bounding box, move, scale and rotation;
- multi-selection with Shift+click and grouped layer movement;
- undo/redo through the single DocumentHistory boundary;
- local persistence and project recovery;
- local PNG export using the existing document renderer.

The project remains dependency-light and local-first. Core editor data stays in the browser; no cloud or external AI service is required for the current editor flow.

## Architecture rule

**REUTILIZAR > ADAPTAR > CREAR**

The Web editor keeps one Document, Layer, Stroke, Viewport, Selection, Transform, History, Persistence and Canvas-rendering boundary. Platform-specific Android and Web implementations remain separate; no parallel universal renderer or shared runtime was introduced.

## Android

The repository also contains the Kotlin/Compose Android foundation. Android changes are kept independent unless a task demonstrates a real shared-architecture requirement. Android CI includes build, unit tests, lint and startup smoke verification.

## Build

Web:

    cd web
    npm install
    npm run build
    npm test

Android:

    gradle assembleDebug
    gradle test

See `docs/CONTINUITY.md` for the authoritative project handoff and CI evidence.
