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

## Day 3 decisions

- Layer operations use immutable data copies at operation boundaries; no full bitmap snapshot is created.
- Transform gestures mutate only the selected layer's Transform during the gesture and create one history command at gesture completion.
- DuplicateLayer copies stroke lists and point lists so the original and duplicate do not share mutable list instances.
- Layer selection/visibility/lock/opacity changes do not rasterize the document.
- The selection overlay is generated only for the selected layer while Transform mode is active.
- Layer transform is applied at render time instead of rewriting stroke coordinates.

## Low-RAM target

The design avoids full-document bitmap copies for undo. Future work should measure long-stroke point counts, Canvas frame time and persistence size on low-RAM Xiaomi/Redmi/POCO devices before introducing caches or sampling.

## Watch points

- Very large layer stroke counts can increase Compose draw work.
- The JSON recovery store grows with point count.
- Future handles, selection hit-testing and reference images should avoid per-frame allocations.
- Do not introduce bitmap snapshots for transform undo unless profiling proves they are necessary.


## Day 4 — Reference image performance

- Reference source bytes are copied once into app-private project storage instead of duplicating a bitmap in the document JSON.
- Preview decode uses bounds inspection and controlled `inSampleSize` with a 2048px maximum dimension by default.
- Reference bitmaps are cached by layer ID in the Compose screen and loaded off the main thread.
- Layer transforms remain non-destructive; moving/scaling/rotating a reference does not rasterize or duplicate it.
- Drawing strokes remain vector-like point lists and cannot be appended to a reference layer; tracing uses a separate normal drawing layer above the reference.
- Existing warnings about `libandroidx.graphics.path.so` stripping and GitHub Actions Node 20 are non-blocking and pre-existing.
