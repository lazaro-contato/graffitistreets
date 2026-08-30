/**
 * Every tunable number in the game lives here.
 * These values get tweaked constantly — keep them in one place.
 */

export const WORLD = {
  STREET_LENGTH: 12, // meters, along Z — the wall runs the whole length
  // Narrower than it is long, so it reads as an alley. At 12 it was wider than
  // long, which reads as a plaza, and the middle was dead space anyway since
  // the spray only reaches 2 m.
  STREET_WIDTH: 6, // meters, along X (wall to wall)
  WALL_HEIGHT: 3,
  PANEL_WIDTH: 4, // width of each paintable panel; must divide STREET_LENGTH

  // Scenery that closes the box. None of it is paintable: the eye reaches
  // 3.5 m in free flight and the wall stops at 3, so without something above
  // and beyond it you fly up and look straight into empty sky.
  BUILDING_HEIGHT: 9,
  BUILDING_DEPTH: 4, // how far the mass behind each wall extends outward
  END_DEPTH: 3, // thickness of the blocks capping each end of the alley
  COPING_OVERHANG: 0.2, // how far the wall cap juts back over the alley
  COPING_HEIGHT: 0.18,
} as const;

/**
 * Night, and only night. Both pieces of key art are night scenes lit by hard
 * sources, and a warm lamp raking across a wall shows paint far better than
 * flat daylight does.
 *
 * Spot intensities are in candela and fall off with the square of distance,
 * which is why the lamp number is large and the fills are not.
 */
/** Night or day. Chosen in the settings, and it changes every light at once. */
export type TimeOfDay = "night" | "day";
export const TIMES_OF_DAY: readonly { id: TimeOfDay }[] = [
  { id: "night" },
  { id: "day" },
];
export const DEFAULT_TIME_OF_DAY: TimeOfDay = "night";

/**
 * Everything the sky decides.
 *
 * One shape for both times so switching is a swap rather than two code paths.
 * The key light is the moon at night and the sun by day — same slot, because
 * from the alley floor the difference is colour, angle and how hard it lands.
 */
export type SkySpec = {
  SKY: string;
  FOG_NEAR: number;
  FOG_FAR: number;
  FILL_SKY: string;
  FILL_GROUND: string;
  FILL_INTENSITY: number;
  KEY_COLOR: string;
  KEY_INTENSITY: number;
  KEY_POSITION: readonly [number, number, number];
  /** Multiplier on LAMP.INTENSITY. A street lamp at noon is off. */
  LAMPS: number;
  /** Multiplier on NEON.INTENSITY, and on the lamp head's own emission. */
  GLOW: number;
};

export const NIGHT: SkySpec = {
  SKY: "#0a0d14",
  FOG_NEAR: 8,
  FOG_FAR: 34,

  // Kept low so the lamps' own falloff is what shapes the scene. Neither of
  // these attenuates with distance, so every unit of them is a flat floor
  // laid under the lamps, flattening exactly the gradient that makes a light
  // look like it has a source.
  FILL_SKY: "#243049",
  FILL_GROUND: "#0b0b10",
  FILL_INTENSITY: 0.16,

  KEY_COLOR: "#8fa4d4", // the moon
  KEY_INTENSITY: 0.18,
  KEY_POSITION: [-8, 14, -6],

  LAMPS: 1,
  GLOW: 1,
};

/**
 * Overcast midday, not a postcard noon.
 *
 * The reason is the walls: a hard sun down a north-south alley throws one wall
 * into a black slab of shadow and blows the other out, and both are unpaintable.
 * A high bright sky lights both faces evenly, which is what a photograph of a
 * wall is taken in and what this whole texture set was generated to match.
 *
 * Fog goes far rather than off. It is what keeps the enclosure from reading as
 * a box with an edge, and daylight needs that more than night does.
 */
