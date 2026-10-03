# Architecture

AnimeArt keeps a single layered pipeline:

UI -> Gesture Dispatcher -> Tool -> Stroke -> Layer -> Document -> Renderer -> Persistence

## Core models

- CanvasDocument: dimensions, ordered layers and metadata.
- Layer: stable id, name, visibility, lock, opacity, transform, blend mode and content.
- EditorState.selectedLayerId: single source of truth for the active layer.
- Transform: non-destructive translation, uniform scale and rotation stored on the layer.
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

When a transformed layer is edited, document coordinates are converted through the inverse layer transform before points are stored. LayerTransformMath is the single reusable implementation for layer-local transform and inverse-transform calculations.

## Rendering

The existing Compose Canvas remains the only renderer. The pipeline is Canvas -> Viewport -> each layer Transform -> layer content -> selection overlay. Layer opacity is independent from brush/stroke opacity. Eraser strokes use the Canvas clear blend mode rather than a second drawing engine.

## Persistence

ProjectPersistence stores document dimensions, ordered layer metadata, transform state, content type and complete stroke point data in the existing local recovery store. Older documents without transform metadata load with the identity transform.

## Reuse

No third-party source code is copied. External projects remain architectural references because the Day 1 reuse audit did not establish a need or compatible licensing path for direct code reuse.
