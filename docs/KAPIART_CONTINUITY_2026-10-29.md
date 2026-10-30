# KapiArt · continuidad de implementación en curso

Fecha: 2026-10-29
Estado: PARTIAL · rama abierta, sin merge.

## Validaciones
- PR #130, HEAD d43b16b8657df71b8f6eb3e297983950ce525b26: Web CI PASS (#1480) y Android CI PASS tras reejecución (#1579, run 40959615233). Android completó build, unit tests, lint, instrumentación, preparación/verificación/checksum y subida de APK. Sin prueba física Xiaomi.
- PR #130 sigue abierta en borrador y sin fusionar. Main no fue modificada por esta sesión.

## Ramas complementarias
- PR #123 cerrada sin merge, HEAD 8ecc9543dea6c4843f46a9b9498d0c80ecedd724: 27 commits, 23 archivos; expresiones anime SVG editables, persistencia/undo-redo, caché offline v72 y pruebas. Rescatar diferencias útiles, no cherry-pick ciego.
- PR #129 abierta en borrador, HEAD cfab1c162a4a4cd0f9b70884863df2eb5acd346f: reutilización de estilos tipográficos entre páginas. Revalidar contra main vigente antes de integrar.
- Comparación contra main vigente: PR #123 está DIVERGED (27 commits exclusivos, main 7 commits por delante; 23 archivos con diferencias). Requiere rescate selectivo por archivo, no merge directo.
- PR #129 está AHEAD (22 commits, main no tiene commits por delante según comparación); 18 archivos con diferencias, incluye módulo y pruebas de continuidad tipográfica. Mantener abierta y revalidar CI antes de integración.
- PR #130 está AHEAD (3 commits, sin divergencia respecto de main en la comparación), limitado a estilos y prueba táctil.
- SHA 80760e037493507429470905e4525d9bf2c2adcf corresponde al blob de web/app.js, no al commit de main.

## Implementación iniciada
- Rama: feature/kapiart-smart-snapping-001, creada desde main.
- Añadido web/domain/design-snapping.mjs: calcula ajuste magnético a bordes/centros del lienzo y de otras capas. Devuelve correcciones y guías transitorias; no muta documentos ni capas.
- Añadidas pruebas web/test/design-snapping.test.mjs para centro del lienzo, alineación entre capas, tolerancia y entradas inválidas.
- Integrado en web/app.js el ajuste magnético durante arrastre individual y múltiple. La tolerancia es de 8 px de pantalla convertidos a coordenadas de documento según zoom y escala del lienzo; se excluyen las capas seleccionadas de los objetivos.
- Las guías rosa se dibujan como overlay temporal del canvas, después del documento y fuera del modelo de capas/exportación. Se limpian al soltar y cancelar; el commit final sigue usando las operaciones existentes y una sola entrada de historial.
- Añadido web/domain/design-snapping.mjs al precache del service worker y a la lista de recursos offline; se añadió al precache conservando v78 por compatibilidad con pruebas existentes.
- Commits de integración: ef9e4dff79ba4710de310dcd71009e0d064b5eb5 (gestos y guías), ea1d07b0e9249acbcb4be0177f1805b6896823a4 (precache), 075b65bd0366f30fb69f105c4c04f9198662ff18 (verificación de recurso offline).
- Primer Web CI #1481 falló en tests preexistentes que fijaban el nombre de caché v78 y en una aserción que esperaba `constrainMoveDelta` directamente en el arrastre múltiple. Se corrigió manteniendo v78 y actualizando la aserción al flujo `snapMoveDelta`.
- HEAD corregido de código: cc98b81bc22d865c198f6a9aa0fd2fd3376d4172. Revalidación de Web CI y Android CI pendiente de confirmación sobre este HEAD; no declarar PASS hasta obtener los resultados.
- No hay prueba física Xiaomi; revisar zoom/límites en emulador o dispositivo cuando CI termine.
- La rama no modifica main y no fusiona ni cierra PR. Mantener el rescate selectivo de PR #123, #129 y #130 para una fase posterior.

