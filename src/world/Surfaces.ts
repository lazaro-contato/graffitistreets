import * as THREE from "three";
import type {
  MapDefinition,
  SurfaceId,
  SurfaceSpec,
  WallDefinition,
} from "../maps/types";
import type { Locale } from "../i18n/strings";

/**
 * Photographic wall dressing, loaded once and shared by every panel.
 *
 * The albedo stays an image rather than a texture on purpose: a panel's canvas
 * is its colour map, since paint is drawn onto it, so the photo has to be
 * tiled into that canvas rather than handed to the material.
 */
export type WallSurface = {
  albedo: HTMLImageElement | null;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
  /** Carried through from the spec, since it is per side. */
  tileMeters: number;
};

export const BARE_WALL: WallSurface = {
  albedo: null,
  normal: null,
  roughness: null,
  tileMeters: 2,
};

/** Resolves to null instead of rejecting: no file yet just means bare concrete. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function asDataMap(image: HTMLImageElement | null): THREE.Texture | null {
  if (!image) return null;

  const texture = new THREE.Texture(image);
  // Deliberately NOT sRGB. Normal and roughness carry data, not colour, and
  // tagging them sRGB flattens the relief and skews the sheen.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

async function loadOne(
  spec: SurfaceSpec,
  onEach: () => void,
): Promise<WallSurface> {
  const counted = <T,>(pending: Promise<T>) =>
    pending.then((value) => {
      onEach();
      return value;
    });

  const [albedo, normal, roughness] = await Promise.all([
    counted(loadImage(spec.albedo)),
    counted(loadImage(spec.normal)),
    counted(loadImage(spec.roughness)),
  ]);

  return {
    albedo,
    normal: asDataMap(normal),
    roughness: asDataMap(roughness),
    tileMeters: spec.tileMeters,
  };
}

/**
 * How many files a map's walls will fetch.
 *
 * Deduplicated the same way the loader below is, so the progress bar counts
 * what actually goes over the wire rather than three per wall — every map so
 * far dresses both of its walls from one set.
 */
export function countWallFiles(walls: readonly WallDefinition[]): number {
  return new Set(walls.map((wall) => wall.surface)).size * 3;
}

/**
 * Loads the dressing for every wall of a map, keyed by wall id.
 *
 * Walls sharing a spec share the load: `left` and `right` are usually the same
 * concrete, and fetching it twice would double the progress bar for no files.
 * The cache is keyed on the spec object, so two specs pointing at the same
 * images on purpose — the same concrete at two tile scales — stay separate,
 * which is right, since `tileMeters` differs.
 *
 * `onEach` fires per file, settled or not, so a loading bar can count them.
 */
export async function loadWallSurfaces(
  walls: readonly WallDefinition[],
  onEach: () => void = () => {},
): Promise<Map<SurfaceId, WallSurface>> {
  const pending = new Map<SurfaceSpec, Promise<WallSurface>>();
  for (const wall of walls) {
    if (!pending.has(wall.surface)) {
      pending.set(wall.surface, loadOne(wall.surface, onEach));
    }
  }

  const loaded = new Map<SurfaceSpec, WallSurface>();
  await Promise.all(
    [...pending].map(async ([spec, task]) => loaded.set(spec, await task)),
  );

  return new Map(walls.map((wall) => [wall.id, loaded.get(wall.surface)!]));
}

/**
 * The road, unlike a wall, is never painted on — so its colour map can be an
 * ordinary texture on the material rather than a photograph tiled into a
 * canvas. Same files, much simpler path.
 */
export type RoadSurface = {
  albedo: THREE.Texture | null;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
  tileMeters: number;
  offsetU: number;
};

export const BARE_ROAD: RoadSurface = {
  albedo: null,
  normal: null,
  roughness: null,
  tileMeters: 4,
  offsetU: 0,
};

export async function loadRoadSurface(
  spec: SurfaceSpec,
  onEach: () => void = () => {},
): Promise<RoadSurface> {
  const counted = <T,>(pending: Promise<T>) =>
    pending.then((value) => {
      onEach();
      return value;
    });

  const [albedo, normal, roughness] = await Promise.all([
    counted(loadImage(spec.albedo)),
    counted(loadImage(spec.normal)),
    counted(loadImage(spec.roughness)),
  ]);

  const colour = asDataMap(albedo);
  // The albedo is the only one of the three that carries colour, so it is the
  // only one tagged sRGB. Doing it to the others would flatten the relief.
  if (colour) colour.colorSpace = THREE.SRGBColorSpace;

  return {
    albedo: colour,
    normal: asDataMap(normal),
    roughness: asDataMap(roughness),
    tileMeters: spec.tileMeters,
    offsetU: spec.offsetU ?? 0,
  };
}

/**
 * The ad panels, one image per language, both loaded up front.
 *
 * Two files of about 35 KB. Fetching the second one only when somebody
 * switches language would mean the sign going blank mid-game while it
 * arrives, which is a worse trade than 35 KB.
 */
export async function loadAdTextures(
  onEach: () => void = () => {},
): Promise<Record<Locale, THREE.Texture | null>> {
  const one = async (locale: Locale) => {
    const image = await loadImage(`/ads/house-${locale}.jpg`);
    onEach();
    if (!image) return null;
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace; // it carries colour, not data
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  };

  const [pt, en] = await Promise.all([one("pt"), one("en")]);
  return { pt, en };
}

/** Frees a map's road textures. The images stay in the browser's cache. */
export function disposeRoadSurface(road: RoadSurface) {
  road.albedo?.dispose();
  road.normal?.dispose();
  road.roughness?.dispose();
}

/**
 * Frees a map's wall dressing.
 *
 * Only the shared normal and roughness maps are GPU objects; the albedo is an
 * `HTMLImageElement` that was tiled into panel canvases and owns nothing. The
 * same surface can be listed under several wall ids, so dispose the set rather
 * than the entries.
 */
export function disposeWallSurfaces(surfaces: Map<SurfaceId, WallSurface>) {
  for (const surface of new Set(surfaces.values())) {
    surface.normal?.dispose();
    surface.roughness?.dispose();
  }
}

/** Total files a map fetches up front: its walls, plus three for the road. */
export const countMapFiles = (def: MapDefinition) =>
  countWallFiles(def.walls) + 3;
