# Architecture

AnimeArt follows a deliberately small layered model:

UI -> Editor -> Document Model -> Rendering -> Persistence

The Day 1 implementation keeps UI state local to the editor shell while the domain document and viewport models remain independent of Compose.

## Core models

- CanvasDocument: document dimensions, layers and metadata.
- Layer: identity, visibility, lock, opacity, transform, blend mode and content.
- Viewport: scale, translation and rotation.
- EditorState: single conceptual source of truth for document/editor selection/tool state.
- EditorCommand/CommandHistory: reversible operation boundary for future undo/redo.
- ProjectPersistence: local recovery snapshot.

## Rendering

The initial renderer is a Compose Canvas shell. A dedicated rendering package can be introduced when layer rendering becomes substantial; no second rendering system should be created if an existing one can be adapted.

## Future contracts

BackgroundRemovalEngine and ShadingEngine are interfaces only. They deliberately avoid coupling the editor UI to a specific algorithm or remote API.
