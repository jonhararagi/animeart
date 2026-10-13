# AnimeArt

AnimeArt is a local-first **image editor and compositor**, inspired by everyday editors such as Picsart. It is not an AI image generator. The Web editor in `web/` is the canonical runtime, and Android packages that same current editor into its APK through Gradle.

## Editing tools

- Create documents with explicit pixel dimensions.
- Import images from files, drag-and-drop and clipboard paste; compose many image layers in one project.
- Move, scale, rotate, flip, crop and resize image layers while preserving transparency.
- Manage layers: create, select, rename, duplicate, delete, reorder, hide, lock and set opacity.
- Use masks and a true transparent-alpha eraser on drawing layers.
- Draw with configurable color, size, opacity and hardness; use normal brush, soft airbrush, glow and neon effects.
- Remove connected backgrounds locally with edge/line-art protection, feathering, fringe cleanup and manual erase strokes. Save, reuse and delete local processing profiles for anime ink, flat-color illustration, transparent PNGs and photography; these are local parameter presets, not a trained AI model.
- Select a source color in an image and recolor that range, preserving shading, highlights, texture and alpha.
- Adjust brightness, contrast, saturation, hue, temperature, tint and blur non-destructively, with Original, Anime, Cinematic, Manga and Dream presets.
- Add editable multiline text with font family, weight, size, color, alignment, outline and shadow.
- Undo/redo, recover projects locally, import/export portable JSON projects and export the composite as PNG, JPEG or WebP. Android uses the native Save As picker for images and project files; desktop browsers keep the standard download path.
- Install as a PWA with an offline application shell.

Image pixels and projects stay on the device unless the user explicitly exports them. The editor does not upload artwork to an AI service.

## Run the Web editor

On Windows, install Node.js 22 or newer, then double-click `START_ANIMEART.bat` in the repository folder. Or run:

```sh
cd web
npm install
npm run dev
```

Open **http://127.0.0.1:4173/**. Set `PORT` to use another port.

## Build and test

```sh
cd web
npm install
npm run build
npm test
```

## Android

The APK uses generated assets from the canonical `web/` directory. `app/src/main/assets/web/` is not a second source of truth.

```sh
gradle assembleDebug
gradle test
gradle connectedDebugAndroidTest
```

GitHub Actions checks the Web build, real Chromium interactions, Android instrumentation and offline startup. The Android offline smoke derives its cache contract from the current Web sources instead of relying on a stale hard-coded version.


## Beginner-friendly editing

The editor now includes an **Editar fácilmente** panel with shortcuts for cropping, background removal, erasing, censor light, drawing, text, color adjustments, layers, undo and export. Contextual help is optional and its preference is kept locally on the device. Less frequently used controls are grouped under **Más herramientas**.

**Luz de censura** paints on a separate drawing layer, with white as the default color, a document-space diameter control, opacity, edge softness, optional glow and Punto / Normal / Grande / Línea presets. Undo/redo works through the existing document history. Raster exports are flattened images; when visible censor strokes exist, the editor requires the explicit **Censura permanente al exportar** confirmation. Keep the editable project separately if you need to revise the censor layer later. A glow effect is visual, not a guarantee that covered source information is removed from the editable project.
