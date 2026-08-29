import {
  MOVEMENT_MODES,
  BRUSH_SIZINGS,
  DEFAULT_BRUSH_SIZING,
  TIMES_OF_DAY,
  DEFAULT_TIME_OF_DAY,
  WALL_PHOTO,
  SIDES,
  type BrushSizing,
  type MovementMode,
  type Side,
  type SurfaceEntry,
  type TimeOfDay,
} from "../config";
import { LOCALES, type Locale } from "../i18n/strings";
import { t, getLocale, setLocale, onLocaleChange } from "../i18n/i18n";

export type MenuScreen =
  | "main"
  | "modes"
  | "settings"
  | "controls"
  | "pause";

const BRUSH_KEY = "graffiti.brushSizing";
const TIME_KEY = "graffiti.timeOfDay";

function storedTimeOfDay(): TimeOfDay {
  try {
    const saved = localStorage.getItem(TIME_KEY);
    if (saved === "day" || saved === "night") return saved;
  } catch {
    // private mode — fall through to the default
  }
  return DEFAULT_TIME_OF_DAY;
}

function storedBrushSizing(): BrushSizing {
  try {
    const saved = localStorage.getItem(BRUSH_KEY);
    if (saved === "auto" || saved === "fixed") return saved;
  } catch {
    // private mode — fall through to the default
  }
  return DEFAULT_BRUSH_SIZING;
}

/** Screens reached from another one, which a Back has to return from. */
const SUB_SCREENS = new Set<MenuScreen>(["modes", "settings", "controls"]);

/** What the wall picker needs to draw itself: the list, and what is on now. */
export type WallDressing = {
  catalogue: readonly SurfaceEntry[];
  /**
   * One surface, both walls. Mutated by the menu as choices are made, so it
   * survives a reopen.
   *
   * The engine still dresses each side separately and always will — a wall
   * somebody dropped a photo on is one side, not two. What is gone is asking
   * the player to make that distinction: you are picking a street, and a street
   * has the same walls on both sides of it.
   */
  current: string;
  /**
   * The tile size of the photo on each wall, or null where there is none.
   *
   * A photo is not a place and never will be — it is one person's file on one
   * person's machine, dropped on one wall rather than on a street. So it sits
   * beside the slug as an override, not inside the catalogue as an entry.
   */
  photo: Record<Side, number | null>;
};

