# LEY DEL EDITOR MÓVIL DE ANIMEART

**Estado:** REGLA OBLIGATORIA DEL PRODUCTO  
**Aplica a:** toda pantalla móvil del editor, APK/WebView y PWA.  
**Referencia de diseño aprobada por el usuario:** el mockup de cinco pantallas de estilo Picsart mostrado en la conversación del 16 de octubre de 2026. Se adopta la estructura de interacción, no su código, marca ni recursos propietarios.

## Ley visual y de interacción

1. **El lienzo manda.** Al entrar al editor, la imagen de trabajo debe ser el elemento central, grande, centrado y con su proporción preservada. No debe quedar reducida por paneles de herramientas permanentes.
2. **La franja superior es mínima.** Solo navegación/identidad compacta y acciones universales imprescindibles como deshacer, rehacer y exportar. Apariencia, fondo, transparencia, zoom, capas y controles avanzados no viven permanentemente arriba.
3. **La barra principal vive abajo.** Acciones reconocibles, con icono y etiqueta, objetivos táctiles grandes y respetando las áreas seguras del teléfono. Debe poder usarse con una mano y no quedar tapada por las barras del sistema.
4. **Cada acción abre su panel contextual.** Al tocar Texto, Recortar, Dibujar, Efectos, Pegatinas/elementos, Capas u otra herramienta, las opciones de esa tarea aparecen en un panel inferior o diálogo dedicado. No se despliega todo el escritorio en miniatura ni se apilan controles sobre el lienzo. Se cierra o minimiza el panel para recuperar espacio.
5. **La imagen nunca queda atrapada.** Los paneles no interceptan gestos del lienzo cuando están cerrados; los controles flotantes no tapan el contenido ni salen de pantalla. Tocar una herramienta no debe iniciar un trazo, mover una capa ni activar otra acción accidentalmente.
6. **Añadir imagen es una acción primaria.** Siempre debe resultar obvio cómo abrir el selector del dispositivo. La imagen importada se agrega como capa, se centra/encaja conservando su proporción y queda seleccionada. Las imágenes adicionales siguen el mismo flujo.
7. **Los objetos siempre son recuperables.** Texto, pegatinas, imágenes y trazos deben poder seleccionarse, mover/redimensionar cuando corresponda, aplicar/confirmar, eliminar y deshacer/rehacer. Ningún objeto puede quedar flotando sin una salida visible.
8. **Prioridad móvil real.** Diseñar primero para pantallas de teléfono, incluida la Xiaomi 24116RACCG; no comprimir la interfaz de escritorio ni asumir que una prueba en emulador equivale a validar el teléfono físico.
9. **Sin regresiones silenciosas.** Incorporar pruebas de estructura, interacción táctil, importación real, panel contextual, edición de varias capas, undo/redo y exportación. Informar explícitamente qué pasó en CI/emulador y qué falta comprobar físicamente.

## Criterio de terminado

Se considera incumplido mientras el lienzo sea pequeño, la franja superior esté saturada, los controles se superpongan, la selección/importación falle o una herramienta clave no ofrezca un panel claro. CI verde por sí sola no equivale a aceptación.

**Regla de implementación:** continuar sobre la rama autorizada activa `aa-mobile-redesign-004` y PR #85. No modificar `main` directamente, no crear ramas/PR duplicadas, no fusionar ni cerrar el PR sin autorización expresa y no declarar realizada la prueba física sin evidencia.

## Ventanas de estilo y objetos: se permiten y se recomiendan

No se debe evitar una ventana contextual solo por miedo a ocupar espacio. El lienzo sigue siendo el centro, pero las herramientas de edición ricas deben estar disponibles en ventanas modales pequeñas, cómodas de cerrar con una X, Cancelar o Escape.

- El objeto seleccionado debe tener una entrada clara a **Estilo**. El contenido depende de su tipo: texto abre tipografía, color, contorno y sombra; imagen ofrece recorte por forma, opacidad, ajustes de color y recoloración; los trazos permiten modificar su color, grosor y efecto.
- **Formas** es una herramienta accesible desde las tareas principales. Debe ofrecer figuras útiles (círculo, rectángulo, estrella, corazón, hexágono, triángulo, globo, rayo, nube), relleno, contorno, tamaño y sombra.
- Las ventanas aplican cambios solo al confirmar. Cancelar, la X o Escape cierran sin aplicar modificaciones pendientes. Las operaciones confirmadas deben quedar en el historial y guardarse como parte del proyecto.
- Las ventanas deben ser compactas, adaptarse al teléfono y no quitar al usuario el lienzo una vez cerradas. No se acepta una interfaz reducida a unos pocos botones por temor a agregar paneles útiles.


## AA-MOBILE-TOP-SAFE-002 · selección simple y zona superior despejada

En teléfonos, la franja superior que puede quedar debajo del recorte del sistema debe permanecer libre de controles del editor. La barra de herramientas, las acciones contextuales y las acciones frecuentes se ubican abajo, respetando la zona segura inferior y manteniendo el lienzo como protagonista.

- Un objeto seleccionado presenta un marco claro, una **X en la esquina superior derecha** y un **tirador de redimensionado en la esquina inferior derecha**.
- La X cierra la selección, pero **no elimina el objeto**. Eliminar sigue siendo una acción separada, con posibilidad de deshacer.
- El tirador inferior cambia el tamaño mediante gesto táctil. Se retiran los cuatro manejadores pequeños y el mando de rotación superior para reducir los puntos que el usuario debe acertar.
- Rotar sigue disponible como herramienta explícita. Los elementos PNG, imágenes y formas conservan su selección, movimiento, orden de capas y bloqueo.
- La barra inferior ofrece Exportar junto con Añadir, Galería, Mover, Dibujar, Texto, Deshacer, Rehacer, Eliminar, Capas y Más.
- Las pruebas deben cubrir las zonas seguras, el acierto de ambos manejadores y la accesibilidad de Exportar desde el dock. La comprobación de CI no se confunde con una prueba física en el Xiaomi 24116RACCG.

**Criterio de aceptación:** el área superior táctil queda libre, ambos manejadores realizan acciones distintas y previsibles, cerrar no borra contenido y el código actualizado invalida la caché de la PWA para evitar que el teléfono siga cargando la interfaz anterior.


## Controles reversibles, movimiento libre y lienzo limpio

- Toda herramienta o modo temporal debe mostrar una salida clara: **Cancelar**, **Cerrar (X)**, **Volver** o **Escape**, según corresponda. Cancelar descarta únicamente la previsualización o los cambios aún no confirmados; nunca debe dejar un gesto activo ni una guía residual.
- Las operaciones ya confirmadas se revierten con **Deshacer** y pueden recuperarse con **Rehacer**. No se deben descartar cambios confirmados al cerrar paneles ni al ocultar controles.
- El ajuste magnético tiene un botón visible con símbolo de imán y estado accesible. Activado alinea y muestra guías; apagado permite mover libremente, sin corrección ni guías. El estado del modo no crea operaciones en el historial.
- En teléfono, los controles de uso frecuente deben medir al menos **48 × 48 CSS px** (nunca menos de 46 px), con separación suficiente para evitar toques accidentales.
- La bandeja de herramientas debe poder ocultarse para inspeccionar el arte y restaurarse con un control persistente y accesible. Ocultar/mostrar controles no altera el documento, selección, zoom ni historial.
- El lienzo tiene prioridad visual. Los controles pueden desaparecer temporalmente, pero la acción para recuperarlos debe seguir visible y operable.
