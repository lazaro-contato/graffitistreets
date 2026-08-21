import * as THREE from "three";
import { SPRAY, PANELS_PER_SIDE } from "../config";
import type { WallSystem } from "../world/WallSystem";
import type { WallPanel } from "../world/WallPanel";

const SCREEN_CENTER = new THREE.Vector2(0, 0);

/** What the crosshair is currently pointing at. */
export type AimResult = {
  /** The ray reached a wall within spray range. */
  hit: boolean;
  /** Inside MIN_DISTANCE — the can is too close to lay down paint. */
  tooClose: boolean;
  /** hit && !tooClose: spraying right now would actually mark the wall. */
  paintable: boolean;
  distance: number;
  panel: WallPanel | null;
  u: number; // strip coordinate, 0..1 along the whole wall
  v: number;
};

/**
 * Resolves the crosshair against the walls once per frame.
 *
 * PaintSystem and the HUD cursor both read this instead of raycasting on their
 * own. Sharing one result is what guarantees the on-screen ring never lies:
 * if the ring is showing, the spray will land.
 */
export class Aim {
  readonly current: AimResult = {
    hit: false,
    tooClose: false,
    paintable: false,
    distance: 0,
    panel: null,
    u: 0,
    v: 0,
  };

  private raycaster = new THREE.Raycaster();

  constructor(
    private camera: THREE.Camera,
    private walls: WallSystem,
  ) {
    // Capping the ray distance both prevents painting from across the street
    // and cuts the raycast cost.
    this.raycaster.far = SPRAY.MAX_DISTANCE;
  }

  update() {
    const result = this.current;
    result.hit = false;
    result.tooClose = false;
    result.paintable = false;
    result.panel = null;

    this.raycaster.setFromCamera(SCREEN_CENTER, this.camera);
    const hits = this.raycaster.intersectObjects(this.walls.meshes, false);
    if (hits.length === 0) return;

    const hit = hits[0];
    // Geometry without a uv attribute silently returns undefined here.
    if (!hit.uv) return;

    result.hit = true;
    result.distance = hit.distance;

    if (hit.distance < SPRAY.MIN_DISTANCE) {
      result.tooClose = true;
      return;
    }

    const panel = this.walls.get(hit.object.userData.panelId as number);
    result.panel = panel;
    // Panels are laid out along their own uv.x direction, so index and uv.x
    // concatenate straight into a continuous 0..1 coordinate along the wall.
    result.u = (panel.index + hit.uv.x) / PANELS_PER_SIDE;
    result.v = hit.uv.y;
    result.paintable = true;
  }
}
