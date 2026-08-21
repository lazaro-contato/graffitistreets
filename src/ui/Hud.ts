import { PALETTE } from "../config";
import type { SprayCan } from "../paint/SprayCan";

/** Wheel travel, in normalised pixels, worth one spray size step. */
const WHEEL_NOTCH = 100;

/** Firefox reports wheel deltas in lines, and page mode exists on some setups. */
function normalizeWheelDelta(e: WheelEvent): number {
  const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
  return e.deltaY * scale;
}

/** Builds the color palette and wires its keyboard and wheel shortcuts. */
export function buildHud(can: SprayCan) {
  const palette = document.getElementById("palette")!;

  const select = (button: HTMLButtonElement, hex: string) => {
    can.setColor(hex);
    for (const other of palette.querySelectorAll("button")) {
      other.setAttribute("aria-pressed", String(other === button));
    }
  };

  for (const hex of PALETTE) {
    const button = document.createElement("button");
    button.style.background = hex;
    button.setAttribute("aria-pressed", String(hex === can.color));
    button.title = hex;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      select(button, hex);
    });
    palette.appendChild(button);
  }

  // Keys 1-9 and 0 pick a color
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    if (Number.isNaN(n)) return;
    const index = n === 0 ? 9 : n - 1;
    const button = palette.children[index] as HTMLButtonElement | undefined;
    button?.click();
  });

  // Alt + wheel resizes the spray cone. Shift is left alone for running.
  let wheelTravel = 0;
  window.addEventListener(
    "wheel",
    (e) => {
      if (!e.altKey) return;

      // A mouse notch reports ~100 px in one event; a trackpad reports a
      // stream of small ones. Accumulating and spending whole notches makes
      // both devices step at the same rate, instead of a single trackpad flick
      // running through the entire size range.
      wheelTravel += normalizeWheelDelta(e);
      const notches = Math.trunc(wheelTravel / WHEEL_NOTCH);
      if (notches === 0) return;
      wheelTravel -= notches * WHEEL_NOTCH;

      // Scrolling down reports a positive delta and should shrink the cone.
      can.adjustSize(-notches);
    },
    { passive: true },
  );
}
