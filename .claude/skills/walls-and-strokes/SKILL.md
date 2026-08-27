---
name: walls-and-strokes
description: Read before changing anything that paints, erases, undoes or draws on a wall — the stroke journal, WallStrip, WallPanel, PaintSystem, DripSystem, StrokeRenderer or Transport. Carries the invariants that most of this project's bugs came from breaking.
---

# Walls and strokes

Almost every serious bug in this project came from breaking one of the four
rules below. None of them came from not knowing Three.js.

## 1. Strokes are the source of truth, not pixels

A wall canvas is a *rendering* of the journal, never the record itself.
Anything that changes what is painted has to be expressible as a
`PaintMessage`, go out through `Transport.send()`, and come back through
`Transport.onMessage()`. The canvas is only ever written by the code that
replays messages.

Painting a canvas directly appears to work. It breaks undo silently, it cannot
be rebuilt, and it makes multiplayer impossible later — the whole point of the
`Transport` seam is that a networked version is a different implementation of
it rather than a rewrite.

If you catch yourself reaching for a `CanvasRenderingContext2D` outside
`StrokeRenderer`, stop.

## 2. A wall side is one continuous surface

`WallStrip` owns the coordinate system; `WallPanel` exists only so uploads can
be granular. Coordinates run across the whole strip, not per panel.

`WallPanel` lays panels out along their own uv.x direction:

```ts
const uvDirection = side === "left" ? -1 : 1;
```

so that `(index + uv.x) / PANELS_PER_SIDE` is continuous across a seam. Treat a
panel as a logical unit and a stroke crossing a seam resets its pattern — this
was the first real bug in the project and it is easy to reintroduce.

## 3. The base coat is seeded, never random

`paintBase()` derives its noise from the panel id through a seeded PRNG. It
must be a pure function of that id.

Use `Math.random()` and the concrete reshuffles itself on every undo, because
undo repaints the base and replays the journal on top. It looks like the wall
is flickering for no reason.

## 4. Canvas pixels are not square metres

`TEXTURE.PIXELS_PER_METER` exists because a panel is 4 m × 3 m, not square. A
brush that thinks in pixels paints an ellipse on a wall. Everything that has a
size in the world converts through that constant.

The same trap in a second place: `tileMap()` honours the source aspect ratio.

```ts
const tileHeight = tileWidth * (image.height / image.width);
```

Assume the normal map is square and it drifts out of register with the albedo
over the length of the wall — subtle enough that you will not see it in a
screenshot, obvious once you look for it.

## Before you finish

- The change is expressible as a `PaintMessage`
- Undo still produces exactly the previous state, base coat included
- A stroke drawn across a seam is continuous
- A round cap still paints a circle, at both ends of the range
- Nothing outside `StrokeRenderer` touched a canvas context

Then follow `verify-a-change`.
