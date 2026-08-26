/**
 * Every tunable number in the game lives here.
 * These values get tweaked constantly — keep them in one place.
 */

export const WORLD = {
  STREET_LENGTH: 8, // meters, along Z — the wall runs the whole length
  STREET_WIDTH: 12, // meters, along X (wall to wall)
  WALL_HEIGHT: 3,
  PANEL_WIDTH: 4, // width of each paintable panel; must divide STREET_LENGTH
  SIDEWALK_WIDTH: 1.6,
  SIDEWALK_HEIGHT: 0.15,
} as const;

/**
 * How the player gets around. Picked in the menu before entering, because it
 * changes what shift and space do.
 */
export type MovementMode = "walk" | "free";

export const MOVEMENT_MODES: readonly {
  id: MovementMode;
  label: string;
  hint: string;
}[] = [
  { id: "walk", label: "A pé", hint: "Shift corre, espaço pula" },
  { id: "free", label: "Voo livre", hint: "Espaço sobe, shift desce" },
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
 * Optional wall photography, dropped into `public/wall/`.
 *
 * The albedo is NOT a material map: the panel canvas is the colour texture,
 * because paint is drawn on top of it, so the photo is tiled into that canvas
 * as the base coat. Normal and roughness never get painted, so those go on the
 * material and are shared between panels.
 *
 * Any file that is missing simply falls back to the procedural concrete.
 */
export const SURFACE = {
  ALBEDO: "/wall/albedo.jpg",
  NORMAL: "/wall/normal.jpg", // OpenGL convention (green up), not DirectX
  ROUGHNESS: "/wall/roughness.jpg",
  /** How much wall one tile of those images covers. Keeps brick brick-sized. */
  TILE_METERS: 2,
  /** Damp patches kept over the photo, so panels do not read as clones. */
  GRUNGE_ALPHA: 0.04,
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

export const CAP_CATEGORIES: readonly {
  id: CapCategory;
  label: string;
  hint: string;
}[] = [
  {
    id: "cap",
    // "Cap" stays in English: it is the word the graffiti world uses.
    label: "Caps",
    hint: "Afaste-se para alcançar mais, chegue perto para um traço fino e forte",
  },
  {
    id: "tool",
    label: "Ferramentas",
    hint: "Encostados no muro — a mesma marca em qualquer distância",
  },
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
    category: "cap",
    label: "Redondo",
    hint: "O cap do dia a dia",
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
    category: "cap",
    label: "Quadrado",
    hint: "Chapado, cantos duros",
    shape: "rect",
    aspect: 1,
    angle: 0,
    size: 1,
    softness: 0.6,
    flow: 1,
    grain: 1,
  },
  {
    id: "flare",
    category: "cap",
    // Another graffiti term left alone, like "cap".
    label: "Flare",
    hint: "Largo, suave, baixa pressão",
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
    category: "tool",
    label: "Caligrafia",
    hint: "Ponta inclinada, grosso e fino",
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
    category: "tool",
    label: "Marcador",
    hint: "Ponta chanfrada, nítida e opaca",
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
    category: "tool",
    label: "Rolo",
    hint: "Cobre área rápido",
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
