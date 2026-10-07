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
