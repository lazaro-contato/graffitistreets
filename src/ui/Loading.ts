/** Lets the browser paint before the main thread goes back to blocking it. */
function nextFrame() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve()),
  );
}

/**
 * The first thing on screen, and the only thing that can report progress
 * honestly — it lives in the markup, so the browser paints it before the
 * module script runs at all.
 *
 * Steps are counted, not estimated. Every await in the start-up sequence
 * reports one, and `breathe()` yields a frame afterwards so the bar actually
 * moves instead of jumping to the end once everything is already done.
 */
export class LoadingScreen {
  private root = document.getElementById("loading")!;
  private bar = document.getElementById("loading-bar")!;
  private done = 0;

  constructor(private readonly steps: number) {}

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
    window.setTimeout(() => this.root.remove(), 500);
  }
}
