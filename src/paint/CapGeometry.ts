import type { CapDefinition, CapShape } from "../config";

/**
 * Shared geometry for spray caps.
 *
 * Every cap is a unit outline — a circle, a square, or a triangle — scaled to
 * (halfW, halfH) and turned by an angle. Keeping the maths in one place is why
 * the brush, the panel-spill test, the cursor and the inventory icons can
 * never disagree about what a cap actually covers.
 */

/** Area of each unit outline, and how far its furthest point sits from centre. */
const UNIT_AREA: Record<CapShape, number> = {
  ellipse: Math.PI,
  rect: 4,
  triangle: (3 * Math.sqrt(3)) / 4,
};

export const UNIT_CIRCUMRADIUS: Record<CapShape, number> = {
  ellipse: 1,
  rect: Math.SQRT2,
  triangle: 1,
};

/** Vertices of the unit triangle: equilateral, on the unit circle, apex up. */
export const UNIT_TRIANGLE: readonly [number, number][] = [0, 1, 2].map((i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
  return [Math.cos(angle), Math.sin(angle)] as [number, number];
});

export type HalfExtents = { halfW: number; halfH: number };

/**
 * Half width and half height of a cap's footprint, before rotation.
 *
 * Solved so every cap covers the same area as a circle of the same radius:
 * stretching a cap changes the shape of the mark, never how much paint lands.
 * Deliberate size differences belong in `cap.size`, which is already folded
 * into the radius by SprayCan.
 */
export function capHalfExtents(
  radius: number,
  cap: CapDefinition,
): HalfExtents {
  const halfH = radius * Math.sqrt(Math.PI / (UNIT_AREA[cap.shape] * cap.aspect));
  return { halfW: halfH * cap.aspect, halfH };
}

/**
 * Distance from the centre to the cap's furthest point.
 *
 * Callers need this, not the radius, to decide which panels a dab spills into
 * — a roller reaches several times further sideways than its radius suggests.
 * Rotation cannot change a furthest point's distance, so the angle is ignored.
 */
export function capExtent(radius: number, cap: CapDefinition): number {
  const { halfW, halfH } = capHalfExtents(radius, cap);

  switch (cap.shape) {
    case "rect":
      return Math.hypot(halfW, halfH); // a corner
    case "triangle":
      return Math.max(
        ...UNIT_TRIANGLE.map(([x, y]) => Math.hypot(x * halfW, y * halfH)),
      );
    default:
      return Math.max(halfW, halfH);
  }
}

/** Picks a point uniformly inside the unit outline. Scaling keeps it uniform. */
export function sampleUnitShape(
  shape: CapShape,
  out: { x: number; y: number },
) {
  switch (shape) {
    case "rect":
      out.x = Math.random() * 2 - 1;
      out.y = Math.random() * 2 - 1;
      return;

    case "triangle": {
      // Barycentric sampling, folded back so it stays inside the triangle.
      let u = Math.random();
      let v = Math.random();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const [ax, ay] = UNIT_TRIANGLE[0];
      const [bx, by] = UNIT_TRIANGLE[1];
      const [cx, cy] = UNIT_TRIANGLE[2];
      out.x = ax + u * (bx - ax) + v * (cx - ax);
      out.y = ay + u * (by - ay) + v * (cy - ay);
      return;
    }

    default: {
      // sqrt() corrects the distribution: without it the particles bunch at
      // the centre, because a disc's area grows with the square of the radius.
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      out.x = Math.cos(angle) * r;
      out.y = Math.sin(angle) * r;
    }
  }
}

/** Gradient stops for a cap, from a crisp edge (0) to a diffuse cloud (1). */
export function capFalloff(softness: number) {
  return {
    midStop: 0.85 - 0.5 * softness,
    midAlpha: 0.9 - 0.75 * softness,
  };
}
