# KapiArt Studio · estudio de color anime y selección por zonas

**Fecha:** 2026-10-20  
**TIMER estimado:** 4–8 horas para la primera iteración. Tiempo real no medido.  
**Estado:** `PARTIAL`. Cambios desarrollados en rama; CI y dispositivo aún pendientes.  
**Base main verificada al inicio:** `33ab69e66e902b62e411d4cd764ef2dff180d125`.  
**Rama:** `feature/kapiart-anime-color-studio-001`.

## Alcance del primer incremento

- Paleta local generada por HSL con 2.880 combinaciones programáticas, paginada para no introducir miles de elementos de interfaz a la vez.
- Presets con nombres y alias en español para cabello anime, tonos de piel, reflejos y sombras; búsqueda por nombre, alias y fragmentos de HEX.
- Varita por región conectada de cuatro vecinos, con tolerancia ajustable y protección heurística frente a líneas oscuras cuando el relleno muestreado es más claro.
- Recoloración con máscara para modificar únicamente la selección, conservar canal alfa y trasladar la luminosidad hacia el nuevo color para que los negros puedan cambiar de tono sin perder toda la forma.
- Añadir una segunda región a la selección, limpiar selección y separar la zona elegida en una nueva capa de imagen. La separación recorta los píxeles seleccionados de la capa original y se registra en el historial para permitir deshacer.
- Interfaz en español, vista previa sin modificar el original antes de aplicar, controles de toque y estilos cálidos de KapiArt.
- Nuevo módulo añadido al app shell offline v56.

## Límite explícito del «conocimiento de miles de imágenes»

Este incremento **no es un modelo entrenado con miles de imágenes** ni realiza reconocimiento semántico que garantice saber qué objeto es cabello. Implementa reglas locales específicas para ilustración anime/cel-shading: regiones de color conectadas, transparencia y líneas oscuras. Funciona mejor con dibujos limpios de colores planos. Gradientes, cabello negro unido a contornos negros, antialiasing fuerte o zonas del mismo color que se tocan pueden requerir ajuste manual.

Para incorporar un corpus de referencia amplio de manera responsable, el siguiente paso debe ser un catálogo versionado de ejemplos sintéticos y/o de licencia abierta, con procedencia, licencia, dimensiones y hashes, separado de la APK. No se añadieron imágenes de terceros sin licencia ni se incluyó un modelo pesado o servicio remoto.

## Pruebas y aceptación

- Se añadieron pruebas unitarias para el catálogo generado, búsqueda de tonos, selección contigua, protección de líneas oscuras, píxeles transparentes, composición de máscaras, recoloración de cabello oscuro y preservación del alfa.
- Se añadieron aserciones de integración de la interfaz y del app shell.
- **CI Web:** pendiente de ejecutar sobre el HEAD definitivo de la rama.
- **CI Android / APK:** pendiente de confirmar que el wrapper Android empaqueta el Web runtime actualizado.
- **Prueba física Xiaomi 24116RACCG:** no realizada. No declarar aceptación completa hasta probar varita, añadir zona, recolorear, separar capa, deshacer/rehacer y exportar en el dispositivo.

## Siguiente criterio de integración

No integrar en `main` hasta tener Web CI con E2E de navegador y Android CI en el SHA exacto de la rama. Confirmar también que el APK contiene `anime-color-studio.mjs` y que el app shell v56 carga offline.


## Ampliación del incremento · área rectangular, tono y borrador de efecto

- Añadida selección rectangular arrastrable sobre la previsualización, que forma una máscara de píxeles visibles y respeta transparencia.
- Añadidos los controles «Temperatura fría ↔ cálida», «Aclarar ↔ oscurecer» y giro de tono, conectados al motor local y a la vista previa.
- La aplicación puede crear una capa separada «Efecto de color» con los píxeles opacos modificados; la capa de la imagen original permanece debajo. La acción «Borrar efecto de color» activa el borrador de alfa sobre esa capa para revelar el original. El resultado evita colorear bordes de antialiasing parcialmente transparentes y conserva el line-art como prioridad.
- Pruebas ampliadas para selección rectangular, ajustes de temperatura/oscuridad, interfaz y flujo E2E de capa reversible. No considerar esos flujos aceptados hasta que Web E2E y Android CI pasen en el mismo SHA final.
- **Estado actual de aceptación:** `PARTIAL` hasta verificar los runs vinculados al HEAD definitivo y probar en el Xiaomi. No hay prueba física ni modelo entrenado con miles de ilustraciones.

## 2026-10-23 · Consolidación sobre main y corrección del cuentagotas

**TIMER estimado:** 3–5 horas para sincronización, ajuste del motor y validación; tiempo real no medido.

- La rama se consolidó con el código de `main` en el merge commit `f8b375029f274a6da7fc93a87b51cb26de6d4845`, conservando ambos historiales. Base integrada: `d1dcc6f29ed6e11654fe0698de0c2a790297babe`.
- El test del cuentagotas ahora calcula el color esperado desde los píxeles del recurso original inmutable, no desde la vista previa recoloreada.
- El motor local admite `selectionMask` y el alias histórico `mask`, conserva alfa, mantiene el modo inmutable por defecto, admite mutación explícita para worker y conserva protección de lineart en recolor global. Las selecciones anime son autoritativas para poder recolorear rellenos negros sin bloquear el cabello.
- El shell offline está sincronizado en `animeart-web-shell-v68` entre app y service worker; incluye el motor de color, la biblioteca de paleta anime y los módulos de deduplicación/paginación de la biblioteca.
- **Estado previo a la nueva CI:** los tests Web y Android deben repetirse sobre el HEAD que resulte de este commit documental. No fusionar la PR hasta que ambos pasen sobre ese mismo SHA.
