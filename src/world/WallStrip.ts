import type * as THREE from "three";
import { WallPanel } from "./WallPanel";
import type { Side } from "../config";
import { streetWall, type WallPlacement } from "./WallPlacement";
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
  /** One panel's canvas, and the strip's, in pixels. */
  readonly panelWidthPx: number;
  readonly heightPx: number;

  /** The wall in metres, for anything reasoning about real distance on it. */
  readonly lengthMeters: number;
  readonly heightMeters: number;

  constructor(
    readonly side: Side,
    firstPanelId: number,
    group: THREE.Group,
    surface: WallSurface = BARE_WALL,
    placement: WallPlacement = streetWall(side),
  ) {
    for (let i = 0; i < placement.panels; i++) {
      const panel = new WallPanel(firstPanelId + i, side, i, placement, surface);
      this.panels.push(panel);
      group.add(panel.mesh);
    }

    this.panelWidthPx = this.panels[0].widthPx;
    this.heightPx = this.panels[0].heightPx;
    this.widthPx = this.panelWidthPx * this.panels.length;
    this.lengthMeters = placement.length;
    this.heightMeters = placement.height;
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

  /** Resets every panel of this strip back to bare concrete. */
  paintBase() {
    for (const panel of this.panels) panel.paintBase();
  }

  /**
   * Dresses every panel of this strip in a new photograph.
   *
   * The paint on the wall is untouched by this, and stays wrong until somebody
   * repaints from the journal — the base coat is under the strokes on the same
   * canvas. WallSystem.dress is the one that knows to do both.
   */
  setSurface(surface: WallSurface) {
    for (const panel of this.panels) panel.setSurface(surface);
  }
}
