# AnimeArt · corrección de contraste de interfaz

**Fecha:** 18 de octubre de 2026  
**TIMER estimado:** 30 minutos de implementación y comprobación automatizada  
**Ámbito:** interfaz web local y APK Android; cambios directos en main.

## Problema observado

En el tema oscuro algunos textos secundarios, etiquetas pequeñas y el texto de ayuda se confundían con los paneles. El selector de color de texto también arrancaba con #172335, un color muy oscuro que no refleja bien la apariencia clara que se espera al empezar a escribir sobre un lienzo oscuro. Además, el botón principal de Apariencia usaba siempre texto oscuro, incluso cuando el usuario elegía un acento personalizado oscuro.

## Corrección aplicada

- Se aclara la jerarquía de texto y los elementos auxiliares, manteniendo los fondos oscuros y la identidad rosa/cian.
- Los marcadores de posición y las notas pequeñas tienen tonos más claros y opacidad explícita para que no se desvanezcan en el campo oscuro.
- El selector de color de texto comienza en #f7f5fc, coherente con el comportamiento predeterminado de las capas de texto nuevas. El usuario sigue pudiendo elegir cualquier color.
- El botón principal de Apariencia calcula si el texto claro o el oscuro da mayor contraste con el acento elegido, en vez de forzar un único color de primer plano.
- Se versiona la caché offline como animeart-web-shell-v46; la APK pasa a versionCode 3 / versionName 0.3.0 para permitir una actualización instalada sobre la versión anterior.
- Se agregan pruebas de contraste WCAG, comprobaciones de versión de caché y una aserción de interfaz en Android. El workflow Android verifica que los estilos y la función de contraste estén empaquetados dentro de la APK.

## Criterio de accesibilidad

La prueba automatizada exige una relación mínima de **4.5:1** para texto normal. WCAG 2.2 define ese umbral para texto normal y permite 3:1 únicamente para texto grande en el criterio de contraste mínimo.

## Casos públicos revisados

1. [W3C WAI · Understanding Contrast Minimum, WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): define el objetivo de contraste mínimo y explica por qué el texto tenue perjudica a personas con baja visión.
2. [GitHub Changelog · Light and dark theme color contrast improvements, 27 de marzo de 2023](https://github.blog/changelog/2023-03-27-light-and-dark-theme-color-contrast-improvements): documenta que GitHub ajustó sus temas claros y oscuros mediante su sistema de diseño Primer para mejorar el contraste.
3. [GitHub Changelog · High contrast theme improvements, 15 de agosto de 2024](https://github.blog/changelog/2024-08-15-high-contrast-theme-improvements): describe texto más claro sobre superficies oscuras y bordes más contrastados para elementos interactivos.
4. [GitHub Changelog · Control contrast for all GitHub themes, 5 de junio de 2025](https://github.blog/changelog/2025-06-05-control-contrast-for-all-github-themes): ejemplo de controles de apariencia que permiten a cada usuario ajustar el contraste de la interfaz.
5. [Material UI · Palette / contrastText](https://mui.com/material-ui/customization/palette/): referencia de implementación para escoger de forma deliberada el color del texto según el fondo, en vez de reutilizar un único color de texto en todos los botones.
6. [Canva · Accessibility](https://www.canva.com/accessibility): ejemplo desde un editor creativo de comprobaciones de contraste, tipografía y texto alternativo dentro de la experiencia de diseño.

Estas fuentes describen criterios y mejoras públicas; no se atribuye a esos productos un fallo idéntico al de AnimeArt. La solución local se verifica con pruebas propias.

## Verificación

- La prueba nueva comprueba relaciones de contraste de pares representativos y que los acentos claros y oscuros reciban un color de texto legible.
- Web CI valida pruebas unitarias, benchmark, build y E2E real en Chromium.
- Android CI valida build, pruebas de unidad, lint, instrumentación WebView y smoke de inicio; la APK versionada y su SHA-256 solo se consideran entregables cuando el workflow termina correctamente.
