import { DRIP, WORLD, type SurfaceId } from "../config";
import type { Transport } from "../net/Transport";

type Drip = {
  strokeId: string;
  side: SurfaceId;
  color: string;
  u: number;
  v: number;
  speed: number;
  radius: number;
  startRadius: number;
  travelled: number;
  length: number;
  sinceSegment: number;
};

/**
 * Paint runs.
 *
 * Each run is an ordinary Stroke emitted through the Transport, appended to as
 * it descends. Nothing here draws — like PaintSystem, it only sends messages,
 * so a run survives undo and replay and will sync in multiplayer untouched.
 *
 * The client that over-sprayed owns the simulation; everybody else just
 * receives the resulting points.
 */
export class DripSystem {
  private active: Drip[] = [];

  constructor(
    private transport: Transport,
    private authorId: string,
  ) {}

  get count() {
    return this.active.length;
  }

  /**
   * Starts a run at a soaked spot.
   *
   * `sprayRadius` is in meters and `soakSeconds` is how long the trigger has
   * been held on this spot without a break. Both feed the starting width,
   * because both decide how much wet paint is on the wall: a wide blast loads
   * it faster, and holding on loads it for longer.
   */
  spawn(
    side: SurfaceId,
    u: number,
    v: number,
    color: string,
    sprayRadius: number,
    soakSeconds: number,
  ) {
    if (this.active.length >= DRIP.MAX_ACTIVE) return;

    // Paint pools at the bottom of the sprayed patch, not at its centre.
    const startV = v - (sprayRadius * DRIP.START_DROP) / WORLD.WALL_HEIGHT;
    // Spraying at the foot of the wall has nowhere left to run.
    if (startV <= 0) return;

    // Paint keeps piling on past the point where it first broke, so runs shed
    // later in a long hold come off heavier than the first one.
    const heldOn = Math.max(0, soakSeconds - DRIP.HOLD_TIME);
    const flood = Math.min(DRIP.MAX_FLOOD, 1 + heldOn * DRIP.FLOOD_GROWTH);

    const radius = Math.max(
      DRIP.MIN_START_RADIUS,
      sprayRadius * DRIP.START_WIDTH * flood,
    );
    const jitter = 1 + (Math.random() * 2 - 1) * DRIP.LENGTH_JITTER;

    const drip: Drip = {
      strokeId: crypto.randomUUID(),
      side,
      color,
      u,
      v: startV,
      speed: DRIP.START_SPEED,
      radius,
      startRadius: radius,
      travelled: 0,
      length: DRIP.LENGTH * jitter,
      sinceSegment: 0,
    };

    this.active.push(drip);
    this.append(drip, radius);
  }

  update(dt: number) {
    // Iterate backwards so finished runs can be spliced out in place.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const drip = this.active[i];

      drip.speed = Math.min(DRIP.MAX_SPEED, drip.speed + DRIP.ACCELERATION * dt);
      const step = drip.speed * dt;

      drip.travelled += step;
      drip.sinceSegment += step;
      drip.v -= step / WORLD.WALL_HEIGHT;
      drip.u +=
        ((Math.random() * 2 - 1) * DRIP.WANDER * dt) / WORLD.STREET_LENGTH;

      const progress = Math.min(1, drip.travelled / drip.length);
      drip.radius = drip.startRadius * (1 - DRIP.NARROWING * progress);

      // Dried up, or reached the pavement.
      if (progress >= 1 || drip.v <= 0) {
        // One last point at the tapered width, so the trail comes to a point
        // instead of stopping mid-stride.
        this.append(drip, drip.radius);
        this.transport.send({ kind: "stroke:end", strokeId: drip.strokeId });
        this.active.splice(i, 1);
        continue;
      }

      // Record by distance, not by frame, so the trail is identical at any
      // framerate and does not flood the journal on a fast machine.
      if (drip.sinceSegment >= DRIP.SEGMENT) {
        drip.sinceSegment = 0;
        this.append(drip, drip.radius);
      }
    }
  }

  private append(drip: Drip, radius: number) {
    this.transport.send({
      kind: "stroke:append",
      strokeId: drip.strokeId,
      side: drip.side,
      color: drip.color,
      // A running bead is liquid, so it is round whatever cap sprayed it.
      cap: "standard",
      point: {
        u: drip.u,
        v: Math.max(0, drip.v),
        r: radius,
        a: DRIP.ALPHA,
      },
      authorId: this.authorId,
    });
  }
}
