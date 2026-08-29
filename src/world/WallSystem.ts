import * as THREE from "three";
import type { WallPanel } from "./WallPanel";
import { WallStrip } from "./WallStrip";
import { PANELS_PER_SIDE, type Side } from "../config";
import { BARE_WALL, type WallSurface } from "./Surfaces";

/** Owns both wall strips and the once-per-frame texture upload. */
export class WallSystem {
  readonly group = new THREE.Group();
  readonly left: WallStrip;
  readonly right: WallStrip;
  readonly panels: WallPanel[];

  /** Cached raycast targets — PaintSystem hits this 60 times a second. */
  readonly meshes: THREE.Mesh[];

  /** Each side is dressed separately, so the two walls can differ. */
  constructor(
    surfaces: Record<Side, WallSurface> = { left: BARE_WALL, right: BARE_WALL },
  ) {
    this.left = new WallStrip("left", 0, this.group, surfaces.left);
    this.right = new WallStrip(
      "right",
      PANELS_PER_SIDE,
      this.group,
      surfaces.right,
    );
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
   * Dresses one side in a different photograph.
   *
   * This leaves the wall showing its old base coat under the paint, and the
   * caller has to follow it with a repaint from the journal — StrokeStore owns
   * that, and state/ sits above world/, so it cannot be called from in here.
   *
   * Doing it in two steps is not a compromise. The strokes are the source of
   * truth, so re-dressing a wall is exactly "change the base coat and replay":
   * the paint survives a surface swap because it was never pixels to begin
   * with.
   */
  dress(side: Side, surface: WallSurface) {
    this.strip(side).setSurface(surface);
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
        // Uploaded together, because they are two halves of one change: a
        // frame showing new paint without its glow would flicker dark.
        panel.glowTexture.needsUpdate = true;
        panel.dirty = false;
      }
    }
  }

  dispose() {
    for (const panel of this.panels) panel.dispose();
  }
}
