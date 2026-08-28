import { SPRAY } from "../config";

/**
 * How many dabs a straight run between two points is broken into.
 *
 * This is the one number the wall renderer and the workshop's practice wall
 * have to agree on. Without interpolation a fast mouse produces spaced blobs
 * instead of a line — the number one bug in any painting system — and if the
 * two surfaces spaced their dabs differently, the practice wall would quietly
 * lie about how the cap behaves on the street.
 *
 * Spacing is a fraction of the radius, so a wide cone steps further than a
 * thin one and both lay down the same density of paint.
 */
export function dabSteps(distancePx: number, radiusPx: number): number {
  const step = Math.max(1, radiusPx * SPRAY.DAB_SPACING);
  return Math.max(1, Math.ceil(distancePx / step));
}
