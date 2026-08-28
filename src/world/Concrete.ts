import { TEXTURE, SURFACE } from "../config";
import { createRandom } from "../core/Random";

export type ConcreteOptions = {
  width: number;
  height: number;
  /** Scales the damp patches, so they stay the same size on the wall. */
  pixelsPerMeter?: number;
  /**
   * Seed for the variation.
   *
   * Anything drawn from the journal has to be deterministic: an undo repaints
   * the panel, and a random base would visibly reshuffle the concrete under
   * the paint that survived.
   */
  seed: number;
  /** Skipped over a photograph, which brings its own grain. */
  grain?: boolean;
};

/** Damp patches per surface. Enough to break up a flat field, not a texture. */
const PATCHES = 12;

/**
 * The bare wall: flat concrete, per-pixel grain, and a few damp patches.
 *
 * Shared by the real panels and by the workshop's practice wall, which is the
 * point — the practice wall is meant to tell you what a cap will do on the
 * street, and it cannot do that if it is a different surface underneath.
 */
export function paintConcrete(
  ctx: CanvasRenderingContext2D,
  options: ConcreteOptions,
) {
  const { width: w, height: h, seed } = options;
  const grain = options.grain ?? true;
  const pixelsPerMeter = options.pixelsPerMeter ?? TEXTURE.PIXELS_PER_METER;
  const random = createRandom(0x9e3779b9 ^ seed);

  ctx.globalAlpha = 1;

  if (grain) {
    ctx.fillStyle = TEXTURE.BASE_COLOR;
    ctx.fillRect(0, 0, w, h);

    // This per-pixel pass is the slowest thing in start-up, which is why the
    // photographed path skips it rather than dimming it.
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
  ctx.globalAlpha = grain ? 0.05 : SURFACE.GRUNGE_ALPHA;
  for (let i = 0; i < PATCHES; i++) {
    const x = random() * w;
    const y = random() * h;
    const r = (60 + random() * 180) * (pixelsPerMeter / 256);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#3a3a38");
    g.addColorStop(1, "rgba(58,58,56,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}
