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


## Fase de biblioteca visual de elementos · 2026-10-28

- Añade `web/domain/element-library.mjs` con 16 recursos SVG originales, construidos localmente y sin imágenes remotas: tres globos de diálogo, cartela de narración, marcos neón y manga, trama de semitono, pétalos sakura, destellos, cinta decorativa, flecha luminosa, líneas cinéticas, gota de anime, rubor kawaii, estrella de cómic y nube kawaii.
- El estudio creativo incorpora la pestaña **Elementos**. Búsqueda y filtro por colección se aplican al catálogo; las colecciones separan globos, manga, marcos, texturas, flores, brillos, decoración, formas/flechas y reacciones kawaii.
- Cada ficha se inserta como su propia capa de imagen SVG local. No se aplana con el fondo ni con otras capas; se mantiene la edición existente de posición, tamaño, rotación, ocultación y borrado.
- Cada ficha tiene una estrella para guardarla o quitarla de favoritos. La selección de favoritos se persiste en localStorage del dispositivo; el filtro «Solo favoritos» se combina con la búsqueda y la colección.
- Se añaden pruebas de catálogo para IDs únicos, SVG sin recursos remotos, búsqueda insensible a acentos y colecciones, además de una secuencia Chromium para filtrar globos, guardar un favorito, aplicar el filtro y crear la capa en el documento.
- El shell offline pasa a `animeart-web-shell-v76`; el módulo nuevo se añade a la shell y al listado explícito de recursos requeridos, y Android CI comprueba su empaquetado y los controles de interfaz.

Pendiente de aceptación final: Web CI debe completar el build/tests/benchmark/E2E y Android CI debe confirmar build, instrumentación y arranque offline en el mismo SHA. La prueba física en el Xiaomi `24116RACCG` sigue siendo independiente. La gestión de carpetas propias para elementos y la importación de tipografías externas quedan para fases posteriores; esta fase añade filtros de colección y favoritos, no un sistema de carpetas personalizadas.


## Exportación local de proyectos multipágina a PDF · 2026-10-28

- Añade `web/domain/pdf-export.mjs`, un generador PDF sin dependencias externas. Crea objetos PDF, imágenes JPEG por página, tabla xref y trailer, con dimensiones independientes por página.
- El control **Exportar todas las páginas a PDF** del gestor procesa el proyecto entero en orden, guarda primero la página activa y carga cada página editable desde IndexedDB.
- El render no altera los documentos ni aplana su almacenamiento: genera una imagen por página solo en la exportación, con fondo blanco para salida PDF estándar. Tracking/interlineado y estilos de texto se renderizan a través de la misma función del editor, y el estado transitorio de previsualización no contamina la salida.
- Seguridad para móviles: máximo 10 páginas, 16 megapíxeles por imagen rasterizada, 48 megapíxeles acumulados por exportación y 45 MB para el PDF final. Se muestra el progreso por página, se reportan imágenes que no se pueden cargar y se mantiene el proyecto editable.
- El PDF usa una resolución común que se reduce si el total excede el presupuesto de memoria; cada página conserva su proporción y su tamaño físico relativo en el PDF.
- Se actualiza el shell offline a `animeart-web-shell-v76`, se incluye `web/domain/pdf-export.mjs` en recursos requeridos y se agregan pruebas unitarias del formato y E2E de exportación desde Chromium.
- Aceptación pendiente de esta fase: Web CI y Android CI deben pasar sobre el mismo HEAD exacto, y debe existir artefacto APK de esa revisión. La prueba física en el Xiaomi `24116RACCG` sigue separada.


## Fase de agrupación persistente de capas · 2026-10-29

Esta fase añade agrupación/desagrupación real al modelo de capas existente:

- El campo `groupId` se normaliza y valida en el modelo. Los documentos antiguos sin el campo siguen siendo válidos.
- Agrupar requiere al menos dos capas desbloqueadas. Los fondos fijos y las selecciones incompletas se rechazan.
- Los miembros conservan sus tipos, contenido, transformaciones e identificadores individuales; no se crea una imagen aplanada. Mover, escalar y rotar usa la selección múltiple existente.
- Seleccionar un miembro selecciona el grupo completo. **Desagrupar** elimina la membresía y devuelve la edición independiente.
- Duplicar una sola capa no la añade accidentalmente al grupo original. Si se elimina un miembro y queda solo uno, el grupo restante se disuelve para no mantener grupos inválidos.
- La UI ofrece controles táctiles en el panel Capas y etiqueta los miembros con `[Grupo]`. La acción entra en el historial normal de undo/redo.
- Hay pruebas de dominio y E2E Chromium para persistencia tras normalización, capas bloqueadas, duplicación, selección conjunta, agrupación y desagrupación. El shell offline se actualizó a `animeart-web-shell-v77` y Android CI comprueba el panel y el test dedicado.

