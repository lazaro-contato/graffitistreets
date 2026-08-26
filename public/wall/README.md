# Wall surfaces

A folder per texture, not per wall, and `SURFACES` in `src/config.ts` points
each side at one of them. Both sides can share a texture or use different ones,
and swapping a wall is one line.

```
public/wall/<name>/albedo.jpg
public/wall/<name>/normal.jpg
public/wall/<name>/roughness.jpg
```

Any file that is missing falls back to the procedural concrete, so dressing
only one wall — or only supplying an albedo — is fine.

The road works the same way, from `public/road/`. Its tile is deliberately the
full width of the street: the photograph has a painted line down its edge, and
at one tile across with half a tile of offset that line lands on the centre of
the alley instead of vanishing under a kerb.

| File            | Called this on Poly Haven / ambientCG |
| --------------- | ------------------------------------- |
| `albedo.jpg`    | Diffuse, or Color / Albedo            |
| `normal.jpg`    | **Normal (GL)** — never the DirectX one |
| `roughness.jpg` | Rough / Roughness                     |

Three things that matter:

- **The texture must be seamless.** Poly Haven and ambientCG only publish
  tileable ones; a plain photo of a wall shows its seam every couple of metres.
- **Normal must be the OpenGL variant.** Three.js expects green-up. The DirectX
  one inverts the relief and lights it from the wrong side, which looks subtly
  wrong without ever looking obviously broken.
- **1K is already oversized.** The wall renders at 192 px per metre, so a 2 m
  tile is drawn at 384 px. A 2K file is downscaled five times over.

Set `tileMeters` to however much real wall one tile of that photo covers. A
source that is not square is fine — its aspect is honoured, so a 1024x715 photo
covers a patch that is not square either.

If the pack ships an **AmbientOcclusion** map, multiply it into the albedo when
converting. The material's own `aoMap` wants a second UV set the panels do not
have, and baking it costs nothing at run time.

Sources, both CC0: polyhaven.com/textures, ambientcg.com
