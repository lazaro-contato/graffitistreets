---
name: verify-a-change
description: How to prove a change to this project actually works before calling it done — what to measure, how to check a commit builds from nothing, and when a browser test is worth the trouble. Use at the end of any non-trivial change.
---

# Verify a change

This project has few regressions for one reason: changes are measured rather
than assumed. Several times the measurement contradicted a confident hypothesis
and stopped a wrong change from landing — most memorably a lighting "fix" that
would have made the alley worse, where the real problem turned out to be where
the lamps were aimed, not how bright they were.

## Always

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"
npm run typecheck
npm run build
```

Node comes from nvm and is not on the PATH in non-interactive shells.

## Measure before and after, not just after

A number on its own proves nothing. Capture the same measurement on the current
code first, then on the change, and put both in the commit message. This is
what separates "the drip looks better" from "the drip starts at 25% of spray
width and narrows by 0.9 per segment, measured across four hold durations".

If a change is meant to fix something, write the measurement that would have
caught the bug. If it cannot be measured, say so explicitly rather than
implying it was checked.

## Prove the commit builds from nothing

Working directories lie: an untracked file the build needs will not show up
until somebody else clones. Extract the commit and build it clean.

```bash
W=$(mktemp -d)/wt
git worktree add --detach -q "$W" HEAD
(cd "$W" && npm ci --silent && npm run typecheck && npm run build)
git worktree remove --force "$W"; git worktree prune
```

Build **with no environment configured**. That is what CI does and what a
contributor gets, and a build that only passes with variables present is broken
for everyone else.

## Browser tests, when it is visual

Playwright is not a dependency — install it only for the run:

```bash
npm i --no-save playwright
```

Serve `dist/` from a small node server and assert geometry, computed styles and
requests rather than eyeballing. Screenshots are for the final look; numbers
are for the claim.

Two traps that will waste your time:

- **The game page never settles.** The WebGL loop renders forever, so
  `page.screenshot()` times out. Use `reducedMotion: "reduce"` on the context,
  and prefer asserting over capturing on that page.
- **Hashed filenames break name-based greps.** Match on file size or on the
  exact hash read from `dist/`, never on a pattern like `main-*.js`.

Delete the test file when you are done; it does not belong in the repository.

## Before saying it is done

- typecheck and build pass
- the commit builds in a clean worktree with `npm ci`
- anything visual was checked at 1440 and at 390 px
- both locales still have the same keys in `src/i18n/strings.ts`
- the numbers are in the commit message

If a step was skipped, say which and why. Reporting a change as verified when
it was not is worse than not verifying it.