### Validación final

- Web CI PASS #1445: https://github.com/jonhararagi/animeart/actions/runs/40843352467 (469/469 tests, E2E real Chromium PASS).
- Android CI PASS #1544: https://github.com/jonhararagi/animeart/actions/runs/40843352526 (build, assets del APK, tests, lint, instrumentación y startup smoke PASS).
- Código integrado en `main` por PR #124, squash `2a2847be9f05e5ba35caf09fe5bde0e7fdb52e91`.
- APK y checksum sidecar: https://github.com/jonhararagi/animeart/actions/runs/40843352526/artifacts/12883264410 (v0.3.7, versionCode 10).
- La validación física en Xiaomi `24116RACCG` sigue pendiente.

## Complemento de expresiones anime · 2026-10-29

Se incorpora a esta rama el trabajo funcional de la PR #123 para no dejar el compositor de personajes en una rama paralela:

- Cuatro expresiones SVG originales con estructura diferenciada: sonrisa suave, sonrisa abierta con dientes, sonrisa ladeada y sorpresa.
- El filtro **Expresión** del catálogo permite encontrarlas por nombre o búsqueda.
- El personaje mantiene cabello base, rostro, flequillo y ojos como capas editables, y añade la expresión como quinta capa independiente. La sonrisa suave se usa por defecto cuando no se selecciona una variante.
- Los conjuntos de personaje guardan el identificador de expresión; los conjuntos anteriores sin ese campo siguen siendo válidos.
- Se amplían las pruebas de metadatos, selección, catálogo y composición; Android CI comprueba que la biblioteca SVG que contiene las expresiones se haya empaquetado.
- Se conserva la versión de caché offline v77: no se retrocede la caché por traer cambios de la antigua rama de expresiones.

El complemento de expresiones anime de la PR #123 está integrado en `main` dentro de la PR #124 y la PR #123 se cerró para evitar una rama complementaria redundante. El E2E real de Chromium verificó la creación de cinco capas editables y undo/redo. Web CI #1445 y Android CI #1544 finalizaron en PASS; el APK v0.3.7 con checksum está publicado en https://github.com/jonhararagi/animeart/actions/runs/40843352526/artifacts/12883264410. La aceptación física en el Xiaomi 24116RACCG sigue siendo independiente y pendiente.

## Fase de redimensionado inteligente del lienzo · 2026-10-29

Esta fase añade una herramienta para adaptar una composición ya creada a otro formato sin convertir el documento en una imagen única.

- **Ajustar todo (`fit`)** escala la composición uniformemente hasta encajarla en el nuevo formato.
- **Cubrir el lienzo (`fill`)** escala los objetos uniformemente para cubrir el marco; las capas siguen siendo editables, incluido el contenido que queda fuera del área visible.
- **Cambiar solo el marco (`reframe`)** modifica las dimensiones del lienzo sin escalar el tamaño de los objetos.
- Conserva las identidades y el orden de capas, texto editable, fuentes de imagen, máscaras, ajustes, grupos, visibilidad, opacidad y rotaciones. La operación se registra en el historial para que **Deshacer** recupere el formato anterior.
- Ofrece tamaños sugeridos para post cuadrado (1080 × 1080), post vertical (1080 × 1350), historia/short (1080 × 1920), vídeo horizontal (1920 × 1080), wallpaper móvil (1440 × 3200) y A4 (2480 × 3508), más dimensiones personalizadas.
- La interfaz tiene lanzadores tanto en la barra de escritorio como en «Más herramientas» en móvil, mantiene botones y controles numéricos táctiles, y comunica los errores dentro del cuadro de diálogo.
- Límites preventivos: 8192 px por lado y 40 megapíxeles por lienzo. No se elevan los límites heredados del archivo JSON del proyecto; si la serialización supera el tamaño permitido, la exportación de proyecto sigue aplicando su protección actual.
- La operación no usa APIs remotas ni consume servicios de IA. El módulo se incorpora al Service Worker y el shell offline sube a v78.

### Validación exigida antes de integrar

- Web CI: `npm run build`, todas las pruebas Node, benchmark y E2E real de Chromium, incluido cambio de formato y Deshacer.
- Android CI: empaquetado del módulo y los controles, tests/lint/instrumentación y smoke de arranque sin conexión sobre el mismo SHA.
- La prueba física en Xiaomi `24116RACCG` sigue siendo una aceptación separada; los tests de Chromium/emulador no la sustituyen.

Estado al redactar esta sección: cambios preparados en `feature/kapiart-smart-resize-001`; pendiente ejecutar CI sobre el HEAD final. `main` no se modifica directamente.
