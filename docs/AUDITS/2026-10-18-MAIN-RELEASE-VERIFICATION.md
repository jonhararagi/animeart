# AnimeArt · Verificación de main y entrega Android v0.3.0

**Fecha:** 2026-10-18  
**TIMER:** 30–45 minutos equivalentes para revisión del repositorio, correlación de CI, checksum y registro; no es tiempo activo medido.

## SHA y CI

Código empaquetado: `922704ba69942e1cb33724a6bf4a45760081b5be` ([commit](https://github.com/jonhararagi/animeart/commit/922704ba69942e1cb33724a6bf4a45760081b5be)).

- Web CI: **PASS**, [run #39114643532](https://github.com/jonhararagi/animeart/actions/runs/39114643532).
- Android CI: **PASS**, [run #39114643622](https://github.com/jonhararagi/animeart/actions/runs/39114643622). Pasaron build, validación de archivos actuales del editor dentro de la APK, pruebas unitarias, lint, instrumentación, smoke de inicio/offline y generación/subida de APK.
- Hubo runs anteriores fallidos/cancelados durante cambios secuenciales de caché offline, contraste y branding. La pareja arriba corresponde al SHA auditado y ambas terminó en éxito.

## APK verificada

- Artefacto [#12132190553 · Android v0.3.0](https://github.com/jonhararagi/animeart/actions/runs/39114643622/artifacts/12132190553).
- Nombre: `AnimeArt-Android-v0.3.0-922704ba69942e1cb33724a6bf4a45760081b5be.apk`.
- Tamaño exacto: 10.571.604 bytes.
- SHA-256 comprobado directamente sobre el APK extraído y coincidente con el archivo de checksum incluido:

```text
160a6d415e13d803c29d070a9982a1b76b0ec215c8c361581064e156ff6a3e21
```

## Cambios consolidados en main

- [PR #87](https://github.com/jonhararagi/animeart/pull/87), [#88](https://github.com/jonhararagi/animeart/pull/88), [#89](https://github.com/jonhararagi/animeart/pull/89): movimiento de capas fuera del marco, recuperación y modos de movimiento.
- [PR #90](https://github.com/jonhararagi/animeart/pull/90): errores de dibujo/borrado con zoom/pan; corrección del argumento de coordenadas confirmada con Chromium y regresiones.
- [PR #91](https://github.com/jonhararagi/animeart/pull/91): portadas SVG originales, stickers y word art como capas editables, conjuntos de tres elementos y catálogo local/offline.
- Optimización ya registrada en la incidencia [#73](https://github.com/jonhararagi/animeart/issues/73): reutilización de buffers y cola para quitar fondo. El benchmark sintético Linux de 16 MP bajó el pico RSS de 191,3 MiB a 130,5 MiB; no representa la RAM total ni la batería del teléfono.

## Fuentes de bugs de editores

La ficha [EXTERNAL-EDITOR-BUG-RESEARCH](./2026-10-17-EXTERNAL-EDITOR-BUG-RESEARCH.md) registra [Fabric.js #7085 / PR #11143](https://github.com/fabricjs/fabric.js/pull/11143), [Fabric.js #7056 / PR #11150](https://github.com/fabricjs/fabric.js/pull/11150), [Photopea #4051](https://github.com/photopea/photopea/issues/4051), [Fabric.js #7278 / PR #7289](https://github.com/fabricjs/fabric.js/pull/7289), [Fabric.js PR #7470](https://github.com/fabricjs/fabric.js/pull/7470) y [Photopea #5894](https://github.com/photopea/photopea/issues/5894). Se usaron para derivar casos de regresión, no para copiar código propietario ni declarar bugs idénticos sin reproducción.

La búsqueda general de publicaciones/actualizaciones de Adobe, Canva o Picsart no estuvo disponible durante esta ejecución. No se atribuye una solución a esas empresas sin haber podido consultar su artículo correspondiente.

## Aceptación

**PASS:** compilación y CI del SHA auditado.  
**PARTIAL:** aceptación de publicación completa, porque sigue pendiente prueba física de dedo/stylus y memoria/batería en Xiaomi `24116RACCG`. Navegador y emulador no sustituyen esa validación. La incidencia #73 sigue abierta hasta registrar el resultado.
