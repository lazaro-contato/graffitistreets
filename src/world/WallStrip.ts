import type * as THREE from "three";
import { WallPanel } from "./WallPanel";
import type { MapMetrics, SurfaceId, WallDefinition } from "../maps/types";
import { BARE_WALL, type WallSurface } from "./Surfaces";

/**
 * One wall of a map, treated as a single continuous paint surface.
 *
 * Strokes are stored in strip coordinates (u = 0..1 across the whole wall), so
 * a line can cross a panel boundary without breaking and a dab landing on a
 * seam spills into both neighbours. The panels underneath exist only to keep
 * each texture upload small.
 *
 * The strip is also where the rest of the game reads a wall's dimensions from.
 * Everything that draws on it — StrokeRenderer above all — used to import them
 * from `config.ts` as module constants, which is precisely what made a second
 * map impossible.
 */
export class WallStrip {
  readonly panels: WallPanel[] = [];

  /** Stable identity of this wall. Every stroke on it carries this. */
  readonly id: SurfaceId;

  /** Width of the strip in texture pixels — a coordinate space, never allocated. */
  readonly widthPx: number;
  /** Height of one panel in texture pixels, which is the height of the wall. */
  readonly heightPx: number;
  readonly panelWidthPx: number;
  readonly pixelsPerMeter: number;

  /** The wall in metres, for anything reasoning about real distance on it. */
  readonly lengthMeters: number;
  readonly heightMeters: number;

  constructor(
    wall: WallDefinition,
    firstPanelId: number,
    group: THREE.Group,
    metrics: MapMetrics,
    surface: WallSurface = BARE_WALL,
  ) {
    this.id = wall.id;

    for (let i = 0; i < metrics.panelsPerWall; i++) {
      const panel = new WallPanel(firstPanelId + i, wall, i, metrics, surface);
      this.panels.push(panel);
      group.add(panel.mesh);
    }

    this.panelWidthPx = metrics.panelTextureWidth;
    this.widthPx = metrics.stripWidthPx;
    this.heightPx = metrics.panelTextureHeight;
    this.pixelsPerMeter = metrics.def.pixelsPerMeter;
    this.lengthMeters = metrics.def.length;
    this.heightMeters = metrics.def.wallHeight;
  }

  /**
   * Inclusive index range of the panels a strip-x interval overlaps.
   * `last < first` means the interval falls entirely outside the strip.
   */
  panelRange(fromX: number, toX: number): { first: number; last: number } {
    return {
      first: Math.max(0, Math.floor(fromX / this.panelWidthPx)),
      last: Math.min(
        this.panels.length - 1,
        Math.floor(toX / this.panelWidthPx),
      ),
    };
  }

  /** Resets every panel of this strip back to its base coat. */
  paintBase() {
    for (const panel of this.panels) panel.paintBase();
  }
}
