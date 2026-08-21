import type * as THREE from "three";
import type { SprayCan } from "../paint/SprayCan";
import type { Aim } from "../paint/Aim";
import { capExtent } from "../paint/CapGeometry";
import { CAP_PATHS } from "./CapIcons";
import { CAP_BY_ID, type CapId } from "../config";

const DEG_TO_RAD = Math.PI / 180;
const IDLE_EXTENT_PX = 5; // shown when there is nothing paintable ahead
const MIN_EXTENT_PX = 3;
const MAX_EXTENT_FRACTION = 0.4; // of the viewport height, so it never takes over
const IDLE_OPACITY = 0.35;

/**
 * The crosshair: the fitted cap's outline, drawn at the size the spray would
 * actually cover on the wall.
 *
 * It reads the shared Aim result rather than raycasting on its own, so the
 * cursor and the paint always agree about what is reachable.
 */
export class SprayCursor {
  private element: SVGSVGElement;
  private paths: SVGPathElement[];
  private lastSize = -1;
  private lastOpacity = -1;
  private lastCap: CapId | null = null;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private can: SprayCan,
    private aim: Aim,
  ) {
    this.element = document.getElementById(
      "crosshair",
    ) as unknown as SVGSVGElement;
    this.paths = [...this.element.querySelectorAll("path")];
  }

  update() {
    const { paintable, distance } = this.aim.current;
    const cap = this.can.cap;

    let extentPx = IDLE_EXTENT_PX;
    let opacity = IDLE_OPACITY;

    if (paintable) {
      // Furthest reach of the dab in meters, projected onto the screen. At
      // distance d the camera sees 2 * d * tan(fov / 2) meters of height, and
      // that maps onto the viewport height in pixels. Wall resolution is
      // uniform on both axes, so one number is honest in both.
      const extentMeters = capExtent(
        this.can.radiusAt(distance),
        CAP_BY_ID.get(cap)!,
      );
      const halfViewMeters =
        distance * Math.tan((this.camera.fov * DEG_TO_RAD) / 2);
      const projected =
        (extentMeters / halfViewMeters) * (window.innerHeight / 2);

      extentPx = Math.min(
        Math.max(projected, MIN_EXTENT_PX),
        window.innerHeight * MAX_EXTENT_FRACTION,
      );
      opacity = 1;
    }

    // Only touch the DOM when something actually changed — this runs every frame.
    if (cap !== this.lastCap) {
      for (const path of this.paths) {
        path.setAttribute("d", CAP_PATHS[cap]);
      }
      this.lastCap = cap;
    }

    const size = Math.round(extentPx * 2);
    if (size !== this.lastSize) {
      this.element.style.width = `${size}px`;
      this.element.style.height = `${size}px`;
      this.lastSize = size;
    }
    if (opacity !== this.lastOpacity) {
      this.element.style.opacity = String(opacity);
      this.lastOpacity = opacity;
    }
  }
}
