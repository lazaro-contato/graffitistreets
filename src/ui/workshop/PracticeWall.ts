import { LOADOUT, SPRAY, type CanSpec } from "../../config";
import { SprayCan } from "../../paint/SprayCan";
import { TwistTracker } from "../../paint/Twist";
import { DwellTracker } from "../../paint/Dwell";
import { DripSystem } from "../../paint/DripSystem";
import { LocalTransport } from "../../net/LocalTransport";
import type { StrokeAppend } from "../../state/types";
import {
  renderSketch,
  renderSketchStroke,
  type SketchSize,
  type SketchStroke,
} from "../../paint/Sketch";
import { t } from "../../i18n/i18n";

/**
 * How much wall the practice canvas stands for, vertically.
 *
 * Fixing the height rather than the width is what keeps a cap honest: the
 * panel can be any shape the layout gives it, but a fat cap has to cover the
 * same fraction of it either way, and it is height that a stroke is read
 * against. A real wall is three metres, so this is a bit over half of one.
 */
const WALL_METERS = 1.8;

/** Reseeded on every clear, so a fresh wall is a fresh wall. */
let seed = 1;

/** Seconds between samples. The street's cadence, and for the same reasons. */
const SAMPLE_INTERVAL = 1 / SPRAY.SAMPLE_HZ;

/** Longest step the clock will believe, so a stall cannot dump paint. */
const MAX_STEP = 0.05;

export type Dial = {
  key: "size" | "flow";
  min: number;
  max: number;
  step: number;
};

const DIALS: readonly Dial[] = [
  { key: "size", min: SPRAY.MIN_SIZE, max: SPRAY.MAX_SIZE, step: 0.01 },
  { key: "flow", min: LOADOUT.MIN_FLOW, max: LOADOUT.MAX_FLOW, step: 0.05 },
];

export type PracticeWallHandlers = {
  /** A dial moved. The workshop writes it through to the loadout. */
  onDial: (change: Partial<CanSpec>) => void;
};

/**
 * The practice wall.
 *
 * It paints through the same primitives the street does — the same base coat,
 * the same brush, the same dab spacing, the same twist for a roller — because
 * the only question it exists to answer is what a can will do out there. A
 * preview with its own private painting code would be a different question.
 *
 * The two dials edit the can rather than the preview. Trying a width out and
 * then having to set it again somewhere else would be busywork, and it is what
 * makes eight cans a loadout instead of eight colours.
 *
 * Nothing painted here is kept. The workshop clears it on the way out, so the
 * wall is always blank when you arrive — a practice surface carrying somebody
 * else's session is just clutter.
 */
export class PracticeWall {
  private wrap = document.getElementById("wk-wall-wrap")!;
  private canvas = document.getElementById("wk-wall") as HTMLCanvasElement;
  private ctx = this.canvas.getContext("2d")!;
  private dialHost = document.getElementById("wk-dials")!;
  private combo = document.getElementById("wk-combo")!;

  private strokes: SketchStroke[] = [];
  private byId = new Map<string, SketchStroke>();
  private twister = new TwistTracker();
  private dwell = new DwellTracker();

  /**
   * Paint here travels the same road it does in the street: built into a
   * message, sent, and drawn when it comes back. That is what lets the real
   * DripSystem run on this wall without knowing it is a preview.
   */
  private transport = new LocalTransport();
  private drips = new DripSystem(this.transport, "practice");

  /** The stroke being laid down, and where the pointer last was. */
  private strokeId: string | null = null;
  private at: { u: number; v: number } | null = null;
  private painting = false;

  /** The clock. Without one, holding the trigger still would paint nothing. */
  private accumulator = 0;
  private lastFrame = 0;
  private frame = 0;

  /** A can used as a calculator: fixed sizing, so range never enters into it. */
  private gauge = new SprayCan();
  private can: CanSpec | null = null;
  private canIndex = 0;

  private size: SketchSize = {
    widthPx: 1,
    heightPx: 1,
    widthMeters: 1,
    heightMeters: WALL_METERS,
    pixelsPerMeter: 1,
  };

  private sliders = new Map<Dial["key"], HTMLInputElement>();
  private readouts = new Map<Dial["key"], HTMLElement>();

  constructor(private handlers: PracticeWallHandlers) {
    this.gauge.setSizing("fixed");
    this.buildDials();
    this.bindPainting();
    this.bindButtons();
    this.observeSize();
  }

  // ---------------------------------------------------------------- dials

