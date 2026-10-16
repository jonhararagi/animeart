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

**Regla de implementación:** los cambios deben continuar en la rama de trabajo ya autorizada `aa-editor-ux-002` y su PR #83. No modificar `main` directamente, no crear ramas/PR duplicadas y no declarar realizada la prueba física sin evidencia.

