# Wall surfaces

A folder per texture, not per wall, and `surfaces.json` next to those folders
lists what the game offers. Both sides can share a texture or use different
ones, and either can be changed from the settings while the game is running —
the paint on the wall survives it, because strokes are the source of truth and
the journal is replayed over the new base coat.

```
public/wall/surfaces.json
public/wall/<slug>/albedo.jpg
public/wall/<slug>/normal.jpg
public/wall/<slug>/roughness.jpg
```

## The manifest

Adding a surface is an entry plus the files it names. No TypeScript, no
rebuild of anything but the static site.

```json
{
  "slug": "concrete031",
  "title": "Concrete 031",
  "city": null,
  "country": null,
  "author": "ambientCG",
  "licence": "CC0-1.0",
  "sourceUrl": "https://ambientcg.com/view?id=Concrete031",
  "tileMeters": 2.4
}
```

| Field | |
| --- | --- |
| `slug` | The folder name, and a URL path segment. Lowercase, digits and hyphens |
| `title` | What the picker shows. A name, not copy — it is never translated |
| `city`, `country` | Where the wall is, or `null` |
| `author` | Who took the photograph or made the texture |
| `licence` | An SPDX identifier where there is one: `CC0-1.0`, `CC-BY-4.0` |
| `sourceUrl` | Where it came from, or `null` |
| `tileMeters` | How much real wall one tile of it covers |

`licence` and `author` are required. [ASSETS.md](../../ASSETS.md) is this
repository's record of who owns what, and a surface that cannot say where it
came from cannot ship in it — so a contributed surface adds a line there too.

A malformed entry is dropped and the rest of the list still loads. A manifest
that is missing or unparseable falls back to the one built-in surface, the same
way a missing image file falls back to procedural concrete.

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
