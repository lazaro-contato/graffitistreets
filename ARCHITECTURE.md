# Graffiti Center — Project Context

A 3D city in the browser. You walk down a street in first person, pick a color,
and spray paint the walls. Paint builds up gradually — close to the wall it lands
tight and strong, far away it turns into mist.

**Stack:** Three.js `0.185.x` + Vite + TypeScript. The MVP is 100% client side,
but the architecture is already shaped for multiplayer "cities".

> `context.md` is the original full specification (written in Portuguese).
> This file is the working summary of what actually exists in the code.

---

## Language convention

**All code, identifiers, comments, commit messages and docs are written in
English.** Only `context.md`, the original spec, is in Portuguese.

---

## Current status

| Phase | Scope                                                       | Status |
| ----- | ----------------------------------------------------------- | ------ |
| 0     | Vite + TS + Three, `Engine`, `Loop`                          | Done   |
| 1     | Street, wall panels, player movement, pointer lock           | Done   |
| 2     | Spray system, stroke journal, palette, undo (**the MVP**)    | Done   |
| 2.1   | Continuous wall strips — seamless painting across panels     | Done   |
| 2.2   | Spray ring cursor, jump and crouch, corrected movement model  | Done   |
| 2.3   | Uniform wall resolution — round sprays, journal in world units | Done  |
| 2.4   | Backpack (I) with seven caps, data driven                     | Done   |
| 2.5   | Paint runs from over-spraying one spot                        | Done   |
| 3     | Polish: audio, IndexedDB persistence, PNG export, mobile     | To do  |
| 4     | Server persistence (journal + WebP snapshots)                | To do  |
| 5     | Multiplayer cities (Colyseus, avatars, lobby)                | To do  |

---

## The two decisions that carry the whole project

Everything else follows from these. They exist so that phase 5 does not require
rewriting phase 2.

### 1. Store strokes, not pixels

The source of truth is a chronological journal of `Stroke` objects, not the
panel bitmaps. The canvases are just a rendering of the journal.

A stroke is roughly 200 bytes; a panel PNG is roughly 500 KB. That difference is
what makes network sync viable at all, and the format gives away for free:

| Feature            | How it falls out of the journal                       |
| ------------------ | ----------------------------------------------------- |
| Undo               | Remove the stroke from the array, repaint the panel    |
| Local persistence  | Serialize the array to JSON                            |
| Multiplayer        | A `PaintMessage` already *is* the WebSocket packet     |
| Timelapse          | Replay in chronological order with a delay             |
| Moderation         | Drop one `authorId`'s strokes without wiping the wall  |

### 2. All painting goes through a Transport

No gameplay code touches a panel canvas directly. Every paint operation is sent
through `Transport.send()` and comes back through `Transport.onMessage()`.

In local mode `LocalTransport` echoes the message back instantly — you cannot
tell the layer is there. When `SocketTransport` arrives, the message goes to the
server and returns as a broadcast, and **nothing in `paint/`, `world/` or
`state/` changes.**

For the same reason, `authorId` is modeled from day one even with a single
player. Retrofitting identity into single player code means an optional
`authorId` scattered across thirty places.

---

## Paint runs

Hold the spray on one spot for `DRIP.HOLD_TIME` and the wall floods; gravity
takes over and a bead runs down, thinning as it goes and leaving a fat blob
where it dries.

The design point worth keeping: **a run is an ordinary `Stroke`**, appended to
over time as it descends. It is not a separate effect layer. That is what makes
undo, journal replay and future network sync work on runs with no extra code —
`stroke:append` already models "a mark that grows over time".

- `PaintSystem` watches how long the aim has sat still, measured **in meters on
  the wall**, not in UV: u spans 60 m and v spans 4 m, so a UV radius would be
  a flat ellipse. The tolerance scales with the cone.
- `DripSystem` owns the simulation and emits the points. The client that
  over-sprayed runs it; everyone else just receives strokes.
