# AA-EDITOR-TOOLS-AUDIT-001 · Auditoría funcional de herramientas de AnimeArt

**Fecha:** 2026-10-17  
**Rama:** `aa-free-move-preview-001`  
**Base auditada:** `282b3e41b1b90a86e3fdca67416939024a882ad6`  
**TIMER:** 2–4 horas estimadas para auditar, corregir, añadir pruebas y validar; el tiempo real no se midió.

## Resumen por herramienta

| Herramienta | Evidencia del código anterior | Mejora aplicada en esta iteración |
|---|---|---|
| **Dibujar en capa** | El motor de pincel crea trazos editables en una capa de dibujo, pero el botón principal del dock móvil llamado “Pintar” abría el estudio raster por imagen, que requiere una imagen seleccionada. | El dock ahora activa el pincel de capas y funciona sobre el lienzo vacío. Se añadió E2E móvil que dibuja, verifica el trazo almacenado y lo deshace. |
| **Pintar píxeles** | Existía el estudio raster por imagen con vista previa, deshacer, Aplicar y Cancelar. Su alcance requiere una imagen desbloqueada. | Se conserva como herramienta separada llamada “Pintar píxeles”, no se confunde con dibujar trazos independientes. |
| **Borrar con pincel** | Borra píxeles de una imagen o trazos de la capa de dibujo según el tipo de capa. Para imágenes, el raster se actualiza al soltar. | Se distingue de “Borrar píxeles” y se dibuja una ruta de previsualización de alto contraste durante el gesto y mientras se procesa el raster. |
| **Restaurar** | Utiliza `restoreSource`, normalmente creada tras Borrado mágico. Si el tamaño original y el actual no son compatibles, la restauración por pincel se rechaza y se conserva la posibilidad de Deshacer. | Muestra también la trayectoria del pincel Restaurar y limpia la vista previa tras confirmar, cancelar o fallar. |
| **Borrado mágico** | Borra una región conectada a la muestra de color y utiliza un estudio de comparación antes de aplicar. Conserva la distinción entre previsualización y mutación. | Se conserva el alcance localizado, el estado cancelable y la retroalimentación en español. |
| **Quitar fondo** | `removeConnectedBackground` es un algoritmo local basado en color y conectividad, con tolerancia, suavizado, sensibilidad de bordes, protección de línea, limpieza de halos y borrado manual. Es útil para fondos lisos; no es segmentación semántica por IA. | Se mantienen controles, perfiles locales, previsualización y Aplicar; se traducen acciones de perfil y errores principales. |
| **Recortar imagen** | El estudio modifica los píxeles de una sola capa con vista previa y mantiene por separado su transformación visual. | Se conserva como operación distinta del recorte de composición. |
| **Recortar composición** | El estudio de composición muestra todas las capas y cambia el marco del documento conservando la estructura editable. | Se conserva la ruta independiente, usando el mismo modelo de documento y el mismo historial. |
| **Capas superpuestas** | La lista soportaba seleccionar, mostrar/ocultar, bloquear, opacidad, renombrar, duplicar, eliminar, convertir imagen/referencia y subir/bajar. Varios nombres eran ingleses y seis botones comprimidos tenían objetivos pequeños. | Nombres y ayudas accesibles en español; los controles de visibilidad/bloqueo y el deslizador tienen área táctil de 44 px o más. La fila de acciones se desplaza horizontalmente en móvil para no comprimir botones. |
| **Texto y formas** | El texto permanece como capa editable con estudio de tipografía, contorno y sombra. Formas crea capas editables. | Se mantiene la arquitectura de capas compartida, en lugar de crear otro editor paralelo. |
| **Apariencia, color y máscaras** | Opacidad, ajustes, máscaras no destructivas y reemplazo de color están en los módulos de capa y tienen operaciones registradas para Deshacer. | Se preserva la separación entre ajustes no destructivos y operaciones raster que cambian los píxeles originales. |
| **Biblioteca e importación** | La biblioteca local usa almacenamiento del dispositivo; las imágenes importadas se convierten en capas y se pueden reutilizar. | Se mantiene el flujo local y la caché PWA se actualiza a v38 para evitar que el móvil siga usando el shell anterior. |
| **Exportación** | El raster de salida usa las dimensiones del documento y no debe expandirse por objetos que quedan fuera del marco en el espacio de trabajo. | Se preserva el exportador canónico y la separación entre vista previa y archivo final. |

