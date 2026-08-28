import { NEON_PALETTE, PALETTE, isNeon } from "../../config";
import { inkFor } from "./ColourMath";
import { t } from "../../i18n/i18n";

export type ColourBenchHandlers = {
  onPick: (hex: string) => void;
  /** Opens the mixer. Resolves through the workshop, not here. */
  onMix: () => void;
};

/** The two families, in the order the bench lays them out. */
const GROUPS = [
  { key: "stock", colours: PALETTE, mixer: true },
  { key: "neon", colours: NEON_PALETTE, mixer: false },
] as const;

/**
 * The colour bench: the stock colours, the neon ones, and a way to mix anything
 * else.
 *
 * Neon is its own row with its own heading rather than more swatches on the
 * end, because it is not more colours — it is a different material. Neon paint
 * is written into the wall's glow map and lights itself; ordinary paint waits
 * for a lamp. Somebody choosing between them is choosing between two things,
 * and a row that ran straight on would hide that.
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
    this.host.replaceChildren();
    this.swatches.clear();

    for (const group of GROUPS) {
      const section = document.createElement("div");
      section.className = "wk-swgroup";
      section.dataset.group = group.key;
      section.setAttribute("aria-label", t(`shop.colour.${group.key}`));

      const label = document.createElement("span");
      label.className = "wk-swgroup__label";
      label.dataset.i18n = `shop.colour.${group.key}`;
      label.textContent = t(`shop.colour.${group.key}`);

      const row = document.createElement("div");
      row.className = "wk-swrow";

      for (const hex of group.colours) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wk-sw";
        if (isNeon(hex)) button.classList.add("wk-sw--neon");
        button.style.background = hex;
        // The halo behind a neon swatch is the colour itself, so the bench
        // shows the difference rather than only naming it.
        button.style.setProperty("--paint", hex);
        button.title = hex;
        button.setAttribute("aria-label", hex);
        button.addEventListener("click", () => this.handlers.onPick(hex));
        row.appendChild(button);
        this.swatches.set(hex.toLowerCase(), button);
      }

      if (group.mixer) row.appendChild(this.buildMixer());

      section.append(label, row);
      this.host.appendChild(section);
    }
  }

  private buildMixer() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wk-sw wk-sw--mix";
    button.title = t("shop.mix.title");
    button.setAttribute("aria-label", t("shop.mix.title"));
    button.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7">' +
      '<path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z"/></svg>';
    button.addEventListener("click", () => this.handlers.onMix());
    this.mixButton = button;
    return button;
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

  /** Rebuilds after a language change, since the group headings are copy. */
  relocalise() {
    this.build();
  }
}
