# Biblioteca inicial de rasgos anime de KapiArt

## Alcance real

La biblioteca contiene 16 recursos vectoriales SVG generados localmente: cuatro variantes de ojos, cuatro siluetas de cabello, cuatro formas de rostro y cuatro expresiones bucales. Cada ficha mantiene un ID estable, categoría, etiquetas, rasgos visuales, descripción y procedencia. Los SVG se construyen desde trazados incluidos en el programa, sin descargas ni imágenes externas.

## Uso

Abre **Estudio creativo → Rasgos anime**. Busca por parte, etiqueta o característica; selecciona hasta cuatro variantes y añádelas como referencias separadas. Cada referencia se conserva como una capa de imagen independiente marcada como referencia, por lo que puede moverse, ocultarse, bloquearse o eliminarse sin aplanar el dibujo. Las referencias se excluyen de la exportación raster final y permanecen en el proyecto editable.

## Procedencia y límites

Estos recursos se describen honestamente como generados por el programa. No son referencias externas de artistas, no representan un corpus licenciado de obras y no son un modelo de IA entrenado con miles de imágenes. Las siluetas ofrecen puntos de partida visuales diferentes para estudiar proporciones y construir una guía; no ensamblan automáticamente un personaje terminado. Las correcciones y el dibujo manual siguen disponibles en el editor.

## Composición inicial de personajes por capas

La primera composición local ya está integrada en `main` mediante la PR [#118](https://github.com/jonhararagi/animeart/pull/118), usando la biblioteca integrada en la PR [#117](https://github.com/jonhararagi/animeart/pull/117). En **Estudio creativo → Rasgos anime**, selecciona los rasgos compatibles de Ojos, Cabello y Rostro; permite cambiar colores de cabello, iris, piel y línea, y crea cinco capas de imagen SVG independientes:

1. Cabello base.
2. Rostro.
3. Flequillo o mechones frontales.
4. Ojos.
5. Expresión bucal (sonrisa suave predeterminada si no se selecciona otra).

Las cuatro capas comparten el mismo encuadre inicial para que se vean como una composición. Cada una conserva su propia identidad y puede moverse, ocultarse, transformarse o eliminarse desde Capas. La creación se registra como una sola operación del historial, de modo que Deshacer elimina las cuatro y Rehacer las recupera. Las variaciones siguientes ocupan hasta nueve posiciones distintas del lienzo (una cuadrícula de comparación); no tapan automáticamente la variante anterior. El límite evita que las capas se acumulen en el mismo punto: para conservar más de nueve variantes, guarda una copia del proyecto o crea otro documento. Las favoritas, los conjuntos reutilizables y las paletas locales ya forman parte del editor. En esta rama se incorporan cuatro diseños de expresión como quinta capa independiente; la integración en main queda sujeta a revisión y CI.

El resultado es un **ensamblador vectorial básico**, no un generador semántico ni un modelo de IA. Las cuatro expresiones tienen trazados distintos para boca cerrada sonriente, sonrisa abierta con dientes, sonrisa ladeada y sorpresa; no son recoloreados de una misma forma. La compatibilidad está limitada a los componentes que ofrece el catálogo y las proporciones SVG predefinidas; las correcciones manuales siguen siendo necesarias cuando el estilo o los rasgos seleccionados no encajan entre sí. Validación integrada: Web CI [#40139485618](https://github.com/jonhararagi/animeart/actions/runs/40139485618) y Android CI [#40139485617](https://github.com/jonhararagi/animeart/actions/runs/40139485617) pasaron sobre main SHA `565770b36c77d3cd1abdc359ea0079ea63e715ef`; además, la PR #118 obtuvo Web CI [#40139161500](https://github.com/jonhararagi/animeart/actions/runs/40139161500) y Android CI [#40139161491](https://github.com/jonhararagi/animeart/actions/runs/40139161491) en su HEAD validado. Esto no sustituye la prueba física de aceptación en el Xiaomi `24116RACCG`.
