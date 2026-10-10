ANIMEART — CONTINUITY

DÍA:
1

ESTADO:
IMPLEMENTACIÓN INICIAL REALIZADA EN main. El repositorio estaba prácticamente vacío y ahora contiene la fundación Android. BUILD/TEST VERIFICADO EN GITHUB ACTIONS. La ejecución real #6 terminó correctamente.

IMPLEMENTADO:
- Proyecto Android Kotlin/Compose.
- Activity y pantalla inicial de editor.
- Canvas base con pan/pinch zoom.
- Document model.
- Layer model y operaciones básicas.
- Viewport model.
- Editor state model.
- Command/undo/redo foundation.
- Local recovery persistence foundation.
- Image import abstraction.
- BackgroundRemovalEngine y ShadingEngine contracts.
- Filter y StylePreset models.
- Unit tests iniciales.
- GitHub Actions build/test workflow.
- Arquitectura, dependencias, reuse audit y performance docs.

ARCHIVOS IMPORTANTES:
- app/build.gradle.kts
- app/src/main/java/com/jonhararagi/animeart/MainActivity.kt
- app/src/main/java/com/jonhararagi/animeart/ui/EditorScreen.kt
- app/src/main/java/com/jonhararagi/animeart/document/Models.kt
- app/src/main/java/com/jonhararagi/animeart/document/DocumentReducer.kt
- app/src/main/java/com/jonhararagi/animeart/editor/CommandHistory.kt
- app/src/main/java/com/jonhararagi/animeart/persistence/ProjectPersistence.kt
- docs/REUSE-AUDIT.md
- docs/ARCHITECTURE.md
- docs/CONTINUITY.md

TESTS:
- DocumentReducerTest added.
- CI workflow configured to run assembleDebug and test.
- Execution result: SUCCESS — GitHub Actions run #6 (commit be1bd6e02c55ba7eae2c6d64f2e5e680ea650e59).

ERRORES:
- CI #2 y #3 detectaron incompatibilidad JVM y errores de compilación Compose; fueron corregidos en los commits d6be0aaabdd8aca37eda12c3df590cfccf579a66, 418c6da81de4530852a62ea6d4939bc51f768a58, 5de9e6afa038a0f7ccd2fe1b2a3f8b047b06649d y be1bd6e02c55ba7eae2c6d64f2e5e680ea650e59. La CI #6 confirmó build y unit tests exitosos.

RIESGOS:
- GitHub Actions muestra un warning no bloqueante al empaquetar libandroidx.graphics.path.so sin strip; la librería se empaqueta sin strip y el build termina correctamente.
- GitHub Actions muestra además un warning de deprecación de Node 20 en acciones v4; es warning del runner, no un fallo del proyecto.
- Theme/resource setup may need adjustment during first build.
- Recovery serialization is intentionally partial on Day 1.

DECISIONES ARQUITECTÓNICAS:
- REUTILIZAR > ADAPTAR > CREAR.
- No third-party source code copied.
- Native Android + Kotlin + Compose foundation.
- Domain models independent from UI.
- Tool algorithms behind interfaces.
- Local-first editor; internet not required for core drawing.

NO HACER:
- No implement complete background removal yet.
- No implement intelligent shading yet.
- No build a second rendering engine without need.
- No advance into full Day 2-7 feature set.

SIGUIENTE DÍA:
2

PRIMERA TAREA DEL DÍA 2:
Verify the Day 1 CI build and tests. If CI reports failures, isolate and repair them before adding editor features. Then implement the first real drawing/stroke pipeline while preserving the document/layer/viewport architecture.

VERIFICACIÓN:
VERIFICADO — CI #6: build SUCCESS + unit tests SUCCESS. Commit verificado: be1bd6e02c55ba7eae2c6d64f2e5e680ea650e59.


---

## DÍA 2 — VISTO BUENO

ESTADO FINAL:
DÍA 2 COMPLETADO Y VERIFICADO EN CI.

IMPLEMENTACIÓN VERIFICADA:
- Modelo Stroke/StrokePoint y herramientas de dibujo integrado al Document/Layer existente.
- DrawingEditor con pincel, borrador, commit de trazo y undo/redo.
- Transformación Screen ↔ Document mediante ViewportTransform.
- Canvas real conectado al mismo pipeline de documento; no se creó un segundo renderer.
- Gestos de un dedo para dibujo/pan y dos dedos para zoom/pan.
- Persistencia y recuperación de documentos con trazos.
- Pruebas unitarias de trazo, capa bloqueada y round-trip de viewport.
- Documentación de arquitectura y rendimiento actualizada.

INCIDENCIA REAL DETECTADA Y REPARADA:
- CI run #22 falló por imports faltantes de APIs Compose de gestos y transformaciones de DrawScope en EditorScreen.kt.
- Se aisló el fallo en los logs de GitHub Actions.
- Se corrigió en commit ed1ef00ab356392380fa1db185049ea4cfaed55e.
- La ejecución CI #23 posterior terminó SUCCESS.

VERIFICACIÓN FINAL:
- GitHub Actions run #23: SUCCESS.
- Build: SUCCESS.
- Unit tests: SUCCESS.
- Commit verificado: ed1ef00ab356392380fa1db185049ea4cfaed55e.
- No avanzar a Día 3 hasta que el alcance del Día 2 permanezca estable.


---

## DÍA 3 — VISTO BUENO

ESTADO FINAL:
DÍA 3 COMPLETADO Y VERIFICADO EN CI.

BASE:
- Día 2 aprobado: ed1ef00ab356392380fa1db1850494cfaed55e.
- PR #1: Day 3: complete editable layers and transforms.
- Merge commit final: 099e0048db4ab19c0b8624219d8f6c687144af11.

IMPLEMENTADO:
- Crear, seleccionar, renombrar, ocultar/mostrar, bloquear/desbloquear, opacidad, reorder, duplicar y eliminar capas.
- Stable Layer IDs y selectedLayerId.
- Duplicación con aislamiento de contenido.
- Transform no destructivo por capa: translation, scale, rotation.
- Inverse layer transform para edición de strokes.
- Modo Transformar: 1 dedo mover; 2 dedos mover/escala/rotación.
- Bounding box de selección.
- Undo/Redo para operaciones de capa y transformación completa como una sola operación.
- Persistencia de layer metadata, transform, content type y strokes.
- Tests de lifecycle, aislamiento, undo/redo y transform math.
- Documentación DAY-03, ARCHITECTURE y PERFORMANCE actualizada.

ERRORES REALES REPARADOS:
- ProjectPersistence.kt: decoder de content type tenía referencias inválidas; corregido y recompilado.
- DocumentReducerTest.kt: expectativa incorrecta al borrar la primera capa; corregida.
- CI #32: fallo de compilación por decoder de persistencia.
- CI #33: build verde pero un test fallaba; aislado en DocumentReducerTest.
- CI #34: BUILD SUCCESS + UNIT TESTS SUCCESS.
- CI #35: merge final en main, BUILD SUCCESS + UNIT TESTS SUCCESS.

VERIFICACIÓN FINAL:
- GitHub Actions run #35: SUCCESS.
- Build: SUCCESS.
- Unit tests: SUCCESS.
- Commit final verificado: 099e0048db4ab19c0b8624219d8f6c687144af11.

PENDIENTE / DEUDA:
- Merge Down no se implementó porque no era necesario para estabilizar Día 3.
- Persistencia sigue usando SharedPreferences/JSON y deberá evolucionar a un formato de proyecto más robusto cuando el alcance lo justifique.
- No se avanzó a tracing, background removal, smart selection ni shading avanzado.

NO REPETIR:
- No crear un segundo Document, renderer, canvas, history o sistema paralelo de reference layers.

SIGUIENTE DÍA:
4 — tracing + reference layer, reutilizando Layer y el pipeline existente.


---

## AUDITORÍA DE ESTADO — 2026-10-03

Se realizó una auditoría del repositorio contra el mandato del CEREBRO.

**Estado auditado: 🔴 RED**

- main auditado inicialmente en `99f68ad0f75e7354e332b471bf2542327aedab9e`.
- Android CI #68: Build SUCCESS, Unit tests SUCCESS, Lint SUCCESS, Android startup smoke FAILURE.
- La causa observada del fallo de #68 está en la ejecución del bloque shell del smoke test dentro del workflow/action, no en compilación de la aplicación.
- PR #3 `web-first-foundation`: Web CI #10 SUCCESS; Android CI #78 estaba IN PROGRESS al momento de la auditoría.
- PR #2 `day-4-reference-layer`: Android CI #45 SUCCESS, pero el PR está `mergeable=false` y diverge de main (+20/-23); no fusionar sin reconciliación.
- README.md continúa describiendo Day 1 y debe actualizarse cuando el estado documental sea estabilizado.
- Web todavía no está integrada en main.

### Documento de auditoría

`docs/AUDITS/2026-10-03-REPO-AUDIT.md`

### Decisión del CEREBRO

No declarar GREEN. Prioridad: reparar/verificar Android CI, completar la evidencia de PR #3, revisar integración Web/Android y después reconciliar PR #2. No expandir funcionalidades mientras CI siga rojo.


## T019 — Startup resolution (2026-10-04)

- Baseline production HEAD: `0e8ea181afdfe65e45c05cea6e63bc7f79d9b896`.
- Baseline Run 101 (`37193614706`) failed Android Startup Smoke: `Status: timeout`; Build/Tests/Lint passed. Logs showed the app process alive and MainActivity resumed, alongside emulator/system contention and skipped frames/Davey events.
- Attempted minimal Canvas change `98e60f64cb2d94135c6bb01d640248a1bf94185a`: keep `graphicsLayer` but switch to Auto during normal startup. Run 102 (`37196303447`) still failed Startup Smoke with `Status: timeout`. Change was reverted in `6b1c6e1f471f5790d7f97ade81dd67c0bb3cebd0`.
- Applied a more targeted Compose fix in `38e40f88ea3fbb994aababeb6380d6551be697e5`: omit the Canvas graphics layer entirely unless the eraser tool is active, preserving Offscreen only where `BlendMode.Clear` requires it. Run 104 (`37197102468`) still failed Startup Smoke with `Status: timeout`; Build/Tests/Lint passed.
- Applied a Compose phase-flow fix in `ae3278875da3859ed185684bee1195ac016a8326`: removed the `onSizeChanged -> canvasSize` state feedback and used the measured `PointerInputScope.size` directly for gesture calculations. Run 105 (`37197882889`) exposed an initial compile error because four canvasSize references remained; corrected in `1b8de25e8085fbb26b91b55c505cd92fff864402`. Run 106 (`37198192008`) reached Build/Tests/Lint PASS but its smoke job was externally cancelled before a startup result was produced; no GREEN conclusion is drawn.


### T019 final verified result

- GREEN candidate commit: `a72f76245f73ed098fc090fba8cec348c5d4a39b`.
- GitHub Actions Run 108 / ID `37198547816` completed successfully.
- Build: PASS; Unit Tests: PASS; Lint: PASS; Android Startup Smoke: PASS; artifact upload: PASS; Overall: PASS.
- Smoke evidence: `Status: ok`; `Activity: com.jonhararagi.animeart/.MainActivity`; `Startup confirmado: pid=2220; MainActivity resumida=...`.
- Final startup log contained 0 `Choreographer: Skipped` matches, 0 `OpenGLRenderer: Davey` matches, and 0 `FATAL EXCEPTION` matches.
- The final workflow still uses the existing 15-minute job timeout and the smoke script still uses its existing 60-second `am start -W` timeout; neither was increased or weakened.


## T020 — WEB FOUNDATION AUDIT + STABILIZATION (2026-10-04)

ESTADO:
YELLOW — la fundación Web está verificada en su rama de trabajo y preparada como PR separada contra el main actual; no se fusionó automáticamente.

BRANCH DE TRABAJO: t020-web-foundation
BASE REAL: main @ 0c19d4d72a2656d4795231913d2d4ddfdcb895a7

HALLAZGOS:
- main no contiene `web/`; la Web existente estaba aislada en `web-first-foundation`.
- `web-first-foundation` estaba divergida: 20 commits ahead y 31 behind respecto de main, con PR #3 abierto y mergeable=false.
- La rama Web también modificaba `.github/workflows/android.yml`, por lo que no era seguro incorporarla directamente sobre el baseline T019.
- Web CI run #10 (37171214001) terminó SUCCESS para la rama Web anterior: install, build, test y verify build output PASS.
- Android CI run #78 de esa rama fue CANCELLED durante startup smoke; no se usa como evidencia de regresión ni como GREEN.
- main conserva Android CI run #109 (37198876309) SUCCESS después de T019.

AUDITORÍA DE REUTILIZACIÓN:
- Document: Android `CanvasDocument`; Web `Document` shape. ADAPTAR/MANTENER frontera de plataforma; no duplicar Android classes.
- Layer: Android `Layer`; Web layer records. ADAPTAR concepto, no crear segunda implementación Android.
- Stroke/StrokePoint: Android tipados; Web stroke records. ADAPTAR en la frontera Web hasta una futura decisión explícita de contratos compartidos.
- Viewport: Android `Viewport`; Web todavía NO implementado como modelo real. No crear paralelo en T020.
- History: Android `CommandHistory`; Web todavía NO implementado. No duplicar en T020.
- Persistence: Android `ProjectPersistence`; Web `localStorage`. Mantener separación de plataforma en esta etapa.
- Transform: Android `Transform`; Web conserva transform metadata en el modelo mínimo existente.
- Renderer: Compose Canvas en Android y Canvas 2D en Web. Separación correcta por plataforma.

REPARACIÓN REAL:
- Se detectó una pérdida de compatibilidad en restauración Web: `app.js` intentaba `normalizeDocument(saved)` antes de `migrateLegacyDocument(saved)`. La forma v1 contenía `layers + strokes`, por lo que era aceptada por el normalizador y sus strokes podían perderse.
- Se introdujo `restoreDocument()` en el límite de dominio Web para priorizar migración legacy y después normalización.
- Se añadió un test de regresión que verifica que los strokes v1 sobreviven a `restoreDocument()`.
- Se eliminó del workflow Web una configuración de cache que apuntaba a un `package-lock.json` inexistente; la CI usa `npm install` sin depender de ese archivo.
- No se alteró Android Startup, sus timeouts ni su smoke.

VERIFICACIÓN PREVIA DISPONIBLE:
- Web CI #10 / 37171214001: SUCCESS sobre la versión anterior de la rama Web.
- Android CI #109 / 37198876309: SUCCESS sobre main @ 0c19d4d72a2656d4795231913d2d4ddfdcb895a7.
- CI de esta rama T020 posterior a los cambios: PENDIENTE en este punto del registro.

PENDIENTES:
- Ejecutar CI real del PR T020 y verificar Web + Android.
- Resolver integración de la Web sobre el main actual sin arrastrar el workflow Android obsoleto de PR #3.
- No implementar aún zoom/pan real, history Web, PWA, WebView, backend o IA.

DEUDA TÉCNICA:
- El dominio Web sigue en JavaScript/ES modules para mantener la dependencia mínima.
- `localStorage` es una persistencia inicial y no un formato de proyecto definitivo.
- La Web todavía no tiene viewport/history equivalentes porque esas etapas fueron explícitamente diferidas.

---

## T021 — Contratos de dominio Web

ESTADO:
IMPLEMENTACIÓN EN RAMA T021; pendiente de CI real y merge.

BASELINE:
main @ 757176db08f6a13c986712a225f35648beb50751.

BRANCH:
t021-web-domain-contracts.

AUDITORÍA ANDROID:
- `Models.kt` contiene los conceptos reales CanvasDocument, Layer, LayerContent, Stroke, StrokePoint, Transform, Viewport y EditorState.
- `DocumentReducer` es el punto de modificación de documentos/capas y normaliza escala y opacidad en sus operaciones.
- `ProjectPersistence` serializa documentos, capas, transformaciones y strokes; no se reutiliza directamente desde Web.
- `CommandHistory` y `ViewportTransform` existen en Android, pero no se duplican en Web durante T021.

AUDITORÍA WEB:
- `web/domain/model.mjs` ya era la frontera de dominio y restauración desde T020.
- Se formalizaron los contratos mínimos dentro del mismo módulo, sin crear un segundo dominio.
- `app.js` consume los constructores de Stroke/StrokePoint en lugar de crear registros paralelos manualmente.
- `LayerContent` no se implementó como abstracción separada: el único contenido Web actual es drawing/strokes.
- `Viewport` no se implementó como modelo Web todavía.

MATRIZ DE CONTRATOS:
- Document: Android CanvasDocument | Web Document | compatible conceptualmente | ADAPTAR/MANTENER.
- Layer: Android Layer | Web layer record | compatible en metadatos principales | ADAPTAR/MANTENER.
- LayerContent: Android sealed interface | Web implícito como strokes | no requiere abstracción Web todavía | NO IMPLEMENTAR TODAVÍA.
- Stroke: Android Stroke | Web {tool,size,points} | compatible en núcleo | ADAPTAR.
- StrokePoint: Android {x,y,pressure,timestamp} | Web {x,y} | compatible mínimo | ADAPTAR.
- Transform: Android Transform | Web {x,y,scale,rotation} | compatible semánticamente | ADAPTAR.
- Viewport: Android Viewport | Web sin modelo de dominio | no implementado | NO IMPLEMENTAR TODAVÍA.

DECISIONES:
- Mantener JavaScript ES Modules.
- No migrar a TypeScript.
- No crear un Shared Domain runtime.
- No introducir LayerContent hasta que exista un segundo tipo de contenido Web que lo justifique.
- No introducir Zoom/Pan de dominio en T021.
- Mantener restoreDocument -> migrateLegacyDocument -> normalizeDocument.

CAMBIOS:
- Constructores mínimos para StrokePoint y Stroke.
- Normalización explícita de Stroke, Transform y Layer.
- Validación pura mediante isValidDocument.
- Tests de invariantes y regresión legacy.
- app.js reutiliza los constructores del dominio.

---

## T022 — Web Viewport / Zoom / Pan

ESTADO:
IMPLEMENTACIÓN EN RAMA t022-web-viewport; pendiente de CI real y merge.

BASELINE:
main @ a1623fc4d23c688301853d066c93a8e3140ad359.

BRANCH:
t022-web-viewport.

OBJETIVO:
Establecer un único viewport Web puro y testeable, integrar su matemática con Canvas 2D y convertir Pointer Events a coordenadas de documento antes de crear/extender strokes.

AUDITORÍA:
- Android Viewport usa escala y traslación, y ViewportTransform define la referencia conceptual screen↔document alrededor del centro. Se reutiliza la semántica, no las APIs Kotlin/Compose.
- Web T021 tenía contratos Document/Layer/Stroke/StrokePoint/Transform, pero no un Viewport real.
- app.js ya utilizaba Pointer Events y devicePixelRatio; T022 los reutiliza.
- El pan previo movía temporalmente el elemento Canvas mediante CSS y no modificaba un estado de viewport; se clasificó como CODE y se reemplazó por pan real sobre el estado de vista.

IMPLEMENTACIÓN:
- web/domain/viewport.mjs: contrato zoom/panX/panY, normalización, validación, screenToDocument, documentToScreen, zoomAt y panBy.
- web/app.js: un único state.viewport; render con una transformación Canvas; strokes almacenan siempre coordenadas de documento; Pointer Events reutilizados para dibujo/pan; wheel zoom alrededor del cursor.
- Viewport no se persiste con el documento; es estado de sesión.
- Zoom de presentación se mantiene en rango centralizado 0.25..4.

