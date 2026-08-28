import type { SurfaceSpec } from "./types";

/**
 * The photographic sets, named once and shared by the maps that use them.
 *
 * Every one of these is a CC0 set from ambientCG that already travels with the
 * repository — see ASSETS.md. A new map costs no new download as long as it
 * dresses itself from this file.
 */

/**
 * Cast concrete panels: two plates across the tile and four up it. At 2.4 m
 * that makes each plate 1.20 x 0.60 m, the standard cladding size — and it
 * divides a 3 m wall exactly, so the joints never land half way through a
 * plate.
 */
export const CONCRETE_031: SurfaceSpec = {
  albedo: "/wall/concrete031/albedo.jpg",
  normal: "/wall/concrete031/normal.jpg",
  roughness: "/wall/concrete031/roughness.jpg",
  tileMeters: 2.4,
};

/**
 * The same concrete, tiled tighter.
 *
 * For a wall you are pressed up against the whole time: a 2.4 m plate seen
 * from 40 cm is a featureless grey field, and half that reads as a surface
 * again. Same three files, so it costs nothing.
 */
export const CONCRETE_031_FINE: SurfaceSpec = {
  ...CONCRETE_031,
  tileMeters: 1.2,
};

/**
 * Asphalt.
 *
 * `tileMeters` is deliberately left out — the road wants exactly one tile
 * across the street whatever the street is, because the photograph carries a
 * painted line down its edge. Tiling it at any other scale scatters yellow
 * stripes over the asphalt. `roadFor()` is what fills that in.
 */
const ASPHALT: Omit<SurfaceSpec, "tileMeters"> = {
  albedo: "/road/albedo.jpg",
  normal: "/road/normal.jpg",
  roughness: "/road/roughness.jpg",
  /** Half a tile, which is what puts the painted line on the centre line. */
  offsetU: 0.5,
};

/** The road for a street of a given width: one tile across, line centred. */
export const roadFor = (streetWidth: number): SurfaceSpec => ({
  ...ASPHALT,
  tileMeters: streetWidth,
});
