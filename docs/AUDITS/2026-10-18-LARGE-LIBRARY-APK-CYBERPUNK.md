# AnimeArt · auditoría de estabilidad, importación masiva y APK handoff

**Fecha:** 2026-10-18  
**TIMER:** 3–5 horas estimadas para cambios, revisión y CI; no representa tiempo activo medido. La migración completa de activos a IndexedDB y prueba física quedan fuera de esta ronda.

## Problema informado

La persona tiene cerca de 200 GB de archivos en el teléfono y la app se cierra al abrirla/seleccionar archivos. No hay un logcat ni un volcado de memoria del Xiaomi, así que no se puede atribuir todavía el cierre a una causa única. El código sí muestra un límite arquitectónico relevante: las imágenes se convierten a Data URL y el documento se serializa en localStorage, con límite conservador de 2,5 millones de caracteres. Esto no es un gestor de archivos que indexe 200 GB; el selector SAF del sistema debe enumerar la biblioteca, y AnimeArt solo debe leer los elementos elegidos.

## Cambios en main

- El selector de imágenes procesa como máximo 3 elementos por selección, secuencialmente, y omite antes de decodificar los archivos mayores de 25 MB. Informa cuántos elementos se omitieron. Esto reduce los picos de memoria por selecciones enormes; no aumenta por sí solo la cuota de persistencia.
- Se mantiene el límite de 25 MB por archivo, 8192 px por dimensión, 32 MP y optimización local. Los archivos incompatibles, proyectos demasiado grandes y errores de cuota deben mostrarse al usuario, no convertirse en un supuesto éxito.
- Se profundizó la identidad cyberpunk con cuadrícula neón ligera, paneles violeta, acentos cian/magenta y estados de selección visibles. No se añadieron fondos raster grandes ni dependencias de interfaz.
- Se agregó “Abrir APK con Android”: acción explícita para abrir el selector del sistema y entregar el URI elegido a Package Installer. Android puede exigir que la persona permita instalar aplicaciones desde AnimeArt y siempre conserva la confirmación del sistema. La versión web/PWA no intenta instalar APK.
- La CI comprueba que el APK empaquete el nuevo control, el límite de importación, la configuración de instalación y los estilos.

## Riesgo que sigue abierto

La persistencia de documentos aún incrusta las imágenes en el documento JSON de localStorage. El límite conservador de 2,5 millones de caracteres puede impedir que se guarden muchos recursos grandes en un solo proyecto aunque el teléfono tenga 200 GB libres. La protección de lotes evita intentar decodificar centenares de archivos de golpe, pero no resuelve esta cuota. El arreglo estructural es migrar blobs de imagen a IndexedDB y mantener referencias ligeras en el documento, con migración compatible, recuperación y pruebas de cuota. No se declara implementado en este cambio.

No se ha confirmado la causa exacta del cierre en el Xiaomi: para eso hace falta una reproducción con los archivos concretos o un logcat. Tampoco se afirma haber probado físicamente el flujo de instalación de APK.

## Fuentes técnicas consultables

- Android Storage Access Framework, selección explícita de documentos y URI: https://developer.android.com/training/data-storage/shared/documents-files
- Android bitmap memory usage, dimensiones y riesgo de presión de memoria: https://developer.android.com/topic/performance/issues/bitmap-memory-usage
- Diagnóstico oficial de ANR: https://developer.android.com/topic/performance/issues/anr
- Android Intent ACTION_INSTALL_PACKAGE: https://developer.android.com/reference/android/content/Intent#ACTION_INSTALL_PACKAGE
- Fabric.js #7085 / PR #11143, errores de pincel con zoom y conversión de coordenadas: https://github.com/fabricjs/fabric.js/issues/7085 · https://github.com/fabricjs/fabric.js/pull/11143
- Photopea #4051, reporte de interacción táctil Android: https://github.com/photopea/photopea/issues/4051
- Konva release notes, ejemplo de cambios de rendimiento documentados por mantenedores: https://github.com/konvajs/konva/releases

Los reportes de editores externos se usan como referencias de diagnóstico, no como prueba de que AnimeArt comparta exactamente el mismo bug. La búsqueda general de artículos de producto de Adobe, Canva o Picsart no estuvo disponible en esta ejecución; no se atribuye a esas empresas una solución no verificada.

## Validación exigida

- Web tests y E2E Chromium pasan.
- Android build, lint, pruebas unitarias e instrumentación pasan.
- Verificar dentro del APK que el selector APK y los nuevos estilos están empaquetados.
- Probar en Xiaomi: abrir app con poco espacio, elegir 1, 3 y más de 3 imágenes, seleccionar archivo de más de 25 MB, guardar y recuperar proyecto, abrir APK con el instalador, cancelar y volver a AnimeArt.
- Capturar logcat si la app vuelve a cerrarse. CI/emulador no sustituyen la prueba física.

## Estado

**PARTIAL** hasta confirmar CI del HEAD final y probar en el dispositivo. El límite de lotes es una mitigación; la migración de recursos a IndexedDB es el siguiente cambio estructural necesario para proyectos con muchas imágenes.
