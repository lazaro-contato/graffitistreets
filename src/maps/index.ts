import type { MapDefinition, MapId } from "./types";
import { ALLEY } from "./alley";

/**
 * Every map, in the order the menu will offer them.
 *
 * Adding one is adding a file here. Nothing else knows the list.
 */
export const MAPS: readonly MapDefinition[] = [ALLEY];

/** Where a first visit starts: the small one, which is the one to learn on. */
export const DEFAULT_MAP_ID: MapId = ALLEY.id;

const BY_ID = new Map(MAPS.map((map) => [map.id, map]));

/**
 * Falls back to the default rather than throwing, because the argument will
 * come from `localStorage` — a map that has since been renamed or dropped must
 * not lock somebody out of the game on start-up.
 */
export function mapById(id: MapId | null): MapDefinition {
  return (id && BY_ID.get(id)) || ALLEY;
}

export type { MapDefinition, MapId } from "./types";
