import type { MapDefinition } from "./types";
import { CONCRETE_031_FINE, roadFor } from "./surfaces";
import { MIDNIGHT_CLOSE } from "./skies";

const WIDTH = 3.6;

/**
 * A service corridor between two buildings, and the map that plays most
 * differently — because range is the main control and this one takes it away.
 *
 * Wall to wall is 3.6 m, so from the middle you are 1.8 m from either side and
 * pressed against one you are 3.4 m from the other, past what the can reaches.
 * There is nowhere to back off to. The cone stays tight, the paint bites hard,
 * and covering any area means walking it rather than opening up the spray.
 *
 * The dressing is tiled at half scale for the same reason: a 2.4 m concrete
 * plate seen from 40 cm is a featureless grey field.
 */
export const CORRIDOR: MapDefinition = {
  id: "corridor",

  length: 10,
  width: WIDTH,
  wallHeight: 2.75,
  panelWidth: 2.5, // 4 panels a side
  pixelsPerMeter: 224, // 560 x 616 a panel — denser, since you are always close

  walls: [
    { id: "left", side: "left", surface: CONCRETE_031_FINE },
    { id: "right", side: "right", surface: CONCRETE_031_FINE },
  ],

  road: roadFor(WIDTH),
  sky: MIDNIGHT_CLOSE,

  // One lamp, one shadow, one direction. Half the corridor is meant to be dark.
  lamps: [{ side: -1, end: -1, shadow: 2048 }],

  enclosure: {
    buildingHeight: 8,
    buildingDepth: 3,
    endDepth: 2.5,
    copingOverhang: 0.16,
    copingHeight: 0.14,
  },
};
