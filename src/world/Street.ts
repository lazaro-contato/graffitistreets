import * as THREE from "three";
import { LAMP } from "../config";
import type { LampPlacement, MapMetrics } from "../maps/types";
import { BARE_ROAD, type RoadSurface } from "./Surfaces";

/**
 * Everything in a map that is not a canvas: the road, the coping, the building
 * masses, the blocks capping each end, the lamps and the night itself.
 *
 * It all goes into one group and comes back with a `dispose()`, because a map
 * is now something you leave. Nothing here is a module singleton any more —
 * the materials used to be, and a second map with a different road would have
 * quietly retextured the first one on its way in.
 */
export type Street = {
  group: THREE.Group;
  dispose(): void;
};

/** Everything the player cannot paint reads darker, so the canvas stands out. */
const masonry = () =>
  new THREE.MeshStandardMaterial({ color: "#191a1f", roughness: 1 });

const coping = () =>
  new THREE.MeshStandardMaterial({ color: "#2a2b30", roughness: 0.95 });

const metal = () =>
  new THREE.MeshStandardMaterial({
    color: "#15161a",
    roughness: 0.5,
    metalness: 0.6,
  });

/**
 * Collects everything that has to be freed by hand.
 *
 * Geometries, materials and textures are GPU allocations the JS garbage
 * collector knows nothing about. Leaking one set per map switch is how a game
 * that runs fine for ten minutes falls over on the eleventh.
 */
class Bin {
  private disposables: { dispose(): void }[] = [];

  keep<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  drain() {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
  }
}

/**
 * Wraps a road map across the asphalt.
 *
 * A clone per map so each can carry its own repeat, and the offset on U is
 * what slides the painted line on the photograph over to the centre of the
 * street instead of leaving it under a kerb.
 */
function tileRoad(
  bin: Bin,
  source: THREE.Texture | null,
  surface: RoadSurface,
  metrics: MapMetrics,
) {
  if (!source) return null;

  const texture = bin.keep(source.clone());
  texture.repeat.set(
    metrics.def.width / surface.tileMeters,
    metrics.def.length / surface.tileMeters,
  );
  texture.offset.set(surface.offsetU, 0);
  texture.needsUpdate = true;
  return texture;
}

