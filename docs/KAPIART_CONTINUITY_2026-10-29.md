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
