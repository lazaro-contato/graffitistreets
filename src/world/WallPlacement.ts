import * as THREE from "three";
import { TEXTURE, WORLD, PANELS_PER_SIDE, type Side } from "../config";

/**
 * Where a paintable wall sits in the world, and how big it is.
 *
 * The street's two walls used to be the only answer to that question, so it
 * lived as a pair of ternaries inside WallPanel. A wall that comes out of a
 * Blender marker needs the same question answered from data instead.
 *
 * Everything is in metres. The canvas resolution is derived from it rather
 * than fixed, so a 5 m wall and a 20 m one are painted at the same density and
 * a stroke radius — which the journal stores in metres — lands the same size on
 * both.
 */
export type WallPlacement = {
  /** Centre of the whole strip. */
  centre: THREE.Vector3;
  /**
   * Rotation about Y, in radians.
   *
   * A PlaneGeometry faces +Z with +X to its right, so after this rotation the
   * wall's normal is (sin, 0, cos) and the direction its uv.x grows in is
   * (cos, 0, -sin). Laying panels out along that second vector is what makes
   * `index + uv.x` concatenate into one continuous, gap-free strip.
   */
  yaw: number;
  /** Along the wall. */
  length: number;
  height: number;
  /** How many canvases the strip is cut into, to bound each texture upload. */
  panels: number;
};

/** The direction a wall's uv.x grows in, given its yaw. */
export function wallRight(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}

/**
 * The yaw that points a wall's face along `normal`.
 *
 * Only the horizontal part is used: a paintable wall is vertical, and a marker
 * that came out of Blender a degree off plumb should not tilt the paint.
 */
export function yawFromNormal(normal: THREE.Vector3): number {
  return Math.atan2(normal.x, normal.z);
}

/** Canvas size of one panel of this wall, in pixels. */
export function panelPixels(placement: WallPlacement) {
  const width = placement.length / placement.panels;
  return {
    width: Math.round(width * TEXTURE.PIXELS_PER_METER),
    height: Math.round(placement.height * TEXTURE.PIXELS_PER_METER),
  };
}

/**
 * Where the street's own two walls go.
 *
 * Kept here so the hand-built alley and a wall read out of a file arrive at
 * WallPanel through the same door.
 */
export function streetWall(side: Side): WallPlacement {
  const left = side === "left";
  return {
    centre: new THREE.Vector3(
      left ? -WORLD.STREET_WIDTH / 2 : WORLD.STREET_WIDTH / 2,
      WORLD.WALL_HEIGHT / 2,
      0,
    ),
    yaw: left ? Math.PI / 2 : -Math.PI / 2,
    length: WORLD.STREET_LENGTH,
    height: WORLD.WALL_HEIGHT,
    panels: PANELS_PER_SIDE,
  };
}
