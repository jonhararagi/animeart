# Reuse Audit

Research was performed before implementation.

| Project | Relevant evidence | License/status | Day 1 decision |
|---|---|---|---|
| ArtisteX | Android graphics editor with canvas, shapes, bitmaps, transforms and undo | BSD-3-Clause | Study architecture; do not copy code yet |
| PaintStudio | Kotlin Android drawing app with bitmap/canvas layers, zoom/pan and undo/redo | Public repository; license must be verified before code reuse | Study implementation ideas; no direct code reuse |
| PxerStudio | Android drawing tool with layers, two-finger zoom/move and undo/redo | Apache-2.0 | Strong reference for later drawing/layer work; no direct code copied |
| Fossify Paint | Kotlin Android canvas drawing app with PNG/JPG/SVG and offline operation | GPL-3.0 | Reference only; GPL makes direct incorporation inappropriate for this project unless licensing strategy changes |
| FreePaint | Android vector drawing app with Material 3, pan/zoom and SVG | GPL-3.0 | Reference only; no direct incorporation |

Additional research found ParrotLUX has mature layer, transform, lasso and multitouch concepts, but its architecture is web/Chromium based rather than native Android, so it is a conceptual reference rather than a component to embed.

No third-party source code has been copied into AnimeArt in Day 1.
