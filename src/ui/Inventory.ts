import { CAP_CATEGORIES, capsIn, type CapId } from "../config";
import { CAP_PATHS } from "./CapIcons";
import type { SprayCan } from "../paint/SprayCan";

/**
 * The backpack: where the caps live.
 *
 * It only owns its own panel and slots. Pointer lock is the caller's business —
 * the slots need a real mouse cursor to be clickable, so main.ts releases the
 * lock while the bag is open and takes it back afterwards.
 */
export class Inventory {
  private root: HTMLElement;
  private slots = new Map<CapId, HTMLButtonElement>();

  isOpen = false;

  constructor(
    private can: SprayCan,
    /** Called when a pick should also close the bag. */
    private onPicked: () => void,
  ) {
    this.root = document.getElementById("inventory")!;
    const pockets = document.getElementById("pockets")!;

    // One pocket per category. Built from the data rather than the markup, so
    // adding a cap is still a one-line change in config.
    for (const category of CAP_CATEGORIES) {
      const pocket = document.createElement("section");
      pocket.className = "pocket";
      pocket.innerHTML =
        `<p class="pocket-label">${category.label}</p>` +
        `<p class="pocket-hint">${category.hint}</p>`;

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
          `<span class="cap-name">${cap.label}</span>` +
          `<span class="cap-hint">${cap.hint}</span>`;
        slot.addEventListener("click", () => this.pick(cap.id));
        this.slots.set(cap.id, slot);
        slots.appendChild(slot);
      }

      pocket.appendChild(slots);
      pockets.appendChild(pocket);
    }

    this.syncSelection();
  }

  private pick(id: CapId) {
    this.can.setCap(id);
    this.syncSelection();
    this.onPicked();
  }

  private syncSelection() {
    for (const [id, slot] of this.slots) {
      slot.setAttribute("aria-pressed", String(id === this.can.cap));
    }
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