## Controles de uso móvil y modo libre (2026-10-29)
- Añadido botón visible 🧲 **Imán: activado/apagado** en la barra de herramientas. El estado inicial es activado; al apagarlo, `snapMoveDelta` retorna el delta limitado sin ajuste ni guías, permitiendo movimiento libre. El botón actualiza `aria-pressed`, nombre accesible y mensaje de estado; el cambio de modo no entra al historial.
- El control persistente `#mobile-tools-toggle` ahora activa en teléfono un modo de lienzo a pantalla completa: oculta barra superior, herramientas, paneles, capas y dock; deja un botón flotante de 48 px para restaurar todos los controles. En tablet conserva el plegado de bandeja. Ocultar/restaurar no toca documento ni historial. Se fijaron objetivos de 48 px para controles móviles.
- Añadidas pruebas de contrato para el toggle magnético, movimiento libre, bandeja plegable y modo de lienzo a pantalla completa. Documentadas reglas explícitas de cancelar/cerrar/volver/Escape, deshacer/rehacer y prioridad del lienzo en `docs/MOBILE_EDITOR_LAW.md`.
- Commits de este bloque: `a7cb16d3f511b2c9646b11549c295b9297ef6dd3` (lógica del imán), `7a64ce0d64590ec36be86ef823e62b6d4f7d0d92` (botón), `463311f3f8b06cdaa4d4f55795419b5772d686c6` (controles táctiles), `9d0d5e717fdf92360a24f14e890ef078a15ac4de` (pruebas iniciales), `96e75b09548b28d418ea0e0dd62c5b4cfbd0cd44` (modo foco en móvil), `0456cf8415fb04d30d86391a31c6ec17e6220403` (vista a pantalla completa), más commit de pruebas del modo foco pendiente de SHA final.
- Pendiente: ejecutar tests/CI en el HEAD actualizado; comprobar visualmente el layout real en viewport Xiaomi, incluyendo modo lienzo completo y restauración. El botón magnético está en la barra de herramientas y se accede al restaurarla.

## Próximos pasos exactos
1. Continuar en feature/kapiart-smart-snapping-001; no crear rama duplicada.
2. Localizar el flujo pointer/touch que actualiza transformaciones durante arrastre; aplicar snap solo al movimiento interactivo.
3. Renderizar guías de centro/borde como overlay efímero, nunca como capas persistentes/exportables.
4. Ejecutar tests web, E2E Chromium y Android CI sobre el mismo HEAD.
5. Comparar PR #123 y #129 contra main vigente, rescatar deltas exclusivos y sus complementos.
6. No fusionar PR ni modificar main sin autorización explícita. Al autorizar integración, consolidar todos los complementos útiles y verificar el SHA de main posterior.


## 2026-10-29 · Seguimiento PR #131 tras CI

- Rama activa: `feature/kapiart-smart-snapping-001`.
- HEAD verificado: `2238c6f54d7577d45df28444e047166159721833`.
- PR #131 sigue abierta, draft y sin merge. `main` no fue modificado.
- Web CI anterior, run `40974014286`: compilación PASS, tests FAIL (477/481). Los cuatro fallos fueron contratos de pruebas desactualizados: dos esperaban el antiguo `constrainMoveDelta`, uno esperaba siempre `mobile-tools-collapsed` aunque el teléfono usa `mobile-canvas-focus`, y otro esperaba la etiqueta antigua “Mostrar herramientas”.
- Se actualizaron las expectativas en `web/test/guided-editing.test.mjs`, `web/test/smoke.test.mjs` y `web/test/smooth-interaction.test.mjs`. Commits: `861411f2999d1e26a62fd5ad691ff573f8ab2c23`, `ef2a7c3f7e4d35aa6b378ec73b1dd84b518822c1`, `2238c6f54d7577d45df28444e047166159721833`.
- Todavía no hay un nuevo resultado Web CI asociado al HEAD actualizado.
- Android run `40974014233`: build, verificación del editor, unit tests y lint PASS; instrumented/startup smoke tests seguían en ejecución al último chequeo, sin APK publicado aún.
- Pendiente: confirmar nueva ejecución Web CI y final Android CI; luego auditar diálogos/modos existentes uno por uno para Cancelar/Cerrar/Volver/Escape y verificar que cancelar descarte previews sin dejar gestos/guías activos. La ley documentada no equivale a auditoría completa.
- Pendiente prueba visual en emulador y prueba física Xiaomi `24116RACCG`; no declarar realizadas.
- No fusionar PR #131 ni otras ramas sin autorización expresa.

## 2026-10-30 · Seguimiento de validación PR #131