## Pruebas asociadas

- `web/test/background-removal.test.mjs`: alfa, color conectado, tolerancia, feather y borrado manual.
- `web/test/image-editing.test.mjs`: recorte/redimensionamiento y transformación de la capa.
- `web/test/guided-editing.test.mjs`: herramientas guiadas, capas de pintura, borrado y estudios modales.
- `web/test/multilayer-transform.test.mjs`: transformaciones y selección de múltiples capas.
- `web/test/image-export.test.mjs` y `web/domain/png-export.mjs`: dimensiones y exportación.
- `web/scripts/browser-e2e.mjs`: flujo móvil de importación PNG, recorte, fondo, texto, formas, pintar píxeles, dibujo en lienzo vacío, borrado con vista previa y deshacer.

Esta iteración agrega E2E para:
1. Dibujar desde el dock móvil en un lienzo vacío y deshacer el trazo.
2. Verificar mediante diagnóstico de Chromium y lectura de píxeles que el borrador principal aparece antes de mutar la imagen.
3. Confirmar que el borrado se puede deshacer y que el estudio de pintura por píxeles permanece separado.

## Límites y aceptación pendiente

- Quitar fondo detecta color conectado; no debe presentarse como una IA semántica para recortes complejos de personas o cabello.
- Restaurar requiere una copia original válida y dimensiones compatibles.
- Chromium y emulador no reemplazan la prueba física en el Xiaomi `24116RACCG`, especialmente arrastre con dedo, recuperación del objeto y aceptación del overlay.
- La caché PWA se cambia de v37 a v38.

### Cierre de validación funcional (2026-10-17)

**SHA de código y E2E validado:** `6cb21972b26e626613148e24a61899a4297f1dd6`.

- **Web CI PASS:** [run #39055005733](https://github.com/jonhararagi/animeart/actions/runs/39055005733). Build, unit tests, Chromium E2E y capturas terminados correctamente.
- **Android CI PASS:** [run #39055005730](https://github.com/jonhararagi/animeart/actions/runs/39055005730). Build, verificación del editor empaquetado, unit tests, lint, instrumentación y arranque offline completados.
- **Panel móvil Dibujar:** Chromium confirma que la bandeja aparece sobre el muelle sin tapar la superficie táctil del lienzo. Un gesto real deja un trazo en una capa de dibujo y Deshacer lo elimina.
- **Capas en teléfono:** E2E confirma que visibilidad, bloqueo y acciones de ciclo de vida alcanzan al menos `44×44` píxeles CSS. Bajar/Subir modifica el índice de apilado real y vuelve a dejar la capa en su posición original.
- El resto de pruebas del editor continúa pasando: recorte de imagen y composición, borrado mágico cancelable, quitar fondo con previsualización, borrado/restauración, texto/forma, transformaciones, transparencia y exportación con dimensiones exactas.
- **APK del SHA validado:** [artefacto Android #12109296539](https://github.com/jonhararagi/animeart/actions/runs/39055005730/artifacts/12109296539). Tamaño aproximado: 10,1 MB. **SHA-256 del archivo APK:** `fce11d1d56d20134350c72cebe0f4353aa72233ec5e38d31c05d4330373621d4`.
- La siguiente modificación que actualiza esta auditoría y continuidad es **solo documental**; no cambia el código ni las pruebas que pasaron en `6cb2197...`. GitHub Actions también ejecutará las comprobaciones sobre el HEAD que incluya este registro.

### Límites sin ocultar

- Quitar fondo es eliminación local por conectividad y color: da mejores resultados con fondos lisos. No se presenta como segmentación semántica por IA.
- Restaurar necesita una copia de píxeles original válida con dimensiones compatibles.
- La aceptación táctil física en el Xiaomi `24116RACCG` continúa pendiente. Emulador y Chromium no se cuentan como prueba física.
- La búsqueda externa de blogs o documentación interna pública de Canva/Picsart no se hizo en vivo en esta sesión; no se citan artículos inexistentes ni se atribuye a esos productos un algoritmo concreto.

**Integración:** PR #89 sigue abierto. `main` no se modificó ni fusionó.
