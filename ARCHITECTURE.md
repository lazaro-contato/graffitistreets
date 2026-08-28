# Graffiti Streets — Project Context

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
| 2.6   | Range-driven cone, caps split from tools                      | Done   |
| 2.7   | Smaller arena (8 x 3 m walls) and a free flight mode          | Done   |
| 2.8   | Menu: main, pause, controls, and mode as a setting            | Done   |
| 2.9   | Menu artwork, display face, loading spinner, Portuguese copy  | Done   |
| 2.10  | Maps as data: three streets, chosen in the menu                | Done   |
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

## Maps

A map is data, the same way a cap is data: `src/maps/` holds one file per
street — dimensions, which photography dresses each wall, the weather, and
where the lamps stand. `measure()` works out everything derivable from it
once. Adding a street is adding a file and two strings; nothing branches on
which one is loaded.

Three streets so far, and they exist to play differently rather than to look
different. Range is the main control in this game (see below), so the thing a
map really sets is how much room there is to use it:

| Map | Wall | Wall to wall | What changes |
| --- | --- | --- | --- |
| Alley | 12 x 3 m | 6 m | the small one, and where to learn |
| Avenue | 20 x 4 m | 9 m | six times the surface; the top band needs flight |
| Corridor | 10 x 2.75 m | 3.6 m | nowhere to back off to, so the cone stays tight |

Two consequences worth keeping in mind:

- **A map id and a wall id are persistence format.** They are stored on every
  stroke, so they are frozen once anything has been painted on them. Renaming
  a wall orphans every stroke on it. They are free strings rather than a closed
  union for the same reason: a map added next month must not force a migration
  of everything painted before it.
- **Changing street rebuilds the world in place** rather than reloading the
  page, which is the same move phase 5 needs to travel between cities. That
  makes disposal load-bearing rather than tidy — see the pitfalls below.

---

## Paint runs

Hold the spray on one spot for `DRIP.HOLD_TIME` and the wall floods; gravity
takes over and a bead runs down, widest where it breaks away and tapering the
whole way to a thread.

The run's starting width answers to **two** things, because both decide how
much wet paint is on the wall when it breaks:

- **The width of the blast.** A quarter of the spray, so a 10 cm cone sheds a
  2.5 cm run and a tight one sheds a thread.
- **How long the trigger has been held.** Paint keeps piling on past the moment
  the first run broke, so each following run comes off heavier — `FLOOD_GROWTH`
  per second, capped at `MAX_FLOOD` so a long hold cannot run away.

`PaintSystem` therefore tracks two clocks on the same spot: `dwellTime`, which
resets on every run and decides *when* the next one breaks, and `dwellSoak`,
which does not and decides *how heavy* it is. Both reset when the aim moves off
the spot or the trigger is released.

There is a floor on the width: point blank the sprayed patch is only 1 cm
across, and a strict quarter of that would be invisible.

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

## Range is the main control

Distance to the wall is what the player actually plays with. Walking in tightens
the cone towards a **1 cm dot that bites in a tenth of a second**; backing off
to `SPRAY.MAX_DISTANCE` opens it to **30 cm that needs three quarters of a
second** to cover. Reach versus control, paid for in both directions.

`SprayCan.radiusAt()` is linear in range because a cone is: width grows in
proportion to how far the can sits from the wall. `alphaAt()` is the mirror —
the same paint landing on a smaller patch has to bite harder — shaped by
`SPRAY.ALPHA_CURVE` so the strong end stays near the wall.

Both clamp outside `MIN_DISTANCE..MAX_DISTANCE`, so nothing degenerates when
the player is pressed against a wall or aiming past the limit.

**This applies to caps only.** Tools are held flat against the wall, so their
footprint and opacity do not move with range at all — see below.

---

## Caps and tools

Two categories, and the split is not cosmetic:

- **Caps** (circle, square, flare) are spray cones. Range drives their width
  and their bite.
- **Tools** (calligraphy, marker, roller) are pressed against the wall. They
  mark the same at any range.

Six entries in all. The `triangle` *shape* primitive is still in
`CapGeometry`, unused by any current entry — it costs nothing and keeps adding
a wedge cap a one-line change.

A cap is **pure data** in `config.ts` — a category, a base outline (ellipse,
rect or triangle), an aspect ratio, an angle, and how the paint comes out
(size, softness, flow, grain). Adding one is adding a row. There is no per-cap
branching in the brush, and the backpack builds its pockets from the
categories, so a new entry needs no UI work at all.