- HEAD observado antes de este ajuste: `6af7419d0e23ae55a7e54212126b37e2b43f526b`; PR #131 abierta, en borrador y dirigida a `main`. Sin cambios en `main`.
- Web CI run `40974465461` sobre ese HEAD: build PASS, tests PASS, benchmark PASS y publicación del build web PASS; falla solamente el job `Real browser E2E` (run #1496).
- Diagnóstico E2E: el escenario `AA-CANVAS-FREE-MOVE-001` exigía restaurar exactamente el transform tras mover la capa fuera de cada borde, pero el ajuste magnético permanecía activado. El imán puede corregir deliberadamente el delta de retorno. Se separó el contrato: desactivar el imán explícitamente durante los checks de movimiento libre y reactivarlo al terminar.
- Cambio aplicado en `web/scripts/browser-e2e.mjs`; commit: `62359b637d7515fc75c56698b60097d06e19dc33`. La reejecución Web CI de este nuevo HEAD sigue pendiente.
- Android CI run `40974465468` sobre `6af7419d0e23ae55a7e54212126b37e2b43f526b`: build, verificación del editor, unit tests, lint, instrumentación/startup smoke tests y preparación/verificación/checksum del APK PASS. Artefacto publicado: `kapiart-android-debug-v0.3.7-d2fdbe6745af7d470c0031188aa47c50dc0a8393`, SHA-256 `cd594edae70d9f8de66bf30d470c6b131184e53ad3bc23d1eae0353f8b7a0b5c`.
- Pendiente: Web CI completo PASS sobre el nuevo HEAD; auditoría real de cancelación en diálogos de edición, recorte, borrado y selección (Cancelar/Cerrar/Volver/Escape y descarte de preview/gestos/guías); prueba visual en emulador y prueba física Xiaomi `24116RACCG`.
- No declarar aprobada la PR, no fusionar ni cerrar PR #131, y no tocar `main` sin autorización expresa.

## 2026-10-30 · Primera auditoría de cancelación

- **Recorte de imagen (`image-edit-dialog`):** el documento no cambia hasta `submit`; X/Cancelar cierran y limpian el gesto de preview y sus callbacks de imagen. PASS en inspección estática; falta E2E específico de cancelar tras mover/redimensionar el marco.
- **Recorte de composición (`canvas-crop-dialog`):** el marco/modelo de preview viven en estado temporal y el evento `close` limpia `canvasCropDrag`, `canvasCropDocument` y `canvasCropRectangle`. PASS en inspección estática; falta E2E específico de Escape/X/Cancelar.
- **Texto (`text-edit-dialog`):** hallazgo BLOCKED/PARTIAL. El evento `close` confirma `state.textPreview` y varios manejadores `change` ejecutan `commitTextPreview` antes de que el usuario pulse Aplicar. Para cumplir cancelación real hace falta tratar la edición como transacción: mantener baseline, no persistir hasta Aplicar y descartar/restaurar en X/Escape/Cancelar. No está corregido todavía.
- **Eliminar/selección:** eliminar por botón/dock elimina de inmediato y registra historial, con Deshacer disponible. La X del manejador de imagen elimina la imagen mediante `removeSelectedImage`; en texto y selección múltiple cierra el marco. Esto contradecía el texto de la ley, por lo que se precisó la regla en `docs/MOBILE_EDITOR_LAW.md` para describir la interacción diferenciada.
- Estado de la prueba de cancelación: inspección estática, no prueba automatizada ni prueba física. Próxima tarea exacta: convertir el editor de texto en una transacción y añadir pruebas X/Escape/Cancelar antes de continuar con Estilo, recoloración, borrado mágico y selección.
- No modificar `main`, no fusionar PR y no declarar la auditoría completa.

## 2026-10-30 · Sesión 14:05 Argentina · Editor de texto transaccional

- Rama: `feature/kapiart-smart-snapping-001`. PR #131 sigue abierta y en borrador, base `main`. Último HEAD al cerrar: `a4b977869bb17df3d87c9f3cfa949a06de5c2b30`. No se modificó `main`, no se creó otra rama ni PR, no hubo merge.
- Diagnóstico Web #1498 / run `41080277563` sobre `6c54e98...`: build, 481 pruebas y benchmark PASS; Real browser E2E falló después de que los escenarios de movimiento libre por los cuatro bordes pasaran. Causa inmediata: expresión de evaluación del estado del imán mal cerrada. La regresión se corrigió después en `web/scripts/browser-e2e.mjs`.
- Android #1597 / run `41080277604`: build, verificación de editor, unit tests y lint PASS; las 12 pruebas instrumentadas se reportaron 12/12, 0 fallos, pero el dispositivo `emulator-5554` desapareció durante `onAfterAll` de AndroidTestApkInstallerPlugin. Gradle falló en `connectedDebugAndroidTest`; no hubo APK. Se clasifica como fallo del job de instrumentación/teardown, no como PASS ni como fallo funcional confirmado de las 12 pruebas.
- Editor de texto convertido a transacción en `web/app.js`: los inputs, presets y estilos guardados modifican solo `state.textPreview`; solo **Aplicar al lienzo** llama a `commitTextPreview`, registra historial y persiste. X, Cancelar y Escape descartan la previsualización pendiente. Cancelar la creación provisional de texto elimina la capa y trata de retirar su entrada de creación del historial para que Undo no la resucite.
- UI de texto actualizada en `web/index.html` con botón explícito `#cancel-text-layer`, X identificada como cancelar y ayuda que explica Aplicar/Cancelar/X/Escape. `web/styles.css` mantiene los controles táctiles y aplica a Aplicar una fila completa.
- Cobertura añadida/actualizada en `web/test/text-layer.test.mjs`, `web/test/guided-editing.test.mjs` y `web/scripts/browser-e2e.mjs`: preview sin persistencia, Apply, X, Cancelar, Escape, estilos reutilizables y cancelación de texto provisional.
- Web #1502 / run `41096884714` sobre `3d6c63c...`: test module parse error por una regex mal escapada en la nueva prueba estática. Corregido en `0484a63bd76863300a6aa02ef5f6d1abeff5c6e9`.
- Web #1503 / run `41097028078` sobre `0484a63...`: 480 pass / 2 fail. Ambos fallos eran expectativas antiguas en `guided-editing.test.mjs`: cancelación provisional y cierre de editor. Ajustadas en `be59b3250d304b90a2bc1db773f4831119d54d3e`.
- Web #1504 / run `41097300699` sobre `be59b32...`: build PASS, tests 481/482 PASS; único fallo era el test de cierre que buscaba el comienzo de la siguiente sección con un `\\n` literal duplicado. Corregido en `a4b977869bb17df3d87c9f3cfa949a06de5c2b30`. No hay todavía resultado CI confirmado sobre este HEAD al guardar esta nota.
- Android #1603 / run `41097300583` sobre la tanda anterior: build y verificación del editor PASS; unit tests estaban en ejecución al último chequeo. Lint, instrumentación, checksum y APK todavía no confirmados. El nuevo HEAD puede generar una ejecución posterior; volver a consultar GitHub.
- Auditoría de cancelación al cierre: recorte de imagen y composición siguen PASS solo por inspección estática, pendientes E2E de cancelar; editor de texto corregido en código, pendiente validar mediante Web CI/E2E; borrado/selección documentados y probados parcialmente. No declarar auditoría completa.
- Pendiente también: prueba visual en emulador, prueba física en Xiaomi `24116RACCG` y comprobar que Android completa instrumentación y publica un APK construido desde el HEAD definitivo.
- Commits de esta sesión: `3201735e63caaf87653e65f35873e93810cddcd2`, `ea4f99721bccb0142fe91f59cd62b4c76d0118ae`, `e19487f2bd5ad05008250b995ec306ab1e187591`, `f554063c77fe93435429e5564f36a057d4d7d8c0`, `34933c7bf9e760a1273390391d405d687a8e8d83`, `3d6c63c15b07921f3556a0ab4442e6f94c3046fa`, `0484a63bd76863300a6aa02ef5f6d1abeff5c6e9`, `be59b3250d304b90a2bc1db773f4831119d54d3e`, `a4b977869bb17df3d87c9f3cfa949a06de5c2b30`.
- Próximo paso exacto: consultar Web CI y Android CI asociados al HEAD `a4b9778...`; resolver cualquier fallo restante; ejecutar la prueba E2E transaccional del texto. Después completar pruebas de cancelación de los diálogos de recorte, apariencia y borrado mágico.


## 2026-10-30 · Validación E2E y Android completada

- Rama: `feature/kapiart-smart-snapping-001`. HEAD de implementación validado: `1c571076d18ef5a9c170f8c19d5c273465e774a1`. PR #131 sigue abierta y en borrador, base `main`. El SHA de `main` observado durante la ejecución fue `fc87decb5b23035852cfe9df2fb227b8de8d0275`; no se hizo merge ni cambio directo a main.
- **Web CI #1508**, run `41098965953`, sobre el HEAD anterior: build PASS, suite completa **482/482 PASS**, benchmark PASS, verificación/publicación del editor web PASS y Real browser E2E PASS. No hubo fallos, cancelaciones ni pruebas omitidas en Node.
- La causa del E2E que fallaba en el commit `87b74cc...` fue una expresión diagnóstica de la propia prueba mal interpolada. Se corrigió en `1c571076d18ef5a9c170f8c19d5c273465e774a1`; no fue necesario cambiar la lógica de persistencia del editor.
- E2E del editor de texto: PASS typing como preview sin persistir; X, Cancelar y Escape descartan la previsualización; estilos reutilizables capturan `letterSpacing=4` y `lineHeight=1.65`; Aplicar los persiste sin reemplazar el texto; borrar elimina la capa correcta; cancelar la creación provisional por X quita la capa provisional. Se comprobó el renderizado y la interacción tipográfica en viewport móvil simulado de 393 × 873.
- Otros escenarios E2E relevantes: cancelar vista previa del Borrado Mágico sin modificar la fuente original; cancelar Paint/Erase sin mutar píxeles persistidos; cerrar ventana de forma cancela cambios; selección magnética y bypass de movimiento libre; flujo de recorte de imagen y composición, recoloración selectiva, plantillas, elementos SVG editables, proyectos, páginas, agrupación, exportación PDF y dock móvil. El recorte de composición se probó en preview y aplicación, pero sigue pendiente cubrir sus salidas X/Cancelar/Escape como prueba transaccional específica.
- **Android CI #1607**, run `41098965826`, PASS en build, verificación del editor incluido, unit tests, lint, `connectedDebugAndroidTest`, startup smoke, preparación del APK, validación del paquete/firma/checksum y subida del artefacto.
- Artefacto Android: `kapiart-android-debug-v0.3.7-a6c3ce13b355f21dc9cd4124d8f15d6ebcfe9198`, ID `12997786629`. APK: `KapiArt-Android-v0.3.7-a6c3ce13b355f21dc9cd4124d8f15d6ebcfe9198.apk`, 11,232,647 bytes, paquete `com.jonhararagi.animeart`, versión `0.3.7`, versionCode `10`. El workflow lo construyó desde el merge commit de PR `a6c3ce13b355f21dc9cd4124d8f15d6ebcfe9198`, que tiene como segundo padre el HEAD de PR `1c571076...` y como primer padre el SHA actual de main `fc87decb...`.
- SHA-256 del APK, verificado tanto con el archivo `.sha256` extraído como con cálculo independiente: `f3228266c9d593f1f89ae7b2118545a09125cd3d3849f4dc3ef2b0351419782b`. Digest SHA-256 del ZIP de artefacto: `cff4fb661799f8eb98472f93cf00a0d578ac30c19e21aa9090b1d7a86dbd78dd`.
- Firma: `ephemeral-debug`, certificado SHA-256 `51a40cd17d3ba842e8861a49cfdafba153eaf81d44e895e4ae52d3adf5758d9b`. GitHub indica `update_compatibility=NOT GUARANTEED`: APK para pruebas, sin garantizar actualización sobre una instalación firmada con otra clave.
- El E2E de Chromium y Android CI son validaciones automatizadas sobre runner/emulador; no equivalen a inspección visual manual ni a prueba física en el Xiaomi `24116RACCG`. Esta prueba física sigue pendiente.
- Auditoría restante: ejecutar E2E explícito de X/Cancelar/Escape para recorte de composición e imagen tras manipular el marco; terminar revisión de Apariencia/Recoloración/Borrado Mágico y de gestos/guías residuales en cada cancelación; comprobar vista limpia/restauración en emulador y en el Xiaomi. Magic Eraser y Paint/Erase sí tienen cancelación E2E PASS.
- Commits de diagnóstico E2E posteriores al primer run verde: `87b74cc5601585559fff0ac4dc7c3d8497d9da03` (diagnóstico) y `1c571076d18ef5a9c170f8c19d5c273465e774a1` (corrección de la interpolación). No cambiar la lógica del editor sin evidencia nueva.
- Próximo paso: completar la cobertura transaccional de ambos recortes y la auditoría de cancelación, manteniendo esta rama y PR; no crear duplicadas, no tocar main, no fusionar ni cerrar PR #131 sin autorización.
