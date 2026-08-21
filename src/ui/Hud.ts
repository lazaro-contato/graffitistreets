import { PALETTE } from "../config";
import type { SprayCan } from "../paint/SprayCan";

/** Firefox reports wheel deltas in lines, and page mode exists on some setups. */
function normalizeWheelDelta(e: WheelEvent): number {
  const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
  return e.deltaY * scale;
}

/** A gap this long means the user started a fresh flick, not continued one. */
const GESTURE_GAP_MS = 180;
/**
 * Fastest a held scroll may step. This exists for one reason: a macOS trackpad
 * keeps firing events for over a second after the fingers lift, and without a
 * cap that momentum tail spins through the palette twice. Tuned by measuring
 * real device profiles — below ~90 ms the tail runs away, above ~120 ms a
 * gentle swipe starts to feel sticky again.
 */
const MIN_STEP_MS = 110;
/** Travel needed for each step once a gesture is already under way. */
const STEP_TRAVEL = 16;

/**
 * Turns a wheel event stream into discrete steps, one at a time.
 *
 * Wheel hardware is wildly inconsistent: a mouse notch arrives as a single
 * ~100 px event, while a macOS trackpad sends a flood of 2-4 px ones. Waiting
 * for a fixed amount of travel — the obvious approach — makes the trackpad
 * feel broken, since a light swipe never reaches the threshold at all.
 *
 * So the first event of a gesture always steps, immediately, whatever its
 * size. Only once a gesture is under way does travel matter, and a minimum
 * interval keeps the long momentum tail of a hard flick from spinning through
 * the palette. Travel resets on every step rather than carrying a remainder,
 * so one notch is always exactly one step and never occasionally two.
 */
function createWheelStepper() {
  let travel = 0;
  let lastEvent = -Infinity;
  let lastStep = -Infinity;

  /** Returns -1, 0 or 1. */
  return (e: WheelEvent): number => {
    const delta = normalizeWheelDelta(e);
    if (delta === 0) return 0;

    const now = performance.now();
    const startsGesture = now - lastEvent > GESTURE_GAP_MS;
    lastEvent = now;

    if (startsGesture) {
      travel = 0;
      lastStep = now;
      return Math.sign(delta);
    }

    travel += delta;
    if (Math.abs(travel) < STEP_TRAVEL) return 0;
    if (now - lastStep < MIN_STEP_MS) return 0;

    lastStep = now;
    const direction = Math.sign(travel);
    travel = 0;
    return direction;
  };
}

/**
 * Builds the colour palette and wires the keyboard and wheel shortcuts.
 *
 * `isPlaying` gates the wheel: the backpack panel scrolls on its own, so
 * without it, reading through the caps would silently repaint your can.
 */
export function buildHud(can: SprayCan, isPlaying: () => boolean) {
  const palette = document.getElementById("palette")!;
  const swatches: HTMLButtonElement[] = [];

  const selectIndex = (index: number) => {
    can.setColor(PALETTE[index]);
    swatches.forEach((swatch, i) =>
      swatch.setAttribute("aria-pressed", String(i === index)),
    );
  };

  PALETTE.forEach((hex, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.background = hex;
    button.setAttribute("aria-pressed", String(hex === can.color));
    button.title = hex;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      selectIndex(index);
    });
    swatches.push(button);
    palette.appendChild(button);
  });

  /** Where the can's colour sits in the palette right now. */
  const currentIndex = () => {
    const found = (PALETTE as readonly string[]).indexOf(can.color);
    return found < 0 ? 0 : found;
  };

  // Keys 1-9 and 0 pick a color
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    if (Number.isNaN(n)) return;
    const index = n === 0 ? 9 : n - 1;
    if (index < PALETTE.length) selectIndex(index);
  });

  const sizeStep = createWheelStepper();
  const colorStep = createWheelStepper();

  window.addEventListener(
    "wheel",
    (e) => {
      if (!isPlaying()) return;

      // Alt + wheel resizes the cone. Shift is left alone for running.
      if (e.altKey) {
        // Scrolling down reports a positive delta and should shrink the cone.
        const step = sizeStep(e);
        if (step !== 0) can.adjustSize(-step);
        return;
      }

      // Bare wheel walks the palette. Any other modifier is somebody else's.
      if (e.shiftKey || e.ctrlKey || e.metaKey) return;
      const step = colorStep(e);
      if (step === 0) return;

      // Scrolling down moves forward through the palette, wrapping at the end.
      const count = PALETTE.length;
      selectIndex((((currentIndex() + step) % count) + count) % count);
    },
    { passive: true },
  );
}
