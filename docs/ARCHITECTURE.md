# Architecture

AnimeArt is a Web-first, local-first editor with a protected Android foundation. The two platforms have separate UI/runtime implementations, but each platform keeps one source of truth per responsibility.

## Web source of truth

The Web editor uses one persistent Document model:

UI
-> existing domain operation
-> Document mutation
-> DocumentHistory
-> existing local persistence
-> UI refresh

The browser session keeps Viewport and selection state outside the persisted Document. Rendering uses the existing Canvas 2D pipeline and the same Document/Layer data used by history and persistence.

## Web core responsibilities

- Document: web/domain/model.mjs is the single persistent document representation.
- Layer: the layers[] records in Document are the single representation for visibility, lock, opacity, ordering, transform, content type and Reference state.
- Stroke: createStroke / normalizeStroke in model.mjs are the single Web stroke representation. Active pointer drawing is transient interaction state and is committed as one history operation on pointer release.
- Viewport: web/domain/viewport.mjs owns zoom/pan session state. Viewport is not persisted with Document.
- Selection: web/domain/selection.mjs owns selection normalization, hit testing and transform geometry.
- Transform: web/domain/document-operations.mjs owns persisted transform mutation; selection.mjs calculates preview geometry.
- History: web/domain/history.mjs provides the single DocumentHistory boundary for Web undo/redo.
- Persistence: web/domain/image-import.mjs provides the existing localStorage serialization/storage boundary. T043 does not introduce another persistence system.
- Reference: isReference is a property of an existing Image Layer. There is no separate Reference model, store or renderer.
- Renderer: web/app.js contains the existing Canvas 2D document renderer and web/domain/png-export.mjs reuses it for PNG output; no second renderer is introduced.

## Web mutation rule

Completed persistent mutations must pass through the existing domain-operation boundary before History and Persistence. UI code may keep transient gesture state during pointer interaction, but it must not create a second persistent mutation path.

## Android

Android retains its existing Kotlin/Compose foundation and separate platform renderer. T043 does not alter Android architecture or introduce a shared runtime.

## Persistence and recovery

The Web document is serialized through the existing localStorage boundary. Recovery uses restoreDocument() and resets the same DocumentHistory instance. The viewport is session-only.

## Performance

Web transforms remain non-destructive: layer transforms are stored as metadata and applied at render time. Drawing commits one completed stroke as one history operation rather than recording every pointer point.

## Architecture rule

REUTILIZAR > ADAPTAR > CREAR

T043 does not introduce DocumentManager, LayerManager, HistoryManager, PersistenceManager, SelectionManager, TransformManager, ReferenceManager, RendererManager or equivalent parallel systems.


## T046 — Android Container Boundary Audit

T046 is an architecture audit, not an Android migration.

### Evidence

- Android currently owns a native Kotlin/Compose editor runtime:
  - `MainActivity` loads `ProjectPersistence` and supplies a `CanvasDocument` to `EditorScreen`.
  - `EditorScreen` renders through Compose Canvas and handles native pointer/gesture interaction.
  - `DrawingEditor` owns Android editor state, native command history, stroke interaction and document mutations through `DocumentReducer`.
  - `Models.kt` contains Android `CanvasDocument`, `Layer`, `Stroke`, `StrokePoint`, `Transform`, `Viewport` and `EditorState`.
  - `ProjectPersistence` stores Android documents through SharedPreferences/JSON.
  - `ViewportTransform` provides Android screen/document conversion.
- Web currently owns the Web editor runtime:
  - `web/domain/model.mjs` is the Web Document/Layer/Stroke boundary.
  - `document-operations.mjs` owns persistent Web layer/document mutations.
  - `history.mjs` owns the single Web `DocumentHistory`.
  - `viewport.mjs` owns Web session viewport and screen/document conversion.
  - `selection.mjs` owns Web selection/hit-test/transform geometry.
  - `image-import.mjs` owns the current Web localStorage persistence boundary.
  - `app.js` owns the existing Canvas 2D renderer and UI interaction wiring.
  - T045 adds the Web manifest and Service Worker offline shell.
- Repository-wide search found no existing `WebView`, `android.webkit`, `loadUrl`, `loadData`, `WebViewClient` or `JavascriptInterface` integration.

### Decision

**T046 selects Option B as the target architecture:**

`Web = primary editor/runtime; Android = container/WebView host.`

This is a target boundary, not a destructive migration. Android's existing editor remains intact until a future reversible container spike proves that the Web application can be packaged, loaded and interacted with reliably inside Android.

The eventual responsibility boundary is:

- **Web:** Document, Layer, Stroke, History, Viewport, Selection, Transform, Persistence and primary Renderer/UI.
- **Android:** application/container lifecycle, WebView hosting, local asset delivery, platform integration and future native bridges only where demonstrably necessary.
- **Domain:** remains defined by the Web editor contracts during the migration; no artificial cross-platform runtime is introduced in T046.
- **Renderer:** Web Canvas 2D becomes the primary editor renderer; the Android Compose renderer is transitional until container validation.
- **Persistence:** Web local persistence remains the Web editor boundary; Android ProjectPersistence remains untouched as a transitional legacy path.

### Why not Option C now?

The repository contains separate Kotlin and JavaScript implementations, and no existing shared runtime/serialization bridge exists. Creating a new cross-platform domain runtime during T046 would violate REUTILIZAR > ADAPTAR > CREAR and expand the scope unnecessarily.

### Migration guard

Do not remove `EditorScreen`, `DrawingEditor`, Compose Canvas, `ProjectPersistence` or other Android editor code until a separate container spike demonstrates:

1. APK installation;
2. MainActivity startup;
3. WebView creation;
4. Web app asset loading;
5. Web editor rendering;
6. basic pointer interaction;
7. offline shell behavior;
8. Android startup smoke;
9. Web CI and Android CI.

A later cleanup task may remove obsolete native editor code only after those conditions are green.
