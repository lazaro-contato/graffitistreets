import type { CapId } from "../config";
import type { MapId, SurfaceId } from "../maps/types";

/** A single sampled point along a stroke, in wall strip coordinates. */
export type StrokePoint = {
  u: number; // 0..1 across the ENTIRE strip, whatever the wall is long
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
 * A stroke belongs to a wall, not to a panel: panels are a rendering detail,
 * and a single stroke routinely spans several of them. A stroke is roughly
 * 200 bytes; a panel PNG is roughly 500 KB. Storing strokes instead of pixels
 * is what makes sync, undo and replay possible.
 */
export type Stroke = {
  id: string;
  /**
   * Which map this was painted in, and on which of its walls.
   *
   * Both are the reason these are strings and not a closed union: a journal
   * outlives the build it was written by, and a map added next month must not
   * force a migration of everything painted before it.
   */
  mapId: MapId;
  surface: SurfaceId;
  color: string;
  /** Recorded per stroke: a replay must use the cap it was painted with. */
  cap: CapId;
  points: StrokePoint[];
  authorId: string;
  t: number; // epoch ms, when the stroke started
};

/**
 * Everything that mutates a wall travels as one of these messages.
 *
 * There is deliberately no `mapId` on the wire. The message stream is scoped
 * to the map that is loaded, the same way it will be scoped to a connection
 * once there is a server — one room, one street. The id is stamped onto the
 * stroke by the store, which is the layer that has to write it down.
 */
export type PaintMessage =
  | {
      kind: "stroke:append";
      strokeId: string;
      surface: SurfaceId;
      color: string;
      cap: CapId;
      point: StrokePoint;
      authorId: string;
    }
  | { kind: "stroke:end"; strokeId: string }
  | { kind: "stroke:undo"; authorId: string }
  | { kind: "surface:clear"; surface: SurfaceId };

/** The one message that carries paint. Pulled out because several layers pass
 *  it around whole rather than destructuring it into a long argument list. */
export type StrokeAppend = Extract<PaintMessage, { kind: "stroke:append" }>;
