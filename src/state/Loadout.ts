import {
  CAP_BY_ID,
  DEFAULT_CANS,
  LOADOUT,
  SPRAY,
  type CanSpec,
  type CapId,
} from "../config";

/** One named set of cans. Four of these exist, always. */
export type Preset = {
  name: string;
  cans: CanSpec[];
};

const STORAGE_KEY = "graffiti.loadout";
/**
 * Bumped whenever the shape on disk changes in a way older data cannot satisfy.
 * A mismatch is discarded rather than migrated: this is a loadout, not a
 * painting — rebuilding it costs a minute, and guessing at half-read data
 * costs somebody a session with a can that sprays nothing.
 */
const STORAGE_VERSION = 1;

type Stored = {
  version: number;
  active: number;
  presets: Preset[];
};

/** Default names. Letters rather than words, so no translation can drift. */
const defaultName = (index: number) => String.fromCharCode(65 + index);

const freshCans = (): CanSpec[] => DEFAULT_CANS.map((can) => ({ ...can }));

const freshPreset = (index: number): Preset => ({
  name: defaultName(index),
  cans: freshCans(),
});

/** Clamps anything read off disk back into something the game can spray. */
function sanitise(can: unknown, fallback: CanSpec): CanSpec {
  const raw = (can ?? {}) as Partial<CanSpec>;
  const cap: CapId = CAP_BY_ID.has(raw.cap as CapId)
    ? (raw.cap as CapId)
    : fallback.cap;
  const color =
    typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color)
      ? raw.color.toLowerCase()
      : fallback.color;

  const clamp = (value: unknown, min: number, max: number, or: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : or;

  return {
    cap,
    color,
    size: clamp(raw.size, SPRAY.MIN_SIZE, SPRAY.MAX_SIZE, fallback.size),
    flow: clamp(raw.flow, LOADOUT.MIN_FLOW, LOADOUT.MAX_FLOW, fallback.flow),
  };
}

/**
 * The eight cans, times four presets, and which of each is in hand.
 *
 * It owns the data and nothing else: no DOM, no canvas, no `SprayCan`. The
 * workshop edits it, the HUD reads it, and `main.ts` is what pushes a selected
 * can into the actual spray can. That separation is what lets the same loadout
 * drive a rack on screen and a row of cards in the workshop without either
 * knowing the other exists.
 *
 * Every mutation persists immediately. There is no Save button by design — a
 * workshop where changes can be lost is a workshop people back out of.
 */
export class Loadout {
  private presets: Preset[];
  private activePreset = 0;
  private activeCan = 0;
  private listeners: (() => void)[] = [];

  constructor() {
    this.presets = Array.from({ length: LOADOUT.PRESETS }, (_, i) =>
      freshPreset(i),
    );
    this.restore();
  }

  /** Fires on any change: a different can in hand, or an edit to one. */
  onChange(listener: () => void) {
    this.listeners.push(listener);
  }

  private changed() {
    this.persist();
    for (const listener of this.listeners) listener();
  }

  get presetList(): readonly Preset[] {
    return this.presets;
  }

  get presetIndex() {
    return this.activePreset;
  }

  get canIndex() {
    return this.activeCan;
  }

  get cans(): readonly CanSpec[] {
    return this.presets[this.activePreset].cans;
  }

  /** The can currently in hand. */
  get current(): CanSpec {
    return this.cans[this.activeCan];
  }

  selectPreset(index: number) {
    if (index < 0 || index >= this.presets.length) return;
    if (index === this.activePreset) return;
    this.activePreset = index;
    this.changed();
  }

  selectCan(index: number) {
    if (index < 0 || index >= LOADOUT.CANS) return;
    if (index === this.activeCan) return;
    this.activeCan = index;
    this.changed();
  }

  /** Steps through the rack, wrapping. Used by the wheel. */
  stepCan(direction: number) {
    const count = LOADOUT.CANS;
    this.selectCan(((this.activeCan + direction) % count + count) % count);
  }

  renamePreset(index: number, name: string) {
    const preset = this.presets[index];
    if (!preset) return;
    // An empty name would leave an unclickable blank tab, so it falls back to
    // the letter rather than being rejected with an error nobody asked for.
    preset.name = name.trim().slice(0, 12) || defaultName(index);
    this.changed();
  }

  /** Edits the can in hand. Partial, because each control owns one field. */
  editCurrent(change: Partial<CanSpec>) {
    const can = this.current;
    const next = sanitise({ ...can, ...change }, can);
    if (
      next.cap === can.cap &&
      next.color === can.color &&
      next.size === can.size &&
      next.flow === can.flow
    ) {
      return;
    }
    this.presets[this.activePreset].cans[this.activeCan] = next;
    this.changed();
  }

  /**
   * Puts the active preset back to the starting eight.
   *
   * Only the active one: Reset sits inside the preset it is editing, and a
   * button that quietly wiped the other three would be a trap.
   */
  resetPreset() {
    this.presets[this.activePreset].cans = freshCans();
    this.changed();
  }

  private persist() {
    const data: Stored = {
      version: STORAGE_VERSION,
      active: this.activePreset,
      presets: this.presets,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Private mode, or a full quota. The loadout still holds for this visit.
    }
  }

  private restore() {
    let saved: Stored | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      saved = raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
      saved = null; // unreadable or unparseable: start fresh, silently
    }
    if (!saved || saved.version !== STORAGE_VERSION) return;

    this.presets = Array.from({ length: LOADOUT.PRESETS }, (_, i) => {
      const stored = saved.presets?.[i];
      const fallback = freshPreset(i);
      if (!stored) return fallback;

      return {
        name:
          typeof stored.name === "string" && stored.name.trim()
            ? stored.name.slice(0, 12)
            : fallback.name,
        // Sized from the constant rather than from the file, so a saved preset
        // from a build with fewer cans fills its new slots from the defaults.
        cans: Array.from({ length: LOADOUT.CANS }, (_, c) =>
          sanitise(stored.cans?.[c], fallback.cans[c]),
        ),
      };
    });

    if (
      typeof saved.active === "number" &&
      saved.active >= 0 &&
      saved.active < this.presets.length
    ) {
      this.activePreset = saved.active;
    }
  }
}
