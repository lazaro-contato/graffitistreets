import type * as THREE from "three";
import type { SprayCan } from "../paint/SprayCan";
import type { Aim } from "../paint/Aim";
import type { PaintSystem } from "../paint/PaintSystem";
import { capExtent } from "../paint/CapGeometry";
import { CAP_PATHS, POINTER_PATH } from "./CapIcons";
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
  private lastTwist = 0;
  private lastPointer = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private can: SprayCan,
    private aim: Aim,
    private paint: PaintSystem,
  ) {
    this.element = document.getElementById(
      "crosshair",
    ) as unknown as SVGSVGElement;
    this.paths = [...this.element.querySelectorAll("path")];
  }

  update() {
    const { paintable, distance, link } = this.aim.current;
    const cap = this.can.cap;

    // Over a sign the crosshair stops describing paint and starts describing a
    // click, so it drops the cap outline entirely and becomes a pointer.
    const pointing = link !== null;
    if (pointing !== this.lastPointer) {
      this.element.dataset.pointer = pointing ? "on" : "off";
      this.lastPointer = pointing;
      this.lastCap = null; // force the path to be rewritten below
      this.lastSize = -1;
    }

    if (pointing) {
      for (const path of this.paths) path.setAttribute("d", POINTER_PATH);
      this.element.style.width = "34px";
      this.element.style.height = "34px";
      this.element.style.opacity = "1";
      this.lastOpacity = 1;
      return;
    }

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

    // A cap that turns with the stroke has to turn on the cursor too, or the
    // outline stops describing the mark it is about to leave.
    const twist = Math.round(this.paint.capTwist * 1000) / 1000;
    if (twist !== this.lastTwist) {
      this.element.style.setProperty("--twist", `${twist}rad`);
      this.lastTwist = twist;
    }
  }
}
