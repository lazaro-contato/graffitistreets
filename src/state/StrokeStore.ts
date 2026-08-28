import type { Stroke, StrokeAppend } from "./types";
import type { SurfaceId } from "../maps/types";
import type { WallSystem } from "../world/WallSystem";
import type { WallStrip } from "../world/WallStrip";
import { renderStroke, panelsTouchedBy } from "../paint/StrokeRenderer";

/**
 * Chronological journal of strokes, keyed by wall.
 * This is the source of truth — the panel canvases are just a rendering of it.
 *
 * One store belongs to one loaded map: it stamps that map's id onto every
 * stroke it records, and it will only replay a journal that agrees.
 */
export class StrokeStore {
  private bySurface = new Map<SurfaceId, Stroke[]>();
  private index = new Map<string, Stroke>();

  constructor(private walls: WallSystem) {}

  /** The map this journal belongs to. */
  get mapId() {
    return this.walls.metrics.def.id;
  }

  appendPoint(append: StrokeAppend) {
    const { strokeId, surface, point } = append;
    const strip = this.walls.strip(surface);
    // A message for a wall this map does not have. Impossible from local play,
    // but a broadcast from a mismatched peer must not corrupt the journal.
    if (!strip) return;

    let stroke = this.index.get(strokeId);

    if (!stroke) {
      stroke = {
        id: strokeId,
        mapId: this.mapId,
        surface,
        color: append.color,
        cap: append.cap,
        points: [],
        authorId: append.authorId,
        t: Date.now(),
      };
      this.index.set(strokeId, stroke);
      const list = this.bySurface.get(surface) ?? [];
      list.push(stroke);
      this.bySurface.set(surface, list);
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
    renderStroke(strip, segment);
  }

  /** Removes the author's most recent stroke and repaints what it covered. */
  undo(authorId: string) {
    let latest: Stroke | undefined;

    for (const list of this.bySurface.values()) {
      for (let i = list.length - 1; i >= 0; i--) {
        const stroke = list[i];
        if (stroke.authorId !== authorId) continue;
        if (!latest || stroke.t > latest.t) latest = stroke;
        break; // the list is chronological, so this is the author's latest here
      }
    }

    if (!latest) return;

    const list = this.bySurface.get(latest.surface)!;
    list.splice(list.indexOf(latest), 1);
    this.index.delete(latest.id);

    const strip = this.walls.strip(latest.surface);
    if (strip) this.repaintPanels(strip, panelsTouchedBy(strip, latest));
  }

  /** Drops every stroke on one wall. */
  clearSurface(surface: SurfaceId) {
    for (const stroke of this.bySurface.get(surface) ?? []) {
      this.index.delete(stroke.id);
    }
    this.bySurface.delete(surface);
    this.walls.strip(surface)?.paintBase();
  }

  /**
   * Rebuilds a subset of a strip's panels from the journal.
   *
   * Only the affected panels are touched, and each stroke is clipped to them,
   * so undoing a short tag does not replay the whole wall.
   */
  private repaintPanels(strip: WallStrip, indices: ReadonlySet<number>) {
    if (indices.size === 0) return;

    for (const i of indices) strip.panels[i].paintBase();

    for (const stroke of this.bySurface.get(strip.id) ?? []) {
      const overlap = new Set(
        [...panelsTouchedBy(strip, stroke)].filter((i) => indices.has(i)),
      );
      if (overlap.size > 0) renderStroke(strip, stroke, { restrictTo: overlap });
    }
  }

  /** Rebuilds an entire wall from scratch. */
  repaintSurface(surface: SurfaceId) {
    const strip = this.walls.strip(surface);
    if (!strip) return;
    strip.paintBase();
    for (const stroke of this.bySurface.get(surface) ?? []) {
      renderStroke(strip, stroke);
    }
  }

  /** True when nothing has been painted here — used to skip a pointless replay. */
  get isEmpty() {
    for (const list of this.bySurface.values()) if (list.length > 0) return false;
    return true;
  }

  serialize() {
    return JSON.stringify({
      mapId: this.mapId,
      surfaces: [...this.bySurface.entries()],
    });
  }

  /**
   * Replays a journal onto this map's walls.
   *
   * A journal from a different map is refused outright rather than replayed
   * for whatever wall ids happen to match. Strip coordinates are fractions of
   * a wall, so the same `u` means a different place on a wall of a different
   * length — a piece from the alley would land smeared across the avenue.
   */
  load(json: string): boolean {
    const saved = JSON.parse(json) as {
      mapId: string;
      surfaces: [SurfaceId, Stroke[]][];
    };
    if (saved.mapId !== this.mapId) return false;

    this.bySurface = new Map(saved.surfaces);
    this.index.clear();
    for (const [surface, list] of this.bySurface) {
      for (const stroke of list) this.index.set(stroke.id, stroke);
      this.repaintSurface(surface);
    }
    return true;
  }
}