export type MenuHandlers = {
  onPlay: () => void;
  /**
   * A wall was dressed in a different surface.
   *
   * The menu only reports the choice. Fetching the files and replaying the
   * journal onto the new base coat is the caller's, in main.ts, because both
   * the wall system and the stroke store live below this.
   */
  onWallSurface: (slug: string) => void;
  /** Fires on every change, including the stored one restored at start-up. */
  onTimeOfDay: (time: TimeOfDay) => void;
  /** The tile size of a dropped photo was dragged to a new value. */
  onPhotoTile: (side: Side, tileMeters: number) => void;
  /** Take the dropped photo off this wall and put the street back. */
  onPhotoRemoved: (side: Side) => void;
  /** Fires on every change, including the stored one restored at start-up. */
  onBrushSizing: (sizing: BrushSizing) => void;
  onResume: () => void;
  /** The can workshop, reached from the pause screen as well as from the street. */
  onWorkshop: () => void;
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
 * Who a surface belongs to, on one line under its row.
 *
 * It is shown rather than tucked into a tooltip because ASSETS.md makes a point
 * of this project saying who owns what, and a wall somebody sent in is exactly
 * the case where that matters most.
 */
/**
 * The group a surface with no city belongs to.
 *
 * A sentinel rather than null so the grouping is one Map keyed by string, and
 * so the shipped concrete — which is from nowhere, because it is a texture
 * library's — has a place to sit at the front of the list.
 */
const NO_CITY = "";

function cityOf(entry: SurfaceEntry | undefined): string {
  return entry?.city ?? NO_CITY;
}

/**
 * The catalogue as cities, each holding its places, in manifest order.
 *
 * Insertion order is the manifest's order, which is the contributor's, so a
 * city stays where whoever added it put it.
 */
function groupByCity(
  catalogue: readonly SurfaceEntry[],
): Map<string, SurfaceEntry[]> {
  const groups = new Map<string, SurfaceEntry[]>();
  for (const entry of catalogue) {
    const key = cityOf(entry);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}

/**
 * How wide one tile of a dropped photo is.
 *
 * It stands where a credit would, because a photo has none to give: it is the
 * player's own file. The metre is the unit they would have measured that wall
 * in, if they had.
 */
function tileSize(tileMeters: number): string {
  return `${tileMeters.toFixed(1)} m`;
}

function creditLine(entry: SurfaceEntry): string {
  const place = [entry.city, entry.country].filter(Boolean).join(", ");
  return [place, entry.author, entry.licence].filter(Boolean).join(" · ");
}

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

  /** Restored from the last visit: a preference, not a per-session choice. */
  brushSizing: BrushSizing = storedBrushSizing();

  /** Same: somebody who paints at night wants to come back to night. */
  timeOfDay: TimeOfDay = storedTimeOfDay();

  constructor(
    private handlers: MenuHandlers,
    private walls: WallDressing,
  ) {
    this.root = document.getElementById("menu")!;

    for (const screen of [
      "main",
      "modes",
      "settings",
      "controls",
      "pause",
    ] as const) {
      this.screens.set(
        screen,
        this.root.querySelector<HTMLElement>(`[data-screen="${screen}"]`)!,
      );
    }

    this.root.style.setProperty("--menu-art", `url("${MENU_ART}")`);

    this.buildModeChoices();
    this.buildBrushChoices();
    this.buildTimeChoices();
    this.buildWallChoices();
    this.buildLanguageChoices();
    onLocaleChange(() => this.refreshWalls());
    this.buildControls();

    this.root.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")
        ?.dataset.action;
      if (!action) return;

      // Play does not start anything: it asks how you want to move first.
      if (action === "play") this.show("modes");
      else if (action === "resume") this.handlers.onResume();
      else if (action === "workshop") this.handlers.onWorkshop();
      else if (action === "quit") this.handlers.onQuit();
      else if (action === "controls") this.show("controls");
      else if (action === "settings") this.show("settings");
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
   * How the spray picks its width. Unlike the mode cards this only sets
   * something, so the chosen one is filled rather than merely edged.
   */
  private buildBrushChoices() {
    const host = this.root.querySelector("#brush-choices")!;
    const buttons = new Map<BrushSizing, HTMLButtonElement>();

    const choose = (sizing: BrushSizing) => {
      this.brushSizing = sizing;
      try {
        localStorage.setItem(BRUSH_KEY, sizing);
      } catch {
        // The choice still holds for this visit.
      }
      for (const [id, button] of buttons) {
        button.setAttribute("aria-pressed", String(id === sizing));
      }
      this.handlers.onBrushSizing(sizing);
    };

    for (const option of BRUSH_SIZINGS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mode-card";
      button.innerHTML =
        `<strong data-i18n="brush.${option.id}.label">` +
        `${t(`brush.${option.id}.label`)}</strong>` +
        `<span data-i18n="brush.${option.id}.hint">` +
        `${t(`brush.${option.id}.hint`)}</span>`;
      button.addEventListener("click", () => choose(option.id));
      buttons.set(option.id, button);
      host.appendChild(button);
    }

    choose(this.brushSizing);
  }

  /**
   * The wall picker: which surface dresses each side of the street.
   *
   * One row per side rather than one choice for both, because the two walls
   * were always independent — a photographed wall facing a bare one is a
   * legitimate thing to want, and forcing them to match would take that away.
   *
   * Titles, cities and author names are data, not copy, so none of it goes
   * through the translation table. A surface contributed from São Paulo says
   * São Paulo in English too.
   */
  /**
   * Night or day.
   *
   * Cards rather than pills, like the brush sizing above it, because each one
   * needs a line saying what it changes — the difference is not only that it
   * gets brighter, and somebody choosing day should know the neon goes with it.
   */
  private buildTimeChoices() {
    const host = this.root.querySelector("#time-choices")!;
    const buttons = new Map<TimeOfDay, HTMLButtonElement>();

    const choose = (time: TimeOfDay) => {
      this.timeOfDay = time;
      try {
        localStorage.setItem(TIME_KEY, time);
      } catch {
        // The choice still holds for this visit.
      }
      for (const [id, button] of buttons) {
        button.setAttribute("aria-pressed", String(id === time));
      }
      this.handlers.onTimeOfDay(time);
    };

    for (const option of TIMES_OF_DAY) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mode-card";
      button.innerHTML =
        `<strong data-i18n="time.${option.id}.label">` +
        `${t(`time.${option.id}.label`)}</strong>` +
        `<span data-i18n="time.${option.id}.hint">` +
        `${t(`time.${option.id}.hint`)}</span>`;
      button.addEventListener("click", () => choose(option.id));
      buttons.set(option.id, button);
      host.appendChild(button);
    }

    choose(this.timeOfDay);
  }

  /**
   * Redraws the wall picker.
   *
   * The surface descriptions are data rather than copy, so the pass over
   * data-i18n never reaches them — switching language has to rebuild the rows
   * or the sentence stays in the language nobody just chose.
   */
  refreshWalls() {
    this.buildWallChoices();
  }

  private buildWallChoices() {
    const host = this.root.querySelector("#wall-choices")!;
    host.replaceChildren();

    // City first, then the place in it. Fifteen pills in one row was a list of
    // textures; two rows is a list of streets, which is what somebody is
    // actually looking for.
    const groups = groupByCity(this.walls.catalogue);

    const cityRow = document.createElement("div");
    cityRow.className = "pill-row wall-cities";

    const placeRow = document.createElement("div");
    placeRow.className = "pill-row wall-places";

    const credit = document.createElement("p");
    credit.className = "wall-credit";

    const about = document.createElement("p");
    about.className = "wall-about";

    // Photos live under the street, not among the places. A photo is an
    // override on one wall — it is not somewhere you can go, so putting it in
    // the same row as Rio and Stockholm would be a lie about what it is.
    const photos = document.createElement("div");
    photos.className = "wall-photos";

    /** Which city's places are listed. Not which wall is dressed. */
    let openCity = cityOf(
      this.walls.catalogue.find((one) => one.slug === this.walls.current),
    );

    const cityButtons = new Map<string, HTMLButtonElement>();

    const renderPlaces = () => {
      placeRow.replaceChildren();
      for (const entry of groups.get(openCity) ?? []) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pill";
        button.textContent = entry.title;
        button.setAttribute(
          "aria-pressed",
          String(entry.slug === this.walls.current),
        );
        button.addEventListener("click", () => {
          const photographed = SIDES.some(
            (side) => this.walls.photo[side] !== null,
          );
          if (!photographed && this.walls.current === entry.slug) return;
          // Choosing a street dresses both walls, so it also takes off any
          // photo covering one of them. A wall cannot show two things.
          for (const side of SIDES) {
            if (this.walls.photo[side] === null) continue;
            this.walls.photo[side] = null;
            this.handlers.onPhotoRemoved(side);
          }
          this.walls.current = entry.slug;
          sync();
          this.handlers.onWallSurface(entry.slug);
        });
        placeRow.appendChild(button);
      }
    };

    /**
     * The photo overrides, one block per wall that carries one.
     *
     * Rebuilt rather than toggled: a photo arrives by being dropped out in the
     * street, so this can go from nothing to two blocks between two openings of
     * the settings, and there is no state worth keeping between them.
     */
    const renderPhotos = () => {
      photos.replaceChildren();

      for (const side of SIDES) {
        const metres = this.walls.photo[side];
        if (metres === null) continue;

        const block = document.createElement("div");

        const head = document.createElement("div");
        head.className = "wall-photo-head";

        const label = document.createElement("p");
        label.className = "wall-label";
        label.dataset.i18n = `wall.side.${side}`;
        label.textContent = t(`wall.side.${side}`);

        const size = document.createElement("span");
        size.className = "wall-credit";

        const drop = document.createElement("button");
        drop.type = "button";
        drop.className = "wall-photo-drop";
        drop.dataset.i18n = "wall.photo.remove";
        drop.textContent = t("wall.photo.remove");
        drop.addEventListener("click", () => {
          this.walls.photo[side] = null;
          this.handlers.onPhotoRemoved(side);
          sync();
        });

        head.append(label, drop);

        const tile = document.createElement("input");
        tile.type = "range";
        tile.className = "wall-tile";
        tile.min = String(WALL_PHOTO.MIN_TILE_METERS);
        tile.max = String(WALL_PHOTO.MAX_TILE_METERS);
        tile.step = "0.1";
        tile.value = String(metres);
        tile.setAttribute("aria-label", t("wall.photo.tile"));
        size.textContent = tileSize(metres);
        tile.addEventListener("input", () => {
          const next = Number(tile.value);
          this.walls.photo[side] = next;
          size.textContent = tileSize(next);
          this.handlers.onPhotoTile(side, next);
        });

        block.append(head, tile, size);
        photos.appendChild(block);
      }

      photos.hidden = photos.childElementCount === 0;
    };

    const sync = () => {
      for (const [name, button] of cityButtons) {
        button.setAttribute("aria-pressed", String(name === openCity));
      }
      renderPlaces();
      renderPhotos();

      const entry = this.walls.catalogue.find(
        (one) => one.slug === this.walls.current,
      );
      credit.textContent = entry ? creditLine(entry) : "";
      about.textContent = entry?.description?.[getLocale()] ?? "";
      about.hidden = about.textContent === "";
    };

    for (const name of groups.keys()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.textContent = name === NO_CITY ? t("wall.city.default") : name;
      button.addEventListener("click", () => {
        // Opening a city lists its walls. It does not dress anything — that
        // would make browsing destructive, and there is no undo for a wall.
        if (openCity === name) return;
        openCity = name;
        sync();
      });
      cityButtons.set(name, button);
      cityRow.appendChild(button);
    }

    const cityLabel = document.createElement("p");
    cityLabel.className = "wall-label";
    cityLabel.dataset.i18n = "wall.city";
    cityLabel.textContent = t("wall.city");

    const placeLabel = document.createElement("p");
    placeLabel.className = "wall-label";
    placeLabel.dataset.i18n = "wall.place";
    placeLabel.textContent = t("wall.place");

    host.append(
      cityLabel,
      cityRow,
      placeLabel,
      placeRow,
      credit,
      about,
      photos,
    );
    sync();
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