function box(
  bin: Bin,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(bin.keep(new THREE.BoxGeometry(w, h, d)), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildGround(
  bin: Bin,
  group: THREE.Group,
  metrics: MapMetrics,
  surface: RoadSurface,
) {
  const asphalt = bin.keep(
    new THREE.MeshStandardMaterial({
      color: "#22242a",
      roughness: 0.72, // damp, so a raking light leaves a sheen not a flat die
    }),
  );

  asphalt.map = tileRoad(bin, surface.albedo, surface, metrics);
  asphalt.normalMap = tileRoad(bin, surface.normal, surface, metrics);
  asphalt.roughnessMap = tileRoad(bin, surface.roughness, surface, metrics);
  // A photograph brings its own tone, so stop tinting it with the fallback.
  if (asphalt.map) asphalt.color.set("#ffffff");

  const road = new THREE.Mesh(
    bin.keep(new THREE.PlaneGeometry(metrics.def.width, metrics.def.length)),
    asphalt,
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  group.add(road);
}

/**
 * Closes the street in.
 *
 * The paintable walls are flat planes with nothing behind them. This puts a
 * coping along the top, a building mass rising behind each one, and a block
 * across each end — so flying to the ceiling shows a rooftop line rather than
 * the edge of the world.
 */
function buildEnclosure(bin: Bin, group: THREE.Group, metrics: MapMetrics) {
  const { def, wallX, halfLength } = metrics;
  const e = def.enclosure;
  const stone = bin.keep(masonry());
  const cap = bin.keep(coping());

  const outerWidth = def.width + e.buildingDepth * 2;
  const innerLength = def.length + e.endDepth * 2;

  for (const sign of [-1, 1]) {
    // Inner face nudged 2 cm clear of the painted plane, which is exactly
    // coplanar with it and would z-fight.
    group.add(
      box(
        bin,
        e.buildingDepth,
        e.buildingHeight,
        innerLength,
        sign * (wallX + 0.02 + e.buildingDepth / 2),
        e.buildingHeight / 2,
        0,
        stone,
      ),
    );

    const copingWidth = e.copingOverhang + 0.16;
    group.add(
      box(
        bin,
        copingWidth,
        e.copingHeight,
        def.length,
        sign * (wallX + 0.08 - copingWidth / 2),
        def.wallHeight + e.copingHeight / 2,
        0,
        cap,
      ),
    );
  }

  // Wide enough to seal the corners against the buildings rather than leaving
  // a slit to see through.
  for (const sign of [-1, 1]) {
    group.add(
      box(
        bin,
        outerWidth,
        e.buildingHeight,
        e.endDepth,
        0,
        e.buildingHeight / 2,
        sign * (halfLength + e.endDepth / 2),
        stone,
      ),
    );
  }
}

/**
 * A lamp on a bracket, on one corner of the street.
 *
 * The cone is aimed across at the opposite wall, a third of the way up — and
 * the peak still lands at the pole, because inverse-square puts it there.
 * Aiming at the pole's own end starves the middle; aiming down the street at
 * the far corner starves the pole, which is what made the light stop looking
 * like it had a source in the first place. Measured in the alley, that
 * arrangement gave 0.8 beside a pole against 6.4 mid street — backwards. This
 * one gives 7.2 against 5.2.
 */
function buildStreetLamp(
  bin: Bin,
  group: THREE.Group,
  metrics: MapMetrics,
  placement: LampPlacement,
) {
  const { side, end, shadow } = placement;
  const poleX = side * (metrics.wallX - LAMP.WALL_GAP);
  const poleZ = end * (metrics.halfLength - LAMP.END_INSET);
  const headX = poleX - side * LAMP.ARM_REACH;
  const steel = bin.keep(metal());

  const pole = new THREE.Mesh(
    bin.keep(new THREE.CylinderGeometry(0.06, 0.08, LAMP.HEIGHT, 10)),
    steel,
  );
  pole.position.set(poleX, LAMP.HEIGHT / 2, poleZ);
  pole.castShadow = true;
  group.add(pole);

  const arm = new THREE.Mesh(
    bin.keep(new THREE.BoxGeometry(LAMP.ARM_REACH, 0.07, 0.07)),
    steel,
  );
  arm.position.set(
    poleX - (side * LAMP.ARM_REACH) / 2,
    LAMP.HEIGHT - 0.06,
    poleZ,
  );
  arm.castShadow = true;
  group.add(arm);

  // Emissive rather than lit, so it reads as the source.
  const head = new THREE.Mesh(
    bin.keep(new THREE.BoxGeometry(0.34, 0.12, 0.22)),
    bin.keep(
      new THREE.MeshStandardMaterial({
        color: "#1a1a1e",
        emissive: new THREE.Color(LAMP.COLOR),
        emissiveIntensity: 2.4,
      }),
    ),
  );
  head.position.set(headX, LAMP.HEIGHT - 0.18, poleZ);
  group.add(head);

  const light = new THREE.SpotLight(
    LAMP.COLOR,
    LAMP.INTENSITY,
    LAMP.RANGE,
    LAMP.ANGLE,
    LAMP.PENUMBRA,
    2,
  );
  light.position.set(headX, LAMP.HEIGHT - 0.22, poleZ);
  light.target.position.set(
    -side * metrics.wallX,
    metrics.def.wallHeight * LAMP.AIM_HEIGHT,
    0,
  );
  light.castShadow = shadow > 0;
  if (shadow > 0) {
    light.shadow.mapSize.set(shadow, shadow);
    light.shadow.camera.near = 0.4;
    light.shadow.camera.far = LAMP.RANGE;
    light.shadow.bias = -0.0006;
  }
  // A SpotLight owns a shadow map; three does not free it with the scene.
  bin.keep(light);
  group.add(light);
  group.add(light.target);
}

/**
 * Builds one map's static scenery, and the night it sits in.
 *
 * The sky and the fog are set on the scene rather than on the group, because
 * they are the scene's own properties — so they are the one thing here that a
 * teardown cannot simply remove. The next map overwrites them on its way in.
 */
export function buildStreet(
  scene: THREE.Scene,
  metrics: MapMetrics,
  road: RoadSurface = BARE_ROAD,
): Street {
  const bin = new Bin();
  const group = new THREE.Group();
  const sky = metrics.def.sky;

  scene.background = new THREE.Color(sky.sky);
  // Per map: the numbers that close in a 12 m alley never fire in a 20 m one.
  scene.fog = new THREE.Fog(sky.sky, sky.fogNear, sky.fogFar);

  buildGround(bin, group, metrics, road);
  buildEnclosure(bin, group, metrics);

  for (const placement of metrics.def.lamps) {
    buildStreetLamp(bin, group, metrics, placement);
  }

  // Enough sky bounce that walls outside a cone are dark rather than black.
  group.add(
    new THREE.HemisphereLight(sky.fillSky, sky.fillGround, sky.fillIntensity),
  );

  // Cool moonlight for shape. No shadows on it — the lamps cast the only ones.
  const moon = new THREE.DirectionalLight(sky.moonColor, sky.moonIntensity);
  moon.position.set(-8, 14, -6);
  group.add(moon);

  scene.add(group);

  return {
    group,
    dispose() {
      scene.remove(group);
      group.clear();
      bin.drain();
    },
  };
}
