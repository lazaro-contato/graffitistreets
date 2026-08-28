import type { MapDefinition } from "./types";
import { CONCRETE_031, roadFor } from "./surfaces";
import { MIDNIGHT } from "./skies";

const WIDTH = 6;

/**
 * The original alley, and the one everybody starts in.
 *
 * Narrower than it is long, so it reads as an alley rather than a plaza: at
 * equal proportions the middle was dead space anyway, since the spray only
 * reaches 2 m. Deliberately small — a place to paint one piece, not a map to
 * explore.
 */
export const ALLEY: MapDefinition = {
  id: "alley",

  length: 12,
  width: WIDTH,
  wallHeight: 3,
  panelWidth: 4, // 3 panels a side
  pixelsPerMeter: 192, // 768 x 576 a panel, about 7 MB of VRAM in total

  walls: [
    { id: "left", side: "left", surface: CONCRETE_031 },
    { id: "right", side: "right", surface: CONCRETE_031 },
  ],

  road: roadFor(WIDTH),
  sky: MIDNIGHT,

  // Diagonally opposite, so between them they reach both ends of both walls.
  // The second shadow map is quarter size: it is there for the direction it
  // implies, not for the detail.
  lamps: [
    { side: -1, end: -1, shadow: 2048 },
    { side: 1, end: 1, shadow: 1024 },
  ],

  enclosure: {
    buildingHeight: 9,
    buildingDepth: 4,
    endDepth: 3,
    copingOverhang: 0.2,
    copingHeight: 0.18,
  },
};
