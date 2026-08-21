/** Keyboard and mouse state. Reads raw events, exposes intent. */
export class Input {
  private keys = new Set<string>();
  isPainting = false;

  constructor(domElement: HTMLElement) {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    // Alt-tabbing while holding W would otherwise leave the player walking
    // forever, because the keyup fires outside the window.
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.isPainting = false;
    });

    domElement.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.isPainting = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.isPainting = false;
    });
  }

  isDown(code: string) {
    return this.keys.has(code);
  }

  /** Local input vector: x = strafe, z = forward. */
  getMoveVector(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) z += 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) z -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }

  get isRunning() {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }

  get isCrouching() {
    return this.isDown("ControlLeft") || this.isDown("ControlRight");
  }

  /**
   * Held rather than edge triggered, so keeping space down keeps hopping.
   * That is the useful behaviour here: you jump to reach the top of a wall and
   * usually want a second go straight away.
   */
  get isJumping() {
    return this.isDown("Space");
  }
}
