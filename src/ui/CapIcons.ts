import { CAPS, type CapDefinition, type CapId } from "../config";
import { capHalfExtents, capExtent, UNIT_TRIANGLE } from "../paint/CapGeometry";

/**
 * Cap outlines as SVG paths, generated from the same geometry the brush uses.
 *
 * Generated rather than hand written on purpose: a hand-drawn icon drifts away
 * from the brush the first time a cap is retuned, and then the cursor quietly
 * lies about what the paint will do.
 *
 * Every path is normalised so the outline's furthest point sits exactly 50
 * units from the centre. The cursor must therefore use a `-50 -50 100 100`
 * viewBox, so the drawn shape is exactly as wide as the element sized around
 * it each frame; the inventory icons use a roomier box on purpose, as padding.
 */
const NORMALISED_EXTENT = 50;
const DEG_TO_RAD = Math.PI / 180;

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function buildPath(cap: CapDefinition): string {
  // Work at radius 1, then rescale so the furthest point lands on the box edge.
  const scale = NORMALISED_EXTENT / capExtent(1, cap);
  const { halfW, halfH } = capHalfExtents(1, cap);
  const a = halfW * scale;
  const b = halfH * scale;
  const angle = cap.angle * DEG_TO_RAD;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const place = (x: number, y: number) =>
    `${round(x * cos - y * sin)},${round(x * sin + y * cos)}`;

  switch (cap.shape) {
    case "rect":
      return (
        `M ${place(-a, -b)} L ${place(a, -b)} ` +
        `L ${place(a, b)} L ${place(-a, b)} Z`
      );

    case "triangle":
      return (
        "M " +
        UNIT_TRIANGLE.map(([x, y]) => place(x * a, y * b)).join(" L ") +
        " Z"
      );

    default: {
      // Two half arcs, with the ellipse's own axis rotation carried on the arc.
      const deg = round(cap.angle);
      return (
        `M ${place(-a, 0)} A ${round(a)},${round(b)} ${deg} 1,0 ${place(a, 0)} ` +
        `A ${round(a)},${round(b)} ${deg} 1,0 ${place(-a, 0)} Z`
      );
    }
  }
}

export const CAP_PATHS = Object.fromEntries(
  CAPS.map((cap) => [cap.id, buildPath(cap)]),
) as Record<CapId, string>;

/**
 * The pointer, for when the crosshair is over something clickable. Drawn to
 * the same 50-unit reach as the cap outlines, so the cursor element can be
 * sized by exactly the same code path.
 */
export const POINTER_PATH =
  "M -18,-50 L -18,26 L -2,12 L 8,40 L 20,35 L 10,9 L 30,7 Z";