export const DAY: SkySpec = {
  SKY: "#aebbc9",
  FOG_NEAR: 18,
  FOG_FAR: 90,

  FILL_SKY: "#cdddef",
  FILL_GROUND: "#6b6459",
  FILL_INTENSITY: 2.1,

  KEY_COLOR: "#fff4e2", // the sun, through cloud
  KEY_INTENSITY: 1.5,
  KEY_POSITION: [-6, 20, -3],

  LAMPS: 0,
  // Neon barely registers against daylight, and paint that glowed as hard at
  // noon as at midnight is the fastest way to make the day look fake.
  GLOW: 0.18,
};

export const SKIES: Record<TimeOfDay, SkySpec> = { night: NIGHT, day: DAY };

/**
 * The street lamps: two of them, one per side, at opposite ends.
 *
 * Both cast shadows. With only two sources the poles throw a shadow apiece
 * from opposite directions, and crossing shadows are the clearest signal
 * there is that light comes from somewhere.
 */
export const LAMP = {
  COLOR: "#ffcf94",
  INTENSITY: 220, // two now instead of four, so each pulls its weight
  ANGLE: 1.05, // radians, half-angle of the cone
  PENUMBRA: 0.45,
  RANGE: 18, // the alley diagonal is far short of this; it is only a backstop
  HEIGHT: 4,
  END_INSET: 1.4, // meters in from each end of the alley
  // Tucked against the wall on purpose: the player's box reaches |x| = 2.60,
  // so a pole any further out could be walked into, and the camera would end
  // up inside it.
  WALL_GAP: 0.15, // meters out from the wall face
  ARM_REACH: 1.1, // how far the bracket carries the head over the alley
} as const;

/**
 * How the player gets around. Picked in the menu before entering, because it
 * changes what shift and space do.
 */
export type MovementMode = "walk" | "free";

export const MOVEMENT_MODES: readonly { id: MovementMode }[] = [
  { id: "walk" },
  { id: "free" },
];

/** Which wall of the street a surface belongs to. */
export type Side = "left" | "right";
export const SIDES = ["left", "right"] as const;

// 8 / 4 = 2 panels per side, 4 total
export const PANELS_PER_SIDE = WORLD.STREET_LENGTH / WORLD.PANEL_WIDTH;
export const WALL_X = WORLD.STREET_WIDTH / 2; // walls sit at x = -6 and x = +6
export const HALF_LENGTH = WORLD.STREET_LENGTH / 2;

export const TEXTURE = {
  /**
   * Texture resolution, in pixels per meter of wall — the ONE number that sets
   * canvas size. Deriving both dimensions from it keeps the resolution
   * identical on both axes, which is what makes a round dab in canvas space
   * come out round on the wall. A square canvas on a 6 x 4 m panel gave
   * 171 px/m across and 256 px/m up, and every spray came out as an ellipse.
   *
   * At 192: 768 x 576 per panel, so the 4 panels cost about 7 MB of VRAM.
   * Raise to 256 for sharper walls at 13 MB; this is the only value to touch.
   */
  PIXELS_PER_METER: 192,
  BASE_COLOR: "#8d8b86", // concrete
  NOISE_AMOUNT: 0.06,
} as const;

/**
 * Optional wall photography, one set per side, dropped into `public/wall/`.
 *
 * The albedo is NOT a material map: the panel canvas is the colour texture,
 * because paint is drawn on top of it, so the photo is tiled into that canvas
 * as the base coat. Normal and roughness never get painted, so those go on the
 * material and are shared between the panels of a side.
 *
 * Each side is independent. Any file that is missing falls back to the
 * procedural concrete, so one dressed wall and one bare one is fine.
 */
export type SurfaceSpec = {
  albedo: string;
  normal: string; // OpenGL convention (green up), not DirectX
  roughness: string;
  /**
   * How much wall one tile of those images covers.
   *
   * Per side, not global: a concrete panel and a coat of flaking paint are
   * photographed at different scales, and forcing both to the same tile would
   * leave one of them obviously the wrong size.
   */
  tileMeters: number;
};

