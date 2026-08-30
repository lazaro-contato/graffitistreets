import * as THREE from "three";
import {
  WORLD,
  SKIES,
  DEFAULT_TIME_OF_DAY,
  LAMP,
  ROAD_OFFSET_U,
  WALL_X,
  HALF_LENGTH,
  type SkySpec,
  type TimeOfDay,
} from "../config";
import { BARE_ROAD, type RoadSurface } from "./Surfaces";

const ASPHALT = new THREE.MeshStandardMaterial({
  color: "#22242a",
  roughness: 0.72, // damp, so a raking light leaves a sheen instead of dying flat
});

/**
 * Wraps a road map across the asphalt.
 *
 * A clone per map so each can carry its own repeat, and the half-tile offset
 * on U is what slides the painted line on the photograph over to the centre
 * of the alley instead of leaving it under a kerb.
 */
function tileRoad(source: THREE.Texture | null, tileMeters: number) {
  if (!source) return null;

  const texture = source.clone();
  texture.repeat.set(
    WORLD.STREET_WIDTH / tileMeters,
    WORLD.STREET_LENGTH / tileMeters,
  );
  texture.offset.set(ROAD_OFFSET_U, 0);
  texture.needsUpdate = true;
  return texture;
}

const COPING = new THREE.MeshStandardMaterial({
  color: "#2a2b30",
  roughness: 0.95,
});

/** Everything the player cannot paint reads darker, so the canvas stands out. */
const MASONRY = new THREE.MeshStandardMaterial({
  color: "#191a1f",
  roughness: 1,
});

const METAL = new THREE.MeshStandardMaterial({
  color: "#15161a",
  roughness: 0.5,
  metalness: 0.6,
});

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildGround(scene: THREE.Scene, surface: RoadSurface) {
  ASPHALT.map = tileRoad(surface.albedo, surface.tileMeters);
  ASPHALT.normalMap = tileRoad(surface.normal, surface.tileMeters);
  ASPHALT.roughnessMap = tileRoad(surface.roughness, surface.tileMeters);
  // A photograph brings its own tone, so stop tinting it with the fallback.
  if (ASPHALT.map) ASPHALT.color.set("#ffffff");
  ASPHALT.needsUpdate = true;

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.STREET_WIDTH, WORLD.STREET_LENGTH),
    ASPHALT,
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);
}

/**
 * Closes the alley in.
 *
 * The paintable walls are flat planes with nothing behind them. This puts a
 * coping along the top, a building mass rising behind each one, and a block
 * across each end — so flying to the ceiling shows a rooftop line rather than
 * the edge of the world.
 */
function buildEnclosure(scene: THREE.Scene) {
  const outerWidth = WORLD.STREET_WIDTH + WORLD.BUILDING_DEPTH * 2;
  const innerLength = WORLD.STREET_LENGTH + WORLD.END_DEPTH * 2;

  for (const sign of [-1, 1]) {
    // Inner face nudged 2 cm clear of the painted plane, which is exactly
    // coplanar with it and would z-fight.
    scene.add(
      box(
        WORLD.BUILDING_DEPTH,
        WORLD.BUILDING_HEIGHT,
        innerLength,
        sign * (WALL_X + 0.02 + WORLD.BUILDING_DEPTH / 2),
        WORLD.BUILDING_HEIGHT / 2,
        0,
        MASONRY,
      ),
    );

    const copingWidth = WORLD.COPING_OVERHANG + 0.16;
    scene.add(
      box(
        copingWidth,
        WORLD.COPING_HEIGHT,
        WORLD.STREET_LENGTH,
        sign * (WALL_X + 0.08 - copingWidth / 2),
        WORLD.WALL_HEIGHT + WORLD.COPING_HEIGHT / 2,
        0,
        COPING,
      ),
    );
  }

  // Wide enough to seal the corners against the buildings rather than leaving
  // a slit to see through.
  for (const sign of [-1, 1]) {
    scene.add(
      box(
        outerWidth,
        WORLD.BUILDING_HEIGHT,
        WORLD.END_DEPTH,
        0,
        WORLD.BUILDING_HEIGHT / 2,
        sign * (HALF_LENGTH + WORLD.END_DEPTH / 2),
        MASONRY,
      ),
    );
  }
}

/** How hard the lamp head itself emits at night, before the sky scales it. */
const HEAD_EMISSION = 2.4;

/** The parts of a lamp that the time of day turns up or down. */
type Lamp = {
  light: THREE.SpotLight;
  head: THREE.MeshStandardMaterial;
};

/**
 * A lamp on a bracket, on one corner of the alley.
 *
 * The cone is aimed across at the middle of the opposite wall — and the peak
 * still lands at the pole, because inverse-square puts it there. Aiming *at*
 * the pole's own end starves the middle; aiming down the alley at the far
 * corner starves the pole, which is what made the light stop looking like it
 * had a source in the first place. Measured, that arrangement gave 0.8 beside
 * a pole against 6.4 mid alley — backwards. This one gives 7.2 against 5.2.
 */
