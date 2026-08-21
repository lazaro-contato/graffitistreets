import { SPRAY, DRIP, WORLD } from "../config";
import { SprayCan } from "./SprayCan";
import type { Aim, AimResult } from "./Aim";
import type { DripSystem } from "./DripSystem";
import type { Transport } from "../net/Transport";
import type { Stroke, StrokePoint } from "../state/types";
import type { Side } from "../config";

const SAMPLE_INTERVAL = 1 / SPRAY.SAMPLE_HZ;

/**
 * The only place that builds strokes.
 * It deliberately draws nothing — it emits through the Transport.
 */
export class PaintSystem {
  private activeStroke: Stroke | null = null;
  private activeSide: Side | null = null;
  private accumulator = 0;

  /** Where the spray has been sitting, and for how long. See trackDwell. */
  private dwellU = 0;
  private dwellV = 0;
  private dwellTime = 0;
  private dwellAnchored = false;
  private dwellHasRun = false;

  constructor(
    private aim: Aim,
    private can: SprayCan,
    private transport: Transport,
    private drips: DripSystem,
    private authorId: string,
  ) {}

  update(isPainting: boolean, dt: number) {
    if (!isPainting) {
      this.endStroke();
      this.resetDwell();
      return;
    }

    // Dwell is tracked every frame with real dt, not on the sampling cadence,
    // so "three seconds" means three seconds on any machine.
    this.trackDwell(this.aim.current, dt);

    // Fixed sampling rate, not once per frame. On a 165 Hz monitor a per-frame
    // sample would lay down 165 points per second and paint darker than on a
    // 30 Hz one. Fixed cadence makes paint accumulate the same everywhere, and
    // keeps network traffic predictable later.
    this.accumulator += dt;
    if (this.accumulator < SAMPLE_INTERVAL) return;
    this.accumulator = 0;

    const target = this.aim.current;

    // Aiming away from any wall finishes the stroke.
    if (!target.hit) {
      this.endStroke();
      return;
    }
    // Standing too close only pauses it, so backing off resumes the same line.
    if (!target.paintable || !target.panel) return;

    // Only crossing to the *other wall* breaks the stroke. Crossing a panel
    // boundary must not: panels are a rendering detail, and closing the stroke
    // there would restart the interpolation and leave a visible gap on the seam.
    const side = target.panel.side;
    if (this.activeSide !== null && this.activeSide !== side) {
      this.endStroke();
    }

    const point: StrokePoint = {
      u: target.u,
      v: target.v,
      r: this.can.radiusAt(target.distance),
      a: this.can.alphaAt(target.distance),
    };

    if (!this.activeStroke) {
      this.activeStroke = {
        id: crypto.randomUUID(),
        side,
        color: this.can.color,
        cap: this.can.cap,
        points: [point],
        authorId: this.authorId,
        t: Date.now(),
      };
      this.activeSide = side;
    } else {
      this.activeStroke.points.push(point);
    }

    // Emit point by point rather than the finished stroke, so remote players
    // see the line appear live instead of popping in on mouse up.
    // The colour and cap come from the stroke, not the can: swapping either
    // one mid-stroke must not change the line already being drawn.
    this.transport.send({
      kind: "stroke:append",
      strokeId: this.activeStroke.id,
      side: this.activeStroke.side,
      color: this.activeStroke.color,
      cap: this.activeStroke.cap,
      point,
      authorId: this.authorId,
    });
  }

  /**
   * Watches for the spray sitting still on one spot.
   *
   * Distance is measured on the wall in meters, not in UV: u spans 60 m and v
   * spans 4 m, so a UV radius would be a flat ellipse. The tolerance scales
   * with the cone, since holding a wide spray steady within a few centimetres
   * is still the same spot as far as the wall is concerned.
   */
  private trackDwell(target: AimResult, dt: number) {
    if (!target.paintable || !target.panel) {
      this.resetDwell();
      return;
    }

    const sprayRadius = this.can.radiusAt(target.distance);
    const tolerance = Math.max(
      DRIP.MIN_HOLD_RADIUS,
      sprayRadius * DRIP.HOLD_RADIUS,
    );

    const dx = (target.u - this.dwellU) * WORLD.STREET_LENGTH;
    const dy = (target.v - this.dwellV) * WORLD.WALL_HEIGHT;

    if (!this.dwellAnchored || Math.hypot(dx, dy) > tolerance) {
      this.dwellU = target.u;
      this.dwellV = target.v;
      this.dwellTime = 0;
      this.dwellAnchored = true;
      this.dwellHasRun = false;
      return;
    }

    this.dwellTime += dt;
    const threshold = this.dwellHasRun ? DRIP.REPEAT_TIME : DRIP.HOLD_TIME;
    if (this.dwellTime < threshold) return;

    // Saturated. Let it run, and let an already soaked spot run again sooner.
    this.dwellTime = 0;
    this.dwellHasRun = true;
    this.drips.spawn(
      target.panel.side,
      target.u,
      target.v,
      this.can.color,
      sprayRadius,
    );
  }

  private resetDwell() {
    this.dwellAnchored = false;
    this.dwellTime = 0;
    this.dwellHasRun = false;
  }

  private endStroke() {
    if (this.activeStroke) {
      this.transport.send({
        kind: "stroke:end",
        strokeId: this.activeStroke.id,
      });
    }
    this.activeStroke = null;
    this.activeSide = null;
  }
}
