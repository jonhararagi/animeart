# Identidad visual de KapiArt Studio

## Idea de marca

**Nombre visible:** KapiArt Studio  
**Nombre corto:** KapiArt  
**Personalidad:** cute, anime, cálida, tranquila y creativa. La mascota es la referencia principal: una chica anime con capucha de capibara, pelo castaño oscuro, gafas grandes, ropa marrón y detalles claros y rosados.

La imagen de referencia vive en `pngtuber-capibara.png`. La versión usada por el editor web está en `web/assets/kapiart-mascot.png` para que la cabecera también funcione sin conexión.

## Paleta operativa

Los tonos son una interpretación visual coherente con la mascota, no una medición exacta de todos los píxeles de la imagen.

| Uso | Color | Intención |
| --- | --- | --- |
| Fondo profundo | `#241A19` | Cocoa oscuro, cálido y discreto |
| Superficie principal | `#2B211F` | Paneles del editor |
| Superficie elevada | `#392B29` | Tarjetas, controles y paneles |
| Cocoa de marca | `#4C352F` | Inspirado en el pelo y la capucha |
| Crema | `#FFF4EB` | Texto principal y contraste |
| Rosa blush | `#F2A2A0` | Acento principal, selección y enfoque |
| Coral | `#E6817B` | Acciones y detalles importantes |

El cian y el violeta dejan de ser los colores dominantes de la interfaz. El editor conserva el fondo oscuro y el contraste para que sea cómodo trabajar, pero sus superficies y acentos ahora acompañan la paleta de la mascota.

## Reglas de uso

- Mostrar la mascota en la cabecera en un tamaño pequeño y controlado, sin tapar herramientas ni reducir el espacio del lienzo.
- Usar el nombre KapiArt en los puntos visibles para el usuario: cabecera, título de la PWA, etiqueta de Android y cuadro para compartir.
- Mantener iconos, botones, paneles y estados con la misma paleta; reservar el coral para énfasis en lugar de colorear todo.
- Mantener texto legible, anillos de enfoque visibles y áreas táctiles cómodas. El estilo cute nunca debe ocultar errores, estados de carga o confirmaciones.
- Mantener intactos el ID de paquete Android `com.jonhararagi.animeart`, las rutas técnicas y las claves de persistencia existentes. El cambio de nombre visible no debe impedir actualizar instalaciones anteriores.
- Incluir la imagen de la mascota y el icono en el shell offline y comprobarlo mediante una prueba automática.

## Alcance verificado por pruebas

La prueba `web/test/brand-identity.test.mjs` comprueba el nombre visible, la presencia de la mascota, el icono de marca, la paleta y la inclusión del recurso en la caché offline. La CI de Android debe seguir comprobando la compilación e instrumentación del empaquetado.
