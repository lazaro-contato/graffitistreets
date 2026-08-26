# Wall surface

Drop three seamless (tileable) files here and the walls pick them up on the
next reload. Any that are missing fall back to the procedural concrete, so it
is fine to add only the albedo.

| File            | Poly Haven / ambientCG name  |
| --------------- | ---------------------------- |
| `albedo.jpg`    | Diffuse, or Color / Albedo   |
| `normal.jpg`    | **Normal (GL)** — not DirectX |
| `roughness.jpg` | Rough / Roughness            |

**1K is already more than enough.** A 2 m tile is drawn at 384 px, because the
wall renders at 192 px per metre — a 2K file is downscaled 5x for nothing.

Sources, all CC0: polyhaven.com/textures, ambientcg.com

`SURFACE` in `src/config.ts` holds the paths and the tile size.
