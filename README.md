# Graffiti Streets

[![licence: AGPL-3.0](https://img.shields.io/badge/licence-AGPL--3.0-blue)](LICENSE)
[![CI](https://github.com/lazaro-contato/graffitistreets/actions/workflows/ci.yml/badge.svg)](https://github.com/lazaro-contato/graffitistreets/actions/workflows/ci.yml)
[![three.js](https://img.shields.io/badge/three.js-r185-000000?logo=three.js)](https://threejs.org)
[![typescript](https://img.shields.io/badge/typescript-5.6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![vite](https://img.shields.io/badge/vite-7-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![play](https://img.shields.io/badge/play-graffiti--streets.com-39ff14)](https://graffiti-streets.com)

**AI generated & AI friendly** — written in pair with Claude, and the
conventions that keep it coherent are in [CLAUDE.md](CLAUDE.md) and
[CONTRIBUTING.md](CONTRIBUTING.md).

![Graffiti Streets](public/og.jpg)

**Paint graffiti in the browser, with no install and no account.** There is
nothing to win here — the point is what you make, and the
[gallery](https://graffiti-streets.com/gallery/) is where it goes.

▶ **Play:** <https://graffiti-streets.com>

---

## Start here

| You are… | Read |
| --- | --- |
| curious | this page, then <https://graffiti-streets.com> |
| new to the code (or an agent) | [ARCHITECTURE.md](ARCHITECTURE.md) → [CONTRIBUTING.md](CONTRIBUTING.md) |
| about to change how painting works | [ARCHITECTURE.md](ARCHITECTURE.md), the section on strokes |
| wondering who owns the art | [ASSETS.md](ASSETS.md) — the code and the images are under different terms |
| after the original brief | [context.md](context.md) — in Portuguese, the only file that is |

## What it is

A first-person painting toy. You walk — or fly — down a lit alley at night and
paint the walls. The can behaves like a can: the closer you stand, the tighter
and more saturated the cone, and holding still long enough in one place makes
the paint run.

- **Six caps.** Circle, square and flare take their width from your distance to
  the wall. Roller, marker and calligraphy keep the width you set, which makes
  them closer to drawing instruments than to a can.
- **Paint runs.** Hold in one place and it drips — wider at the top, tapering
  as it falls, in proportion to how long you held.
- **Two ways to move.** On foot, or free flight up to just above the wall.
- **Photograph it.** Press <kbd>P</kbd> and the frame renders again at a higher
  pixel ratio, so the picture is sharper than the screen it came from.
- **Two languages.** Portuguese and English, taken from the browser and
  switchable in the menu.

## By the numbers

Every row can be checked from a clean clone.

| What | How much | Check it with |
| --- | ---: | --- |
| TypeScript | 4,871 lines in 43 files | `git ls-files 'src/**/*.ts' \| xargs wc -l` |
| Runtime dependencies | 1 — Three.js | `node -p "Object.keys(require('./package.json').dependencies)"` |
| Caps and tools | 6, in 2 categories | the `CAPS` array in `src/config.ts` |
| Palette | 10 colours | the `PALETTE` array in `src/config.ts` |
| Interface strings | 90 keys per language | `src/i18n/strings.ts` |
| First visit | ~139 kB of JavaScript, gzipped | `npm run build` |

## What it does not do yet

Written down because a README that only lists what works is not much use.

- **No multiplayer.** The seam is there and nothing is behind it: `src/net/`
  holds a `Transport` interface and a `LocalTransport` that talks to itself.
  A networked version is another implementation of that interface rather than a
  rewrite — which is the whole reason strokes, not pixels, are the record.
- **Desktop only.** A phone gets a screen saying so and a way to the gallery.
  Pointer lock needs a pointer to lock and walking needs keys to walk with, and
  a finger is neither. See `src/boot.ts`.
- **The gallery is curated by hand.** Submissions arrive through a form and get
  added to `public/gallery/index.json`. There is no upload path in the app.
- **The ad panels are built and switched off.** `ADS.ENABLED` is `false`, so
  they are not constructed and their artwork is not fetched.

## Running it

Node 20 or newer.

```bash
npm install
npm run dev
```

That is the whole setup. Configuration is optional — see
[.env.example](.env.example) — and a checkout with none of it still builds and
runs. What is not configured simply does not appear: no analytics id means no
tracker is ever loaded, no form URL means no button.

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck, then bundle into dist/
npm run preview     # serve the built site
```

CI runs the same typecheck and build on every pull request, with no environment
configured at all — because that is what a contributor gets.

## How it is put together

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the long version. The three ideas
that shape everything else:

**Strokes are the source of truth, not pixels.** Painting never touches a
canvas directly — it produces a message, the message goes through
`Transport.send()`, and the wall redraws from the journal. That seam is why
undo is exact, why a wall can be rebuilt from nothing, and why multiplayer is a
different `Transport` rather than a rewrite.

**A wall side is one continuous surface.** Panels exist only so uploads can be
granular; the coordinate system runs across the whole strip, which is why a
stroke crossing a seam does not break.

**Every tunable number lives in [src/config.ts](src/config.ts).** Cap sizes,
spray falloff, drip growth, lamp candela, movement modes. Nothing is hardcoded
in a system.

Dependency direction is one-way: `ui/` → `paint/`/`player/` →
`world/`/`state/`/`net/` → `core/`/`config`.

## Contributing

Bugs, ideas and pull requests are welcome — start with
[CONTRIBUTING.md](CONTRIBUTING.md). There is a
[form for bug reports](https://forms.gle/3tLcqLXkfLgpG78j9) too, for anyone who
would rather not open an issue.

## Licence

The code is under the **GNU Affero General Public License v3.0 or later**. See
[LICENSE](LICENSE).

In plain terms: you may use, study, change and redistribute it, and if you run
a modified version on a server other people use, you have to offer them your
source too. That last part is what the *Affero* in the name is for, and it is
the reason this licence rather than a permissive one.

**The artwork is not covered by it.** The logo, the shark, the alley images and
everything else in [public/](public/) belong to the author and are excluded;
the wall and road textures are ambientCG, public domain. See
[ASSETS.md](ASSETS.md). Fork the engine freely — bring your own art.