/**
 * A surface as the manifest describes it: a folder name and who it belongs to.
 *
 * The file paths are not in here on purpose. They are `/wall/<slug>/albedo.jpg`
 * and its two siblings, always, which is what makes contributing a wall a JSON
 * entry and three files rather than a code change.
 *
 * `licence` and `sourceUrl` are not decoration. ASSETS.md is the record of who
 * owns what in this repository, and a surface that cannot say where it came
 * from cannot be shipped in it.
 */
export type SurfaceEntry = {
  slug: string;
  /** Shown in the picker. Not translated — it is a name, not copy. */
  title: string;
  /**
   * A sentence about the wall, in both languages.
   *
   * Both keys are required for the same reason src/i18n/strings.ts requires
   * them: a surface that reads in one language and not the other is a surface
   * half the players cannot be told anything about. Null is for a surface whose
   * contributor had nothing to say, which is allowed and rare.
   *
   * Spelled out rather than keyed by Locale because this file imports nothing —
   * it sits at the bottom of the graph, and LINKS.SUBMIT already carries the
   * same pair the same way.
   */
  description: { pt: string; en: string } | null;
  /** Null for a surface that is not from anywhere in particular. */
  city: string | null;
  country: string | null;
  author: string;
  /** An SPDX identifier where there is one: "CC0-1.0", "CC-BY-4.0". */
  licence: string;
  sourceUrl: string | null;
  /** As in SurfaceSpec: how much wall one tile of those images covers. */
  tileMeters: number;
};

/**
 * The one surface the code knows about without reading anything.
 *
 * A fork with no manifest — or a manifest that fails to parse — still gets a
 * dressed wall rather than an empty picker, which is the same bargain the
 * missing-file fallback makes everywhere else here.
 */
/**
 * Cast panels: two plates across the tile and four up it. At 2.4 m that makes
 * each plate 1.20 x 0.60 m, the standard cladding size — and it divides the
 * wall exactly, five rows up the 3 m and ten along the 12 m, so the joints
 * never land half way through a plate.
 */
export const BUILT_IN_SURFACE: SurfaceEntry = {
  slug: "concrete031",
  title: "Concrete 031",
  description: {
    pt: "Placas de concreto pré-moldado, 1,20 x 0,60 m — a medida padrão, que divide o muro sem cortar nenhuma placa ao meio.",
    en: "Cast concrete plates at 1.20 x 0.60 m — the standard size, which divides the wall without cutting a plate in half.",
  },
  city: null,
  country: null,
  author: "ambientCG",
  licence: "CC0-1.0",
  sourceUrl: "https://ambientcg.com/view?id=Concrete031",
  tileMeters: 2.4,
};

/** Where the manifest lives, relative to the site root. */
export const SURFACE_MANIFEST_URL = "/wall/surfaces.json";

/**
 * The street the player lands in before picking anything.
 *
 * One slug, not one per side. The two walls can still be dressed separately —
 * the engine has never assumed otherwise, and a photo dropped on one of them
 * is exactly that — but choosing a place puts that place on both, because a
 * street has the same walls down both sides of it.
 */
export const DEFAULT_SURFACE_SLUG = BUILT_IN_SURFACE.slug;

/**
 * The road.
 *
 * One tile spans the full width on purpose. The photograph carries a painted
 * line down its edge, so tiling it at any other scale scatters yellow stripes
 * across the asphalt; at exactly one tile across, with half a tile of offset,
 * that line lands on the centre of the alley and reads as road marking.
 */
export const ROAD_SURFACE: SurfaceSpec = {
  albedo: "/road/albedo.jpg",
  normal: "/road/normal.jpg",
  roughness: "/road/roughness.jpg",
  tileMeters: WORLD.STREET_WIDTH,
};

/** Half a tile, which is what puts the painted line on the centre line. */
export const ROAD_OFFSET_U = 0.5;

