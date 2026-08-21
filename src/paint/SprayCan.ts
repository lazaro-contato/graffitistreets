import {
  PALETTE,
  SPRAY,
  CAP_BY_ID,
  DEFAULT_CAP,
  type CapId,
} from "../config";

/**
 * Current spray settings.
 *
 * radiusAt() and alphaAt() are the whole gamefeel: standing close paints
 * tight and strong, backing away turns the spray into a wide faint mist.
 */
/** Where a range sits between the can's minimum and maximum reach, 0 to 1. */
function rangeFraction(distance: number) {
  const span = SPRAY.MAX_DISTANCE - SPRAY.MIN_DISTANCE;
  return Math.min(1, Math.max(0, (distance - SPRAY.MIN_DISTANCE) / span));
}

export class SprayCan {
  color: string = PALETTE[2];
  /** Cap fitted to the can. Picked from the backpack. */
  cap: CapId = DEFAULT_CAP;
  /** Starts wide open; shift + wheel narrows it down to a thin line. */
  sizeMultiplier: number = SPRAY.MAX_SIZE;
  flowMultiplier = 1;

  setColor(hex: string) {
    this.color = hex;
  }

  setCap(cap: CapId) {
    this.cap = cap;
  }

  /**
   * Steps the cone size by whole wheel notches.
   *
   * The step is multiplicative, not additive: going 1.0 -> 0.9 and 0.2 -> 0.1
   * are the same absolute amount but wildly different changes to the spray, so
   * a linear step feels dead at the top and jumpy at the bottom.
   */
  adjustSize(notches: number) {
    const next = this.sizeMultiplier * Math.exp(notches * SPRAY.SIZE_STEP);
    this.sizeMultiplier = Math.min(
      SPRAY.MAX_SIZE,
      Math.max(SPRAY.MIN_SIZE, next),
    );
  }

  /**
   * Footprint radius on the wall, in meters, at the given range.
   *
   * A cap is a cone, so its width is proportional to how far the can is from
   * the wall: wide open at MAX_DISTANCE, closing to a 1 cm dot right up
   * against it. The cap's own size and the wheel multiplier are folded in
   * here, so every downstream consumer — renderer, cursor, drips — sees one
   * consistent number.
   *
   * Tools are not cones. They are held against the wall, so they keep their
   * footprint whatever the range.
   */
  radiusAt(distance: number) {
    const cap = CAP_BY_ID.get(this.cap)!;
    const widest = SPRAY.BASE_RADIUS_M * this.sizeMultiplier * cap.size;

    if (cap.category === "tool") return widest;

    const reach = rangeFraction(distance);
    return Math.max(
      SPRAY.MIN_RADIUS_M,
      SPRAY.MIN_RADIUS_M + (widest - SPRAY.MIN_RADIUS_M) * reach,
    );
  }

  /**
   * Opacity of one dab.
   *
   * The mirror of radiusAt: the same paint hitting a smaller patch of wall
   * has to bite harder. Up close it covers in a few passes, at full reach it
   * takes many — that is the cost of the extra width.
   */
  alphaAt(distance: number) {
    const cap = CAP_BY_ID.get(this.cap)!;
    const flow = this.flowMultiplier * cap.flow;

    if (cap.category === "tool") return SPRAY.TOOL_ALPHA * flow;

    const reach = rangeFraction(distance);
    const spread =
      SPRAY.FAR_ALPHA +
      (SPRAY.NEAR_ALPHA - SPRAY.FAR_ALPHA) *
        Math.pow(1 - reach, SPRAY.ALPHA_CURVE);
    return spread * flow;
  }
}
