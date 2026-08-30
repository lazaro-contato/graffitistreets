import type * as THREE from "three";
import { WALL_X, HALF_LENGTH, PLAYER } from "../config";

/**
 * The box the player is kept inside, as half-extents from the origin.
 *
 * Defaults to the hand-built street. A map loaded from a file sets it from its
 * own bounds, because there is no collision against the scenery mesh — the
 * player is kept in a rectangle and everything outside it is looked at rather
 * than walked to.
 */
let bounds = { halfX: WALL_X, halfZ: HALF_LENGTH };

export function setCorridor(halfX: number, halfZ: number) {
  bounds = { halfX, halfZ };
}

/**
 * The world is a rectangular corridor, so collision is a clamp.
 * Returns which axes were hit, so the caller can zero those velocity
 * components — otherwise the player sticks and slides along the wall.
 */
export function clampToCorridor(position: THREE.Vector3): {
  hitX: boolean;
  hitZ: boolean;
} {
  const limitX = Math.max(PLAYER.RADIUS, bounds.halfX - PLAYER.RADIUS);
  const limitZ = Math.max(PLAYER.RADIUS, bounds.halfZ - PLAYER.RADIUS);
  let hitX = false;
  let hitZ = false;

  if (position.x < -limitX) {
    position.x = -limitX;
    hitX = true;
  } else if (position.x > limitX) {
    position.x = limitX;
    hitX = true;
  }

  if (position.z < -limitZ) {
    position.z = -limitZ;
    hitZ = true;
  } else if (position.z > limitZ) {
    position.z = limitZ;
    hitZ = true;
  }

  return { hitX, hitZ };
}
