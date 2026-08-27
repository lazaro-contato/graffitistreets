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
export const NIGHT = {
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

  MOON_COLOR: "#8fa4d4",
  MOON_INTENSITY: 0.18,
} as const;

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
 * Textures live under their own name, and each side points at one.
 *
 * This one is cast panels: two plates across the tile and four up it. At 2.4 m
 * that makes each plate 1.20 x 0.60 m, the standard cladding size — and it
 * divides the wall exactly, five rows up the 3 m and ten along the 12 m, so
 * the joints never land half way through a plate.
 */
const CONCRETE_031: SurfaceSpec = {
  albedo: "/wall/concrete031/albedo.jpg",
  normal: "/wall/concrete031/normal.jpg",
  roughness: "/wall/concrete031/roughness.jpg",
  tileMeters: 2.4,
};

export const SURFACES: Record<Side, SurfaceSpec> = {
  left: CONCRETE_031,
  right: CONCRETE_031,
};

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

/** Where the header and the menu send people. */
export const LINKS = {
  /**
   * Off for now. A switch rather than commented-out markup, so the wiring
   * stays type-checked and turning it back on is one boolean — and so the
   * elements are hidden by the same flag in both places rather than by two
   * separate edits that can drift apart.
   */
  SOCIAL: false,

  GITHUB: "https://github.com/lazaro-contato/graffitistreets",
  /** Replace with the real profile before switching SOCIAL back on. */
  LINKEDIN: "https://www.linkedin.com/in/",

  GALLERY: "/gallery/",

  /**
   * Where "send your image" goes, one form per language.
   *
   * Split because sending an English-speaking player to a Portuguese form at
   * the exact moment they are trying to hand something over is the easiest
   * way to lose them.
   */
  SUBMIT: {
    pt: "https://forms.gle/tLMST61YRUSdMnAK9",
    en: "https://forms.gle/dewxq8uwhR6LXByn8",
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
  | "circle"
  | "square"
  | "flare"
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
    id: "circle",
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
    id: "flare",
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

export const CAP_BY_ID = new Map(CAPS.map((cap) => [cap.id, cap]));

export const capsIn = (category: CapCategory) =>
  CAPS.filter((cap) => cap.category === category);

export const DEFAULT_CAP: CapId = "circle";

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
