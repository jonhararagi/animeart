# Architecture

AnimeArt keeps a single layered pipeline:

UI -> Gesture Dispatcher -> Tool -> Stroke -> Layer -> Document -> Renderer -> Persistence

## Core models

- CanvasDocument: dimensions, layers and metadata.
- Layer: visibility, lock, opacity, transform, blend mode and content.
- LayerContent.Drawing: persistent vector-like stroke list for the layer.
- Stroke/StrokePoint: compact drawing data stored in document coordinates.
- Viewport: scale, translation and rotation; viewport changes do not mutate stroke coordinates.
- EditorState: single conceptual source of truth for document, selection, tool and brush settings.
- CommandHistory: reversible operation boundary. One completed stroke is one command.

## Drawing pipeline

Touch Down -> Begin Stroke -> Append Points -> Render Active Stroke -> Touch Up -> Commit Stroke

A two-pointer gesture cancels any active stroke and switches to viewport navigation. One pointer draws when Brush/Eraser is selected, or pans when Pan is selected.

## Coordinates

Screen coordinates are converted to document coordinates through ViewportTransform. Strokes are never stored in physical screen coordinates.

## Rendering

The existing Compose Canvas remains the only renderer. Layers and strokes are rendered through that Canvas. Eraser strokes use the Canvas clear blend mode rather than a second drawing engine.

## Persistence

ProjectPersistence stores document dimensions, layer metadata and complete stroke point data in the existing local recovery store.

## Reuse

No third-party source code is copied. External projects remain architectural references because the Day 1 reuse audit did not establish a need or compatible licensing path for direct code reuse.