export const SURFACE = {
  /** Damp patches kept over the photo, so panels do not read as clones. */
  GRUNGE_ALPHA: 0.04,
} as const;

/**
 * Photos, taken with P.
 *
 * The screen renders at 2x at most, because that is the right trade sixty
 * times a second. A still is not on that budget, so it is rendered larger and
 * read back — bounded by total pixels rather than by the multiplier, since a
 * 4x buffer on a dense display runs past what weaker hardware can allocate.
 */
export const PHOTO = {
  SUPERSAMPLE: 2,
  MAX_LONG_EDGE: 3840,
} as const;

/**
 * Backlit ad panels, mounted on the blocks that cap each end of the alley —
 * the only surface at eye height that is not somebody's canvas.
 *
 * They are the one thing in the scene you point at rather than paint, so the
 * range you can click from is deliberately not the range you can spray from:
 * two metres is right for a can and useless for a sign you are meant to read.
 */
export const ADS = {
  /**
   * Off until there is something to advertise. Kept as a switch rather than as
   * commented-out code so it stays compiled, type-checked and honest: turning
   * it on is one boolean, and it cannot quietly rot in the meantime.
   *
   * With it off, the panels are not built, the two artwork files are not
   * fetched, and Aim goes back to having nothing clickable to test.
   */
  ENABLED: false,

  WIDTH: 3,
  HEIGHT: 1.5,
  CENTRE_Y: 1.9, // a little above eye line, the way signage sits
  PROUD: 0.06, // how far the lit face stands off the block behind it
  CLICK_RANGE: 14, // metres; the alley is 12 long, so the whole of it

  GLOW_COLOR: "#dCeaff",
  GLOW_INTENSITY: 9, // candela of spill, so the box lights its own patch of wall

  /** Replace with the advertiser's URL once one exists. */
  HOUSE_LINK: "https://example.com/anuncie",
} as const;

/**
 * The one event the game reports about itself.
 *
 * The tracker is loaded from a script tag in the page, not from here — the
 * website id belongs next to the tag that needs it, and a pageview should not
 * depend on the bundle parsing. Umami already knows the visit, the country and
 * the language. What it cannot know is how much of a visit was spent in the
 * street rather than in a menu, and how much paint reached the wall.
 */
export const ANALYTICS = {
  /** What the event is called in the dashboard. */
  EVENT: "session",
  /**
   * Visits shorter than this go unreported. A bounce is already counted as a
   * pageview; folding it into the session numbers would only drag every
   * average toward zero and make the real visits harder to see.
   */
  MIN_VISIT_MS: 5000,
} as const;

/**
 * How the spray decides its own width.
 *
 * `auto` is the can: the cone opens as you back away from the wall, and the
 * paint thins with it. `fixed` hands that dial to the wheel instead, so a
 * stroke stays the width you set wherever you stand — closer to a drawing tool
 * than to a can, and much easier to be deliberate with.
 */
export type BrushSizing = "auto" | "fixed";

export const BRUSH_SIZINGS: readonly { id: BrushSizing }[] = [
  { id: "auto" },
  { id: "fixed" },
];

export const DEFAULT_BRUSH_SIZING: BrushSizing = "auto";

/**
 * Where the header and the menu send people.
 *
 * Every one of these is personal to whoever runs the site rather than part of
 * the game, so they come from the environment instead of from source. A clone
 * with no configuration gets a game with no links, which is the right default:
 * it should not advertise somebody else's profile, and it must never post to
 * their forms.
 *
 * All optional. Whatever is missing, the element that would have carried it
 * stays out of the page — see .env.example for the full list.
 */
