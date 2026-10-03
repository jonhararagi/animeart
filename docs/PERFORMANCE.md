# Performance

## Day 2 decisions

- Strokes are stored as compact point lists rather than bitmap snapshots.
- MOVE events append to the active stroke instead of creating an undo command per point.
- A completed stroke is one undo/redo operation.
- The active stroke is rendered directly by the existing Compose Canvas.
- Screen coordinates are converted to document coordinates; zoom/pan do not rewrite stored points.
- No bitmap is duplicated per touch event.
- Point append uses a small distance threshold to avoid redundant points.
- The renderer reuses the existing Canvas architecture; no parallel renderer was introduced.

## Low-RAM target

The design avoids full-document bitmap copies for undo. Future work should measure long-stroke point counts, Canvas frame time and persistence size on low-RAM Xiaomi/Redmi/POCO devices before introducing caches or sampling.