- Points are recorded by **distance travelled**, not per frame, so the trail is
  identical at 30 and 144 fps and a fast machine does not flood the journal.

---

## Caps

Seven caps: circle, square, triangle, flare, calligraphy, marker, roller.

A cap is **pure data** in `config.ts` — a base outline (ellipse, rect or
triangle), an aspect ratio, an angle, and how the paint comes out (size,
softness, flow, grain). Adding one is adding a row. There is no per-cap
branching in the brush, and the backpack and the cursor pick it up on their own.

Caps do not turn with the stroke. That is the point of the flat ones: a
calligraphy cap paints thick across its edge and thin along it.

Three things follow from the footprints not being circles:

- **`capExtent()`, not the radius, decides panel spill.** A roller reaches
  several times further sideways than its radius suggests and would be sliced
  in half at a seam otherwise.
- **The dab body is drawn in unit space**, with the context scaled to the
  cap's half extents. That stretches the radial gradient along with the shape;
  a circular gradient on a 4:1 roller reads as a blob with faded ends rather
  than a flat band. Grain is drawn outside that transform, so specks stay
  square.
- **Aspect never changes how much paint lands.** The half extents are solved
  so every cap covers the same area as a circle of the same radius; deliberate
  size differences live in `cap.size`, which `SprayCan.radiusAt` folds into the
  radius so every consumer sees one number.

The cursor outlines in `CapIcons.ts` are **generated** from `CapGeometry`, not
hand drawn. A hand-drawn icon drifts the first time a cap is retuned, and then
the cursor quietly lies about what the paint will do.

The cap is recorded **on the stroke**, not read from the can at render time —
otherwise replaying the journal would repaint old work with whatever cap is
fitted now.

---

## Movement model

Velocity chases a **target velocity** (`wish * stanceSpeed`) at an exponential
rate, rather than integrating a raw acceleration and damping it afterwards.

The original form — `v += A*dt; v *= exp(-D*dt)` — has a terminal speed of
`A / D`. With A=40 and D=12 that is 3.33 m/s, below `WALK_SPEED`, so the speed
constants were never reached and holding shift did nothing whatsoever. Chasing a
target hits them exactly, lets accelerating and stopping be tuned apart, and is
exact at any timestep.

Vertical motion steps position with the **average** velocity over the frame
(`v - g*dt/2`), which is exact for constant acceleration. Using the
start-of-frame velocity made the jump peak 0.70 m at 30 fps and 0.79 m at
240 fps; now it is 0.80 m everywhere.

Ground is flat at `y = 0` — the player floats over the 15 cm sidewalks rather
than stepping onto them. Curb collision would need step-up handling.

---

## One raycast per frame

`Aim` resolves the crosshair against the walls once per frame and publishes the
result. `PaintSystem` and `SprayCursor` both read it instead of raycasting on
their own.

This is a correctness requirement, not an optimisation: two independent
raycasts could disagree about whether a spot is reachable, and the on-screen
ring would promise paint that never lands. One shared result means the ring is
showing exactly when the spray would mark the wall.

---

## Strips, not panels

A wall side is **one continuous paint surface** (`WallStrip`). It is cut into
10 panel canvases for exactly one reason: to keep each texture upload small.
Panels are a rendering detail and nothing above `world/` should treat them as
logical units.

Strokes are therefore stored in **strip coordinates** — `u` runs 0..1 across
all 60 m of one wall — and a stroke belongs to a `side`, not to a panel.
Rendering distributes each dab into every panel it overlaps, and each canvas
clips its own share.

Treating panels as logical units caused three bugs at once, all fixed by this:

- The stroke was closed on every panel crossing, restarting the interpolation
  and leaving a gap on the seam
- A dab landing on a boundary was clipped in half, drawing a hard vertical cut
- Undo only removed the part of the stroke that happened to be on one panel

