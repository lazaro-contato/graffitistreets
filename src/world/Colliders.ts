import type * as THREE from "three";
import { WALL_X, HALF_LENGTH, PLAYER } from "../config";

/**
 * The world is a rectangular corridor, so collision is a clamp.
 * Returns which axes were hit, so the caller can zero those velocity
 * components — otherwise the player sticks and slides along the wall.
 */
export function clampToCorridor(position: THREE.Vector3): {
  hitX: boolean;
  hitZ: boolean;
} {
  const limitX = WALL_X - PLAYER.RADIUS;
  const limitZ = HALF_LENGTH - PLAYER.RADIUS;
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
