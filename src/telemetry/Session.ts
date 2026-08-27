import { ANALYTICS } from "../config";

declare global {
  interface Window {
    /** Present once the tracker script has loaded, absent if it was blocked. */
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

/**
 * What one visit produced.
 *
 * There is deliberately nothing here that identifies a person, and nothing
 * about where they are: the country is Umami's business, derived from the
 * request and kept as a place. The address itself is personal data under the
 * LGPD, and the question being asked is "which countries", not "which person".
 */
type Visit = {
  /** Time with the page actually in front of someone. */
  activeMs: number;
  /** Of that, time in the street rather than in a menu. */
  playingMs: number;
  /** Sprays and paint runs finished. */
  marks: number;
};

/** A single frame can never be worth more than this, whatever the clock says. */
const MAX_TICK_MS = 1000;

/**
 * Times a visit and reports it once, as it ends.
 *
 * Nothing is kept between visits. Storing the numbers on the client would only
 * hide them somewhere unreadable — a browser cannot be queried from outside —
 * so the visit is measured here and handed over before the page goes away.
 */
export class Session {
  private visit: Visit = { activeMs: 0, playingMs: 0, marks: 0 };
  private lastTick = performance.now();
  private reported = false;

  constructor() {
    document.addEventListener("visibilitychange", () => {
      // Coming back from a hidden tab, the clock has run but the visit has
      // not. Without this the whole absence lands in the next frame's delta.
      if (!document.hidden) this.lastTick = performance.now();
    });

    // pagehide fires where beforeunload does not — notably on mobile, where a
    // tab is usually discarded rather than closed. Umami posts with fetch
    // keepalive, which is specified to outlive the page, so the numbers still
    // arrive from here.
    window.addEventListener("pagehide", () => this.send());
  }

  /** Called once a frame. `playing` means the street, not a menu. */
  update(playing: boolean) {
    const now = performance.now();
    const elapsed = Math.min(now - this.lastTick, MAX_TICK_MS);
    this.lastTick = now;

    // A hidden tab is not a visit. Some browsers stop the frame loop entirely
    // and some throttle it to a crawl, so this cannot be left to the loop.
    if (document.hidden) return;

    this.visit.activeMs += elapsed;
    if (playing) this.visit.playingMs += elapsed;
  }

  countMark() {
    this.visit.marks++;
  }

  private send() {
    if (this.reported || this.visit.activeMs < ANALYTICS.MIN_VISIT_MS) return;
    this.reported = true;

    // Seconds rather than milliseconds: the dashboard has to be read by a
    // person, and nobody wants to divide 184000 in their head.
    window.umami?.track(ANALYTICS.EVENT, {
      activeSec: Math.round(this.visit.activeMs / 1000),
      playingSec: Math.round(this.visit.playingMs / 1000),
      marks: this.visit.marks,
    });
  }
}
