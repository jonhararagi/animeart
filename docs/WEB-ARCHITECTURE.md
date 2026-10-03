# AnimeArt Web Architecture

## Current stage

The Web product starts as a deliberately small, dependency-free browser editor. It is additive: the existing Android Compose editor remains intact while the Web foundation is validated.

## Boundaries

- web/ owns the browser application and its UI.
- Android remains responsible for native/device capabilities until the Web product reaches the container migration stage.
- No second Android editor is introduced by this change.
- The Web prototype uses one canvas, one layer collection and localStorage for the first persistence slice.

## First reusable concepts

The current Web state already mirrors the project's intended concepts:

- document-like project state
- ordered layers
- selected layer
- drawing strokes
- local persistence
- browser canvas rendering

The next migration step should introduce explicit TypeScript domain contracts and a reusable Document/Layer model rather than adding feature-specific parallel state.

## Verification boundary

Web CI must run install, build and tests. A passing Web CI does not imply Android CI is passing, and vice versa. Neither is reported as GREEN without a real workflow execution.

## Next step

After this foundation is verified, evolve the Web state toward explicit Document/Layer contracts and then add zoom/pan and undo/redo while keeping the browser renderer as the only Web renderer.
