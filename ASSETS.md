# Assets

The code in this repository is under the AGPL-3.0-or-later. **The artwork is
not**, and this file says what belongs to whom.

Two licences in one project is normal for a game, and the reason is simple: the
engine is worth sharing, and the identity is not the engine. Anyone should be
able to build a painting game on this. Nobody should be able to publish
Graffiti Streets.

## Not covered by the AGPL

Everything below is © José Lázaro, all rights reserved. It was generated with
AI image tools and then edited for this project.

| File | What it is |
| --- | --- |
| `public/og.jpg` | The logo over the alley wall — the share image |
| `public/main-loading.webp` | The logo on its nail, shown while the world builds |
| `public/shark.webp` | The shark, on the front screen |
| `public/menu-bg.jpg` | The lit alley behind the menu |
| `public/loading-bg.jpg` | The tagged wall behind the loading screen |
| `public/favicon.ico`, `public/favicon-96.png`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` | The shark, as icons |
| `public/ads/*` | Placeholder artwork for the ad panels |

If you fork this, remove them and bring your own. The code will run with an
empty `public/` for everything except the wall and road textures below, and it
will not pretend otherwise — missing artwork is a missing image, not a crash.

## Wall and road textures

`public/wall/concrete031/` and `public/road/` are photographic PBR sets —
albedo, normal, roughness — from [ambientCG](https://ambientcg.com).

Their whole library is released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): public domain,
no attribution required, commercial use fine, redistribution fine. So these
files travel with the repository without conditions, and a fork can keep them.

The wall set is **Concrete031**, which is where the folder name comes from. The
road set's identifier was not recorded, which changes nothing — every asset on
the site carries the same dedication.

Attribution is not required and is given anyway: ambientCG is the reason this
alley has a surface instead of a flat colour.

## Fonts

**Aldrich**, loaded from Google Fonts at runtime rather than bundled. It is
under the SIL Open Font License 1.1. No font files are committed here.

## Third-party code

Dependencies are declared in `package.json` and carry their own licences.
Three.js is MIT.