Most caps do not turn with the stroke, and that is the point of the flat ones:
a calligraphy cap paints thick across its edge and thin along it, which only
works from a fixed angle. The roller is the exception — see below.

## The roller turns with your wrist

`cap.twists` opts a cap into following the stroke. Only the roller has it.

The angle is measured against the heading the stroke **started** with, not
against the wall. So a cap keeps whatever grip it was laid down at: start
rolling upwards and it stays across the travel through a turn; start sideways
and it stays along it, straight, however far you go. Arcing mid-stroke is what
swings it, and the lag is what puts it on the diagonal while it catches up —
roughly 44 degrees, 20 cm into a right-angle turn.

The lag is spent in **travel**, not in time (`SPRAY.TWIST_LAG_M`), because the
swing comes from dragging the thing rather than from holding still. Standing
still therefore never rotates it.

The angle is recorded on each `StrokePoint` rather than recomputed at draw
time: it depends on the whole stroke so far, and the renderer only ever sees
one segment. Storing it keeps replay, undo and future network sync exact for
free, the same way `r` and `a` already work.

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

## Front door

`public/menu-bg.jpg` backs the main menu, and the controls sheet keeps it when
opened from there. Once the player is in and pauses, the scrim goes plain — the
street behind it is the better backdrop. `Menu.show()` decides, via a
`data-art` attribute.

The path lives in `MENU_ART` in `Menu.ts` and reaches the stylesheet as the
`--menu-art` custom property, so the loader preloads the exact same file. Two
copies of that path would drift and the menu would flash in unpainted.

`#loading` is a spinner in the **markup**, not the module, so the browser
paints it before the module script runs and starts building wall panels. It
animates a `transform`, which stays on the compositor and keeps turning even
while the main thread is blocked doing that work. It clears once the artwork
has decoded and the display face has loaded, with a 6 s race so a slow font CDN
can delay the game but never block it.

Headings and buttons use Sedgwick Ave Display; body copy does not. A marker
face is unreadable at 0.8 rem in a two-column key list.

---

## Screens and pointer lock

Four states, and only one of them holds the pointer:

| State | Pointer | Shown |
| ----- | ------- | ----- |
| playing | locked | HUD |
| menu: main | free | Play, Controls, Settings |
| menu: maps | free | which street to paint in |
| menu: modes | free | on foot or free flight |
| menu: pause | free | Resume, Controls, Quit to menu |
| menu: controls | free | key list, Back |
| backpack | free | cap slots |

Everything except `playing` needs a real mouse cursor, so lock state and screen
state must never drift apart. `main.ts` owns the machine: every way back into
the street goes through `enterStreet()`, and losing the lock for any other
reason — Esc, the tab going to the background — raises the pause screen.

Two things this has to get right:

- **Not every unlock is the player leaving.** Opening the backpack releases the
  lock deliberately, so the unlock listener checks for that before pausing.
- **A lock request can be refused.** Browsers reject one that arrives too soon
  after an Esc exit, and there is no way to ask in advance. `enterStreet` takes
  a `refuge` screen and falls back to it after 500 ms rather than stranding the
  player with no cursor, no HUD and no way back in.

The controls sheet is shared by the main and pause screens and remembers which
one opened it, so Back is honest either way.

---

## Movement modes

Two, chosen in the main menu's settings rather than toggled in play, because
they change what shift and space do and swapping that mid-flight would be
disorienting. Quit to menu to change it.

- **On foot** — gravity, `Space` jumps 0.80 m, `Shift` sprints.
- **Free flight** — no gravity, `Space` climbs, `Shift` sinks. The eye is
  capped at `MapMetrics.flyCeiling`, half a metre over that map's wall.

The cap is on the **eye**, not the feet, so crouching in mid air cannot buy
extra altitude. Flight also keeps full horizontal authority: you are steering,
not falling, so air control and air drag stay out of it.

Free flight is not a debug toy — from 2 m out the ray to the top of a 3 m wall
is 2.39 m, past `SPRAY.MAX_DISTANCE`, so the top band is genuinely hard to
reach on foot. On the avenue, at 4 m, it is out of reach altogether.

`MoveIntent` names its two booleans `shift` and `space`, after the keys, since
what they mean depends on the mode.

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

## Wall surface

`public/wall/<name>/` optionally holds `albedo.jpg`, `normal.jpg` and
`roughness.jpg`. `src/maps/surfaces.ts` names each set once and every map
points each of its walls at one. Any file that is missing falls back to the
procedural concrete, silently.

