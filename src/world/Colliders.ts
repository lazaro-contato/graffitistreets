import type * as THREE from "three";
import { PLAYER } from "../config";
import type { MapMetrics } from "../maps/types";

/**
 * Every map so far is a rectangular corridor, so collision is a clamp.
 * Returns which axes were hit, so the caller can zero those velocity
 * components — otherwise the player sticks and slides along the wall.
 *
 * The bounds come from the map rather than from a module constant, which is
 * the whole difference between one street and several.
 */
export function clampToCorridor(
  position: THREE.Vector3,
  metrics: MapMetrics,
): { hitX: boolean; hitZ: boolean } {
  const limitX = metrics.wallX - PLAYER.RADIUS;
  const limitZ = metrics.halfLength - PLAYER.RADIUS;
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
