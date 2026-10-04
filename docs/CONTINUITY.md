ANIMEART — CONTINUITY

# T022 — Web Viewport / Zoom / Pan

ESTADO:
IMPLEMENTACIÓN EN RAMA t022-web-viewport; pendiente de CI real y merge.

BASELINE:
main @ a1623fc4d23c688301853d066c93a8e3140ad359.

BRANCH:
t022-web-viewport.

OBJETIVO:
Establecer un único viewport Web puro y testeable, integrar su matemática con Canvas 2D y convertir Pointer Events a coordenadas de documento antes de crear/extender strokes.

AUDITORÍA:
- Android Viewport usa escala y traslación, y ViewportTransform ya define la referencia conceptual screen↔document alrededor del centro. Se reutiliza la semántica, no las APIs Kotlin/Compose.
- Web T021 tenía contratos Document/Layer/Stroke/StrokePoint/Transform, pero no un Viewport real.
- app.js ya utilizaba Pointer Events y devicePixelRatio; T022 los reutiliza.
- El pan previo movía temporalmente el elemento Canvas mediante CSS y no modificaba un estado de viewport; se clasificó como CODE y se reemplazó por pan real sobre el estado de vista.

IMPLEMENTACIÓN:
- web/domain/viewport.mjs: contrato zoom/panX/panY, normalización, validación, screenToDocument, documentToScreen, zoomAt y panBy.
- web/app.js: un único state.viewport; render con una transformación Canvas; strokes almacenan siempre coordenadas de documento; Pointer Events reutilizados para dibujo/pan; wheel zoom alrededor del cursor.
- Viewport no se persiste con el documento; es estado de sesión.
- Zoom de presentación se mantiene en rango centralizado 0.25..4.

TESTS:
- Identidad, zoom, pan, round-trip screen↔document, zoom alrededor del cursor e invariantes de viewport.
- Se mantiene la regresión T021 de restore/migration/normalization/validation.

PENDIENTES:
- Verificación CI real Web + Android y merge.
- Pinch/gestos avanzados siguen fuera de alcance.
