import * as THREE from "three";
import type { WallPanel } from "./WallPanel";
import { WallStrip } from "./WallStrip";
import { PANELS_PER_SIDE, type Side } from "../config";

/** Owns both wall strips and the once-per-frame texture upload. */
export class WallSystem {
  readonly group = new THREE.Group();
  readonly left: WallStrip;
  readonly right: WallStrip;
  readonly panels: WallPanel[];

  /** Cached raycast targets — PaintSystem hits this 60 times a second. */
  readonly meshes: THREE.Mesh[];

  constructor() {
    this.left = new WallStrip("left", 0, this.group);
    this.right = new WallStrip("right", PANELS_PER_SIDE, this.group);
    this.panels = [...this.left.panels, ...this.right.panels];
    this.meshes = this.panels.map((panel) => panel.mesh);
  }

  strip(side: Side) {
    return side === "left" ? this.left : this.right;
  }

  get(id: number) {
    return this.panels[id];
  }

  /**
   * Called once per frame, after all painting logic.
   *
   * `texture.needsUpdate = true` schedules a ~4 MB upload to the GPU. Setting
   * it inside the dab loop would fire dozens of uploads for the same panel in
   * a single frame; the dirty flag collapses them into one.
   */
  flush() {
    for (const panel of this.panels) {
      if (panel.dirty) {
        panel.texture.needsUpdate = true;
        panel.dirty = false;
      }
    }
  }

  dispose() {
    for (const panel of this.panels) panel.dispose();
  }
}