  private buildDials() {
    for (const dial of DIALS) {
      const row = document.createElement("label");
      row.className = "wk-dial";

      const label = document.createElement("span");
      label.className = "wk-dial__label";
      label.dataset.i18n = `shop.dial.${dial.key}`;
      label.textContent = t(`shop.dial.${dial.key}`);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(dial.min);
      input.max = String(dial.max);
      input.step = String(dial.step);
      input.className = "wk-dial__slider";
      input.addEventListener("input", () => {
        this.handlers.onDial({ [dial.key]: Number(input.value) });
      });

      const value = document.createElement("span");
      value.className = "wk-dial__value";

      row.append(label, input, value);
      this.dialHost.appendChild(row);
      this.sliders.set(dial.key, input);
      this.readouts.set(dial.key, value);
    }
  }

  // -------------------------------------------------------------- painting

  /** Normalised coordinates, with v growing up the wall as it does in game. */
  private pointAt(event: PointerEvent) {
    const rect = this.wrap.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return {
      u: clamp((event.clientX - rect.left) / rect.width),
      v: clamp(1 - (event.clientY - rect.top) / rect.height),
    };
  }

  private bindPainting() {
    // Everything that marks this wall arrives here, whether it came from the
    // pointer or from a run breaking away, exactly as the street works.
    this.transport.onMessage((message) => {
      if (message.kind === "stroke:append") this.draw(message);
    });

    this.wrap.addEventListener("pointerdown", (event) => {
      if (!this.can) return;
      event.preventDefault();
      this.wrap.setPointerCapture(event.pointerId);

      this.twister.reset();
      this.dwell.reset();
      this.strokeId = crypto.randomUUID();
      this.at = this.pointAt(event);
      this.painting = true;
      // Lay the first dab now rather than up to a sample away, so the wall
      // marks the instant the button goes down.
      this.accumulator = SAMPLE_INTERVAL;
    });

    // The pointer only reports where it is. When that becomes paint is the
    // clock's business — see tick.
    this.wrap.addEventListener("pointermove", (event) => {
      if (this.painting) this.at = this.pointAt(event);
    });

    const end = () => {
      this.painting = false;
      this.strokeId = null;
      this.twister.reset();
      this.dwell.reset();
    };
    this.wrap.addEventListener("pointerup", end);
    this.wrap.addEventListener("pointercancel", end);
  }

