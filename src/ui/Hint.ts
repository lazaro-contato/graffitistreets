const SEEN_KEY = "graffiti.backpackOpened";

/**
 * The one-off nudge towards the backpack.
 *
 * Kept in localStorage rather than in memory, so it does not come back every
 * time the page reloads. Somebody who has already found the backpack does not
 * need telling again, and a hint that keeps returning stops reading as a hint
 * and starts reading as decoration.
 */
export class BackpackHint {
  private element = document.getElementById("hint")!;

  constructor() {
    this.element.hidden = this.alreadySeen();
  }

  private alreadySeen(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false; // private mode: show it, rather than fail
    }
  }

  /** Called the first time the backpack opens, and harmless after that. */
  dismiss() {
    if (this.element.hidden) return;
    this.element.hidden = true;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Nothing to do. The hint is gone for this visit either way.
    }
  }
}
