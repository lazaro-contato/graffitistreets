import type { SkySpec } from "./types";

/**
 * Weather presets.
 *
 * Night, and only night, so far. Both pieces of key art are night scenes lit
 * by hard sources, and a warm lamp raking across a wall shows paint far better
 * than flat daylight does. A daylight preset would need the lamps switched off
 * and a real sun, which is a map away, not a constant away.
 *
 * Fog is the one thing that has to be retuned per map: the numbers that close
 * in a 12 m alley never fire in a 20 m one, and the numbers that suit 20 m
 * leave a 10 m corridor looking like it has no air in it at all.
 */

/** The alley at midnight: close, warm lamps, cold fill. */
export const MIDNIGHT: SkySpec = {
  sky: "#0a0d14",
  fogNear: 8,
  fogFar: 34,
  fillSky: "#243049",
  fillGround: "#0b0b10",
  fillIntensity: 0.16,
  moonColor: "#8fa4d4",
  moonIntensity: 0.18,
};

/** Wider streets need the fog pushed back or the far end simply vanishes. */
export const MIDNIGHT_OPEN: SkySpec = {
  ...MIDNIGHT,
  fogNear: 14,
  fogFar: 56,
  // A bit more sky reaches an open street, and it reads as cooler for it.
  fillIntensity: 0.2,
};

/**
 * A back corridor: almost no sky, so almost no fill. What light there is comes
 * from the single lamp, which is the point of the place.
 */
export const MIDNIGHT_CLOSE: SkySpec = {
  ...MIDNIGHT,
  fogNear: 5,
  fogFar: 20,
  fillIntensity: 0.09,
  moonIntensity: 0.08,
};
