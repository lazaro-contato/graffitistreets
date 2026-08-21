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
   * The cap's own size is folded in here, so every downstream consumer —
   * renderer, cursor, drips — sees one consistent number.
   */
  radiusAt(distance: number) {
    return (
      SPRAY.BASE_RADIUS_M *
      this.sizeMultiplier *
      CAP_BY_ID.get(this.cap)!.size *
      (1 + distance * SPRAY.RADIUS_PER_METER)
    );
  }

  alphaAt(distance: number) {
    return (
      (SPRAY.BASE_ALPHA * this.flowMultiplier * CAP_BY_ID.get(this.cap)!.flow) /
      (1 + distance * SPRAY.ALPHA_FALLOFF)
    );
  }
}
