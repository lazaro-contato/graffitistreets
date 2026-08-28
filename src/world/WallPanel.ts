import * as THREE from "three";
import {
  WORLD,
  TEXTURE,
  PANEL_TEXTURE_WIDTH,
  PANEL_TEXTURE_HEIGHT,
  type Side,
} from "../config";
import { paintConcrete } from "./Concrete";
import { BARE_WALL, type WallSurface } from "./Surfaces";

export type { Side };

/**
 * One slice of a wall strip: a mesh, a 2D canvas and a CanvasTexture.
 *
 * A panel is a *rendering* unit, not a logical one. The wall is split up only
 * to bound the per-frame texture upload — paint is addressed in strip
 * coordinates and may spill from one panel into the next. See WallStrip.
 */
export class WallPanel {
  readonly id: number;
  readonly side: Side;
  readonly index: number;
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;

  /** Set whenever the canvas changes; WallSystem flushes once per frame. */
  dirty = false;

  constructor(
    id: number,
    side: Side,
    index: number,
    private surface: WallSurface = BARE_WALL,
  ) {
    this.id = id;
    this.side = side;
    this.index = index;

    this.canvas = document.createElement("canvas");
    this.canvas.width = PANEL_TEXTURE_WIDTH;
    this.canvas.height = PANEL_TEXTURE_HEIGHT;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false })!;
    this.paintBase();

    this.texture = new THREE.CanvasTexture(this.canvas);
    // Without sRGB here the color conversion is applied twice and the wall
    // ends up washed out or too dark.
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const geometry = new THREE.PlaneGeometry(
      WORLD.PANEL_WIDTH,
      WORLD.WALL_HEIGHT,
    );
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      normalMap: this.tileMap(surface.normal),
      roughnessMap: this.tileMap(surface.roughness),
      roughness: 0.95,
      metalness: 0.0,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.userData.panelId = id;

    const x = side === "left" ? -WORLD.STREET_WIDTH / 2 : WORLD.STREET_WIDTH / 2;

    // A plane's local +X — the direction its uv.x grows in — ends up pointing
    // at -Z on the left wall and +Z on the right wall after the y rotation.
    // Laying panels out along that same direction is what makes
    // `index + uv.x` concatenate into one continuous, gap-free strip.
    const uvDirection = side === "left" ? -1 : 1;
    const z =
      uvDirection *
      (-WORLD.STREET_LENGTH / 2 + WORLD.PANEL_WIDTH * (index + 0.5));

    this.mesh.position.set(x, WORLD.WALL_HEIGHT / 2, z);
    this.mesh.rotation.y = side === "left" ? Math.PI / 2 : -Math.PI / 2;
  }

  /**
   * Repeats a shared data map across this panel.
   *
   * Every panel gets its own clone so it can carry its own offset — the tiling
   * has to keep running through a seam, not restart at each panel. Clones share
   * the underlying image, so this costs one GPU upload, not four.
   */
  private tileMap(source: THREE.Texture | null) {
    if (!source) return null;

    const image = source.image as { width: number; height: number };
    const tileWidth = this.surface.tileMeters;
    // A source that is not square covers a patch of wall that is not square
    // either. Honouring its aspect is what keeps the relief lined up with the
    // albedo, which is tiled into the canvas under exactly the same rule —
    // assume square here and a 1024x715 photo puts the two out of step.
    const tileHeight = tileWidth * (image.height / image.width);

    const texture = source.clone();
    texture.repeat.set(
      WORLD.PANEL_WIDTH / tileWidth,
      WORLD.WALL_HEIGHT / tileHeight,
    );
    texture.offset.set((this.index * WORLD.PANEL_WIDTH) / tileWidth, 0);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Tiles the wall photograph into the canvas as the base coat.
   *
   * One tile covers this.surface.tileMeters of wall whatever the file's pixel size,
   * so brick stays brick-sized if the texture resolution or the panel changes.
   * The horizontal shift is where this panel sits along the strip, so courses
   * run straight through the seam instead of restarting at every panel.
   */
  private tilePhoto(image: HTMLImageElement) {
    const { ctx } = this;
    const pattern = ctx.createPattern(image, "repeat");
    if (!pattern) return false;

    const scale = (this.surface.tileMeters * TEXTURE.PIXELS_PER_METER) / image.width;
    const shift = -this.index * PANEL_TEXTURE_WIDTH;

    pattern.setTransform(new DOMMatrix().translate(shift, 0).scale(scale, scale));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, PANEL_TEXTURE_WIDTH, PANEL_TEXTURE_HEIGHT);
    return true;
  }

  /**
   * The base coat under the paint: a wall photograph if one was supplied,
   * procedural concrete otherwise.
   *
   * Also used by reset and journal replay, so the variation is seeded from the
   * panel id — a random base would visibly reshuffle every time an undo
   * repaints the panel.
   */
  paintBase() {
    const photographed = this.surface.albedo
      ? this.tilePhoto(this.surface.albedo)
      : false;

    paintConcrete(this.ctx, {
      width: PANEL_TEXTURE_WIDTH,
      height: PANEL_TEXTURE_HEIGHT,
      seed: this.id,
      // A photograph brings its own grain, so only the damp patches go over it.
      grain: !photographed,
    });

    this.dirty = true;
  }

  toDataURL() {
    return this.canvas.toDataURL("image/webp", 0.85);
  }

  /** The JS garbage collector does not free GPU resources — call this by hand. */
  dispose() {
    this.texture.dispose();
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.normalMap?.dispose();
    material.roughnessMap?.dispose();
    material.dispose();
    this.mesh.geometry.dispose();
  }
}
