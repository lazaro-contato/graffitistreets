/**
 * What a map is.
 *
 * A map is pure data, the same way a cap is: dimensions, dressing, weather and
 * where the lamps stand. Nothing here builds anything — `world/` reads these
 * and puts the alley together, so adding a map is adding a file, not a branch.
 *
 * This lives beside `config.ts` rather than inside it for one reason: config is
 * the tuning that applies everywhere, and a map is the tuning that applies to
 * one place. Both are data, and neither is code.
 */

/**
 * Photographic dressing for one surface: albedo, normal, roughness.
 *
 * The albedo is NOT a material map. A paintable panel's canvas is its colour
 * texture, because paint is drawn onto it, so the photo is tiled into that
 * canvas as the base coat. Normal and roughness never get painted, so those
 * ride on the material.
 */
export type SurfaceSpec = {
  albedo: string;
  normal: string; // OpenGL convention (green up), not DirectX
  roughness: string;
  /**
   * How much surface one tile of those images covers.
   *
   * Per surface, not global: a concrete panel and a coat of flaking paint are
   * photographed at different scales, and forcing both to the same tile would
   * leave one of them obviously the wrong size.
   */
  tileMeters: number;
  /**
   * Slides the tiling along U. Only the road uses it: the photograph carries a
   * painted line down its edge, and half a tile of offset is what puts that
   * line on the centre of the alley instead of under a kerb.
   */
  offsetU?: number;
};

/**
 * Identity of one paintable wall, and of the map it belongs to.
 *
 * Both are strings rather than a closed union on purpose — they are what a
 * `Stroke` is keyed by, so they are persistence format. A new map must be able
 * to add a wall without every existing journal needing a migration.
 *
 * The corollary is that these names are frozen once anything has been painted
 * on them. Renaming a wall orphans every stroke on it.
 */
export type MapId = string;
export type SurfaceId = string;

/** Which side of the alley a wall stands on. Decides position and facing. */
export type WallSide = "left" | "right";

export type WallDefinition = {
  /** Stable identity, stored on every stroke. Never rename a live one. */
  id: SurfaceId;
  side: WallSide;
  surface: SurfaceSpec;
};

/**
 * Where a street lamp stands, in signs rather than metres: which wall it is
 * tucked against, and which end of the alley it sits at. The rig itself — pole
 * height, cone angle, reach — is shared tuning and lives in `config.ts`.
 *
 * `shadow` is the shadow map size, and 0 means this lamp casts none. Shadow
 * maps are the most expensive thing in the scene, so a map with four lamps
 * gives detail to one and direction to the rest.
 */
export type LampPlacement = {
  side: -1 | 1;
  end: -1 | 1;
  shadow: number;
};

/**
 * The weather. Per map, because it is the strongest thing separating one place
 * from another — the same alley at dusk and at midnight is two maps.
 */
export type SkySpec = {
  sky: string;
  fogNear: number;
  fogFar: number;
  /**
   * Ambient floor. Kept low so the lamps' own falloff is what shapes the
   * scene: neither of these attenuates with distance, so every unit of them
   * flattens exactly the gradient that makes a light look like it has a source.
   */
  fillSky: string;
  fillGround: string;
  fillIntensity: number;
  moonColor: string;
  moonIntensity: number;
};

/**
 * Everything the player cannot paint, which is what stops the alley from being
 * a pair of planes floating in the void: a coping along the top of each wall,
 * a building mass rising behind it, and a block across each end.
 */
export type EnclosureSpec = {
  buildingHeight: number;
  buildingDepth: number; // how far the mass behind each wall extends outward
  endDepth: number; // thickness of the blocks capping each end
  copingOverhang: number; // how far the wall cap juts back over the alley
  copingHeight: number;
};

export type MapDefinition = {
  /** Stable identity, stored on every stroke. Never rename a live one. */
  id: MapId;
  /** i18n key stem: `map.<id>.label` and `map.<id>.hint`. */
  length: number; // metres along Z — the walls run the whole of it
  width: number; // metres along X, wall face to wall face
  wallHeight: number;
  /**
   * Width of one panel canvas. Must divide `length` exactly, or the last panel
   * of a strip comes out short and `panelRange` addresses paint that is not
   * there. `measure()` refuses a map that gets this wrong.
   */
  panelWidth: number;
  /**
   * Wall resolution, in pixels per metre — the one number that sets canvas
   * size, and the whole memory budget. Deriving both dimensions from it keeps
   * the resolution identical on both axes, which is what makes a round dab in
   * canvas space come out round on the wall.
   *
   * Per map, because a cramped corridor you are always pressed against wants
   * more detail per metre than a boulevard you paint from across the road, and
   * the boulevard has far more square metres to pay for.
   */
  pixelsPerMeter: number;
  walls: readonly WallDefinition[];
  road: SurfaceSpec;
  sky: SkySpec;
  lamps: readonly LampPlacement[];
  enclosure: EnclosureSpec;
};

/**
 * A map definition with everything derivable from it worked out once.
 *
 * These used to be module-level constants in `config.ts`, computed the moment
 * the module loaded. That is exactly what made a second map impossible: half
 * the codebase imported the dimensions of the one alley directly. Now they
 * travel with the map they describe.
 */
export type MapMetrics = {
  readonly def: MapDefinition;
  /** Half the length, along Z. The alley is centred on the origin. */
  readonly halfLength: number;
  /** Where a wall face sits, at -wallX and +wallX. */
  readonly wallX: number;
  readonly panelsPerWall: number;
  /** Canvas size of one panel, in pixels. Integers — a canvas has no halves. */
  readonly panelTextureWidth: number;
  readonly panelTextureHeight: number;
  /**
   * Width of a whole wall strip in texture pixels. This space is never
   * allocated: it is the coordinate system strokes live in.
   */
  readonly stripWidthPx: number;
  /** Highest the eye may reach in free flight: clearance over the wall. */
  readonly flyCeiling: number;
};

/** Clearance the eye keeps over the top of the wall in free flight. */
const FLY_HEADROOM = 0.5;

/**
 * Works out everything derivable from a map, and refuses one that cannot work.
 *
 * The check is not defensive dressing. A `panelWidth` that does not divide the
 * length produces a strip whose last panel is narrower than the coordinate
 * space says it is, and the symptom is paint vanishing near one end of one
 * wall — a long way from the number that caused it.
 */
export function measure(def: MapDefinition): MapMetrics {
  const panels = def.length / def.panelWidth;
  if (!Number.isInteger(panels)) {
    throw new Error(
      `Map "${def.id}": panelWidth ${def.panelWidth} does not divide ` +
        `length ${def.length} — ${panels} panels per wall.`,
    );
  }

  return {
    def,
    halfLength: def.length / 2,
    wallX: def.width / 2,
    panelsPerWall: panels,
    // Rounded, because a canvas silently truncates a fractional size and every
    // pixel calculation downstream would then be off by that fraction.
    panelTextureWidth: Math.round(def.panelWidth * def.pixelsPerMeter),
    panelTextureHeight: Math.round(def.wallHeight * def.pixelsPerMeter),
    stripWidthPx: Math.round(def.panelWidth * def.pixelsPerMeter) * panels,
    flyCeiling: def.wallHeight + FLY_HEADROOM,
  };
}
