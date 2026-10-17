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

## Estado actualizado tras integrar en main (2026-10-17)

La corrección descrita en esta investigación y sus regresiones ya están integradas en `main`. El informe ya no queda pendiente de integración.

- **HEAD actual de main:** `075def85455cecb407de1161c1ccde533faaddb6`.
- **Web CI: PASS** sobre ese HEAD: [run #39063754210](https://github.com/jonhararagi/animeart/actions/runs/39063754210).
- **Android CI: PASS** sobre el mismo HEAD: [run #39063754195](https://github.com/jonhararagi/animeart/actions/runs/39063754195).
- **Despliegue web: PASS:** [run #39063754215](https://github.com/jonhararagi/animeart/actions/runs/39063754215).
- Android verificó el editor actual dentro del APK, pruebas unitarias, lint, instrumentación `connectedDebugAndroidTest`, arranque de WebView y funcionamiento offline.
- **APK de main:** [artefacto #12111993080](https://github.com/jonhararagi/animeart/actions/runs/39063754195/artifacts/12111993080).
- **SHA-256 verificado por el trabajo de CI:** `d78f9f82f1538165eaa7e76844dbff08131759491b40afcc0badbcfb765d3db5`.

## Pendiente de aceptación física y alcance de investigación

- Las incidencias de flujo táctil y movimiento libre [#73](https://github.com/jonhararagi/animeart/issues/73) y [#86](https://github.com/jonhararagi/animeart/issues/86) deben conservarse abiertas hasta completar la aceptación en el Xiaomi `24116RACCG`. CI, Chromium y el emulador no demuestran que el manejo con el dedo sea correcto en el dispositivo físico.
- La investigación técnica basada en informes públicos de GitHub, issues de usuarios, cambios de mantenedores y PRs corregidas está documentada arriba. La búsqueda general de artículos de novedades/blogs fuera de GitHub no se pudo hacer en esta sesión; no se atribuye ninguna cita a Adobe, Canva, Picsart ni a otros sitios editoriales.
- El PR antiguo de empaquetado alternativo [#78](https://github.com/jonhararagi/animeart/pull/78) sigue abierto, pero no se integró: `main` ya genera el APK desde el flujo Android canónico y valida que el paquete incluya la versión actual del editor. No mezclar ambos sistemas sin una necesidad demostrada.

**Estado global:** PASS para el código integrado y la CI de `main`; PARTIAL para la aceptación final de uso táctil físico, que todavía no se ha ejecutado.
