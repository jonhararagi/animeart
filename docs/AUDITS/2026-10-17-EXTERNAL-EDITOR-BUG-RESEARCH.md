# AA-EDITOR-RESEARCH-001 · Informes públicos de errores y soluciones en editores

**Fecha de revisión:** 2026-10-17  
**Repositorio objetivo:** `jonhararagi/animeart`  
**Rama de trabajo de las pruebas derivadas:** `aa-editor-research-002`  
**TIMER:** 2–4 horas estimadas para revisión de fuentes, selección de riesgos aplicables y pruebas de regresión; el tiempo real no se midió.

## Cómo se revisaron las fuentes

Se consultaron informes públicos, comentarios de mantenedores, pull requests fusionados y el CHANGELOG del proyecto Fabric.js, además de issues del repositorio público de Photopea. Se separan los hechos que la fuente confirma de los riesgos que solo sugieren una prueba en AnimeArt.

Esta revisión **sí consultó fuentes técnicas públicas de GitHub**. La búsqueda web general de blogs, noticias informáticas y páginas editoriales no estuvo disponible en esta sesión; no se afirma haber revisado artículos de Adobe, Canva u otros sitios ajenos a GitHub.

## Informes útiles y lecciones concretas

### 1. Pinceles con zoom y desplazamiento de la vista

