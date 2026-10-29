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

## Próximos pasos exactos
1. Continuar en feature/kapiart-smart-snapping-001; no crear rama duplicada.
2. Localizar el flujo pointer/touch que actualiza transformaciones durante arrastre; aplicar snap solo al movimiento interactivo.
3. Renderizar guías de centro/borde como overlay efímero, nunca como capas persistentes/exportables.
4. Ejecutar tests web, E2E Chromium y Android CI sobre el mismo HEAD.
5. Comparar PR #123 y #129 contra main vigente, rescatar deltas exclusivos y sus complementos.
6. No fusionar PR ni modificar main sin autorización explícita. Al autorizar integración, consolidar todos los complementos útiles y verificar el SHA de main posterior.
