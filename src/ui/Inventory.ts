import { CAP_CATEGORIES, PALETTE, capsIn, type CapId } from "../config";
import { t } from "../i18n/i18n";
import { CAP_PATHS } from "./CapIcons";
import { keyForColour } from "./PaletteKeys";
import type { SprayCan } from "../paint/SprayCan";

/**
 * The backpack: where the caps and the colours live.
 *
 * It only owns its own panel and slots. Pointer lock is the caller's business —
 * the slots need a real mouse cursor to be clickable, so main.ts releases the
 * lock while the bag is open and takes it back afterwards.
 *
 * The colours are here as well as on the HUD, and that is not duplication.
 * While you are playing the pointer is locked, so the palette along the bottom
 * cannot be clicked at all; this is the only place a colour can be *picked*
 * with a mouse rather than remembered as a number.
 */
export class Inventory {
  private root: HTMLElement;
  private slots = new Map<CapId, HTMLButtonElement>();
  private colourSlots: HTMLButtonElement[] = [];

  isOpen = false;

  constructor(
    private can: SprayCan,
    /** Called when a pick should also close the bag. */
    private onPicked: () => void,
  ) {
    this.root = document.getElementById("inventory")!;
    const pockets = document.getElementById("pockets")!;

    // First, because it is the thing people were opening the bag looking for.
    this.buildColours(pockets);

    // One pocket per category. Built from the data rather than the markup, so
    // adding a cap is still a one-line change in config.
    for (const category of CAP_CATEGORIES) {
      const pocket = document.createElement("section");
      pocket.className = "pocket";
      // The keys ride on the markup, so switching language is one pass over
      // the DOM rather than rebuilding every slot.
      pocket.innerHTML =
        `<p class="pocket-label" data-i18n="bag.${category.id}.label">` +
        `${t(`bag.${category.id}.label`)}</p>` +
        `<p class="pocket-hint" data-i18n="bag.${category.id}.hint">` +
        `${t(`bag.${category.id}.hint`)}</p>`;

      const slots = document.createElement("div");
      slots.className = "slots";

      for (const cap of capsIn(category.id)) {
        const slot = document.createElement("button");
        slot.className = "cap-slot";
        slot.type = "button";
        slot.innerHTML =
          `<span class="cap-art">` +
          `<svg viewBox="-62 -62 124 124" aria-hidden="true">` +
          `<path d="${CAP_PATHS[cap.id]}" /></svg>` +
          `</span>` +
          `<span class="cap-name" data-i18n="cap.${cap.id}.label">` +
          `${t(`cap.${cap.id}.label`)}</span>` +
          `<span class="cap-hint" data-i18n="cap.${cap.id}.hint">` +
          `${t(`cap.${cap.id}.hint`)}</span>`;
        slot.addEventListener("click", () => this.pick(cap.id));
        this.slots.set(cap.id, slot);
        slots.appendChild(slot);
      }

      pocket.appendChild(slots);
      pockets.appendChild(pocket);
    }

    // The can is the source of truth, and both this and the palette read it.
    // Without this the bag opens ringing whatever was fitted the last time it
    // was looked at, which is wrong the moment a number key is pressed.
    this.can.onChange(() => this.syncSelection());
    this.syncSelection();
  }

  /**
   * The colour pocket: every colour in the palette, each under the key that
   * picks it without opening the bag at all.
   */
  private buildColours(pockets: HTMLElement) {
    const pocket = document.createElement("section");
    pocket.className = "pocket";
    pocket.innerHTML =
      `<p class="pocket-label" data-i18n="bag.colour.label">` +
      `${t("bag.colour.label")}</p>` +
      `<p class="pocket-hint" data-i18n="bag.colour.hint">` +
      `${t("bag.colour.hint")}</p>`;

    const row = document.createElement("div");
    row.className = "colour-slots";

    PALETTE.forEach((hex, index) => {
      const slot = document.createElement("button");
      slot.className = "colour-slot";
      slot.type = "button";
      slot.title = hex;

      const dot = document.createElement("span");
      dot.className = "colour-dot";
      dot.style.background = hex;
      slot.appendChild(dot);

      const key = keyForColour(index);
      if (key) {
        const label = document.createElement("span");
        label.className = "colour-key";
        label.textContent = key;
        slot.appendChild(label);
      }

      slot.addEventListener("click", () => this.pickColour(hex));
      this.colourSlots.push(slot);
      row.appendChild(slot);
    });

    pocket.appendChild(row);
    pockets.appendChild(pocket);
  }

  private pick(id: CapId) {
    this.can.setCap(id);
    this.onPicked();
  }

  private pickColour(hex: string) {
    this.can.setColor(hex);
    this.onPicked();
  }

  private syncSelection() {
    for (const [id, slot] of this.slots) {
      slot.setAttribute("aria-pressed", String(id === this.can.cap));
    }
    this.colourSlots.forEach((slot, index) =>
      slot.setAttribute("aria-pressed", String(PALETTE[index] === this.can.color)),
    );
  }

  open() {
    this.isOpen = true;
    this.root.hidden = false;
  }

  close() {
    this.isOpen = false;
    this.root.hidden = true;
  }
}
