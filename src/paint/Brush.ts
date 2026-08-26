import { SPRAY, BASE_RADIUS_PX, CAP_BY_ID, type CapId } from "../config";
import {
  capHalfExtents,
  capFalloff,
  sampleUnitShape,
  UNIT_CIRCUMRADIUS,
  UNIT_TRIANGLE,
} from "./CapGeometry";

const DEG_TO_RAD = Math.PI / 180;

/** Below this the shape would not cover a pixel and simply vanishes. */
const MIN_HALF_EXTENT_PX = 0.5;

/** Converts "#rrggbb" plus an alpha into a canvas rgba() string. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Traces the unit outline. The caller has already scaled the context. */
function traceUnitShape(ctx: CanvasRenderingContext2D, capId: CapId) {
  const cap = CAP_BY_ID.get(capId)!;
  ctx.beginPath();

  switch (cap.shape) {
    case "rect":
      ctx.rect(-1, -1, 2, 2);
      return;
    case "triangle":
      UNIT_TRIANGLE.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      return;
    default:
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
  }
}

const speckle = { x: 0, y: 0 };

/**
 * Stamps a single dab. Pure function: knows nothing about Three.js, the world,
 * or any game state — just a 2D context, a cap and numbers.
 */
export function stampDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  capId: CapId,
  twist = 0,
) {
  const cap = CAP_BY_ID.get(capId)!;
  const extents = capHalfExtents(radius, cap);
  const halfW = Math.max(MIN_HALF_EXTENT_PX, extents.halfW);
  const halfH = Math.max(MIN_HALF_EXTENT_PX, extents.halfH);
  const angle = cap.angle * DEG_TO_RAD + twist;

  // The body is drawn in unit space. Scaling the context, rather than baking
  // the shape into device coordinates, is what makes the gradient stretch with
  // the cap — a circular gradient on a 5:1 roller would read as a blob with
  // faded ends instead of a flat band.
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  ctx.scale(halfW, halfH);

  const { midStop, midAlpha } = capFalloff(cap.softness);
  // The gradient runs to the outline's furthest point, so the corners of a
  // square and the tips of a triangle still get paint instead of fading out.
  const grad = ctx.createRadialGradient(
    0,
    0,
    0,
    0,
    0,
    UNIT_CIRCUMRADIUS[cap.shape],
  );
  grad.addColorStop(0, rgba(color, alpha));
  grad.addColorStop(midStop, rgba(color, alpha * midAlpha));
  grad.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = grad;

  traceUnitShape(ctx, capId);
  ctx.fill();
  ctx.restore();

  // Grain is drawn untransformed, so the specks stay square however far the
  // cap is stretched. Their positions go through the same transform by hand.
  const count = Math.round(
    SPRAY.SPECKLES * cap.grain * (radius / BASE_RADIUS_PX),
  );
  if (count <= 0) return;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const spreadW = halfW * SPRAY.SPECKLE_SPREAD;
  const spreadH = halfH * SPRAY.SPECKLE_SPREAD;

  for (let i = 0; i < count; i++) {
    sampleUnitShape(cap.shape, speckle);
    const lx = speckle.x * spreadW;
    const ly = speckle.y * spreadH;
    ctx.fillStyle = rgba(color, alpha * (0.25 + Math.random() * 0.75));
    ctx.fillRect(x + lx * cos - ly * sin, y + lx * sin + ly * cos, 1.4, 1.4);
  }
}
