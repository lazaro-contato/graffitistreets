type UpdateFn = (dt: number, elapsed: number) => void;

/** Maximum delta per frame. Without it, coming back from a background tab
 *  produces a huge dt and the player teleports across the world. */
const MAX_DELTA = 0.05;

export class Loop {
  private clock = { last: performance.now(), elapsed: 0 };
  private callbacks: UpdateFn[] = [];
  private running = false;

  add(fn: UpdateFn) {
    this.callbacks.push(fn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }

  private tick = (now: number) => {
    if (!this.running) return;
    const dt = Math.min((now - this.clock.last) / 1000, MAX_DELTA);
    this.clock.last = now;
    this.clock.elapsed += dt;
    for (const fn of this.callbacks) fn(dt, this.clock.elapsed);
    requestAnimationFrame(this.tick);
  };
}
