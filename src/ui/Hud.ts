import { CAP_BY_ID, LOADOUT } from "../config";
import type { Loadout } from "../state/Loadout";
import { inkFor } from "./workshop/ColourMath";
import { t } from "../i18n/i18n";

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
 * cap that momentum tail spins through the rack twice. Tuned by measuring
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
 * the rack. Travel resets on every step rather than carrying a remainder, so
 * one notch is always exactly one step and never occasionally two.
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

export type HudHandlers = {
  /** Fires on any deliberate can change, which is what retires the hint. */
  onCanPicked: () => void;
};

/**
 * The can rack along the bottom of the screen, and the keys that reach it.
 *
 * It is a readout, not a control surface: pointer lock owns the cursor while
 * you play, so a rack slot can never be clicked. Everything it shows is
 * therefore something a key or the wheel can also do, and every slot prints
 * the number that reaches it — that is the whole reason the numbers are there.
 *
 * The rack is a view onto the loadout and edits nothing. What it changes is
 * which can is in hand; what is *in* a can is the workshop's business.
 */
export function buildHud(
  loadout: Loadout,
  isPlaying: () => boolean,
  handlers: HudHandlers,
) {
  const host = document.getElementById("can-rack")!;
  const slots: HTMLElement[] = [];

  for (let i = 0; i < LOADOUT.CANS; i++) {
    const slot = document.createElement("div");
    slot.className = "can-slot";

    const chip = document.createElement("span");
    chip.className = "can-slot__chip";

    const cap = document.createElement("span");
    cap.className = "can-slot__cap";

    const key = document.createElement("span");
    key.className = "can-slot__key";
    key.textContent = String(i + 1);

    slot.append(chip, cap, key);
    host.appendChild(slot);
    slots.push(slot);
  }

  const render = () => {
    loadout.cans.forEach((can, i) => {
      const slot = slots[i];
      const active = i === loadout.canIndex;
      slot.dataset.active = String(active);
      slot.style.setProperty("--paint", can.color);
      slot.style.setProperty("--ink", inkFor(can.color));
      slot.title = `${i + 1} · ${t(`cap.${can.cap}.label`)}`;

      const chip = slot.querySelector<HTMLElement>(".can-slot__chip")!;
      chip.style.background = can.color;
      // The cap's own outline would be better than its name, but the slot is
      // 3 rem wide and a name is what people say out loud.
      slot.querySelector<HTMLElement>(".can-slot__cap")!.textContent = t(
        `cap.${CAP_BY_ID.get(can.cap)!.id}.label`,
      );
    });
  };

  loadout.onChange(render);
  render();

  const pick = (index: number) => {
    if (index === loadout.canIndex) return;
    loadout.selectCan(index);
    handlers.onCanPicked();
  };

  // Keys 1-8 reach a can. Gated on play, so the workshop and the menus get
  // their own turn at the number keys without the two fighting.
  window.addEventListener("keydown", (e) => {
    if (!isPlaying()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    if (Number.isNaN(n) || n < 1 || n > LOADOUT.CANS) return;
    pick(n - 1);
  });

  const sizeStep = createWheelStepper();
  const canStep = createWheelStepper();

  window.addEventListener(
    "wheel",
    (e) => {
      if (!isPlaying()) return;

      // Alt + wheel still resizes the cone, and now it writes through to the
      // can, so a width found in the street is the width the workshop shows.
      // Shift is left alone for running.
      if (e.altKey) {
        // Scrolling down reports a positive delta and should shrink the cone.
        const step = sizeStep(e);
        if (step === 0) return;
        const can = loadout.current;
        loadout.editCurrent({
          size: can.size * Math.exp(-step * 0.12),
        });
        return;
      }

      // Bare wheel walks the rack. Any other modifier is somebody else's.
      if (e.shiftKey || e.ctrlKey || e.metaKey) return;
      const step = canStep(e);
      if (step === 0) return;

      loadout.stepCan(step);
      handlers.onCanPicked();
    },
    { passive: true },
  );
}
