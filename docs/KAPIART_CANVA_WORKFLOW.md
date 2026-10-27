# KapiArt · primera fase del flujo de diseño tipo Canva

## Alcance de esta implementación

Esta fase mejora el trabajo cotidiano sin convertir la interfaz móvil en un escritorio comprimido. Está pensada para KapiArt local-first, con herramientas contextuales y controles cómodos en teléfono.

### Biblioteca de plantillas

- Amplía el catálogo original con plantillas para publicaciones, historias, miniaturas, banners, fondos de pantalla, personajes, manga, novelas, eventos, invitaciones, frases, música, educación y anuncios comunitarios.
- Cada tarjeta sigue usando el catálogo SVG local y las capas de fondo, título y subtítulo editables de KapiArt. El fondo de una plantilla es una capa gráfica independiente, no un documento completo aplanado.
- Las nuevas fichas contienen un formato sugerido: vertical, cuadrado, historia o banner. Al seleccionar una, el formato se selecciona automáticamente, pero la persona puede cambiarlo antes de crear.
- La búsqueda existente filtra nombres, categorías, descripciones y etiquetas; no se descargan recursos remotos.

### Alinear y distribuir capas

- Añade alineación izquierda/centro/derecha y arriba/centro/abajo.
- Con una capa seleccionada, alinea respecto de los bordes o del centro del lienzo. Con varias capas, usa el rectángulo total de la selección.
- Distribución horizontal y vertical exige al menos tres capas.
- Las operaciones conservan escala y rotación, son no destructivas sobre el contenido y se registran en el historial para deshacer/rehacer.
- Las capas bloqueadas se rechazan con un mensaje explícito; no se mueven en silencio.

### Mis diseños

- Guarda una copia editable de cada documento en IndexedDB, independiente del guardado rápido existente.
- Lista los diseños por fecha e incluye dimensiones, número de capas y una miniatura local cuando el navegador puede generarla.
- Permite abrir, duplicar, renombrar y eliminar proyectos.
- La biblioteca tiene un máximo de 40 diseños y se niega a guardar uno nuevo cuando se llena. No elimina automáticamente proyectos antiguos.
- Los proyectos que superan el límite heredado de 2,5 MB para el documento activo no se admiten en esta primera fase: el formato de guardado actual del editor necesita una ampliación específica antes de aceptar proyectos mayores con seguridad.
- Abrir un proyecto pregunta antes de descartar cambios y no sobrescribe el almacenamiento que esté en modo protegido por recuperación.

## Archivos principales

- web/domain/design-alignment.mjs: cálculo geométrico de límites y transformaciones de alineación/distribución.
- web/domain/design-library.mjs: biblioteca local en IndexedDB, operaciones y límites.
- web/domain/creative-catalog.mjs: nuevas plantillas y formatos predeterminados.
- web/app.js, web/index.html, web/styles.css: integración de interfaz, miniaturas, controles y panel de proyectos.
- web/service-worker.js: caché offline v73 con los módulos nuevos.
- web/test/design-alignment.test.mjs, web/test/design-library.test.mjs, web/test/multi-page-project.test.mjs y web/test/creative-catalog.test.mjs: pruebas de dominio y contrato del flujo.

## Aceptación pendiente

La implementación solo se considerará validada tras Web CI, incluyendo E2E de Chromium, y Android CI sobre el mismo SHA. Los tests de dominio no prueban por sí solos las interacciones reales. La aceptación táctil en el Xiaomi 24116RACCG es una etapa separada y no debe inferirse de CI/emulador.

No se ha cambiado main ni se ha fusionado ninguna PR como parte de esta fase.


## Fase multipágina · implementación en la rama de trabajo

La segunda fase añade un gestor local de documentos multipágina, pendiente de validación CI en el SHA final de la rama.

- Crear un proyecto multipágina a partir del lienzo actual y guardar cada página como un documento editable separado.
- Crear páginas en blanco, duplicar, abrir, renombrar, reordenar y eliminar páginas; un proyecto siempre conserva al menos una página.
- Copiar una capa seleccionada a otra página con identificador nuevo, manteniendo su contenido editable y rechazando el resultado si supera los límites.
- Guardar el proyecto y la página activa en IndexedDB. La edición normal también encola la persistencia de la página activa, sin convertir el documento en un bitmap único.
- Límites explícitos para esta primera versión: 10 proyectos multipágina, 10 páginas por proyecto, 200 capas y 2,5 MB serializados por página. No se amplía el límite por página heredado ni se eliminan páginas/proyectos automáticamente para liberar cuota.
- Acceso desde escritorio y desde «Más herramientas» en móvil; la lista y los controles se adaptan a pantallas pequeñas.
- El paquete offline usa `animeart-web-shell-v73`, incluyendo `web/domain/multi-page-project.mjs`.

La prueba de esta fase debe recorrer en Chromium creación, duplicado, copia de capa entre páginas, alta de página, renombrado, reordenación, apertura, guardado y eliminación; Android CI debe comprobar el empaquetado y el arranque offline sobre exactamente el mismo SHA. La aceptación física en el Xiaomi `24116RACCG` permanece separada.


## Fase de tipografía reutilizable · 2026-10-27

- Las capas de texto ahora guardan `letterSpacing` (−8 a 24 px) e `lineHeight` (0,8× a 2,5×). Son valores editables de la capa, no efectos rasterizados.
- El renderizador de lienzo y la exportación PNG/JPEG/WebP comparten el mismo dibujo de texto; usa `CanvasRenderingContext2D.letterSpacing` cuando está disponible y un fallback por grafemas para WebView que no lo admita.
- La estimación de límites para selección/alineación respeta tracking e interlineado, para que las herramientas no calculen la caja como si el texto tuviera el espaciado anterior.
- El modal de texto ofrece controles táctiles para ambos valores y un estante de estilos propios guardados localmente. Se pueden guardar hasta 20 estilos con nombre, aplicar a otra capa y eliminar; un estilo reutilizable solo contiene propiedades tipográficas, por lo que no reemplaza el texto, la posición ni la transformación del objeto destino.
- Los estilos propios se guardan en localStorage del perfil/dispositivo; no se sincronizan entre equipos ni incluyen archivos de fuentes externos.
- Los campos nuevos son compatibles hacia atrás: documentos anteriores sin `letterSpacing` o `lineHeight` siguen siendo válidos y se normalizan a 0 px y 1,2×.
- Caché offline actualizada a `animeart-web-shell-v74`; pruebas de dominio y Chromium E2E cubren normalización, límites, recuperación de estilos y cambio de tracking/interlineado.
- La aceptación de esta fase exige Web CI y Android CI sobre un mismo SHA final; la aceptación física en el Xiaomi `24116RACCG` continúa separada.
