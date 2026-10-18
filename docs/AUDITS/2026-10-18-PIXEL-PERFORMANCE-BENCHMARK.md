# AA-PIXEL-PERF-002: rendimiento local de operaciones raster

**TIMER:** 3–5 horas estimadas para optimización, benchmark automatizado y análisis; tiempo activo real no medido.

## Hipótesis confirmadas por inspección estática

1. El reemplazo selectivo de color generaba varias matrices temporales por píxel (original, HSL y conversión RGB), con millones de objetos efímeros en imágenes grandes.
2. El flood fill de quitar fondo generaba una matriz de vecinos por cada píxel visitado. En fondos conectados de gran tamaño, ese patrón crea gran presión de asignación y GC.
3. El Worker mantiene el hilo de interfaz más libre, pero los buffers, la cola y el mapa de visitados siguen ocupando memoria del mismo proceso/dispositivo.

## Cambios

- Reutilizar matrices HSL/RGB de scratch durante una llamada de reemplazo de color. La matemática del color y la preservación del sombreado se mantienen.
- Visitar los cuatro vecinos del flood fill sin construir un array por píxel. La conectividad, el límite por cambios de color, el feather y la transparencia se mantienen.
- Añadir npm run benchmark:image-processing. La suite lanza cada escenario en un proceso Node separado para que maxRSS por operación no mezcle picos de iteraciones previas.
- Añadir al Web CI 9 escenarios: 4, 8 y 16 MP para reemplazo de color, quitar fondo conectado y borrado manual. La prueba verifica el resultado de píxeles y registra milisegundos de pared/CPU, RSS pico y memoria externa.
- No aplicar umbrales rígidos de velocidad en CI: el tiempo varía con la máquina y no es prueba de rendimiento físico Android.

## Qué no demuestra

- No mide consumo de batería, GPU o jank real de WebView en el Xiaomi 24116RACCG.
- No mide el proceso Android completo con decodificación, Canvas, caché de imágenes, historial y vista previa.
- El escenario de borrado manual mide el coste de memoria del buffer y un trazo representativo, no un borrado largo que cubra millones de píxeles.
- A 16 MP, un RGBA ocupa aproximadamente 64 MiB; el flood fill además reserva un mapa de visitados y una cola de enteros que puede aproximarse a 64 MiB. Hay que observar el resultado real del benchmark y repetir una prueba física antes de decidir una sustitución más radical por un flood fill scanline.

## Fuentes técnicas públicas conocidas

- [Fabric.js #7085](https://github.com/fabricjs/fabric.js/issues/7085) y [PR #11143](https://github.com/fabricjs/fabric.js/pull/11143): transformaciones de coordenadas de pincel con zoom.
- [Photopea #4051](https://github.com/photopea/photopea/issues/4051): incidencias y corrección documentada de una ruta táctil concreta en Android.
- [Fabric.js #7278](https://github.com/fabricjs/fabric.js/issues/7278) y [PR #7289](https://github.com/fabricjs/fabric.js/pull/7289): separar el fondo de contenido borrable.
- [Fabric.js PR #7470](https://github.com/fabricjs/fabric.js/pull/7470): enfoque de máscaras para borrado.

Estas fuentes orientan pruebas y arquitectura; no se usan como evidencia de un error idéntico en AnimeArt. La búsqueda en vivo de blogs de Adobe/Canva/Picsart no se ha realizado en esta ejecución.

## Criterio de aceptación

- Web tests + Chromium E2E + los nueve benchmarks pasan.
- Android CI prueba la APK empaquetada desde el mismo SHA que el benchmark.
- Prueba física en Xiaomi importando, editando y exportando imágenes de 4/8/16 MP, verificando memoria, batería, fluidez y recuperación ante cancelaciones.
- Los issues [#73](https://github.com/jonhararagi/animeart/issues/73) y [#86](https://github.com/jonhararagi/animeart/issues/86) permanecen abiertos hasta la prueba física. No declarar aceptación física por los resultados de CI.
