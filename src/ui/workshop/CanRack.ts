import { CAP_BY_ID, LOADOUT } from "../../config";
import type { Loadout } from "../../state/Loadout";
import { inkFor } from "./ColourMath";
import { t } from "../../i18n/i18n";

export type CanRackHandlers = {
  onSelectCan: (index: number) => void;
  onSelectPreset: (index: number) => void;
  onRenamePreset: (index: number, name: string) => void;
  onReset: () => void;
};

/**
 * The rack: four presets across the top, eight cans below.
 *
 * This is the only sector that is a view onto stored data rather than onto the
 * catalogue, so it is the only one that rebuilds from the loadout on every
 * change. Eight cans is small enough that rebuilding the row outright is
 * simpler and less error-prone than reconciling it, and nothing here is
 * expensive enough to notice.
 *
 * A preset is renamed by typing into its tab. There is no rename button and no
 * dialog: four tabs, each of which is its own label, is the whole feature.
 */
export class CanRack {
  private presetHost = document.getElementById("wk-presets")!;
  private canHost = document.getElementById("wk-cans")!;

  constructor(
    private loadout: Loadout,
    private handlers: CanRackHandlers,
  ) {
    this.presetHost.setAttribute("aria-label", t("shop.presets"));
    this.canHost.setAttribute("aria-label", t("shop.cans.title"));

    document
      .getElementById("wk-reset")!
      .addEventListener("click", () => this.handlers.onReset());
  }

  render() {
    this.renderPresets();
    this.renderCans();
  }

  private renderPresets() {
    this.presetHost.replaceChildren();

    this.loadout.presetList.forEach((preset, index) => {
      const tab = document.createElement("div");
      tab.className = "wk-preset";
      tab.setAttribute("aria-pressed", String(index === this.loadout.presetIndex));

      // Selecting is a click on the tab; renaming is typing in the field. Both
      // live on the same element so there is nothing extra to discover.
      const field = document.createElement("input");
      field.className = "wk-preset__name";
      field.value = preset.name;
      field.maxLength = 12;
      field.spellcheck = false;
      field.setAttribute("aria-label", `${t("shop.preset")} ${index + 1}`);

      field.addEventListener("focus", () => {
        this.handlers.onSelectPreset(index);
        field.select();
      });
      field.addEventListener("change", () =>
        this.handlers.onRenamePreset(index, field.value),
      );
      field.addEventListener("keydown", (event) => {
        // Enter commits and hands the keyboard back, so the next number key
        // reaches the workshop instead of being typed into the name.
        if (event.key === "Enter") field.blur();
        if (event.key === "Escape") {
          field.value = preset.name;
          field.blur();
        }
        event.stopPropagation();
      });

      tab.appendChild(field);
      this.presetHost.appendChild(tab);
    });
  }

  private renderCans() {
    this.canHost.replaceChildren();

    this.loadout.cans.forEach((can, index) => {
      const cap = CAP_BY_ID.get(can.cap)!;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wk-can";
      button.setAttribute("aria-pressed", String(index === this.loadout.canIndex));
      button.style.setProperty("--paint", can.color);
      button.style.setProperty("--ink", inkFor(can.color));
      button.title = `${index + 1} · ${t(`cap.${can.cap}.label`)} · ${can.color}`;

      const key = document.createElement("span");
      key.className = "wk-can__key";
      key.textContent = String(index + 1);

      const body = document.createElement("span");
      body.className = "wk-can__body";

      const name = document.createElement("span");
      name.className = "wk-can__cap";
      name.textContent = t(`cap.${cap.id}.label`);

      body.appendChild(name);
      button.append(key, body);
      button.addEventListener("click", () => this.handlers.onSelectCan(index));
      this.canHost.appendChild(button);
    });
  }
}

/** Cans in a preset, for anything that needs to bound a key or a wheel step. */
export const CAN_COUNT = LOADOUT.CANS;
