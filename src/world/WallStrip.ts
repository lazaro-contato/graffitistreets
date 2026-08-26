import type * as THREE from "three";
import { WallPanel } from "./WallPanel";
import { PANELS_PER_SIDE, PANEL_TEXTURE_WIDTH, type Side } from "../config";
import { BARE_WALL, type WallSurface } from "./Surfaces";

/**
 * One side of the street, treated as a single continuous paint surface.
 *
 * Strokes are stored in strip coordinates (u = 0..1 across all 60 m), so a
 * line can cross a panel boundary without breaking and a dab landing on a seam
 * spills into both neighbours. The panels underneath exist only to keep each
 * texture upload small.
 */
export class WallStrip {
  readonly panels: WallPanel[] = [];

  /** Width of the strip in texture pixels — a coordinate space, never allocated. */
  readonly widthPx: number;

  constructor(
    readonly side: Side,
    firstPanelId: number,
    group: THREE.Group,
    surface: WallSurface = BARE_WALL,
  ) {
    for (let i = 0; i < PANELS_PER_SIDE; i++) {
      const panel = new WallPanel(firstPanelId + i, side, i, surface);
      this.panels.push(panel);
      group.add(panel.mesh);
    }
    this.widthPx = PANEL_TEXTURE_WIDTH * this.panels.length;
  }

  /**
   * Inclusive index range of the panels a strip-x interval overlaps.
   * `last < first` means the interval falls entirely outside the strip.
   */
  panelRange(fromX: number, toX: number): { first: number; last: number } {
    return {
      first: Math.max(0, Math.floor(fromX / PANEL_TEXTURE_WIDTH)),
      last: Math.min(
        this.panels.length - 1,
        Math.floor(toX / PANEL_TEXTURE_WIDTH),
      ),
    };
  }

  /** Resets every panel of this strip back to bare concrete. */
  paintBase() {
    for (const panel of this.panels) panel.paintBase();
  }
}
