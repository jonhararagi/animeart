# Registro maestro — Problema de huesos

| ID | Estado | Fecha | Problema | Solución / siguiente acción | Evidencia |
|---|---|---|---|---|---|
| PB-001 | RESUELTO | 2026-10-03 | Android startup smoke test fallaba por ejecución incorrecta del bloque Bash del workflow. | Se movió la prueba a `scripts/android-startup-smoke.sh`. | Android CI #75 SUCCESS |
| PB-002 | RESUELTO | 2026-10-03 | El build Web copiaba recursivamente `dist` y podía entrar en sí mismo. | El script de build excluye `dist` y `node_modules`. | Web CI #2 SUCCESS |
| PB-003 | RESUELTO | 2026-10-03 | El estado Web mantenía un modelo paralelo de documento/capas/strokes. | Se introdujo `web/domain/model.mjs` y se adaptó `web/app.js`. | Web CI #7 SUCCESS; Android CI #75 SUCCESS |
| PB-004 | ABIERTO | 2026-10-03 | El Web todavía no tiene un Viewport explícito separado de la transformación de Layer. | Siguiente salto: crear/adaptar Viewport, separar cámara y Layer, implementar zoom/pan y añadir tests de coordenadas. | Pendiente de implementación |

## Regla de actualización

Al detectar un problema:

1. asignar ID;
2. registrar síntoma;
3. investigar causa;
4. registrar impacto;
5. aplicar o proponer solución;
6. añadir evidencia;
7. cambiar estado.

Un problema RESUELTO no se borra.
