import type { MapDefinition } from "./types";
import { CONCRETE_031, roadFor } from "./surfaces";
import { MIDNIGHT_OPEN } from "./skies";

const WIDTH = 9;

/**
 * A wide street, and the closest thing here to a proper wall.
 *
 * Twenty metres of it, four high — six times the paintable surface of the
 * alley, and the top band is out of reach on foot, so this is the map free
 * flight was actually for. The road is wide enough that you can stand back
 * and see a whole piece at once, which the alley never lets you do.
 *
 * The resolution is dialled down to 160 px/m to pay for it: the same 192 over
 * this much wall would cost around 40 MB of VRAM, and at the distances this
 * map is painted from nobody can see the difference.
 */
export const AVENUE: MapDefinition = {
  id: "avenue",

  length: 20,
  width: WIDTH,
  wallHeight: 4,
  panelWidth: 4, // 5 panels a side
  pixelsPerMeter: 160, // 640 x 640 a panel

  walls: [
    { id: "left", side: "left", surface: CONCRETE_031 },
    { id: "right", side: "right", surface: CONCRETE_031 },
  ],

  road: roadFor(WIDTH),
  sky: MIDNIGHT_OPEN,

  // Four, because two cannot carry twenty metres — but only one full shadow
  // map between them. Shadows are the most expensive thing in the scene, and
  // past the first one they add direction rather than detail.
  lamps: [
    { side: -1, end: -1, shadow: 2048 },
    { side: 1, end: 1, shadow: 1024 },
    { side: 1, end: -1, shadow: 0 },
    { side: -1, end: 1, shadow: 0 },
  ],

  enclosure: {
    buildingHeight: 14,
    buildingDepth: 5,
    endDepth: 3,
    copingOverhang: 0.24,
    copingHeight: 0.2,
  },
};
