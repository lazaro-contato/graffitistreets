import * as THREE from "three";
import { SURFACE } from "../config";

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
};

export const BARE_WALL: WallSurface = {
  albedo: null,
  normal: null,
  roughness: null,
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

/** `onEach` fires per file, settled or not, so a loading bar can count them. */
export async function loadWallSurface(
  onEach: () => void = () => {},
): Promise<WallSurface> {
  const counted = <T,>(pending: Promise<T>) =>
    pending.then((value) => {
      onEach();
      return value;
    });

  const [albedo, normal, roughness] = await Promise.all([
    counted(loadImage(SURFACE.ALBEDO)),
    counted(loadImage(SURFACE.NORMAL)),
    counted(loadImage(SURFACE.ROUGHNESS)),
  ]);

  return { albedo, normal: asDataMap(normal), roughness: asDataMap(roughness) };
}