The albedo is **not** a material map. A panel's canvas is its colour texture,
because paint is drawn onto it, so the photograph is tiled into that canvas as
the base coat inside `paintBase()`. Normal and roughness never get painted, so
those ride on the material.

Both paths tile from the same origin — the start of the **strip**, not of each
panel — so courses run straight through a seam instead of restarting at every
panel. That means two different offset conventions have to agree: a canvas
pattern transform in pixels, and a UV `offset`/`repeat` in tile units.
Verified: they land on the same tile number at every sampled point.

One tile covers the surface's own `tileMeters` whatever the file's pixel size,
so brick stays brick-sized if the texture resolution or the panel size changes.
It is per surface rather than global because a concrete panel and a coat of
flaking paint are photographed at different scales. At 192 px/m a 2 m tile
draws at 384 px, so 1K source files are already oversized.

---

## Strips, not panels

A wall is **one continuous paint surface** (`WallStrip`). It is cut into panel
canvases for exactly one reason: to keep each texture upload small. Panels are
a rendering detail and nothing above `world/` should treat them as logical
units.

Strokes are therefore stored in **strip coordinates** — `u` runs 0..1 across
the whole length of one wall, whatever that length is — and a stroke belongs to
a `surface`, not to a panel. Rendering distributes each dab into every panel it
overlaps, and each canvas clips its own share.

Because `u` is a *fraction* of a wall, it only means anything alongside the map
it was painted in. That is why a `Stroke` carries `mapId` and `StrokeStore`
refuses a journal from a different map outright: replayed on the avenue, a
piece from the alley would land smeared across twenty metres.

Treating panels as logical units caused three bugs at once, all fixed by this:

- The stroke was closed on every panel crossing, restarting the interpolation
  and leaving a gap on the seam
- A dab landing on a boundary was clipped in half, drawing a hard vertical cut
- Undo only removed the part of the stroke that happened to be on one panel

`WallPanel` lays its panels out along the direction its own `uv.x` grows —
towards -Z on the left wall, +Z on the right — which is what makes
`(index + uv.x) / panelsPerWall` a continuous strip coordinate on both sides.
Verified in the alley: no discontinuity at any internal boundary.

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
  config.ts                 tuning that applies everywhere
  main.ts                   bootstrap, wiring, and the screen state machine
  Arena.ts                  one loaded map and everything that paints on it

  maps/                     tuning that applies to one place
    types.ts                MapDefinition, MapMetrics, measure()
    surfaces.ts             the photographic sets, named once
    skies.ts                weather presets
    alley.ts                the small one, and the default
    avenue.ts               20 m of wall, 4 m high
    corridor.ts             3.6 m wall to wall, nowhere to back off to
    index.ts                the list, and mapById()

  core/
    Engine.ts               renderer, scene, camera, resize
    Loop.ts                 requestAnimationFrame with delta clamp
    Input.ts                keyboard, mouse, pointer lock state
    Random.ts               seeded PRNG, for reproducible surfaces

  world/
    Street.ts               road, enclosure, lamps, night — disposable
    Surfaces.ts             loads a map's wall and road photography
    WallPanel.ts            mesh + canvas + CanvasTexture for one panel
    WallStrip.ts            one wall as a continuous paint surface
    WallSystem.ts           every strip of a map, raycast targets, dirty flush
    Billboard.ts            the ad panels, off by default
    Colliders.ts            corridor clamp, against the map's bounds

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
    StrokeStore.ts          per-wall journal, undo, repaint, serialize

  net/
    Transport.ts            the interface
    LocalTransport.ts       instant echo, single player
    (SocketTransport.ts)    phase 5

  ui/
    styles.css
    Hud.ts                  palette, color shortcuts, alt + wheel resize
    Menu.ts                 main, maps, modes, settings, pause, controls
    Loading.ts              the progress bar, reused on every map switch
    Inventory.ts            the backpack, opened with I
    CapIcons.ts             cap outlines as SVG, generated from the same geometry
    SprayCursor.ts          the cap outline, sized to the real footprint
```

**Dependency rule: arrows always point downwards.** `paint/` knows `net/` only
through the `Transport` interface. `world/` knows nothing about `paint/`.
Nothing in `world/` or `player/` imports from `ui/`. `maps/` sits beside
`config.ts` at the bottom and imports from neither.

`Arena.ts` is the one exception, and deliberately so: like `main.ts` it is
wiring, not a layer, so it is allowed to reach across `world/`, `paint/`,
`state/` and `ui/` to assemble a loaded map out of them.

---

## Coordinate system

```
        Y (up)
        |
        +------ X (street width)
       /
      Z (street length)
