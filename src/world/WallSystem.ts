import * as THREE from "three";
import type { WallPanel } from "./WallPanel";
import { WallStrip } from "./WallStrip";
import type { SurfaceId } from "../config";
import { streetWall, type WallPlacement } from "./WallPlacement";
import { BARE_WALL, type WallSurface } from "./Surfaces";

/** Owns every paintable wall in the world, and the once-per-frame upload. */
export class WallSystem {
  readonly group = new THREE.Group();
  readonly panels: WallPanel[] = [];

  /** Cached raycast targets — Aim hits this 60 times a second. */
  readonly meshes: THREE.Mesh[] = [];

  private byId = new Map<SurfaceId, WallStrip>();

  /**
   * One strip per entry in `placements`.
   *
   * Given none, it builds the hand-built street's two. Given twelve — which is
   * what a marked-up model turned out to arrive with — it builds twelve, and
   * nothing above here counts them.
   */
  constructor(
    surfaces: Record<SurfaceId, WallSurface> = {},
    placements: Record<SurfaceId, WallPlacement> = {
      left: streetWall("left"),
      right: streetWall("right"),
    },
  ) {
    let nextPanelId = 0;

    for (const [id, placement] of Object.entries(placements)) {
      const strip = new WallStrip(
        id,
        nextPanelId,
        this.group,
        surfaces[id] ?? BARE_WALL,
        placement,
      );
      nextPanelId += strip.panels.length;
      this.byId.set(id, strip);
      this.panels.push(...strip.panels);
    }

    this.meshes = this.panels.map((panel) => panel.mesh);
  }

  /** Every wall there is, in the order they were built. */
  get strips(): readonly WallStrip[] {
    return [...this.byId.values()];
  }

  /**
   * Returns undefined for a wall this world does not have.
   *
   * Which happens for real: a journal painted on one map, replayed on another,
   * names walls that are not here. The caller drops those strokes rather than
   * crashing on them.
   */
  strip(id: SurfaceId) {
    return this.byId.get(id);
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
  dress(id: SurfaceId, surface: WallSurface) {
    this.strip(id)?.setSurface(surface);
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