TESTS:
- Identidad, zoom, pan, round-trip screen↔document, zoom alrededor del cursor e invariantes de viewport.
- Se mantiene la regresión T021 de restore/migration/normalization/validation.

PENDIENTES:
- Verificación CI real Web + Android y merge.
- Pinch/gestos avanzados siguen fuera de alcance.


## T022 — Verificación final

- Implementación fusionada en main: 0eaa9856432ce07911acf270e3010fe93a8b4d43.
- PR de implementación: #6, merged.
- Pre-merge Web CI run 37245025099 (#15): SUCCESS — Build, Test y Verify build output.
- Pre-merge Android CI run 37245025092 (#114): SUCCESS — Build, Unit Tests, Lint, Startup Smoke y Artifact.
- Pre-merge startup smoke: Status ok; MainActivity com.jonhararagi.animeart/.MainActivity; FATAL EXCEPTION 0; Choreographer Skipped 0; OpenGLRenderer Davey 0; Startup confirmado 1.
- Post-merge Web CI run 37245195503 (#16): SUCCESS — Build, Test y Verify build output.
- Post-merge Android CI run 37245195488 (#115): SUCCESS — Build, Unit Tests, Lint, Startup Smoke y Artifact.
- Post-merge startup smoke: Status ok; MainActivity com.jonhararagi.animeart/.MainActivity; FATAL EXCEPTION 0; Choreographer Skipped 0; OpenGLRenderer Davey 0; Startup confirmado 1.
- PR #2 permanece abierto y sin modificaciones.
- Viewport sigue siendo estado de sesión; no se persiste con el documento.
- Pendiente futuro: pruebas de interacción avanzada/pinch y navegación avanzada; no forman parte de T022.


---

## T023 — Web Interaction Stabilization

ESTADO: EN VERIFICACIÓN — implementación preparada en branch `t023-web-interaction-stabilization` desde baseline `52efa19a7c6a7b9d0dcc5ea42d53c3a3faaf2dfb`.

OBJETIVO:
- Estabilizar la frontera Pointer Events → SCREEN → Viewport → DOCUMENT → Stroke → Layer → Canvas sin introducir otro sistema de eventos, renderer, Document, Layer o Viewport.

CAMBIO REAL:
- Se mantiene `screenPointFromEvent()` como frontera de coordenadas de entrada y `screenToDocument()` como única conversión a coordenadas de documento.
- Se mantiene un único `state.viewport` como estado de sesión.
- Se corrige un estado residual posible al pasar de una interacción de dibujo a Pan: Pan cancela explícitamente el estado de dibujo y la identidad del pointer activo.
- Se registra el `pointerId` del dibujo para impedir que otro pointer finalice o extienda accidentalmente el stroke.
- Pan continúa modificando solamente `state.viewport.panX/panY`; no usa `canvas.style.transform`.
- DPR continúa limitado al backing store del Canvas y no entra en la matemática de Document/Viewport.

TESTS AÑADIDOS:
- zoom + pan → screen/document round-trip;
- navegación de viewport no altera StrokePoint ni Layer Transform;
- navegación de viewport no muta su estado de entrada;
- smoke estructural de la frontera Pointer/Viewport/Document/persistencia.

CI / REGRESIÓN:
- Baseline Android de T022 está documentado como verde; T023 no modifica Android.
- La verificación CI real de esta rama queda pendiente hasta completar el PR y sus ejecuciones.

PENDIENTES:
- Verificar Web CI real de T023.
- Verificar Android CI real de T023 (Build, Unit Tests, Lint, Startup Smoke y APK artifact) sin cambios Android.
- Registrar Run IDs y commit final cuando CI termine.
- No iniciar T024 hasta que toda la evidencia requerida esté verde.

DEUDA TÉCNICA:
- No se introduce deuda nueva en la frontera de interacción. Pinch/inercia y navegación avanzada siguen fuera de alcance.

SIGUIENTE TAREA:
- T024 Undo / Redo Web, únicamente después de cerrar T023 con evidencia CI completa.


### T023 — CI evidence update

- PR #8, branch `t023-web-interaction-stabilization`.
- Web CI run #19 / ID `37253397457`: SUCCESS — Build, Test, Verify build output.
- Android CI run #118 / ID `37253397430`: SUCCESS — Build, Unit Tests, Lint, Android Startup Smoke, Upload debug APK.
- Startup smoke: Status ok; Activity `com.jonhararagi.animeart/.MainActivity`; MainActivity resumed.
- APK artifact: `animeart-debug-apk`, artifact ID `11321618030`, SHA-256 `c395bfc83a021f5cbf94c2b1a982a7ae590638e41f3a711ff38595bc42922c79`.
- Evidence is real GitHub Actions evidence for the functional T023 commit. A fresh CI run is required after this documentation-only update so the final branch head is also verified.


## T023 — Verificación post-merge final

ESTADO: GREEN — T023 estabilizada y fusionada en `main`.

BASELINE: `52efa19a7c6a7b9d0dcc5ea42d53c3a3faaf2dfb`
PR: #8
MERGE COMMIT: `65818d34c56dfd38273cc176f80d7e5f9346e0a1`

EVIDENCIA PRE-MERGE:
- Web CI #20 / `37253605033`: SUCCESS — Build, Test, Verify build output.
- Android CI #119 / `37253605081`: SUCCESS — Build, Unit Tests, Lint, Startup Smoke, APK artifact.

EVIDENCIA POST-MERGE:
- Web CI #21 / `37253850888`: SUCCESS sobre main @ `65818d34c56dfd38273cc176f80d7e5f9346e0a1`.
- Android CI #120 / `37253850885`: SUCCESS sobre main @ `65818d34c56dfd38273cc176f80d7e5f9346e0a1`.
- Android post-merge: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, APK artifact PASS.
- APK artifact ID `11322257399`, nombre `animeart-debug-apk`.

RESULTADO:
- Document, Viewport y Screen permanecen separados durante la frontera de interacción.
- Pan no usa CSS transform y no crea strokes.
- Zoom/pan no modifican Document, StrokePoint ni Layer Transform.
- Viewport permanece fuera de la persistencia del documento.
- No se modificó Android durante la implementación de T023.

PENDIENTES:
- Ningún bloqueo de T023.
- T024 queda autorizado: Undo / Redo Web.


## T024 — Web Undo / Redo

### Estado de implementación

T024 introduce una única frontera de historial para el Document Web. El historial vive en `web/domain/history.mjs` y almacena snapshots lógicos normalizados de Document; no almacena Canvas, bitmap, screenshots ni Viewport.

### Integración

- Un stroke completo se registra como una sola operación al terminar en `pointerup`; los `pointermove` solo modifican el stroke activo.
- `pointercancel` descarta el stroke incompleto sin crear una entrada histórica.
- Clear Layer y Create Layer registran una operación completa cada uno.
- Undo/Redo reemplazan únicamente `state.document` y sincronizan la selección/render/persistencia.
- Nueva operación después de Undo elimina la rama Redo.
- Zoom, pan y zoomAt siguen fuera del historial.
- Viewport continúa siendo estado de navegación independiente del Document.
- La carga de un proyecto restaura el Document y reinicia el historial, evitando historial ficticio sobre datos recuperados.

### Seguridad de snapshots

Los estados históricos se clonan y normalizan al entrar/salir del historial. Las referencias mutables del Document actual no comparten objetos con las entradas históricas.

### Persistencia

Se reutiliza el mismo `localStorage` existente y se persiste el Document actual después de stroke, Clear, Create Layer, Undo y Redo. El Viewport no se serializa.

### UI

Se añadieron controles mínimos `Undo` y `Redo` a la barra existente, sin rediseñar el editor.

### Verificación T024

- Tests nuevos: historial vacío, stroke, múltiples strokes, limpieza de Redo, Clear Layer, Create Layer, independencia Viewport, ausencia de historial por zoom/pan, persistencia y mutation safety.
- Regresión T023: pendiente de verificación en CI de la rama T024 hasta ejecutar el workflow real.
- Web CI: pendiente.
- Android CI: pendiente.
- Merge a main: pendiente.


## T024 — Final verification

T024 Web Undo / Redo is merged in main.

- PR #9: merged.
- Functional merge commit: `315729eb7fbed720dd2cb7ab75273cdaf3dc8342`.
- Web CI on T024 head: run #24 / ID `37259286027`: SUCCESS — Build, Test, Verify build output.
- Android CI on T024 head: run #123 / ID `37259286008`: SUCCESS — Build, Unit Tests, Lint, Android Startup Smoke Test, Upload debug APK.
- Android artifact: `animeart-debug-apk`, artifact ID `11323584341`, SHA-256 `a8561dce158430361f6a8289484f5825c104aa7fa6cea18ec8ba7a423cfcc10f`.
- PR #2 remains open and was not merged; it is based on an old main commit and reports mergeable=false.
- Final main-head CI after this documentation update is still required before T024 can be declared GREEN.


## T025 — Web Layer Transform Boundary

### Decisión arquitectónica

La auditoría de T025 determinó que el siguiente bloque correcto no era importar imágenes ni fusionar la Reference Layer antigua. El modelo Web ya contenía `Layer.transform`, el renderer ya aplicaba esa transformación y T024 ya proporcionaba la frontera única de Document History. Faltaba una frontera pura para mutar transformaciones de Layer sin acoplarlas a Viewport ni repetir lógica dentro de la UI.

### Implementado

- `web/domain/document-operations.mjs` concentra las operaciones puras de transformación de Layer: translate, scale, rotate y update de transform.
- Las operaciones clonan/normalizan el Document y no mutan el estado de entrada.
- `app.js` usa esa frontera y registra cada transformación completa mediante el History existente.
- Se añadieron controles mínimos para mover, escalar y rotar la capa seleccionada.
- Viewport, zoom y pan siguen fuera del historial y no participan en las operaciones de Layer.

### Fuera de alcance

No se implementaron importación de imágenes, Reference Layer, LayerContent Web, PWA, WebView, IA ni cambios Android.

### PR #2

PR #2 permanece abierta, basada en `bef67a9f9a04e6ef9aef6e5615c7c62fc5810a45`, con `mergeable=false`/estado dirty. Su implementación incluye cambios Android y un sistema de contenido/reference que no corresponde copiar sobre el Web actual. Se reutilizó únicamente el concepto arquitectónico de que una Reference Layer debe reutilizar Layer/Transform/Renderer cuando llegue su momento; no se copió código.

### Verificación T025

- Web CI #29 / `37267420167`: SUCCESS — Build, Test, Verify build output.
- Android CI #128 / `37267420194`: SUCCESS — Build, Unit Tests, Lint, Android Startup Smoke Test, APK.
- El primer Web CI T025 (#28 / `37267358947`) falló por un error introducido en el test al duplicar imports; fue corregido separando `transform.test.mjs`. No se eliminó ninguna assertion ni test existente.
- CI final y merge todavía pendientes.


---

## T026 — Selección y manipulación visual de Layer en Canvas

ESTADO:
IMPLEMENTACIÓN T026 EN RAMA t026-web-layer-selection-transform; verificación final condicionada a CI real y revisión/merge.

BASELINE:
main @ 2035e39091134ae5dbffd7b2fecaeb08d2f0db5a.

DECISIÓN:
- Reutilizar selectedLayerId como único estado de selección.
- Añadir solo geometría de selección/hit-testing en web/domain/selection.mjs; no crear otro Document, Layer, Renderer, Viewport o Transform.
- Añadir un modo Web Select para que Drawing y Pan mantengan sus rutas actuales.
- El bounding box se calcula en coordenadas de Document a partir de los strokes, se transforma con Layer.transform y se proyecta a Screen mediante el Viewport existente.
- Durante drag se usa un preview transitorio; el Document no se modifica hasta pointerup.
- Move, Scale y Rotate terminan usando document-operations.mjs y una única llamada a DocumentHistory.record().
- pointercancel descarta el preview y no genera History.
- Android no se modifica.

ALCANCE:
- selección visual de Layer;
- bounding box transformado;
- handles de escala en esquinas;
- handle de rotación;
- movimiento dentro del bounding box;
- Zoom/Pan independientes;
- Undo/Redo como una operación por drag.

FUERA DE ALCANCE:
- multi-selección, grouping, snapping, guides/rulers, image import, Reference Layer, PWA, IA y editor Android paralelo.

VERIFICACIÓN PENDIENTE:
- tests Web T026 + regresión completa;
- Web CI y Android CI;
- merge y verificación final sobre main.


---

## T026 — CIERRE Y VERIFICACIÓN FINAL

ESTADO:
GREEN — T026 implementada, fusionada y verificada sobre el HEAD real de main.

EVIDENCIA FINAL:
- main: `3df514a54494889d9d2785b95c37e4b15d573e8e`.
- PR #11: merged.
- Web CI #37 / `37278052574`: SUCCESS — Install, Build, Test, Verify build output.
- Android CI #136 / `37278052563`: SUCCESS — Build, Unit Tests, Lint, Android Startup Smoke Test, Upload debug APK.
- El Android smoke test pasó en el mismo HEAD T026; el APK debug también fue generado correctamente.

IMPLEMENTACIÓN VERIFICADA:
- selectedLayerId continúa siendo el único estado de selección.
- `web/domain/selection.mjs` concentra geometría y hit-testing sin crear otro Document, Layer, Viewport, Renderer o History.
- Bounding box y handles se presentan en el Canvas existente.
- Move/Scale/Rotate usan `document-operations.mjs` y el `DocumentHistory` existente.
- Preview de transformación es transitorio; pointercancel no crea History.
- Drawing, Pan, Zoom, persistencia y Android permanecen dentro de sus fronteras existentes.

ERRORES DURANTE T026:
- El primer Web CI T025 había fallado por imports duplicados en tests; ya estaba reparado antes del cierre de T026.
- No se detectó un fallo bloqueante en la ejecución final de T026.

REPARACIONES:
- T026 quedó verificada mediante CI real en el mismo commit de main.
- No se requirieron cambios adicionales de Android para cerrar T026.

PENDIENTES:
- PR #2 (Day 4 reference/tracing Android) permanece abierta, antigua y no mergeable; no se fusiona automáticamente.
- No iniciar funcionalidades fuera de la secuencia arquitectónica hasta definir y auditar T027.

DEUDA TÉCNICA:
- Persistencia Web continúa basada en localStorage como solución local-first inicial.
- No hay todavía multi-selección, grouping, snapping, guides/rulers, importación de imágenes, Reference Layer Web, PWA, IA ni WebView.
- Los contratos Web y Android siguen separados por plataforma, compartiendo conceptos y semántica sin duplicar implementaciones Kotlin/JS.

SIGUIENTE TAREA AUTORIZADA:
T027 debe comenzar con inspección de main @ `3df514a54494889d9d2785b95c37e4b15d573e8e`, auditoría de reutilización y definición del cambio mínimo siguiente. No asumir que Reference Layer es automáticamente el siguiente bloque: primero comprobar el estado real y los contratos existentes.

## T028 — CIERRE IMAGE LAYER WEB / FASE 1

ESTADO:
GREEN — T028 implementada, fusionada y verificada sobre main mediante CI real.

BASELINE:
main @ 54a070a962cd531d9a41b98738ffd2791878e934.

PR:
#13 — T028: add minimal Web Image Layer.

BRANCH:
t028-web-image-layer.

HEAD DE LA RAMA ANTES DEL MERGE:
b87f87c8c854e93ff6d3d313f90394ef4ac3b4e0.

MERGE:
- PR #13 fusionado mediante merge commit.
- Merge SHA: 49f06d3374f45192e143cab8ce5265c9723876b5.
- El merge dejó T028 en main sin cambios Android.

ALCANCE VERIFICADO:
- Image Layer Web mínimo con source, width y height.
- Fixture SVG determinista local mediante data URI.
- Render de Image Layer mediante el Canvas 2D existente.
- Bounds de imagen integrados en la geometría de selección existente.
- Move / Scale / Rotate / Resize / Zoom / Pan reutilizan las fronteras existentes.
- Visibility / Opacity / Lock se mantienen en el Layer existente.
- Creación de Image Layer integrada con DocumentHistory.
- Persistencia mediante la serialización localStorage existente.
- Drawing + Image pueden coexistir en el mismo Document.
- No se copió código del PR #2.
- Android no fue modificado por T028.

CI POST-MERGE DEL CÓDIGO T028:
- Web CI #46 / ID 37294567649 sobre SHA 49f06d3374f45192e143cab8ce5265c9723876b5: SUCCESS.
- Android CI #145 / ID 37294567346 sobre SHA 49f06d3374f45192e143cab8ce5265c9723876b5: SUCCESS.
- Web: Build PASS, Test PASS, Verify build output PASS.
- Web tests: 134/134 PASS; 0 FAIL, 0 cancelled, 0 skipped.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, debug APK PASS.
- APK artifact #11338366228; SHA-256 950513c32089a10dc98919cfb4f9069f2302f474fe570d7f23af8eb1eefe25b4.

DOCUMENTACIÓN:
- La historia previa de CONTINUITY.md se conserva.
- Commit de la primera actualización de documentación: 279c1810317da86415b73ef370c0747e74befd27.
- CI posterior de esa actualización: Web CI #47 / ID 37295041340 SUCCESS; Android CI #146 / ID 37295041279 SUCCESS.
- Ambos ejecutaron sobre SHA 279c1810317da86415b73ef370c0747e74befd27.
- La documentación no inicia T029.

LIMITACIONES ACTUALES:
- No existe E2E físico del editor Web en navegador real dentro de esta CI.
- La importación de archivos externos queda pendiente.
- Persistencia Web continúa basada en localStorage como solución local-first inicial.
- No se implementaron funcionalidades posteriores como multi-selección, grouping, snapping, guides/rulers, filters/effects, AI, crop, masks, blend modes, text, shapes, PWA o IndexedDB.

DEUDA TÉCNICA:
- Importación de archivos externos y una persistencia de proyecto más completa siguen fuera de T028.
- Las pruebas Web actuales son de dominio/integración estructural; no sustituyen una prueba E2E física.

REGRESIÓN:
- T024: permanece cerrada y sus fronteras de DocumentHistory siguen reutilizadas.
- T025: permanece cerrada y sus operaciones de transformación siguen reutilizadas.
- T026: permanece cerrada y su selección/transformación visual sigue reutilizada.
- T027: permanece cerrada según la continuidad previa.
- T028: cerrada; la evidencia de código, merge, main y CI post-documentación queda registrada arriba.

SIGUIENTE TAREA:
T029 NO iniciada. El siguiente trabajo queda a decisión de CEREBRO después de revisar esta evidencia.

## T029 — Web Image Import / Fase 1

ESTADO:
IMPLEMENTADA Y VERIFICADA EN RAMA. PR #14 abierta; no fusionada.

BASELINE:
main @ 1459ce0d10d4588fbe1074c62dc3f8307163461f.

BRANCH:
t029-web-image-import.

ALCANCE:
- Selector nativo mediante input[type="file"] con accept="image/*".
- File API / FileReader para obtener una data: URL persistible.
- Decodificación mediante Image() del navegador.
- Reutilización de createImageLayer(), contentType "image" y layer.image existente.
- Dimensiones reales obtenidas de naturalWidth/naturalHeight.
- Nombre de capa derivado del nombre de archivo sin extensión.
- Render mediante el Canvas 2D existente.
- Selection, layerLocalBounds(), Transform, Viewport, History y localStorage existentes se mantienen como única cadena.
- Una importación registra una sola transición lógica before → after en DocumentHistory.
- Persistencia se intenta antes de mutar Document/History para evitar capas huérfanas si falla el almacenamiento.
- Cancelación, archivo inválido, decode failure, dimensiones inválidas y límites de almacenamiento no crean una capa parcial.

LÍMITE DE ALMACENAMIENTO:
- No se asume una capacidad universal de localStorage.
- Límite conservador de aplicación: 1.500.000 bytes por archivo antes de lectura.
- Límite conservador de representación de imagen: 2.000.000 caracteres.
- Límite conservador del Document serializado para esta ruta: 2.500.000 caracteres.
- Si localStorage rechaza setItem(), la importación se aborta sin aplicar la nueva capa.
- Estos límites son de aplicación y no representan una garantía universal de cuota del navegador.

FORMATOS:
La UI acepta image/*. La decodificación final depende de los formatos que el navegador pueda abrir mediante Image(); no se agregó decoder ni librería externa.

TESTS:
- Web CI #49 / ID 37302522897 (implementación previa): SUCCESS.
- Build PASS.
- Test PASS.
- Verify build output PASS.
- Suite completa: 162/162 PASS, 0 FAIL, 0 cancelled, 0 skipped.
- Tests T029: 14 tests deterministas, sin URLs externas.

ANDROID REGRESSION:
- Android CI #148 / ID 37302522852 (implementación previa): SUCCESS.
- Build PASS.
- Unit Tests PASS.
- Lint PASS.
- Android Startup Smoke PASS.
- APK PASS.
- Artifact animeart-debug-apk ID 11342930318.
- Artifact digest SHA-256: 61c22e3de2a766f829ed693de5fa1b29ae2b44f569dd497ae4d8abbf6be6edb2.

LIMITACIONES:
- No existe E2E físico del selector de archivos dentro de la CI actual.
- La persistencia continúa basada en localStorage; IndexedDB queda fuera de T029.
- No se implementan drag & drop, clipboard, crop, filters/effects, masks, blend modes, background removal, AI, OCR, text, shapes, multi-selection, grouping, snapping, guides/rulers, PWA, asset manager o cloud storage.

DEUDA TÉCNICA:
- Migrar proyectos de imágenes grandes a una estrategia de almacenamiento más adecuada, previsiblemente IndexedDB, queda para una fase posterior.
- Una prueba E2E de navegador real para seleccionar un archivo permanece pendiente.

REGRESIÓN:
T024, T025, T026, T027 y T028 permanecen cubiertas por la suite completa; T029 no modifica Android.

PR:
#14 — T029: Web image import.
Estado OPEN.
No fusionado. La decisión de merge corresponde a CEREBRO.

T030:
NO iniciada.



### T029 — Corrección posterior a auditoría CEREBRO

- La auditoría detectó que el botón `+ Image` aún creaba el fixture `Test Image` y no abría el selector. Corregido: `+ Image` ahora ejecuta `imageFileInput.click()`; la ruta de importación real queda como única acción del botón.
- Se corrigió la frontera de persistencia/History para que el snapshot solo quede aplicado al estado del editor después de que History y persistencia hayan sido aceptados; un fallo de persistencia revierte la entrada histórica.
- Conteo corregido: T029 tiene 14 tests en `web/test/image-import.test.mjs`.
- Esta corrección queda pendiente de CI Web + Android antes del cierre de T029.


### T029 — Corrección final de atomicidad History ↔ Persistence

- `DocumentHistory` continúa siendo el único sistema de historial.
- Se añadió `discardLastRecord()` para rollback transaccional: elimina únicamente la última entrada de `past` y no usa `undo()` ni `reset()`.
- `discardLastRecord()` restaura el estado `future` que existía antes del `record()`, por lo que un fallo de persistencia no crea ni elimina Redo histórico previo.
- La importación restaura `state.document` al snapshot anterior y descarta solamente la operación de importación fallida.
- La prueba determinista de cuota de almacenamiento fuerza `setItem()` a fallar y verifica documento sin imagen, tamaño de History intacto, Redo previo intacto y ausencia de Redo de la importación fallida.
- El camino exitoso sigue registrando exactamente una operación y permite Undo/Redo.
- T029 final: 16 tests específicos dentro de una suite Web total de 166 tests.
- Web CI #57 / ID 37313606655: SUCCESS sobre SHA `bd697d2a7b24cecbb61ab7c9c4966b7dd7419c31`.
- Android CI #156 / ID 37313606581: SUCCESS sobre el mismo SHA; no se modificó Android.
- Esta documentación genera un nuevo commit y requiere una última ejecución Web + Android sobre ese HEAD antes del cierre definitivo.

## T030 — Web Image Input UX

ESTADO:
IMPLEMENTADA EN RAMA; PR #15 abierta y no fusionada. Decisión GREEN queda exclusivamente para CEREBRO.

BASELINE FUNCIONAL:
T029 HEAD `395ec1fe741b72de90299e93c6c7c5dad9dac909`. T029 PR #14 permanece OPEN y `main` todavía conserva el baseline anterior; T030 se construyó desde el HEAD T029 para reutilizar su pipeline sin fusionar T029 automáticamente.

BRANCH:
`t030-web-image-input-ux`.

OBJETIVO:
- Drag & Drop de archivos de imagen sobre el Canvas existente.
- Paste desde Clipboard cuando existe un item `image/*`.
- Picker T029 permanece operativo.
- Los tres caminos convergen en una única función de UI `importImageIntoEditor()` y en la única transacción `applyImageFileImport()`.

IMPLEMENTACIÓN:
- `web/domain/image-input.mjs` reutiliza `validateImageFile()` para seleccionar el primer archivo válido del drop.
- Un drop múltiple selecciona únicamente el primer archivo de imagen válido; no existe importación múltiple.
- Clipboard busca exclusivamente items `image/*`; texto normal no se intercepta.
- `getAsFile()` nulo, ausente o con excepción se ignora sin mutar el Document.
- `applyImageFileImport()` reutiliza Image Layer, FileReader, Image(), DocumentHistory y persistencia localStorage.
- Ante fallo de persistencia, `discardLastRecord()` elimina únicamente la operación fallida y preserva el Redo histórico previo.
- Feedback visual mínimo mediante clase temporal `drop-active`.
- No se creó segundo renderer, history, persistence, decoder, selector o Image Layer.

TESTS:
- Drop válido, inválido, sin archivos y múltiples archivos.
- Clipboard imagen, texto, múltiples items, `getAsFile()` nulo/ausente/excepción.
- Validación, lectura y decode fallidos.
- Persistencia fallida para picker/drop/clipboard.
- Undo/Redo del import.
- Test estructural que verifica convergencia de picker/drop/paste en la misma ruta.
- Suite completa Web y regresión Android pendientes de evidencia final sobre el HEAD documentado.

ARCHIVOS MODIFICADOS T030:
- `web/app.js`
- `web/domain/image-import.mjs`
- `web/domain/image-input.mjs`
- `web/test/image-input.test.mjs`
- `web/styles.css`
- `docs/CONTINUITY.md`

ANDROID:
No modificado. Android CI es únicamente regresión.

FUERA DE ALCANCE:
- IndexedDB.
- Asset Manager.
- Importación múltiple completa.
- Clipboard de texto.
- Crop, filtros, efectos, máscaras, blend modes, background removal, IA, OCR.
- Text/Shape Layer, multi-selection, grouping, snapping, guides, rulers.
- PWA, cloud/backend, WebView y cambios Android.

LIMITACIONES:
- La CI actual no contiene E2E físico de navegador para arrastrar un archivo real ni leer el portapapeles del sistema.
- localStorage continúa siendo la persistencia existente; IndexedDB queda fuera de T030.

PR:
#15 — T030: Web image input UX.
OPEN; no fusionada. Target `main`.
PR #14/T029 continúa OPEN y no fusionada.

SIGUIENTE TAREA:
NO INICIADA.

### T030 — Verificación CI y reparación

FALLO REAL:
- Web CI #62 / ID `37376420183` sobre SHA `540e0efb248617dc1e8c09c605699c6c4c6a15cc`: FAILURE.
- Build PASS.
- Test FAIL: 204 tests, 202 PASS, 2 FAIL.
- La misma prueba apareció en la salida de build y en `dist`: `clipboard read failure leaves document and history untouched`.
- Causa: assertion esperaba `/could not read/` en minúsculas, mientras el error contractual existente es `Could not read image file`.
- No fue un fallo funcional de importación; fue una expectativa de test con casing incorrecto.

REPARACIÓN:
- Se corrigió únicamente la expectativa a `/Could not read/`.
- Nuevo HEAD de código: `75ecc0d55975234d21f7a3b38a302e896a4881f8`.

WEB CI FINAL DE CÓDIGO:
- Web CI #63 / ID `37376509829`.
- SHA `75ecc0d55975234d21f7a3b38a302e896a4881f8`.
- SUCCESS.
- Build PASS.
- Test PASS.
- Verify build output PASS.

ANDROID CI:
- Android CI #162 / ID `37376509835`.
- SHA `75ecc0d55975234d21f7a3b38a302e896a4881f8`.
- Estado observado: `queued`.
- No se declara PASS mientras no finalice Build, Unit Tests, Lint, Startup Smoke y APK.
- Android CI #160 / ID `37376406231` sobre un SHA intermedio quedó CANCELLED durante cleanup; no se usa como evidencia final.
- No hubo cambios Android.

ESTADO ACTUAL T030:
- Web: verificado GREEN a nivel de CI sobre el código final.
- Android: pendiente de ejecución real.
- T030 global: YELLOW hasta disponer de Android CI final sobre el HEAD definitivo de documentación.

PENDIENTE DE VERIFICACIÓN:
- La documentación presente genera un nuevo commit y requiere una nueva Web CI + Android CI sobre ese nuevo HEAD antes del cierre.

### T030-CORRECTION — Duplicate import handler wiring

CEREBRO detectó después de la validación inicial que `web/app.js` contenía dos definiciones de `importImageIntoEditor()`. La segunda definición era una implementación obsoleta basada directamente en `importImageFile()` y sobrescribía en runtime la implementación basada en `applyImageFileImport()`.

CORRECCIÓN:
- Eliminada exclusivamente la definición obsoleta.
- Se conserva una sola `importImageIntoEditor()`.
- La definición activa usa `applyImageFileImport()`.
- Picker, Drag & Drop y Clipboard continúan convergiendo en la misma función.
- No se creó una segunda ruta de importación.
- No se modificó Android.
- Se agregó un test que exige exactamente una definición y rechaza la implementación obsoleta.

CI DE CORRECCIÓN:
- Web CI #67 / ID `37381686906`: SUCCESS sobre SHA `942c99b7bd720101993654b68c73a058920d1f91`.
- Android CI #166 / ID `37381687347`: SUCCESS sobre SHA `942c99b7bd720101993654b68c73a058920d1f91`.
- Build, Unit Tests, Lint, Android Startup Smoke y APK: PASS.

NOTA DE FALLA INTERMEDIA:
- Web CI #66 / ID `37381612870` falló únicamente porque el test recién agregado contenía una expresión regular con escape duplicado y producía SyntaxError.
- Se corrigió la expresión regular sin cambiar producción.
- Android CI #165 sobre el SHA intermedio quedó reemplazado por la ejecución final del SHA corregido.

ESTADO:
Pendiente de nueva revisión independiente de CEREBRO. No mergear PR #15.


## T031 — Web Layer Controls

ESTADO:
IMPLEMENTACIÓN EN RAMA; auditoría arquitectónica completada antes de modificar código.

PROBLEMA DETECTADO:
- El modelo Web ya soporta `visible`, `locked` y `opacity` por Layer y el renderer ya los respeta.
- La UI de capas solo permite seleccionar una capa; no expone esos controles persistentes al usuario.
- Esto limita el control real del editor después de T029/T030, especialmente al trabajar con varias capas de dibujo e imagen.

OBJETIVO:
- Añadir controles mínimos de visibilidad, bloqueo y opacidad al panel de Layers existente.
- Cada cambio debe pasar por el único Document existente, DocumentHistory y la persistencia local existente.
- Mantener la selección y el renderer actuales como únicas implementaciones.

ARQUITECTURA REUTILIZADA:
- `web/domain/model.mjs`: Layer ya contiene `visible`, `locked` y `opacity`.
- `web/domain/document-operations.mjs`: única frontera para operaciones inmutables sobre Layer/Document; se adapta con operaciones de propiedades de Layer.
- `web/domain/history.mjs`: único DocumentHistory para Undo/Redo.
- `web/app.js`: panel `#layers`, selección existente, `refreshDocument()`, persistencia y renderer existentes.
- `localStorage`: única persistencia Web existente.

SOLUCIÓN PROPUESTA:
- Renderizar en cada fila de Layer los controles de visible, locked y opacity.
- Aplicar los cambios mediante operaciones puras sobre el Document existente.
- Registrar una sola transición por acción y persistir el snapshot resultante.
- Las capas bloqueadas no podrán recibir cambios de propiedad desde estos controles salvo el propio toggle de bloqueo.
- La selección existente continúa siendo la única selección activa.

LÍMITES:
- No se crea un Layer Manager, state manager, renderer, history o persistence nuevo.
- No se modifica el contrato de Image Layer ni Stroke Layer.
- No se modifica Picker, Drag & Drop, Clipboard ni `importImageIntoEditor()`.

FUERA DE ALCANCE:
- Reordenamiento de capas.
- Eliminación/duplicación de capas.
- Multi-selección o grouping.
- Crop, filtros, máscaras, blend modes, texto, shapes, IA, IndexedDB, cloud, PWA y Android.

TESTS:
- Operaciones de visibilidad, bloqueo y opacidad con documentos inmutables.
- Límites de opacidad y capas inexistentes/bloqueadas.
- Wiring del panel de Layers hacia las operaciones únicas.
- Persistencia/History mediante el flujo existente.
- Suite Web completa y regresión Android.

IMPACTO ANDROID:
- Ninguno. No se modifica código Android; Android CI es regresión.

CRITERIO DE ACEPTACIÓN:
- El usuario puede seleccionar una Layer y controlar visibilidad, bloqueo y opacidad desde el panel existente.
- Cada cambio es reversible mediante el único DocumentHistory y queda persistido.
- No existen sistemas equivalentes nuevos.
- T030 continúa intacto.
- Web CI y Android CI terminan SUCCESS sobre el mismo HEAD final.


### T031 — Implementation record

- Added `setLayerVisibility()`, `setLayerLocked()` and `setLayerOpacity()` to the existing `document-operations.mjs` boundary.
- Extended the existing `renderLayers()` panel with visibility, lock and opacity controls; selection remains unchanged.
- Property actions reuse `applyLayerOperation()`, `DocumentHistory`, `refreshDocument()` and existing localStorage persistence.
- Locked layers remain protected from drawing/transform operations; property controls explicitly opt into the same existing operation boundary so visibility, lock and opacity remain manageable.
- Added deterministic operation tests and structural UI wiring regression tests.
- No changes to T030 image input code or Android code.


### T031 — Contract correction after independent review

- CEREBRO detected that visibility and opacity controls were incorrectly using `allowLocked: true`, contradicting the T031 contract for locked Layers.
- Corrected `web/app.js`: visibility and opacity now use the normal locked-layer guard; only the lock toggle may use `allowLocked: true` so a locked Layer can be unlocked.
- Added a deterministic UI wiring regression asserting the contract: no `allowLocked` for visibility/opacity and explicit `allowLocked` only for the lock toggle.
- T030, Android code, domain operation architecture and persistence architecture remain unchanged.

## T032 — Web Layer Lifecycle / Management

ESTADO:
INTEGRADA EN MAIN. PR #17 fusionada correctamente y CI post-merge verificado sobre el merge SHA.

BASELINE:
main @ f887df791ff42c03d6cbbd981bc18da1ddd977.

BRANCH:
t032-web-layer-lifecycle.

IMPLEMENTACIÓN:
- Se reutilizó la frontera existente de web/domain/document-operations.mjs para rename, duplicate, delete y reorder.
- Rename modifica únicamente el nombre.
- Duplicate crea un ID nuevo y una copia profunda independiente, conservando contenido, transform y propiedades.
- Delete impide dejar el Document sin Layers.
- Reorder intercambia determinísticamente Layers adyacentes sin alterar contenido ni propiedades.
- La UI existente de Layers fue ampliada con controles mínimos para las cuatro operaciones.
- Las operaciones usan la única selección existente, DocumentHistory, persistencia localStorage y renderer existente.
- No se creó LayerManager, LayerStore, LayerHistory, LayerRenderer, SelectionManager ni PersistenceManager.
- No se creó segundo Document, History, Renderer, Persistence o Selection.
- Android no fue modificado.

PRE-MERGE:
- PR #17 — T032: Web layer lifecycle management.
- Head de implementación: bfe35405991230e00e83fb168975cc8e4b96bf18.
- Web CI #77 / ID 37397317973: SUCCESS sobre el head de implementación.
- Android CI #176 / ID 37397317041: SUCCESS sobre el head de implementación.
- PR sin conflictos, sin revisiones pendientes y con mergeable=true antes del merge.

MERGE:
- PR #17: MERGED.
- Merge SHA: b07cfc96f2788bf63a27bff1b26110532f2b94db.
- main recibió el merge sin cambios funcionales adicionales de T032.

POST-MERGE:
- main HEAD inmediatamente después del merge: b07cfc96f2788bf63a27bff1b26110532f2b94db.
- Web CI #78 / ID 37410543081: SUCCESS sobre el merge SHA.
- Android CI #177 / ID 37410543116: SUCCESS sobre el merge SHA.
- Android post-merge: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Web post-merge: Build PASS, npm test PASS, dist verification PASS.

CONTINUIDAD:
- T029 → T030 → T031 → T032.
- T033 queda como siguiente tarea de continuidad, sin iniciar en T032.
- No se inventa alcance ni contenido de T033.

DEUDA:
- La CI no incluye E2E físico de navegador.
- localStorage continúa siendo la persistencia Web existente; IndexedDB queda fuera de T032.
- window.prompt es una UI mínima para Rename; edición inline puede considerarse UX futura, fuera de T032.

NO HACER:
- No ampliar T032 retrospectivamente.
- No iniciar T033 dentro del cierre de T032.



## T034 — Web Document / Project Lifecycle

ESTADO:
INTEGRADA EN MAIN. PR #18 fusionada correctamente y CI pre-merge/post-merge verificado sobre los SHAs correspondientes.

BASELINE:
main @ 86d1f6c59e58d1c0730edab2bf9b16b961f19926.

BRANCH:
t034-web-document-project-lifecycle.

CANDIDATE:
39466d3cae46beeb4b6f552ffbfff68d0979ab6e.

IMPLEMENTACIÓN:
- Flujo explícito New Document con ancho/alto configurables y validación de enteros positivos.
- Protección de reemplazo mediante confirmación cuando existen cambios desde el último Save explícito.
- Save explícito reutilizando la persistencia localStorage existente.
- Open / Recover explícito reutilizando la misma clave de proyecto y restoreDocument().
- Reset de DocumentHistory al crear o recuperar un documento.
- Estado dirty mínimo para distinguir cambios pendientes del último Save explícito.
- Se mantienen el Document, Layer, Document Operations, DocumentHistory, localStorage y renderer existentes.
- No se creó DocumentManager, ProjectManager, PersistenceManager, HistoryManager ni arquitectura paralela.
- Android no fue modificado.

ARCHIVOS MODIFICADOS:
- web/app.js
- web/index.html
- web/styles.css
- web/test/domain.test.mjs
- web/test/smoke.test.mjs

PRE-MERGE:
- PR #18 — T034: Web document and project lifecycle.
- Web CI #80 / ID 37412753014: SUCCESS sobre SHA 39466d3cae46beeb4b6f552ffbfff68d0979ab6e.
- Web: Build PASS, Test PASS, Verify build output PASS.
- Android CI #179 / ID 37412752935: SUCCESS sobre SHA 39466d3cae46beeb4b6f552ffbfff68d0979ab6e.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.

MERGE:
- PR #18: MERGED.
- Merge SHA: 55f54a33922d02475cc6ca64130fece43f14b60e.
- main HEAD inmediatamente después del merge: 55f54a33922d02475cc6ca64130fece43f14b60e.

POST-MERGE:
- Web CI #81 / ID 37465374753: SUCCESS sobre SHA 55f54a33922d02475cc6ca64130fece43f14b60e.
- Web: Build PASS, Test PASS, Verify build output PASS.
- Android CI #180 / ID 37465374763: SUCCESS sobre SHA 55f54a33922d02475cc6ca64130fece43f14b60e.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.

CONTINUIDAD:
- T032 → T033 → T034.
- T033 fue una auditoría/definición de MVP y no implementó código.
- T034 completa el ciclo de vida Web de documento/proyecto dentro del alcance MVP definido.
- T035 queda NO iniciada.

FUERA DE ALCANCE:
- T035 Brush Controls.
- T036 PNG Export.
- T037 E2E final.
- Multi-project management, IndexedDB, cloud, AI, OCR, background removal, smart shading, PWA y cambios Android.

ARQUITECTURA:
REUTILIZAR > ADAPTAR > CREAR.
La cadena continúa siendo: Layer → Document → Document Operations → DocumentHistory → Persistence → Renderer.

VERIFICACIÓN:
T034 cumple el gate de implementación, pre-merge CI, merge, post-merge CI y presencia en main. No se conocen regresiones nuevas derivadas de T034.


## T035 — Web Brush Controls

ESTADO:
INTEGRADA EN MAIN. PR #19 fusionada correctamente y CI pre-merge/post-merge verificado sobre los SHAs correspondientes.

BASELINE:
main @ a7d54c0959bbef42e0d3aef4c7fcb912b4a3d2ae.

BRANCH:
t035-web-brush-controls.

CANDIDATE:
5bd5f71dceb821a10b98b62fb44bd783101fedb0.

IMPLEMENTACIÓN:
- Controles Web mínimos de color, tamaño y opacidad del pincel.
- Color y opacidad pasan a formar parte de cada nuevo Stroke; los strokes históricos no se reescriben al cambiar los controles.
- Tamaño validado y limitado al rango UI 1–100, evitando valores no finitos o no positivos.
- Opacidad representada de forma coherente como 0–1 en Stroke y controlada en UI como 0–100%.
- Renderer reutiliza los metadatos existentes del Stroke para aplicar color/opacidad.
- Eraser existente se conserva como herramienta separada y no utiliza el color del pincel.
- Dibujo continúa respetando layers bloqueadas.
- Undo/Redo continúa usando DocumentHistory existente.
- Persistencia/restore conserva compatibilidad con strokes anteriores mediante normalización.
- No se creó ningún manager paralelo.

ARCHIVOS MODIFICADOS:
- web/app.js
- web/domain/model.mjs
- web/index.html
- web/styles.css
- web/test/domain.test.mjs
- web/test/smoke.test.mjs

PRE-MERGE:
- PR #19 — T035: Web Brush Controls.
- Primer intento Web CI #83 / ID 37471192589: FAILURE sobre SHA d0834a44dd5466fa323308cadd5bb67c63e09ac4. Build PASS; Test FAIL por UI de controles no presente en web/index.html.
- Reparación: se identificó que la primera escritura de web/index.html no había modificado el contenido; se corrigió mediante un commit específico.
- Web CI #84 / ID 37471353567: SUCCESS sobre SHA 5bd5f71dceb821a10b98b62fb44bd783101fedb0.
- Android CI #183 / ID 37471353600: SUCCESS sobre SHA 5bd5f71dceb821a10b98b62fb44bd783101fedb0. Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.

MERGE:
- PR #19: MERGED.
- Merge SHA: f1fa29eb69b0a505c56cc55de3659c951765ae7a.

POST-MERGE:
- Web CI #85 / ID 37471862431: SUCCESS sobre SHA f1fa29eb69b0a505c56cc55de3659c951765ae7a.
- Android CI #184 / ID 37471862552: SUCCESS sobre SHA f1fa29eb69b0a505c56cc55de3659c951765ae7a. Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.

CONTINUIDAD:
- T032 → T033 → T034 → T035.
- T034 cerró el ciclo de documento/proyecto.
- T035 completa los controles básicos del pincel sobre la arquitectura existente.
- T036 queda NO iniciada.
- T037 queda NO iniciada.

FUERA DE ALCANCE:
- T036 PNG Export.
- T037 E2E/MVP final.
- Brush presets, gradient, eyedropper, blend modes, filters, pressure sensitivity, advanced brush engine, stabilizer, texture/custom brushes, AI.
- IndexedDB, cloud, PWA, OCR, background removal, smart shading, text/shape layers, masks, multi-select, grouping, nested layers.
- Cambios Android.

ARQUITECTURA:
REUTILIZAR > ADAPTAR > CREAR.
No se introdujeron BrushManager, BrushController, ColorManager, OpacityManager, ToolManager, DrawingManager, StrokeManager, CanvasManager ni HistoryManager.

VERIFICACIÓN:
T035 cumple implementación, tests, smoke wiring, CI pre-merge, merge, CI post-merge y presencia en main. El primer CI Web falló por una escritura incompleta de index.html y fue corregido antes del merge. No se declara GREEN definitivo hasta verificar el CI final sobre el nuevo HEAD de main.

## T036 — Web PNG Export

ESTADO:
INTEGRADA EN MAIN. T036 completada con PR #20, merge y CI pre/post-merge GREEN sobre los SHAs reales.

BASELINE:
main @ a9e1e1cb6c32fb0917fd8289bcb2a133a190971b.

BRANCH:
t036-web-png-export.

CANDIDATE:
60c3129e4cd38b5ef7f9546df4dfcf063030a8e1.

IMPLEMENTACIÓN:
- Control mínimo `Exportar PNG` en la UI Web.
- Exportación local mediante Canvas 2D, Blob y object URL; sin API externa, cloud ni dependencia adicional.
- Canvas de exportación dimensionado exactamente con `Document.width` × `Document.height`.
- Se reutiliza el renderer documental existente (`drawDocument`) en lugar de crear un segundo renderer.
- Solo se componen layers visibles, respetando su orden.
- Layers ocultas quedan excluidas.
- Layers bloqueadas visibles siguen siendo exportables.
- Opacidad de layer y opacidad de stroke se componen conjuntamente.
- Transformaciones persistidas de layer se respetan en la exportación.
- Canvas de exportación con alpha para preservar transparencia; no se exporta la UI ni el overlay de selección.
- Images visibles se esperan antes de renderizar el PNG.
- Nombre de descarga por defecto: `animeart.png`.
- Exportación no registra operaciones en DocumentHistory y mantiene Undo/Redo.
- No se crearon ExportManager/PNGManager/ImageExportManager ni otro manager paralelo.
- Android no fue modificado.

TESTS / SMOKE:
- Tests Web cubren dimensiones, transparencia, pipeline de Blob/descarga, composición visible, opacity, transforms, locked layers, exclusión de UI y no-destructividad de history/Undo/Redo.
- La infraestructura Web CI valida build + tests + dist.
- No existe un navegador E2E físico que inspeccione el archivo descargado; esa limitación queda explícita. La generación/encodificación/descarga se cubre mediante tests del pipeline y el smoke de CI.
- Android Startup Smoke continúa verificando la regresión Android.

PRE-MERGE:
- PR #20 — T036: Web PNG export.
- Web CI #96 / ID 37475965636: SUCCESS sobre SHA 60c3129e4cd38b5ef7f9546df4dfcf063030a8e1.
- Android CI #195 / ID 37475965679: SUCCESS sobre SHA 60c3129e4cd38b5ef7f9546df4dfcf063030a8e1.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS.
- Web: Build PASS, Test PASS, Verify build output PASS.

MERGE:
- PR #20: MERGED.
- Merge SHA: df14a13ce4f372da6db7c4c7882b1a77451f6bf6.
- main HEAD inmediatamente después del merge: df14a13ce4f372da6db7c4c7882b1a77451f6bf6.

POST-MERGE:
- Web CI #97 / ID 37476642772: SUCCESS sobre SHA df14a13ce4f372da6db7c4c7882b1a77451f6bf6.
- Android CI #196 / ID 37476642746: SUCCESS sobre SHA df14a13ce4f372da6db7c4c7882b1a77451f6bf6.
- Android post-merge: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Web post-merge: Build PASS, Test PASS, Verify build output PASS.

CONTINUIDAD:
- T032 → T033 → T034 → T035 → T036.
- T036 completa la primera exportación PNG funcional del editor Web.
- T037 NO INICIADA.

INCIDENCIAS / REPARACIONES:
- Web CI #88 / ID 37475521095: FAILURE por tests T036; se aislaron mocks/regExes y se consolidaron los tests.
- Web CI #92 / ID 37475672160: FAILURE por assertions T036 concurrentes; se reconciliaron.
- CI #93 / ID 37475776576 y Android #192 / ID 37475776517: CANCELLED por concurrencia mientras la rama recibía ajustes de tests; no se usaron como evidencia GREEN.
- Web CI #95 / ID 37475871721: SUCCESS.
- Android #194 / ID 37475871582: CANCELLED por otro commit concurrente de ajuste de smoke; no se usó como evidencia GREEN.
- Web CI #96 / ID 37475965636 y Android #195 / ID 37475965679: SUCCESS sobre el candidato final.
- No hubo fallo funcional de Android durante T036; los cambios fueron exclusivamente Web.

ARQUITECTURA:
REUTILIZAR > ADAPTAR > CREAR.
La cadena permanece: Layer → Document → Document Operations → DocumentHistory → Persistence → Renderer → PNG export adapter.

VERIFICACIÓN:
T036 cumple implementación, tests, CI pre-merge, merge protegido por expected head SHA, CI post-merge y presencia en main. T037 permanece sin iniciar.



## T036 — Web PNG Export

ESTADO:
INTEGRADA EN MAIN. PR #20 fusionada correctamente. CI pre-merge y post-merge verificados sobre los SHAs reales.

BASELINE:
main @ a9e1e1cb6c32fb0917fd8289bcb2a133a190971b.

BRANCH:
t036-web-png-export.

CANDIDATE:
60c3129e4cd38b5ef7f9546df4dfcf063030a8e1.

IMPLEMENTACIÓN:
- Control UI mínimo "Exportar PNG".
- Exportación local del Document actual a PNG mediante Canvas 2D.
- Se reutiliza el renderer existente de Document; no se creó un segundo renderer.
- El canvas de exportación usa exactamente Document.width y Document.height.
- La composición recorre las Layers en el orden existente y excluye únicamente Layers ocultas.
- Se conserva layer opacity y transform.
- Las Layers locked visibles se exportan; lock continúa siendo una protección de edición, no de render/export.
- El canvas de exportación usa alpha=true y se limpia sin introducir fondo blanco.
- Los strokes reutilizan color, tamaño y opacity existentes; eraser conserva su comportamiento actual.
- Las Image Layers visibles se esperan/cargan antes de codificar el PNG.
- La descarga utiliza Blob + Object URL local y nombre animeart.png.
- No se envían imágenes a APIs, cloud o servicios externos.
- Exportar no registra operaciones en DocumentHistory ni modifica Document, Undo o Redo.
- No se creó ExportManager, PNGManager, ImageExportManager, RenderManager, CanvasManager, DocumentManager, ProjectManager ni LayerManager.

ARCHIVOS MODIFICADOS:
- web/app.js
- web/domain/png-export.mjs
- web/index.html
- web/test/domain.test.mjs
- web/test/smoke.test.mjs

PRE-MERGE:
- PR #20 — T036: Web PNG export.
- Primer Web CI #87 / ID 37475487430: FAILURE sobre SHA 8e5d79ff1ec87938983a40518613e5aa0789ad90. Build PASS; Test FAIL por assertions de smoke durante la integración de la nueva ruta.
- Reparación: se aisló la duplicación de wiring/test de exportación y se reconciliaron los checks con el renderer real.
- Web CI #94 / ID 37475800643: FAILURE sobre SHA 3191cfe1eb523a4fab28d0f68a99190e09eee652. Build PASS; 264/266 tests PASS. Los 2 fallos eran el mismo matcher de smoke ejecutado dos veces por la infraestructura existente porque build copia web/ a dist/ y node --test descubre ambas ubicaciones.
- Reparación: se corrigió el matcher para la firma real del renderer.
- Web CI #96 / ID 37475965636: SUCCESS sobre SHA 60c3129e4cd38b5ef7f9546df4dfcf063030a8e1.
- Android CI #195 / ID 37475965679: SUCCESS sobre SHA 60c3129e4cd38b5ef7f9546df4dfcf063030a8e1. Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Android CI #194 / ID 37475871582 fue CANCELLED por concurrencia antes de resultado; no se usa como evidencia de GREEN.

MERGE:
- PR #20: MERGED.
- Merge SHA: df14a13ce4f372da6db7c4c7882b1a77451f6bf6.
- main HEAD inmediatamente después del merge: df14a13ce4f372da6db7c4c7882b1a77451f6bf6.

POST-MERGE:
- Web CI #97 / ID 37476642772: SUCCESS sobre SHA df14a13ce4f372da6db7c4c7882b1a77451f6bf6.
- Web: Build PASS, Test PASS, Verify build output PASS.
- Android CI #196 / ID 37476642746: SUCCESS sobre SHA df14a13ce4f372da6db7c4c7882b1a77451f6bf6.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.

TESTS / SMOKE:
- Pipeline unit tests verifican dimensiones de Document, canvas transparente, centrado documento→export, codificación image/png y descarga local .png.
- Smoke tests verifican wiring del control, renderer existente, visibilidad, opacity, transforms, exclusión de UI y no impacto de history.
- El CI actual no dispone de browser E2E físico para inspeccionar una descarga real del navegador; por ello la generación/codificación/descarga se valida mediante el pipeline verificable y smoke tests, y esta limitación queda documentada.

CONTINUIDAD:
- T032 → T033 → T034 → T035 → T036.
- T036 completa la primera salida de imagen del MVP: PNG.
- T037 queda NO INICIADA.

FUERA DE ALCANCE:
- T037 E2E/MVP final.
- JPG, WEBP, SVG, PDF, GIF, video.
- Cloud/backend export, AI export, batch export, calidad/compresión avanzada.
- IndexedDB, PWA, OCR, background removal, smart shading.
- Cambios Android funcionales.

ARQUITECTURA:
REUTILIZAR > ADAPTAR > CREAR.
La cadena continúa usando Document → Layers → renderer Canvas 2D → PNG, sin sistema paralelo de exportación/renderer.

VERIFICACIÓN:
T036 cumple implementación, tests, smoke verificable, CI pre-merge, merge, CI post-merge y presencia en main. T037 no fue iniciada.


## T037 — MVP FINAL E2E / READINESS GATE

ESTADO: INTEGRADA EN MAIN. PR #21 fusionada. E2E contractual y regresión Web/Android verificadas.

BASELINE:
e4e95894b97f236ee0d69dda356a3487a53db8d3

BRANCH:
t037-web-mvp-final-gate

CANDIDATE:
0aba3788b914577cb5244619146869bee8c25af9

PR:
#21 — T037: MVP final E2E readiness gate.

IMPLEMENTACIÓN / E2E:
- Se añadió únicamente la cobertura E2E contractual mínima faltante, reutilizando Document, Layer, DocumentHistory, persistence y PNG export existentes.
- El contrato valida 800×600, stroke con color/tamaño/opacidad, rename/duplicate/reorder/visibility/lock, history undo/redo, round-trip de persistencia, dimensiones/alpha/PNG y contrato de layer visible/oculta/locked.
- Se verificó wiring UI de New, Save, Recover y Export PNG.
- No se creó framework browser E2E nuevo ni arquitectura paralela.

PRE-MERGE:
- Web CI #102 / ID 37485782285: SUCCESS sobre SHA 0aba3788b914577cb5244619146869bee8c25af9.
- Android CI #201 / ID 37485782398: SUCCESS sobre SHA 0aba3788b914577cb5244619146869bee8c25af9.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Web: Build PASS, Test PASS, Verify build output PASS.

REPARACIÓN:
- Primer candidato f1a1e0dc908eab24920089f47254151f470794c9 tuvo Web Test FAILURE por un matcher del nuevo contrato locked-layer que no reflejaba la guarda real del renderer/app; se corrigió sin debilitar la assertion.
- Web CI #101 / ID 37485612110 pasó sobre el SHA corregido; Android #199 / ID 37485532373 fue CANCELLED por concurrencia y no se contó como evidencia.
- Android #200 / ID 37485612112 fue CANCELLED por concurrencia; Android #201 proporcionó la evidencia final PASS.

MERGE:
- PR #21 MERGED con expected_head_sha=0aba3788b914577cb5244619146869bee8c25af9.
- Merge SHA: 3094bbf26a95b71b8ab619dd8e97d4894291de70.

POST-MERGE:
- Web CI #103 / ID 37491021919: SUCCESS sobre merge SHA 3094bbf26a95b71b8ab619dd8e97d4894291de70.
- Android CI #202 / ID 37491021627: SUCCESS sobre merge SHA 3094bbf26a95b71b8ab619dd8e97d4894291de70.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Web: Build PASS, Test PASS, Verify build output PASS.

MAIN:
HEAD verificado en 3094bbf26a95b71b8ab619dd8e97d4894291de70.

RESULTADO:
MVP E2E final validado para el alcance actual: Document → Drawing → Layers → Brush → History → Persistence → PNG Export.
No se iniciaron funcionalidades futuras ni T038.


## T038 — Web Multi-Selection / Group Move Foundation

ESTADO:
GREEN — integrado en main y verificado con CI pre-merge y post-merge reales.

BASELINE:
`d14e43439ac64830841ac829126c04b85889b42b`

BRANCH:
`t038-web-multi-selection`

CANDIDATE:
`45f90dd409d62199e30deb6648a9594196d8dfb0`

PR:
#23 — T038: Web Multi-Selection / Group Move Foundation.

IMPLEMENTADO:
- Se reutilizó la frontera de selección existente de T026 y se adaptó con `selectedLayerIds`, manteniendo `selectedLayerId` como ancla.
- Shift+click en Layers y Canvas agrega/quita selección.
- `translateLayers()` mueve varias capas de forma inmutable y bloquea atómicamente la operación si alguna capa está locked.
- El movimiento grupal usa el mismo pipeline Screen → Viewport → Document.
- El preview es transitorio; pointerup registra una sola operación en DocumentHistory y persistence.
- pointercancel descarta el preview sin mutar Document ni History.
- Escala/rotación multi-layer y grouping persistente quedan fuera de alcance.
- Se eliminó el duplicado real del control Exportar PNG.
- Android no fue modificado.

TESTS:
- Normalización/deduplicación de selección.
- Toggle de selección.
- Traducción multi-layer inmutable.
- Bloqueo atómico con capa locked.
- Wiring Shift/multi-selection.
- Una sola entrada de History/persistencia.
- Unicidad del control Export PNG.

PRE-MERGE:
- Web CI #108 / ID 37496742259: SUCCESS sobre SHA `45f90dd409d62199e30deb6648a9594196d8dfb0`.
- Android CI #207 / ID 37496742269: SUCCESS sobre SHA `45f90dd409d62199e30deb6648a9594196d8dfb0`.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Web: Build PASS, Test PASS, Verify build output PASS.

MERGE:
- PR #23 MERGED con expected_head_sha=`45f90dd409d62199e30deb6648a9594196d8dfb0`.
- Merge SHA: `58038619c3e1b6b45866a59f341a1ef1d0b00427`.

POST-MERGE:
- Web CI #109 / ID 37497664570: SUCCESS sobre merge SHA `58038619c3e1b6b45866a59f341a1ef1d0b00427`.
- Android CI #208 / ID 37497664519: SUCCESS sobre merge SHA `58038619c3e1b6b45866a59f341a1ef1d0b00427`.
- Android: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Web: Build PASS, Test PASS, Verify build output PASS.

INCIDENCIAS:
- Web CI #106 / ID 37496644654 falló sobre un commit intermedio del branch; se corrigió antes del candidato final.
- Android CI #205 / ID 37496644828 fue cancelado por concurrencia sobre ese commit intermedio; no se contó como evidencia.
- Android CI #206 / ID 37496673851 fue cancelado por concurrencia sobre otro commit intermedio; no se contó como evidencia.
- La primera ejecución Android #204 / ID 37496416548 del branch fue cancelada durante Startup Smoke por concurrencia; se reintentó la ejecución y la validación final del branch quedó en Android #207 SUCCESS.
- Ninguna ejecución cancelada/skipped/queued se usó como PASS.

RESULTADO:
T038 queda integrado y verificado en main. El editor Web conserva una única arquitectura de selección, transform, viewport, history, persistence y renderer; T038 añade únicamente la capacidad de selección múltiple y movimiento grupal dentro de esas fronteras existentes.

## T039 — Web Persistence Hardening

ESTADO:
GREEN — persistence contract hardened and integrated.

BASELINE:
`83ff9f319effa28b0b8286a1f4ab815ff45db018`

BRANCH:
`t039-web-persistence-hardening`

CANDIDATE FINAL:
`1669da48e60698f836f06d6288407b78182779ad`

PR:
#24 — T039: Web persistence hardening.

IMPLEMENTADO:
- Normal save/backup now routes through the existing `persistDocumentSnapshot()` contract.
- Existing `serializeDocumentForStorage()` remains the single serialization/size boundary.
- Existing `restoreDocument()` remains the sole recovery boundary, including legacy migration.
- Storage and size failures are controlled; the current Document remains intact and explicit save is not marked successful.
- Image documents continue through the same serializer and restore path.
- History remains separate from persistence success; no second History or persistence system was introduced.
- No IndexedDB, cloud, backend, autosave framework or alternate storage format.

TESTS:
- Serialization size guard.
- Storage failure handling.
- Normal save persistence contract wiring.
- Image + drawing + transform serialize/restore round-trip.
- Existing legacy document restoration.
- Existing image import persistence rollback tests.
- Full Web regression suite.

PRE-MERGE:
- Web CI #116 / ID 37501776142: SUCCESS on `1669da48e60698f836f06d6288407b78182779ad`.
- Android CI #215 / ID 37501776357: SUCCESS on `1669da48e60698f836f06d6288407b78182779ad`.

MERGE:
- PR #24 MERGED.
- Merge SHA: `80c480effc9426a0ecbce0a0f124ad0fcd40e966`.

POST-MERGE:
- Web CI #117 / ID 37502347802: SUCCESS on merge SHA.
- Android CI #216 / ID 37502347805: SUCCESS on merge SHA.

INCIDENCIAS:
- Web CI #113 / ID 37500847907 failed because the new smoke assertion was inserted into the wrong existing test and referenced an undefined variable.
- Web CI #114 / ID 37500966176 then exposed an existing brittle assertion expecting the old direct JSON.stringify persistence shape.
- Repairs moved the new contract assertion to the document lifecycle test and adapted the old assertion to the real persistence boundary.
- Final branch CI #116/#215 passed; post-merge #117/#216 passed.
- No cancelled, skipped or queued run was counted as positive evidence.

RESULTADO:
T039 is integrated. The Web editor now has one coherent persistence contract from serialization through localStorage and one recovery boundary through restoreDocument().


---

## T040 — Web Document Mutation Transaction Integrity

ESTADO:
GREEN — integrado, validado y cerrado sobre main.

BASELINE:
`efe176efe78f027eace9c8a46befb7b9495e0e6e`

BRANCH:
`t040-web-document-mutation-transaction-integrity`

CANDIDATE FINAL:
`b6fa6b1ddb2136c22640872d4f097afb3e99d414`

PR:
#25 — T040: Web document mutation transaction integrity.

MERGE:
- PR #25 MERGED.
- Merge SHA: `188c5ae3d065a51bef3caa12bc8108da13a4f042`.
- main HEAD verificado en `188c5ae3d065a51bef3caa12bc8108da13a4f042` antes de esta actualización de Continuity.

PROBLEMAS ENCONTRADOS:
- Drawing completion podía sobrescribir el error de persistencia.
- Transform completion podía refrescar la UI después de intentar persistir y ocultar el error de persistencia.
- La primera assertion de persistencia del test T040 inspeccionaba demasiado ámbito y detectaba el mensaje de éxito fuera del catch.

REPARACIONES:
- Drawing ahora conserva el error de persistencia.
- Transform actualiza la UI antes del intento de persistencia para conservar el error de almacenamiento.
- La assertion se restringió al bloque catch.
- Se añadieron regresiones para orden transaccional, dirty semantics, persistencia, drawing y transform.
- No se introdujo ningún manager, Document, History, serializer o persistence layer nuevo.

PRE-MERGE:
- Web CI #120 / ID 37511350395: SUCCESS sobre `b6fa6b1ddb2136c22640872d4f097afb3e99d414`.
- Web: Build PASS, Test PASS, Verify build output PASS.
- Android CI #219 / ID 37511350412: SUCCESS sobre `b6fa6b1ddb2136c22640872d4f097afb3e99d414`.
- Android: Build PASS, Unit tests PASS, Lint PASS, Startup Smoke PASS, Upload debug APK PASS.

POST-MERGE:
- Web CI #121 / ID 37513973950: SUCCESS sobre `188c5ae3d065a51bef3caa12bc8108da13a4f042`.
- Web: Build PASS, Test PASS, Verify build output PASS.
- Android CI #220 / ID 37513973837: SUCCESS sobre `188c5ae3d065a51bef3caa12bc8108da13a4f042`.
- Android: Build PASS, Unit tests PASS, Lint PASS, Startup Smoke PASS, Upload debug APK PASS.
- Workflow completo: SUCCESS.

INCIDENCIAS:
- Web CI #119 / ID 37511245811 falló por la assertion demasiado amplia; se corrigió en el candidato final.
- Android CI #218 / ID 37511247118 fue CANCELLED y no se utilizó como evidencia GREEN.
- No se utilizó ninguna ejecución CANCELLED, IN PROGRESS, SKIPPED o FAILED como evidencia positiva.

ARQUITECTURA:
REUTILIZAR > ADAPTAR > CREAR.
La frontera validada permanece:
Document → DocumentHistory → persistDocumentSnapshot() → localStorage → UI.
No se creó un sistema paralelo de transacciones, history, serialización, persistencia o renderer.
Android no fue modificado funcionalmente.

VERIFICACIÓN:
- PR #25 MERGED.
- main verificado en el merge SHA `188c5ae3d065a51bef3caa12bc8108da13a4f042`.
- Web pre-merge PASS.
- Android pre-merge PASS.
- Web post-merge PASS.
- Android post-merge PASS.
- Android Startup Smoke PASS.
- Todos los jobs obligatorios de Android #220 terminaron SUCCESS.
- Continuity actualizado con evidencia final real.

RESULTADO:
T040 queda completamente integrado, validado y GREEN sobre main. T041 queda habilitada pero no iniciada.



## T041 — Web Multi-Layer Transform: Scale + Rotation

ESTADO:
GREEN — integrado, validado y cerrado sobre main.

BASELINE:
`82648ed65f57ea0ca6d4ff4ccce1a83971ee37a5`

BRANCH:
`t041-web-multilayer-transform`

CANDIDATE FINAL:
`48c3515d476773e8e5660d08d782c98f98d54fc7`

PR:
#26 — T041: add multi-layer scale and rotation.

OBJETIVO:
Extender la selección múltiple existente con:
- Group Move — existente desde T038.
- Group Scale — T041.
- Group Rotation — T041.

IMPLEMENTADO:
- Bounding box grupal reutilizando la geometría de selección existente.
- Escala grupal uniforme mediante drag de esquina.
- Rotación grupal mediante drag del control de rotación.
- Preservación de posiciones relativas durante la transformación.
- Actualización conjunta de posición, scale y rotation de las layers seleccionadas.
- Pivote de rotación: centro del bounding box grupal.
- Regla de escala mínima positiva reutilizando el patrón existente de transformación.
- Bloqueo atómico: una selección con una layer locked no aplica la transformación.
- Drawing Layer e Image Layer usan el mismo Layer Transform.
- Preview transitorio durante pointer interaction.
- Una sola operación lógica de History por scale/rotation.
- Persistencia mediante `persistDocumentSnapshot()`.
- pointercancel descarta el preview sin modificar Document/History.
- Group Move existente permanece en el mismo pipeline.

ARQUITECTURA REUTILIZADA:
Selection
→ existing transform geometry
→ Document Operations
→ DocumentHistory
→ Persistence
→ existing Canvas renderer.

No se creó:
- MultiLayerTransformManager.
- GroupTransformManager.
- TransformManager.
- SelectionManager.
- HistoryManager.
- PersistenceManager.
- RenderManager.
- segundo Document.
- segundo History.
- segundo Persistence.
- segundo Renderer.

TESTS:
- Web smoke/regression tests para wiring, arquitectura, History, persistence, pointercancel y group move.
- Tests ejecutables de geometría para group scale.
- Tests ejecutables de geometría para group rotation.
- Test de atomicidad con locked layer.
- Test de serialización de transforms para Drawing + Image Layer.

PRE-MERGE:
- Web CI #122? No. T041 branch Web CI:
  - Run #122 fue el baseline T040 sobre main y no se usa como T041 pre-merge.
  - Web CI run #37527190153 sobre candidate inicial `33c51eace3010483d44125a49b6b88ca72144be7`: SUCCESS.
  - Android CI run #37527190297 sobre candidate inicial `33c51eace3010483d44125a49b6b88ca72144be7`: SUCCESS.
  - Web CI run #37527685885 sobre candidate final `48c3515d476773e8e5660d08d782c98f98d54fc7`: SUCCESS.
  - Android CI run #37527685710 sobre candidate final `48c3515d476773e8e5660d08d782c98f98d54fc7`: SUCCESS.
- Web candidate final: Build PASS, Test PASS, Verify build output PASS.
- Android candidate final: Build PASS, Unit tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.

INCIDENCIAS / REPARACIONES:
- Web CI run #37527669530 sobre commit intermedio `25839f039c7bcd723e6669fc37382945422a68dc`: FAILURE.
- Causa: expectativas geométricas iniciales de los tests T041 no coincidían exactamente con el factor de escala y el ángulo de rotación calculados por la geometría implementada.
- Reparación: se corrigieron únicamente las expectativas ejecutables del test.
- Web CI posterior sobre `48c3515d476773e8e5660d08d782c98f98d54fc7`: SUCCESS.
- Android CI asociado al commit intermedio se ejecutó y posteriormente quedó reemplazado por la validación del candidate final; no se utilizó como evidencia GREEN final.
- No se ocultó ni ignoró el fallo intermedio.

REVISIÓN:
- Se inspeccionó el diff completo de PR #26 antes del merge.
- La revisión formal GitHub APPROVE no pudo ser creada por el mismo actor que abrió la PR: GitHub rechaza aprobar la propia PR.
- No existía ruleset visible que exigiera una aprobación externa; el endpoint de branch protection no fue accesible por permisos de integración.
- El merge se realizó solamente después de la revisión técnica del diff y de Web/Android CI finales PASS.

MERGE:
- PR #26 MERGED.
- Merge SHA:
`2d168c0542622ded540bbee4fc320db4246568d8`
- main HEAD actualizado al merge SHA.

POST-MERGE:
- Web CI run #37528255948: SUCCESS.
- Web: Build PASS, Test PASS, Verify build output PASS.
- Android CI run #37528255963: SUCCESS.
- Android: Build PASS, Unit tests PASS, Lint PASS, Startup Smoke PASS, Debug APK PASS.
- Android Startup Smoke PASS.
- Todos los jobs obligatorios post-merge terminaron SUCCESS.

OUT OF SCOPE:
- Persistent grouping.
- Nesting.
- Masks.
- Filters.
- Text.
- Shapes.
- IndexedDB.
- PWA.
- Cloud/backend.
- AI.
- Android redesign.
- Nuevo renderer.
- Nuevo History.
- Nueva Persistence.
- Nuevo sistema de grouping.

CONTINUIDAD:
T038 estableció Multi-Selection + Group Move.
T039 endureció Persistence.
T040 endureció la integridad Mutation → History → Persistence → UI.
T041 completa la transformación multi-layer con Scale + Rotation reutilizando esas fronteras.

RESULTADO:
T041 queda integrada y GREEN sobre main.
No se inicia T042.


## T042 — WEB REFERENCE LAYER + TRACING — GREEN

FECHA:
2026-10-06

BASELINE:
- main @ 605b07f257bec99c91231112ef301c5cfb346dbb

BRANCH:
- t042-web-reference-tracing

PR:
- #27 — T042: add web reference layer and tracing workflow
- Merge commit: e4acea7f43985624586ecabac4c896ba470176c1

IMPLEMENTADO:
- Reference semantics sobre la Image Layer existente mediante `isReference`.
- Conversión Image → Reference y Reference → Image.
- Reference conserva image data, transform, opacity, visibility, lock y layer order.
- UI identifica Reference y permite conversión únicamente para Image Layers desbloqueadas.
- Reference reutiliza el renderer Canvas existente.
- Drawing permanece independiente en Drawing Layers.
- Reference reutiliza move, scale, rotation y multi-layer transforms existentes.
- Locked Reference conserva la política atómica existente de layers locked.
- History utiliza DocumentHistory existente.
- Persistence y recovery utilizan el serializer/restore y localStorage existentes.
- PNG export conserva el comportamiento natural de visibility y renderer; no se creó exportador especial.

ARQUITECTURA:
- No se creó ReferenceDocument.
- No se creó ReferenceLayerManager.
- No se creó ReferenceImageStore.
- No se creó ReferenceRenderer.
- No se creó ReferenceHistory.
- No se creó ReferencePersistence.
- No se creó un segundo renderer, persistence, history, selection o transform system.
- PR #2 histórico no fue mergeado, cherry-picked ni portado; solo se respetó como evidencia histórica.

TESTS:
- Reference state/conversion.
- Reversibilidad.
- Persistencia round-trip.
- Locked reference transform protection.
- Existing transform pipeline.
- Visibility/opacity.
- Drawing independence.
- Contractual reference workflow.
- Architecture guard.
- Normal Image Layer regression.
- Existing multi-layer transform regression.
- PNG export regression.
- Final Web CI: run #132 SUCCESS, 322 tests PASS.

INCIDENCIAS REALES:
- Web CI #128 falló por sintaxis introducida accidentalmente en el test contractual.
- Web CI #129 falló porque el escape literal persistió en el mismo test.
- Web CI #130 falló porque el E2E utilizaba una referencia de documento antigua al añadir la nueva Image Layer.
- Las tres incidencias fueron aisladas y reparadas sin debilitar cobertura.
- Web CI #132 confirmó la reparación.
- Android runs intermedios asociados a commits fallidos fueron cancelados/no utilizados como evidencia GREEN.
- Android CI #231 sobre el commit final de la rama terminó SUCCESS.

CI PRE-MERGE:
- Web CI #132: SUCCESS.
- Android CI #231: SUCCESS.
- Android Build: PASS.
- Android Unit Tests: PASS.
- Android Lint: PASS.
- Android Startup Smoke: PASS.
- Debug APK: PASS.

POST-MERGE:
- main @ e4acea7f43985624586ecabac4c896ba470176c1
- Web CI #133: SUCCESS.
- Android CI #232: SUCCESS.
- Android Build: PASS.
- Android Unit Tests: PASS.
- Android Lint: PASS.
- Android Startup Smoke: PASS.
- Debug APK: PASS.

SCOPE:
IN:
- Reference semantics.
- Image → Reference.
- Reference rendering.
- Opacity.
- Visibility.
- Lock.
- Transform.
- Drawing above reference.
- History.
- Persistence.
- Recovery.
- Existing multi-layer transform compatibility.
- Tests.
- CI.

OUT:
- IndexedDB.
- Cloud/backend.
- AI.
- Background removal.
- Smart shading.
- Masks.
- Filters.
- Text.
- Shapes.
- Persistent grouping.
- Nesting.
- JPG/WEBP/SVG/PDF.
- PWA.
- Collaboration.
- Android reference system/redesign.
- New renderer/history/persistence/selection/transform systems.

RESULTADO:
T042 GREEN candidate validated through pre-merge CI, merged to main, post-merge Web/Android CI green, and continuity recorded after evidence.

NO MODIFICAR:
- T040 remains GREEN.
- T041 remains GREEN.

SIGUIENTE DECISIÓN:
- No se autoriza ninguna nueva implementación por esta entrada.
- CEREBRO debe definir el siguiente alcance.


---

## T043 — WEB FOUNDATION MERGE-DOWN / RECOVERY EXECUTION

ESTADO:
IMPLEMENTACIÓN Y MERGE REALIZADOS. La auditoría confirmó una única fuente de verdad Web por responsabilidad. Se corrigieron únicamente dos rutas de mutación persistente que estaban en app.js fuera de la frontera de operaciones de dominio: Add Layer y Clear Layer. No se introdujeron sistemas paralelos.

BASELINE:
c973aab8d8530ad25c48bc83d7f70aa04e7e5792

BRANCH:
t043-web-merge-down

OBJETIVO:
Auditar y consolidar la Web Foundation bajo REUTILIZAR > ADAPTAR > CREAR, sin ampliar el producto ni modificar Android.

AUDITORÍA:
- Document: web/domain/model.mjs.
- Layer: layers[] dentro de Document.
- Stroke: createStroke/normalizeStroke.
- Viewport: web/domain/viewport.mjs como estado de sesión.
- Selection: web/domain/selection.mjs.
- Transform: web/domain/document-operations.mjs para mutación persistente; selection.mjs para geometría de preview.
- History: única DocumentHistory.
- Persistence: único límite localStorage existente.
- Reference: isReference dentro de Image Layer.
- Renderer: Canvas 2D existente en app.js y reutilizado por PNG export.
- No se encontró un segundo subsystema paralelo de Document/Layer/History/Persistence/Selection/Transform/Reference/Renderer.

HALLAZGOS:
1. Add Layer mutaba state.document.layers directamente desde app.js.
2. Clear Layer vaciaba strokes directamente desde app.js.
3. docs/ARCHITECTURE.md seguía describiendo principalmente la arquitectura Android histórica y no reflejaba la Web Foundation actual.

REPARACIONES:
- Añadidos addLayer() y clearLayer() a web/domain/document-operations.mjs.
- Add Layer y Clear Layer ahora siguen Document Operation -> History -> Persistence.
- Añadida cobertura de regresión/guard en web/test/smoke.test.mjs y web/test/mvp-e2e.test.mjs.
- Actualizada docs/ARCHITECTURE.md para documentar la arquitectura Web-first actual.
- No se modificó Android ni ningún workflow CI.

COMMITS DE IMPLEMENTACIÓN:
24576201cfdc56042c7afb9272de87c953e9c0f3
0a72bf40e8a8126f60ec401742de6a80649303b5
6aa2bdecc58815ae383f93c49384e63085f1460c
d3e1997bedbc7f81cddb542dbb811b7272eb7475
3d49b79cf1ec4bc326c51cb84dc7ba88af016701
8b254c11fffa8b7269300789d884c33407c0333f
63fa7f75b4aa4f7b2b5ef143e109d6ccddfc7119

PR:
#28 — T043: consolidate Web foundation mutation boundaries

MERGE:
e046e614a87a8081d5595848be2858f73f1f8bb6

PRE-MERGE CI:
- Web CI #135 — SUCCESS.
- Android CI #234 — SUCCESS.
- Android Build — PASS.
- Android Unit Tests — PASS.
- Android Lint — PASS.
- Android Startup Smoke — PASS.
- Debug APK artifact — PASS.

REVIEW:
PR diff inspected: 5 files only. Technical review comment submitted. No Android or CI workflow files changed.

DEUDA TÉCNICA:
- localStorage remains the current Web persistence boundary and its size ceiling remains unchanged.
- app.js still contains transient gesture/rendering responsibilities by design; no cosmetic refactor was introduced.
- Post-merge push CI evidence must be rechecked through a GitHub Actions run listing capable of exposing push-triggered runs.

PENDIENTES:
- Verify post-merge and post-continuity Web/Android GitHub Actions runs using an Actions endpoint/tool that exposes push-triggered runs.
- Do not start T044 automatically.

SIGUIENTE TAREA:
Decisión de CEREBRO después de cerrar la evidencia post-continuidad.


## T044 — WEB EDITOR CORE / PREPARACIÓN V1 — AUDITORÍA Y VERIFICACIÓN

FECHA: 2026-10-07

BASELINE / MAIN:
- main verificado en c9fb1631a851e45d23cd626a9fbbb6d96ac1e0b5.
- Coincide con el baseline T043 esperado.

T044-A — AUDITORÍA REAL:
- Document: web/domain/model.mjs; restoreDocument/normalizeDocument mantienen la frontera de dominio existente.
- Layers: web/domain/document-operations.mjs concentra addLayer, clearLayer, deleteLayer, duplicateLayer, reorder, visibility, lock, opacity y transformaciones.
- Renderer: web/app.js reutiliza un único renderer Canvas 2D sobre state.document; no existe renderer paralelo.
- Viewport: web/domain/viewport.mjs implementa createViewport, screenToDocument, documentToScreen, panBy y zoomAt; app.js lo consume para pointer/wheel.
- Input: app.js gestiona pointerdown/pointermove/pointerup/pointercancel/wheel y convierte Screen -> Document antes de mutar strokes/transformaciones.
- History: web/domain/history.mjs contiene la única frontera DocumentHistory; undo/redo se realizan sobre Document.
- Persistence: web/domain/image-import.mjs expone persistDocumentSnapshot; app.js conserva la clave localStorage existente y maneja fallos sin reemplazar el Document actual.
- Tests: web/test/smoke.test.mjs y web/test/mvp-e2e.test.mjs cubren contratos, viewport, lifecycle de capas, history, persistence, drawing y regresiones.

REUTILIZACIÓN:
- T044 no requirió crear DocumentManager, LayerManager, CanvasManager, RendererManager, ViewportManager, HistoryManager ni PersistenceManager.
- La arquitectura existente ya satisface el flujo Document -> Layers -> Canvas -> Viewport -> Input -> Domain Operations -> History -> Persistence -> Render.

T044-B — EDITOR INTERACTION FOUNDATION: GREEN por auditoría del código existente y cobertura de tests; no se añadió un segundo sistema de coordenadas.
T044-C — LAYER EDITING FLOW: GREEN por auditoría; las mutaciones de lifecycle pasan por document-operations + History + persistence.
T044-D — HISTORY / UNDO / REDO: GREEN por auditoría y tests existentes; no se creó un segundo historial y viewport navigation no registra history.
T044-E — TESTS: GREEN por cobertura existente y CI real; no se añadieron tests artificiales.

NO MODIFICADO:
- Android no fue tocado.
- Workflows CI no fueron alterados.
- No se creó renderer, Document, layer system, history, persistence o arquitectura paralela.

CI POST-T043 / EVIDENCIA:
- Web CI #137 / run 37557605801 — SUCCESS sobre c9fb1631a851e45d23cd626a9fbbb6d96ac1e0b5.
- Android CI #236 / run 37557605774 — SUCCESS sobre c9fb1631a851e45d23cd626a9fbbb6d96ac1e0b5.
- Android evidencia: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS y artifact PASS.

DECISIÓN T044:
- La implementación T044 no necesitó cambios funcionales porque las capacidades requeridas ya estaban implementadas y verificadas.
- Se actualiza únicamente esta continuidad para registrar la auditoría y evidencia.
- CI posterior al cambio documental: Web CI #138 / run 37559764977 — SUCCESS; Android CI #237 / run 37559765056 — SUCCESS.
- Android CI #237: Build PASS, Unit Tests PASS, Lint PASS, Android Startup Smoke PASS, Debug APK artifact PASS.
- T044-A/B/C/D/E quedan GREEN por implementación existente + auditoría + tests + CI real; no se requirieron cambios funcionales.

## T045 — WEB PWA / OFFLINE SHELL

FECHA: 2026-10-07

ESTADO:
IMPLEMENTADO, MERGED Y VERIFICADO. El siguiente bloque arquitectónicamente correcto después de T044 fue la fundación PWA/offline mínima, porque la Web Foundation, local persistence y editor core ya estaban verificadas. No se introdujo IndexedDB, backend, AI ni un runtime paralelo.

BASELINE:
35bc6aba35de0a033bbb1aa7a6bc3c83c4c8b9c1

IMPLEMENTACIÓN:
- Añadido web/manifest.webmanifest con identidad y modo standalone.
- Añadido web/service-worker.js para cachear el shell estático existente y los módulos de dominio Web necesarios para reabrir el editor offline.
- web/index.html enlaza el manifest existente.
- web/app.js registra el único service worker como mejora progresiva; si el registro falla, el editor continúa funcionando normalmente.
- Añadida cobertura web/test/pwa.test.mjs para manifest, registro, cache y guardas de arquitectura.
- No se creó ningún DocumentManager, LayerManager, CanvasManager, RendererManager, ViewportManager, HistoryManager o PersistenceManager.
- Android y workflows CI no fueron modificados.

REPARACIÓN DURANTE T045:
- La primera versión del service worker cacheaba app.js pero no sus módulos web/domain/*.mjs, por lo que el editor no habría podido arrancar completamente offline.
- Se corrigió antes del cierre añadiendo todos los módulos de dominio actualmente importados por app.js al app shell y una aserción de regresión.

PR:
#29 — T045: establish Web PWA offline shell
MERGE SHA:
0b761df3c093d7bd47a850b926385cf9076a33d8

PRE-MERGE CI:
- Web CI #141 / run 37561416464 — SUCCESS.
- Android CI #240 / run 37561416355 — SUCCESS.
- Android Build — PASS.
- Android Unit Tests — PASS.
- Android Lint — PASS.
- Android Startup Smoke — PASS.
- Debug APK artifact — PASS.

SCOPE:
IN:
- Web manifest.
- Offline app shell.
- Existing Web runtime/module cache coverage.
- Progressive service-worker registration.
- Tests.
- CI.
- Continuity.

OUT:
- IndexedDB migration.
- Cloud/backend.
- AI.
- Background removal.
- Smart shading.
- Filters.
- Text.
- Shapes.
- Collaboration.
- Android PWA/WebView redesign.
- New renderer/history/persistence/document systems.

RESULTADO:
T045 queda GREEN por implementación real, tests, pre-merge Web/Android CI y merge real. La evidencia post-merge de la continuidad documental debe quedar registrada por la siguiente CI antes de cerrar el handoff definitivo.

NO MODIFICAR:
- T044 remains GREEN.
- T045 debe considerarse parte de la Web Foundation existente; no crear un segundo offline/cache/runtime system.

POST-MERGE / POST-CONTINUITY CI:
- Web CI #143 / run 37561744834 — SUCCESS sobre 4c22df9a6adbe0d3c4dc8e8396f0cfd3fb8dd287.
- Android CI #242 / run 37561744872 — SUCCESS sobre 4c22df9a6adbe0d3c4dc8e8396f0cfd3fb8dd287.
- Android Build — PASS.
- Android Unit Tests — PASS.
- Android Lint — PASS.
- Android Startup Smoke — PASS.
- Debug APK artifact — PASS.

CI POST-CONTINUIDAD CERRADA:
La continuidad T045 y el estado resultante de main quedaron verificados con CI real después del merge y después de actualizar docs/CONTINUITY.md.


## T046 — ANDROID CONTAINER AUDIT

FECHA:
2026-10-07

ESTADO:
GREEN — auditoría arquitectónica completada, PR revisado y mergeado con evidencia real de CI.

BASELINE:
96a944859100bce377de86422d96f182e46fe281

PR:
#30 — T046: audit Android container boundary

MERGE SHA:
b39d674d1ecf6df8c8d4253b8023832bb9daa1f4

MAIN HEAD:
fe8495a8598fe9666f2fb11ad522f984c700e04d

CAMBIOS:
- docs/ARCHITECTURE.md
- docs/CONTINUITY.md
- Sin cambios Android source.
- Sin cambios Web runtime.
- Sin cambios de workflows CI.

VALIDACIÓN PRE-MERGE:
- Web CI #145 / run 37563672148 — SUCCESS.
- Android CI #244 / run 37563672200 — SUCCESS.
- Android Build — PASS.
- Android Unit Tests — PASS.
- Android Lint — PASS.
- Android Startup Smoke — PASS.
- Debug APK artifact — PASS.

REVISIÓN PR:
- HEAD verificado: 1fdba0feedd5b68bc85606465c3f205aea1742e4.
- Base verificada: main.
- PR #30 estuvo OPEN y mergeable.
- Diff verificado: únicamente docs/ARCHITECTURE.md y docs/CONTINUITY.md.
- No aparecieron cambios funcionales adicionales antes del merge.
- PR #30 fue mergeado realmente por GitHub.
- Merge commit verificado: b39d674d1ecf6df8c8d4253b8023832bb9daa1f4.

DECISIÓN:
**Opción B — Web = editor principal; Android = futuro Container/WebView host.**

La decisión T046 es arquitectónica y no implica que Android ya utilice WebView. El editor Android existente permanece intacto como runtime legacy/fallback hasta que T047 demuestre el container de forma reversible.

GUARD:
No eliminar EditorScreen, DrawingEditor, Compose Canvas, ProjectPersistence, Models.kt, DocumentReducer ni CommandHistory durante T047.

PROBLEMAS ENCONTRADOS:
- Duplicación real de responsabilidades entre Android y Web durante la transición.
- No existe WebView/container implementado todavía.
- El Android editor sigue siendo un runtime paralelo completo.

REPARACIÓN:
No se realizó reparación funcional en T046 porque la tarea era audit-only. Se documentó la frontera objetivo y el guard de migración no destructiva.

DEUDA TÉCNICA:
- Dominio duplicado entre Kotlin y JavaScript durante la transición.
- ProjectPersistence Android y localStorage Web son fronteras separadas.
- Compose renderer y Canvas 2D renderer siguen coexistiendo hasta validar el container.
- Falta demostrar el WebView container.

SIGUIENTE TAREA:
**T047 — ANDROID WEBVIEW CONTAINER SPIKE**, mínimo, reversible y no destructivo.

T047 debe demostrar:
1. APK installation.
2. MainActivity startup.
3. WebView creation.
4. Web app asset loading.
5. Web editor/Canvas 2D rendering.
6. Basic pointer interaction.
7. Manifest behavior.
8. Offline shell behavior dentro del APK.
9. Android Startup Smoke.
10. Web CI.
11. Android CI.

NO HACER EN T047:
- No IA.
- No filtros.
- No WebGL.
- No PixiJS.
- No IndexedDB.
- No backend.
- No cuentas.
- No colaboración.
- No bridge JavascriptInterface salvo requisito concreto.
- No eliminar el editor Android.
- No crear SharedDomainManager ni nuevos sistemas equivalentes.

NO REPETIR:
- T044 GREEN.
- T045 GREEN.
- Auditoría T046.

## T047.2 — ANDROID WEBVIEW MINIMAL CONTAINER

FECHA:
2026-10-07

ESTADO:
GREEN EN PR #32. El container mínimo Android → WebView → WebViewAssetLoader → AnimeArt Web quedó implementado y verificado con Web CI y Android CI reales. No se fusionó a main en T047.2.

BASELINE:
0e4641ce9a8c464fd7ddac318b100daa832532f8

BRANCH:
t047-2-webview-minimal

IMPLEMENTACIÓN:
- AndroidX WebKit añadido únicamente para WebViewAssetLoader: androidx.webkit:webkit:1.15.0.
- MainActivity aloja un WebView con WebViewClient y WebViewAssetLoader usando AssetsPathHandler.
- Entrada local: https://appassets.androidplatform.net/assets/web/index.html.
- JavaScript y DOM storage habilitados porque el Web actual usa ES modules y localStorage.
- file://, data:, acceso de archivos y contenido mixto no se usan para la carga principal.
- No se implementó JavascriptInterface ni bridge Android ↔ JavaScript.
- Los assets Web necesarios se empaquetan bajo app/src/main/assets/web/ sin tests, scripts, dist ni node_modules.
- El editor Android legacy permanece disponible como fallback si la carga principal del WebView falla.
- web/index.html, web/app.js, web/styles.css, web/manifest.webmanifest, web/service-worker.js y web/domain/*.mjs no fueron modificados.

ASSET STRATEGY:
- Se reutiliza directamente el contenido Web existente; no se creó un segundo build system ni renderer.
- El APK contiene únicamente los recursos estáticos requeridos por index.html/app.js y sus imports actuales.

CANVAS:
- Se mantiene el único <canvas id="canvas"> existente y el renderer Canvas 2D de web/app.js.

STARTUP SMOKE:
- scripts/android-startup-smoke.sh reutiliza el smoke existente.
- Comprueba instalación, MainActivity, proceso/resume, marcadores Web accesibles (ANIMEART, estado de página y canvas) y presencia del renderer sandboxed de WebView.
- Android CI #276 / run 37651748078 falló porque el detector trató el warning benigno de Crashpad de Chromium como error.
- Reparación: commit 275d39ebe54bcdcb302b879e1225fdc757861a62 eliminó ese falso positivo y mantuvo FATAL EXCEPTION + renderer WebView como checks.
- Android CI #277 / run 37652255928 terminó SUCCESS.
- No valida offline ni Service Worker.

SERVICE WORKER / OFFLINE:
- service-worker.js no fue modificado.
- Service Worker dentro de Android WebView: NO DEMOSTRADO en T047.2.
- Offline Android: reservado para T047.3.

VALIDACIÓN:
- Web CI #178 / run 37652255954 — SUCCESS: Build PASS, Test PASS, Verify build output PASS.
- Android CI #277 / run 37652255928 — SUCCESS: Build PASS, Unit Tests PASS, Lint PASS, Startup Smoke PASS, Debug APK artifact PASS.
- PR #32 permanece OPEN sobre main @ 0e4641ce9a8c464fd7ddac318b100daa832532f8.
- Canvas 2D quedó demostrado por la carga del shell Web, el canvas accesible y el renderer WebView observado en smoke.
- Interacción de puntero no fue medida específicamente en T047.2.

DEUDA:
- Los assets Web quedan versionados dentro del APK y deben sincronizarse cuando cambie el Web runtime.
- El fallback Compose permanece durante la transición y podrá retirarse solo en una tarea futura explícita.

SIGUIENTE:
T047.3 — OFFLINE / SERVICE WORKER VALIDATION

## T047.3 — OFFLINE / SERVICE WORKER VALIDATION

FECHA:
2026-10-08

ESTADO:
GREEN — validación offline real completada en Android WebView con CI real. La evidencia final demuestra NETWORK OFF → reload → cache recovery → AnimeArt → JavaScript → Canvas.

BASELINE:
08a214d06a7121c9189bf87997713fa855f658ba

BRANCH:
t047-3-offline-validation

HEAD FINAL:
64265f882580ca97f01d8fb2425991d70c3b0ca1

PR:
#33 — T047.3 — Offline / Service Worker validation
Estado: OPEN / NO MERGE
Base: t047-2-webview-minimal @ 08a214d06a7121c9189bf87997713fa855f658ba
PR #32 permanece OPEN sobre main como T047.2. T047.3 depende legítimamente de T047.2 porque reutiliza su WebViewAssetLoader, assets Android y contenedor WebView; por ello #33 queda como PR apilado sobre #32 y su diff se limita a la capa T047.3.

SERVICE WORKER:
- Registered: PASS.
- Active: PASS.
- Cache: animeart-web-shell-v1.
- Resources: 13/13 requeridos presentes.
- missing=[] confirmado por el diagnóstico del smoke.

OFFLINE REAL:
- Primera fase: Android WebView cargó AnimeArt y el diagnóstico confirmó registered=true, active=true, cachedCount=13, requiredCount=13, missing=[], canvas=true.
- Network OFF: PASS — Android emulator confirmó airplane mode=ON.
- WebView offline: PASS — blockNetworkLoads=true + LOAD_CACHE_ONLY.
- Reload offline: PASS — am start -W confirmó Status: ok para MainActivity.
- Cache recovery: PASS — el diagnóstico posterior al reload confirmó nuevamente active=true, 13/13, missing=[] y canvas=true.
- AnimeArt: PASS.
- JavaScript: PASS.
- Canvas: PASS.
- Evidencia final del smoke: OFFLINE VALIDATION PASS: network=WebView blockNetworkLoads + LOAD_CACHE_ONLY; reload=PASS; AnimeArt=PASS; JavaScript=PASS; Canvas=PASS.

REPARACIONES T047.3:
- APP_SHELL del Service Worker adaptado mínimamente porque ./ no era compatible con el flujo concreto de WebViewAssetLoader; no se creó un segundo shell.
- Añadido fallback compatible para crypto.randomUUID() en Android WebView.
- Sincronizado app/src/main/assets/web/ con el runtime Web actualizado.
- Reemplazado Element.replaceChildren() por eliminación de hijos compatible con el WebView usado por CI.
- Añadido routing de Service Worker mediante ServiceWorkerControllerCompat + WebViewAssetLoader cuando corresponde.
- Smoke corregido para no depender de texto WebView expuesto por uiautomator, que produjo un falso fallo en Android WebView.
- Smoke reforzado con Android emulator airplane mode real y verificación del estado de red.
- Smoke final imprime evidencia explícita de online-ready y offline-recovery con 13/13 y canvas=true.

CI FINAL:
- Android CI #295 / run 37746511429 — SUCCESS.
- Android Build — PASS.
- Android Unit Tests — PASS.
- Android Lint — PASS.
- Android Startup Smoke — PASS.
- Debug APK artifact — PASS.
- Web CI #196 / run 37746511381 — SUCCESS.
- Web Build — PASS.
- Web Tests — PASS.
- Web Verify build output — PASS.

LOG REAL DEL OFFLINE GATE:
- ANIMEART_OFFLINE_DIAGNOSTIC registered=true active=true cache=animeart-web-shell-v1 cachedCount=13 requiredCount=13 missing=[] canvas=true phase=online-ready
- NETWORK OFF confirmado por Android emulator airplane mode
- ANIMEART_OFFLINE_DIAGNOSTIC registered=true active=true cache=animeart-web-shell-v1 cachedCount=13 requiredCount=13 missing=[] canvas=true phase=offline-recovery
- OFFLINE VALIDATION PASS: network=WebView blockNetworkLoads + LOAD_CACHE_ONLY; reload=PASS; AnimeArt=PASS; JavaScript=PASS; Canvas=PASS

LEGACY ANDROID:
- EditorScreen preservado.
- DrawingEditor preservado.
- Compose Canvas preservado.
- ProjectPersistence preservado.
- Models / DocumentReducer / CommandHistory preservados.

BRIDGE:
- No implementado.
- No JavascriptInterface añadido.

RESULTADO:
T047.3 queda GREEN por evidencia real de Service Worker, Cache Storage, network OFF, reload offline, recuperación desde cache, JavaScript, Canvas y CI Web/Android completo.

DEUDA:
- PR #32 sigue OPEN y no mergeada; es la capa base requerida por T047.3.
- PR #33 sigue OPEN y no mergeada; está apilada sobre t047-2-webview-minimal y no debe mergearse antes de #32.
- Interaction/pointer no fue un requisito del offline gate y no fue medida específicamente.
- Sincronización de assets Web dentro del APK sigue siendo deuda operativa ante futuros cambios del Web runtime.

SIGUIENTE:
Cerrar/revisar PR #33 según la política de merge del proyecto. No iniciar T048 automáticamente.


## T048.1 — AUDITORÍA FINAL DE TRABAJO HEREDADO, WEBVIEW Y CIERRE DEL REPOSITORIO

FECHA:
2026-10-08

ESTADO:
AUDITORÍA COMPLETADA. No se detectó fallo funcional que justifique cambios de código en main. Se realizó únicamente una corrección documental para dejar trazable el estado post-merge real.

MAIN ACTUAL:
a6bfcd376bcc69a2d35dfd3e4b49819b6a198216

PR / TRAZABILIDAD:
- PR #31 — T047 Android WebView Container Spike: CERRADA SIN MERGE. Clasificada SUPERADA/OBSOLETA. Su implementación fue sustituida por T047.2/T047.3; no debe fusionarse ni reintroducirse.
- PR #32 — T047.2 Android WebView minimal container: MERGED. Merge SHA: 1a741293907151fbc6626a451d6f070153f689a5.
- PR #33 — T047.3 Offline / Service Worker validation: MERGED. Merge SHA: a6bfcd376bcc69a2d35dfd3e4b49819b6a198216.
- No queda una PR funcional abierta asociada a T047/T047.2/T047.3.

WEBVIEW — EVIDENCIA EN MAIN:
- app/src/main/java/com/jonhararagi/animeart/MainActivity.kt crea WebView, habilita JavaScript/DOM storage, usa WebViewAssetLoader y carga https://appassets.androidplatform.net/assets/web/index.html.
- El fallback Compose legacy permanece explícitamente en onReceivedError para fallo de main frame.
- Service Worker se integra mediante ServiceWorkerControllerCompat cuando la feature está disponible.
- scripts/android-startup-smoke.sh demuestra instalación, proceso vivo, MainActivity resumida, renderer WebView, ausencia de FATAL EXCEPTION y recuperación offline mediante blockNetworkLoads + LOAD_CACHE_ONLY.

PERSISTENCIA / RECUPERACIÓN:
- Web: localStorage mediante persistDocumentSnapshot() con límite de almacenamiento y manejo no destructivo ante fallo de escritura.
- Web: restoreDocument() constituye la frontera de restauración y los tests verifican migración/normalización/round-trip.
- Android legacy: ProjectPersistence.kt conserva SharedPreferences/JSON como fallback/runtime histórico; no fue eliminado porque la migración WebView no requiere borrarlo.
- La persistencia del documento Web es real; la persistencia de viewport/navegación es deliberadamente de sesión y no forma parte del documento.

ROTACIÓN / RELANZAMIENTO:
- Relanzamiento: DEMOSTRADO a nivel de Android startup/offline smoke.
- Recuperación del documento Web después de recreación: mecanismo existente mediante localStorage; no existe una prueba de instrumentación específica de rotación.
- Rotación/configuración: NO DEMOSTRADA como contrato explícito. MainActivity recrea el WebView en onCreate y destruye el WebView en onDestroy; no existe política específica de onSaveInstanceState/restauración de navegación/viewport.
- No se introduce una afirmación de PASS para rotación que la CI actual no demuestre.

TESTS — CLASIFICACIÓN REAL:
- Web UNIT/DOMAIN: PASS. web/test/* se ejecuta con node --test y cubre modelo, history, viewport, selección, transforms, import y contratos.
- Web E2E: LIMITADO. mvp-e2e.test.mjs valida un contrato de ciclo de vida con modelo/datos y lectura estática de app.js; no conduce un navegador real ni un WebView real.
- Android UNIT: PASS. DocumentReducerTest y DrawingEditorTest cubren reducer/editor/history/transform.
- Android INSTRUMENTATION: NO PRESENTE EN main. No existe app/src/androidTest en el árbol actual.
- Android SMOKE/INTEGRATION: PASS. scripts/android-startup-smoke.sh usa emulador real y está ejecutado por Android CI.

CI POST-MERGE ACTUAL:
- Web CI #200 / run 37760125776 — SUCCESS — main @ a6bfcd376bcc69a2d35dfd3e4b49819b6a198216.
- Android CI #299 / run 37760125753 — SUCCESS — main @ a6bfcd376bcc69a2d35dfd3e4b49819b6a198216.
- Android run: Build PASS, Unit Tests PASS, Lint PASS, Android Startup Smoke PASS, Debug APK artifact PASS.
- Web run: Build PASS, Test PASS, Verify build output PASS.
- Offline evidence remains the T047.3 real emulator gate recorded above: airplane mode ON, WebView network blocked/cache-only, reload PASS, Service Worker cache recovery 13/13, JavaScript PASS, Canvas PASS.

BRANCHES / TRABAJO HEREDADO:
- Existen numerosas ramas históricas T020–T047.3 y otras ramas de desarrollo. Su existencia no implica que estén pendientes de integración.
- t048-project-lifecycle-runtime-resilience contiene trabajo no integrado en main y no forma parte de esta auditoría ni de la evidencia GREEN de main. No se debe fusionar automáticamente.
- t047-android-webview-container conserva el spike histórico que dio origen a PR #31; no debe reintroducirse.

ARQUITECTURA:
- No se encontró evidencia de un segundo renderer Web, segundo DocumentHistory Web, segundo Viewport Web o manager paralelo dentro del runtime Web actual.
- Android Compose legacy y Web Canvas 2D siguen coexistiendo por decisión de migración no destructiva; el fallback no debe eliminarse sin una tarea explícita.
- REUTILIZAR > ADAPTAR > CREAR continúa siendo la regla vigente.

CIERRE:
T047/T047.2/T047.3 están integradas y verificadas en main. T048.1 no implementa una nueva funcionalidad del producto. La única modificación de esta auditoría es este registro documental para corregir la trazabilidad post-merge.

SIGUIENTE:
No crear otra implementación WebView. La siguiente acción debe ser decidida por CEREBRO a partir de las brechas aún no demostradas (principalmente rotación/configuración y E2E real), no por trabajo heredado de T047.


## T050 — VERIFICACIÓN REAL DE CI Y CIERRE DE T049

FECHA:
2026-10-08

ESTADO:
GREEN — T049 está integrado en main y la evidencia real de CI post-merge fue verificada directamente en GitHub Actions.

BASELINE:
fc794c68e586e772aab91e7bec1b344cdbeaa1e7

MAIN HEAD AL CIERRE DE T050:
d726f984d77bcf209e4bed99cb31f7103da476ca

PR:
#35 — T049 — WebView rotation and configuration recovery

PR STATE:
CLOSED / MERGED

MERGE SHA:
fc794c68e586e772aab91e7bec1b344cdbeaa1e7

IMPLEMENTACIÓN T049:
- MainActivity recibe savedInstanceState.
- WebView.saveState(outState) se ejecuta en onSaveInstanceState.
- WebView.restoreState(savedInstanceState) se intenta antes de cargar START_URL.
- START_URL solo se carga cuando no existe/restaura estado.
- Existe instrumentation test MainActivityWebViewRotationTest.
- El test utiliza ActivityScenario.recreate().
- El test verifica que el WebView nuevo no es la misma instancia que el anterior.
- El test verifica la recuperación del marcador de navegación #t049-rotation-marker.
- No se creó un nuevo persistence/document/renderer/navigation manager.

CI POST-MERGE REAL:
- Android CI #304 / run 37782970227 — SUCCESS — commit fc794c68e586e772aab91e7bec1b344cdbeaa1e7.
- Web CI #205 / run 37782969771 — SUCCESS — commit fc794c68e586e772aab91e7bec1b344cdbeaa1e7.
- Android Build — PASS.
- Android Unit Tests — PASS.
- Android Lint — PASS.
- Android Instrumentation — PASS.
- Android Startup Smoke — PASS.
- Debug APK artifact — PASS.
- Web Build — PASS.
- Web Tests — PASS.
- Web Verify build output — PASS.

ACTIVITYSCENARIO.RECREATE:
RUNTIME CI PASS — Android CI #304 ejecutó connectedDebugAndroidTest y terminó SUCCESS.

WEBVIEW REPLACEMENT:
RUNTIME CI PASS — MainActivityWebViewRotationTest verifica que el WebView restaurado es una instancia distinta.

NAVIGATION RESTORATION:
RUNTIME CI PASS — MainActivityWebViewRotationTest verifica la recuperación del marcador #t049-rotation-marker.

EVIDENCIA DE CI:
- GitHub confirma PR #35 CLOSED / MERGED.
- GitHub confirma merge SHA fc794c68e586e772aab91e7bec1b344cdbeaa1e7.
- Android CI #304 / run 37782970227 terminó SUCCESS y ejecutó Build, Unit Tests, Lint, Instrumentation/Startup Smoke y artifact upload.
- Web CI #205 / run 37782969771 terminó SUCCESS y ejecutó Build, Test y Verify build output.
- Las ejecuciones fueron verificadas directamente en GitHub Actions.

ERRORES ENCONTRADOS:
No se encontró fallo funcional en T049.

REPARACIONES:
Ninguna reparación funcional.

ARCHIVOS MODIFICADOS EN T050:
docs/CONTINUITY.md — trazabilidad documental y cierre de la evidencia CI real de T049.

DEUDA:
Ninguna deuda bloqueante introducida por T049/T050.

VEREDICTO:
T049 GREEN.
T050 GREEN.



## T052 — REAL WEB E2E / EDITOR INTEGRATION GATE

FECHA:
2026-10-08

BASELINE:
9ae35319046fd6f1fa9bf83c2718d85c9cf34d53

BRANCH:
t052-real-web-e2e-2026-10-08

PR:
#36 — T052 — Real Web E2E / Editor Integration Gate

IMPLEMENTACIÓN:
- Se reutiliza el editor Web existente.
- No se creó Document, Layer, Stroke, History, Renderer, Viewport, Persistence, Selection ni Interaction manager paralelo.
- Se añadió un gate de navegador real mediante Chromium y Chrome DevTools Protocol (CDP), sin framework E2E externo.
- El runner sirve el build Web local mediante un servidor HTTP mínimo y ejecuta Chromium headless contra dist/.
- La interacción de usuario se realiza mediante Input.dispatchMouseEvent de CDP, no mediante mocks ni dispatchEvent de DOM.

ARCHIVOS T052:
- web/scripts/browser-e2e.mjs
- .github/workflows/web.yml
- docs/CONTINUITY.md

E2E REAL VERIFICADO EN CI:
- Browser launch — PASS.
- Editor load — PASS.
- Canvas layout/visibility — PASS.
- Service Worker/cache readiness — PASS.
- Real pointer drawing — PASS.
- Stroke creation and pointer path — PASS.
- Real layer creation — PASS.
- Real layer selection — PASS.
- Real transform control — PASS.
- Real Undo — PASS.
- Real Redo — PASS.
- localStorage persistence — PASS.
- Browser reload/recovery — PASS.
- Existing Web tests — PASS (328 tests).

ERRORES ENCONTRADOS Y REPARADOS DURANTE T052:
1. El primer intento colocó el runner en web/test/, provocando que npm test lo descubriera como test Node. Web CI run 37834784327 terminó FAILURE. Reparación: mover el runner a web/scripts/.
2. El primer launcher Chromium dependía de un puerto DevTools fijo y no obtuvo el endpoint en CI. Web CI run 37834996789 terminó FAILURE. Reparación: usar puerto dinámico y esperar el anuncio real de DevTools.
3. El control de transformación estaba fuera del viewport del navegador headless. Web CI run 37835596263 terminó FAILURE. Reparación: hacer scrollIntoView del control antes de ejecutar el click físico CDP.

CI DE IMPLEMENTACIÓN VERIFICADA:
- Web CI run 37835931901 — SUCCESS — commit a0afe2565636a5c8df6f64cf2b6e65237f231995.
- Android CI run 37835931906 — SUCCESS — commit a0afe2565636a5c8df6f64cf2b6e65237f231995.
- Web job: Build PASS, Test PASS, Verify build output PASS, Real browser E2E PASS.
- Android job: Build PASS, Unit tests PASS, Lint PASS, Instrumentation and startup smoke PASS, Debug APK upload PASS.

ARQUITECTURA:
WEB-FIRST / LOCAL-FIRST / ANDROID-AS-CONTAINER preservado.
El E2E consume el runtime Web existente y no introduce un segundo runtime, renderer, document model, history ni persistence.

DEUDA:
No se detectó deuda bloqueante introducida por T052.
La cobertura E2E real queda establecida para el flujo principal; futuros bloques pueden ampliar escenarios sin crear nueva arquitectura.

RIESGOS:
- El runner depende de Chromium/Chrome disponible en el runner GitHub Actions.
- La prueba actual cubre el flujo principal solicitado, no todos los comandos del editor.
- Android continúa conservando su runtime legacy/fallback, fuera de alcance de T052.

ESTADO:
IMPLEMENTACIÓN T052 PASS.
CI DEL COMMIT DE IMPLEMENTACIÓN a0afe2565636a5c8df6f64cf2b6e65237f231995: GREEN.\n\nHEAD FINAL DE T052 ANTES DEL CIERRE DOCUMENTAL:\n754b46b885f679792591297705ec4de514a6d39a\n\nCI DEL HEAD 754b46b885f679792591297705ec4de514a6d39a:\n- Web CI run 37836749228 — SUCCESS.\n- Android CI run 37836749246 — SUCCESS.

CIERRE:
- PR #36 CLOSED / MERGED.
- Merge SHA: 95e868695519ca679441099ecbf9aaa40cadab39.
- Web CI post-merge del merge SHA: run 37837849683 — SUCCESS.
- Android CI post-merge del merge SHA: run 37837849688 — SUCCESS en attempt 2. El attempt 1 falló por infraestructura del runner al descargar el paquete Android Emulator (unknown archive); no hubo fallo de Build, Unit Tests ni Lint. El retry completó Instrumentation, Startup Smoke y APK upload con SUCCESS.
- T052 queda GREEN y no se modifica T049.

SIGUIENTE:
Nuevo bloque técnico solo después de una nueva auditoría/readiness gate. No existe deuda bloqueante introducida por T052.


## T052 — FOLLOW-UP REPAIR / FINAL CI

FECHA:
2026-10-08

BASELINE:
9ae35319046fd6f1fa9bf83c2718d85c9cf34d53

IMPLEMENTACIÓN T052:
- PR #36 merged.
- Real browser E2E added using Chromium + CDP.
- Web build, 328 Web tests, browser E2E, Android build/tests/lint/instrumentation/startup smoke were verified on implementation commits.

REGRESIÓN ENCONTRADA:
- Tras el cierre documental de T052, Web CI run 37836566045 falló en Real browser E2E porque Chromium no publicó el endpoint DevTools en stderr.
- Build y los 328 Web tests pasaron; el fallo quedó aislado al launcher Chromium.

REPARACIÓN:
- PR #37 — fix: stabilize T052 Chromium E2E launcher.
- Se reemplazó la dependencia del anuncio "DevTools listening" por un puerto local libre asignado antes de lanzar Chromium y polling directo del endpoint DevTools.
- No se modificó el editor ni se creó arquitectura paralela.

CI PR #37:
- Web CI run 37839605327 — SUCCESS.
- Web Build — PASS.
- Web Tests — PASS (328).
- Verify build output — PASS.
- Real browser E2E — PASS.
- Android CI run 37839605489 — SUCCESS.
- Android Build — PASS.
- Unit tests — PASS.
- Lint — PASS.
- Instrumentation and startup smoke — PASS.
- Debug APK upload — PASS.

PR #37:
MERGED
MERGE SHA:
8ddde0aa179f79952d1992c6b7bfca0269a35706

ESTADO T052:
GREEN — la implementación E2E real y la reparación de estabilidad del launcher quedaron verificadas en CI.

DEUDA:
No se detectó deuda bloqueante introducida por T052.

RIESGOS:
- El runner depende de Chromium/Chrome disponible en GitHub Actions.
- La cobertura E2E cubre el flujo principal solicitado, no todos los comandos del editor.
- Android legacy/fallback permanece fuera de alcance.

SIGUIENTE:
No iniciar otra funcionalidad hasta definir el siguiente bloque técnico a partir de una nueva auditoría/roadmap.


## T052 — FINAL ANDROID CI CLOSURE

FECHA:
2026-10-08

MAIN HEAD VERIFICADO:
091724586d8f123cfb33ec0bae8ccecc991b2e60

BASELINE:
9ae35319046fd6f1fa9bf83c2718d85c9cf34d53

WEB CI:
- Run 37840653531 — SUCCESS — commit 091724586d8f123cfb33ec0bae8ccecc991b2e60.

ANDROID CI:
- Run 37840653501 — SUCCESS — commit 091724586d8f123cfb33ec0bae8ccecc991b2e60.
- Build — PASS.
- Unit tests — PASS.
- Lint — PASS.
- Instrumentation and startup smoke — PASS.
- Debug APK upload — PASS.

T052 E2E PREVIAMENTE VALIDADO:
- Real Chromium — PASS.
- Editor — PASS.
- Canvas — PASS.
- Drawing — PASS.
- Layer — PASS.
- Selection — PASS.
- Transform — PASS.
- Undo — PASS.
- Redo — PASS.
- Persistence — PASS.
- Reload/Recovery — PASS.
- Web tests — 328/328 PASS.

ARQUITECTURA:
- WEB-FIRST — PASS.
- LOCAL-FIRST — PASS.
- ANDROID-AS-CONTAINER — PASS.
- Duplicate systems — NONE.

PRs:
- #36 — MERGED.
- #37 — MERGED.
- Open PRs — 0.

REPARACIÓN:
NONE.

VEREDICTO:
T052 GREEN.

SIGUIENTE:
T052 cerrado. No iniciar T053 todavía. Preparar nueva auditoría técnica/roadmap antes de iniciar el siguiente bloque.


## T055 — REAL BROWSER E2E COVERAGE EXPANSION

FECHA:
2026-10-08

BASELINE:
f1421488324540a3fbd482e147cb81a1966657fc

BRANCH:
t055-real-browser-e2e-coverage

PR:
#38 — T055 — Real Browser E2E Coverage Expansion

IMPLEMENTACIÓN:
- Se reutilizó web/scripts/browser-e2e.mjs.
- No se creó un segundo E2E runner, launcher, CDP system, renderer, Document, History, Persistence, Selection o Viewport.
- No se modificó Android.
- La cobertura se amplió mediante Chromium real + CDP + DOM/pointer input real.

COBERTURA T055:
- Multi-selection mediante shift-click real.
- Multi-selection move mediante pointer drag real.
- Layer visibility hide/show.
- Layer lock/unlock.
- Layer duplicate/delete.
- New-document UI con dimensiones válidas para ejercicio de export.
- Image import mediante file input real del navegador.
- PNG export mediante descarga real del navegador.
- Persistence/reload sobre el estado ampliado.
- Service Worker/offline shell readiness.

NO CUBIERTO:
- Clipboard-specific E2E no se añadió por no aportar una ruta CI determinista adicional frente al file-input real.
- Offline network-disconnect completo no se simuló artificialmente; se verifica la frontera real del Service Worker/cache existente.

TESTS:
- Web tests: 328/328 PASS.
- Real Browser E2E: PASS.

CI FINAL DEL HEAD T055:
- Web CI run 37853155065 — SUCCESS — head 323b82d8a8e43be1c5b4a22766eab4ce1af099a3.
- Android CI run 37853155142 — SUCCESS — head 323b82d8a8e43be1c5b4a22766eab4ce1af099a3.
- Web Build — PASS.
- Web Tests — PASS.
- Web Verify build output — PASS.
- Real browser E2E — PASS.
- Android Build — PASS.
- Android Unit tests — PASS.
- Android Lint — PASS.
- Android Instrumentation and startup smoke — PASS.
- Debug APK upload — PASS.

ARQUITECTURA:
WEB-FIRST / LOCAL-FIRST / ANDROID-AS-CONTAINER preservado.

ARCHIVOS DE PRODUCCIÓN MODIFICADOS:
NONE.

ARCHIVO E2E MODIFICADO:
web/scripts/browser-e2e.mjs

PR STATE AL CIERRE DE T056:
CLOSED / MERGED.

MERGE SHA:
43675096a30336b715e548c32155dcc996ba4068.

MAIN POST-MERGE:
43675096a30336b715e548c32155dcc996ba4068.

INTEGRACIÓN:
Verificada directamente en GitHub. main coincide con el merge SHA y contiene los escenarios E2E aprobados.

CI POST-MERGE:
- Web CI run 37857894538 — SUCCESS — SHA 43675096a30336b715e548c32155dcc996ba4068; Real Browser E2E PASS.
- Android CI run 37857894449, retry/attempt final — SUCCESS — SHA 43675096a30336b715e548c32155dcc996ba4068; build, unit tests, lint, instrumentation/startup smoke y debug APK upload PASS.

DEUDA:
No se detectó deuda bloqueante introducida por T055.

VEREDICTO:
T055 IMPLEMENTATION GREEN.
CI FINAL GREEN.
PR #38 CLOSED / MERGED — merge SHA 43675096a30336b715e548c32155dcc996ba4068.

SIGUIENTE:
T055 está integrado y la CI Web/Android post-merge está verificada. No iniciar nuevas funcionalidades hasta ejecutar una nueva readiness/roadmap gate.


---

## T056.2 — Revalidación del cierre de T055

FECHA DE REVALIDACIÓN:
2026-10-09

FUENTE:
GitHub: PR #38, commit de merge y ejecuciones de Actions consultadas directamente.

PR:
[#38 — T055 Real Browser E2E Coverage Expansion](https://github.com/jonhararagi/animeart/pull/38)

ESTADO:
CLOSED / MERGED.

BASELINE DEL PR:
`f1421488324540a3fbd482e147cb81a1966657fc`.

MERGE SHA:
`43675096a30336b715e548c32155dcc996ba4068`.

CI POST-MERGE:
- [Web CI run 37857894538](https://github.com/jonhararagi/animeart/actions/runs/37857894538) — SUCCESS. Job completado; Install, Build, Test, Verify build output y Real browser E2E terminaron SUCCESS.
- [Android CI run 37857894449](https://github.com/jonhararagi/animeart/actions/runs/37857894449) — SUCCESS. Job completado; Build, Unit tests, Lint, Android instrumentation/startup smoke y Upload debug APK terminaron SUCCESS.

ALCANCE TÉCNICO:
T055 amplió el E2E de navegador real usando el runner Chromium/CDP existente para selección múltiple, operaciones de capa, importación de imagen, exportación PNG y persistencia/recarga. No añadió un segundo editor ni un segundo runner E2E.

LIMITACIONES REGISTRADAS:
- No se añadió una prueba E2E específica de clipboard.
- El E2E Web verifica Service Worker/cache readiness; no simula por sí mismo una desconexión completa de red.
- La ruta de validación offline del emulador Android es una suite separada.

VEREDICTO DE CONTINUIDAD:
La integración de T055 y los dos runs indicados están revalidados. Esta entrada conserva la evidencia histórica; no sustituye la verificación de CI del HEAD actual.

---

## T056.3 — Corrección de continuidad y estado de main

FECHA DE REVALIDACIÓN:
2026-10-09

PR:
[#39 — docs: record T055 merge gate result](https://github.com/jonhararagi/animeart/pull/39).

ESTADO:
CLOSED / MERGED (revalidado en la metadata de GitHub).

HEAD DEL PR:
`6223bc4689d44f0c273b00e8fdf05014419576b4`.

MAIN SHA OBSERVADO DURANTE T057.1 PREFLIGHT:
`ac0b7fe33ac7b4b86f962411854b5da7dc909067`.
[Commit en GitHub](https://github.com/jonhararagi/animeart/commit/ac0b7fe33ac7b4b86f962411854b5da7dc909067).

PROPÓSITO VERIFICADO:
La corrección de continuidad elimina la contradicción anterior que describía PR #38 como abierto después de su integración. El historial de T055 queda registrado como CLOSED / MERGED y mantiene separado el CI de PR del CI post-merge.

CI CONSULTADA:
- [Web CI run 37877012952](https://github.com/jonhararagi/animeart/actions/runs/37877012952) — job y todos los pasos del workflow observados en estado COMPLETED / SUCCESS, incluidos Build, Test, Verify build output y Real browser E2E.
- [Android CI run 37877012908](https://github.com/jonhararagi/animeart/actions/runs/37877012908) — job y todos los pasos del workflow observados en estado COMPLETED / SUCCESS, incluidos Build, Unit tests, Lint, Android instrumentation/startup smoke y Upload debug APK.

LÍMITE DE TRAZABILIDAD:
La operación disponible para consultar los jobs confirma sus conclusiones y pasos, pero no expone el campo `head_sha` de esas ejecuciones. Por tanto, esta entrada no atribuye esos dos runs a un SHA específico. La asociación exacta run → commit debe verificarse en la metadata de la ejecución de GitHub Actions antes de usarla como evidencia de post-merge del SHA final.

ESTADO DE DOCUMENTACIÓN AL PREFLIGHT T057.1:
- `docs/TESTING.md` seguía describiendo únicamente la verificación inicial Android y omitía los gates Web/Android actuales.
- `docs/ARCHITECTURE.md` conservaba una decisión T046 histórica que debía etiquetarse como tal frente al WebView implementado actualmente.
- `docs/CONTINUITY.md` no contenía entradas identificables T056.2/T056.3 antes de esta reconciliación.

PENDIENTE AL REGISTRAR ESTA ENTRADA:
Completar T057.1 con PR documental, auditoría del diff, checks del HEAD exacto y CI post-merge vinculada al SHA final. Esta entrada no declara T057 GREEN ni autoriza T058.


---

## T062 — Web recovery safety: preservar proyectos locales inválidos

FECHA:
2026-10-10

OBJETIVO:
Evitar que el editor Web reemplace silenciosamente el payload local si JSON no puede parsearse, el documento no puede restaurarse o el acceso de lectura a localStorage falla.

BASE:
`4d4b2a03be0fc1bedae59b91d2980984d3cafe81` (`main` al iniciar T062).

RAMA:
`t062-web-recovery-safety`.

CAMBIOS:
- `web/app.js`: estado explícito de recuperación; lectura segura; rechazo de versiones de documento desconocidas conservando la migración legacy soportada; bloqueo de persistencia automática mientras la recuperación esté pendiente; protección también en la ruta directa de importación de imágenes; sólo el guardado explícito exitoso puede sustituir el payload protegido.
- `web/index.html` y `web/styles.css`: aviso accesible de recuperación con instrucciones para crear un documento nuevo y decidir explícitamente si se reemplazan los datos.
- `web/test/smoke.test.mjs`: contratos de regresión para impedir escrituras automáticas y exigir confirmación mediante guardado explícito.
- `web/scripts/browser-e2e.mjs`: escenario Chromium real con payload corrupto, creación de documento, dibujo, comprobación de conservación byte por byte, guardado explícito y recuperación tras recarga.
- No se añadió ninguna dependencia ni un segundo sistema de persistencia/historial.

POLÍTICA:
La edición puede continuar en memoria mientras los datos previos están protegidos. Las escrituras automáticas quedan pausadas. Un guardado explícito exitoso reemplaza los datos anteriores y limpia el aviso; si el guardado falla, el estado protegido se conserva.

VALIDACIÓN:
La validación de este HEAD debe confirmarse mediante Web CI del SHA final. No atribuir resultados de CI a commits previos ni declarar T062 PASS antes de que terminen build, tests, verificación del artefacto y E2E de Chromium.

LIMITACIONES:
La prueba E2E cubre JSON corrupto y sustitución explícita. La restauración de documentos válidos/legacy se mantiene a través de `restoreDocument()`; no se modifica el formato de proyecto. La compatibilidad de almacenamiento Web y persistencia del editor Android siguen siendo fronteras separadas.

SIGUIENTE:
Después de CI verde, revisar el diff y el PR T062 sin fusionarlo.


---

## T064-R1 — Integridad dinámica de persistencia Web

FECHA:
2026-10-10

ESTADO:
IMPLEMENTACIÓN Y VALIDACIÓN EN CURSO. No declarar PASS hasta verificar Web CI y Android CI sobre el SHA final exacto.

BASE Y AISLAMIENTO:
- main verificada en SHA 4d4b2a03be0fc1bedae59b91d2980984d3cafe81.
- PR T062 #45 verificado abierto, no fusionado, base main, head t062-web-recovery-safety, SHA 7223a06d411eccb94a08e9f26946c5f092f40f6f.
- Rama T064: t064-web-storage-integrity-tests, creada desde el HEAD verificado de T062.
- Esta tarea no modifica main, no cambia bases/head de PR existentes y no crea un sistema paralelo de persistencia.

ARCHIVOS:
- web/scripts/browser-e2e.mjs: escenarios Chromium reales para excepción de cuota durante guardado explícito, preservación exacta del payload, reintento, mutaciones en memoria con recuperación pendiente, Undo/Redo, importación rechazada, restauración de documento actual, migración legacy y fallo de lectura inyectado antes de load().
- web/test/smoke.test.mjs: inventario estático recursivo de llamadas directas a localStorage.setItem en módulos Web y verificación de la frontera delegada existente.
- docs/CONTINUITY.md: esta entrada append-only. Se conserva íntegra la entrada T062 anterior.

AUDITORÍA ESTÁTICA DE ESCRITORES:
- web/app.js usa persistDocumentSnapshot(localStorage, "animeart-web-document", state.document) para el guardado del documento.
- web/domain/image-import.mjs contiene la escritura delegada storage.setItem(key, serialized); la importación pasa por su callback de persistencia y revierte el registro de historial si la persistencia falla.
- La prueba de inventario verifica que no haya llamadas literales directas localStorage.setItem(...) en los módulos JavaScript Web. Esto no sustituye la evidencia dinámica ni afirma que una inspección textual por sí sola pruebe la seguridad.

MATRIZ DE EVIDENCIA (validación dinámica del HEAD de implementación cee55409b1b1828064fe3e0df71a011470ade30e):
| Escenario | Estado | Evidencia |
|---|---|---|
| JSON corrupto | PASS | Chromium E2E, payload protegido y reemplazo explícito |
| Versión futura desconocida | PASS | Chromium E2E, versión 999 preservada hasta Save |
| Restauración válida actual | PASS | Fixture version 2 restaurado y payload sin mutaciones |
| Migración legacy admitida | PASS | Fixture version 1; capa, trazo y 3 puntos preservados tras Save |
| Lectura de almacenamiento fallida | PASS | CDP Page.enable + script previo a reload; SecurityError controlado |
| Guardado explícito fallido | PASS | QuotaExceededError; payload idéntico y advertencia visible |
| Reintento explícito exitoso | PASS | Save posterior actualiza documento y sobrevive a recarga |
| Dibujo durante recuperación | PASS | Trazo real por pointer; payload original idéntico |
| Cambios de capas durante recuperación | PASS | Crear capa y cambiar visibilidad; payload idéntico |
| Undo/Redo durante recuperación | PASS | Ambas operaciones mantienen intacto el payload |
| Importación de imagen durante recuperación | PASS | Importación rechazada, sin capa añadida ni falso éxito |
| Preservación exacta del payload | PASS | Comparaciones estrictas de la cadena original |
| Mensajes visibles sin falso éxito | PASS | Aviso de almacenamiento no disponible y ausencia de Saved locally |
| Inventario de escritores | PASS | Prueba estática recursiva; 336 pruebas totales, 0 fallidas |

PRUEBAS Y CI:
- GitHub Actions Web CI sobre cee55409b1b1828064fe3e0df71a011470ade30e: SUCCESS. [Run 38036321253](https://github.com/jonhararagi/animeart/actions/runs/38036321253). Install, Build, Test, Verify build output y Real browser E2E: SUCCESS.
- El runner de pruebas reportó 336 PASS y 0 FAIL. El E2E imprimió ANIMEART_REAL_WEB_E2E: PASS.
- Android CI sobre cee55409b1b1828064fe3e0df71a011470ade30e: estaba en ejecución al actualizar esta sección; Build, Unit tests y Lint ya habían terminado SUCCESS, y Android instrumentation/startup smoke tests seguía en ejecución. No se declara Android PASS hasta terminar.
- Estos resultados no son los de T062 (#45); se verificó el SHA de T064.
- No se modifica el formato de documento ni se relaja la validación de versiones.

RIESGOS Y PENDIENTES:
- Confirmar que la inyección CDP de fallo de lectura ocurre antes de load() y que la prueba termina con el payload original idéntico.
- Confirmar la estabilidad del fixture PNG durante importación rechazada y la reversibilidad del fallo de escritura.
- Reconciliar este apéndice con PR #42, que también modifica este archivo desde main; no cambiar la base de ese PR ni descartar ninguna sección.
- T062 continúa abierto y sin fusionar; su estado no se eleva automáticamente por los tests T064.

SIGUIENTE:
Esperar los resultados CI del SHA final, corregir solo fallos reproducibles y actualizar esta entrada con resultados exactos antes del informe final.


---

## T064-R2 — Error genérico de escritura y cierre de evidencia

FECHA:
2026-10-10

ALCANCE:
Cierre acotado de la brecha de error genérico de escritura en la prueba Chromium existente. No crea un runner ni una capa de persistencia paralelos.

AISLAMIENTO:
- PR: #46, rama `t064-web-storage-integrity-tests`, apilada sobre `t062-web-recovery-safety` / PR #45.
- HEAD final de implementación/prueba de esta regresión: `90b53006beb3af7668316aefff9f966ad250fe99`.
- Commit previo documentado de T064-R1: `a1e38a51a25321e94e5bfdd3d238a79e4fd742e2`.
- T064-R2 añade un escenario y no modifica `web/app.js` ni el contrato de producción.

REGRESIÓN DINÁMICA:
- El escenario separado inyecta `new Error("")` al escribir `animeart-web-document` durante Save explícito, con recuperación pendiente.
- Aserciones añadidas: payload protegido idéntico; aviso de recuperación visible; fallback exacto `Could not save project locally`; ausencia de falso mensaje `Saved locally`; restauración de la referencia original `Storage.prototype.setItem`.
- El escenario de cuota `QuotaExceededError` permanece independiente y no se debilita.
- La implementación de `persistDocument()` ya usa `error?.message || "Could not save project locally"`; no se cambió código de producción porque el contrato actual ya satisface el caso vacío.
- SHA de implementación/prueba específica: `90b53006beb3af7668316aefff9f966ad250fe99`. El resultado dinámico sólo puede declararse PASS después de inspeccionar el job Real browser E2E de Web CI asociado a este SHA.

ARCHIVOS:
- `web/scripts/browser-e2e.mjs`: prueba Chromium de excepción genérica, preservación de payload, feedback y restauración del método nativo.
- `docs/CONTINUITY.md`: apéndice T064-R2; conserva las entradas históricas T062, T059 y T064-R1 sin reescribirlas.

COBERTURA:
- Dinámica: Chromium/CDP con interfaz real; guardado explícito bajo excepción vacía; comparación estricta de la cadena almacenada; aviso persistente; estado sin éxito falso; restauración del método de escritura.
- Estática: inventario recursivo de escritores Web y contratos de frontera de persistencia existentes.
- La prueba estática no se considera sustituto de la prueba dinámica.
- Sin modificación del modelo, formato de documento, lógica de recuperación ni persistencia de producción.

CI Y SHA:
- Web CI histórico de T064-R1 en `cee55409b1b1828064fe3e0df71a011470ade30e`: [run 38036321253](https://github.com/jonhararagi/animeart/actions/runs/38036321253), SUCCESS. No valida el nuevo escenario T064-R2.
- Android CI histórico de T064-R1 en `a1e38a51a25321e94e5bfdd3d238a79e4fd742e2`: [run 38036503329](https://github.com/jonhararagi/animeart/actions/runs/38036503329), SUCCESS. No se reutiliza como evidencia del SHA posterior.
- La nueva regresión y los workflows disparados por `90b53006beb3af7668316aefff9f966ad250fe99` deben consultarse en GitHub antes de cerrar T064.
- El SHA de implementación de la prueba y el SHA final de documentación se registrarán por separado en el informe de cierre. Los resultados CI del HEAD documental final se verificarán independientemente.

RIESGOS Y PENDIENTES:
- Confirmar Web CI, incluido Real browser E2E, en el SHA de la prueba específica.
- Confirmar Web CI y Android CI en el SHA final documental exacto.
- Verificar la metadata actual de PR #42, #45 y #46; #42 también modifica este archivo, por lo que la reconciliación documental combinada sigue pendiente hasta una comparación real de los diffs integrados.
- No inferir que T062 queda cerrado o aprobado por el resultado de T064.
- No se modificaron `main`, las bases/cabezas de otros PR ni sus contenidos.

VEREDICTO:
PARTIAL hasta verificar la ejecución dinámica del nuevo escenario y ambos workflows en el SHA final documental.

SIGUIENTE:
Completar únicamente la verificación de CI y metadata de PR; no avanzar a funcionalidades de dibujo ni cerrar T062 automáticamente.
