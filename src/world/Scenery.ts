import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { yawFromNormal, type WallPlacement } from "./WallPlacement";
import type { Block } from "./Colliders";
import { TEXTURE } from "../config";

/**
 * A scene modelled somewhere else, brought in whole.
 *
 * The rule that shapes all of this: **a paintable wall is never a mesh from the
 * file.** Stroke radii are stored in metres and converted assuming the surface
 * has uniform UV, and a wall unwrapped by hand almost never does — the spray
 * would come out oval in one corner and tiny in another. So the file carries
 * the scenery and *markers*, and the markers say where to build a plane that
 * the engine owns.
 *
 * A marker is any node whose name starts with `paint.`, or that carries a
 * `paint_id` custom property. Its four corners give the wall its position,
 * size and facing; the marker itself never reaches the scene.
 */

/**
 * Nodes named like this are read as markers rather than drawn.
 *
 * An underscore, not a dot, and that is not a style choice: three's GLTFLoader
 * runs every node name through `PropertyBinding.sanitizeNodeName`, which
 * *deletes* dots. A marker called `paint.left-wall` in Blender arrives here as
 * `paintleft-wall`, and a loader looking for the dot finds nothing at all —
 * silently, with the wall simply missing.
 *
 * Both spellings are accepted anyway, because the file is written by hand in
 * another program and being right about this is not the artist's job.
 */
const MARKER_NAME = /^paint[._]?(.+)$/i;

/** How far a paintable plane floats off the wall it was marked against. */
const PROUD = 0.02;

/**
 * A mesh flatter than this is taken for a floor rather than an obstacle.
 *
 * Without it the ground plane is a box like any other, and the player is
 * pushed off the edge of it the moment they step on.
 */
const FLAT_ENOUGH = 0.2;

/** Say this in a node's name and the player walks straight through it. */
const NO_COLLIDE = /nocollide/i;

/**
 * Nodes named like this are collision volumes, not scenery.
 *
 * Drawn nowhere and solid everywhere. Authored ones beat derived ones: a box
 * an artist put around a stack of crates knows where the gap between them is,
 * and a box derived from a facade does not know it has a doorway.
 */
const COLLIDER_NAME = /^collider/i;

export type PaintMarker = {
  /** The name after the prefix. Frozen once anything has been painted on it. */
  id: string;
  placement: WallPlacement;
};

export type Scenery = {
  group: THREE.Group;
  markers: PaintMarker[];
  /** Volumes the artist marked as solid. Hidden, never drawn. */
  colliders: THREE.Mesh[];
  /** The whole scene's extent, for spawning and for the collision box. */
  bounds: THREE.Box3;
  dispose(): void;
};

const idOf = (object: THREE.Object3D): string | null => {
  // A custom property survives the trip untouched, so it wins where it exists.
  const extra = (object.userData as { paint_id?: unknown }).paint_id;
  if (typeof extra === "string" && extra) return extra;

  const matched = MARKER_NAME.exec(object.name);
  return matched ? matched[1] : null;
};

/**
 * Reads a marker's four corners in world space.
 *
 * Corners rather than the node's transform, and that is deliberate: it works
 * whether or not the artist applied rotation and scale in Blender, which is
 * one fewer thing they have to remember and get right.
 */
function placementOf(mesh: THREE.Mesh): WallPlacement | null {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return null;

  const centre = box.getCenter(new THREE.Vector3());
  mesh.localToWorld(centre);

  // The plane's own axes, carried into the world. Whichever of them is
  // vertical is the height; the other is the length.
  const size = box.getSize(new THREE.Vector3());

  // The plane's own axes carried into the world, scale and all. Taken off the
  // matrix's basis columns rather than with transformDirection, which
  // normalises — and normalising is exactly how a 5.64 m wall reads back as
  // the 2 m plane Blender created it from.
  const m = mesh.matrixWorld.elements;
  const axes = [
    { basis: new THREE.Vector3(m[0], m[1], m[2]), extent: size.x },
    { basis: new THREE.Vector3(m[4], m[5], m[6]), extent: size.y },
    { basis: new THREE.Vector3(m[8], m[9], m[10]), extent: size.z },
  ]
    .map(({ basis, extent }) => ({
      world: basis.clone().normalize(),
      // The extent this axis really covers once the world scale is in it.
      extent: extent * basis.length(),
    }))
    // The flat axis of a plane covers nothing, and is the normal.
    .sort((a, b) => b.extent - a.extent);

  const [longest, second, flattest] = axes;
  const vertical =
    Math.abs(longest.world.y) > Math.abs(second.world.y) ? longest : second;
  const along = vertical === longest ? second : longest;

  const height = vertical.extent;
  const length = along.extent;
  if (height < 0.05 || length < 0.05) return null;

  // Face the side the marker's normal points at, and stand clear of whatever
  // it was marked against — coplanar surfaces z-fight.
  const normal = flattest.world.clone().normalize();
  normal.y = 0;
  if (normal.lengthSq() < 1e-6) return null;
  normal.normalize();

  return {
    centre: centre.addScaledVector(normal, PROUD),
    yaw: yawFromNormal(normal),
    length,
    height,
    // One canvas per few metres, so no single texture upload gets large.
    panels: Math.max(1, Math.round(length / 4)),
    // A marker is a place to paint, not a wall. The building behind it keeps
    // its own texture and shows through wherever nothing has been sprayed.
    transparent: true,
  };
}

