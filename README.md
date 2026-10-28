# AnimeArt

AnimeArt is a local-first **image editor and compositor**, inspired by everyday editors such as Picsart. It is not an AI image generator. The Web editor in `web/` is the canonical runtime, and Android packages that same current editor into its APK through Gradle.

## Editing tools

- Create documents with explicit pixel dimensions.
- Refine text with editable letter tracking (−8 to 24 px) and line height (0.8× to 2.5×). These values remain part of the text layer and follow the document through undo/redo and image export.
- Save up to 20 named typography styles locally, then reapply them to another text layer without replacing that layer's text content, position, or transform. The style shelf is device-local and does not upload fonts or projects.
- Organize multiple editable pages in a local multipage project: create blank pages, duplicate, rename, reorder, switch, and delete pages while preserving the individual layer stack.
- Copy a selected editable layer from one page to another without flattening it. Local multipage storage is limited to 10 projects, 10 pages per project, 200 layers and 2.5 MB serialized per page; the existing per-page safety limit is intentionally unchanged.
- Browse 16 original local SVG design elements, including dialogue bubbles, manga frames, halftone texture, sakura petals, neon arrows and kawaii reactions. Filter the element catalog by collection or search terms, save element favorites on-device, and add each element as its own editable image layer.
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
- Create from an expanded local library of editable anime-oriented templates for social posts, stories, video thumbnails, banners, wallpapers, character sheets, manga, books, events, invitations and more; suggested canvas formats are preselected but remain editable.
- Align single layers to the canvas or multiple selected layers to each other; distribute three or more layers evenly, preserving each layer's scale/rotation and supporting undo/redo.
- Keep a local **Mis diseños** library in IndexedDB with thumbnails and editable projects: save, open, duplicate, rename and delete. It is capped at 40 entries and refuses new saves at capacity instead of silently deleting older designs. The current 2.5 MB document-storage limit still applies.
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