`WallPanel` lays its panels out along the direction its own `uv.x` grows —
towards -Z on the left wall, +Z on the right — which is what makes
`(index + uv.x) / PANELS_PER_SIDE` a continuous strip coordinate on both sides.
Verified: no discontinuity at any of the 18 internal boundaries.

---

## Data flow

```
  input (left button held)
        |
  PaintSystem      raycast -> strip UV + distance -> builds a StrokePoint
        |
  Transport.send(PaintMessage)
        |                        <- the network slots in here in phase 5
  Transport.onMessage
        |
  StrokeStore      appends to the journal
        |
  StrokeRenderer -> every panel the dab overlaps -> panel.dirty = true
        |
  WallSystem.flush() -> texture.needsUpdate   (once per frame)
```

The order inside the frame loop matters: **move -> paint -> flush -> render.**
Flushing after all paint logic is what keeps it to one texture upload per panel
per frame.

---

## File layout

```
src/
  config.ts                 every tunable constant
  main.ts                   bootstrap and wiring

  core/
    Engine.ts               renderer, scene, camera, resize
    Loop.ts                 requestAnimationFrame with delta clamp
    Input.ts                keyboard, mouse, pointer lock state
    Random.ts               seeded PRNG, for reproducible surfaces

  world/
    Street.ts               road, sidewalks, lights
    WallPanel.ts            mesh + canvas + CanvasTexture for one panel
    WallStrip.ts            one wall side as a continuous paint surface
    WallSystem.ts           both strips, raycast targets, dirty flush
    Colliders.ts            corridor clamp

  player/
    Player.ts               pointer lock + camera integration
    Movement.ts             acceleration, damping, collision response

  paint/
    Aim.ts                  resolves the crosshair against the walls, once a frame
    CapGeometry.ts          cap footprints: extents, sampling, falloff
    SprayCan.ts             current color, size, flow, nozzle
    Brush.ts                stamps one dab on a 2D context (pure function)
    DripSystem.ts           running paint, emitted as ordinary strokes
    PaintSystem.ts          raycast -> Stroke -> emits via Transport
    StrokeRenderer.ts       applies a Stroke to a strip, spilling across panels

  state/
    types.ts                Stroke, StrokePoint, PaintMessage
    StrokeStore.ts          per-side journal, undo, repaint, serialize

  net/
    Transport.ts            the interface
    LocalTransport.ts       instant echo, single player
    (SocketTransport.ts)    phase 5

  ui/
    styles.css
    Hud.ts                  palette, color shortcuts, alt + wheel resize
    Inventory.ts            the backpack, opened with I
    CapIcons.ts             cap outlines as SVG, generated from the same geometry
    SprayCursor.ts          the cap outline, sized to the real footprint
```

**Dependency rule: arrows always point downwards.** `paint/` knows `net/` only
through the `Transport` interface. `world/` knows nothing about `paint/`.
Nothing in `world/` or `player/` imports from `ui/`.

---

## Coordinate system

```
        Y (up)
        |
        +------ X (street width)
       /
      Z (street length)
```

- The street runs along **Z**, from `-30` to `+30`
- Width runs along **X**, from `-6` to `+6`
- Left wall at `x = -6`, paintable face looking towards `+X`
- Right wall at `x = +6`, paintable face looking towards `-X`
- Ground at `y = 0`, wall top at `y = 4`, player eyes at `y = 1.7`

`PlaneGeometry` is born on the XY plane with its normal at `+Z`. Rotating
`+PI/2` around Y aims it at `+X` (left wall); `-PI/2` aims it at `-X`.

UV `(0,0)` is the bottom-left corner seen from the front. Converting to canvas
pixels flips Y:

```ts
const px = uv.x * TEXTURE.SIZE;
const py = (1 - uv.y) * TEXTURE.SIZE;
```

---

## Things that will bite you

- **`intersection.uv` comes back `undefined`** if the geometry has no `uv`
  attribute. `PlaneGeometry` has one, but a custom mesh or an unmapped GLTF
  would break silently. Always guard with `if (!hit.uv) return;`.
