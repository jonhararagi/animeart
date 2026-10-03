# AnimeArt

Android drawing and image-editing foundation focused on offline-first mobile use.

## Day 1 status

The repository contains the initial Android project, editor shell, document/layer model, viewport gesture foundation, recovery persistence, image import abstraction, undo/redo command foundation, tests and CI.

The project intentionally does not implement the complete drawing, background-removal or shading engines on Day 1.

## Build

Use Android Studio or Gradle 8.11.1 with JDK 17.

    gradle assembleDebug
    gradle test

See `docs/CONTINUITY.md` for the authoritative project handoff state.