- **Reporte:** [Fabric.js #7085 · LimitedToCanvasSize con zoom](https://github.com/fabricjs/fabric.js/issues/7085). El autor informó que al limitar el dibujo al tamaño del lienzo solo podía dibujar sobre una parte de este después de aplicar zoom.
- **Corrección fusionada:** [Fabric.js PR #11143](https://github.com/fabricjs/fabric.js/pull/11143), fusionada el **12 de octubre de 2026**. El cambio transforma el punto del pincel mediante la transformación de viewport antes de decidir si un punto se encuentra fuera de los límites visibles. Añade pruebas unitarias con zoom y desplazamiento, más una prueba E2E de dibujo sobre el lienzo ampliado.
- **Riesgo aplicable a AnimeArt:** que los trazos estén geométricamente bien guardados con zoom al 100%, pero se desplacen, se recorten o golpeen otra zona cuando la vista está ampliada o movida.
- **Acción derivada:** E2E real que amplía el lienzo, hace pan con dos dedos, dibuja en la zona visible y compara los primeros/últimos puntos guardados con las coordenadas de documento esperadas.

### 2. Trazos que cambian al finalizar el gesto

- **Reporte:** [Fabric.js #7056 · SprayBrush salta al soltar el ratón](https://github.com/fabricjs/fabric.js/issues/7056). El usuario observó que el patrón de puntos cambiaba al terminar el trazo y que el desplazamiento aumentaba con el tamaño de los puntos.
- **Corrección fusionada:** [Fabric.js PR #11150](https://github.com/fabricjs/fabric.js/pull/11150), fusionada el **12 de octubre de 2026**. El arreglo corrige la deduplicación de puntos para distinguirlos por posición y tamaño, y añade una prueba determinista antes y después de soltar el puntero.
- **Aplicabilidad:** AnimeArt no tiene actualmente un SprayBrush equivalente; no se copió ese cambio. La lección sí es útil para cualquier herramienta futura de spray, pincel con partículas, censura o trazo con vista previa: comparar el estado visual durante el gesto y después de confirmar.

### 3. Interacciones táctiles que dejan el editor sin responder

- **Reporte y actualización del mantenedor:** [Photopea #4051 · Problemas en dispositivos táctiles Android](https://github.com/photopea/photopea/issues/4051). El reporte mezcla varios síntomas y navegadores. El **5 de diciembre de 2021**, el mantenedor escribió explícitamente: “I have fixed the bug with Quick Select on touchscreens”. Los demás síntomas no deben considerarse todos resueltos por esa frase; el hilo contiene discrepancias entre navegadores y problemas que los participantes no podían reproducir consistentemente.
- **Riesgo aplicable a AnimeArt:** una secuencia de dos dedos durante un modo de pintura/selección puede dejar estado de gesto, selección o captura de puntero atascado, por lo que los siguientes toques dejan de dibujar.
- **Acción derivada:** secuencia E2E de zoom y pan táctiles con la herramienta de dibujo activa, luego un trazo normal; la prueba comprueba que el gesto posterior continúa guardándose y que la vista se puede restaurar.

### 4. Borradores, capas opacas y máscaras

- **Reportes:** [Fabric.js #7277 · Borrador afectado por zoom](https://github.com/fabricjs/fabric.js/issues/7277) y [Fabric.js #7278 · Fondo y exportación con el borrador](https://github.com/fabricjs/fabric.js/issues/7278). En #7277 los comentarios apuntan a la comprobación de intersección con objetos y registran una corrección de prueba; no se atribuye una solución exacta al núcleo sin un PR inequívoco. En #7278, los comentarios explican que tratar el color de fondo del canvas como un objeto borrable daba problemas de escala y exportación.
- **Corrección confirmada para #7278:** [Fabric.js PR #7289](https://github.com/fabricjs/fabric.js/pull/7289), fusionada el **13 de agosto de 2021**, elimina la capacidad de borrar directamente el color de fondo/superposición del canvas. La alternativa es modelar un fondo que deba manipularse como un objeto separado.
- **Arquitectura del borrador en Fabric.js:** [Fabric.js PR #7470 · EraserBrush V2](https://github.com/fabricjs/fabric.js/pull/7470), fusionada el **16 de enero de 2022**, documenta una transición a un enfoque con máscaras para tratar objetos opacos, recortes anidados y recuperación con borrado invertido; también informa mejoras de rendimiento.
- **Riesgo aplicable a AnimeArt:** que el borrador cambie la vista previa pero no el alfa exportado, que borre una capa equivocada o que el mismo gesto se renderice distinto sobre capas opacas.
- **Acción derivada:** comprobar después del borrado que el píxel objetivo pasa a alfa cero, que un píxel lejano sigue opaco, que Deshacer restaura la fuente original y que exportar no altera el proyecto.

### 5. El recorte de una capa no es el recorte de la composición

- **Reporte y aclaración de producto:** [Photopea #5894 · Crop tool crops entire project](https://github.com/photopea/photopea/issues/5894). El hilo se cerró después de aclarar que esa herramienta recortaba el lienzo completo, no una capa individual. Es un problema de expectativa/descubribilidad, no evidencia de que un bug del motor fuera reparado.
- **Caso con resolución no confirmada:** [Photopea #5331 · Deleting Cropped Pixels Option](https://github.com/photopea/photopea/issues/5331). El autor informó que los píxeles fuera del recorte reaparecían, pero luego dijo que ya no podía reproducirlo y el mantenedor declaró no conocer una corrección específica. Por eso no se registra como “bug reparado”.
- **Acción derivada para AnimeArt:** mantener dos acciones distintas, **Recortar imagen** y **Recortar composición**, con previsualización, Cancelar y nombres inequívocos. Las dos rutas ya existen en AnimeArt; se conservan sus pruebas y no se fusionan en una sola acción ambigua.

### 6. Un canvas que se ve bien puede exportar de forma diferente

- **Reporte aún abierto en la fuente consultada:** [Fabric.js #10460 · toSVG con clipPaths invertidos](https://github.com/fabricjs/fabric.js/issues/10460). El reporte describe que la parte borrada quedaba visible y la parte esperada invisible en SVG exportado, a pesar de verse correctamente en el canvas.
- **Aplicabilidad:** AnimeArt actualmente exporta PNG, JPEG y WebP, no SVG. El incidente respalda un principio de pruebas, no la conclusión de que AnimeArt tiene el mismo defecto: validar la imagen raster final y su transparencia, además de las coordenadas o la vista previa.

## Aplicación a AnimeArt

La implementación del editor debe conservar tres límites separados: la transformación de capa, el viewport visible del espacio de trabajo y el marco final del documento. Las capas no deben perder sus coordenadas por hacer zoom o pan; el render de previsualización, las operaciones de píxeles y la exportación deben acordar las transformaciones, pero aplicar el recorte que corresponda a cada contexto.

Esta rama añade pruebas E2E para:

1. Dibujo en móvil tras zoom con rueda y pan con dos dedos, comparando los puntos persistidos con las coordenadas esperadas del documento.
2. Borrado de píxeles bajo la misma condición de zoom/pan, verificando el alfa del píxel central y la conservación de un píxel distante.
3. Deshacer tanto la edición de píxeles como el movimiento de la vista, y confirmar que la vista vuelve al estado previo para que el resto de las pruebas no dependa de residuos de interacción.

Las fuentes externas sirven como patrones para diseñar la prueba, no como sustituto de reproducir un bug en AnimeArt. Los cambios derivados solo se consideran completos si la suite Web E2E y las comprobaciones Android pasan en el mismo HEAD.

## Hallazgo confirmado en AnimeArt y corrección aplicada (2026-10-17)

### Defecto reproducido

En `web/app.js`, `pointFromEvent()` calculaba el punto del evento en coordenadas del documento, pero llamaba a `createStrokePoint(screenToDocumentPoint(...))`. La función `createStrokePoint` está definida para recibir dos números separados (`x, y`), no un objeto. Al convertir ese objeto a número, el valor resultaba no válido y se normalizaba a cero, por lo que los trazos libres podían persistirse en `(0, 0)` en lugar de donde la persona había dibujado.

Este defecto se confirmó con Chromium, no se infirió solamente por analogía con Fabric.js. La corrección obtiene `documentPoint` y llama a `createStrokePoint(documentPoint.x, documentPoint.y)`. Se añadió una prueba unitaria que protege la firma y una prueba E2E que compara los puntos guardados con los puntos previstos después de zoom y pan táctil.

### Evidencia final

- **HEAD probado:** `6facc31ba32ea45d8246b6922550b6aede61e9d9`.
- **Web CI: PASS:** [run #39059634356](https://github.com/jonhararagi/animeart/actions/runs/39059634356).
- **Android CI: PASS:** [run #39059634357](https://github.com/jonhararagi/animeart/actions/runs/39059634357).
- Puntos esperados del trazo: `(294, 248)` y `(346, 248)`. Puntos reales guardados en E2E: `(293.9999957, 248.0000112)` y `(345.9999928, 248.0000112)`.
- Se comprobó que el trazo produjera píxeles reales tras zoom/pan.
- El borrado por pincel de píxeles tras zoom/pan dejó el centro con alfa `0` y conservó un píxel distante con alfa `255`.
- También siguieron pasando el cruce visible de los cuatro bordes del documento, la recuperación del objeto y la exportación PNG RGBA `640×480` fuera del marco sin modificar la transformación.
- **APK de esa CI:** [artefacto #12109919707](https://github.com/jonhararagi/animeart/actions/runs/39059634357/artifacts/12109919707).
- **SHA-256 del archivo APK:** `87bfde30f0a8ead7deea6f631394fbd79e7bc6678cbc79232ba51a2a6ebd2e29`.
- Nombre generado por CI: `AnimeArt-Android-aa-mobile-redesign-004-21c418de44c7659f0bd0da2dfe88cf71b5ec8f5e.apk`. El SHA del código probado es `6facc31...`; el SHA incrustado en el nombre de la APK identifica el checkout de compilación del PR y no es el SHA de la rama.
- La comprobación de arranque Android confirmó WebView, el canvas del editor y el modo offline.

La investigación de este documento se basa en informes y PRs públicos de GitHub que sí se pudieron consultar. La búsqueda general de blogs y notas de novedades de sitios editoriales sigue pendiente, porque no estuvo disponible en esta sesión. La aceptación física en el Xiaomi `24116RACCG` también sigue pendiente.


---

## AA-IMAGE-X-DELETE-AND-TOUCH-ANCHOR-001 · X de imagen y salto al tocar (2026-10-17)

**TIMER:** 2–4 horas estimadas para diagnóstico, reparación, regresiones y validación Android; el tiempo activo real no se midió.

### Síntomas
- La X del marco cerraba la selección pero no eliminaba la imagen; el comando Eliminar del menú sí la quitaba.
- Al tocar/seleccionar una imagen en móvil, la capa podía saltar hacia abajo como si tuviera un fallo gráfico.

### Causa y corrección
- La rama de interacción de la X llamaba a `closeSelectionBox()`. Para una imagen ahora ejecuta `removeSelectedImage()`, usando la eliminación de capa existente con historial y Deshacer. En capas no-imagen la X conserva el comportamiento de cerrar la selección.
- El movimiento transformaba `clientX/clientY` usando el rectángulo actual del canvas en cada evento. Si la interfaz móvil reacomodaba ese rectángulo mientras el dedo permanecía fijo, se producía un delta aparente.
- El gesto ahora conserva el punto global de inicio y la escala pantalla-documento al comenzar. El movimiento usa el delta global del puntero relativo a ese ancla; un toque estacionario no genera una transformación ni una entrada innecesaria en el historial.
- La caché offline PWA pasó de `animeart-web-shell-v39` a `v40` para evitar que el editor instalado mantenga el JavaScript anterior.

### Pruebas y evidencia
- E2E de Chromium cambia artificialmente la posición del canvas durante un toque estacionario. Resultado: **PASS**, la transformación persistida no cambia.
- E2E de Chromium toca la X, confirma que desaparece el ID de la imagen y pulsa Deshacer móvil. Resultado: **PASS**, imagen y transformación regresan.
- El mismo E2E mantiene las pruebas existentes de movimiento, escala, zoom/pan, transparencia y exportación.
- **HEAD de código probado:** [`8e44a325963c379bd9f880191748770367dc99cc`](https://github.com/jonhararagi/animeart/commit/8e44a325963c379bd9f880191748770367dc99cc).
- **Web CI: PASS:** [run #39074410762](https://github.com/jonhararagi/animeart/actions/runs/39074410762), incluye `ANIMEART_REAL_WEB_E2E: PASS`.
- **Android CI: PASS:** [run #39074410743](https://github.com/jonhararagi/animeart/actions/runs/39074410743). Build APK, tests unitarios, lint, `connectedDebugAndroidTest`, arranque de WebView y validación offline PASS.
- **Despliegue/build web: PASS:** [run #39074410809](https://github.com/jonhararagi/animeart/actions/runs/39074410809).
- **APK Android:** [artefacto #12116756555](https://github.com/jonhararagi/animeart/actions/runs/39074410743/artifacts/12116756555).
- **SHA-256 del archivo APK:** `7602d891e3e19f350be8bbb44a6c23abc789ab671ca49fc2aa99b1428733662b`.

### Comparación pública de incidencias
- [Fabric.js #7085](https://github.com/fabricjs/fabric.js/issues/7085) y [PR #11143](https://github.com/fabricjs/fabric.js/pull/11143): el pincel limitado al lienzo fallaba con zoom; el arreglo transforma coordenadas respetando zoom/pan.
- [Photopea #4051](https://github.com/photopea/photopea/issues/4051): incidencias en entrada táctil Android. El mantenedor confirmó una corrección concreta de Quick Select, no la solución de todos los síntomas del hilo.
- [Fabric.js #7056](https://github.com/fabricjs/fabric.js/issues/7056) y [PR #11150](https://github.com/fabricjs/fabric.js/pull/11150): un pincel de spray alteraba puntos al terminar el gesto.
- [Fabric.js #7278](https://github.com/fabricjs/fabric.js/issues/7278), [PR #7289](https://github.com/fabricjs/fabric.js/pull/7289) y [PR #7470](https://github.com/fabricjs/fabric.js/pull/7470): separación de fondo y contenido borrable, y enfoque de máscaras para borradores.

Las incidencias externas se usan como patrones de diagnóstico, no como prueba de que AnimeArt tuviera el mismo fallo. Sí se pudo consultar documentación técnica pública en GitHub; la búsqueda general de artículos de novedades/blogs ajenos a GitHub no estuvo disponible en esta sesión.

## Aceptación que sigue pendiente

- La prueba física con el dedo en el Xiaomi `24116RACCG` no se ha ejecutado. Chromium y el emulador no sustituyen esa validación.
- Las incidencias [#73](https://github.com/jonhararagi/animeart/issues/73) y [#86](https://github.com/jonhararagi/animeart/issues/86) deben seguir abiertas hasta completar esa aceptación física.

**Estado:** PASS para código, pruebas Web/Chromium y Android en el HEAD de código anterior; PARTIAL únicamente para la validación táctil física en el teléfono.


---

## Segunda ronda de auditoría · AA-MULTI-TOUCH-ANCHOR-001 + AA-HISTORY-RETENTION-001 (2026-10-17)

**TIMER:** 2–4 horas estimadas de inspección, implementación y regresión para esta ronda; tiempo activo real no medido.

### Defectos/riesgos confirmados y correcciones

1. **Movimiento de selección múltiple sensible al cambio del layout.** Las capas múltiples guardaban el punto inicial en coordenadas del documento y recalculaban los puntos posteriores respecto al rectángulo actual del canvas. Un cambio de layout durante el gesto podía simular un desplazamiento aunque el puntero no se moviera. Ahora el movimiento de grupo captura `clientX/clientY` y la escala documento/pantalla al iniciar, y traduce desde ese anclaje en el movimiento y en el evento de soltar. Escala y rotación mantienen su conversión normal.
2. **Historial sin límite de operaciones.** Cada paso conserva snapshots completos antes/después del documento, que pueden contener las fuentes de imágenes embebidas. Una secuencia larga de ediciones podía aumentar la memoria usada en el WebView. El historial principal ahora conserva hasta 30 operaciones recientes. La ruta de rollback guarda temporalmente la operación desalojada, de forma que un fallo de persistencia al alcanzar el límite no destruye el paso de Deshacer anterior.
3. **Shell offline.** La versión del shell PWA cambió de `v41` a `v42` para que instalaciones existentes no sigan sirviendo el JavaScript anterior.

### Evidencia reproducible

- Web CI y Chromium E2E **PASS** sobre `00d9691fb7d3cfa10fa91b982808f310ce888595`: [run #39076162599](https://github.com/jonhararagi/animeart/actions/runs/39076162599). El log incluye `PASS: stationary multi-selection gesture does not move selected layers when the canvas rectangle changes` y `ANIMEART_REAL_WEB_E2E: PASS`.
- Las pruebas unitarias incluyen límite configurable de historial y rollback del registro desalojado si falla el guardado.
- Android CI **PASS** sobre el mismo SHA: [run #39076162638](https://github.com/jonhararagi/animeart/actions/runs/39076162638). Build, comprobación del editor dentro del APK, unit tests, lint, `connectedDebugAndroidTest`, arranque WebView y validación offline pasaron.
- Despliegue/build web **PASS**: [run #39076162831](https://github.com/jonhararagi/animeart/actions/runs/39076162831).
- Artefacto APK [#12117351168](https://github.com/jonhararagi/animeart/actions/runs/39076162638/artifacts/12117351168), compilado desde `00d9691fb7d3cfa10fa91b982808f310ce888595`.
- Archivo APK: `AnimeArt-Android-aa-mobile-redesign-004-00d9691fb7d3cfa10fa91b982808f310ce888595.apk`.
- SHA-256 del archivo APK (extraído del log de `sha256sum`): `4c8d59e973ddf857288368305968dc639be593f9887f50bfdaeccf2876f4a501`. El digest del ZIP de artefacto de GitHub es diferente y no se debe confundir con este hash del APK.
- Build Web descargable [artefacto #12117171834](https://github.com/jonhararagi/animeart/actions/runs/39076162599/artifacts/12117171834); capturas del navegador [#12116574850](https://github.com/jonhararagi/animeart/actions/runs/39076162599/artifacts/12116574850).

### Comparación externa verificada

- [Fabric.js #7085](https://github.com/fabricjs/fabric.js/issues/7085) + [PR #11143](https://github.com/fabricjs/fabric.js/pull/11143), fusionada el 12 de octubre de 2026: dibujar bajo zoom/pan se limitaba a parte del lienzo por conversión de puntero.
- [Fabric.js #7056](https://github.com/fabricjs/fabric.js/issues/7056) + [PR #11150](https://github.com/fabricjs/fabric.js/pull/11150), fusionada el 12 de octubre de 2026: el pincel Spray saltaba al soltar el puntero.
- [Fabric.js PR #10977](https://github.com/fabricjs/fabric.js/pull/10977), fusionada en mayo de 2026, y [release 7.4.0](https://github.com/fabricjs/fabric.js/releases/tag/v740): errores de zoom, dimensiones y tiradores con viewport rotado.
- [Photopea #4051](https://github.com/photopea/photopea/issues/4051): reporte de problemas táctiles Android, bloqueo durante ciertas operaciones y dificultades al trabajar con imágenes grandes. El mantenedor confirmó una corrección específica para Quick Select táctil el 5 de diciembre de 2021; no afirmó haber corregido todo el reporte.
- [Konva 10.9.0](https://github.com/konvajs/konva/releases/tag/10.9.0), publicada el 15 de octubre de 2026, y [commit de rendimiento](https://github.com/konvajs/konva/commit/849c455a251298ccbcd881675e4226c79368b52a): agrupar actualizaciones del Transformer y retirar nodos destruidos sin volver a enlazar los supervivientes. Es una lección general de rendimiento; AnimeArt no usa Konva ni Fabric como dependencia.

Estos reportes son patrones de diagnóstico y prueba, no evidencia de que AnimeArt comparta exactamente todos esos defectos. En esta sesión se verificaron fuentes técnicas públicas de GitHub; no se pudo hacer una búsqueda general de blogs/novedades editoriales de Adobe, Canva o Picsart fuera de GitHub, por lo que no se atribuye ninguna cita a esos sitios.

### Aceptación todavía pendiente

La prueba del emulador no sustituye la prueba física de mover, tocar, escalar y recuperar imágenes con el dedo en el Xiaomi `24116RACCG`. Los issues [#73](https://github.com/jonhararagi/animeart/issues/73) y [#86](https://github.com/jonhararagi/animeart/issues/86) siguen abiertos. Código y CI están en **PASS** para este SHA; aceptación física final permanece en **PARTIAL** hasta comprobarla en el teléfono real.

 
---

## AA-CANVAS-FREE-MOVE-UX-001 · hacer descubrible el margen de trabajo · 2026-10-17

### Problema de uso y solución

Las pruebas anteriores lograban desplazar una capa fuera del marco al reducir el zoom con una rueda de ratón. Esa interacción resulta poco evidente en móvil y el área de documento puede ocupar casi todo el viewport. Se añadió **Ver margen** al panel contextual de selección: activa el modo Libre y cambia solo el viewport a zoom 80 %, con paneo centrado. Las transformaciones de capa y el historial permanecen intactos. En la barra móvil los botones de acción tienen objetivos táctiles de 44×44 px.

### Regresión verificada

La prueba de navegador deja de depender de la rueda del ratón y usa el botón visible. En Chromium, la prueba confirma margen por arriba, abajo, izquierda y derecha, que el modo Libre queda activo, que el botón no cambia las coordenadas de la capa, y que el movimiento real puede cruzar los cuatro bordes. Se conserva la prueba que comprueba que PNG exportado mantiene las dimensiones del documento y recorta cualquier contenido fuera de su marco.

- Implementación: [commit b3ac4e1](https://github.com/jonhararagi/animeart/commit/b3ac4e126d489d9dfb31c8a2a0acf03c814ef6d3).
- Arreglo de la discrepancia de caché offline: [commit 9c33da7](https://github.com/jonhararagi/animeart/commit/9c33da77e7d1f05a251d757eeccc552422dfbf3f). web/service-worker.js, web/app.js y las pruebas usan la versión animeart-web-shell-v43.
- Web CI + E2E Chromium PASS: [run #39079788046](https://github.com/jonhararagi/animeart/actions/runs/39079788046); el log confirma el botón Ver margen, el viewport sin alterar capas y E2E PASS.
- Deploy Web PASS: [run #39079788115](https://github.com/jonhararagi/animeart/actions/runs/39079788115).
- Android CI PASS: [run #39079788110](https://github.com/jonhararagi/animeart/actions/runs/39079788110), con build, verificación del contenido de APK, unit tests, lint, instrumentación y arranque smoke.
- APK [artefacto #12118641798](https://github.com/jonhararagi/animeart/actions/runs/39079788110/artifacts/12118641798); SHA-256 16f0381bddf9476256902168aacbeb6234cb983a829dfea49a0db2b56bcb342a.
- Build Web [#12117788702](https://github.com/jonhararagi/animeart/actions/runs/39079788046/artifacts/12117788702) y capturas de navegador [#12118561170](https://github.com/jonhararagi/animeart/actions/runs/39079788046/artifacts/12118561170).

### Límite restante

Esta evidencia verifica el comportamiento automatizado del viewport, movimiento libre y exportación, no el tacto físico en el Xiaomi 24116RACCG. Los issues [#73](https://github.com/jonhararagi/animeart/issues/73) y [#86](https://github.com/jonhararagi/animeart/issues/86) deben seguir abiertos hasta completar esa prueba. Las fuentes técnicas externas incluidas en este informe se usan como patrones de diagnóstico, no como afirmación de que todas las aplicaciones externas tengan los mismos defectos.
