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


## AA-PIXEL-PERF-002: benchmarks and allocation pressure (2026-10-18)

- Recoloring now reuses small HSL/RGB scratch arrays within one operation instead of allocating several arrays for every opaque pixel. This is important at 4–16 megapixels, where per-pixel temporary arrays can create millions of short-lived objects and garbage-collection pressure.
- Connected-background flood fill no longer creates a fresh neighbors array for every visited pixel. It visits up to four neighbors directly through one reusable function, reducing allocation churn while preserving the existing connectivity, edge-protection and feather behavior.
- The command npm run benchmark:image-processing executes isolated-process scenarios for 4 MP (2000×2000), 8 MP (4000×2000) and 16 MP (4000×4000) inputs. It reports wall time, CPU time, resident-memory peak and external memory for selective recolor, connected-background removal and a manual erase stroke.
- The benchmark uses the same pixel-domain functions as the Worker and enables in-place mutation as the Worker does. It is not a measurement of Android WebView overhead, GPU work, battery drain or total end-to-end editor memory. CI timing is diagnostic and deliberately has no machine-specific performance threshold.
- A single RGBA buffer requires about 4 MiB per megapixel (16 MP ≈ 64 MiB). Connected-background removal also uses a visited bitmap and an integer work queue; the queue can approach another 64 MiB at 16 MP. The benchmark will make this cost visible rather than treating the Worker as a reduction in total memory.
- Physical acceptance still requires the same import/edit/undo/export scenarios on the Xiaomi 24116RACCG, with battery and application memory measured on-device. A green CI run does not close that requirement.


### Baseline benchmark results before circular-queue optimization

Web CI run [#39108544039](https://github.com/jonhararagi/animeart/actions/runs/39108544039), HEAD 8ac64787ee3e7c7049bb01b05ef8e1edaf586198, ran all nine scenarios successfully on the Ubuntu GitHub runner:

| Pixels | Recolor time / peak RSS | Connected-background time / peak RSS | Single-stroke erase time / peak RSS |
| --- | --- | --- | --- |
| 4 MP | 121 ms / 69.2 MiB | 101.3 ms / 88.1 MiB | 0.3 ms / 66.2 MiB |
| 8 MP | 213.1 ms / 84.5 MiB | 237.2 ms / 122 MiB | 0.3 ms / 81.5 MiB |
| 16 MP | 411.6 ms / 114.8 MiB | 379.1 ms / 191.3 MiB | 0.3 ms / 112.2 MiB |

The high 16 MP background-removal peak was the reason for the next targeted change: replace the fixed full-document integer queue with a circular queue sized initially to the image perimeter and grown only if the active frontier actually needs more space. These measurements are Node/Linux synthetic-input diagnostics, not values observed on Android.
