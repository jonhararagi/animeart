# Auditoría del repositorio AnimeArt — 2026-10-03

## 1. Estado ejecutivo

**Estado global: 🔴 RED**

La rama `main` no puede considerarse GREEN porque su ejecución CI más reciente (#68) terminó en **failure** durante el smoke test Android. Build, unit tests y lint sí terminaron correctamente en esa ejecución.

La evidencia disponible muestra que el problema de #68 está en la ejecución del bloque shell del smoke test dentro de `reactivecircus/android-emulator-runner@v2`: el runner recibió/ejecutó un bloque incompleto y terminó con `Syntax error: end of file unexpected (expecting "done")`. No hay evidencia de un fallo de compilación de la aplicación en ese run.

## 2. Rama principal

- Branch: `main`
- Commit auditado: `99f68ad0f75e7354e332b471bf2542327aedab9e`
- Repositorio: `jonhararagi/animeart`
- Default branch: `main`

### Evidencia CI

Android CI #68:
- Build: **SUCCESS**
- Unit tests: **SUCCESS**
- Lint: **SUCCESS**
- Android startup smoke test: **FAILURE**
- Conclusión del workflow: **FAILURE**

Run:
https://github.com/jonhararagi/animeart/actions/runs/37144524589

El fallo no corresponde a compilación ni a tests unitarios. El log termina con un error de shell al ejecutar el script de espera del emulador.

## 3. Arquitectura actual de main

La arquitectura Android existente está bien encaminada para la regla:

**REUTILIZAR > ADAPTAR > CREAR**

Existe un único concepto de:
- Document;
- Layer;
- Stroke;
- Viewport;
- EditorState;
- CommandHistory;
- Persistence;
- Renderer Compose.

La documentación declara un pipeline único:

`UI → Gesture Dispatcher → Tool → Stroke → Layer → Document → Renderer → Persistence`

No se observa, en la documentación auditada de `main`, una segunda arquitectura Android equivalente.

La persistencia continúa siendo una base local de recuperación con JSON/SharedPreferences; la propia documentación la marca como una solución que deberá evolucionar cuando el alcance lo justifique.

## 4. Estado Web

La Web todavía **NO está integrada en main**.

Existe el PR #3:

**feat: establish AnimeArt web-first foundation**

Branch:
`web-first-foundation`

Commit auditado:
`6d09935f1283d82b3fdd9173a0f93288adb2c2df`

El branch está:
- ahead de main: **20 commits**
- behind de main: **0 commits**
- estado: **ahead**

Esto es importante: la fundación Web está construida como candidato directo sobre el main actual, sin divergencia histórica respecto de main.

### Web CI

Web CI #10:
- status: **completed**
- conclusion: **success**

Run:
https://github.com/jonhararagi/animeart/actions/runs/37171214001

Android CI #78 para el mismo commit:
- status al momento de esta auditoría: **in_progress**

Por tanto, PR #3 no puede recibir todavía GREEN global mientras Android CI permanezca pendiente.

## 5. Arquitectura Web encontrada

El PR #3 introduce:

- `web/domain/model.mjs`
- Document explícito;
- Layer explícito;
- strokes dentro de Layer;
- transform de Layer;
- selectedLayerId;
- normalización/migración de persistencia Web;
- tests de dominio;
- Web CI.

Esto es arquitectónicamente compatible con la dirección del proyecto porque evita mantener como modelo principal una colección paralela de strokes/capas.

Sin embargo, todavía falta:
- Viewport explícito en Web;
- separación clara entre cámara/viewport y transformación de Layer;
- zoom/pan basado en ese Viewport;
- Undo/Redo por comandos;
- persistencia de proyecto más completa;
- PWA/offline;
- integración final Web/Android.

## 6. PR #2 — Día 4 Reference Layer

PR:
**Day 4: tracing and reference layer**

Branch:
`day-4-reference-layer`

Commit:
`7a2d92abf51ce77742c6abe038f49aa3c8c3cdb6`

Android CI #45:
- **SUCCESS**

Run:
https://github.com/jonhararagi/animeart/actions/runs/37138717661

Pero el PR actualmente está:

- abierto;
- no merged;
- `mergeable: false`;
- divergido respecto de main;
- ahead: **20 commits**;
- behind: **23 commits**.

El merge base es:
`bef67a9f9a04e6ef9aef6e5615c7c62fc5810a45`

Por tanto, PR #2 no debe fusionarse a ciegas. Primero necesita reconciliarse con el estado actual de main y volver a verificarse.

## 7. Conflicto de líneas de desarrollo

Hay dos líneas de trabajo abiertas:

### Línea A
`day-4-reference-layer`

Android Día 4, basada en el estado anterior a los cambios Web/CI posteriores.

### Línea B
`web-first-foundation`

Fundación Web-first basada directamente sobre main actual.

Esto crea una decisión de integración que debe resolverse antes de continuar acumulando funcionalidades.

Regla recomendada:

**reconciliar → verificar → integrar → continuar**

No implementar una tercera arquitectura paralela para resolver la divergencia.

## 8. Problema de CI detectado

### PB-actual — Smoke Android en main

**Síntoma**

El run #68 ejecuta correctamente:
- Build;
- Unit tests;
- Lint;

pero falla al entrar en el smoke test.

El log muestra:

`/usr/bin/sh: 1: Syntax error: end of file unexpected (expecting "done")`

La aplicación todavía no llegó a la fase de instalación/arranque del APK dentro de ese paso.

**Causa observada**

El bloque multilinea entregado al parámetro `script` del action terminó siendo ejecutado por shell como un bloque incompleto.

**Impacto**

- main queda RED;
- no existe evidencia de smoke Android exitoso para el commit actual;
- no se puede declarar estabilidad completa de CI.

**Dirección de reparación ya presente en PR #3**

PR #3 mueve el smoke test a:

`scripts/android-startup-smoke.sh`

y reduce la lógica inline del workflow.

Esta adaptación es preferible a duplicar otro sistema de pruebas, porque reutiliza la misma prueba como script explícito y reduce la superficie de parsing YAML/action.

## 9. Inconsistencias documentales

Se detecta una inconsistencia importante:

### README.md

Todavía presenta el repositorio como **Day 1**.

### docs/CONTINUITY.md

Registra:
- Día 1 completado;
- Día 2 completado;
- Día 3 completado;
- Día 4 como siguiente línea;
- además contiene información de trabajo Web posterior.

### Estado Git real

Actualmente existen:
- main en commit `99f68ad...`;
- PR #2 de Día 4;
- PR #3 Web-first;
- varias correcciones de CI posteriores al Día 3.

Conclusión:

**La documentación no representa todavía una única fotografía temporal perfectamente coherente del repositorio.**

No se debe solucionar borrando historial. Debe añadirse una nueva sección de auditoría/estado actual.

## 10. Reutilización y duplicación

No se encontró evidencia, en los documentos auditados de main, de que se haya creado un segundo:

- Document;
- Layer system;
- Renderer Android;
- Canvas Android;
- History;
- Persistence;

para sustituir al existente.

El PR #3 mejora la situación Web al introducir contratos explícitos Document/Layer en lugar de conservar un modelo Web paralelo.

Esto es una señal arquitectónica positiva.

## 11. Riesgos actuales

### 🔴 Bloqueantes

1. CI de main continúa fallando en Android startup smoke.
2. PR #3 tiene Android CI todavía en progreso al momento de esta auditoría.
3. PR #2 está divergido y marcado no mergeable.

### 🟡 Importantes

1. README está desactualizado respecto del Día 3/estado Web.
2. Web aún no posee Viewport explícito.
3. Web todavía no posee Undo/Redo equivalente al contrato de Android.
4. Persistencia continúa siendo una solución inicial.
5. La integración Web/Android todavía no está definida operacionalmente.

### 🟢 Positivos

1. Build Android de main funciona.
2. Unit tests Android de main funcionan.
3. Lint Android de main funciona.
4. PR #2 tiene evidencia de Android CI exitosa en su propio commit.
5. Web CI #10 es exitoso.
6. PR #3 no está detrás de main.
7. La dirección Web respeta Document/Layer como conceptos de dominio.
8. No se observa una duplicación deliberada del renderer Android.

## 12. Decisión del CEREBRO

**NO DAR VISTO BUENO GREEN.**

Estado:

**🔴 RED**

La prioridad inmediata no es añadir IA, filtros, shading ni nuevas funciones.

La prioridad correcta es:

1. completar/verificar Android CI del PR #3;
2. resolver el smoke test Android;
3. conseguir una ejecución CI Android verde real;
4. revisar PR #3 completo contra la arquitectura;
5. decidir la integración de PR #3;
6. después reconciliar PR #2 con el nuevo main si Día 4 sigue siendo el siguiente objetivo;
7. actualizar continuidad y documentación;
8. recién entonces avanzar a la siguiente capa.

## 13. Siguiente tarea recomendada para OBRERO

### OBJETIVO

Conseguir una ejecución Android CI real completamente verde para la fundación Web-first sin romper Android.

### REUTILIZAR

- Renderer Android existente.
- Document/Layer/Stroke/Viewport/History existentes.
- `scripts/android-startup-smoke.sh` del PR #3.
- Workflow Android existente.

### NO HACER

- No crear otro renderer.
- No crear otro Document.
- No crear otro sistema de smoke.
- No fusionar PR #2 todavía.
- No añadir funcionalidades de Día siguiente.

### PRUEBAS

- Build.
- Unit tests.
- Lint.
- Android startup smoke.
- Web CI.
- CI completo del PR #3.

### CRITERIO DE ÉXITO

Existe evidencia real de:
- Android CI SUCCESS;
- Web CI SUCCESS;
- APK generado;
- smoke de MainActivity exitoso;
- ningún fallo bloqueante conocido.

Solo después podrá evaluarse GREEN.

## 14. Evidencia principal

- main: `99f68ad0f75e7354e332b471bf2542327aedab9e`
- Android CI #68: FAILURE
- PR #2 Android CI #45: SUCCESS
- PR #3 Web CI #10: SUCCESS
- PR #3 Android CI #78: IN PROGRESS al momento de la auditoría
- PR #2: diverged, +20/-23 respecto de main
- PR #3: +20/0 respecto de main

---

**Auditoría realizada siguiendo el mandato del CEREBRO: inspeccionar → diagnosticar → verificar → no inventar → no declarar GREEN sin evidencia.**