- **Upside-down texture.** UV v grows up, canvas y grows down. The conversion is
  `(1 - uv.y) * PANEL_TEXTURE_HEIGHT`.
- **Never hardcode a canvas dimension.** Panels are rectangular (1152 x 768).
  Anything that assumes a square canvas silently reintroduces the ellipse bug.
- **Stroke radii are stored in meters, not pixels.** That keeps the journal
  independent of `TEXTURE.PIXELS_PER_METER`, so changing the resolution replays
  old strokes at the right physical size instead of rescaling every tag.
- **Washed out or too dark colors.** Any texture carrying color needs
  `texture.colorSpace = THREE.SRGBColorSpace`, otherwise the conversion is
  applied twice.
- **Dotted strokes.** Without interpolation between the previous point and the
  current one, a fast mouse produces spaced blobs. See `StrokeRenderer`.
- **Seams between panels.** Handled: dabs spill into every panel they overlap
  and strokes interpolate in strip space. Any new code that draws on a wall must
  go through `StrokeRenderer`, never straight to a single `panel.ctx`.
- **Anything drawn from the journal must be deterministic.** `paintBase()` is
  seeded from the panel id for this reason — an undo repaints panels, and a
  random base would visibly reshuffle the concrete under surviving paint. Spray
  speckles are still `Math.random()`: the grain differs slightly after a
  repaint, which is imperceptible, but exact snapshots would need seeding too.
- **Pointer lock refused.** `controls.lock()` only works from a real user
  gesture, hence the "Enter the city" overlay.
- **`getObject()` no longer exists.** In Three.js 0.185, `PointerLockControls`
  extends `Controls` and exposes the camera as `controls.object`.
- **GPU memory leaks.** If the world is ever rebuilt, call `dispose()` on the
  old geometries, materials and textures. `WallPanel.dispose()` and
  `WallSystem.dispose()` exist for this.

---

## Performance notes

- **Memory budget:** `TEXTURE.PIXELS_PER_METER` is the single knob. At 192 the
  panels are 1152 x 768 and 20 of them cost ~68 MB of VRAM; 256 costs ~120 MB.
  Both dimensions are derived from it, so the resolution stays uniform on both
  axes — a square canvas on a 6 x 4 m panel is what used to turn every spray
  into an ellipse.
- **The real cost is the texture upload.** `texture.needsUpdate = true` resends
  the whole canvas to the GPU. Never set it inside the dab loop; the
  `dirty` + `flush` pair already collapses it to one upload per panel per frame.
- **Stroke sampling is fixed at 60 Hz**, not per frame. On a 165 Hz monitor a
  per-frame sample would lay down more points per second and paint darker.
- **If performance gets tight, in order:** drop `TEXTURE.SIZE` to 512, lower
  `SPRAY.SPECKLES`, keep `getImageData`/`putImageData` out of the loop, and only
  then consider migrating to a `WebGLRenderTarget` brush pass.

---

## Commands

```bash
npm run dev        # dev server
npm run typecheck  # tsc --noEmit
npm run build      # tsc + vite build -> dist/
npm run preview    # serve the production build
```

Node is managed by nvm; this project is verified on Node 20.19.4.

## Controls

| Input        | Action                   |
| ------------ | ------------------------ |
| WASD / arrows| Walk                     |
| Shift        | Run                      |
| Space        | Jump (hold to keep hopping) |
| Ctrl         | Crouch (hold)            |
| Mouse        | Look                     |
| Left click   | Spray (hold)             |
| Alt + wheel  | Spray cone size          |
| I            | Open / close the nozzle inventory |
| 1-9, 0       | Pick a palette color     |
| Ctrl/Cmd + Z | Undo your last stroke    |
| Esc          | Release pointer lock     |

> Ctrl doubles as crouch and as the undo chord, so Ctrl+Z dips the camera for
> as long as the key is held. On macOS use Cmd+Z and the two never overlap.
