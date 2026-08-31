import type { SurfaceId, CapId } from "../config";

/** A single sampled point along a stroke, in wall strip coordinates. */
export type StrokePoint = {
  u: number; // 0..1 across the ENTIRE strip (all 60 m of one wall)
  v: number; // 0..1 up the wall
  r: number; // footprint radius on the wall, in meters
  a: number; // dab alpha
  /**
   * Twist of the cap at this point, in radians, added to its fixed angle.
   * Recorded rather than recomputed: it depends on the whole stroke so far,
   * and the renderer only ever sees one segment at a time.
   */
  w?: number;
};

/**
 * The unit of persistence and networking.
 *
 * A stroke belongs to a wall side, not to a panel: panels are a rendering
 * detail, and a single stroke routinely spans several of them.
 * A stroke is roughly 200 bytes; a panel PNG is roughly 500 KB. Storing
 * strokes instead of pixels is what makes sync, undo and replay possible.
 */
export type Stroke = {
  id: string;
  side: SurfaceId;
  color: string;
  /** Recorded per stroke: a replay must use the cap it was painted with. */
  cap: CapId;
  points: StrokePoint[];
  authorId: string;
  t: number; // epoch ms, when the stroke started
};

/** Everything that mutates a wall travels as one of these messages. */
export type PaintMessage =
  | {
      kind: "stroke:append";
      strokeId: string;
      side: SurfaceId;
      color: string;
      cap: CapId;
      point: StrokePoint;
      authorId: string;
    }
  | { kind: "stroke:end"; strokeId: string }
  | { kind: "stroke:undo"; authorId: string }
  | { kind: "strip:clear"; side: SurfaceId };

/** The one message that carries paint. Pulled out because several layers pass
 *  it around whole rather than destructuring it into a long argument list. */
export type StrokeAppend = Extract<PaintMessage, { kind: "stroke:append" }>;
