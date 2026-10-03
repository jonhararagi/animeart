# Performance

Day 1 rules:
- Avoid unnecessary image duplication.
- Keep image processing out of UI code.
- Keep domain models independent from bitmap ownership.
- Limit initial dependencies.
- Keep Compose state narrow to avoid unnecessary recomposition.
- Persist recovery state as a compact layer snapshot rather than a giant project format.

Future work must define bitmap lifecycle, sampling/downscaling, renderer invalidation and memory-pressure behavior for low-RAM Xiaomi/Redmi/POCO devices.