export const LINKS = {
  /**
   * The source of the running version. Under the AGPL this is not decoration:
   * a modified version served over a network owes its source to whoever uses
   * it, and this is where that offer is made.
   */
  SOURCE: import.meta.env.VITE_LINK_SOURCE || null,

  /** Where a bug goes: a form, so nobody needs an account to report one. */
  BUG: import.meta.env.VITE_LINK_BUG || null,

  GALLERY: "/gallery/",

  /**
   * Where "send your image" goes, one form per language.
   *
   * Split because sending an English-speaking player to a Portuguese form at
   * the exact moment they are trying to hand something over is the easiest
   * way to lose them.
   */
  SUBMIT: {
    pt: import.meta.env.VITE_FORM_SUBMIT_PT || null,
    en: import.meta.env.VITE_FORM_SUBMIT_EN || null,
  },
} as const;

/** Canvas size of one panel, in pixels. */
export const PANEL_TEXTURE_WIDTH =
  WORLD.PANEL_WIDTH * TEXTURE.PIXELS_PER_METER;
export const PANEL_TEXTURE_HEIGHT =
  WORLD.WALL_HEIGHT * TEXTURE.PIXELS_PER_METER;

/**
 * Width of a whole wall strip in texture pixels.
 * This space is never allocated — it is the coordinate system strokes live in.
 */
export const STRIP_WIDTH_PX = PANEL_TEXTURE_WIDTH * PANELS_PER_SIDE;

export const PLAYER = {
  EYE_HEIGHT: 1.7,
  CROUCH_EYE_HEIGHT: 0.95,
  CROUCH_LERP: 14, // how fast the camera eases between stances
  RADIUS: 0.4,

  // Top speeds, in m/s. These are reached exactly — see Movement.
  WALK_SPEED: 4.2,
  RUN_SPEED: 7.0,
  CROUCH_SPEED: 1.8,

  // How fast the current velocity closes on the target one, in 1/s.
  // Speeding up and slowing down are tuned separately on purpose: one shared
  // constant forces a choice between a twitchy start and an icy stop.
  GROUND_ACCEL: 14, // ~95% of top speed in 0.2 s
  GROUND_STOP: 12,
  AIR_ACCEL: 2, // enough to nudge a jump, not to redirect it
  AIR_STOP: 0.4, // almost no drag, so a jump keeps its momentum

  GRAVITY: 24, // m/s^2 — well above 9.81, since real gravity feels floaty
  JUMP_SPEED: 6.2, // a 0.80 m hop lasting 0.52 s

  // Free flight. Space climbs, shift sinks, and gravity is off entirely.
  FLY_SPEED: 3, // m/s up or down
  FLY_ACCEL: 10, // how quickly the climb rate settles, in 1/s
  /** Highest the eye may reach: half a metre of clearance over the wall. */
  FLY_CEILING: WORLD.WALL_HEIGHT + 0.5,
} as const;

export const SPRAY = {
  MAX_DISTANCE: 2, // meters — beyond this the spray does not reach
  MIN_DISTANCE: 0.4,
  // Footprint radius on the wall, in METERS, not texture pixels. Keeping the
  // journal in world units makes it independent of TEXTURE.PIXELS_PER_METER —
  // change the resolution and old strokes still replay at the right size.
  //
  // Range drives the cone. Backing off to MAX_DISTANCE opens the spray up to
  // BASE_RADIUS_M but spreads the paint thin; walking in tightens it towards a
  // 1 cm dot that bites hard. That trade — reach versus control — is the whole
  // feel of a spray can, and it only applies to caps. Tools are pressed flat
  // against the wall, so their mark is the same at any range.
  BASE_RADIUS_M: 0.152, // ~30 cm across, the widest cone, at MAX_DISTANCE
  MIN_RADIUS_M: 0.005, // 1 cm across, right up against the wall
  NEAR_ALPHA: 0.35, // dab alpha at MIN_DISTANCE — bites fast
  FAR_ALPHA: 0.05, // dab alpha at MAX_DISTANCE — needs several passes
  ALPHA_CURVE: 2, // >1 keeps the strong end close to the wall
  TOOL_ALPHA: 0.25, // tools do not care how far away you stand

  MIN_SIZE: 0.08, // tightest cone — a thin line
  MAX_SIZE: 1, // widest cone, and the size the can starts at
  SIZE_STEP: 0.12, // multiplicative step per wheel notch, so each click feels equal
  // Twist: a cap that turns keeps whatever grip the stroke started with, and
  // the wrist carries it round as you arc. Lag is measured in travel, not
  // time, because the swing comes from dragging, not from waiting.
  TWIST_LAG_M: 0.3, // meters of travel to catch up with a turn
  TWIST_MIN_STEP_M: 0.008, // shorter than this is jitter, not a direction

  DAB_SPACING: 0.25, // fraction of the radius between interpolated dabs
  SPECKLES: 22, // grain particles per dab
  SPECKLE_SPREAD: 1.15, // how far speckles overshoot the radius
  SAMPLE_HZ: 60, // stroke sampling rate, independent of framerate
} as const;

