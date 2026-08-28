/** Lets the browser paint before the main thread goes back to blocking it. */
function nextFrame() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve()),
  );
}

/** How long the fade out lasts. Matches the transition in the stylesheet. */
const FADE_MS = 500;

/**
 * The first thing on screen, and the only thing that can report progress
 * honestly — it lives in the markup, so the browser paints it before the
 * module script runs at all.
 *
 * Steps are counted, not estimated. Every await in the start-up sequence
 * reports one, and `breathe()` yields a frame afterwards so the bar actually
 * moves instead of jumping to the end once everything is already done.
 *
 * It is hidden rather than removed when it finishes, because changing map runs
 * the same sequence again: new files, new panel canvases, the same blocked
 * main thread. One screen for both is one screen to keep honest.
 */
export class LoadingScreen {
  private root = document.getElementById("loading")!;
  private bar = document.getElementById("loading-bar")!;
  private steps = 1;
  private done = 0;

  constructor(steps: number) {
    this.steps = steps;
  }

  /**
   * Brings it back for another load, with a fresh count of steps.
   *
   * The reflow between un-hiding and un-fading is not superstition: without it
   * the browser coalesces both into one style change, sees no transition to
   * run, and the screen snaps in rather than fading.
   */
  reopen(steps: number) {
    this.steps = steps;
    this.done = 0;
    this.bar.style.width = "0%";
    this.root.hidden = false;
    void this.root.offsetWidth;
    this.root.classList.remove("done");
  }

  advance() {
    this.done = Math.min(this.steps, this.done + 1);
    this.bar.style.width = `${(this.done / this.steps) * 100}%`;
  }

  breathe() {
    return nextFrame();
  }

  async finish() {
    this.bar.style.width = "100%";
    await nextFrame();
    this.root.classList.add("done");
    window.setTimeout(() => {
      // Hidden, not removed: the next map needs this same screen. Taking it out
      // of the accessibility tree as well as out of sight is what `hidden` is
      // for — opacity alone would leave a screen reader announcing it.
      if (this.root.classList.contains("done")) this.root.hidden = true;
    }, FADE_MS);
  }
}
