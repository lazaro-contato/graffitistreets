import * as THREE from "three";
import type { WallPanel } from "./WallPanel";
import { WallStrip } from "./WallStrip";
import type { MapMetrics, SurfaceId } from "../maps/types";
import { BARE_WALL, type WallSurface } from "./Surfaces";

/** Owns every wall strip of one map, and the once-per-frame texture upload. */
export class WallSystem {
  readonly group = new THREE.Group();
  readonly strips: WallStrip[] = [];
  readonly panels: WallPanel[] = [];

  /** Cached raycast targets — Aim hits this 60 times a second. */
  readonly meshes: THREE.Mesh[];

  private byId = new Map<SurfaceId, WallStrip>();

  /**
   * Each wall is dressed separately, so the two sides of a street can differ.
   * A wall with no entry in `surfaces` falls back to bare concrete rather than
   * failing — a missing file is a missing photo, not a crash.
   */
  constructor(
    readonly metrics: MapMetrics,
    surfaces: Map<SurfaceId, WallSurface> = new Map(),
  ) {
    let nextPanelId = 0;
    for (const wall of metrics.def.walls) {
      const strip = new WallStrip(
        wall,
        nextPanelId,
        this.group,
        metrics,
        surfaces.get(wall.id) ?? BARE_WALL,
      );
      nextPanelId += strip.panels.length;
      this.strips.push(strip);
      this.byId.set(wall.id, strip);
      this.panels.push(...strip.panels);
    }

    this.meshes = this.panels.map((panel) => panel.mesh);
  }

  /**
   * Returns undefined for a wall this map does not have, which is what happens
   * when a journal painted on another map is replayed here. The caller drops
   * those strokes rather than crashing on them.
   */
  strip(id: SurfaceId) {
    return this.byId.get(id);
  }

  get(id: number) {
    return this.panels[id];
  }

  /**
   * Called once per frame, after all painting logic.
   *
   * `texture.needsUpdate = true` schedules a multi-megabyte upload to the GPU.
   * Setting it inside the dab loop would fire dozens of uploads for the same
   * panel in a single frame; the dirty flag collapses them into one.
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
    this.group.clear();
  }
}