/**
 * Loads a `.glb` and splits it into scenery and markers.
 *
 * Lights and cameras that came with the file are dropped. The game brings its
 * own of both, and a second sun fights the one the map was lit for.
 */
export async function loadScenery(url: string): Promise<Scenery> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const markers: PaintMarker[] = [];
  const colliders: THREE.Mesh[] = [];
  const remove: THREE.Object3D[] = [];

  root.traverse((object) => {
    if ((object as THREE.Light).isLight || (object as THREE.Camera).isCamera) {
      remove.push(object);
      return;
    }

    if (COLLIDER_NAME.test(object.name) && (object as THREE.Mesh).isMesh) {
      colliders.push(object as THREE.Mesh);
      // Kept in the graph so its world matrix stays valid until the boxes are
      // read, but never drawn.
      object.visible = false;
      return;
    }

    const id = idOf(object);
    if (id && (object as THREE.Mesh).isMesh) {
      const placement = placementOf(object as THREE.Mesh);
      if (placement) markers.push({ id, placement });
      remove.push(object);
      return;
    }

    if ((object as THREE.Mesh).isMesh) {
      // glTF carries neither of these, and the scene is lit by two hard lamps:
      // scenery that neither casts nor catches a shadow reads as pasted on.
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  for (const object of remove) object.removeFromParent();

  const bounds = new THREE.Box3().setFromObject(root);

  return {
    group: root,
    markers,
    colliders,
    bounds,
    dispose() {
      root.removeFromParent();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of [mesh.material].flat()) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          material.dispose();
        }
      });
    },
  };
}

/**
 * A solid box for every piece of scenery worth walking into.
 *
 * Authored `collider*` volumes where the file has them; otherwise a box around
 * every piece of scenery, since a map with thirty crates and no collision at
 * all is worse than one with thirty rough boxes. The derived kind costs
 * precision — the box of a facade with a doorway in it has no doorway — and
 * `nocollide` in a node's name opts out of it.
 *
 * Call this after the scene has been positioned: the boxes are in world space,
 * and moving the group afterwards would leave them behind.
 */
export function collectBlocks(scenery: Scenery): Block[] {
  scenery.group.updateMatrixWorld(true);

  const boxOf = (mesh: THREE.Mesh): Block | null => {
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) return null;
    return { min: box.min, max: box.max };
  };

  // Authored volumes if there are any. A map that marked its own collision
  // meant what it marked, and guessing alongside it would only add walls the
  // artist deliberately left open.
  if (scenery.colliders.length > 0) {
    return scenery.colliders
      .map(boxOf)
      .filter((block): block is Block => block !== null);
  }

  const blocks: Block[] = [];
  scenery.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || NO_COLLIDE.test(mesh.name)) return;

    const block = boxOf(mesh);
    if (!block) return;
    // Floors, kerbs and paint on the road: things you stand on, not into.
    if (block.max.y - block.min.y < FLAT_ENOUGH) return;

    blocks.push(block);
  });

  return blocks;
}

/** What a marker will cost in VRAM, so a heavy map says so before it loads. */
export const markerCostMB = (marker: PaintMarker) => {
  const { length, height } = marker.placement;
  const pixels = length * height * TEXTURE.PIXELS_PER_METER ** 2;
  // Four bytes of colour, plus the glow map at a quarter of the area.
  return (pixels * 4 * 1.25) / 1048576;
};
