import { CAPS, type CapId } from "../config";
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
    const pocket = document.getElementById("caps")!;

    for (const cap of CAPS) {
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
      pocket.appendChild(slot);
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
