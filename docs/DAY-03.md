# DAY 03 — Capas editables y transformación de contenido

## Estado

Día 3 implementado sobre el commit aprobado de Día 2.

### Objetivo

Convertir el sistema de capas existente en un sistema editable real sin crear un segundo Document, renderer, canvas, history o sistema de transformación.

## Arquitectura reutilizada

Pipeline vigente:

UI -> Gesture Dispatcher -> Tool -> Stroke -> Layer -> Document -> Renderer -> Persistence

Se reutilizan:
- `CanvasDocument` como único documento.
- `Layer` como única abstracción de contenido.
- `EditorState.selectedLayerId` como selección única.
- `CommandHistory` para undo/redo.
- `ViewportTransform` para navegación.
- Compose Canvas existente como único renderer.

La regla aplicada fue REUTILIZAR > ADAPTAR > CREAR.

## Operaciones de capa

Implementadas:
- Crear capa con ID estable y contenido vacío.
- Seleccionar una única capa.
- Renombrar con normalización de nombre vacío.
- Mostrar/ocultar sin destruir contenido.
- Bloquear/desbloquear.
- Opacidad independiente de la opacidad del pincel.
- Mover arriba/abajo.
- Duplicar con nuevo ID y copia profunda del contenido mutable.
- Eliminar preservando al menos una capa.
- Selección automática de otra capa después de eliminar.
- Undo/Redo para las operaciones anteriores.

## Transformación

Cada capa conserva:

`Transform(translationX, translationY, scale, rotation)`

La transformación es no destructiva: los puntos de los trazos permanecen en coordenadas locales y la transformación se aplica durante render/hit testing.

`LayerTransformMath` centraliza:
- cálculo de pivote estable a partir del contenido;
- transformación local -> documento;
- transformación documento -> local.

La transformación de capa es distinta del `Viewport`. El viewport sigue siendo navegación global y nunca modifica los puntos almacenados.

## Gestos

Modo Transformar:
- 1 dedo: traslación de la capa.
- 2 dedos: traslación + escala + rotación de la capa.
- El viewport no rota durante una transformación de capa.
- Una transformación completa se registra como una sola operación lógica de undo.

Modo Pincel/Borrador:
- mantiene el pipeline de Día 2;
- dos dedos siguen siendo navegación de viewport.

## Render

Pipeline efectivo:

Canvas -> Viewport -> Transform de cada Layer -> contenido -> overlay de selección.

La opacidad de la capa se multiplica por la opacidad del stroke y se aplica al contenido completo.

## Persistencia

Se guardan/restauran:
- id;
- nombre;
- orden;
- visibility;
- lock;
- opacity;
- transform (translation/scale/rotation);
- tipo de contenido;
- strokes y puntos cuando el contenido es Drawing.

El formato mantiene compatibilidad hacia atrás: documentos antiguos sin transform usan el transform identity.

## Pruebas

Se añadieron pruebas para:
- ciclo crear/renombrar/eliminar;
- visibilidad, lock y límites de opacidad;
- reorder;
- duplicación y aislamiento;
- delete + selección + undo/redo;
- transformación translation/scale/rotation;
- transformación inversa de coordenadas;
- una transformación completa como una sola operación de undo.

## Rendimiento

No se copian bitmaps ni documentos completos durante cada movimiento del gesto. El gesto modifica únicamente el `Transform` de la capa y consolida un único comando al finalizar.

## Deuda técnica / pendientes

- La persistencia actual sigue basada en SharedPreferences/JSON y deberá migrarse a un formato de proyecto más robusto cuando el alcance lo justifique.
- El overlay de selección actual muestra el bounding box del contenido de strokes; futuras herramientas pueden añadir handles visuales sin crear otro sistema de transformación.
- No se implementó Merge Down porque no era necesario para estabilizar Día 3.
- No se avanzó a background removal, smart selection, tracing ni shading avanzado.

## Criterio de salida

No declarar Día 3 aprobado hasta que el último commit modificado tenga:
1. build real exitoso;
2. unit tests reales exitosos;
3. GitHub Actions verde;
4. revisión de logs de CI sin fallos bloqueantes.
