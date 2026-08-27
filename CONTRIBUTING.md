# Contributing

Bugs, ideas and pull requests are all welcome. This is a small project, so
there is not much ceremony — but there are a few conventions that keep it
coherent, and they are worth two minutes before you write code.

## Getting set up

Node 20 or newer.

```bash
npm install
npm run dev
```

No configuration is needed. Copy `.env.example` to `.env.local` only if you
want the optional pieces — analytics, the form links — and leave it out
otherwise.

Before you open a pull request:

```bash
npm run typecheck
npm run build
```

Both run in CI on every pull request, so this only saves you a round trip.

## Conventions

**Everything is in English** — code, identifiers, comments, commit messages,
documentation. The single exception is `context.md`, the original Portuguese
specification, kept as it was written.

**The interface is in Portuguese and English**, and only the string values.
Identifiers like `label` and `hint` stay English. Graffiti words the scene
itself uses — `cap`, `flare` — stay untranslated in both languages, because
that is what they are called in both.

Copy lives in `src/i18n/strings.ts`, never inline. Both languages have to carry
the same keys.

**Every tunable number lives in `src/config.ts`.** If you find yourself typing
a number into a system file, it belongs in config with a name and a sentence
about why it is that number and not another.

**Strokes are the source of truth, not pixels.** Nothing mutates a wall canvas
directly. Anything that changes what is painted has to be expressible as a
`PaintMessage`, sent through `Transport.send()` and received through
`Transport.onMessage()`. That seam is what makes undo exact and multiplayer
possible later; going around it looks like it works and quietly breaks both.

**Dependency direction is one-way:**

```
ui/ → paint/, player/ → world/, state/, net/ → core/, config
```

Never import upwards.

## Comments

Comments explain **why**, not what. The code already says what it does; what it
cannot say is the constraint that made it that shape — the browser behaviour
being worked around, the number that came from measuring, the simpler approach
that was tried and failed. Those are worth writing down. `x++ // increment x`
is not.

## Pull requests

Keep them to one thing. A change that fixes a bug and also renames three files
is two pull requests, and reviewing it is harder than either would have been.

Say what you changed and why. If it is visual, a screenshot saves a paragraph.
If it came from measuring something, put the numbers in — that is the most
useful thing a description can contain.

## Licence

This project is under the AGPL-3.0-or-later, and contributions are accepted
under the same terms. By opening a pull request you are offering your changes
under that licence.

Note that the artwork is **not** under the AGPL — see [ASSETS.md](ASSETS.md).
Please do not include images in a pull request without saying where they came
from and under what terms.
