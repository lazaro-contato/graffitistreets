import type { Engine } from "./core/Engine";
import type { SprayCan } from "./paint/SprayCan";
import type { Transport } from "./net/Transport";
import type { Locale } from "./i18n/strings";
import { measure, type MapDefinition, type MapMetrics } from "./maps/types";
import { buildStreet } from "./world/Street";
import { WallSystem } from "./world/WallSystem";
import {
  countMapFiles,
  disposeRoadSurface,
  disposeWallSurfaces,
  loadRoadSurface,
  loadWallSurfaces,
} from "./world/Surfaces";
import { buildBillboards, type AdTextures, type Billboards } from "./world/Billboard";
import { Aim } from "./paint/Aim";
import { PaintSystem } from "./paint/PaintSystem";
import { DripSystem } from "./paint/DripSystem";
import { StrokeStore } from "./state/StrokeStore";
import { SprayCursor } from "./ui/SprayCursor";
import { ADS } from "./config";

/**
 * One loaded map, and everything that only makes sense while it is loaded.
 *
 * The split is by lifetime, not by subject. The renderer, the input, the can,
 * the transport, the menu and the player all outlive a street — so they stay
 * in `main.ts`. The walls, the scenery, the journal and the three systems that
 * read a wall's dimensions are rebuilt every time you go somewhere else, so
 * they live here and come back with a `dispose()`.
 *
 * That `dispose()` is not housekeeping. Geometries, materials and textures are
 * GPU allocations the garbage collector cannot see; leaking a map's worth of
 * them per switch is how a session dies after the fifth street.
 */
export type Arena = {
  readonly metrics: MapMetrics;
  readonly store: StrokeStore;
  /** What the crosshair is on, when it is on something to click rather than paint. */
  currentLink(): string | null;
  setLocale(locale: Locale): void;
  /** Run once a frame, after the player has moved and before the render. */
  update(dt: number, painting: boolean): void;
  dispose(): void;
};

export type ArenaDeps = {
  engine: Engine;
  can: SprayCan;
  transport: Transport;
  authorId: string;
  /** Artwork for the ad panels, loaded once and hung in every map. */
  ads: AdTextures | null;
  /** Fires per file fetched, settled or not, so a bar can count them. */
  onFile?: () => void;
  /** Yields a frame, so a progress bar can actually paint between steps. */
  breathe?: () => Promise<void>;
};

/** How many files loading this map will fetch. For sizing a progress bar. */
export const fileCount = (def: MapDefinition) => countMapFiles(def);

/**
 * Builds a map and everything that paints on it.
 *
 * The wall dressing is awaited before the walls exist because the photograph
 * is tiled into each panel canvas as its base coat — there is no adding it
 * afterwards without repainting every panel.
 */
export async function loadArena(
  def: MapDefinition,
  deps: ArenaDeps,
): Promise<Arena> {
  const { engine, can, transport, authorId, ads } = deps;
  const onFile = deps.onFile ?? (() => {});
  const breathe = deps.breathe ?? (async () => {});

  const metrics = measure(def);

  const [road, surfaces] = await Promise.all([
    loadRoadSurface(def.road, onFile),
    loadWallSurfaces(def.walls, onFile),
  ]);

  const street = buildStreet(engine.scene, metrics, road);

  // Building the panels blocks the main thread — every canvas gets its base
  // coat tiled into it — so let whatever is on screen paint one more frame.
  await breathe();
  const walls = new WallSystem(metrics, surfaces);
  engine.scene.add(walls.group);

  // Off by default: see ADS.ENABLED. With it off nothing is built and Aim has
  // nothing clickable to test.
  const billboards: Billboards | null =
    ADS.ENABLED && ads
      ? buildBillboards(engine.scene, metrics, ads, ADS.HOUSE_LINK)
      : null;

  const store = new StrokeStore(walls);
  const aim = new Aim(engine.camera, walls, billboards?.meshes ?? []);
  const drips = new DripSystem(transport, authorId, metrics);
  const paint = new PaintSystem(aim, can, transport, drips, authorId, metrics);
  const cursor = new SprayCursor(engine.camera, can, aim, paint);

  return {
    metrics,
    store,

    currentLink: () => aim.current.link,

    setLocale(locale) {
      billboards?.setLocale(locale);
    },

    // Aim runs before paint so both the spray and the cursor act on the same
    // frame's raycast, and the flush comes after all paint logic so it stays
    // at one texture upload per panel per frame.
    update(dt, painting) {
      aim.update();
      // Pointing at a sign is not painting, so the trigger does nothing to the
      // wall behind it.
      paint.update(painting && !aim.current.link, dt);
      // After paint, so a run spawned this frame lays its first point at once.
      drips.update(dt);
      cursor.update();
      walls.flush();
    },

    dispose() {
      engine.scene.remove(walls.group);
      walls.dispose();
      billboards?.dispose();
      street.dispose();
      disposeWallSurfaces(surfaces);
      disposeRoadSurface(road);
    },
  };
}
