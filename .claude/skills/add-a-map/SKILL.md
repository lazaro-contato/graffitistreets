---
name: add-a-map
description: Add a second scene or change the arena — what WORLD assumes, what is derived from it, and what silently breaks when the geometry moves. Use before touching WORLD, Street.ts, WallSystem or Colliders.
---

# Add a map

The scene is currently one alley, and a good deal of the code assumes exactly
that. None of the assumptions are hidden, but they are spread out, and moving
the geometry without moving them is how you get a wall you can paint through.

## What everything derives from

`WORLD` in `src/config.ts` is the origin of all of it:
`STREET_LENGTH`, `STREET_WIDTH`, `WALL_HEIGHT`, `PANEL_WIDTH`, plus the
enclosure numbers. From those come:

- `PANELS_PER_SIDE` — `STREET_LENGTH / PANEL_WIDTH`, and it must divide evenly.
  A fractional panel count produces a strip whose coordinates no longer line up
  with its panels, and the symptom is paint tearing near one end.
- `WALL_X`, `HALF_LENGTH` — the wall planes and the extent.
- `PANEL_TEXTURE_WIDTH/HEIGHT` and `STRIP_WIDTH_PX` — canvas size, through
  `TEXTURE.PIXELS_PER_METER`. Make the alley much longer and you are allocating
  a proportionally larger canvas per side; check the total before assuming it
  is free.
- `PLAYER.FLY_CEILING` — relative to wall height, not absolute.

Change `WORLD` and read the whole file for what falls out of it. Do not
hardcode a new number anywhere else.

## The pieces that would need to become plural

Today these each assume one alley:

- **`Street.ts`** builds ground, enclosure, coping, end blocks, the two lamps
  and the night sky in one function.
- **`WallSystem`** builds exactly two strips, left and right.
- **`Colliders`** are derived from the same constants.
- **`Billboard`** places ad panels on the end blocks — the only eye-height
  surface that is not paintable.

A second map means turning `WORLD` from a constant into one of several specs
and passing the chosen one down, rather than adding a branch inside each of
those. Keep the same shape: a map is data, like a cap is data.

## What is easy to forget

- **Lighting is physical.** `LAMP` values are candela and fall off with the
  square of distance. Doubling the length of the street does not need double
  the lamps; it needs the illuminance measured at the wall. Measure before
  changing intensity — a previous attempt to fix the lighting by raising the
  fill was wrong, and the real problem was where the lamps pointed.
- **The loading bar counts real files.** `LoadingScreen` is constructed with a
  count of what will be awaited. Add textures and that number has to change, or
  the bar lies.
- **`SPRAY.MAX_DISTANCE` is 2 m.** A wider street does not change how far you
  can spray from; it changes how much walking there is between walls.

## Check

Paint across every seam of every wall. Fly to the ceiling and confirm it is
still just above the wall. Walk the perimeter and confirm you cannot leave.
Then follow `verify-a-change`.
