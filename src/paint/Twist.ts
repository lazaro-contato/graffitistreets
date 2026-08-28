import { SPRAY } from "../config";

/** Wraps an angle to (-PI, PI], so a turn is always the short way round. */
export function wrapAngle(radians: number) {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

/**
 * Turns a cap with the stroke.
 *
 * The angle is measured against the heading the stroke *started* with, not
 * against the wall, so a cap keeps whatever grip it was laid down at: begin
 * rolling upwards and it stays across the travel through a turn; begin
 * sideways and it stays along it. Either way, arcing mid-stroke swings it
 * round, and the lag is what puts it on the diagonal while it catches up.
 *
 * The lag is spent in travel rather than in time, because the swing comes from
 * dragging the thing, not from holding still. Standing still never rotates it.
 *
 * Kept here rather than inside PaintSystem so the workshop's practice wall can
 * roll a roller the same way the street does. A cap that behaved differently
 * in the two places would make the practice wall worse than useless.
 */
export class TwistTracker {
  /** Heading of the stroke's first real movement, in canvas angle terms. */
  private origin = 0;
  private anchored = false;
  private angle = 0;

  /** Current twist, in radians, added to the cap's own fixed angle. */
  get current() {
    return this.angle;
  }

  /** Called when a stroke ends: the next one starts with a fresh grip. */
  reset() {
    this.anchored = false;
    this.angle = 0;
  }

  /**
   * Advances by one step of travel, in **metres on the wall** and in canvas
   * orientation — y grows downwards, the way a 2D context does.
   *
   * Metres rather than UV because u spans the length of a wall and v only its
   * height: an angle measured in UV would be sheared by whatever the wall's
   * proportions happen to be.
   */
  advance(dxMeters: number, dyMeters: number): number {
    const step = Math.hypot(dxMeters, dyMeters);
    // Shorter than this is jitter, not a direction, and feeding it in would
    // make a cap wander while the hand is essentially still.
    if (step < SPRAY.TWIST_MIN_STEP_M) return this.angle;

    const heading = Math.atan2(dyMeters, dxMeters);
    if (!this.anchored) {
      this.origin = heading;
      this.anchored = true;
      return this.angle;
    }

    const turned = wrapAngle(heading - this.origin);
    this.angle +=
      wrapAngle(turned - this.angle) * (1 - Math.exp(-step / SPRAY.TWIST_LAG_M));
    return this.angle;
  }
}
