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
