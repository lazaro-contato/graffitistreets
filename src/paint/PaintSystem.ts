import { SPRAY, WORLD, CAP_BY_ID } from "../config";
import { SprayCan } from "./SprayCan";
import type { Aim, AimResult } from "./Aim";
import type { DripSystem } from "./DripSystem";
import type { Transport } from "../net/Transport";
import type { Stroke, StrokePoint } from "../state/types";
import type { SurfaceId } from "../config";
import { TwistTracker } from "./Twist";
import { DwellTracker } from "./Dwell";

const SAMPLE_INTERVAL = 1 / SPRAY.SAMPLE_HZ;

/**
 * The only place that builds strokes.
 * It deliberately draws nothing — it emits through the Transport.
 */
export class PaintSystem {
  private activeStroke: Stroke | null = null;
  private activeSide: SurfaceId | null = null;
  private accumulator = 0;

  /** Turns a cap that follows the stroke. Only the roller opts in. */
  private twister = new TwistTracker();

  /** Where the spray has been sitting, and for how long. See trackDwell. */
  private dwell = new DwellTracker();

  constructor(
    private aim: Aim,
    private can: SprayCan,
    private transport: Transport,
    private drips: DripSystem,
    private authorId: string,
  ) {}

  /** Current cap twist, so the cursor can show the same angle it will paint. */
  get capTwist() {
    return this.twister.current;
  }

  update(isPainting: boolean, dt: number) {
    if (!isPainting) {
      this.endStroke();
      this.dwell.reset();
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
      w: this.trackTwist(target.u, target.v),
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
   * Twist for the point about to be recorded.
   *
   * The maths lives in TwistTracker, shared with the workshop's practice wall.
   * All this adds is the conversion from strip UV to metres on the wall, which
   * only this side knows how to do.
   */
  private trackTwist(u: number, v: number): number {
    if (!CAP_BY_ID.get(this.can.cap)!.twists) return 0;

    const prev = this.activeStroke?.points[this.activeStroke.points.length - 1];
    if (!prev) return 0;

    // Canvas angle terms: v grows up the wall, y grows down the canvas.
    return this.twister.advance(
      (u - prev.u) * WORLD.STREET_LENGTH,
      -(v - prev.v) * WORLD.WALL_HEIGHT,
    );
  }

  /**
   * Watches for the spray sitting still on one spot, and spawns a run when it
   * floods.
   *
   * The maths lives in DwellTracker, shared with the workshop's practice wall.
   * All this adds is the conversion from strip UV to metres on the wall, which
   * only this side knows how to do.
   */
  private trackDwell(target: AimResult, dt: number) {
    if (!target.paintable || !target.panel) {
      this.dwell.reset();
      return;
    }

    const sprayRadius = this.can.radiusAt(target.distance);
    const soak = this.dwell.advance(
      target.u * WORLD.STREET_LENGTH,
      target.v * WORLD.WALL_HEIGHT,
      sprayRadius,
      dt,
    );
    if (soak === null) return;

    this.drips.spawn(
      target.panel.side,
      target.u,
      target.v,
      this.can.color,
      sprayRadius,
      soak,
    );
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
    this.twister.reset();
  }
}
