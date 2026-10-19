# AnimeArt · matriz interna de referentes de edición
**Fecha:** 2026-10-19  
**Estado:** PARTIAL · comparación funcional orientativa; verificación externa de versiones actuales pendiente  
**TIMER:** 2–3 h estimadas para convertir esta matriz en investigación comparativa documentada; no es tiempo medido.

## Alcance y honestidad de las fuentes

Esta matriz convierte los cinco referentes en prioridades de producto y pruebas para AnimeArt. No afirma que AnimeArt supere a estos productos ni atribuye a una versión actual una función, defecto o reparación concreta sin una verificación de su documentación. En esta sesión no estuvo disponible la búsqueda web en vivo, por lo que **no se pudo comprobar la documentación oficial más reciente, las últimas notas de versión ni los reportes públicos actuales**. Los puntos sobre AnimeArt sí se contrastaron con el README y el código de `main`; las incidencias técnicas de proyectos externos se toman únicamente de la auditoría ya existente [2026-10-17-EXTERNAL-EDITOR-BUG-RESEARCH.md](./2026-10-17-EXTERNAL-EDITOR-BUG-RESEARCH.md).

Entradas oficiales para realizar la verificación de seguimiento, no presentadas aquí como páginas consultadas ni como prueba de funciones actuales:
- Adobe Photoshop: https://helpx.adobe.com/photoshop/user-guide.html
- Canva: https://www.canva.com/help/
- Picsart: https://support.picsart.com/
- Procreate: https://help.procreate.com/procreate/handbook
- ibis Paint X: https://ibispaint.com/

Antes de implementar una función basada en una versión concreta, registrar la página consultada, su fecha, la plataforma/version que describe y, cuando corresponda, el Issue/PR que prueba la incidencia. Las opiniones de usuarios deben tratarse como señales para investigar, no como confirmación de causa.

## Comparación orientada a decisiones

| Referente | Fortalezas que vale la pena estudiar | Dificultades que AnimeArt debe evitar | Estado de AnimeArt contrastado con el repositorio | Brecha prioritaria y coste orientativo |
|---|---|---|---|---|
| **Adobe Photoshop** | Capas y orden explícito; máscaras; selección precisa; ajustes; composición y control no destructivo. | Demasiados pasos o controles técnicos para tareas frecuentes en una pantalla pequeña; operaciones de píxel que gasten memoria. No se atribuye aquí un defecto específico a una versión actual. | AnimeArt ya tiene capas, transformaciones, opacidad, máscaras, ajustes de imagen, historial y exportación PNG/JPEG/WebP según el README. | **P1:** probar que selección, bloqueo, máscaras, historial y exportación se mantienen coherentes. Coste medio; impacto alto si falla. No construir un clon completo de Photoshop. |
| **Canva** | Edición directa; jerarquía de título/subtítulo/cuerpo; composición rápida; plantillas, portadas y formatos sociales. | Paneles que tapan el lienzo, cambios de contexto que pierden contenido o texto rasterizado antes de tiempo. | AnimeArt ya tiene textos editables, estilos tipográficos y un estudio local con portadas, palabras, stickers y composiciones por capas. | **P1:** crear, tocar, mover, reabrir, editar y guardar texto repetidamente en viewport móvil; comparar pasos con una tarea equivalente. Coste bajo/medio; impacto alto. |
| **Picsart** | Flujo móvil para importar, recortar, colocar stickers, combinar imágenes y quitar fondos. | Importación que queda pendiente al cancelar; capas invisibles; gestos que mueven el viewport en lugar del objeto; herramientas que bloquean el lienzo. | AnimeArt ya importa capas de imagen, hace recortes por forma, mantiene alfa, ofrece eliminación local de fondo y controles móviles. El 2026-10-19 se añadió tratamiento de cancelación de FileReader en `image-import.mjs`. | **P0/P1:** validar importación, selección, arrastre, transformación, cancelación y exportación en la misma sesión. Coste bajo para cancelación, medio/alto para gestos complejos; impacto muy alto. |
| **Procreate** | Pinceles configurables, capas de pintura, navegación del lienzo y flujo de dibujo centrado en el arte. | Trazos con retraso; zoom/pan confundido con dibujo; borrador que pinta color en vez de alfa; historial costoso. | AnimeArt ya tiene pincel configurable, borrador alfa, capas de dibujo, aerógrafo, brillo/neón, undo/redo y procesamiento local en Worker para algunas operaciones de píxeles. | **P1:** probar trazo a varios niveles de zoom, borrado alfa, cancelación del gesto e historial; medir latencia y memoria en imágenes grandes. Coste medio/alto; beneficio alto para ilustración. Presión avanzada no es requisito del MVP. |
| **ibis Paint X** | Dibujo orientado a anime/manga, control de línea, capas y recursos de ilustración. | Intentar añadir muchas herramientas antes de estabilizar coordenadas, capas y guardado. | AnimeArt incluye dibujo, recoloreado que conserva sombreado/alfa, retirada local de fondos, stickers/portadas originales y capas editables. | **P1/P2:** estabilizar trazos y coloreado primero; evaluar estabilización de línea, reglas, relleno y selección después, cada uno con test independiente. Coste medio/alto; el relleno y reglas necesitan análisis de memoria y UX. |

