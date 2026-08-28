/**
 * Colour conversions for the mixer.
 *
 * The game itself only ever handles "#rrggbb" strings — that is what a stroke
 * records and what the can carries. HSV exists here and nowhere else, because
 * it is how a person picks a colour, not how paint is stored.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Accepts "#rgb" and "#rrggbb", with or without the hash. */
export function hexToRgb(hex: string): Rgb {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6];
  return { r: r * 255, g: g * 255, b: b * 255 };
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d) {
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }

  return { h, s: max ? d / max : 0, v: max };
}

/** True for a complete "#rrggbb", which is the only form the game stores. */
export const isHex = (value: string) => /^#?[0-9a-f]{6}$/i.test(value.trim());

export const normaliseHex = (value: string) => {
  const raw = value.trim().replace("#", "").toLowerCase();
  return `#${raw}`;
};

/**
 * How readable white text is on a colour, 0 to 1.
 *
 * The palette runs from white to near-black, so a label printed over a swatch
 * has to pick its own ink. Relative luminance rather than plain brightness:
 * green reads far lighter than blue at the same numeric value.
 */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Black ink over a light colour, white over a dark one. */
export const inkFor = (hex: string) => (luminance(hex) > 0.45 ? "#100f0d" : "#f2f2f2");
