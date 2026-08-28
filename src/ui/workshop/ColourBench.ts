import { PALETTE } from "../../config";
import { inkFor } from "./ColourMath";
import { t } from "../../i18n/i18n";

export type ColourBenchHandlers = {
  onPick: (hex: string) => void;
  /** Opens the mixer. Resolves through the workshop, not here. */
  onMix: () => void;
};

/**
 * The colour bench: the ten stock colours, plus a way to mix anything else.
 *
 * The stock ten are the ones the game shipped with and the ones a piece is
 * most likely to be painted in, so they stay a single click. A mixed colour is
 * a deliberate act, so it is a button that opens a dialog rather than a
 * gradient somebody can knock with an elbow.
 */
export class ColourBench {
  private host = document.getElementById("wk-swatches")!;
  private readout = document.getElementById("wk-hex")!;
  private swatches = new Map<string, HTMLButtonElement>();
  private mixButton!: HTMLButtonElement;

  constructor(private handlers: ColourBenchHandlers) {
    this.build();
  }

  private build() {
    this.host.setAttribute("aria-label", t("shop.colour.title"));

    for (const hex of PALETTE) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wk-sw";
      button.style.background = hex;
      button.title = hex;
      button.setAttribute("aria-label", hex);
      button.addEventListener("click", () => this.handlers.onPick(hex));
      this.host.appendChild(button);
      this.swatches.set(hex.toLowerCase(), button);
    }

    this.mixButton = document.createElement("button");
    this.mixButton.type = "button";
    this.mixButton.className = "wk-sw wk-sw--mix";
    this.mixButton.dataset.i18nTitle = "shop.mix.title";
    this.mixButton.title = t("shop.mix.title");
    this.mixButton.setAttribute("aria-label", t("shop.mix.title"));
    this.mixButton.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7">' +
      '<path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z"/></svg>';
    this.mixButton.addEventListener("click", () => this.handlers.onMix());
    this.host.appendChild(this.mixButton);
  }

  render(colour: string) {
    const current = colour.toLowerCase();
    let stock = false;

    for (const [hex, button] of this.swatches) {
      const on = hex === current;
      if (on) stock = true;
      button.setAttribute("aria-pressed", String(on));
    }

    // A mixed colour has no swatch to ring, so the mixer button becomes the
    // swatch: it shows what is loaded, and marks itself as the active choice.
    this.mixButton.setAttribute("aria-pressed", String(!stock));
    this.mixButton.style.setProperty("--mixed", stock ? "" : current);
    this.mixButton.style.color = stock ? "" : inkFor(current);

    this.readout.textContent = current.toUpperCase();
  }
}
