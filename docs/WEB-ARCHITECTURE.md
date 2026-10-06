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

## T022 — Web Viewport / Zoom / Pan

### Coordinate boundary

The Web editor keeps three coordinate concepts separate:

1. Pointer/screen coordinates: CSS-pixel coordinates relative to the canvas element client rectangle.
2. Document coordinates: coordinates stored by StrokePoint. They are never mutated by viewport zoom or pan.
3. Canvas backing pixels: physical bitmap resolution. Existing devicePixelRatio scaling is applied once by the renderer and is not part of document/viewport math.

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

### Persistence

Viewport is intentionally view/session state in T022 and is not persisted with the project document.


## T022 — Final verification

T022 is merged in main at 0eaa9856432ce07911acf270e3010fe93a8b4d43. Web viewport state remains session/view state and is intentionally excluded from persisted project data.

CI evidence:
- Pre-merge Web CI 37245025099 (#15): SUCCESS.
- Pre-merge Android CI 37245025092 (#114): SUCCESS, including startup smoke and artifact.
- Post-merge Web CI 37245195503 (#16): SUCCESS.
- Post-merge Android CI 37245195488 (#115): SUCCESS, including startup smoke and artifact.
- Both Android smoke runs reported Status: ok, MainActivity resumed, zero FATAL EXCEPTION, zero skipped-frame matches and zero Davey matches.

PR #2 remains open and untouched. Advanced pinch/gesture navigation remains deferred.


## T023 — Web Interaction Stabilization

### Stable interaction boundary

The existing Pointer Events pipeline remains the only Web input system: pointerdown / pointermove / pointerup / pointercancel / wheel.

Pointer/screen coordinates are read from the canvas client rectangle. Drawing converts them exactly once through `screenToDocument(screenPoint, state.viewport, canvasCenter())`; stored `StrokePoint` values remain document coordinates.

Pan uses the same Pointer Events and `setPointerCapture`. It updates only `state.viewport` through `panBy()`. It does not create strokes, mutate StrokePoint values, mutate Layer Transform, or apply `canvas.style.transform`.

A drawing interaction tracks its `pointerId`. Starting Pan explicitly cancels any drawing state, and drawing move/up handlers only accept the active drawing pointer. This prevents a tool transition or unrelated pointer from extending or finalizing the previous stroke accidentally.

### Transform separation

Rendering preserves the order:

StrokePoint → Layer Transform → Document presentation → Viewport Transform → Screen.

Layer transform remains layer metadata. Viewport remains session state. Neither transform layer writes into the other, and zoom/pan do not modify the persisted document.

### DPR / resize

`devicePixelRatio` is used only to size the Canvas backing store and to establish the initial drawing context scale. Resize does not rewrite document coordinates, layer transforms, or viewport state.

### T023 verification contract

The regression suite covers zoom, pan, zoom+pan, screen/document round-trip, viewport non-mutation, StrokePoint/Layer Transform independence and the Web persistence boundary. Advanced pinch/inertia remains deferred.


### T023 — CI evidence update

- PR #8, branch `t023-web-interaction-stabilization`.
- Web CI run #19 / ID `37253397457`: SUCCESS — Build, Test, Verify build output.
- Android CI run #118 / ID `37253397430`: SUCCESS — Build, Unit Tests, Lint, Android Startup Smoke, Upload debug APK.
- Startup smoke: Status ok; Activity `com.jonhararagi.animeart/.MainActivity`; MainActivity resumed.
- APK artifact: `animeart-debug-apk`, artifact ID `11321618030`, SHA-256 `c395bfc83a021f5cbf94c2b1a982a7ae590638e41f3a711ff38595bc42922c79`.
- Evidence is real GitHub Actions evidence for the functional T023 commit. A fresh CI run is required after this documentation-only update so the final branch head is also verified.


## T023 — Final post-merge verification

T023 is GREEN and merged in main at `65818d34c56dfd38273cc176f80d7e5f9346e0a1`.

- PR #8: merged.
- Web CI #21 / `37253850888`: SUCCESS on the merge commit.
- Android CI #120 / `37253850885`: SUCCESS on the merge commit, including Build, Unit Tests, Lint, Startup Smoke and APK artifact.
- The final interaction boundary remains Pointer Events → SCREEN → Viewport → DOCUMENT → Stroke → Layer → Canvas.
- No Android implementation changes were required by T023.
- T024 Web Undo / Redo is now the next authorized task.


## T024 — Web Undo / Redo

### Frontera de historial

El Web Editor mantiene una única frontera `Document → History`. La implementación está en `web/domain/history.mjs` y utiliza snapshots lógicos del modelo existente mediante `normalizeDocument`. No existe un segundo Document, Layer, Stroke, Renderer, Viewport o sistema de persistencia.

La entrada histórica representa una transición completa `before → after`. Para dibujo, el snapshot inicial se toma en `pointerdown` y se registra una única vez en `pointerup`, por lo que un stroke completo es una sola operación aunque tenga múltiples `pointermove`.

### Operaciones cubiertas

- Crear stroke: Undo elimina el stroke; Redo lo restaura.
- Múltiples strokes: Undo/Redo conserva el orden.
- Nueva operación después de Undo: limpia la rama Redo.
- Clear Layer: reversible.
- Create Layer: reversible y conserva el ID de la capa restaurada.
- Undo/Redo vacío: no-op seguro.

### Separación Viewport / Document

History solo recibe snapshots de Document. `zoomAt`, `panBy` y `setViewport` no llaman al historial. Undo/Redo reemplazan `state.document` sin modificar `state.viewport`.

### Persistencia

Se conserva el `localStorage` existente. Después de una mutación histórica o edición reversible se serializa el Document actual; el Viewport queda fuera del JSON persistido.

### Mutation safety

Los snapshots se clonan con serialización lógica y se normalizan mediante el modelo existente antes de almacenarse/restaurarse. Esto evita que mutaciones posteriores del Document actual alteren estados históricos.

### UI mínima

Se añadieron botones Undo/Redo a la toolbar existente. Su estado habilitado/deshabilitado deriva directamente de History.

### T024 — Evidencia de verificación

Implementación y tests preparados en la rama T024. La clasificación final depende de Web CI, Android CI, regresión T023, merge y CI sobre el HEAD final de main.


## T024 — Final verification

T024 is merged in main at `315729eb7fbed720dd2cb7ab75273cdaf3dc8342`.

The Web history boundary is now integrated into main with one logical Document history system. Stroke, Clear Layer and Create Layer are reversible; a new operation after Undo clears Redo; Viewport/zoom/pan remain outside History; persistence continues through the existing localStorage boundary; snapshots are mutation-safe.

CI evidence on the T024 merge head:
- Web CI run #24 / ID `37259286027`: SUCCESS — Build, Test, Verify build output.
- Android CI run #123 / ID `37259286008`: SUCCESS — Build, Unit Tests, Lint, Android Startup Smoke Test, APK artifact.

A final CI run on the post-merge documentation HEAD is required before declaring T024 GREEN.


## T025 — Web Layer Transform Boundary

### Auditoría y decisión

T025 auditó Document/Layer/Stroke/StrokePoint, Viewport, History, Renderer, persistence, selection, transforms, image/reference layer, PWA y Android container. La siguiente dependencia arquitectónica identificada fue estabilizar las mutaciones de `Layer.transform`: el modelo ya tenía el contrato, el renderer ya lo presentaba y History ya podía registrar cambios de Document.

Por eso T025 no introduce un segundo transform system ni adelanta Reference Layer. Se crea una única frontera de operaciones de Document para transformación de Layer y se adapta la UI existente para consumirla.

### Transform boundary

`web/domain/document-operations.mjs` proporciona:

- `updateLayerTransform(document, layerId, patch)`
- `translateLayer(document, layerId, deltaX, deltaY)`
- `scaleLayer(document, layerId, factor)`
- `rotateLayer(document, layerId, degrees)`

Estas funciones trabajan sobre copias normalizadas del Document. Viewport permanece separado: Layer Transform ocurre en Document/Layer space y Viewport se aplica después en presentación.

### History

Cada operación de transformación se registra como una única entrada en el `DocumentHistory` existente. Undo/Redo no modifica `state.viewport`.

### Tests

Se añadió `web/test/transform.test.mjs` con happy path, inmutabilidad, preservación de ejes existentes, invalid state y Undo/Redo. La suite existente de T021–T024 continúa ejecutándose.

### CI

- Web CI #29 / `37267420167`: SUCCESS.
- Android CI #128 / `37267420194`: SUCCESS.

El merge y la verificación sobre el HEAD final de main son la última etapa de T025.


## T026 — Selection / Bounding Box / Visual Layer Transform

T026 extiende la frontera existente:

Canvas → Selection / Interaction → document-operations → DocumentHistory

y mantiene separada:

Viewport → Zoom / Pan

### Selection

selectedLayerId sigue siendo el único identificador de selección. El modo Select consulta el Layer seleccionado y, cuando corresponde, realiza hit-testing sobre los Layers visibles desde arriba hacia abajo. No se añadió otro estado persistente de selección.

### Bounding Box

web/domain/selection.mjs calcula bounds locales a partir de Stroke/StrokePoint existentes, incluyendo el grosor del stroke. Las esquinas se transforman con Layer.transform y luego se proyectan con el Viewport existente a coordenadas Screen. El overlay se dibuja en el mismo Canvas y después de la presentación del documento; no existe un segundo Canvas ni un CSS transform.

### Handles

- cuatro handles de esquina para Scale;
- un handle superior de Rotate;
- la región interior del polígono transformado actúa como Move target.

El hit-testing de handles se hace en Screen; el hit-testing del Layer se hace en Document después de screenToDocument(). Esto conserva la frontera Screen → Viewport → Document.

### Transformación y History

Durante el drag, state.transformInteraction.previewTransform es transitorio y solo afecta la presentación. En pointerup, la operación final se convierte a translateLayer(), scaleLayer() o rotateLayer() sobre el Document existente. Se registra exactamente una entrada de DocumentHistory por drag efectivo. pointercancel elimina el preview sin modificar el Document ni crear una entrada.

### Drawing / Pan

Drawing mantiene su drawingPointerId y strokeBefore. Pan mantiene panPointerId y solo modifica state.viewport. El modo Select evita que la manipulación visual se mezcle con Drawing o Pan.

### No implementado en T026

Multi-selection, grouping, snapping, guides/rulers, image import, Reference Layer, PWA, IA y editor Android paralelo.


## T038 — Multi-selection / Group Move Foundation

T038 adapts the existing Web selection boundary instead of introducing a second selection manager.

### Selection contract

- `selectedLayerIds` is the ordered set of selected Layer IDs.
- `selectedLayerId` remains the anchor/primary layer for compatibility with existing single-layer transforms and UI.
- `normalizeLayerSelection()` filters unknown IDs and removes duplicates.
- `toggleLayerSelection()` implements additive selection.
- Shift+click is the only new selection gesture; ordinary click preserves single-selection behavior.

### Group movement

The existing coordinate boundary remains:

Pointer Screen → `screenToDocument()` → Layer Transform → Viewport presentation.

`translateLayers()` is an immutable Document operation. A multi-layer drag uses a transient preview delta and commits exactly once through the existing `DocumentHistory` and local persistence on pointerup. A locked member blocks the entire group move atomically.

Scale/rotation of multiple layers and persistent grouping are intentionally deferred. The current layer bounding boxes and anchor handles remain the existing selection geometry, so T038 does not create a parallel group-transform renderer.

### Regression boundary

Android remains untouched. The Web renderer, viewport, history and persistence implementations remain the same systems used by T037.
