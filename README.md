# AnimeArt

AnimeArt is a local-first **image editor**, inspired by everyday editors such as Picsart. It is not an AI image generator. The active delivery target is the Web editor; the Android application remains a separate Kotlin/Compose foundation.

## Web editing tools

- Create documents with explicit pixel dimensions.
- Import images from the file picker, drag-and-drop, and clipboard paste.
- Draw with brush and eraser; configure color, size and opacity.
- Manage layers: create, select, rename, duplicate, delete, reorder, hide, lock and set opacity.
- Move, scale, rotate and mirror image layers horizontally or vertically.
- Edit images with a visual pixel crop, free selection and common aspect ratios, or resample to new dimensions while preserving transparency.
- Adjust brightness, contrast, saturation, hue and blur non-destructively, with Original, Anime, Cinematic, Manga and Dream presets.
- Add editable multiline text layers with font family, weight, size, color and alignment.
- Select multiple layers and move them together.
- Undo and redo supported document edits.
- Save and recover projects locally; export/import portable JSON project files.
- Export composed artwork as PNG, JPEG or WebP. PNG preserves transparency; JPEG offers a background color; JPEG and WebP offer quality control.
- Install as a PWA with an offline application shell.

The editor uses the existing Document, Layer, Canvas renderer, History, storage and export boundaries. Images and projects remain in the browser unless the user explicitly exports them. No remote image-generation service is part of the editor workflow.

## Run the Web editor

On Windows, install Node.js 22 or newer, then double-click `START_ANIMEART.bat` in the repository folder. It starts the local editor and opens the browser. Your images and projects stay on your device.


```sh
cd web
npm install
npm run dev
```

Open **http://127.0.0.1:4173/**. The local server serves the editor directly from the source folder; it does not upload your images or projects anywhere. Set `PORT` to use another port.

## Build and test

```sh
cd web
npm run build
npm test
```

Android:

```sh
gradle assembleDebug
gradle test
```

The GitHub Actions workflows validate the Web build and real Chromium interactions, and independently validate the Android foundation.
