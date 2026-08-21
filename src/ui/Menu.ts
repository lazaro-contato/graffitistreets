import { MOVEMENT_MODES, type MovementMode } from "../config";

export type MenuScreen = "main" | "controls" | "pause";

export type MenuHandlers = {
  onPlay: () => void;
  onResume: () => void;
  onQuit: () => void;
};

type ControlRow = { keys: string; action: string };
type ControlGroup = { title: string; rows: ControlRow[] };

/** Kept here rather than in config: this is UI copy, not tuning. */
const CONTROLS: ControlGroup[] = [
  {
    title: "Movimentação",
    rows: [
      { keys: "WASD / setas", action: "Andar" },
      { keys: "Mouse", action: "Olhar" },
      { keys: "Shift", action: "Corre a pé, desce no voo livre" },
      { keys: "Espaço", action: "Pula a pé, sobe no voo livre" },
      { keys: "Ctrl", action: "Agachar" },
    ],
  },
  {
    title: "Pintura",
    rows: [
      { keys: "Clique esquerdo", action: "Segure para pintar" },
      { keys: "Scroll", action: "Trocar de cor" },
      { keys: "Alt + scroll", action: "Tamanho do spray" },
      { keys: "1 – 0", action: "Escolher uma cor direto" },
      { keys: "I", action: "Abrir a mochila e trocar de cap" },
      { keys: "Ctrl / Cmd + Z", action: "Desfazer o último traço" },
      { keys: "Esc", action: "Pausar" },
    ],
  },
  {
    title: "Vale saber",
    rows: [
      { keys: "Chegue perto", action: "O jato fecha até 1 cm e pega rápido" },
      { keys: "Afaste-se", action: "Abre até 30 cm, mas a tinta sai fraca" },
      { keys: "Fique parado", action: "O muro satura e a tinta escorre" },
    ],
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

    for (const screen of ["main", "controls", "pause"] as const) {
      this.screens.set(
        screen,
        this.root.querySelector<HTMLElement>(`[data-screen="${screen}"]`)!,
      );
    }

    this.root.style.setProperty("--menu-art", `url("${MENU_ART}")`);

    this.buildModeChoices();
    this.buildControls();

    this.root.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")
        ?.dataset.action;
      if (!action) return;

      if (action === "play") this.handlers.onPlay();
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
      button.className = "menu-choice";
      button.innerHTML =
        `<strong>${option.label}</strong><span>${option.hint}</span>`;
      button.addEventListener("click", () => this.setMode(option.id));
      this.modeButtons.set(option.id, button);
      host.appendChild(button);
    }

    this.syncMode();
  }

  private setMode(mode: MovementMode) {
    this.mode = mode;
    this.syncMode();
  }

  private syncMode() {
    for (const [id, button] of this.modeButtons) {
      button.setAttribute("aria-pressed", String(id === this.mode));
    }
  }

  private buildControls() {
    const host = this.root.querySelector("#control-list")!;

    for (const group of CONTROLS) {
      const section = document.createElement("section");
      section.className = "control-group";
      section.innerHTML =
        `<p class="control-title">${group.title}</p>` +
        group.rows
          .map(
            (row) =>
              `<p class="control-row"><kbd>${row.keys}</kbd>` +
              `<span>${row.action}</span></p>`,
          )
          .join("");
      host.appendChild(section);
    }
  }

  show(screen: MenuScreen) {
    // Remember where the controls sheet was opened from, so Back is honest
    // whether it came from the main menu or from a pause.
    if (screen === "controls" && this.current && this.current !== "controls") {
      this.returnTo = this.current;
    }

    this.current = screen;
    this.root.hidden = false;
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
