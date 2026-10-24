# Biblioteca inicial de rasgos anime de KapiArt

## Alcance real

Esta primera biblioteca contiene 12 referencias vectoriales SVG generadas localmente: cuatro variantes de ojos, cuatro siluetas de cabello y cuatro formas de rostro. Cada ficha mantiene un ID estable, categoría, etiquetas, rasgos visuales, descripción y procedencia. Los SVG se construyen desde trazados incluidos en el programa, sin descargas ni imágenes externas.

## Uso

Abre **Estudio creativo → Rasgos anime**. Busca por parte, etiqueta o característica; selecciona hasta cuatro variantes y añádelas como referencias separadas. Cada referencia se conserva como una capa de imagen independiente marcada como referencia, por lo que puede moverse, ocultarse, bloquearse o eliminarse sin aplanar el dibujo. Las referencias se excluyen de la exportación raster final y permanecen en el proyecto editable.

## Procedencia y límites

Estos recursos se describen honestamente como generados por el programa. No son referencias externas de artistas, no representan un corpus licenciado de obras y no son un modelo de IA entrenado con miles de imágenes. Las siluetas ofrecen puntos de partida visuales diferentes para estudiar proporciones y construir una guía; no ensamblan automáticamente un personaje terminado. Las correcciones y el dibujo manual siguen disponibles en el editor.

## Composición inicial de personajes por capas

En la rama autorizada `feature/kapiart-anime-character-composer-001` se está añadiendo una primera composición local a partir de la misma biblioteca. Selecciona exactamente un rasgo de Ojos, uno de Cabello y uno de Rostro; permite cambiar colores de cabello, iris, piel y línea, y crea cuatro capas de imagen SVG independientes:

1. Cabello base.
2. Rostro.
3. Flequillo o mechones frontales.
4. Ojos.

Las cuatro capas comparten el mismo encuadre inicial para que se vean como una composición. Cada una conserva su propia identidad y puede moverse, ocultarse, transformarse o eliminarse desde Capas. La creación se registra como una sola operación del historial, de modo que Deshacer elimina las cuatro y Rehacer las recupera. Las variaciones siguientes se colocan en posiciones diferentes del lienzo para que no tapen automáticamente la variante anterior.

El resultado es un **ensamblador vectorial básico**, no un generador semántico ni un modelo de IA. La compatibilidad está limitada a los componentes que ofrece el catálogo y las proporciones SVG predefinidas; las correcciones manuales siguen siendo necesarias cuando el estilo o los rasgos seleccionados no encajan entre sí. La validación de Chromium y Android debe confirmar la selección real, la composición en capas, los colores, la persistencia y Deshacer/Rehacer antes de marcar este complemento como integrado en `main`.
