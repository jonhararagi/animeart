# DAY 04 — Tracing + Reference Layer

## Estado

CI VERDE; VISTO BUENO PENDIENTE DE PRUEBA MANUAL ANDROID.

## Auditoría de reutilización

| Necesidad | Decisión |
|---|---|
| Layer | REUTILIZAR |
| Transform | REUTILIZAR `LayerTransformMath` |
| Viewport | REUTILIZAR |
| Selection | REUTILIZAR modo Transform y bounding box existente |
| Lock | REUTILIZAR metadata/acciones de Layer |
| Opacity | REUTILIZAR opacity de Layer |
| Persistence | ADAPTAR `ProjectPersistence` |
| Undo/Redo | REUTILIZAR `CommandHistory` vía `DrawingEditor` |
| Renderer | REUTILIZAR Compose Canvas |
| Image import | ADAPTAR la abstracción existente y añadir almacenamiento privado necesario |

No se creó un sistema paralelo de ReferenceLayer, renderer, transform, selection, history o document.

## Implementación

- `LayerContent.Reference(uri, width, height)` representa una imagen de referencia dentro del Layer normal.
- `ReferenceImageStore` copia los bytes al almacenamiento privado del proyecto y permite decode de preview con downsampling.
- El selector Android usa `OpenDocument` para PNG/JPEG/WebP.
- El renderer dibuja la referencia en el Canvas existente respetando visibility y opacity.
- Transformar reutiliza el mismo gesto y `LayerTransformMath` que las capas del Día 3.
- Una referencia bloqueada no puede transformarse y una referencia nunca recibe strokes.
- El trazado se realiza sobre una drawing layer independiente.
- La persistencia guarda ruta estable, dimensiones, tipo, propiedades y transform.

## Tests

Añadidos tests para:
- creación y propiedades de referencia;
- pivot de imagen;
- round-trip de transform;
- aislamiento entre reference y drawing layer.

## CI

- Run #40 — SUCCESS.
- assembleDebug — SUCCESS.
- Unit tests — SUCCESS.

## Errores reales

### Fallo: decoder de referencia
Causa: la primera implementación introdujo sintaxis inválida en el decoder de JSON.
Reparación: decoder reescrito y verificado por CI.
Verificación: Run #40 SUCCESS.

### Fallo: cierre de lambda Canvas
Causa: el cierre de la lambda de contenido del Canvas quedó mal posicionado.
Reparación: cierre corregido.
Verificación: Run #40 SUCCESS.

### Warning: librería nativa sin strip
Causa: dependencia Android existente.
Reparación: no bloqueante; no afecta build.
Verificación: CI continúa SUCCESS.

## Prueba manual obligatoria

No ejecutada en dispositivo/emulador desde esta sesión. Por ello el Día 4 no se declara aprobado todavía.

Checklist pendiente:
1. Importar imagen.
2. Renombrar a Reference Character.
3. Opacity 40%.
4. Bloquear.
5. Crear/select drawing layer.
6. Dibujar encima.
7. Confirmar aislamiento.
8. Desbloquear.
9. Mover.
10. Escalar.
11. Rotar.
12. Bloquear.
13. Guardar.
14. Cerrar/reabrir.
15. Verificar propiedades, transform e imagen.
16. Undo/Redo.

## Deuda técnica

- SharedPreferences/JSON sigue siendo el almacén de metadata.
- No hay handles dedicados nuevos; se reutiliza el bounding box existente.
- La validación final de interacción física requiere un dispositivo/emulador Android.
