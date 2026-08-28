import * as THREE from "three";
import { ADS } from "../config";
import type { MapMetrics } from "../maps/types";
import type { Locale } from "../i18n/strings";

export type AdTextures = Record<Locale, THREE.Texture | null>;

export type Billboards = {
  /** Handed to Aim, which is the one thing that raycasts. */
  meshes: THREE.Mesh[];
  setLocale(locale: Locale): void;
  dispose(): void;
};

/**
 * A lit panel on each end block.
 *
 * The face is a basic material with tone mapping switched off, which is what
 * actually sells "backlit": a standard material would be dimmed by the night
 * lighting like everything else, and the filmic tone curve would then crush
 * the highlights it has left. Off the curve, at full value, it reads as a
 * thing emitting light rather than a thing catching it.
 *
 * A small point light in front does the rest, spilling onto the ground so the
 * box has a reason to be the brightest thing in the corner.
 */
export function buildBillboards(
  scene: THREE.Scene,
  metrics: MapMetrics,
  textures: AdTextures,
  link: string,
): Billboards {
  const faces: THREE.MeshBasicMaterial[] = [];
  const meshes: THREE.Mesh[] = [];
  const groups: THREE.Group[] = [];
  const junk: { dispose(): void }[] = [];

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: "#0e1014",
    roughness: 0.4,
    metalness: 0.7,
  });
  junk.push(frameMaterial);

  for (const end of [-1, 1] as const) {
    const group = new THREE.Group();
    groups.push(group);
    group.position.set(0, ADS.CENTRE_Y, end * (metrics.halfLength - ADS.PROUD));
    // A plane's normal is +Z, which already faces down the alley from the near
    // end; the far one has to be turned to face back.
    group.rotation.y = end < 0 ? 0 : Math.PI;

    const frameGeometry = new THREE.BoxGeometry(
      ADS.WIDTH + 0.14,
      ADS.HEIGHT + 0.14,
      0.08,
    );
    junk.push(frameGeometry);
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.z = -0.05;
    frame.castShadow = true;
    group.add(frame);

    const face = new THREE.MeshBasicMaterial({
      map: textures.pt,
      toneMapped: false,
    });
    faces.push(face);
    junk.push(face);

    const panelGeometry = new THREE.PlaneGeometry(ADS.WIDTH, ADS.HEIGHT);
    junk.push(panelGeometry);
    const panel = new THREE.Mesh(panelGeometry, face);
    // What Aim looks for. Anything carrying a link is pointed at, not painted.
    panel.userData.link = link;
    group.add(panel);
    meshes.push(panel);

    const spill = new THREE.PointLight(
      ADS.GLOW_COLOR,
      ADS.GLOW_INTENSITY,
      7,
      2,
    );
    spill.position.set(0, 0, 0.6);
    group.add(spill);

    scene.add(group);
  }

  return {
    meshes,
    setLocale(locale) {
      const texture = textures[locale] ?? textures.pt;
      for (const face of faces) {
        face.map = texture;
        face.needsUpdate = true;
      }
    },
    dispose() {
      for (const group of groups) {
        scene.remove(group);
        group.clear();
      }
      for (const item of junk) item.dispose();
      // The artwork itself is not freed here: it is one texture per language,
      // loaded once, and the next map hangs the same two signs.
      meshes.length = 0;
    },
  };
}
