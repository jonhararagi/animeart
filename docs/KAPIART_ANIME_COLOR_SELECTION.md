# KapiArt · selección inteligente y color anime

**TIMER estimado:** 4–8 horas para integrar y validar la primera versión en el editor web y Android. Tiempo real no medido.

## Objetivo
Dar herramientas locales, ligeras y fáciles para recolorear arte anime estilizado, especialmente ilustraciones 2D con line art, colores planos y sombras cel-shading.

## Alcance inicial
- Paleta continua HSV/RGB, con cualquier color HEX válido.
- Búsqueda de nombres comunes en español (por ejemplo, marrón claro, rubio miel, rojo vino, cobre y azul pastel).
- Varita por región conectada basada en proximidad de color, tolerancia y transparencia.
- Selección por región para restringir un recoloreado sin modificar píxeles fuera de la máscara.
- Vista previa, confirmación explícita y compatibilidad con historial/deshacer.
- Procesamiento local, sin enviar imágenes del usuario a un servicio.

## Límites honestos
La varita es una selección por color conectado, no un modelo semántico que siempre sepa qué es cabello. En anime funciona mejor cuando los mechones están delimitados por line art y áreas de color planas. Sombras, antialiasing, reflejos y mechones tocándose pueden exigir ajustar tolerancia, sumar/restar regiones o retocar una máscara.

No se debe afirmar que KapiArt fue entrenado con miles de imágenes si no existe un conjunto de datos documentado, con licencias, procedencia y evaluación. La primera versión usa algoritmos locales y perfiles de ilustración estilizada. Una futura clasificación semántica requerirá un dataset autorizado, evaluación de falsos positivos y presupuesto de memoria/CPU para el Xiaomi de 8 GB.

## Pruebas requeridas
- Cabello negro con brillos, castaño con sombras, rubio, ojos, ropa y fondo transparente.
- Límites de line art, regiones desconectadas, tolerancia baja/alta, deshacer/rehacer y exportación.
- Web CI y Android CI sobre el mismo SHA; prueba física pendiente hasta verificar en el Xiaomi.


## Protección de line art blanco y negro
La opción «Proteger bordes negros y brillos blancos» examina el contraste local de cada píxel. Los píxeles casi negros o casi blancos que forman un borde de alto contraste se dejan intactos durante el recoloreado. Las zonas negras interiores sin contraste local pueden seguir recoloreándose, algo importante para cabello negro. Es una heurística ajustable, no una segmentación semántica perfecta: trazos finos, antialiasing, fondos blancos y reflejos requieren pruebas con imágenes reales.

## Selección de varias zonas para ojos, cabello y ropa

La herramienta de selección permite reemplazar una región, sumar otra región del mismo diseño o restar una zona que se incluyó por error. Esto ayuda a recolorear ambos iris o varios mechones separados sin incluir el fondo. La operación sigue siendo una máscara por conectividad y similitud de color: no identifica semánticamente qué objeto es un ojo o un mechón. Las pruebas comprueban la combinación y sustracción de máscaras, sus dimensiones y el conteo de píxeles.
