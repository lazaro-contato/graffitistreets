import * as THREE from "three";
import { TEXTURE, NEON, type Side } from "../config";
import { panelPixels, wallRight, type WallPlacement } from "./WallPlacement";
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

  /**
   * The glow map: everything neon that has been sprayed on this panel, and
   * nothing else. It is the material's emissiveMap, so paint written here
   * lights itself instead of waiting for a lamp to fall on it.
   *
   * Half the resolution of the colour map — see NEON.MAP_SCALE.
   */
  readonly glowCanvas: HTMLCanvasElement;
  readonly glowCtx: CanvasRenderingContext2D;
  readonly glowTexture: THREE.CanvasTexture;
  readonly glowScale = NEON.MAP_SCALE;

  /**
   * Whether any neon has ever landed on this panel since its last base coat.
   *
   * It exists to keep the glow map off the hot path. Ordinary paint has to
   * *erase* glow — spraying over a neon tag has to put it out — but on a panel
   * that has never seen neon there is nothing to erase, and this skips a
   * second stamp for every dab of every stroke in the common case.
   */
  hasGlow = false;

  /** Set whenever either canvas changes; WallSystem flushes once per frame. */
  dirty = false;

  /** Canvas size of this panel, derived from how much wall it covers. */
  readonly widthPx: number;
  readonly heightPx: number;

  constructor(
    id: number,
    side: Side,
    index: number,
    private placement: WallPlacement,
    private surface: WallSurface = BARE_WALL,
  ) {
    this.id = id;
    this.side = side;
    this.index = index;

    const pixels = panelPixels(placement);
    this.widthPx = pixels.width;
    this.heightPx = pixels.height;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.widthPx;
    this.canvas.height = this.heightPx;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false })!;

    this.glowCanvas = document.createElement("canvas");
    this.glowCanvas.width = Math.round(this.widthPx * NEON.MAP_SCALE);
    this.glowCanvas.height = Math.round(this.heightPx * NEON.MAP_SCALE);
    this.glowCtx = this.glowCanvas.getContext("2d")!;

    this.paintBase();

    this.texture = new THREE.CanvasTexture(this.canvas);
    // Without sRGB here the color conversion is applied twice and the wall
    // ends up washed out or too dark.
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    // The glow map carries colour, not data, so it is tagged the same way.
    this.glowTexture = new THREE.CanvasTexture(this.glowCanvas);
    this.glowTexture.colorSpace = THREE.SRGBColorSpace;

    const panelWidth = placement.length / placement.panels;
    const geometry = new THREE.PlaneGeometry(panelWidth, placement.height);
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      normalMap: this.tileMap(surface.normal),
      roughnessMap: this.tileMap(surface.roughness),
      roughness: 0.95,
      metalness: 0.0,
      // White, so the emission is whatever colour the glow map holds rather
      // than a tint over it. Bare concrete leaves that map empty, which is
      // black, which emits nothing.
      emissive: new THREE.Color(0xffffff),
      emissiveMap: this.glowTexture,
      emissiveIntensity: NEON.INTENSITY,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.userData.panelId = id;

    // Panels are laid out along the direction the wall's own uv.x grows in,
    // which is what makes `index + uv.x` concatenate into one continuous,
    // gap-free strip however the wall is turned.
    const along = -placement.length / 2 + panelWidth * (index + 0.5);
    this.mesh.position
      .copy(placement.centre)
      .addScaledVector(wallRight(placement.yaw), along);
    this.mesh.rotation.y = placement.yaw;
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

    const panelWidth = this.placement.length / this.placement.panels;
    const texture = source.clone();
    texture.repeat.set(panelWidth / tileWidth, this.placement.height / tileHeight);
    texture.offset.set((this.index * panelWidth) / tileWidth, 0);
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
    const shift = -this.index * this.widthPx;

    pattern.setTransform(new DOMMatrix().translate(shift, 0).scale(scale, scale));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, this.widthPx, this.heightPx);
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
    // Black, not cleared. An emissiveMap is read as RGB and its alpha is
    // ignored, so "no light here" has to be an opaque black pixel — a
    // transparent one still carries whatever colour was last written into it,
    // and the wall would glow through paint that had covered it.
    //
    // Wiping it with the paint is what makes undo and journal replay work on
    // neon: the wall goes back to bare, and the strokes that survived put
    // their own light back as they are drawn again.
    this.glowCtx.globalCompositeOperation = "source-over";
    this.glowCtx.fillStyle = "#000000";
    this.glowCtx.fillRect(0, 0, this.glowCanvas.width, this.glowCanvas.height);
    this.hasGlow = false;

    const photographed = this.surface.albedo
      ? this.tilePhoto(this.surface.albedo)
      : false;

    paintConcrete(this.ctx, {
      width: this.widthPx,
      height: this.heightPx,
      seed: this.id,
      // A photograph brings its own grain, so only the damp patches go over it.
      grain: !photographed,
    });

    this.dirty = true;
  }

  /**
   * Swaps the photograph this panel is dressed in.
   *
   * The base coat is *not* repainted here. A panel canvas holds the paint as
   * well as the wall under it, so redrawing the base on its own would wipe
   * every stroke on it — the journal has to put them back, and only the store
   * can do that. See WallSystem.dress.
   *
   * The old clones are disposed rather than dropped: they are GPU allocations,
   * and swapping surfaces a few times in a session would otherwise leak a
   * normal and a roughness map each time.
   */
  setSurface(surface: WallSurface) {
    this.surface = surface;

    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.normalMap?.dispose();
    material.roughnessMap?.dispose();
    material.normalMap = this.tileMap(surface.normal);
    material.roughnessMap = this.tileMap(surface.roughness);
    material.needsUpdate = true;
  }

  toDataURL() {
    return this.canvas.toDataURL("image/webp", 0.85);
  }

  /** The JS garbage collector does not free GPU resources — call this by hand. */
  dispose() {
    this.texture.dispose();
    this.glowTexture.dispose();
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.normalMap?.dispose();
    material.roughnessMap?.dispose();
    material.dispose();
    this.mesh.geometry.dispose();
  }
}