  /**
   * One tick of the wall's own clock.
   *
   * The street samples at a fixed rate rather than once per frame, so that
   * paint accumulates at the same speed on a 30 Hz machine and a 165 Hz one.
   * This wall used to sample once per pointer event instead, which meant time
   * did not exist on it: holding the trigger still left a single dab where the
   * street would have laid a hundred and twenty and then let the paint run,
   * and moving slowly was no darker than moving fast. Hence the clock.
   */
  private tick = (now: number) => {
    this.frame = requestAnimationFrame(this.tick);

    const dt = Math.min(MAX_STEP, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (dt <= 0) return;

    if (this.painting && this.at && this.can) {
      // Dwell runs every frame on real time, not on the sampling cadence, so
      // that "three seconds" means three seconds.
      this.trackDwell(this.at, dt);

      this.accumulator += dt;
      if (this.accumulator >= SAMPLE_INTERVAL) {
        this.accumulator = 0;
        this.sample(this.at);
      }
    }

    // Outside the `painting` branch: a run carries on descending after the
    // trigger is let go.
    this.drips.update(dt);
  };

  /** Records one point of the stroke in hand. */
  private sample(at: { u: number; v: number }) {
    const can = this.can!;
    const stroke = this.byId.get(this.strokeId!);
    const prev = stroke?.points[stroke.points.length - 1];

    this.transport.send({
      kind: "stroke:append",
      strokeId: this.strokeId!,
      side: "left", // this wall has only one, and nothing here reads it
      color: can.color,
      cap: can.cap,
      point: {
        ...at,
        r: this.radius(),
        a: this.alpha(),
        w: prev ? this.twist(prev, at) : 0,
      },
      authorId: "practice",
    });
  }

  /** Floods a spot that has been sprayed long enough, and lets it run. */
  private trackDwell(at: { u: number; v: number }, dt: number) {
    const radius = this.radius();
    const soak = this.dwell.advance(
      at.u * this.size.widthMeters,
      at.v * this.size.heightMeters,
      radius,
      dt,
    );
    if (soak === null) return;
    this.drips.spawn("left", at.u, at.v, this.can!.color, radius, soak);
  }

  /** Draws a message, and only the new segment of it. */
  private draw(message: StrokeAppend) {
    let stroke = this.byId.get(message.strokeId);
    if (!stroke) {
      stroke = { cap: message.cap, color: message.color, points: [] };
      this.byId.set(message.strokeId, stroke);
      this.strokes.push(stroke);
    }

    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(message.point);

    // Redrawing the whole stroke on every point would be quadratic, and alpha
    // piles up on each pass so the line would darken as it grew.
    renderSketchStroke(this.ctx, this.size, {
      cap: stroke.cap,
      color: stroke.color,
      points: prev ? [prev, message.point] : [message.point],
    });
  }

  private twist(from: { u: number; v: number }, to: { u: number; v: number }) {
    if (!this.can) return 0;
    // Canvas angle terms: v grows up the wall, y grows down the canvas.
    return this.twister.advance(
      (to.u - from.u) * this.size.widthMeters,
      -(to.v - from.v) * this.size.heightMeters,
    );
  }

  /** Distance is ignored in fixed sizing, so these are the can's own numbers. */
  private radius() {
    return this.gauge.radiusAt(0);
  }

  private alpha() {
    return this.gauge.alphaAt(0);
  }

  // --------------------------------------------------------------- buttons

  private bindButtons() {
    document.getElementById("wk-undo")!.addEventListener("click", () => this.undo());
    document.getElementById("wk-clear")!.addEventListener("click", () => this.clear());
  }

  undo() {
    const gone = this.strokes.pop();
    if (!gone) return;
    for (const [id, stroke] of this.byId) {
      if (stroke === gone) this.byId.delete(id);
    }
    this.repaint();
  }

  /** Wipes the wall and its journal. Called on the way out of the workshop. */
  clear() {
    this.strokes.length = 0;
    this.byId.clear();
    this.painting = false;
    this.strokeId = null;
    this.twister.reset();
    this.dwell.reset();
    // A fresh system rather than a fresh method on it: runs still descending
    // belong to paint that is no longer there.
    this.drips = new DripSystem(this.transport, "practice");
    seed += 1;
    this.repaint();
  }

  /**
   * Starts and stops the wall's clock with the workshop.
   *
   * Nothing here should tick while the screen is closed: a run left mid-fall
   * would carry on down a wall nobody is looking at, and arrive finished.
   */
  start() {
    if (this.frame) return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  stop() {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  // ------------------------------------------------------------------ size

  private observeSize() {
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", () => this.measure());
      return;
    }
    let pending = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => this.measure());
    }).observe(this.wrap);
  }

  /**
   * Matches the backing store to the element.
   *
   * Capped at 2x: past that a large panel on a dense display allocates more
   * than the preview is worth, and the wall is looked at rather than lived in.
   */
  private measure() {
    const rect = this.wrap.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const widthPx = Math.round(rect.width * dpr);
    const heightPx = Math.round(rect.height * dpr);
    if (widthPx === this.size.widthPx && heightPx === this.size.heightPx) return;

    this.canvas.width = widthPx;
    this.canvas.height = heightPx;

    const pixelsPerMeter = heightPx / WALL_METERS;
    this.size = {
      widthPx,
      heightPx,
      pixelsPerMeter,
      widthMeters: widthPx / pixelsPerMeter,
      heightMeters: WALL_METERS,
    };
    this.repaint();
  }

  private repaint() {
    if (this.size.widthPx < 8) return;
    renderSketch(this.ctx, this.size, this.strokes, seed);
  }

  // ----------------------------------------------------------------- render

  /** Called whenever the can in hand changes, or one of its fields does. */
  render(can: CanSpec, canIndex: number) {
    this.can = can;
    this.canIndex = canIndex;

    this.gauge.setCap(can.cap);
    this.gauge.setColor(can.color);
    this.gauge.sizeMultiplier = can.size;
    this.gauge.flowMultiplier = can.flow;

    for (const dial of DIALS) {
      const slider = this.sliders.get(dial.key)!;
      const value = can[dial.key];
      // Not written while it is being dragged: assigning to a range input mid
      // gesture snaps the thumb out from under the pointer.
      if (document.activeElement !== slider) slider.value = String(value);
      this.readouts.get(dial.key)!.textContent =
        dial.key === "size"
          ? `${Math.round(value * 100)}%`
          : `${value.toFixed(2)}×`;
    }

    this.renderCombo();
    // The canvas may never have been measured if the workshop was hidden when
    // the observer first fired, which is exactly the case on a first open.
    if (this.size.widthPx < 8) this.measure();
  }

  private renderCombo() {
    if (!this.can) return;
    this.combo.textContent =
      `${this.canIndex + 1} · ${t(`cap.${this.can.cap}.label`)} · ` +
      `${this.can.color.toUpperCase()} · ${Math.round(this.can.size * 100)}%`;
  }

  /** Re-measures after the workshop is shown, when the element finally has a box. */
  refresh() {
    this.measure();
    this.repaint();
  }
}
