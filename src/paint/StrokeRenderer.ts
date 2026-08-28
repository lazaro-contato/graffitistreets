import { stampDab } from "./Brush";
import { capExtent } from "./CapGeometry";
import { SPRAY } from "../config";
import type { Stroke } from "../state/types";
import { CAP_BY_ID, type CapId } from "../config";
import type { WallStrip } from "../world/WallStrip";

export type RenderOptions = {
  /** When given, only these panel indices are drawn into. Used by repaint. */
  restrictTo?: ReadonlySet<number>;
};

/**
 * Stroke radii are stored in meters; canvases work in pixels.
 *
 * The conversion belongs to the strip rather than to a module constant,
 * because every map picks its own wall resolution. That is also what makes the
 * journal portable: a tag painted at 192 px/m replays at the right physical
 * size on a wall drawn at 224.
 */
const toPixels = (strip: WallStrip, meters: number) =>
  meters * strip.pixelsPerMeter;

/**
 * Stamps one dab in strip space, spilling into every panel it overlaps.
 *
 * This is what removes the seam: a dab centred near a panel edge is drawn on
 * both neighbours, each canvas clipping its own half, so the two halves line
 * up into one circle on the wall.
 */
function stampAcrossPanels(
  strip: WallStrip,
  x: number,
  y: number,
  radiusPx: number,
  color: string,
  alpha: number,
  cap: CapId,
  twist: number,
  restrictTo?: ReadonlySet<number>,
) {
  // Spill is measured with the cap's outer extent, not the nominal radius: a
  // roller reaches several times further sideways and would otherwise be
  // clipped in half at a seam.
  const extent = capExtent(radiusPx, CAP_BY_ID.get(cap)!);
  const { first, last } = strip.panelRange(x - extent, x + extent);
  for (let i = first; i <= last; i++) {
    if (restrictTo && !restrictTo.has(i)) continue;
    const panel = strip.panels[i];
    stampDab(
      panel.ctx,
      x - i * strip.panelWidthPx,
      y,
      radiusPx,
      color,
      alpha,
      cap,
      twist,
    );
    panel.dirty = true;
  }
}

/**
 * Draws a whole stroke onto a wall strip.
 *
 * Used both for live painting and for journal replay, which is what keeps a
 * repainted wall consistent with the one the player drew.
 */
export function renderStroke(
  strip: WallStrip,
  stroke: Stroke,
  options: RenderOptions = {},
) {
  const { restrictTo } = options;

  for (let i = 0; i < stroke.points.length; i++) {
    const point = stroke.points[i];
    const x = point.u * strip.widthPx;
    // UV v grows upwards, canvas y grows downwards.
    const y = (1 - point.v) * strip.heightPx;
    const radiusPx = toPixels(strip, point.r);

    if (i === 0) {
      stampAcrossPanels(
        strip,
        x,
        y,
        radiusPx,
        stroke.color,
        point.a,
        stroke.cap,
        point.w ?? 0,
        restrictTo,
      );
      continue;
    }

    // Interpolate from the previous point. Without this, moving the mouse fast
    // produces spaced dots instead of a continuous line — the number one bug in
    // any painting system. Interpolating in strip space rather than panel space
    // is what carries a stroke across a panel boundary unbroken.
    const prev = stroke.points[i - 1];
    const px = prev.u * strip.widthPx;
    const py = (1 - prev.v) * strip.heightPx;
    const prevRadiusPx = toPixels(strip, prev.r);
    const prevTwist = prev.w ?? 0;
    const twist = point.w ?? 0;

    const dist = Math.hypot(x - px, y - py);
    const step = Math.max(1, radiusPx * SPRAY.DAB_SPACING);
    const steps = Math.ceil(dist / step);

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      stampAcrossPanels(
        strip,
        px + (x - px) * t,
        py + (y - py) * t,
        prevRadiusPx + (radiusPx - prevRadiusPx) * t,
        stroke.color,
        prev.a + (point.a - prev.a) * t,
        stroke.cap,
        prevTwist + (twist - prevTwist) * t,
        restrictTo,
      );
    }
  }
}

/** Panel indices a stroke's paint can reach, interpolated segments included. */
export function panelsTouchedBy(strip: WallStrip, stroke: Stroke): Set<number> {
  const touched = new Set<number>();

  for (let i = 0; i < stroke.points.length; i++) {
    const point = stroke.points[i];
    const prev = stroke.points[i - 1] ?? point;
    const x = point.u * strip.widthPx;
    const px = prev.u * strip.widthPx;
    // Interpolated dabs sit on the segment, so the span of the two endpoints
    // covers every panel they pass through.
    const radiusPx = capExtent(
      toPixels(strip, Math.max(point.r, prev.r)),
      CAP_BY_ID.get(stroke.cap)!,
    );
    const { first, last } = strip.panelRange(
      Math.min(x, px) - radiusPx,
      Math.max(x, px) + radiusPx,
    );
    for (let k = first; k <= last; k++) touched.add(k);
  }

  return touched;
}
