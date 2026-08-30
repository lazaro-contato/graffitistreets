import * as THREE from "three";
import { SPRAY, ADS } from "../config";
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
  /** Set when the crosshair is on something meant to be clicked, not painted. */
  link: string | null;
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
    link: null,
    distance: 0,
    panel: null,
    u: 0,
    v: 0,
  };

  private raycaster = new THREE.Raycaster();

  private targets: THREE.Object3D[];

  constructor(
    private camera: THREE.Camera,
    private walls: WallSystem,
    clickable: THREE.Object3D[] = [],
  ) {
    // One ray for both jobs, reaching as far as the furthest of them. The
    // spray's own two-metre limit is applied below instead of by the ray,
    // because a sign has to be clickable from across the alley.
    this.raycaster.far = Math.max(SPRAY.MAX_DISTANCE, ADS.CLICK_RANGE);
    this.targets = [...this.walls.meshes, ...clickable];
  }

  update() {
    const result = this.current;
    result.hit = false;
    result.tooClose = false;
    result.paintable = false;
    result.link = null;
    result.panel = null;

    this.raycaster.setFromCamera(SCREEN_CENTER, this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, false);
    if (hits.length === 0) return;

    const hit = hits[0];

    // Nearest wins, so standing in front of a sign means pointing at the sign
    // even though the wall behind it is also on the ray.
    const link = hit.object.userData.link as string | undefined;
    if (link) {
      result.link = link;
      result.distance = hit.distance;
      return;
    }

    // Geometry without a uv attribute silently returns undefined here.
    if (!hit.uv) return;
    // The ray now reaches further than the can does, so the limit it used to
    // enforce has to be applied here instead.
    if (hit.distance > SPRAY.MAX_DISTANCE) return;

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
    // The strip's own panel count, not a global: two walls in the same
    // world can be cut into different numbers of canvases.
    result.u =
      (panel.index + hit.uv.x) / this.walls.strip(panel.side).panels.length;
    result.v = hit.uv.y;
    result.paintable = true;
  }
}
