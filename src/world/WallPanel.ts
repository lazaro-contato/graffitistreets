import * as THREE from "three";
import { TEXTURE, SURFACE } from "../config";
import type { MapMetrics, SurfaceId, WallDefinition } from "../maps/types";
import { createRandom } from "../core/Random";
import { BARE_WALL, type WallSurface } from "./Surfaces";

/**
 * One slice of a wall strip: a mesh, a 2D canvas and a CanvasTexture.
 *
 * A panel is a *rendering* unit, not a logical one. The wall is split up only
 * to bound the per-frame texture upload — paint is addressed in strip
 * coordinates and may spill from one panel into the next. See WallStrip.
 */
export class WallPanel {
  readonly id: number;
  /** Which wall of the map this is a slice of. Strokes are keyed by it. */
  readonly surfaceId: SurfaceId;
  readonly index: number;
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;

  /** Set whenever the canvas changes; WallSystem flushes once per frame. */
  dirty = false;

  constructor(
    id: number,
    wall: WallDefinition,
    index: number,
    private metrics: MapMetrics,
    private surface: WallSurface = BARE_WALL,
  ) {
    this.id = id;
    this.surfaceId = wall.id;
    this.index = index;

    const { def, panelTextureWidth, panelTextureHeight } = metrics;

    this.canvas = document.createElement("canvas");
    this.canvas.width = panelTextureWidth;
    this.canvas.height = panelTextureHeight;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false })!;
    this.paintBase();

    this.texture = new THREE.CanvasTexture(this.canvas);
    // Without sRGB here the color conversion is applied twice and the wall
    // ends up washed out or too dark.
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const geometry = new THREE.PlaneGeometry(def.panelWidth, def.wallHeight);
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

    const left = wall.side === "left";
    const x = left ? -metrics.wallX : metrics.wallX;

    // A plane's local +X — the direction its uv.x grows in — ends up pointing
    // at -Z on the left wall and +Z on the right wall after the y rotation.
    // Laying panels out along that same direction is what makes
    // `index + uv.x` concatenate into one continuous, gap-free strip.
    const uvDirection = left ? -1 : 1;
    const z =
      uvDirection *
      (-metrics.halfLength + def.panelWidth * (index + 0.5));

    this.mesh.position.set(x, def.wallHeight / 2, z);
    this.mesh.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
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

    const { panelWidth, wallHeight } = this.metrics.def;
    const texture = source.clone();
    texture.repeat.set(panelWidth / tileWidth, wallHeight / tileHeight);
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

    const { panelTextureWidth, panelTextureHeight, def } = this.metrics;
    const scale = (this.surface.tileMeters * def.pixelsPerMeter) / image.width;
    const shift = -this.index * panelTextureWidth;

    pattern.setTransform(new DOMMatrix().translate(shift, 0).scale(scale, scale));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, panelTextureWidth, panelTextureHeight);
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
    const { ctx } = this;
    const w = this.metrics.panelTextureWidth;
    const h = this.metrics.panelTextureHeight;
    const random = createRandom(0x9e3779b9 ^ this.id);

    ctx.globalAlpha = 1;

    const photographed = this.surface.albedo
      ? this.tilePhoto(this.surface.albedo)
      : false;

    if (!photographed) {
      ctx.fillStyle = TEXTURE.BASE_COLOR;
      ctx.fillRect(0, 0, w, h);

      // Concrete grain. Skipped over a photograph, which already has its own —
      // and this per-pixel pass is the slowest thing in start-up.
      const img = ctx.getImageData(0, 0, w, h);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (random() - 0.5) * 255 * TEXTURE.NOISE_AMOUNT;
        data[i] += n;
        data[i + 1] += n;
        data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
    }

    // Damp patches, so the surface does not read as flat — and so two panels
    // sharing one tiled photograph do not read as clones of each other.
    ctx.globalAlpha = photographed ? SURFACE.GRUNGE_ALPHA : 0.05;
    for (let i = 0; i < 12; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = (60 + random() * 180) * (this.metrics.def.pixelsPerMeter / 256);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "#3a3a38");
      g.addColorStop(1, "rgba(58,58,56,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

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
