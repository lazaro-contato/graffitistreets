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
 * A solid box in the world, in metres.
 *
 * Boxes rather than the scenery mesh itself, and that is a deliberate trade:
 * the alley is crates, drums and building faces, which are boxes already, and
 * a box test is a subtraction where a mesh test is a search. What it costs is
 * arches and doorways — the box of a wall with a hole in it is still a wall.
 */
export type Block = { min: THREE.Vector3; max: THREE.Vector3 };

let blocks: readonly Block[] = [];

export function setBlocks(list: readonly Block[]) {
  blocks = list;
}

/**
 * How far above the feet a surface may be and still count as standing on it.
 *
 * Small on purpose: there is no step-up here. A crate is climbed by jumping
 * onto it, which is the rule the map was marked up under — anything you can
 * clear, you can stand on.
 */
const LANDING_TOLERANCE = 0.05;

/**
 * The height of whatever the player is standing on at this spot.
 *
 * Zero is the street. A box counts only if its top is at or below the feet,
 * so walking into the side of a crate is a wall and dropping onto the same
 * crate from above is a floor — one test, both behaviours.
 */
export function groundHeightAt(x: number, z: number, feetY: number): number {
  let ground = 0;

  for (const block of blocks) {
    if (block.max.y > feetY + LANDING_TOLERANCE) continue;
    if (block.max.y <= ground) continue;
    if (x <= block.min.x - PLAYER.RADIUS || x >= block.max.x + PLAYER.RADIUS) {
      continue;
    }
    if (z <= block.min.z - PLAYER.RADIUS || z >= block.max.z + PLAYER.RADIUS) {
      continue;
    }
    ground = block.max.y;
  }

  return ground;
}

/**
 * Pushes the player out of anything they have walked into.
 *
 * The player is a cylinder: `radius` on the ground plane, and standing between
 * `feetY` and `feetY + height`. A box is only in the way if it overlaps that
 * vertical span, which is what lets somebody walk over a kerb and stops them
 * walking through a crate.
 *
 * Resolution is along whichever axis they are least far into, because that is
 * the shortest way back out and therefore the one that reads as sliding along
 * a surface rather than being flung off it.
 */
export function clampToBlocks(
  position: THREE.Vector3,
  feetY: number,
  height: number,
): { hitX: boolean; hitZ: boolean } {
  let hitX = false;
  let hitZ = false;
  if (blocks.length === 0) return { hitX, hitZ };

  const head = feetY + height;

  for (const block of blocks) {
    // A floor is a box too. Standing on top of one is not walking into it.
    if (block.max.y <= feetY + 0.05 || block.min.y >= head) continue;

    const minX = block.min.x - PLAYER.RADIUS;
    const maxX = block.max.x + PLAYER.RADIUS;
    const minZ = block.min.z - PLAYER.RADIUS;
    const maxZ = block.max.z + PLAYER.RADIUS;
    if (
      position.x <= minX ||
      position.x >= maxX ||
      position.z <= minZ ||
      position.z >= maxZ
    ) {
      continue;
    }

    // How far back out each way, and which is nearer.
    const left = position.x - minX;
    const right = maxX - position.x;
    const back = position.z - minZ;
    const front = maxZ - position.z;
    const alongX = Math.min(left, right);
    const alongZ = Math.min(back, front);

    if (alongX < alongZ) {
      position.x = left < right ? minX : maxX;
      hitX = true;
    } else {
      position.z = back < front ? minZ : maxZ;
      hitZ = true;
    }
  }

  return { hitX, hitZ };
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
