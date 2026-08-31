import type { Stroke, StrokeAppend } from "./types";
import type { SurfaceId } from "../config";
import type { WallSystem } from "../world/WallSystem";
import type { WallStrip } from "../world/WallStrip";
import { renderStroke, panelsTouchedBy } from "../paint/StrokeRenderer";

/**
 * Chronological journal of strokes, keyed by wall side.
 * This is the source of truth — the panel canvases are just a rendering of it.
 */
export class StrokeStore {
  private bySide = new Map<SurfaceId, Stroke[]>();
  private index = new Map<string, Stroke>();

  constructor(private walls: WallSystem) {}

  appendPoint(append: StrokeAppend) {
    const { strokeId, side, point } = append;
    let stroke = this.index.get(strokeId);

    if (!stroke) {
      stroke = {
        id: strokeId,
        side,
        color: append.color,
        cap: append.cap,
        points: [],
        authorId: append.authorId,
        t: Date.now(),
      };
      this.index.set(strokeId, stroke);
      const list = this.bySide.get(side) ?? [];
      list.push(stroke);
      this.bySide.set(side, list);
    }

    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);

    // Render only the new segment. Redrawing the whole stroke on every point
    // would be O(n^2) and would darken the paint, since alpha accumulates on
    // each pass.
    const segment: Stroke = {
      ...stroke,
      points: prev ? [prev, point] : [point],
    };
    // A wall this world does not have: a journal from another map naming a
    // surface that is not here. Drop it rather than crash on it.
    const strip = this.walls.strip(side);
    if (strip) renderStroke(strip, segment);
  }

  /** Removes the author's most recent stroke and repaints what it covered. */
  undo(authorId: string) {
    let latest: Stroke | undefined;
    let latestSide: SurfaceId | undefined;

    for (const [side, list] of this.bySide) {
      for (let i = list.length - 1; i >= 0; i--) {
        const stroke = list[i];
        if (stroke.authorId !== authorId) continue;
        if (!latest || stroke.t > latest.t) {
          latest = stroke;
          latestSide = side;
        }
        break; // the list is chronological, so this is the author's latest here
      }
    }

    if (!latest || !latestSide) return;

    const list = this.bySide.get(latestSide)!;
    list.splice(list.indexOf(latest), 1);
    this.index.delete(latest.id);

    const strip = this.walls.strip(latestSide);
    if (strip) this.repaintPanels(strip, panelsTouchedBy(strip, latest));
  }

  /** Drops every stroke on one wall. */
  clearSide(side: SurfaceId) {
    for (const stroke of this.bySide.get(side) ?? []) {
      this.index.delete(stroke.id);
    }
    this.bySide.delete(side);
    this.walls.strip(side)?.paintBase();
  }

  /**
   * Rebuilds a subset of a strip's panels from the journal.
   *
   * Only the affected panels are touched, and each stroke is clipped to them,
   * so undoing a short tag does not replay the whole 60 m wall.
   */
  private repaintPanels(strip: WallStrip, indices: ReadonlySet<number>) {
    if (indices.size === 0) return;

    for (const i of indices) strip.panels[i].paintBase();

    for (const stroke of this.bySide.get(strip.side) ?? []) {
      const overlap = new Set(
        [...panelsTouchedBy(strip, stroke)].filter((i) => indices.has(i)),
      );
      if (overlap.size > 0) renderStroke(strip, stroke, { restrictTo: overlap });
    }
  }

  /** Rebuilds an entire wall from scratch. */
  repaintSide(side: SurfaceId) {
    const strip = this.walls.strip(side);
    if (!strip) return;
    strip.paintBase();
    for (const stroke of this.bySide.get(side) ?? []) {
      renderStroke(strip, stroke);
    }
  }

  serialize() {
    return JSON.stringify([...this.bySide.entries()]);
  }

  load(json: string) {
    this.bySide = new Map(JSON.parse(json) as [SurfaceId, Stroke[]][]);
    this.index.clear();
    for (const [side, list] of this.bySide) {
      for (const stroke of list) this.index.set(stroke.id, stroke);
      this.repaintSide(side);
    }
  }
}
