import * as THREE from "three";
import { ROAD_SURFACE, type Side, type SurfaceSpec } from "../config";
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
 * Loads one wall's three files. Exported because a side can be re-dressed on
 * its own, long after the world was built.
 */
export function loadWallSurface(
  spec: SurfaceSpec,
  onEach: () => void = () => {},
): Promise<WallSurface> {
  return loadOne(spec, onEach);
}

/**
 * Loads both walls. `onEach` fires per file, settled or not, so a loading bar
 * can count them — six in total, three a side.
 *
 * Which spec dresses which side is the caller's decision now: it comes from the
 * manifest, and nothing down here should have to know that a catalogue exists.
 */
export async function loadWallSurfaces(
  specs: Record<Side, SurfaceSpec>,
  onEach: () => void = () => {},
): Promise<Record<Side, WallSurface>> {
  const [left, right] = await Promise.all([
    loadOne(specs.left, onEach),
    loadOne(specs.right, onEach),
  ]);
  return { left, right };
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
};

export const BARE_ROAD: RoadSurface = {
  albedo: null,
  normal: null,
  roughness: null,
  tileMeters: 4,
};

export async function loadRoadSurface(
  onEach: () => void = () => {},
): Promise<RoadSurface> {
  const counted = <T,>(pending: Promise<T>) =>
    pending.then((value) => {
      onEach();
      return value;
    });

  const [albedo, normal, roughness] = await Promise.all([
    counted(loadImage(ROAD_SURFACE.albedo)),
    counted(loadImage(ROAD_SURFACE.normal)),
    counted(loadImage(ROAD_SURFACE.roughness)),
  ]);

  const colour = asDataMap(albedo);
  // The albedo is the only one of the three that carries colour, so it is the
  // only one tagged sRGB. Doing it to the others would flatten the relief.
  if (colour) colour.colorSpace = THREE.SRGBColorSpace;

  return {
    albedo: colour,
    normal: asDataMap(normal),
    roughness: asDataMap(roughness),
    tileMeters: ROAD_SURFACE.tileMeters,
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
