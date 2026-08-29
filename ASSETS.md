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

## City wall surfaces

`public/wall/` also holds fourteen wall surfaces contributed by **Jackson
Mafra** (jackson.mafra@umain.com), released under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): free to use and to
build on, including commercially, as long as the credit above travels with
them. The manifest carries that credit per surface, and the picker shows it on
screen.

They were **generated with AI image tools**, like the artwork above, and then
resized and colour-corrected for this project. That matters for what they are:
each one is a plausible wall *from* a place, not a photograph *of* one. Every
entry has `sourceUrl: null`, and that is the honest value rather than a missing
one.

| City | Surfaces |
| --- | --- |
| Stockholm, Sweden | `stockholm-gamla-stan`, `stockholm-sodermalm`, `stockholm-snosatra` |
| São Paulo, Brazil | `sao-paulo-beco-do-batman`, `sao-paulo-minhocao`, `sao-paulo-estacao-da-luz` |
| Rio de Janeiro, Brazil | `rio-arcos-da-lapa`, `rio-lapa-azulejo`, `rio-santa-teresa` |
| Porto Alegre, Brazil | `porto-alegre-gasometro`, `porto-alegre-viaduto-otavio-rocha` |
| Itajaí, Brazil | `itajai-porto`, `itajai-centro-historico`, `itajai-cabecudas` |

None of them reproduces anybody else's work, and that was a constraint on the
way in rather than a check on the way out. The two walls that would obviously
carry graffiti — Snösätra and the Beco do Batman — hold roller and spray layers
with no legible letters or figures, because a texture of somebody's piece is a
derivative of their piece. The Rio tilework is the neighbourhood's own broken
tile vernacular and deliberately **not** the Escadaria Selarón, which is a
signed work by a named artist.

## Fonts

**Aldrich**, loaded from Google Fonts at runtime rather than bundled. It is
under the SIL Open Font License 1.1. No font files are committed here.

## Third-party code

Dependencies are declared in `package.json` and carry their own licences.
Three.js is MIT.
