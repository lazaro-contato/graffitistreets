import { PALETTE } from "../config";

/**
 * Which key picks which colour.
 *
 * The two directions live together on purpose: the label printed under a
 * swatch and the key that actually selects it have to agree, and they are the
 * whole point of this change — a player who reads "press 1" and cannot tell
 * which colour is 1 has been told nothing.
 *
 * The row is 1-9 then 0, the way it sits on a keyboard. An eleventh colour
 * would have no key, and says so by returning null rather than by quietly
 * printing a label that does nothing.
 */
export function keyForColour(index: number): string | null {
  if (index < 9) return String(index + 1);
  if (index === 9) return "0";
  return null;
}

/** The colour a number key picks, or null if it does not reach one. */
export function colourForKey(key: string): number | null {
  const n = parseInt(key, 10);
  if (Number.isNaN(n) || key.length !== 1) return null;
  const index = n === 0 ? 9 : n - 1;
  return index < PALETTE.length ? index : null;
}
