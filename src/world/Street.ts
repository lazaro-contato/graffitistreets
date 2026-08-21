import * as THREE from "three";
import { WORLD } from "../config";

/** Builds the static scenery: road, sidewalks and lights. */
export function buildStreet(scene: THREE.Scene) {
  // Asphalt
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.STREET_WIDTH, WORLD.STREET_LENGTH),
    new THREE.MeshStandardMaterial({ color: "#3a3a3c", roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  // Sidewalks
  const sidewalkGeo = new THREE.BoxGeometry(
    WORLD.SIDEWALK_WIDTH,
    WORLD.SIDEWALK_HEIGHT,
    WORLD.STREET_LENGTH,
  );
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: "#6f6f6d",
    roughness: 0.9,
  });
  for (const sign of [-1, 1]) {
    const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sidewalk.position.set(
      sign * (WORLD.STREET_WIDTH / 2 - WORLD.SIDEWALK_WIDTH / 2),
      WORLD.SIDEWALK_HEIGHT / 2,
      0,
    );
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);
  }

  // Lights
  const hemi = new THREE.HemisphereLight("#cfe0f0", "#4a4a44", 1.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
  sun.position.set(18, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Explicit shadow camera bounds are mandatory: the default frustum is small
  // and shadows would vanish at the far end of the street. Keep them just wide
  // enough for the world — every spare meter costs shadow resolution.
  const d = Math.max(WORLD.STREET_LENGTH, WORLD.STREET_WIDTH) * 0.9;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.camera.far = 90;
  // Negative bias kills the striped shadow acne on lit surfaces.
  sun.shadow.bias = -0.0005;
  scene.add(sun);
}