/**
 * Paint runs: hold the spray on one spot and it floods, then gravity takes it.
 *
 * A run is recorded as an ordinary Stroke, appended to over time as it
 * descends — so undo, replay and (later) network sync all work on it for free.
 */
export const DRIP = {
  HOLD_TIME: 3, // seconds on one spot before the paint starts to run
  REPEAT_TIME: 1.4, // an already soaked spot keeps running, sooner
  HOLD_RADIUS: 0.35, // fraction of the spray radius that still counts as "here"
  MIN_HOLD_RADIUS: 0.1, // meters, floor for the above

  START_SPEED: 0.06, // m/s — a bead needs a moment to break away
  ACCELERATION: 0.12, // m/s^2
  MAX_SPEED: 0.4,

  LENGTH: 0.55, // meters of travel before the paint dries up
  LENGTH_JITTER: 0.35, // +/- fraction, so runs are not all the same
  SEGMENT: 0.015, // meters between recorded points

  // A run is widest where it breaks away from the flooded patch and tapers all
  // the way down as the paint spends itself.
  //
  // Its starting width answers to two things, because both decide how much wet
  // paint is sitting on the wall: the width of the blast, and how long the
  // trigger has been held. A 10 cm spray sheds a 2.5 cm run the moment it
  // floods; keep holding and the wall keeps loading, so each following run
  // comes off heavier, up to MAX_FLOOD.
  START_WIDTH: 0.25, // fraction of the current spray radius
  FLOOD_GROWTH: 0.35, // extra start width per second held past HOLD_TIME
  MAX_FLOOD: 2.2, // ceiling on that growth, so a long hold cannot run away
  MIN_START_RADIUS: 0.0035, // meters, the thinnest run worth drawing
  NARROWING: 0.9, // how far it thins by the end: 0.9 leaves a tenth
  ALPHA: 0.3, // running paint is concentrated, unlike a spray dab
  WANDER: 0.004, // meters of sideways drift per second, so it is not a ruler line
  START_DROP: 0.6, // fraction of the spray radius below centre, where paint pools

  MAX_ACTIVE: 24, // safety cap on simultaneous runs
} as const;

/**
 * Spray caps.
 *
 * A cap is pure data: a base outline, how it is stretched and turned, and how
 * the paint comes out of it. Adding one is adding a row here — no branching in
 * the brush, and the backpack and the cursor pick it up on their own.
 *
 * Caps do NOT turn with the stroke, which is the whole point of the flat ones:
 * a calligraphy cap paints thick across its edge and thin along it.
 */
export type CapShape = "ellipse" | "rect" | "triangle";

/**
 * Caps are spray cones: range changes their width and their bite.
 * Tools are pressed flat on the wall, so they mark the same at any range.
 */
export type CapCategory = "cap" | "tool";

export const CAP_CATEGORIES: readonly { id: CapCategory }[] = [
  { id: "cap" },
  { id: "tool" },
];

export type CapId =
  | "skinny"
  | "standard"
  | "nyfat"
  | "ultrafat"
  | "splatter"
  | "softcap"
  | "square"
  | "calligraphy"
  | "marker"
  | "roller";

