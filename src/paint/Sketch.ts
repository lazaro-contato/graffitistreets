import { stampDab } from "./Brush";
import { dabSteps } from "./StrokeMath";
import { TwistTracker } from "./Twist";
import { CAP_BY_ID, isNeon, type CapId } from "../config";
import type { StrokePoint } from "../state/types";
import { paintConcrete } from "../world/Concrete";

/**
 * A wall you can paint on that is not part of the world.
 *
 * The workshop's practice wall and the sample on every cap card are both one
 * of these. It exists so that trying a cap out answers the question you
 * actually have — what will this do on the street — which it can only do by
 * being the same paint on the same surface.
 *
 * So everything here is borrowed rather than reimplemented: `paintConcrete`
 * for the base coat, `stampDab` for the mark, `dabSteps` for the spacing
 * between dabs and `TwistTracker` for a cap that follows the stroke. What is
 * left is bookkeeping: a journal, and the conversion between the normalised
 * coordinates a stroke is stored in and the pixels of this particular canvas.
 */

/** How much wider than the mark the faked halo spreads, and how faint it is. */
const NEON_HALO = 2.1;
const NEON_HALO_ALPHA = 0.34;

/** A stroke on a sketch surface. The same shape a wall stroke has, minus the
 *  identity a wall needs — a sketch has no map, no side and no author. */
export type SketchStroke = {
  cap: CapId;
  color: string;
  points: StrokePoint[];
};

export type SketchSize = {
  widthPx: number;
  heightPx: number;
  /**
   * Pixels per metre of pretend wall. Stroke radii are stored in metres, the
   * same as on the street, so this is the only thing that decides how big a
   * cap looks here — and why a cap card and the practice wall can share a
   * journal at different scales.
   */
  pixelsPerMeter: number;
  /** Metres of wall the canvas covers, for the twist conversion. */
  widthMeters: number;
  heightMeters: number;
};

/** Paints the bare surface, seeded so a repaint is identical. */
export function paintSketchBase(
  ctx: CanvasRenderingContext2D,
  size: SketchSize,
  seed: number,
) {
  paintConcrete(ctx, {
    width: size.widthPx,
    height: size.heightPx,
    pixelsPerMeter: size.pixelsPerMeter,
    seed,
  });
}

/** Stamps one dab, converting from normalised coordinates to this canvas. */
function stampAt(
  ctx: CanvasRenderingContext2D,
  size: SketchSize,
  u: number,
  v: number,
  radiusMeters: number,
  alpha: number,
  color: string,
  cap: CapId,
  twist: number,
) {
  const x = u * size.widthPx;
  // UV v grows upwards, canvas y grows downwards — the same flip the wall
  // renderer does.
  const y = (1 - v) * size.heightPx;
  const radiusPx = radiusMeters * size.pixelsPerMeter;

  stampDab(ctx, x, y, radiusPx, color, alpha, cap, twist);

  // A sketch is a flat canvas with no lighting, so neon has to be faked here or
  // it would preview as an ordinary bright colour and the whole point of the
  // category would be invisible until you were already out on the street. An
  // additive pass, wider and much fainter, stands in for the emissive halo the
  // real wall gets from its glow map.
  if (isNeon(color)) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    stampDab(ctx, x, y, radiusPx * NEON_HALO, color, alpha * NEON_HALO_ALPHA, cap, twist);
    ctx.restore();
  }
}

/**
 * Draws one stroke, interpolating between its points.
 *
 * Deliberately the same shape as StrokeRenderer.renderStroke, minus the panel
 * spill: a sketch is one canvas, so there are no seams to carry a dab across.
 */
export function renderSketchStroke(
  ctx: CanvasRenderingContext2D,
  size: SketchSize,
  stroke: SketchStroke,
) {
  for (let i = 0; i < stroke.points.length; i++) {
    const point = stroke.points[i];

    if (i === 0) {
      stampAt(
        ctx,
        size,
        point.u,
        point.v,
        point.r,
        point.a,
        stroke.color,
        stroke.cap,
        point.w ?? 0,
      );
      continue;
    }

    const prev = stroke.points[i - 1];
    const x = point.u * size.widthPx;
    const y = (1 - point.v) * size.heightPx;
    const px = prev.u * size.widthPx;
    const py = (1 - prev.v) * size.heightPx;
    const radiusPx = point.r * size.pixelsPerMeter;
    const prevTwist = prev.w ?? 0;
    const twist = point.w ?? 0;

    const steps = dabSteps(Math.hypot(x - px, y - py), radiusPx);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      stampAt(
        ctx,
        size,
        prev.u + (point.u - prev.u) * t,
        prev.v + (point.v - prev.v) * t,
        prev.r + (point.r - prev.r) * t,
        prev.a + (point.a - prev.a) * t,
        stroke.color,
        stroke.cap,
        prevTwist + (twist - prevTwist) * t,
      );
    }
  }
}

/** Repaints the whole surface from its journal. Used by undo and by resize. */
export function renderSketch(
  ctx: CanvasRenderingContext2D,
  size: SketchSize,
  strokes: readonly SketchStroke[],
  seed: number,
) {
  paintSketchBase(ctx, size, seed);
  for (const stroke of strokes) renderSketchStroke(ctx, size, stroke);
}

/**
 * Builds a stroke from a path of normalised points, twisting as it goes.
 *
 * Used for the cap card samples, where the path is a fixed squiggle rather
 * than something a hand drew. The twist is run over the path for the same
 * reason the wall does it: the roller's angle depends on the whole stroke so
 * far, and it has to be recorded per point rather than recomputed at draw time.
 */
export function buildSketchStroke(
  cap: CapId,
  color: string,
  path: readonly { u: number; v: number }[],
  radiusMeters: number,
  alpha: number,
  size: SketchSize,
): SketchStroke {
  const twists = CAP_BY_ID.get(cap)!.twists;
  const twister = new TwistTracker();

  const points: StrokePoint[] = path.map((at, i) => {
    let w = 0;
    if (twists && i > 0) {
      const prev = path[i - 1];
      w = twister.advance(
        (at.u - prev.u) * size.widthMeters,
        -(at.v - prev.v) * size.heightMeters,
      );
    }
    return { u: at.u, v: at.v, r: radiusMeters, a: alpha, w };
  });

  return { cap, color, points };
}
