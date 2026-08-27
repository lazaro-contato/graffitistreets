## What this changes

<!-- One or two sentences. If it is visual, a screenshot says it faster. -->

## Why

<!-- The part the diff cannot show: the constraint, the bug, the thing that was
     tried first and did not work. If you measured something, the numbers are
     the most useful thing you can put here. -->

## Checks

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Any new number lives in `src/config.ts`, not in a system file
- [ ] Any new copy is in `src/i18n/strings.ts`, in both languages
- [ ] Any wall change goes through `Transport.send()` rather than touching a canvas