export type CapDefinition = {
  id: CapId;
  category: CapCategory;
  shape: CapShape;
  /** Width divided by height of the footprint. 1 is unstretched. */
  aspect: number;
  /** Degrees, clockwise as seen on the wall. */
  angle: number;
  /** Multiplier on the spray radius. */
  size: number;
  /** 0 is a crisp edge, 1 is a diffuse cloud. */
  softness: number;
  /** Multiplier on the alpha of each dab. */
  flow: number;
  /** Multiplier on the amount of grain. */
  grain: number;
  /**
   * Whether the mark turns with the stroke.
   *
   * Off for the flat tools on purpose: a calligraphy cap's whole identity is
   * the fixed angle that makes it thick one way and thin the other. Turn it
   * and it stops being a calligraphy cap.
   */
  twists: boolean;
};

export const CAPS: readonly CapDefinition[] = [
  {
    id: "skinny",
    category: "cap",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    // A third of the standard cone. This is the outline and the signature —
    // the sizes below are a ladder, and this is its bottom rung.
    size: 0.32,
    softness: 0.4, // tighter edge than the others: a thin line has to stay one
    flow: 1.15,
    grain: 0.5,
    twists: false,
  },
  {
    id: "standard",
    category: "cap",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    size: 1,
    softness: 0.6,
    flow: 1,
    grain: 1,
    twists: false,
  },
  {
    id: "nyfat",
    category: "cap",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    size: 1.45,
    softness: 0.68,
    // Wider cone, same paint: it has more wall to cover, so it bites less.
    flow: 0.85,
    grain: 1.25,
    twists: false,
  },
  {
    id: "ultrafat",
    category: "cap",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    size: 2.4,
    softness: 0.8,
    flow: 0.55,
    grain: 1.5,
    twists: false,
  },
  {
    id: "splatter",
    category: "cap",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    size: 1.9,
    softness: 0.95,
    flow: 0.62,
    grain: 1.8,
    twists: false,
  },
  {
    id: "softcap",
    category: "cap",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    // The flare's twin, and the contrast is the point: same width, almost no
    // grain and a third of the flow. One is texture, the other is a fade.
    size: 1.8,
    softness: 1,
    flow: 0.3,
    grain: 0.08,
    twists: false,
  },
  {
    id: "square",
    category: "cap",
    shape: "rect",
    aspect: 1,
    angle: 0,
    size: 1,
    softness: 0.6,
    flow: 1,
    grain: 1,
    twists: false,
  },
  {
    id: "calligraphy",
    category: "tool",
    shape: "rect",
    aspect: 3.2,
    angle: -45,
    size: 1,
    softness: 0.35,
    flow: 1.15,
    grain: 0.7,
    twists: false,
  },
  {
    id: "marker",
    category: "tool",
    shape: "rect",
    aspect: 3.6,
    angle: 0,
    size: 0.45,
    softness: 0.15,
    flow: 1.5,
    grain: 0.35,
    twists: false,
  },
  {
    id: "roller",
    category: "tool",
    shape: "rect",
    aspect: 4.2,
    angle: 0,
    size: 1.2,
    softness: 0.08,
    flow: 1.9,
    grain: 0.15,
    twists: true,
  },
];

/**
 * A can: one cap, one colour, and how hard it is set to spray.
 *
 * `size` and `flow` are the same two multipliers `SprayCan` already carries,
 * so equipping a can is assigning four fields rather than translating between
 * two vocabularies. They are on the can rather than on the player because
 * eight cans that differ only in colour would not be a loadout.
 */
export type CanSpec = {
  cap: CapId;
  color: string;
  /** Cone width, SPRAY.MIN_SIZE..MAX_SIZE. */
  size: number;
  /** Multiplier on how hard the paint bites. 1 is the cap's own flow. */
  flow: number;
};

