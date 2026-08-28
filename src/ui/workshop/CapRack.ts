import { CAPS, CAP_BY_ID, SPRAY, type CapDefinition, type CapId } from "../../config";
import { SprayCan } from "../../paint/SprayCan";
import {
  buildSketchStroke,
  paintSketchBase,
  renderSketchStroke,
  type SketchSize,
} from "../../paint/Sketch";
import { t } from "../../i18n/i18n";

/**
 * The sample on a card is a patch of real wall, two metres by one, painted
 * with the real brush. That is the entire justification for the card: a
 * hand-drawn icon drifts the first time a cap is retuned, and then the rack
 * quietly lies about what the paint will do.
 */
const SAMPLE: SketchSize = {
  widthPx: 256,
  heightPx: 128,
  widthMeters: 2,
  heightMeters: 1,
  pixelsPerMeter: 128,
};

/** A representative wheel setting: not the widest, not the tightest. */
const SAMPLE_SIZE = 0.62;

/** The squiggle every sample is painted with, in normalised coordinates. */
const SAMPLE_PATH = [
  { u: 0.12, v: 0.34 },
  { u: 0.34, v: 0.68 },
  { u: 0.58, v: 0.3 },
  { u: 0.88, v: 0.62 },
];

/**
 * Pip scales, worked out from the cap table rather than written down.
 *
 * Six pips have to mean something, and what they mean is "compared with the
 * other caps". Deriving the ends from CAPS is what keeps that true when a cap
 * is added or retuned — a hand-set maximum would silently stop being the
 * maximum the moment somebody added a wider cone.
 */
function scaleOf(pick: (cap: CapDefinition) => number) {
  const values = CAPS.map(pick);
  return { min: Math.min(...values), max: Math.max(...values) };
}

const SCALES = {
  spread: scaleOf((cap) => cap.size),
  flow: scaleOf((cap) => cap.flow),
  grain: scaleOf((cap) => cap.grain),
};

/** Maps a cap's value onto 1..6 pips, or 0..6 where none is meaningful. */
function pips(value: number, scale: { min: number; max: number }, floor: number) {
  if (scale.max === scale.min) return 6;
  const t = (value - scale.min) / (scale.max - scale.min);
  return Math.max(floor, Math.round(floor + t * (6 - floor)));
}

export type CapRackHandlers = {
  onPick: (cap: CapId) => void;
};

/**
 * The cap rack: one card per cap, and a detail strip for the fitted one.
 *
 * It renders from `CAPS` and knows nothing about the loadout beyond the two
 * things it is told — which cap is fitted and what colour to paint the samples
 * in. Everything it wants to change, it asks for through `onPick`.
 */
export class CapRack {
  private grid = document.getElementById("wk-caps")!;
  private detail = document.getElementById("wk-cap-detail")!;
  private cards = new Map<CapId, { button: HTMLButtonElement; canvas: HTMLCanvasElement }>();

  /** A can used purely as a calculator, so samples use the game's own maths. */
  private gauge = new SprayCan();

  private fitted: CapId = CAPS[0].id;
  private colour = "#ffffff";

  constructor(private handlers: CapRackHandlers) {
    this.gauge.setSizing("fixed");
    this.gauge.sizeMultiplier = SAMPLE_SIZE;
    this.build();
  }

  private build() {
    this.grid.setAttribute("aria-label", t("shop.caps.title"));

    for (const cap of CAPS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wk-cap";

      const canvas = document.createElement("canvas");
      canvas.className = "wk-cap__sample";
      canvas.width = SAMPLE.widthPx;
      canvas.height = SAMPLE.heightPx;
      button.appendChild(canvas);

      const name = document.createElement("span");
      name.className = "wk-cap__name";
      name.dataset.i18n = `cap.${cap.id}.label`;
      name.textContent = t(`cap.${cap.id}.label`);
      button.appendChild(name);

      const tag = document.createElement("span");
      tag.className = "wk-cap__tag";
      tag.dataset.i18n = `cap.category.${cap.category}`;
      tag.textContent = t(`cap.category.${cap.category}`);
      button.appendChild(tag);

      button.addEventListener("click", () => this.handlers.onPick(cap.id));
      this.grid.appendChild(button);
      this.cards.set(cap.id, { button, canvas });
    }
  }

