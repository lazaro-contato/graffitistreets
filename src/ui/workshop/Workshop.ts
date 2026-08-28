import { CAPS, LOADOUT, PALETTE } from "../../config";
import type { Loadout } from "../../state/Loadout";
import { CapRack } from "./CapRack";
import { CanRack } from "./CanRack";
import { ColourBench } from "./ColourBench";
import { ColourPicker } from "./ColourPicker";
import { PracticeWall } from "./PracticeWall";
import { t } from "../../i18n/i18n";

/** The shortcuts printed along the bottom, as i18n key stems. */
const KEYS = ["cans", "caps", "undo", "clear", "close"] as const;

export type WorkshopHandlers = {
  /** Called when the workshop is dismissed, so the caller can retake the lock. */
  onClose: () => void;
};

/**
 * The can workshop.
 *
 * It owns the screen and nothing else. Each sector — the cap rack, the colour
 * bench, the can rack, the practice wall, the mixer — is its own module with
 * its own element and its own callbacks, and none of them knows another
 * exists. They talk by reporting a want; this class is the only place that
 * turns a want into a change to the loadout, and the only place that reads the
 * loadout back out to the sectors.
 *
 * That is the whole structure, and it is why a change lands everywhere at
 * once: `render()` is called from one subscription, and it hands each sector
 * the state it needs. There is no path where one sector updates and the rest
 * are left showing something that is no longer true.
 *
 * Pointer lock is the caller's business — see main.ts. The workshop needs a
 * real cursor, so the lock is released before it opens and asked for again
 * once it has closed.
 */
export class Workshop {
  private root = document.getElementById("workshop")!;

  private caps: CapRack;
  private colours: ColourBench;
  private cans: CanRack;
  private wall: PracticeWall;
  private picker = new ColourPicker();

  isOpen = false;

  constructor(
    private loadout: Loadout,
    private handlers: WorkshopHandlers,
  ) {
    this.caps = new CapRack({
      onPick: (cap) => this.loadout.editCurrent({ cap }),
    });

    this.colours = new ColourBench({
      onPick: (color) => this.loadout.editCurrent({ color }),
      onMix: () => this.mix(),
    });

    this.cans = new CanRack(this.loadout, {
      onSelectCan: (index) => this.loadout.selectCan(index),
      onSelectPreset: (index) => this.loadout.selectPreset(index),
      onRenamePreset: (index, name) => this.loadout.renamePreset(index, name),
      onReset: () => this.loadout.resetPreset(),
    });

    this.wall = new PracticeWall({
      onDial: (change) => this.loadout.editCurrent(change),
    });

    this.buildKeybar();
    this.loadout.onChange(() => this.render());
    this.bindKeyboard();
    this.render();
  }

  private buildKeybar() {
    const host = document.getElementById("wk-keys")!;
    host.replaceChildren();
    for (const key of KEYS) {
      const item = document.createElement("span");
      item.innerHTML =
        `<kbd>${t(`shop.keys.${key}.key`)}</kbd>` +
        `<span data-i18n="shop.keys.${key}.action">` +
        `${t(`shop.keys.${key}.action`)}</span>`;
      host.appendChild(item);
    }
  }

  // ------------------------------------------------------------------ state

  private render() {
    const can = this.loadout.current;
    this.caps.render(can.cap, can.color);
    this.colours.render(can.color);
    this.cans.render();
    this.wall.render(can, this.loadout.canIndex);
  }

  private async mix() {
    const picked = await this.picker.open(this.loadout.current.color);
    if (picked) this.loadout.editCurrent({ color: picked });
  }

  // ------------------------------------------------------------------ screen

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.hidden = false;
    // The canvas had no box while the screen was hidden, so it can only be
    // measured now. Next frame, once the layout has actually run.
    requestAnimationFrame(() => this.wall.refresh());
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.picker.cancel();
    // The practice wall does not survive the visit. Anything painted on it was
    // a question about a can, and the question is over.
    this.wall.clear();
    this.root.hidden = true;
  }

  // ---------------------------------------------------------------- keyboard

  private bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (!this.isOpen) return;

      // The mixer is modal: while it is up it owns Escape and nothing else
      // here should fire.
      if (this.picker.isOpen) {
        if (event.key === "Escape") this.picker.cancel();
        return;
      }

      // A preset is renamed by typing into its tab, so while a field has the
      // keyboard, keys are text rather than shortcuts.
      if (event.target instanceof HTMLInputElement) return;

      if (event.key === "Escape") {
        event.preventDefault();
        this.handlers.onClose();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // 1-8 reaches straight for a can, exactly as it does in the street. The
      // workshop teaching a different set of keys than the game would be worse
      // than teaching none.
      const digit = parseInt(event.key, 10);
      if (!Number.isNaN(digit) && digit >= 1 && digit <= LOADOUT.CANS) {
        this.loadout.selectCan(digit - 1);
        return;
      }

      const step = event.key === "q" || event.key === "Q" ? -1 : event.key === "e" || event.key === "E" ? 1 : 0;
      if (step !== 0) {
        const index = CAPS.findIndex((cap) => cap.id === this.loadout.current.cap);
        const next = (index + step + CAPS.length) % CAPS.length;
        this.loadout.editCurrent({ cap: CAPS[next].id });
        return;
      }

      if (event.key === "z" || event.key === "Z") this.wall.undo();
      else if (event.key === "x" || event.key === "X") this.wall.clear();
    });
  }

  /** Repaints copy and generated art after the language changes. */
  relocalise() {
    this.caps.invalidate();
    this.buildKeybar();
    this.render();
  }
}

/** Re-exported so main.ts can bound the wheel without importing config twice. */
export { LOADOUT, PALETTE };