**Cómo leer la columna de dificultades:** son riesgos de diseño y pruebas que AnimeArt debe controlar; no son afirmaciones de bugs confirmados en las versiones actuales de los productos referentes.

## Tabla de aceptación para comparaciones justas

Para cada tarea equivalente y en el mismo dispositivo o viewport, anotar: pasos desde la pantalla inicial; tiempo hasta completar; éxito sin ayuda; número de gestos erróneos; precisión del resultado; tamaño/dimensiones y alfa exportados; tiempo de respuesta; memoria pico cuando sea medible; y recuperación con Deshacer. Registrar versiones, dispositivo, tamaño del lienzo, imagen usada y evidencia de pantalla. No comparar funciones que el otro producto no ofrezca en la plataforma probada.

Tareas recomendadas:
1. Importar una imagen PNG transparente, seleccionarla, moverla, escalarla, rotarla y reordenarla.
2. Añadir un título, editar su contenido/estilo, moverlo y reabrir su editor.
3. Dibujar una línea, deshacerla, borrar una parte con alfa y exportar PNG.
4. Recortar una imagen en círculo, cambiar el fondo sin perder objetos y comprobar el alfa de las esquinas.
5. Cancelar una importación; la interfaz debe terminar la operación con un mensaje y no dejar una promesa ni indicador de carga pendiente.
6. Mover una capa fuera de los bordes del documento, recuperarla con su control visible y comprobar que la exportación conserva exactamente las dimensiones del documento.

## Orden de trabajo sugerido

1. **P0 Estabilidad:** importación/cancelación, pérdida de contenido, guardado, bloqueos y exportación vacía.
2. **P1 Edición fiable:** transformaciones, selección táctil, capas, texto, borrado alfa, undo/redo y transparencia.
3. **P1 Flujo creativo:** importación de stickers propios, composición de textos/imágenes/ilustración y portadas originales.
4. **P2 Dibujo avanzado:** estabilización, reglas, relleno y herramientas de selección, solo con pruebas de latencia/memoria.
5. **P2 Escalabilidad:** estudiar el paso de fuentes de imagen embebidas en JSON/localStorage a Blob/IndexedDB con migración segura. La nota actual de continuidad indica que la cuota local todavía limita proyectos grandes; reducir lotes no elimina ese límite.

## Incidencias técnicas externas ya registradas en el repositorio

La auditoría existente documenta referencias públicas de Fabric.js y Photopea sobre coordenadas con zoom/pan, cambios al confirmar trazos, interacción táctil Android, separación entre fondo y objetos borrables, y máscaras de borrador. Se usan como inspiración para pruebas, no como evidencia automática de un defecto idéntico en AnimeArt. Véase [la auditoría con referencias y límites](./2026-10-17-EXTERNAL-EDITOR-BUG-RESEARCH.md).

## Siguiente paso de investigación

Cuando la consulta web esté disponible, actualizar esta matriz con fuentes oficiales realmente consultadas y fecha de acceso; revisar las últimas notas de versión e incidencias públicas que puedan reproducirse; anotar versión y plataforma; y sustituir cada hipótesis por **confirmado**, **no reproducido** o **no aplicable**. Hasta entonces, no usar esta matriz para publicitar superioridad ni para afirmar que se completó el estudio de versiones actuales.
