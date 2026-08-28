# Graffiti Streets

Read [ARCHITECTURE.md](ARCHITECTURE.md) first — it is the general project
context: stack, current phase, data flow, file layout, coordinate system and the
known pitfalls. `context.md` is the original full spec, in Portuguese.

## Conventions

- **All code, identifiers, comments, commit messages and docs are in English.**
  The only Portuguese file is `context.md`.
- **User-facing copy is in Portuguese** — menus, the backpack, control lists.
  Only the string values; identifiers like `label` and `hint` stay English.
  Graffiti terms that the scene itself uses in English stay that way: `cap`,
  `flare`.
- Every tunable number lives in `src/config.ts` if it applies everywhere, or in
  a map file under `src/maps/` if it belongs to one street. Do not hardcode
  magic numbers in systems, and never import a world dimension as a module
  constant — wall lengths, heights, panel counts and pixel densities come off
  `MapMetrics` or off the `WallStrip` carrying them.
- A `mapId` and a wall's `SurfaceId` are stored on every stroke, so they are
  persistence format. Renaming one orphans every stroke painted on it.
- No gameplay code touches a panel canvas directly. Painting always goes through
  `Transport.send()` and comes back via `Transport.onMessage()`.
- Strokes are the source of truth, not pixels. Anything that mutates a wall must
  be expressible as a `PaintMessage`.
- Anything a map owns must be freed when the map is torn down. `Arena.dispose()`
  is the single entry point; a leaked geometry, material or texture is invisible
  to the garbage collector.
- Dependency direction: `ui/` -> `paint/`/`player/` -> `world/`/`state/`/`net/`
  -> `core/`/`config`. Never import upwards.
- Run `npm run typecheck` before calling a change done.

## Environment

Node comes from nvm and is not on the default PATH in non-interactive shells:

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"
```