export const LOADOUT = {
  /** Cans in a preset. Eight, because that is what 1-8 reaches without a chord. */
  CANS: 8,
  /** Preset slots. Fixed rather than unlimited: there is never an empty list. */
  PRESETS: 4,
  /** Range the workshop's flow slider covers. */
  MIN_FLOW: 0.25,
  MAX_FLOW: 2,
} as const;

/**
 * The loadout everybody starts with, and the one Reset restores.
 *
 * It is a tour rather than a set of favourites: a thin outline, the everyday
 * cone, two coverage widths, both texture caps and both flat tools. Somebody
 * who never opens the workshop should still meet most of what the game has.
 */
export const DEFAULT_CANS: readonly CanSpec[] = [
  { cap: "skinny", color: "#111111", size: 1, flow: 1 },
  { cap: "standard", color: "#ffffff", size: 1, flow: 1 },
  { cap: "nyfat", color: "#e02020", size: 1, flow: 1 },
  { cap: "ultrafat", color: "#1e5fe0", size: 1, flow: 1 },
  { cap: "splatter", color: "#ffd400", size: 1, flow: 1 },
  { cap: "softcap", color: "#00b8d4", size: 1, flow: 1 },
  { cap: "calligraphy", color: "#2ecc40", size: 1, flow: 1 },
  { cap: "roller", color: "#8b2fd4", size: 1, flow: 1 },
];

export const CAP_BY_ID = new Map(CAPS.map((cap) => [cap.id, cap]));

export const capsIn = (category: CapCategory) =>
  CAPS.filter((cap) => cap.category === category);

export const DEFAULT_CAP: CapId = "standard";

/** The base radius expressed in texture pixels, for canvas-space code. */
export const BASE_RADIUS_PX =
  SPRAY.BASE_RADIUS_M * TEXTURE.PIXELS_PER_METER;

export const PALETTE = [
  "#ffffff",
  "#111111",
  "#e02020",
  "#ff7a00",
  "#ffd400",
  "#2ecc40",
  "#00b8d4",
  "#1e5fe0",
  "#8b2fd4",
  "#ff4fa3",
] as const;

/**
 * Neon paint, which is not a brighter colour but a different material: it is
 * written into a second map on the wall and emits light of its own.
 *
 * Every map in the game is night, lit by two hard lamps with a lot of dark
 * between them — which is the one setting where this reads as anything at all.
 * On a flat daylit wall it would be indistinguishable from a saturated colour.
 *
 * Deliberately none of these is a near-match for a colour in PALETTE. A neon
 * cyan beside an ordinary cyan that differs only in glow is a pair people pick
 * between by accident.
 */
export const NEON_PALETTE = [
  "#39ff14",
  "#00f0ff",
  "#ff00e6",
  "#ff073a",
  "#faff00",
  "#7d00ff",
] as const;

const NEON_SET = new Set<string>(NEON_PALETTE);

/**
 * Whether a colour glows.
 *
 * Looked up from the palette rather than carried on the stroke, which keeps
 * `PaintMessage` exactly as it was — no new field to sync, migrate or forget.
 * The trade is that a colour mixed by hand to one of these exact values glows
 * too. That is a fair outcome rather than a bug: what makes paint neon is the
 * pigment, and the pigment is the number.
 */
export const isNeon = (hex: string) => NEON_SET.has(hex.toLowerCase());

export const NEON = {
  /**
   * How hard the paint emits, before tone mapping. Above 1 on purpose: the
   * renderer is ACES filmic, which rolls the top off into a soft falloff
   * instead of clipping, and that roll-off is what reads as a glow rather than
   * as a flat bright patch.
   */
  INTENSITY: 1.6,
  /**
   * Resolution of the glow map, as a fraction of the panel's.
   *
   * Half. It is light rather than detail — nobody can see the edge of a glow —
   * and this is the difference between the feature costing 25% more VRAM per
   * panel and costing 100% more.
   */
  MAP_SCALE: 0.5,
} as const;
