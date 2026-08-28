import {
  clamp,
  hexToRgb,
  hsvToRgb,
  isHex,
  normaliseHex,
  rgbToHex,
  rgbToHsv,
  type Hsv,
} from "./ColourMath";

/**
 * Drags a value out of an element, in 0..1 on each axis.
 *
 * Pointer capture is what makes the knob keep following once the cursor has
 * left the strip, which is how every colour picker anyone has used behaves.
 */
function dragify(
  element: HTMLElement,
  onMove: (x: number, y: number) => void,
) {
  let dragging = false;

  const report = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    onMove(
      clamp((event.clientX - rect.left) / rect.width, 0, 1),
      clamp((event.clientY - rect.top) / rect.height, 0, 1),
    );
  };

  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    dragging = true;
    report(event);
  });
  element.addEventListener("pointermove", (event) => {
    if (dragging) report(event);
  });
  const stop = () => {
    dragging = false;
  };
  element.addEventListener("pointerup", stop);
  element.addEventListener("pointercancel", stop);
}

/**
 * The colour mixer: saturation/value square, hue strip, hex field.
 *
 * A modal rather than an inline control because it is the one place in the
 * workshop where a choice can be abandoned. Everything else saves as you touch
 * it; a half-dragged hue is not a decision yet, so this one has Confirm and
 * Cancel and reports nothing until Confirm.
 *
 * There is no alpha channel, unlike the sketch this was drawn from. Coverage
 * here is the can's flow, which is a property of how hard it sprays rather
 * than of the colour — two dials for one thing would only disagree.
 */
export class ColourPicker {
  private root = document.getElementById("wk-picker")!;
  private sv = document.getElementById("wk-sv")!;
  private svKnob = document.getElementById("wk-sv-knob")!;
  private hue = document.getElementById("wk-hue")!;
  private hueKnob = document.getElementById("wk-hue-knob")!;
  private preview = document.getElementById("wk-mix-prev")!;
  private field = document.getElementById("wk-mix-hex") as HTMLInputElement;

  private hsv: Hsv = { h: 0, s: 1, v: 1 };
  private resolve: ((hex: string | null) => void) | null = null;

  constructor() {
    dragify(this.sv, (x, y) => {
      this.hsv.s = x;
      this.hsv.v = 1 - y;
      this.sync(true);
    });
    dragify(this.hue, (x) => {
      this.hsv.h = x;
      this.sync(true);
    });

    this.field.addEventListener("input", () => {
      if (!isHex(this.field.value)) return;
      this.hsv = rgbToHsv(hexToRgb(normaliseHex(this.field.value)));
      // Not writing the field back: it is what the user is typing into, and
      // reformatting mid-keystroke moves the caret out from under them.
      this.sync(false);
    });

    document
      .getElementById("wk-mix-ok")!
      .addEventListener("click", () => this.settle(this.hex()));
    document
      .getElementById("wk-mix-cancel")!
      .addEventListener("click", () => this.settle(null));
    this.root.addEventListener("pointerdown", (event) => {
      if (event.target === this.root) this.settle(null);
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /** Resolves with the chosen colour, or null if it was abandoned. */
  open(startingHex: string): Promise<string | null> {
    // A picker opened twice without being closed would strand the first
    // promise forever, so the outgoing one is settled as a cancel first.
    this.settle(null);

    this.hsv = rgbToHsv(hexToRgb(startingHex));
    this.sync(true);
    this.root.hidden = false;
    this.field.focus({ preventScroll: true });
    this.field.select();

    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Called by the workshop when Escape is pressed. */
  cancel() {
    this.settle(null);
  }

  private settle(hex: string | null) {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;
    this.root.hidden = true;
    resolve(hex);
  }

  private hex() {
    return rgbToHex(hsvToRgb(this.hsv));
  }

  private sync(writeField: boolean) {
    const hex = this.hex();
    // The square is painted with the pure hue; its own two gradients supply
    // the white and the black, so only this one colour has to be set.
    const pure = rgbToHex(hsvToRgb({ h: this.hsv.h, s: 1, v: 1 }));

    this.sv.style.background = pure;
    this.svKnob.style.left = `${this.hsv.s * 100}%`;
    this.svKnob.style.top = `${(1 - this.hsv.v) * 100}%`;
    this.svKnob.style.background = hex;

    this.hueKnob.style.left = `${this.hsv.h * 100}%`;
    this.hueKnob.style.background = pure;

    this.preview.style.background = hex;
    if (writeField) this.field.value = hex.toUpperCase();
  }
}
