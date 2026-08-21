/**
 * Every tunable number in the game lives here.
 * These values get tweaked constantly — keep them in one place.
 */

export const WORLD = {
  STREET_LENGTH: 60, // meters, along Z
  STREET_WIDTH: 12, // meters, along X (wall to wall)
  WALL_HEIGHT: 4,
  PANEL_WIDTH: 6, // width of each paintable panel
  SIDEWALK_WIDTH: 1.6,
  SIDEWALK_HEIGHT: 0.15,
} as const;

/** Which wall of the street a surface belongs to. */
export type Side = "left" | "right";
export const SIDES = ["left", "right"] as const;

// 60 / 6 = 10 panels per side, 20 total
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
   * At 192: 1152 x 768 per panel, so 20 panels cost about 71 MB of VRAM.
   * Raise to 256 for sharper walls at 126 MB; this is the only value to touch.
   */
  PIXELS_PER_METER: 192,
  BASE_COLOR: "#8d8b86", // concrete
  NOISE_AMOUNT: 0.06,
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
} as const;

export const SPRAY = {
  MAX_DISTANCE: 2, // meters — beyond this the spray does not reach
  MIN_DISTANCE: 0.4,
  // Footprint radius on the wall, in METERS, not texture pixels. Keeping the
  // journal in world units makes it independent of TEXTURE.PIXELS_PER_METER —
  // change the resolution and old strokes still replay at the right size.
  BASE_RADIUS_M: 0.152, // ~30 cm across at point blank
  RADIUS_PER_METER: 0.35, // how much the cone spreads with distance
  MIN_SIZE: 0.08, // tightest cone — a thin line
  MAX_SIZE: 1, // widest cone, and the size the can starts at
  SIZE_STEP: 0.12, // multiplicative step per wheel notch, so each click feels equal
  BASE_ALPHA: 0.1, // opacity of a single dab
  ALPHA_FALLOFF: 0.5, // opacity lost with distance
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
  HOLD_TIME: 1.5, // seconds on one spot before the paint starts to run
  REPEAT_TIME: 1.4, // an already soaked spot keeps running, sooner
  HOLD_RADIUS: 0.35, // fraction of the spray radius that still counts as "here"
  MIN_HOLD_RADIUS: 0.1, // meters, floor for the above

  START_SPEED: 0.06, // m/s — a bead needs a moment to break away
  ACCELERATION: 0.12, // m/s^2
  MAX_SPEED: 0.4,

  LENGTH: 0.55, // meters of travel before the paint dries up
  LENGTH_JITTER: 0.35, // +/- fraction, so runs are not all the same
  SEGMENT: 0.015, // meters between recorded points

  RADIUS: 0.1, // fraction of the spray radius
  MIN_RADIUS: 0.004, // meters, so a thin cap still leaves a visible run
  NARROWING: 0.55, // how much the trail thins out by the end
  BEAD: 1.7, // terminal blob, as a multiple of the final radius
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
 * the brush, and the inventory and the cursor pick it up on their own.
 *
 * Caps do NOT turn with the stroke, which is the whole point of the flat ones:
 * a calligraphy cap paints thick across its edge and thin along it.
 */
export type CapShape = "ellipse" | "rect" | "triangle";
export type CapId =
  | "circle"
  | "square"
  | "triangle"
  | "flare"
  | "calligraphy"
  | "marker"
  | "roller";

export type CapDefinition = {
  id: CapId;
  label: string;
  hint: string;
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
};

export const CAPS: readonly CapDefinition[] = [
  {
    id: "circle",
    label: "Circle",
    hint: "The everyday cap",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    size: 1,
    softness: 0.6,
    flow: 1,
    grain: 1,
  },
  {
    id: "square",
    label: "Square",
    hint: "Blocky, hard corners",
    shape: "rect",
    aspect: 1,
    angle: 0,
    size: 1,
    softness: 0.6,
    flow: 1,
    grain: 1,
  },
  {
    id: "triangle",
    label: "Triangle",
    hint: "Wedge tip",
    shape: "triangle",
    aspect: 1,
    angle: 0,
    size: 1,
    softness: 0.6,
    flow: 1,
    grain: 1,
  },
  {
    id: "flare",
    label: "Flare",
    hint: "Wide, soft, low pressure",
    shape: "ellipse",
    aspect: 1,
    angle: 0,
    size: 1.9,
    softness: 0.95,
    flow: 0.62,
    grain: 1.8,
  },
  {
    id: "calligraphy",
    label: "Calligraphy",
    hint: "Angled edge, thick and thin",
    shape: "rect",
    aspect: 3.2,
    angle: -45,
    size: 1,
    softness: 0.35,
    flow: 1.15,
    grain: 0.7,
  },
  {
    id: "marker",
    label: "Marker",
    hint: "Flat chisel, sharp and opaque",
    shape: "rect",
    aspect: 3.6,
    angle: 0,
    size: 0.45,
    softness: 0.15,
    flow: 1.5,
    grain: 0.35,
  },
  {
    id: "roller",
    label: "Roller",
    hint: "Covers ground fast",
    shape: "rect",
    aspect: 4.2,
    angle: 0,
    size: 1.2,
    softness: 0.08,
    flow: 1.9,
    grain: 0.15,
  },
];

export const CAP_BY_ID = new Map(CAPS.map((cap) => [cap.id, cap]));

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