```

Every number below is the map's, not the game's — these are the alley's.

- The street runs along **Z**, from `-6` to `+6`
- Width runs along **X**, from `-3` to `+3`
- Left wall at `x = -3`, paintable face looking towards `+X`
- Right wall at `x = +3`, paintable face looking towards `-X`
- Ground at `y = 0`, wall top at `y = 3`, player eyes at `y = 1.7`

A 12 x 3 m wall each side, three panels per side. Deliberately small: the alley
is a place to paint one piece, not a map to explore. The avenue and the
corridor are the same shape at other sizes — `wallX` and `halfLength` come off
`MapMetrics`, never off a constant.

`PlaneGeometry` is born on the XY plane with its normal at `+Z`. Rotating
`+PI/2` around Y aims it at `+X` (left wall); `-PI/2` aims it at `-X`.

UV `(0,0)` is the bottom-left corner seen from the front. Converting to canvas
pixels flips Y:

```ts
const px = uv.x * strip.widthPx;
const py = (1 - uv.y) * strip.heightPx;
```

---

## Things that will bite you

- **`intersection.uv` comes back `undefined`** if the geometry has no `uv`
  attribute. `PlaneGeometry` has one, but a custom mesh or an unmapped GLTF
  would break silently. Always guard with `if (!hit.uv) return;`.
- **Upside-down texture.** UV v grows up, canvas y grows down. The conversion is
  `(1 - uv.y) * PANEL_TEXTURE_HEIGHT`.
- **Never hardcode a canvas dimension.** Panels are rectangular, and every map
  sizes them differently — 768 x 576 in the alley, 640 x 640 on the avenue,
  560 x 616 in the corridor. Read them off the strip. Anything that assumes a
  square canvas silently reintroduces the ellipse bug.
- **Never import a world dimension as a constant.** That was the whole reason
  a second map was impossible. Wall lengths, heights, panel counts and pixel
  densities all come off `MapMetrics` or off the `WallStrip` that carries them.
- **Stroke radii are stored in meters, not pixels.** That keeps the journal
  independent of the wall resolution — and of which map it was painted in, so
  a tag laid down at 192 px/m replays at the right physical size on a wall
  drawn at 224.
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
- **GPU memory leaks.** The world *is* rebuilt now, every time somebody
  changes street. Geometries, materials and textures are GPU allocations the
  garbage collector cannot see, so every one of them has to be freed by hand:
  `Arena.dispose()` is the single entry point, and `Street` keeps a `Bin` of
  everything it made for exactly this.
- **Nothing may touch the arena mid-swap.** Between `arena.dispose()` and the
  next one being assigned there is an await. A frame landing in that gap would
  flush disposed canvases and render freed geometry — hence the `swapping`
  guard in the frame loop.

---

## Performance notes

- **Memory budget:** each map's `pixelsPerMeter` is the single knob, and it
  is per map because the bill is per map: the alley costs about 7 MB of VRAM
  at 192, the avenue about 13 at 160 for six times the wall. Both canvas
  dimensions derive from it, so the resolution stays uniform on both axes — a
  square canvas on a rectangular panel is what used to turn every spray into
  an ellipse.
- **The real cost is the texture upload.** `texture.needsUpdate = true` resends
  the whole canvas to the GPU. Never set it inside the dab loop; the
  `dirty` + `flush` pair already collapses it to one upload per panel per frame.
- **Stroke sampling is fixed at 60 Hz**, not per frame. On a 165 Hz monitor a
  per-frame sample would lay down more points per second and paint darker.
- **If performance gets tight, in order:** drop the offending map's
  `pixelsPerMeter`, lower `SPRAY.SPECKLES`, keep `getImageData`/`putImageData`
  out of the loop, and only then consider migrating to a `WebGLRenderTarget`
  brush pass.

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
| Wheel        | Cycle through the palette |
| Alt + wheel  | Spray cone size          |
| I            | Open / close the nozzle inventory |
| 1-9, 0       | Pick a palette color     |
| Ctrl/Cmd + Z | Undo your last stroke    |
| Esc          | Release pointer lock     |

> Ctrl doubles as crouch and as the undo chord, so Ctrl+Z dips the camera for
> as long as the key is held. On macOS use Cmd+Z and the two never overlap.
