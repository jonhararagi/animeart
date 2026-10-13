# AnimeArt

AnimeArt is a local-first **image editor and compositor**, inspired by everyday editors such as Picsart. It is not an AI image generator. Android launches a native Jetpack Compose editor. The Web editor remains a separate target and is not embedded in the Android app.

## Editing tools

- Create documents with explicit pixel dimensions.
- Import images from files, drag-and-drop and clipboard paste; compose many image layers in one project.
- Move, scale, rotate, flip, crop and resize image layers while preserving transparency.
- Manage layers: create, select, rename, duplicate, delete, reorder, hide, lock and set opacity.
- Use masks and a true transparent-alpha eraser on drawing layers.
- Draw with configurable color, size, opacity and hardness; use normal brush, soft airbrush, glow and neon effects.
- Remove connected backgrounds locally with edge/line-art protection, feathering, fringe cleanup and manual erase strokes.
- Select a source color in an image and recolor that range, preserving shading, highlights, texture and alpha.
- Adjust brightness, contrast, saturation, hue, temperature, tint and blur non-destructively, with Original, Anime, Cinematic, Manga and Dream presets.
- Add editable multiline text with font family, weight, size, color, alignment, outline and shadow.
- Undo/redo, recover projects locally, import/export portable JSON projects and export the composite as PNG, JPEG or WebP.
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

The Android app launches directly in its native Jetpack Compose editor, not a WebView. Import images from the Android document picker; each image becomes an editable layer with opacity, duplication, ordering, visibility, locking and touch transforms. Painting above an image creates a separate transparent paint layer. Projects preserve image URIs and layer transforms locally.

The APK excludes the retired WebView editor assets. The Web editor is maintained as a separate target.

```sh
gradle assembleDebug
gradle test
gradle connectedDebugAndroidTest
``

