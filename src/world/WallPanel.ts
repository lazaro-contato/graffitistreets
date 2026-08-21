import * as THREE from "three";
import {
  WORLD,
  TEXTURE,
  PANEL_TEXTURE_WIDTH,
  PANEL_TEXTURE_HEIGHT,
  type Side,
} from "../config";
import { createRandom } from "../core/Random";

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

  constructor(id: number, side: Side, index: number) {
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
   * Base concrete plus noise. Also used by reset and journal replay, so it is
   * seeded from the panel id — a random base would visibly reshuffle every
   * time an undo repaints the panel.
   */
  paintBase() {
    const { ctx } = this;
    const w = PANEL_TEXTURE_WIDTH;
    const h = PANEL_TEXTURE_HEIGHT;
    const random = createRandom(0x9e3779b9 ^ this.id);

    ctx.globalAlpha = 1;
    ctx.fillStyle = TEXTURE.BASE_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Concrete grain
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (random() - 0.5) * 255 * TEXTURE.NOISE_AMOUNT;
      data[i] += n;
      data[i + 1] += n;
      data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    // Damp patches, so the surface does not read as flat
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 12; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = (60 + random() * 180) * (TEXTURE.PIXELS_PER_METER / 256);
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
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
