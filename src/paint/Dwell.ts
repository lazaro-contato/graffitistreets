import { DRIP } from "../config";

/**
 * Watches for the spray sitting still on one spot, and says when it floods.
 *
 * Distance is measured on the wall in **metres**, not in UV: u spans the whole
 * length of a wall and v only its height, so a UV radius would be a flat
 * ellipse. The tolerance scales with the cone, since holding a wide spray
 * steady within a few centimetres is still the same spot as far as the wall is
 * concerned.
 *
 * Two clocks on the same spot, and the difference between them is the whole
 * behaviour: `time` resets on every run and decides *when* the next one breaks,
 * while `soak` does not and decides *how heavy* it is. Paint keeps piling on
 * past the moment the first run broke, so each following one comes off
 * heavier.
 *
 * Shared with the workshop's practice wall, which is the point: a wall that
 * saturates on a different schedule from the street would be telling you about
 * a can you are not going to be holding.
 */
export class DwellTracker {
  private x = 0;
  private y = 0;
  private time = 0;
  private soak = 0;
  private anchored = false;
  private hasRun = false;

  /** Called when the trigger is released, or the aim leaves the wall. */
  reset() {
    this.anchored = false;
    this.time = 0;
    this.soak = 0;
    this.hasRun = false;
  }

  /**
   * Advances by `dt` at a point on the wall, given in metres.
   *
   * Returns how long the spot has been soaking when it has just flooded and a
   * run should break away, or null when it has not.
   */
  advance(
    xMeters: number,
    yMeters: number,
    sprayRadius: number,
    dt: number,
  ): number | null {
    const tolerance = Math.max(
      DRIP.MIN_HOLD_RADIUS,
      sprayRadius * DRIP.HOLD_RADIUS,
    );

    if (
      !this.anchored ||
      Math.hypot(xMeters - this.x, yMeters - this.y) > tolerance
    ) {
      this.x = xMeters;
      this.y = yMeters;
      this.time = 0;
      this.soak = 0;
      this.anchored = true;
      this.hasRun = false;
      return null;
    }

    this.time += dt;
    this.soak += dt;
    const threshold = this.hasRun ? DRIP.REPEAT_TIME : DRIP.HOLD_TIME;
    if (this.time < threshold) return null;

    // Saturated. Let it run, and let an already soaked spot run again sooner.
    this.time = 0;
    this.hasRun = true;
    return this.soak;
  }
}
