/**
 * A nudge shown until it has been acted on, then never again.
 *
 * Kept in localStorage rather than in memory, so it does not come back every
 * time the page reloads. Somebody who has already found the backpack does not
 * need telling again, and a hint that keeps returning stops reading as a hint
 * and starts reading as decoration.
 */
export class OneTimeHint {
  private element: HTMLElement;

  constructor(
    elementId: string,
    private storageKey: string,
  ) {
    this.element = document.getElementById(elementId)!;
    this.element.hidden = this.alreadySeen();
  }

  private alreadySeen(): boolean {
    try {
      return localStorage.getItem(this.storageKey) === "1";
    } catch {
      return false; // private mode: show it, rather than fail
    }
  }

  /** Called the first time the thing is done, and harmless after that. */
  dismiss() {
    if (this.element.hidden) return;
    this.element.hidden = true;
    try {
      localStorage.setItem(this.storageKey, "1");
    } catch {
      // Nothing to do. The hint is gone for this visit either way.
    }
  }
}

/**
 * The nudge towards the workshop, retired the first time it opens.
 *
 * The key is the original one: anybody who already found the bag this replaced
 * must not be nudged again just because it grew into a workshop.
 */
export const workshopHint = () =>
  new OneTimeHint("hint", "graffiti.backpackOpened");

/**
 * The nudge about reaching for another can, retired the first time somebody
 * does.
 *
 * Proof beats acknowledgement here: a player who has pressed a number or
 * turned the wheel has learned the thing the hint exists to teach, so it goes
 * without ever needing to be dismissed on purpose.
 */
export const canHint = () => new OneTimeHint("can-tip", "graffiti.canPicked");