  /**
   * Repaints every card and the detail strip.
   *
   * The samples are repainted on a colour change too, and that is the point of
   * doing it here rather than once at build time: a rack of white squiggles
   * tells you nothing about how the cap you are about to fit will look in the
   * colour you have loaded.
   */
  render(fitted: CapId, colour: string) {
    const colourChanged = colour !== this.colour;
    this.fitted = fitted;
    this.colour = colour;

    for (const [id, card] of this.cards) {
      card.button.setAttribute("aria-pressed", String(id === fitted));
      if (colourChanged || !card.canvas.dataset.painted) {
        this.paintSample(card.canvas, id);
        card.canvas.dataset.painted = "1";
      }
    }

    this.renderDetail();
  }

  private paintSample(canvas: HTMLCanvasElement, capId: CapId) {
    const ctx = canvas.getContext("2d")!;
    // Seeded from the cap, so a repaint on a colour change reproduces the same
    // concrete underneath instead of reshuffling the whole rack.
    paintSketchBase(ctx, SAMPLE, capId.length * 31 + capId.charCodeAt(0));

    this.gauge.setCap(capId);
    const stroke = buildSketchStroke(
      capId,
      this.colour,
      SAMPLE_PATH,
      // Distance is ignored in fixed sizing, so this is the cap's own width at
      // the sample wheel setting and nothing else.
      this.gauge.radiusAt(0),
      this.gauge.alphaAt(0),
      SAMPLE,
    );
    renderSketchStroke(ctx, SAMPLE, stroke);
  }

  private renderDetail() {
    const cap = CAP_BY_ID.get(this.fitted)!;
    const rows: [string, number][] = [
      ["spread", pips(cap.size, SCALES.spread, 1)],
      ["flow", pips(cap.flow, SCALES.flow, 1)],
      ["grain", pips(cap.grain, SCALES.grain, 0)],
    ];

    this.detail.innerHTML =
      `<div class="wk-capdetail__txt">` +
      `<h3 data-i18n="cap.${cap.id}.label">${t(`cap.${cap.id}.label`)}</h3>` +
      `<p data-i18n="cap.${cap.id}.hint">${t(`cap.${cap.id}.hint`)}</p>` +
      `</div>` +
      `<div class="wk-stats">` +
      rows
        .map(
          ([key, value]) =>
            `<div class="wk-stat">` +
            `<span class="wk-stat__label" data-i18n="shop.stat.${key}">` +
            `${t(`shop.stat.${key}`)}</span>` +
            `<span class="wk-pips" role="img" aria-label="${t(
              `shop.stat.${key}`,
            )}: ${value}/6">` +
            Array.from(
              { length: 6 },
              (_, i) => `<i class="wk-pip${i < value ? " on" : ""}"></i>`,
            ).join("") +
            `</span></div>`,
        )
        .join("") +
      `</div>` +
      // Range only drives a cone. Saying so on the card that is fitted is the
      // cheapest place to teach the single most important rule in the game.
      `<p class="wk-capdetail__range" data-i18n="shop.range.${cap.category}">` +
      `${t(`shop.range.${cap.category}`)}</p>`;
  }

  /** Forces the samples to be repainted, e.g. after a language change. */
  invalidate() {
    for (const card of this.cards.values()) delete card.canvas.dataset.painted;
  }
}

/** Exposed for the practice wall, which wants the same wheel-setting range. */
export const SIZE_RANGE = { min: SPRAY.MIN_SIZE, max: SPRAY.MAX_SIZE };
