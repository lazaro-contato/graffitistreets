import { MOVEMENT_MODES, type MovementMode } from "../config";
import { LOCALES, type Locale } from "../i18n/strings";
import { t, getLocale, setLocale } from "../i18n/i18n";

export type MenuScreen = "main" | "modes" | "controls" | "pause";

/** Screens reached from another one, which a Back has to return from. */
const SUB_SCREENS = new Set<MenuScreen>(["modes", "controls"]);

export type MenuHandlers = {
  onPlay: () => void;
  onResume: () => void;
  onQuit: () => void;
};

/** Keys, not words: the sheet is rewritten in place when the language changes. */
const CONTROLS: { title: string; rows: string[] }[] = [
  {
    title: "controls.moving.title",
    rows: ["walk", "look", "shift", "space", "crouch"],
  },
  {
    title: "controls.painting.title",
    rows: ["spray", "colour", "size", "palette", "bag", "photo", "undo", "pause"],
  },
  {
    title: "controls.knowing.title",
    rows: ["near", "far", "hold"],
  },
];

/**
 * Menu artwork. Declared here rather than in the stylesheet so the loader can
 * preload the very same file — two copies of the path would drift, and the
 * menu would flash in unpainted.
 */
export const MENU_ART = "/menu-bg.jpg";

/**
 * The menu: the main screen, the pause screen, and the controls sheet shared
 * by both.
 *
 * It owns nothing but its own DOM and which screen is up. Pointer lock is the
 * caller's business — see main.ts, where the lock state and this are kept in
 * step.
 */
export class Menu {
  private root: HTMLElement;
  private screens = new Map<MenuScreen, HTMLElement>();
  private modeButtons = new Map<MovementMode, HTMLButtonElement>();

  /** Where the controls sheet goes back to. */
  private returnTo: MenuScreen = "main";

  /** Null while the player is in the street. */
  current: MenuScreen | null = null;

  mode: MovementMode = "walk";

  constructor(private handlers: MenuHandlers) {
    this.root = document.getElementById("menu")!;

    for (const screen of ["main", "modes", "controls", "pause"] as const) {
      this.screens.set(
        screen,
        this.root.querySelector<HTMLElement>(`[data-screen="${screen}"]`)!,
      );
    }

    this.root.style.setProperty("--menu-art", `url("${MENU_ART}")`);

    this.buildModeChoices();
    this.buildLanguageChoices();
    this.buildControls();

    this.root.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")
        ?.dataset.action;
      if (!action) return;

      // Play does not start anything: it asks how you want to move first.
      if (action === "play") this.show("modes");
      else if (action === "resume") this.handlers.onResume();
      else if (action === "quit") this.handlers.onQuit();
      else if (action === "controls") this.show("controls");
      else if (action === "back") this.back();
    });
  }

  get isOpen() {
    return this.current !== null;
  }

  private buildModeChoices() {
    const host = this.root.querySelector("#mode-choices")!;

    for (const option of MOVEMENT_MODES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mode-card";
      button.innerHTML =
        `<strong data-i18n="mode.${option.id}.label">` +
        `${t(`mode.${option.id}.label`)}</strong>` +
        `<span data-i18n="mode.${option.id}.hint">` +
        `${t(`mode.${option.id}.hint`)}</span>`;
      button.addEventListener("click", () => this.pick(option.id));
      this.modeButtons.set(option.id, button);
      host.appendChild(button);
    }

    this.syncMode();
  }

  /** A mode card is the play button: it picks the mode and goes straight in. */
  private pick(mode: MovementMode) {
    this.mode = mode;
    this.syncMode();
    this.handlers.onPlay();
  }

  private syncMode() {
    for (const [id, button] of this.modeButtons) {
      button.setAttribute("aria-pressed", String(id === this.mode));
    }
  }

  /**
   * The language picker. Its own labels are the language names themselves, so
   * they are never translated — "Português" reads as Português in English too,
   * and a picker written in a language you cannot read is no use.
   */
  private buildLanguageChoices() {
    const host = this.root.querySelector("#language-choices")!;
    const buttons = new Map<Locale, HTMLButtonElement>();

    const sync = () => {
      for (const [id, button] of buttons) {
        button.setAttribute("aria-pressed", String(id === getLocale()));
      }
    };

    for (const option of LOCALES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.textContent = option.label;
      button.addEventListener("click", () => {
        setLocale(option.id);
        sync();
      });
      buttons.set(option.id, button);
      host.appendChild(button);
    }

    sync();
  }

  private buildControls() {
    const host = this.root.querySelector("#control-list")!;

    for (const group of CONTROLS) {
      const section = document.createElement("section");
      section.className = "control-group";
      section.innerHTML =
        `<p class="control-title" data-i18n="${group.title}">` +
        `${t(group.title)}</p>` +
        group.rows
          .map((row) => {
            const key = `controls.${row}.key`;
            const action = `controls.${row}.action`;
            return (
              `<p class="control-row">` +
              `<kbd data-i18n="${key}">${t(key)}</kbd>` +
              `<span data-i18n="${action}">${t(action)}</span></p>`
            );
          })
          .join("");
      host.appendChild(section);
    }
  }

  show(screen: MenuScreen) {
    // Remember where a sub-screen was opened from, so Back is honest whether
    // it came from the main menu or from a pause.
    if (SUB_SCREENS.has(screen) && this.current && !SUB_SCREENS.has(this.current)) {
      this.returnTo = this.current;
    }

    this.current = screen;
    this.root.hidden = false;
    // Exposed so the stylesheet can widen the column for the controls sheet.
    this.root.dataset.screen = screen;
    // The artwork belongs to the front door. Once the player is in and has
    // paused, the street behind the scrim is the better backdrop — and the
    // controls sheet keeps whichever of the two it was opened over.
    const atFrontDoor =
      screen === "main" || (screen === "controls" && this.returnTo === "main");
    this.root.dataset.art = atFrontDoor ? "on" : "off";
    for (const [id, element] of this.screens) element.hidden = id !== screen;
  }

  back() {
    this.show(this.returnTo);
  }

  hide() {
    this.current = null;
    this.root.hidden = true;
  }
}