function buildStreetLamp(
  scene: THREE.Scene,
  side: -1 | 1,
  end: -1 | 1,
  shadowSize: number,
): Lamp {
  const poleX = side * (WALL_X - LAMP.WALL_GAP);
  const poleZ = end * (HALF_LENGTH - LAMP.END_INSET);
  const headX = poleX - side * LAMP.ARM_REACH;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, LAMP.HEIGHT, 10),
    METAL,
  );
  pole.position.set(poleX, LAMP.HEIGHT / 2, poleZ);
  pole.castShadow = true;
  scene.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(LAMP.ARM_REACH, 0.07, 0.07),
    METAL,
  );
  arm.position.set(poleX - (side * LAMP.ARM_REACH) / 2, LAMP.HEIGHT - 0.06, poleZ);
  arm.castShadow = true;
  scene.add(arm);

  // Emissive rather than lit, so it reads as the source.
  const headMaterial = new THREE.MeshStandardMaterial({
    color: "#1a1a1e",
    emissive: new THREE.Color(LAMP.COLOR),
    emissiveIntensity: HEAD_EMISSION,
  });
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.12, 0.22),
    headMaterial,
  );
  head.position.set(headX, LAMP.HEIGHT - 0.18, poleZ);
  scene.add(head);

  const light = new THREE.SpotLight(
    LAMP.COLOR,
    LAMP.INTENSITY,
    LAMP.RANGE,
    LAMP.ANGLE,
    LAMP.PENUMBRA,
    2,
  );
  light.position.set(headX, LAMP.HEIGHT - 0.22, poleZ);
  light.target.position.set(-side * WALL_X, 1, 0);
  light.castShadow = shadowSize > 0;
  if (shadowSize > 0) {
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.camera.near = 0.4;
    light.shadow.camera.far = LAMP.RANGE;
    light.shadow.bias = -0.0006;
  }
  scene.add(light);
  scene.add(light.target);

  return { light, head: headMaterial };
}

/** Builds the static scenery: road, kerbs, the enclosure, and the night. */
/**
 * The lights of the street, and the one switch that moves all of them together.
 *
 * Every light is built once and re-aimed rather than rebuilt, because a shadow
 * map is an allocation and swapping the sky must not cost a stutter mid-game.
 * `onGlow` is how the walls hear about it: the paint's own emission belongs to
 * the panels, which live above this file, so it is reported rather than reached
 * for.
 */
export class Sky {
  current: TimeOfDay = DEFAULT_TIME_OF_DAY;

  private onGlow: (scale: number) => void = () => {};

  constructor(
    private scene: THREE.Scene,
    private fill: THREE.HemisphereLight,
    private key: THREE.DirectionalLight,
    private lamps: Lamp[],
  ) {}

  /** Told what to do with the paint's own light, which is not this file's. */
  glowsWith(onGlow: (scale: number) => void) {
    this.onGlow = onGlow;
    this.apply(SKIES[this.current]);
  }

  set(time: TimeOfDay) {
    this.current = time;
    this.apply(SKIES[time]);
  }

  private apply(sky: SkySpec) {
    (this.scene.background as THREE.Color).set(sky.SKY);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(sky.SKY);
    fog.near = sky.FOG_NEAR;
    fog.far = sky.FOG_FAR;

    this.fill.color.set(sky.FILL_SKY);
    this.fill.groundColor.set(sky.FILL_GROUND);
    this.fill.intensity = sky.FILL_INTENSITY;

    this.key.color.set(sky.KEY_COLOR);
    this.key.intensity = sky.KEY_INTENSITY;
    this.key.position.set(...sky.KEY_POSITION);

    for (const lamp of this.lamps) {
      lamp.light.intensity = LAMP.INTENSITY * sky.LAMPS;
      // Off, not dim: a spotlight at zero still pays for its shadow map every
      // frame, and there is nothing for it to light at noon.
      lamp.light.visible = sky.LAMPS > 0;
      lamp.head.emissiveIntensity = HEAD_EMISSION * sky.GLOW;
    }

    this.onGlow(sky.GLOW);
  }
}

/** Builds the static scenery: road, kerbs, the enclosure, and the sky. */
export function buildStreet(
  scene: THREE.Scene,
  road: RoadSurface = BARE_ROAD,
): Sky {
  const sky = SKIES[DEFAULT_TIME_OF_DAY];

  scene.background = new THREE.Color(sky.SKY);
  // Tuned to the arena. The old 30-90 never fired in a world this size.
  scene.fog = new THREE.Fog(sky.SKY, sky.FOG_NEAR, sky.FOG_FAR);

  buildGround(scene, road);
  buildEnclosure(scene);

  // Diagonally opposite, so between them they reach both ends of both walls.
  // The second shadow map is quarter size: it is there for the direction it
  // implies, not for the detail.
  const lamps = [
    buildStreetLamp(scene, -1, -1, 2048),
    buildStreetLamp(scene, 1, 1, 1024),
  ];

  // Enough sky bounce that walls outside a cone are dark rather than black.
  const fill = new THREE.HemisphereLight(
    sky.FILL_SKY,
    sky.FILL_GROUND,
    sky.FILL_INTENSITY,
  );
  scene.add(fill);

  // The moon at night, the sun by day. No shadows on it either way — the lamps
  // cast the only ones, and a second shadow map down a corridor this size buys
  // nothing but the frame it costs.
  const key = new THREE.DirectionalLight(sky.KEY_COLOR, sky.KEY_INTENSITY);
  key.position.set(...sky.KEY_POSITION);
  scene.add(key);

  return new Sky(scene, fill, key, lamps);
}
