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
